# MMBA — Development Guide (Step 12 FIX)

## Prerequisites

- Node.js 22+ (verified on 24.11.1)
- PostgreSQL 15+
- npm

## Setup

```bash
npm ci
cp .env.example .env      # then edit DATABASE_URL and JWT_SECRET
```

## Environment Variables

```env
# Required
DATABASE_URL="postgresql://user:pass@localhost:5432/mmbadb?schema=public"
JWT_SECRET=<64-char random string>

# Tenant resolution
TENANT_PARENT_DOMAINS="mmba.example,localhost"   # comma-separated; first is canonical
DEV_TENANT_SLUG=""                                # DEV ONLY, ignored when NODE_ENV=production

# Optional
VAPID_PUBLIC_KEY=<...>
VAPID_PRIVATE_KEY=<...>       # must be set together with the public key
TRUST_PROXY=false
ALLOWED_ORIGINS=http://localhost:5173
PORT=3000
NODE_ENV=development

# Step 12 FIX §17/§18 — legacy JSON tenant-path gate
# Set to 1 ONLY for a staged cutover. Leave unset in production.
ALLOW_LEGACY_JSON_TENANT_PATHS=
```

## Database — the three commands are distinct

| Command | What it does |
|---|---|
| `npm run db:migrate` | Applies schema migrations. Safe to re-run. |
| `npm run db:seed` | Seeds platform reference data (categories, plans, entitlements). Idempotent. |
| `npm run db:migrate:legacy` | Imports the legacy JSON store into PostgreSQL. Idempotent, and reports reconciliation. |

They are deliberately separate. `db:seed` does **not** perform a production
data migration, and `db:migrate:legacy` does **not** seed reference data.

```bash
npm run db:migrate                              # schema
npm run db:seed                                 # platform reference data
npm run db:migrate:legacy                       # legacy JSON → PostgreSQL
npm run db:migrate:legacy:dry                   # classify only, no writes
npm run db:status                               # migration status
npm run db:verify                               # DB matches the contract?
npm run db:studio                               # Prisma Studio
```

### Bootstrap from an empty database

```bash
createdb mmbadb                               # or however you provision it
DATABASE_URL="postgresql://.../mmbadb" npm run db:migrate
DATABASE_URL="postgresql://.../mmbadb" npm run db:seed
```

`db:migrate` creates the complete schema: **46 tables, 42 foreign keys,
176 indexes, 29 unique constraints** (verified on an empty database by
`npm run test:fresh`).

## Running

```bash
npm run dev        # Vite HMR + tsx
npm run build      # prebuild (prisma contract emit) + vite build + esbuild bundle
npm start          # run the built server
npm run typecheck  # prisma contract emit && tsc --noEmit
```

> `prisma/schema.d.ts` and `prisma/schema.json` are **generated, not tracked**
> (`.gitignore`). `prisma/db.ts` imports both, so on a clean clone they must be
> regenerated first. `npm run typecheck` and `npm run build` both do this
> automatically (`prebuild` + the `contract:emit` prefix on `typecheck`). If you
> run `tsc --noEmit` directly, run `npm run contract:emit` first.

## Tests

```bash
npm test                      # canonical aggregate — every suite
npm run test:unit             # pure logic only, no database
npm run test:db               # database suites
npm run test -- --skip=legacy # skip the slow scratch-database suites
```

`npm test` runs every suite and reports one summary. Individual suites:

| Command | Covers |
|---|---|
| `npm run test:fix` | concurrency (10 simultaneous provisions), domain trust, identity authority |
| `npm run test:legacy` | legacy migration, reconciliation, idempotency, ownership guards |
| `npm run test:fresh` | empty DB → migrate → seed → provision → login → cross-tenant attack matrix |
| `npm run test:gate` | legacy JSON tenant-path gate |
| `npm run test:provisioning` | provisioning + lifecycle |
| `npm run test:platform:http` | platform + tenant-admin HTTP surface |
| `npm run test:isolation` | repository tenant isolation |
| `npm run test:verticals` | generic vertical CRUD |
| `npm run test:rbac` | Step 11B authorization logic |
| `npm run test:rbac:http` | Step 11B HTTP authorization |
| `npm run test:context` | hostname → tenant resolution |

