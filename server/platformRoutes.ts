// ---------------------------------------------------------------------------
// Step 12 — Platform Admin Tenant Management Routes
//
// All routes require platform-level authorization (PlatformAdmin row).
// Tenant admins CANNOT invoke these routes — authorization is explicit per-route.
//
//   POST   /api/v2/platform/tenants                    — create/provision
//   GET    /api/v2/platform/tenants                    — list all tenants
//   GET    /api/v2/platform/tenants/:id                — retrieve tenant
//   POST   /api/v2/platform/tenants/:id/activate       — activate
//   POST   /api/v2/platform/tenants/:id/suspend         — suspend
//   POST   /api/v2/platform/tenants/:id/deactivate      — deactivate
//   GET    /api/v2/platform/tenants/:id/members         — list members
//   POST   /api/v2/platform/tenants/:id/members         — add/update member
//   DELETE /api/v2/platform/tenants/:id/members/:memberId — remove member
// ---------------------------------------------------------------------------
import { Router, Request, Response } from 'express';
import { centralDb } from './db';
import { User, UserRole } from '../src/types';
import { isAdmin } from '../src/lib/permissions';
import {
  provisionTenant,
  transitionTenantStatus,
  listTenants,
  getTenant,
  listMembers,
  upsertMembership,
  removeMembership,
  getTenantDomain,
  verifyDomain,
  disableDomain,
  SlugConflictError,
  ProvisioningStatus,
  DomainStatus,
} from './provisioningService';
import { query } from './pg';
import { platformSubdomainForSlug, isAutoVerifiableHostname } from './hostnamePolicy';

export const platformRouter = Router();

/**
 * Require platform-admin authorization. A platform admin must:
 * 1. Be authenticated (authUser present)
 * 2. Have a PlatformAdmin row in the database
 *
 * This is SEPARATE from tenant membership — tenant admins cannot call
 * these routes by knowing a tenant ID.
 */
async function requirePlatformAdmin(req: Request, res: Response, next: any): Promise<void> {
  const authUser: User | undefined = (req as any).authUser;
  if (!authUser) {
    res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    return;
  }

  // Check platform admin record in database (authoritative, not role-based)
  const rows = await query<{ id: string }>(
    'SELECT id FROM "platformAdmin" WHERE "userId" = $1 LIMIT 1',
    [authUser.id],
  );

  if (!rows[0]) {
    res.status(403).json({
      success: false,
      message: 'فقط مدیران پلتفرم اجازه این عملیات را دارند.',
    });
    return;
  }

  (req as any).platformAdminId = rows[0].id;
  next();
}

// ─── Tenant CRUD ──────────────────────────────────────────────────────────

platformRouter.post('/tenants', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as User;
    // FIX D: `verified` / `domainStatus` in the body are deliberately NOT read.
    // Only `requestedHostname` is accepted, and even that can only ever yield a
    // PENDING domain (see resolveProvisioningDomain).
    const { name, slug, businessCategoryId, planId, requestedHostname, adminUserId } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ success: false, message: 'نام و slug پلتفرم الزامی است.' });
    }

    const targetAdminUserId = adminUserId || authUser.id;

    const result = await provisionTenant({
      name: name.trim(),
      slug,
      adminUserId: targetAdminUserId,
      businessCategoryId,
      planId,
      requestedHostname,
    });

    res.status(result.repeated ? 200 : 201).json({
      success: true,
      tenant: {
        id: result.tenantId,
        slug: result.slug,
        status: result.status,
        membershipId: result.membershipId,
      },
      // FIX D: tell the caller exactly what host they got and whether it can
      // serve traffic yet. A custom domain comes back PENDING/routable:false.
      domain: result.domain,
      repeated: result.repeated,
    });
  } catch (err: any) {
    const msg = String(err.message || err);
    if (msg.includes('INVALID_SLUG')) {
      return res.status(422).json({ success: false, error: 'INVALID_SLUG', message: 'نام slug پلتفرم نامعتبر است.' });
    }
    if (err instanceof SlugConflictError || msg.includes('duplicate key') || msg.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'SLUG_CONFLICT', message: 'slug تکراری است.' });
    }
    // FIX E: refuse rather than invent an identity.
    if (msg.includes('ADMIN_USER_NOT_IN_PG') || msg.includes('USER_NOT_IN_PG')) {
      return res.status(404).json({ success: false, error: 'USER_NOT_IN_PG', message: 'کاربر مدیر در پایگاه داده یافت نشد.' });
    }
    console.error('Provisioning error:', err);
    res.status(500).json({ success: false, message: 'خطا در ایجاد پلتفرم.' });
  }
});

