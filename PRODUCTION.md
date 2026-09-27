# MMBA — Production Deployment (Step 12)

## Architecture Overview

MMBA runs as a **single Express process** with **PostgreSQL** as the authoritative data store. Every business entity is tenant-scoped; platform administration is separate.

```
┌─────────────────────────────────────────────────────────────┐
│  Reverse Proxy (nginx / Cloudflare / ALB)                  │
│  - Terminates TLS                                           │
│  - Sets X-Forwarded-* (TRUST_PROXY=true)                   │
│  - Passes Host header verbatim                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  MMBA Node.js Process (port 3000)                          │
│  - Express API (routes.ts)                                  │
│  - JWT auth + tokenVersion revocation                       │
│  - resolveTenantMiddleware (Host → TenantDomain → Tenant)  │
│  - pg pool → PostgreSQL                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL 15+ (primary)                                   │
│  - Tenant, Membership, TenantDomain, License, AuditLog     │
│  - All business entities carry tenantId                     │
│  - No multi-DB, no schema-per-tenant                        │
└─────────────────────────────────────────────────────────────┘
```

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **YES** | 64+ char random string. No default in prod. |
| `DATABASE_URL` | **YES** | `postgresql://user:pass@host:5432/db?schema=public` |
| `TENANT_PARENT_DOMAINS` | **YES** | Comma-separated: `app.example.com,example.com` |
| `ALLOWED_ORIGINS` | **YES** | CORS allowlist: `https://app.example.com` |
| `TRUST_PROXY` | **YES** | Must be `true` behind a reverse proxy |
| `VAPID_PUBLIC_KEY` | Optional | For Web Push (set together with private) |
| `VAPID_PRIVATE_KEY` | Optional | For Web Push |
| `VAPID_SUBJECT` | Optional | `mailto:admin@example.com` |
| `PORT` | Optional | Default 3000 |

**Startup refuses** if any required variable is missing or empty.

## Database Provisioning

### 1. Provision PostgreSQL
- Managed: RDS, Cloud SQL, Azure Database, Neon, Supabase
- Self-hosted: PostgreSQL 15+ with `pg_trgm` for ILIKE indexes
- **Do not expose publicly** — only the app server should connect

### 2. Run Migrations
```bash
# From the built artifact or source checkout
DATABASE_URL=... npx prisma migrate deploy
```
This is **idempotent** and safe to re-run.

### 3. Seed Platform Data (once)
```bash
DATABASE_URL=... npx tsx scripts/seed-platform.ts
```
Creates:
- 7 `BusinessCategory` rows
- 4 `Plan` rows (FREE, PRO, GROWTH, ENTERPRISE) + `Entitlement` matrix
- Links the `initial` tenant (if it exists) to PRO plan + hostname

### 4. Create First Tenant (Platform Admin)
```bash
curl -X POST https://api.example.com/api/v2/platform/tenants \
  -H "Authorization: Bearer <platform-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Corp","slug":"acme","adminUserId":"usr-platform-admin"}'
```
Returns `{tenant: {id, slug, status: "ACTIVE", ...}, repeated: false}`.

### 5. Configure DNS
| Record | Value |
|--------|-------|
| `acme.app.example.com` | CNAME → your load balancer |
| `acme.example.com` (custom) | CNAME → same LB + verify in platform admin |

## Tenant Lifecycle

| State | Transitions To | Meaning |
|-------|----------------|---------|
| `PROVISIONING` | `ACTIVE`, `FAILED` | Initial creation in progress |
| `ACTIVE` | `SUSPENDED`, `DEACTIVATED` | Normal operation |
| `SUSPENDED` | `ACTIVE`, `DEACTIVATED` | Paused — no tenant-scoped access |
| `DEACTIVATED` | `PROVISIONING` | Retired — recovery via re-provisioning |
| `FAILED` | `PROVISIONING` | Provisioning errored — retry safe |

**Platform admin only:**
```bash
POST /api/v2/platform/tenants/:id/activate
POST /api/v2/platform/tenants/:id/suspend
POST /api/v2/platform/tenants/:id/deactivate
```

## Reverse Proxy Configuration (nginx Example)

```nginx
server {
  listen 443 ssl http2;
  server_name ~^(?<tenant_slug>[^.]+)\.app\.example\.com$;

  ssl_certificate /etc/ssl/certs/app.example.com.crt;
  ssl_certificate_key /etc/ssl/private/app.example.com.key;

  location / {
    proxy_pass http://mmba-app:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;                     # CRITICAL: tenant resolution
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 60s;
  }
}
```

