# MMBA — Development Guide (Step 12)

## Prerequisites

- Node.js 22+
- PostgreSQL 15+ (or Docker)
- npm / bun

## Environment Variables

Copy `.env.example` → `.env` and fill in real values:

```env
# Required for production startup
JWT_SECRET=<64-char random string>
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public

# Tenant resolution (Step 12)
DEV_TENANT_SLUG=initial              # DEV ONLY: shortcut tenant for localhost
TENANT_PARENT_DOMAINS=mmba.example,localhost  # comma-separated parent domains

# Optional
VAPID_PUBLIC_KEY=<...>
VAPID_PRIVATE_KEY=<...>
VAPID_SUBJECT=mailto:admin@example.com
TRUST_PROXY=true
ALLOWED_ORIGINS=https://app.example.com
PORT=3000
NODE_ENV=development
```

## Database Setup

```bash
# Start PostgreSQL (Docker)
docker compose up -d postgres

# Run migrations (clean DB → schema)
npx prisma db migrate deploy

# Or from a fresh checkout:
# npm ci && npx prisma migrate deploy

# Seed platform data (business categories, plans, initial tenant)
npx tsx scripts/seed-platform.ts

# Optional: migrate legacy JSON data to PG (idempotent)
npx tsx scripts/migrate-json-to-pg.ts
```

## Running the App

```bash
# Development (Vite HMR + tsx)
npm run dev

# Production build + run
npm run build
npm start
```

## Database Inspection (Prisma Studio)

```bash
npm run db:studio
# Opens http://localhost:5555 — inspect tenants, memberships, business data
```

## Local Tenant Hostname Strategy

| Environment | Hostname Pattern | Example |
|-------------|------------------|---------|
| Local dev (with `DEV_TENANT_SLUG`) | `localhost:3000` or `tenant-slug.localhost:3000` | `initial.localhost:3000` |
| Local dev (bare) | `localhost:3000` → first ACTIVE tenant | — |
| Test/CI | `tenant-slug.mmba.example` | `tenant-a.mmba.example` |
| Production | `tenant-slug.yourdomain.com` | `acme.example.com` |

**No `/etc/hosts` edits needed** — the resolver uses `TENANT_PARENT_DOMAINS` to extract the slug from the `Host` header.

## Key Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build (Vite + esbuild) |
| `npm run start` | Run built server |
| `npm run typecheck` | Prisma contract + `tsc --noEmit` |
| `npm run db:studio` | Prisma Studio for DB inspection |
| `npm run db:seed` | Migrate JSON → PG + seed platform |
| `npm run test:isolation` | Cross-tenant isolation smoke test |
| `npm run test:context` | Tenant context resolution test |
| `npm run test:verticals` | Vertical CRUD + isolation test |
| `npm run test:rbac` | Step 11B authorization logic test |
| `npm run test:rbac:http` | Step 11B HTTP authorization test |

## Project Structure (Key Files)

```
server/
├── routes.ts              # Main API router
├── tenantContext.ts       # Hostname → tenant resolution
├── tenantRepository.ts    # Generic tenant-scoped repository factory
├── tenantVerticals.ts     # Table→column registry for generic routes
├── tenantTableModules.ts  # Table→module authorization map (Step 11B)
├── provisioningService.ts # Tenant create/lifecycle/membership (Step 12)
├── platformRoutes.ts      # /v2/platform/* (platform admin only)
├── tenantAdminRoutes.ts   # /v2/tenant/* (tenant admin for current tenant)
├── pg.ts                  # pg pool + query/execute helpers
├── auth.ts                # JWT sign/verify + bcrypt
├── security.ts            # CORS, rate limits, headers
└── config.ts              # Required env validation

scripts/
├── migrate-json-to-pg.ts  # Legacy JSON → PG (idempotent)
└── seed-platform.ts       # Platform categories, plans, tenant linkage

test/
├── step12-provisioning.ts    # Provisioning + lifecycle + isolation (unit+DB)
├── step12-platform-http.ts   # Platform/tenant admin + cross-tenant HTTP tests
├── step12-isolation.ts       # Repository isolation smoke test
├── step12-tenant-context.ts  # Hostname resolution smoke test
├── step12-verticals.ts       # Generic vertical CRUD + isolation test
├── step11bfix-authorization.ts # Step 11B logic regression
└── step11bfix-generic-routes-http.ts # Step 11B HTTP regression
```

## Adding a New Tenant-Owned Table

1. Add model to `prisma/schema.prisma` with `tenantId` + `@@index([tenantId, ...])`.
2. Run `npx prisma migrate dev --name add_<table>` (or `prisma migration new` + edit).
3. Add column list to `server/tenantVerticals.ts` `COLUMNS`.
4. Add entry to `server/tenantTableModules.ts` `TENANT_TABLE_MODULES`.
5. Run `npm run contract:emit && npm run typecheck`.
6. Add HTTP tests in `test/step12-verticals.ts` or `step12-platform-http.ts`.

## Common Patterns

**Tenant-scoped query:**
```ts
const rows = await query('SELECT * FROM "myTable" WHERE "tenantId" = $1', [tc.tenantId]);
```

**Never trust client tenant:**
```ts
// BAD
const tenantId = req.body.tenantId;

// GOOD — from server-resolved hostname + membership
const tc = req.tenantContext;
const tenantId = tc.tenantId;
```

**Platform-admin check:**
```ts
const pa = await query('SELECT id FROM "platformAdmin" WHERE "userId" = $1', [userId]);
if (!pa[0]) return res.status(403).json({...});
```

## Useful Queries

```sql
-- All tenants with their primary domain
SELECT t.id, t.slug, t.name, t.status, d.hostname
FROM tenant t
LEFT JOIN "tenantDomain" d ON d."tenantId" = t.id AND d."isPrimary"
ORDER BY t."createdAt" DESC;

-- Memberships with user names
SELECT m.*, u.name, u.username
FROM membership m
JOIN "user" u ON u.id = m."userId"
WHERE m."tenantId" = '<tenant-id>';

-- Cross-tenant leakage check (should return 0)
SELECT * FROM "myTable" a
JOIN "myTable" b ON a.id = b.id AND a."tenantId" <> b."tenantId";
```