Every database suite uses a real PostgreSQL database. `test:legacy` and
`test:fresh` each create and drop their own disposable database.

## Tenant hostnames

The effective tenant comes from the `Host` header, never from the body or
query string.

| Environment | Hostname | Resolves to |
|---|---|---|
| Development | `<slug>.localhost:3000` | tenant by slug |
| Development | `localhost:3000` | first ACTIVE tenant (dev only) |
| Test/CI | `<slug>.mmba.example` | tenant by slug |
| Production | `<slug>.yourdomain.com` | tenant by slug |

A **custom domain** (`crm.acme.com`) is only honoured once it is `VERIFIED`.
Until then it returns 404 — an unverified domain never routes.

## Legacy JSON store — current status

The JSON store at `data/mmba_production_database.json` is **not** a production
data path. It remains as:

- the source for `npm run db:migrate:legacy`;
- a profile overlay for fields the PostgreSQL schema does not carry
  (per-user `permissions`, biometric device registrations).

In `NODE_ENV=production`, the 25 tenant-owned API prefixes still served from it
are refused with `409 LEGACY_JSON_PATH_DISABLED`. The server prints the current
surface state at startup:

```
[legacy-json] 25 tenant-owned and 0 user-scoped API prefixes are refused …
```

The full list is `server/legacyJsonGuard.ts`.

## Adding a new tenant-owned table

1. Add the model to `prisma/schema.prisma` with `tenantId` and an index.
2. `npx prisma migration plan --name add_<table>` then
   `node migrations/app/<dir>/migration.ts` to self-emit `ops.json`.
3. Add the column list to `COLUMNS` in `server/tenantVerticals.ts`.
4. Add the module mapping to `server/tenantTableModules.ts`.
5. Add the entity to `ENTITY_PLAN` **and** a `SIMPLE` entry in
   `scripts/migrate-json-to-pg.ts` — `assertPlanIsImplemented()` fails the
   migration if a plan entry has no importer, or an importer has no plan entry.
6. `npm run typecheck && npm test`

## Common patterns

**Tenant-scoped query:**
```ts
const rows = await query('SELECT * FROM "myTable" WHERE "tenantId" = $1', [tc.tenantId]);
```

**Never trust a client tenant:**
```ts
// BAD — client-controlled
const tenantId = req.body.tenantId;

// GOOD — server-resolved from hostname + ACTIVE membership
const tenantId = (req as any).tenantContext.tenantId;
```

**Platform-admin check:**
```ts
const pa = await query('SELECT id FROM "platformAdmin" WHERE "userId" = $1', [userId]);
```

**Identity is authoritative in PostgreSQL:**
```ts
import * as identity from './identity';
const user = await identity.authenticate(usernameOrEmail, password);
```

## Known limitations

- 25 legacy JSON tenant prefixes are blocked in production rather than migrated
  (`server/legacyJsonGuard.ts`). The PostgreSQL replacement exists
  (`/api/v2/tenants/:table`); the legacy routes are removed as each domain is
  migrated.
- `accountingPeriods` and `notificationSettings` remain JSON-only. The Prisma
  contract declares no `AccountingPeriod` model, so there is no table to
  migrate into.
- DNS verification for custom domains records the outcome of a control check
  but does not itself perform the DNS lookup; the proof is supplied by the
  caller.
- `npm run typecheck` reports 14 pre-existing errors in
  `ErrorBoundary.tsx`, `webAuthn.ts` and `pushService.ts`. They are unchanged by
  this work and are not Step 12 scope.
