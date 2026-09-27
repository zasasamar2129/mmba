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
  ProvisioningStatus,
} from './provisioningService';
import { query } from './pg';

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
    const { name, slug, businessCategoryId, planId, requestedHostname, adminUserId } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ success: false, message: 'نام و slug پلتفرم الزامی است.' });
    }

    const targetAdminUserId = adminUserId || authUser.id;
    const targetUser = centralDb.findUserById(targetAdminUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'کاربر مدیر یافت نشد.' });
    }

    const result = await provisionTenant({
      name: name.trim(),
      slug,
      adminUserId: targetAdminUserId,
      businessCategoryId,
      planId,
      requestedHostname,
    });

    res.status(201).json({
      success: true,
      tenant: {
        id: result.tenantId,
        slug: result.slug,
        status: result.status,
        membershipId: result.membershipId,
      },
      repeated: result.repeated,
    });
  } catch (err: any) {
    const msg = String(err.message || err);
    if (msg.includes('INVALID_SLUG')) {
      return res.status(422).json({ success: false, error: 'INVALID_SLUG', message: 'نام slug پلتفرم نامعتبر است.' });
    }
    if (msg.includes('duplicate key') || msg.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'SLUG_CONFLICT', message: 'slug تکراری است.' });
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
