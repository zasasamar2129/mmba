// ---------------------------------------------------------------------------
// Step 12 — Tenant-scoped membership administration
//
//   GET    /api/v2/tenant/members        — list members of the resolved tenant
//   POST   /api/v2/tenant/members        — add member
//   PUT    /api/v2/tenant/members/:userId — change role
//   DELETE /api/v2/tenant/members/:userId — deactivate membership
//
// The tenant is NEVER taken from a path/query/body value: it comes from
// req.tenantContext, which the resolver derived from the request hostname plus
// an ACTIVE membership. There is no cross-tenant path here by construction —
// there is no tenantId parameter at all.
//
// Tenant admin authority is per-tenant: a tenant admin in tenant A cannot
// touch tenant B, because the membership is checked against the resolved
// tenant A only. Cross-tenant administration must use /v2/platform/*.
// ---------------------------------------------------------------------------
import { Router, Request, Response, NextFunction } from 'express';
import { centralDb } from './db';
import { User, UserRole } from '../src/types';
import { TenantContext } from './tenantContext';
import { listMembers, upsertMembership, removeMembership } from './provisioningService';
import { query } from './pg';

export const tenantAdminRouter = Router();

/** Roles that may administer a tenant's own memberships. */
const TENANT_ADMIN_ROLES: ReadonlySet<string> = new Set<string>([
  UserRole.GOD,
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
]);

/** Ordinary tenant staff — may read members, may not mutate them. */
function isTenantAdminRole(role: string): boolean {
  return TENANT_ADMIN_ROLES.has(String(role || '').toUpperCase());
}

/**
 * Require a resolved tenant. Unlike the generic /v2/tenants/* routes, this
 * FAILS CLOSED: no resolvable tenant means 404, never "proceed without one".
 * A tenant admin route without a tenant would otherwise silently become a
 * platform route.
 */
function requireTenant(req: Request, res: Response, next: NextFunction) {
  const tc = (req as any).tenantContext as TenantContext | undefined;
  if (!tc) {
    return res.status(404).json({ success: false, error: 'TENANT_NOT_RESOLVED', message: 'پلتفرم مشخص نشد.' });
  }
  if (tc.tenantStatus === 'SUSPENDED' || tc.tenantStatus === 'DEACTIVATED') {
    return res.status(403).json({ success: false, error: 'TENANT_SUSPENDED', message: 'دسترسی این پلتفرم غیرفعال است.' });
  }
  next();
}

/** Require tenant-admin membership role in the resolved tenant. */
function requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
  const tc = (req as any).tenantContext as TenantContext | undefined;
  if (!tc) {
    return res.status(404).json({ success: false, error: 'TENANT_NOT_RESOLVED', message: 'پلتفرم مشخص نشد.' });
  }
  if (!isTenantAdminRole(tc.membershipRole)) {
    return res.status(403).json({ success: false, message: 'فقط مدیر پلتفرم اجازه این عملیات را دارد.' });
  }
  next();
}

// GET /api/v2/tenant/members — any active member may read the roster.
tenantAdminRouter.get('/members', requireTenant, async (req: Request, res: Response) => {
  try {
    const tc = (req as any).tenantContext as TenantContext;
    const members = await listMembers(tc.tenantId);
    res.json({ success: true, tenantId: tc.tenantId, members, total: members.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'خطا در دریافت اعضا.' });
  }
});