platformRouter.get('/tenants', requirePlatformAdmin, async (_req: Request, res: Response) => {
  try {
    const tenants = await listTenants();
    res.json({ success: true, tenants, total: tenants.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

platformRouter.get('/tenants/:id', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const tenant = await getTenant(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'پلتفرم یافت نشد.' });
    res.json({ success: true, tenant });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Lifecycle transitions ────────────────────────────────────────────────

platformRouter.post('/tenants/:id/activate', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as User;
    const newStatus = await transitionTenantStatus(req.params.id, ProvisioningStatus.ACTIVE, authUser.id);
    res.json({ success: true, status: newStatus });
  } catch (err: any) {
    const msg = String(err.message || err);
    if (msg.includes('TENANT_NOT_FOUND')) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'پلتفرم یافت نشد.' });
    if (msg.includes('INVALID_TRANSITION')) return res.status(409).json({ success: false, error: 'INVALID_TRANSITION', message: 'تغییر وضعیت مجاز نیست.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

platformRouter.post('/tenants/:id/suspend', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as User;
    const newStatus = await transitionTenantStatus(req.params.id, ProvisioningStatus.SUSPENDED, authUser.id);
    res.json({ success: true, status: newStatus });
  } catch (err: any) {
    const msg = String(err.message || err);
    if (msg.includes('TENANT_NOT_FOUND')) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'پلتفرم یافت نشد.' });
    if (msg.includes('INVALID_TRANSITION')) return res.status(409).json({ success: false, error: 'INVALID_TRANSITION', message: 'تغییر وضعیت مجاز نیست.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

platformRouter.post('/tenants/:id/deactivate', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as User;
    const newStatus = await transitionTenantStatus(req.params.id, ProvisioningStatus.DEACTIVATED, authUser.id);
    res.json({ success: true, status: newStatus });
  } catch (err: any) {
    const msg = String(err.message || err);
    if (msg.includes('TENANT_NOT_FOUND')) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'پلتفرم یافت نشد.' });
    if (msg.includes('INVALID_TRANSITION')) return res.status(409).json({ success: false, error: 'INVALID_TRANSITION', message: 'تغییر وضعیت مجاز نیست.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Membership management ────────────────────────────────────────────────

platformRouter.get('/tenants/:id/members', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const tenant = await getTenant(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'پلتفرم یافت نشد.' });
    const members = await listMembers(req.params.id);
    res.json({ success: true, members, total: members.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

platformRouter.post('/tenants/:id/members', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as User;
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ success: false, message: 'userId و role الزامی است.' });
    }

    const targetUser = centralDb.findUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' });
    }

    const member = await upsertMembership(req.params.id, {
      userId,
      role,
      status: 'ACTIVE',
      requestedBy: authUser.id,
    });

    res.status(201).json({ success: true, member });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

platformRouter.delete('/tenants/:id/members/:memberId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as User;
    const removed = await removeMembership(req.params.id, req.params.memberId, authUser.id);
    if (!removed) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'عضویت یافت نشد.' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Domain management (FIX D) ───────────────────────────────────────────
//
// State machine, enforced in verifyDomain():
//   PENDING ──verifyDomain(proof)──> VERIFIED
//   PENDING ──reject──────────────> REJECTED
//   any     ──disable─────────────> DISABLED   (terminal, no re-verify)
//
// A custom domain arrives as PENDING and stays there until an actual control
// check runs. Only VERIFIED/ACTIVE domains route traffic (see tenantContext).

platformRouter.get('/tenants/:id/domain', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const tenant = await getTenant(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'پلتفرم یافت نشد.' });
    const domain = await getTenantDomain(req.params.id);
    res.json({
      success: true,
      domain: domain || null,
      // Tell the operator what to do next rather than leaving them guessing.
      verification: domain
        ? {
            required: domain.status === DomainStatus.PENDING,
            method: 'DNS_TXT',
            // Placeholder token so an operator knows what to publish. It is
            // derived per-domain, and only that exact value verifies.
            txtRecordName: `_mmba-verify.${domain.hostname}`,
          }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v2/platform/tenants/:id/domain/verify
 *
 * FIX D: a client CANNOT assert its own domain is verified. The body may
 * carry a `proof` produced by a real DNS/HTTP challenge, but this handler
 * only records the outcome of that check — it never invents one. A platform
 * subdomain verifies without any external proof because the platform owns the
 * parent zone. A custom domain whose proof does not match stays PENDING.
 */
platformRouter.post('/tenants/:id/domain/verify', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as User;
    const tenant = await getTenant(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'پلتفرم یافت نشد.' });

    const domain = await getTenantDomain(req.params.id);
    if (!domain) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'دامنه یافت نشد.' });

    // Platform-owned subdomain: we control the zone, so verify directly.
    if (isAutoVerifiableHostname(domain.hostname)) {
      const verified = await verifyDomain(domain.id, authUser.id, {
        method: 'PLATFORM_OWNED_SUBDOMAIN',
        token: 'n/a',
      });
      return res.json({ success: true, domain: verified });
    }

    // Custom domain: require a real proof. Without one it stays PENDING —
    // that is the whole point of the fix.
    const proof = req.body?.proof;
    if (!proof || typeof proof.token !== 'string' || !proof.token) {
      return res.status(422).json({
        success: false,
        error: 'VERIFICATION_PROOF_REQUIRED',
        message: 'دامنه سفارشی تا تأیید مالکیت قابل استفاده نیست.',
        domain: { hostname: domain.hostname, status: domain.status, routable: false },
      });
    }

    const verified = await verifyDomain(domain.id, authUser.id, {
      method: String(proof.method || 'DNS_TXT'),
      token: proof.token,
    });
    res.json({ success: true, domain: verified });
  } catch (err: any) {
    const msg = String(err.message || err);
    if (msg.includes('DOMAIN_NOT_FOUND')) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    if (msg.includes('INVALID_TRANSITION')) return res.status(409).json({ success: false, error: 'INVALID_TRANSITION', message: msg });
    if (msg.includes('VERIFICATION_PROOF_REQUIRED')) return res.status(422).json({ success: false, error: 'VERIFICATION_PROOF_REQUIRED' });
    res.status(500).json({ success: false, message: err.message });
  }
});

platformRouter.post('/tenants/:id/domain/disable', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as User;
    const tenant = await getTenant(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'پلتفرم یافت نشد.' });
    const domain = await getTenantDomain(req.params.id);
    if (!domain) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'دامنه یافت نشد.' });
    const disabled = await disableDomain(domain.id, authUser.id);
    res.json({ success: true, domain: disabled });
  } catch (err: any) {
    const msg = String(err.message || err);
    if (msg.includes('DOMAIN_NOT_FOUND')) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.status(500).json({ success: false, message: err.message });
  }
});
