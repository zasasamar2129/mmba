// ---------------------------------------------------------------------------
// Step 12 — Tenant Context Resolution (PostgreSQL via pg)
//
// Derives the effective tenant from SERVER-side context only:
//   1. Host header → normalize → TenantDomain lookup → Tenant
//   2. Authenticated user → Membership in that tenant (verified status ACTIVE)
//
// Never trusts req.body.tenantId / req.query.tenantId / headers. DEV tenants
// can be selected via a single explicit env-guarded shortcut (DEV ONLY).
// ---------------------------------------------------------------------------
import { Request, Response, NextFunction } from 'express';
import { query, Row } from './pg';

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

const RESERVED_HOSTS = new Set(['www', 'api', 'admin', 'app', 'mail', 'support', 'status', 'billing', 'cdn']);

/** Normalize a hostname: lowercase, strip trailing dot, strip :port, strip www. */
export function normalizeHostname(raw: string | undefined): string {
  if (!raw) return '';
  let h = raw.trim().toLowerCase();
  const colon = h.lastIndexOf(':');
  if (colon > 0 && !h.startsWith('[')) h = h.slice(0, colon);
  h = h.replace(/\.$/, '');
  if (h.startsWith('www.')) h = h.slice(4);
  return h;
}

/** Extract tenant slug from a platform-tenant subdomain <slug>.parent. */
function slugFromHostname(hostname: string, parentDomains: string[]): string | null {
  for (const parent of parentDomains) {
    if (hostname.endsWith('.' + parent)) {
      const slug = hostname.slice(0, -(parent.length + 1));
      if (slug && !slug.includes('.')) return slug;
    }
  }
  return null;
}

const PARENT_DOMAINS = (process.env.TENANT_PARENT_DOMAINS || 'mmba.example,localhost').split(',').map((s) => s.trim()).filter(Boolean);

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

async function findDomain(hostname: string) {
  const rows = await query<Row>('SELECT id, "tenantId", hostname, status FROM "tenantDomain" WHERE hostname = $1 LIMIT 1', [hostname]);
  return rows[0] || null;
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
    const slug = slugFromHostname(hostname, PARENT_DOMAINS) || hostname.split('.')[0] || devSlug;
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

  // --- TenantDomain lookup via exact hostname, or subdomain slug ---
  let tenant = hostname ? await findDomain(hostname).then((d) => (d ? findTenantById(d.tenantId) : null)) : null;
  if (!tenant && hostname) {
    const slug = slugFromHostname(hostname, PARENT_DOMAINS);
    if (slug && !RESERVED_HOSTS.has(slug)) tenant = await findTenantBySlug(slug);
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

/** Express middleware: attach req.tenantContext from authenticated user (if any). */
export function resolveTenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const authUser: any = (req as any).authUser;
  const userId = authUser?.id;
  resolveTenantContext(req, userId).then(({ ctx, status }) => {
    if (ctx) { (req as any).tenantContext = ctx; return next(); }
    if (status === 404) return res.status(404).json({ success: false, message: 'Not found.' });
    if (status === 403) return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز به این کسبوکار.' });
    next();
  }).catch((err) => next(err));
}