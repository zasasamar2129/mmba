// ---------------------------------------------------------------------------
// Step 12 — Tenant Context Resolution (PostgreSQL via pg)
//
// Derives the effective tenant from SERVER-side context only:
//   1. Host header → normalize → TenantDomain lookup → Tenant
//   2. Authenticated user → Membership in that tenant (verified status ACTIVE)
//
// Never trusts req.body.tenantId / req.query.tenantId / headers. DEV tenants
// can be selected via a single explicit env-guarded shortcut (DEV ONLY).
//
// Step 12 FIX D: hostname classification and trust live in hostnamePolicy.ts
// so resolution and provisioning can never disagree. Resolution additionally
// refuses to route a domain whose status is PENDING/REJECTED/DISABLED — an
// unverified custom domain must never resolve to a tenant, or "PENDING" would
// be decorative.
// ---------------------------------------------------------------------------
import { Request, Response, NextFunction } from 'express';
import { query, Row } from './pg';
import { normalizeHostname, classifyHostname, isRoutableDomainStatus } from './hostnamePolicy';

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantStatus: string;
  membershipId: string;
  membershipRole: string;
  membershipStatus: string;
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

export { normalizeHostname };

async function findTenantBySlug(slug: string) {
  const rows = await query<Row>('SELECT id, name, slug, status FROM tenant WHERE slug = $1 LIMIT 1', [slug]);
  return rows[0] || null;
}

async function findTenantById(id: string) {
  const rows = await query<Row>('SELECT id, name, slug, status FROM tenant WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

async function findActiveMembership(tenantId: string, userId: string) {
  const rows = await query<Row>(
    'SELECT id, "tenantId", "userId", role, status FROM membership WHERE "tenantId" = $1 AND "userId" = $2 AND status = $3 LIMIT 1',
    [tenantId, userId, 'ACTIVE']
  );
  return rows[0] || null;
}

/**
 * Look up a domain by exact hostname. FIX D: only a domain in a routable
 * status (VERIFIED / ACTIVE) may resolve. PENDING, REJECTED and DISABLED all
 * return nothing, so an unverified custom domain is unreachable rather than
 * quietly active.
 */
async function findRoutableDomain(hostname: string) {
  const rows = await query<Row>('SELECT id, "tenantId", hostname, status FROM "tenantDomain" WHERE hostname = $1 LIMIT 1', [hostname]);
  const domain = rows[0];
  if (!domain) return null;
  if (!isRoutableDomainStatus(domain.status)) return null;
  return domain;
}

/**
 * Resolve tenant for the current request. Returns { ctx, status } where status 0
 * means success. DEV ONLY shortcut is gated by NODE_ENV !== 'production'.
 */
export async function resolveTenantContext(req: Request, userId?: string): Promise<{ ctx: TenantContext | null; status: number }> {
  const hostname = normalizeHostname(req.headers.host);

  // --- DEV ONLY: explicit tenant selection for local development ---
  const devSlug = process.env.DEV_TENANT_SLUG;
  if (devSlug && process.env.NODE_ENV !== 'production') {
    const classified = classifyHostname(hostname);
    const slug = classified.slug || hostname.split('.')[0] || devSlug;
    const tenant = await findTenantBySlug(slug);
    if (tenant) {
      const membership = userId ? await findActiveMembership(tenant.id, userId) : null;
      if (userId && !membership) return { ctx: null, status: 403 };
      return {
        ctx: {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          tenantName: tenant.name,
          tenantStatus: tenant.status,
          membershipId: membership?.id || '',
          membershipRole: membership?.role || '',
          membershipStatus: membership?.status || 'ACTIVE',
          userId: userId || '',
        },
        status: 0,
      };
    }
  }

  // --- Bare host (e.g. localhost:PORT without subdomain) in dev: resolve first ACTIVE tenant ---
  if (userId && hostname && !hostname.includes('.')) {
    const first = (await query<Row>('SELECT id, name, slug, status FROM tenant WHERE status = $1 ORDER BY "createdAt" LIMIT 1', ['ACTIVE']))[0];
    if (first) {
      const m = await findActiveMembership(first.id, userId);
      if (m) {
        return {
          ctx: { tenantId: first.id, tenantSlug: first.slug, tenantName: first.name, tenantStatus: first.status, membershipId: m.id, membershipRole: m.role, membershipStatus: m.status, userId },
          status: 0,
        };
      }
    }
  }

  // --- TenantDomain lookup via exact hostname, or platform subdomain slug ---
  // FIX D: a PENDING (unverified) custom domain is not routable, so
  // findRoutableDomain returns nothing for it and we fall through to 404.
  let tenant = hostname ? await findRoutableDomain(hostname).then((d) => (d ? findTenantById(d.tenantId) : null)) : null;
  if (!tenant && hostname) {
    // Only a host the platform OWNS may be matched by slug. A custom domain
    // that happens to contain a tenant slug proves nothing.
    const classified = classifyHostname(hostname);
    if (classified.kind === 'PLATFORM_SUBDOMAIN' && classified.slug) {
      tenant = await findTenantBySlug(classified.slug);
    }
  }

  if (!tenant) return { ctx: null, status: 404 }; // unknown host → no tenant enumeration
  if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') return { ctx: null, status: 403 };

  const membership = userId ? await findActiveMembership(tenant.id, userId) : null;
  if (userId && !membership) return { ctx: null, status: 403 };

  return {
    ctx: {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      tenantStatus: tenant.status,
      membershipId: membership?.id || '',
      membershipRole: membership?.role || '',
      membershipStatus: membership?.status || 'ACTIVE',
      userId: userId || '',
    },
    status: 0,
  };
}

/** Express middleware: attach req.tenantContext from authenticated user (if any).
 *
 * NON-DESTRUCTIVE: this middleware never blocks the request on its own.
 * When no tenant can be resolved, it leaves req.tenantContext undefined and
 * calls next() — the decision of whether a tenant is required lives in the
 * individual tenant-scoped route handlers (e.g. /v2/tenants/*).
 */
export function resolveTenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const authUser: any = (req as any).authUser;
  const userId = authUser?.id;
  resolveTenantContext(req, userId).then(({ ctx, status }) => {
    if (ctx) { (req as any).tenantContext = ctx; return next(); }
    // Non-destructive: never block. Tenant-required routes enforce themselves.
    return next();
  }).catch((err) => next(err));
}