// POST /api/v2/tenant/members — tenant admin only.
tenantAdminRouter.post('/members', requireTenant, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const tc = (req as any).tenantContext as TenantContext;
    const authUser = (req as any).authUser as User;
    const { userId, role } = req.body || {};

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ success: false, message: 'userId الزامی است.' });
    }
    if (!role || typeof role !== 'string') {
      return res.status(400).json({ success: false, message: 'role الزامی است.' });
    }
    // Reject a client attempt to set GOD/OWNER via the tenant path: creating
    // another owner is a platform decision, not a tenant-admin one.
    if (isTenantAdminRole(role)) {
      return res.status(403).json({
        success: false,
        error: 'ROLE_ESCALATION',
        message: 'نقش مدیر پلتفرم فقط از مسیر پلتفرم قابل اعمال است.',
      });
    }
    // Platform admins must use /v2/platform/tenants/:id/members instead (§14).
    const isPlatformAdmin = await isPlatformAdminUser(authUser.id);
    if (isPlatformAdmin) {
      return res.status(400).json({
        success: false,
        error: 'USE_PLATFORM_PATH',
        message: 'برای مدیریت اعضای پلتفرم از مسیر /v2/platform/tenants/:id/members استفاده کنید.',
      });
    }

    // Validate user exists in the authoritative PostgreSQL store.
    const target = await query<{ id: string }>('SELECT id FROM "user" WHERE id = $1 LIMIT 1', [userId]);
    if (!target[0]) {
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' });
    }

    const member = await upsertMembership(tc.tenantId, {
      userId,
      role,
      status: 'ACTIVE',
      requestedBy: authUser.id,
    });
    res.status(201).json({ success: true, member });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'خطا در افزودن عضو.' });
  }
});

// PUT /api/v2/tenant/members/:userId — change role (tenant admin only).
tenantAdminRouter.put('/members/:userId', requireTenant, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const tc = (req as any).tenantContext as TenantContext;
    const authUser = (req as any).authUser as User;
    const { role } = req.body || {};

    if (!role || typeof role !== 'string') {
      return res.status(400).json({ success: false, message: 'role الزامی است.' });
    }
    if (isTenantAdminRole(role)) {
      return res.status(403).json({ success: false, error: 'ROLE_ESCALATION', message: 'ارتقای نقش از مسیر پلتفرم انجام می‌شود.' });
    }

    // Find THIS tenant's membership for that user. Cross-tenant IDs simply do
    // not match, so a tenant admin cannot address another tenant's rows.
    const rows = await query<{ id: string; status: string }>(
      `SELECT id, status FROM membership WHERE "tenantId" = $1 AND "userId" = $2 LIMIT 1`,
      [tc.tenantId, req.params.userId],
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'عضویت یافت نشد.' });
    }
    if (rows[0].status !== 'ACTIVE') {
      return res.status(409).json({ success: false, error: 'MEMBERSHIP_INACTIVE', message: 'عضویت غیرفعال است.' });
    }

    const member = await upsertMembership(tc.tenantId, {
      userId: req.params.userId,
      role,
      status: 'ACTIVE',
      requestedBy: authUser.id,
    });
    res.json({ success: true, member });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'خطا در تغییر نقش عضو.' });
  }
});

// DELETE /api/v2/tenant/members/:userId — deactivate (tenant admin only).
tenantAdminRouter.delete('/members/:userId', requireTenant, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const tc = (req as any).tenantContext as TenantContext;
    const authUser = (req as any).authUser as User;

    if (req.params.userId === authUser.id) {
      return res.status(400).json({ success: false, error: 'SELF_REMOVAL', message: 'امکان حذف عضویت خودتان وجود ندارد.' });
    }

    const rows = await query<{ id: string }>(
      `SELECT id FROM membership WHERE "tenantId" = $1 AND "userId" = $2 AND status = 'ACTIVE' LIMIT 1`,
      [tc.tenantId, req.params.userId],
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'عضویت یافت نشد.' });
    }

    const removed = await removeMembership(tc.tenantId, rows[0].id, authUser.id);
    res.json({ success: removed });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'خطا در حذف عضو.' });
  }
});

async function isPlatformAdminUser(userId: string): Promise<boolean> {
  const rows = await query<{ id: string }>('SELECT id FROM "platformAdmin" WHERE "userId" = $1 LIMIT 1', [userId]);
  return rows.length > 0;
}