## Security Checklist

- [ ] `JWT_SECRET` is 64+ chars, unique per environment, never committed
- [ ] `DATABASE_URL` uses a least-privilege DB user (not superuser)
- [ ] PostgreSQL TLS enabled (`sslmode=require` in connection string)
- [ ] `TRUST_PROXY=true` and proxy sets `X-Forwarded-*` correctly
- [ ] `ALLOWED_ORIGINS` is an explicit list (no `*`)
- [ ] Rate limits active (auth: 10/min, general: 60/sec, sensitive: 5/min)
- [ ] Security headers present (CSP, HSTS, X-Frame-Options, etc.)
- [ ] `DEV_TENANT_SLUG` is **unset** in production
- [ ] Database backup/restore tested
- [ ] Platform admin accounts are real users (no shared credentials)

## Backup & Restore

### Backup (pg_dump)
```bash
# Full cluster (includes roles, tablespaces)
pg_dumpall -U postgres -h <host> -p 5432 --clean --if-exists -f backup-$(date +%F).sql

# Single database (faster, no globals)
pg_dump -U postgres -h <host> -p 5432 -d mmba --clean --if-exists -f mmba-$(date +%F).sql
```

### Restore
```bash
# Stop app first
psql -U postgres -h <host> -p 5432 -d mmba -f mmba-2026-09-27.sql
```

### Verification
```bash
# Row counts on key tables
psql -c "SELECT COUNT(*) FROM tenant; SELECT COUNT(*) FROM membership;"
# Spot-check tenant A isolation
psql -c "SELECT * FROM customer WHERE \"tenantId\" = '<tenant-a-id>' LIMIT 1;"
```

**Documented but not automatically configured** — the operator must schedule and monitor backups.

## Monitoring

### Health Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /healthz` | Liveness — process is up |
| `GET /readyz` | Readiness — DB reachable, JSON store flushable |

### Key Metrics
- HTTP 4xx/5xx rate by route
- `resolveTenantMiddleware` latency (Host → tenant)
- `pg` pool utilization
- JWT tokenVersion revocation events

## Rollback Procedure

1. **Code rollback**: `git revert` + rebuild + deploy (or blue/green)
2. **Schema rollback**: Never. Migrations are forward-only.
   - If a migration is bad: fix forward with a new migration.
   - DB restores from backup are point-in-time, not migration rollbacks.

## Incident Response

| Scenario | Action |
|----------|--------|
| Tenant reports cross-tenant data leak | 1. Verify via `/v2/tenants/<table>/<id>` as tenant user 2. Check `tenantId` on the row 3. If confirmed: audit all generic routes for missing tenant predicate |
| Platform admin credential compromise | 1. Revoke JWT: `POST /api/auth/sessions/revoke-all` 2. Rotate `JWT_SECRET` 3. Audit `platformAdmin` table for unexpected rows |
| Database outage | 1. Failover to replica / restore from backup 2. App restarts → `prisma migrate deploy` runs automatically |

## Scaling Notes

- **Horizontal**: Run multiple app instances behind the LB. They share the same PostgreSQL.
- **pg pool**: Default `max=10`. Tune via `PG_POOL_MAX`.
- **Web Push**: Each instance schedules notifications — deduplicated by VAPID key + endpoint.
- **Session store**: JWT is stateless. No sticky sessions needed.
- **File uploads**: Currently base64 in JSON/DB. Move to S3 before high volume.

## Known Limitations (Step 12)

| Area | Limitation | Next Step |
|------|------------|-----------|
| Custom domains | Schema supports, no UI/verification flow | Step 13+ |
| Billing/subscription | `Plan`/`License` exist, no payment integration | Step 13 |
| Email invitations | Membership created, no email sent | Step 13 |
| Chat/attachment isolation | PG data isolated; JSON store still global | Migration |
| Legacy JSON | Coexistence only, not fully removed | Step 13+ |
| Prisma Studio auth | No built-in auth — restrict via network | Operations |

## Appendix: Environment Example

```env
# Production
NODE_ENV=production
JWT_SECRET=K7x9mP2vN5qR8wE3tY6uI1oA4sD7fG0hJ3kL6zX9cV2bN5mQ8wE3rT6yU1iO
DATABASE_URL=postgresql://mmba_app:strongpass@db.internal:5432/mmba?schema=public&sslmode=require
TENANT_PARENT_DOMAINS=app.example.com,example.com
ALLOWED_ORIGINS=https://app.example.com
TRUST_PROXY=true
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:ops@example.com
PORT=3000
```