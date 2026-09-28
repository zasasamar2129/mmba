# MMBA — Production Deployment (Step 12 FIX)

## Architecture

MMBA is a single Express process with **PostgreSQL as the authoritative data
store**. Platform administration and tenant administration are separate
authorities, and every tenant-owned row carries a `tenantId`.

```
Reverse proxy (TLS, X-Forwarded-*)
        │
        ▼
MMBA Node.js process
  ├── requireAuth            JWT + tokenVersion (PostgreSQL identity)
  ├── resolveTenantMiddleware  Host → TenantDomain → Tenant → Membership
  ├── legacyJsonTenantGate   §17/§18 — blocks the global-JSON surface
  ├── /v2/platform/*         platform admin only (PlatformAdmin row)
  ├── /v2/tenant/*           membership admin for the resolved tenant
  └── /v2/tenants/*          tenant-scoped CRUD via pg, always tenantId-filtered
        │
        ▼
PostgreSQL 15+  — 46 tables, 42 FKs, 176 indexes, 29 unique constraints
```

## Required Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **yes** | `postgresql://user:pass@host:5432/db?schema=public` |
| `JWT_SECRET` | **yes** | 64+ char random string. Startup refuses without it. |
| `TENANT_PARENT_DOMAINS` | **yes** | Comma-separated. The first entry is the canonical parent for new subdomains. |
| `ALLOWED_ORIGINS` | **yes** | CORS allowlist. No wildcards. |
| `NODE_ENV` | **yes** | Must be `production`. Enables the legacy-JSON gate. |
| `TRUST_PROXY` | when behind a proxy | `true` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | optional | Must be set **together** |
| `PORT` | optional | Default 3000 |
| `ALLOW_LEGACY_JSON_TENANT_PATHS` | **leave unset** | `1` disables the §17/§18 gate |

## Deployment

```bash
npm ci
npm run build

DATABASE_URL=... NODE_ENV=production npm run db:migrate    # schema
DATABASE_URL=... NODE_ENV=production npm run db:seed       # platform reference data
DATABASE_URL=... NODE_ENV=production npm run db:migrate:legacy  # only if migrating from JSON
NODE_ENV=production npm start
```

`db:migrate` is idempotent — re-run it on every deploy. `db:seed` is
idempotent and creates no default credentials. **Neither performs a production
data migration**; that is `db:migrate:legacy`, run once and separately.

Verify after migrating:

```bash
npm run db:status     # "Up to date"
npm run db:verify     # live schema matches the contract
```

## First Tenant

```bash
curl -X POST https://api.example.com/api/v2/platform/tenants \
  -H "Authorization: Bearer <platform-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Corp","slug":"acme"}'
```

- `201` — created.
- `200` with `"repeated": true` — that slug already has a tenant. Nothing was
  created. Under concurrent requests exactly one caller gets 201; the rest get
  200. That is the database uniqueness constraint working, not a race.

Requires a `PlatformAdmin` row. A tenant admin receives 403.

## Domains

| Kind | Example | Trust | Becomes routable |
|---|---|---|---|
| Platform subdomain | `acme.example.com` | Platform owns the parent zone | Immediately (`VERIFIED`) |
| Custom domain | `crm.acme.com` | Customer owns DNS | Only after `POST .../domain/verify` |

```bash
# Inspect a tenant's domain and what to publish
curl -H "Authorization: Bearer <pa>" \
  https://api.example.com/api/v2/platform/tenants/<id>/domain

# Verify (custom domains require a proof from a real control check)
curl -X POST -H "Authorization: Bearer <pa>" -H "Content-Type: application/json" \
  -d '{"proof":{"method":"DNS_TXT","token":"<value-from-the-dns-check>"}}' \
  https://api.example.com/api/v2/platform/tenants/<id>/domain/verify
```

A `PENDING` domain does **not** route: requests to it return 404. A client
cannot assert its own domain is verified — the `verified` field is not read
from the request body at all.

## Identity Authority

**PostgreSQL is authoritative for users.** `user.passwordHash`, `status` and
`tokenVersion` are read from PostgreSQL on every request; the JSON store is
consulted only for fields the schema does not carry (per-user `permissions`,
biometric devices).

- A `SUSPENDED`/`INACTIVE` user cannot log in, and any live token they hold is
  revoked immediately (`tokenVersion` is bumped).
- A membership always references a row in the PostgreSQL `user` table; the FK
  is enforced and provisioning refuses a user that is not there.
- Password reset and deactivation write to PostgreSQL first.

## Legacy JSON Store

**Not a production data path.** 25 tenant-owned API prefixes still read the
global JSON store, which has no tenant column. In `NODE_ENV=production` the
gate refuses them with `409 LEGACY_JSON_PATH_DISABLED`. The client-facing
message names the PostgreSQL replacement (`/api/v2/tenants/:table`).

Startup logs the active state:

```
[legacy-json] 25 tenant-owned and 0 user-scoped API prefixes are refused for
tenant requests (NODE_ENV=production).
```

Blocked prefixes include `/sync/all` (which returned the entire dataset),
`/customers`, `/payments`, `/checks`, `/attachments`, `/conversations`,
`/accounts`, `/journal-entries`. See `server/legacyJsonGuard.ts`.

Do **not** set `ALLOW_LEGACY_JSON_TENANT_PATHS=1` in production. It exists only
for a staged cutover against a single-tenant deployment.

## Legacy Data Migration

```bash
npm run db:migrate:legacy:dry   # classify every entity, write nothing
npm run db:migrate:legacy       # import + reconcile
```

- All 33 legacy entities are classified in `ENTITY_PLAN`; an unclassified key
  aborts the run before any write.
- Re-running is safe: every insert is an upsert on a deterministic id.
- The run **fails** on a missing, duplicated, orphaned or wrong-tenant record,
  on a record that claims another tenant, and on a record missing a required
  field — rather than silently dropping data or defaulting its owner.
- Output ends with `RECONCILIATION PASS`. Anything else means exit code 1.

## Monitoring

Startup refuses to run without `JWT_SECRET`, `DATABASE_URL`, or with only one
VAPID key, naming the missing variable and never its value.

Health endpoints (`/health`, `/healthz`, `/readyz`) are exempt from the general
rate limiter so uptime monitors still work.

## Backup / Restore

**Not production-ready.** `server/backupService.ts` backs up and restores the
**JSON store**, not PostgreSQL. The backup routes are platform-admin only and
are not a substitute for a database backup.

Back up PostgreSQL with `pg_dump` / managed-service snapshots:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=mmba-$(date +%F).dump
pg_restore --dbname="$DATABASE_URL" --clean --if-exists mmba-YYYY-MM-DD.dump
```

Restoring PostgreSQL restores every tenant, membership, domain and business
record. It does not restore the JSON overlay; re-run
`npm run db:migrate:legacy` if that is also required.

## Known Limitations

- 25 legacy JSON tenant prefixes are blocked in production rather than migrated.
  The capabilities behind them (chat, attachments, notifications, accounting
  CRUD) are reachable at `/api/v2/tenants/:table`.
- `accountingPeriods` and `notificationSettings` are JSON-only; the Prisma
  contract declares no `AccountingPeriod` model.
- Custom-domain verification records the result of a control check but does not
  perform the DNS lookup itself. Supply `proof` from a check you have actually
  run.
- `npm run typecheck` reports 14 pre-existing errors in `ErrorBoundary.tsx`,
  `webAuthn.ts` and `pushService.ts` — unchanged by Step 12 FIX.
