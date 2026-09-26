import { Router, Request, Response } from 'express';
import { centralDb, normalizePhone, PhoneDuplicateError } from './db';
import { backupService } from './backupService';
import { webPushService } from './webPushService';
import { notificationScheduler } from './notificationScheduler';
import * as auth from './auth';
import {
  User, UserRole, UserStatus, ModuleName, Customer, Call, Task,
  Contract, Payment, Check, SimCard, Repair, Attachment, Notification,
  Role, VoiceNote, Interaction, InteractionType, ProblemReport,
  BackupType, BackupStatus, UserNotificationDevice, NotificationSettings,
  Account, JournalEntry, AccountingPeriod, DocumentShare
} from '../src/types';
import { isAdmin, hasPermission } from '../src/lib/permissions';
import { PermissionAction } from '../src/types';
import { authLimiter, loginLimiter, sensitiveLimiter } from './security';
import { resolveTenantMiddleware, TenantContext } from './tenantContext';
import { customerRepository } from './customerRepository';
import { getTenantRepo } from './tenantVerticals';

export const apiRouter = Router();

// Rate limiting (Step 3 §2). Auth tier applies to every auth route (login is
// handled separately with per-account counting, so it is excluded here).
apiRouter.use(['/auth/biometric-challenge', '/auth/biometric-login', '/auth/password', '/auth/profile'], authLimiter);

// Middleware: Extract user from Authorization Header or query parameter
async function getAuthUser(req: Request): Promise<User | undefined> {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader) {
    token = authHeader.replace('Bearer ', '').trim();
  } else if (typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }
  if (!token) return undefined;

  // Verify the token's signature and expiry first; only then look up the user
  const decoded = auth.verifyToken(token);
  if (!decoded) return undefined;

  const user = centralDb.findUserById(decoded.payload.userId);
  if (!user || user.status === UserStatus.INACTIVE || user.status === UserStatus.SUSPENDED) {
    return undefined;
  }
  // Session revocation (Step 3, Option A): a token is only valid if its
  // embedded tokenVersion matches the user's current one.
  const storedVersion = user.tokenVersion || 0;
  const tokenVersion = decoded.payload.tokenVersion || 0;
  if (tokenVersion !== storedVersion) {
    return undefined;
  }
  return user;
}


// Step 3 §9: /notifications/vapid-public-key is no longer allowlisted — the
// client fetches it only via subscribeUser() which runs after login (App.tsx),
// so it does not need to be reachable pre-auth. Returns only the public key;
// the private key never leaves webPushService.
const ALLOWLIST_PATHS = new Set<string>([
  '/auth/login', '/auth/biometric-challenge', '/auth/biometric-login',
  '/health', '/healthz', '/readyz',
]);

function requireAuth(req: Request, res: Response, next: any) {
  const path = req.path.startsWith('/api/v1') ? req.path.slice(5) : req.path.startsWith('/api') ? req.path.slice(4) : req.path;
  if (ALLOWLIST_PATHS.has(path)) { return next(); }
  const fullPath = req.originalUrl?.split('?')[0] || '';
  const isAllowlisted = Array.from(ALLOWLIST_PATHS).some(p =>
    fullPath === `/api${p}` || fullPath === `/api/v1${p}` || fullPath === p
  );
  if (isAllowlisted) { return next(); }
  getAuthUser(req).then((user) => {
    if (!user) { return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' }); }
    (req as any).authUser = user; next();
  }).catch(() => { return res.status(401).json({ success: false, message: 'احراز هویت نامعتبر است.' }); });
}

// Apply authentication middleware to ALL routes
apiRouter.use(requireAuth);

// Step 12 — resolve the effective tenant (hostname → TenantDomain → Tenant) and
// verify membership for the authenticated user. req.tenantContext is attached.
// Tenant-scoped routes opt in below; the platform/prisma-heavy routes continue
// on centralDb until converted individually. This middleware is non-destructive:
// it attaches context when resolvable and never blocks the request itself.
apiRouter.use(resolveTenantMiddleware);

function sanitizeUser(user: User): Omit<User, 'password'> {
  const { password: _pw, ...safe } = user;
  return safe;
}
function sanitizeUsers(users: User[]): Omit<User, 'password'>[] {
  return users.map(sanitizeUser);
}

function requirePermission(module: ModuleName, action: PermissionAction) {
  return (req: Request, res: Response, next: any) => {
    const user = (req as any).authUser as User;
    if (!hasPermission(user, module, action)) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز: نقش شما مجوز این عملیات را ندارد.' });
    }
    next();
  };
}
// ----------------------------------------------------
// Health Check
// ----------------------------------------------------
apiRouter.get('/health', (req: Request, res: Response) => {
  const rev = centralDb.getRevisionInfo();
  res.json({
    status: 'ok',
    system: 'MMBA Centralized Production Engine',
    revision: rev.revision,
    lastUpdatedAt: rev.lastUpdatedAt,
    serverTime: new Date().toISOString(),
  });
});

// Step 9 §9: liveness — process is up. Deliberately light: no filesystem work,
// no DB read beyond the in-memory revision, so uptime probes never pay the cost
// of a background IO. /health is kept for backward compatibility.
apiRouter.get('/healthz', (req: Request, res: Response) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Step 9 §9: readiness — can this instance serve application traffic?
// Checks only the storages the app genuinely cannot run without: the JSON DB
// must be loadable and the current in-memory state must be flushable to disk.
// Optional integrations (Web Push, AI) are deliberately NOT part of readiness —
// a temporary VAPID/push failure must not gate the whole business panel.
apiRouter.get('/readyz', (req: Request, res: Response) => {
  try {
    const dbPath = centralDb.getDbPath();
    const state = centralDb.getState();
    if (!state) {
      return res.status(503).json({ status: 'not_ready', reason: 'database_uninitialized' });
    }
    return res.json({
      status: 'ready',
      database: { path: dbPath, revision: state.revision, users: state.users.length, customers: state.customers.length },
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({ status: 'not_ready', reason: 'storage_unavailable' });
  }
});

// ----------------------------------------------------
// Authentication & Profile Endpoints
// ----------------------------------------------------
apiRouter.post('/auth/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ success: false, message: 'نام کاربری/ایمیل و رمز عبور الزامی است.' });
    }

    const user = centralDb.findUserByCredential(usernameOrEmail);
    if (!user) {
      return res.status(401).json({ success: false, message: 'کاربری با این نام کاربری، ایمیل یا شماره موبایل یافت نشد.' });
    }

    if (user.status === UserStatus.INACTIVE || user.status === UserStatus.SUSPENDED) {
      return res.status(403).json({ success: false, message: 'حساب کاربری شما غیرفعال یا معلق می‌باشد. لطفاً با مدیر سیستم تماس بگیرید.' });
    }

    // Verify the password against the stored hash (never plaintext compare)
    const storedPassword = user.password || '';
    const passwordValid = await auth.verifyPassword(password, storedPassword);
    if (!passwordValid) {
      await centralDb.logAudit({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'تلاش ناموفق برای ورود به سیستم',
        module: ModuleName.USERS,
        details: `رمز عبور اشتباه برای کاربر ${user.username}`,
        ipAddress: req.ip,
      });
      return res.status(401).json({ success: false, message: 'رمز عبور وارد شده نادرست است.' });
    }

    const now = new Date().toISOString();
    const updatedUser: User = {
      ...user,
      lastLoginAt: now,
    };
    // NOTE: saveUser passes the existing password through unchanged — it does NOT
    // re-hash it. Only the four dedicated write sites hash on save.
    await centralDb.saveUser(updatedUser);

    await centralDb.logAudit({
      userId: updatedUser.id,
      userName: updatedUser.name,
      userRole: updatedUser.role,
      action: 'ورود موفق به سیستم متمرکز MMBA',
      module: ModuleName.USERS,
      details: `ورود موفق کاربر ${updatedUser.name} (${updatedUser.username}) از دستگاه`,
      ipAddress: req.ip,
    });

    const token = auth.signToken(updatedUser.id, updatedUser.tokenVersion);
    res.json({
      success: true,
      token,
      user: sanitizeUser(updatedUser),
      serverRevision: centralDb.getRevisionInfo().revision,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'خطای سرور در احراز هویت' });
  }
});

apiRouter.get('/auth/me', async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
  }
  res.json({ user: sanitizeUser(user) });
});

apiRouter.put('/auth/profile', async (req: Request, res: Response) => {
  try {
    const { userId, name, email, mobile, department, avatar, username } = req.body;
    const authUser = await getAuthUser(req);
    const targetId = userId || authUser?.id || (username === 'admin' ? 'usr-admin' : undefined);

    let targetUser = targetId ? centralDb.findUserById(targetId) : undefined;
    if (!targetUser && username) {
      targetUser = centralDb.findUserByCredential(username);
    }
    if (!targetUser && !targetId) {
      targetUser = centralDb.findUserById('usr-admin') || centralDb.getState().users[0];
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'کاربر مورد نظر یافت نشد.' });
    }

    const updatedUser: User = {
      ...targetUser,
      name: name !== undefined ? name.trim() : targetUser.name,
      email: email !== undefined ? email.trim() : targetUser.email,
      mobile: mobile !== undefined ? mobile.trim() : targetUser.mobile,
      department: department !== undefined ? department.trim() : targetUser.department,
      avatar: avatar !== undefined ? avatar : targetUser.avatar,
    };

    const saved = await centralDb.saveUser(updatedUser);

    await centralDb.logAudit({
      userId: saved.id,
      userName: saved.name,
      userRole: saved.role,
      action: 'ویرایش مشخصات پروفایل کاربری',
      module: ModuleName.USERS,
      targetId: saved.id,
      targetType: 'USER',
      details: `مشخصات پروفایل کاربر ${saved.name} (@${saved.username}) در سرور متمرکز به‌روزرسانی شد.`,
      ipAddress: req.ip,
    });

    res.json({ success: true, user: sanitizeUser(saved), revision: centralDb.getRevisionInfo().revision });
  } catch (error: any) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: 'خطا در ذخیره‌سازی پروفایل' });
  }
});

apiRouter.put('/auth/password', async (req: Request, res: Response) => {
  try {
    const { userId, currentPassword, newPassword, username } = req.body;
    const authUser = await getAuthUser(req);
    const targetId = userId || authUser?.id || (username === 'admin' ? 'usr-admin' : undefined);

    let targetUser = targetId ? centralDb.findUserById(targetId) : undefined;
    if (!targetUser && username) {
      targetUser = centralDb.findUserByCredential(username);
    }
    if (!targetUser && !targetId) {
      targetUser = centralDb.findUserById('usr-admin') || centralDb.getState().users[0];
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' });
    }

    // Verify the current password against the stored hash
    const storedPassword = targetUser.password || '';
    const currentValid = await auth.verifyPassword(currentPassword, storedPassword);
    if (!currentValid) {
      return res.status(400).json({ success: false, message: 'کلمه عبور فعلی نادرست است.' });
    }

    if (!newPassword || newPassword.length < 3) {
      return res.status(400).json({ success: false, message: 'کلمه عبور جدید باید حداقل ۳ کاراکتر باشد.' });
    }

    // Hash the new password before saving (write site #3)
    const hashedNewPassword = await auth.hashPassword(newPassword);
    const updatedUser: User = {
      ...targetUser,
      password: hashedNewPassword,
    };

    const saved = await centralDb.saveUser(updatedUser);

    await centralDb.logAudit({
      userId: saved.id,
      userName: saved.name,
      userRole: saved.role,
      action: 'تغییر رمز عبور حساب کاربری',
      module: ModuleName.USERS,
      targetId: saved.id,
      targetType: 'USER',
      details: `رمز عبور کاربر ${saved.name} در سرور مرکزی با موفقیت تغییر کرد.`,
      ipAddress: req.ip,
    });

    res.json({ success: true, user: sanitizeUser(saved), revision: centralDb.getRevisionInfo().revision });
  } catch (error: any) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, message: 'خطا در تغییر رمز عبور' });
  }
});

// ----------------------------------------------------
// Session Management (Step 3, Option A: per-user token version)
// Bumping tokenVersion invalidates every token issued before the bump.
// ----------------------------------------------------
apiRouter.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as User;
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const nextVersion = (authUser.tokenVersion || 0) + 1;
    await centralDb.saveUser({ ...authUser, tokenVersion: nextVersion });
    res.status(204).end();
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'خطا در خروج از حساب کاربری' });
  }
});

apiRouter.post('/auth/sessions/revoke-all', async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as User;
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const nextVersion = (authUser.tokenVersion || 0) + 1;
    await centralDb.saveUser({ ...authUser, tokenVersion: nextVersion });
    await centralDb.logAudit({
      userId: authUser.id, userName: authUser.name, userRole: authUser.role,
      action: 'خروج از تمام دستگاه‌ها (Revoke All Sessions)', module: ModuleName.USERS,
      targetId: authUser.id, targetType: 'USER',
      details: `کاربر ${authUser.name} (@${authUser.username}) از تمام دستگاه‌های متصل خارج شد.`,
      ipAddress: req.ip,
    });
    res.json({ success: true, message: 'از تمام دستگاه‌ها خارج شدید.' });
  } catch (error: any) {
    console.error('Revoke-all error:', error);
    res.status(500).json({ success: false, message: 'خطا در خروج از دستگاه‌ها' });
  }
});

// ----------------------------------------------------
// Central Database Full Sync & Revision Check
// ----------------------------------------------------
apiRouter.get('/sync/all', (req: Request, res: Response) => {
  try {
    const state = centralDb.getState();
    res.json({
      success: true,
      revision: state.revision,
      lastUpdatedAt: state.lastUpdatedAt,
      data: {
        users: sanitizeUsers(state.users),
        roles: state.roles,
        customers: state.customers,
        leads: state.leads || [],
        calls: state.calls,
        interactions: state.interactions || [],
        voiceNotes: state.voiceNotes,
        tasks: state.tasks,
        contracts: state.contracts,
        payments: state.payments,
        checks: state.checks,
        sims: state.sims,
        repairs: state.repairs,
        attachments: state.attachments,
        accounts: state.accounts || [],
        journalEntries: state.journalEntries || [],
        journalEntryLines: state.journalEntryLines || [],
        accountingPeriods: state.accountingPeriods || [],
        documentShares: state.documentShares || [],
        conversations: state.conversations || [],
        chatMessages: state.chatMessages || [],
        registeredHolders: state.registeredHolders || [],
        contractInstallments: state.contractInstallments || [],
        trustedBiometricDevices: state.trustedBiometricDevices || [],
        notifications: state.notifications,
        auditLogs: state.auditLogs,
        dateSuggestions: state.dateSuggestions,
        sharedLinks: state.sharedLinks,
        settings: state.settings,
      },
    });
  } catch (error: any) {
    console.error('Sync all error:', error);
    res.status(500).json({ success: false, message: 'خطا در همگام‌سازی اطلاعات پایگاه داده مرکزی' });
  }
});

apiRouter.get('/sync/version', (req: Request, res: Response) => {
  const rev = centralDb.getRevisionInfo();
  res.json({
    revision: rev.revision,
    lastUpdatedAt: rev.lastUpdatedAt,
  });
});

apiRouter.post('/sync/push', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const updatedState = await centralDb.batchSyncPush(payload);
    res.json({
      success: true,
      revision: updatedState.revision,
      lastUpdatedAt: updatedState.lastUpdatedAt,
    });
  } catch (error: any) {
    console.error('Sync push error:', error);
    res.status(500).json({ success: false, message: 'خطا در اعمال همگام‌سازی دسته‌ای' });
  }
});

// ----------------------------------------------------
// Contact Quick Lookup (Customers vs Leads)
// ----------------------------------------------------
apiRouter.get('/contacts/lookup', (req: Request, res: Response) => {
  try {
    const rawQuery = (req.query.mobile || req.query.query || req.query.q) as string;
    if (!rawQuery) {
      return res.status(400).json({ success: false, message: 'شماره تماس یا شناسه الزامی است.' });
    }

    const norm = normalizePhone(rawQuery);
    const state = centralDb.getState();

    // 1. Check existing customer
    const customer = state.customers.find((c) => {
      const cMob = normalizePhone(c.mobile);
      const cPh = normalizePhone(c.phone);
      return (norm && (cMob === norm || cPh === norm)) || c.id === rawQuery || c.code === rawQuery;
    });

    if (customer) {
      const interactions = (state.interactions || []).filter((i) => i.customer_id === customer.id || i.customerId === customer.id);
      const contracts = (state.contracts || []).filter((c) => c.customerId === customer.id);
      const payments = (state.payments || []).filter((p) => p.customerId === customer.id);
      const lastInteraction = interactions[0];

      return res.json({
        success: true,
        contactType: 'CUSTOMER',
        customer,
        lead: null,
        stats: {
          interactionCount: interactions.length,
          contractCount: contracts.length,
          totalPaid: payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
          lastContactAt: lastInteraction?.started_at || lastInteraction?.startedAt || customer.createdAt,
          lastOutcome: lastInteraction?.outcome,
        },
      });
    }

    // 2. Check existing Lead
    const lead = (state.leads || []).find((l) => {
      const lMob = normalizePhone(l.mobile);
      return (norm && lMob === norm) || l.id === rawQuery || l.leadCode === rawQuery;
    });

    if (lead) {
      const interactions = (state.interactions || []).filter((i) => i.lead_id === lead.id || i.leadId === lead.id || (i.customerMobile && normalizePhone(i.customerMobile) === norm));
      const lastInteraction = interactions[0];

      return res.json({
        success: true,
        contactType: 'LEAD',
        customer: null,
        lead,
        stats: {
          interactionCount: interactions.length,
          lastContactAt: lead.lastContactAt || lastInteraction?.started_at || lead.createdAt,
          lastOutcome: lastInteraction?.outcome,
        },
      });
    }

    // 3. Unknown contact
    return res.json({
      success: true,
      contactType: 'UNKNOWN',
      customer: null,
      lead: null,
      mobile: norm || rawQuery,
      stats: {
        interactionCount: 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// Leads CRUD & Conversion (Sprint 02 Patch 01)
// ----------------------------------------------------
apiRouter.get('/leads', requirePermission(ModuleName.LEADS, PermissionAction.VIEW), (req: Request, res: Response) => {
  try {
    const { status, query, q } = req.query;
    const leads = centralDb.getLeads({
      status: status as string | undefined,
      query: (query || q) as string | undefined,
    });
    res.json({ success: true, leads });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/leads/:id', requirePermission(ModuleName.LEADS, PermissionAction.VIEW), (req: Request, res: Response) => {
  const lead = centralDb.findLeadById(req.params.id);
  if (!lead) {
    return res.status(404).json({ success: false, message: 'سرنخ مورد نظر یافت نشد.' });
  }
  res.json({ success: true, lead });
});

apiRouter.post('/leads', requirePermission(ModuleName.LEADS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.mobile) {
      return res.status(400).json({ success: false, message: 'شماره همراه برای سرنخ الزامی است.' });
    }
    const saved = await centralDb.saveLead(body);
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'ثبت سرنخ جدید (Lead)',
      module: ModuleName.LEADS,
      targetId: saved.id,
      targetType: 'LEAD',
      details: `سرنخ جدید با شماره ${saved.mobile} (${saved.leadCode}) در سامانه ثبت گردید.`,
      ipAddress: req.ip,
    });
    res.json({ success: true, lead: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    if (err instanceof PhoneDuplicateError) {
      return res.status(409).json({ success: false, error: 'PHONE_NUMBER_DUPLICATE', message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/leads/:id', requirePermission(ModuleName.LEADS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const saved = await centralDb.saveLead({ ...req.body, id: req.params.id });
    res.json({ success: true, lead: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    if (err instanceof PhoneDuplicateError) {
      return res.status(409).json({ success: false, error: 'PHONE_NUMBER_DUPLICATE', message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/leads/:id', requirePermission(ModuleName.LEADS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const deleted = await centralDb.deleteLead(req.params.id);
    res.json({ success: deleted, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/leads/:id/convert', requirePermission(ModuleName.CUSTOMERS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const leadId = req.params.id;
    const customerData = req.body || {};
    const result = await centralDb.convertLeadToCustomer(leadId, customerData);

    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'تبدیل سرنخ به مشتری (Lead Conversion)',
      module: ModuleName.CUSTOMERS,
      targetId: result.customer.id,
      targetType: 'CUSTOMER',
      details: `سرنخ ${result.lead.leadCode} (${result.lead.mobile}) با موفقیت به مشتری رسمی ${result.customer.name} تبدیل گردید.`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      customer: result.customer,
      lead: result.lead,
      revision: centralDb.getRevisionInfo().revision,
    });
  } catch (err: any) {
    if (err instanceof PhoneDuplicateError) {
      return res.status(409).json({ success: false, error: 'PHONE_NUMBER_DUPLICATE', message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// Customers CRUD
// ----------------------------------------------------
apiRouter.get('/customers', requirePermission(ModuleName.CUSTOMERS, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ customers: centralDb.getState().customers });
});

apiRouter.post('/customers', requirePermission(ModuleName.CUSTOMERS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const customer: Customer = req.body;
    const saved = await centralDb.saveCustomer(customer);
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'ثبت مخاطب / مشتری جدید',
      module: ModuleName.CUSTOMERS,
      targetId: saved.id,
      targetType: 'CUSTOMER',
      details: `مشتری جدید با نام ${saved.name} (شناسه: ${saved.id}) در سرور مرکزی ثبت شد.`,
      ipAddress: req.ip,
    });
    res.json({ success: true, customer: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    if (err instanceof PhoneDuplicateError) {
      return res.status(409).json({ success: false, error: 'PHONE_NUMBER_DUPLICATE', message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/customers/:id', requirePermission(ModuleName.CUSTOMERS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const customer: Customer = { ...req.body, id: req.params.id };
    const saved = await centralDb.saveCustomer(customer);
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'ویرایش اطلاعات مشتری',
      module: ModuleName.CUSTOMERS,
      targetId: saved.id,
      targetType: 'CUSTOMER',
      details: `اطلاعات مشتری ${saved.name} در سرور مرکزی ویرایش شد.`,
      ipAddress: req.ip,
    });
    res.json({ success: true, customer: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    if (err instanceof PhoneDuplicateError) {
      return res.status(409).json({ success: false, error: 'PHONE_NUMBER_DUPLICATE', message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/customers/:id', requirePermission(ModuleName.CUSTOMERS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const customer = centralDb.getState().customers.find((c) => c.id === id);
    const deleted = await centralDb.deleteCustomer(id);
    const authUser = await getAuthUser(req);
    if (deleted && customer) {
      await centralDb.logAudit({
        userId: authUser?.id || 'system',
        userName: authUser?.name || 'کاربر سیستم',
        userRole: authUser?.role || UserRole.SUPER_ADMIN,
        action: 'حذف مشتری',
        module: ModuleName.CUSTOMERS,
        targetId: id,
        targetType: 'CUSTOMER',
        details: `مشتری ${customer.name} از سرور مرکزی حذف گردید.`,
        ipAddress: req.ip,
      });
    }
    res.json({ success: deleted, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/customers/bulk-delete', sensitiveLimiter, requirePermission(ModuleName.CUSTOMERS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'لیست شناسه‌ها نامعتبر است' });
    }
    const count = await centralDb.deleteMultipleCustomers(ids);
    res.json({ success: true, count, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// Step 12 — TENANT-SCOPED CUSTOMERS (Prisma/PostgreSQL)
//
// These routes opt in to the PostgreSQL datapath. Every query carries the
// server-derived tenantId from req.tenantContext (never client-supplied).
// The legacy centralDb routes above remain for the unconverted path.
//   GET  /api/v2/tenants/customers          → tenant-scoped list
//   GET  /api/v2/tenants/customers/:id      → tenant-scoped getById
//   POST /api/v2/tenants/customers          → tenant-scoped create
//   PUT  /api/v2/tenants/customers/:id      → tenant-scoped update
//   DELETE /api/v2/tenants/customers/:id    → tenant-scoped soft delete
// ---------------------------------------------------------------------------
apiRouter.use('/v2/tenants/customers', requirePermission(ModuleName.CUSTOMERS, PermissionAction.VIEW));

apiRouter.get('/v2/tenants/customers', async (req: Request, res: Response) => {
  const tc = (req as any).tenantContext as TenantContext | undefined;
  if (!tc) return res.status(403).json({ success: false, message: 'Tenant context required.' });
  try {
    const { rows, total, page, pageSize } = await customerRepository.list(tc.tenantId, req.query as any) as any;
    res.json({ success: true, customers: rows, total, page, pageSize });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/v2/tenants/customers/:id', requirePermission(ModuleName.CUSTOMERS, PermissionAction.VIEW), async (req: Request, res: Response) => {
  const tc = (req as any).tenantContext as TenantContext | undefined;
  if (!tc) return res.status(403).json({ success: false, message: 'Tenant context required.' });
  const customer = await customerRepository.getById(tc.tenantId, req.params.id);
  if (!customer) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'مشتری یافت نشد.' });
  res.json({ success: true, customer });
});

apiRouter.post('/v2/tenants/customers', requirePermission(ModuleName.CUSTOMERS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  const tc = (req as any).tenantContext as TenantContext | undefined;
  if (!tc) return res.status(403).json({ success: false, message: 'Tenant context required.' });
  try {
    const saved = await customerRepository.create(tc.tenantId, req.body);
    // tenantId is server-derived; any client-supplied tenantId in body is ignored by the repository
    res.status(201).json({ success: true, customer: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/v2/tenants/customers/:id', requirePermission(ModuleName.CUSTOMERS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  const tc = (req as any).tenantContext as TenantContext | undefined;
  if (!tc) return res.status(403).json({ success: false, message: 'Tenant context required.' });
  try {
    const updated = await customerRepository.update(tc.tenantId, req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'مشتری یافت نشد.' });
    res.json({ success: true, customer: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/v2/tenants/customers/:id', requirePermission(ModuleName.CUSTOMERS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  const tc = (req as any).tenantContext as TenantContext | undefined;
  if (!tc) return res.status(403).json({ success: false, message: 'Tenant context required.' });
  try {
    const affected = await customerRepository.remove(tc.tenantId, req.params.id);
    res.json({ success: affected > 0 });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// Step 12 — GENERIC TENANT-SCOPED VERTICALS (Prisma/PostgreSQL)
//
// One router covers every tenant-owned table (from tenantVerticals registry).
//   GET    /api/v2/tenants/:table           → tenant-scoped list (filters in query)
//   GET    /api/v2/tenants/:table/:id       → tenant-scoped getById
//   POST   /api/v2/tenants/:table           → tenant-scoped create
//   PUT    /api/v2/tenants/:table/:id       → tenant-scoped update
//   DELETE /api/v2/tenants/:table/:id       → tenant-scoped delete/soft-delete
//
// tenantId is always req.tenantContext.tenantId (server-derived). A client
// tenantId in body/query/header is ignored by the repository.
// ---------------------------------------------------------------------------
apiRouter.get('/v2/tenants/:table', requirePermission(ModuleName.CUSTOMERS, PermissionAction.VIEW), async (req: Request, res: Response) => {
  const tc = (req as any).tenantContext as TenantContext | undefined;
  const repo = getTenantRepo(req.params.table);
  if (!tc) return res.status(403).json({ success: false, message: 'Tenant context required.' });
  if (!repo) return res.status(404).json({ success: false, error: 'UNKNOWN_TABLE', message: 'Vertical not found.' });
  try {
    const { rows, total, page, pageSize } = await repo.list(tc.tenantId, req.query as any);
    res.json({ success: true, data: rows, total, page, pageSize });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/v2/tenants/:table/:id', requirePermission(ModuleName.CUSTOMERS, PermissionAction.VIEW), async (req: Request, res: Response) => {
  const tc = (req as any).tenantContext as TenantContext | undefined;
  const repo = getTenantRepo(req.params.table);
  if (!tc) return res.status(403).json({ success: false, message: 'Tenant context required.' });
  if (!repo) return res.status(404).json({ success: false, error: 'UNKNOWN_TABLE', message: 'Vertical not found.' });
  try {
    const row = await repo.getById(tc.tenantId, req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'رکورد یافت نشد.' });
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/v2/tenants/:table', requirePermission(ModuleName.CUSTOMERS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  const tc = (req as any).tenantContext as TenantContext | undefined;
  const repo = getTenantRepo(req.params.table);
  if (!tc) return res.status(403).json({ success: false, message: 'Tenant context required.' });
  if (!repo) return res.status(404).json({ success: false, error: 'UNKNOWN_TABLE', message: 'Vertical not found.' });
  try {
    const created = await repo.create(tc.tenantId, req.body || {});
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/v2/tenants/:table/:id', requirePermission(ModuleName.CUSTOMERS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  const tc = (req as any).tenantContext as TenantContext | undefined;
  const repo = getTenantRepo(req.params.table);
  if (!tc) return res.status(403).json({ success: false, message: 'Tenant context required.' });
  if (!repo) return res.status(404).json({ success: false, error: 'UNKNOWN_TABLE', message: 'Vertical not found.' });
  try {
    const updated = await repo.update(tc.tenantId, req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'رکورد یافت نشد.' });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/v2/tenants/:table/:id', requirePermission(ModuleName.CUSTOMERS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  const tc = (req as any).tenantContext as TenantContext | undefined;
  const repo = getTenantRepo(req.params.table);
  if (!tc) return res.status(403).json({ success: false, message: 'Tenant context required.' });
  if (!repo) return res.status(404).json({ success: false, error: 'UNKNOWN_TABLE', message: 'Vertical not found.' });
  try {
    if (req.params.table === 'auditLog' || req.params.table === 'payment' || req.params.table === 'checkRecord') {
      // Financial/audit deletion is business-rule guarded (Step 12 preserves existing
      // payment/check deletion guards; audit logs are append-only). Use soft delete.
      const updated = await repo.update(tc.tenantId, req.params.id, { status: 'DELETED' });
      return res.json({ success: true, data: updated });
    }
    const affected = await repo.remove(tc.tenantId, req.params.id);
    res.json({ success: affected > 0 });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
apiRouter.get('/calls', requirePermission(ModuleName.CALLS, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ calls: centralDb.getState().calls });
});

apiRouter.post('/calls', requirePermission(ModuleName.CALLS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const call: Call = req.body;
    const saved = await centralDb.saveCall(call);
    res.json({ success: true, call: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/calls/:id', requirePermission(ModuleName.CALLS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const deleted = await centralDb.deleteCall(req.params.id);
    res.json({ success: deleted, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// Interactions (Call Center Engine - Sprint 02 Vertical Slice)
// Base paths: /api/v1/interactions and /api/interactions
// ----------------------------------------------------
apiRouter.get('/interactions', requirePermission(ModuleName.CALLS, PermissionAction.VIEW), (req: Request, res: Response) => {
  try {
    const {
      customerId,
      customer_id,
      type,
      interaction_type,
      from,
      to,
      followUpRequired,
      follow_up_required,
      followUpFrom,
      followUpTo,
      page,
      pageSize,
    } = req.query;

    const filterCustomerId = (customerId || customer_id) as string | undefined;
    const filterType = (type || interaction_type) as string | undefined;
    const filterFollowUp = followUpRequired !== undefined
      ? followUpRequired === 'true' || followUpRequired === '1'
      : follow_up_required !== undefined
      ? follow_up_required === 'true' || follow_up_required === '1'
      : undefined;

    const list = centralDb.getInteractions({
      customerId: filterCustomerId,
      type: filterType,
      from: from as string | undefined,
      to: to as string | undefined,
      followUpRequired: filterFollowUp,
      followUpFrom: followUpFrom as string | undefined,
      followUpTo: followUpTo as string | undefined,
    });

    const p = page ? Math.max(1, parseInt(page as string, 10)) : 1;
    const ps = pageSize ? Math.max(1, parseInt(pageSize as string, 10)) : list.length || 50;
    const startIndex = (p - 1) * ps;
    const paginated = list.slice(startIndex, startIndex + ps);

    res.json({
      success: true,
      interactions: paginated,
      total: list.length,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(list.length / ps) || 1,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

apiRouter.get('/interactions/:id', requirePermission(ModuleName.CALLS, PermissionAction.VIEW), (req: Request, res: Response) => {
  const interaction = centralDb.findInteractionById(req.params.id);
  if (!interaction) {
    return res.status(404).json({
      error: 'INTERACTION_NOT_FOUND',
      message: 'تعامل یا مکالمه مورد نظر یافت نشد.',
    });
  }
  res.json({ success: true, interaction });
});

apiRouter.post('/interactions', requirePermission(ModuleName.CALLS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const customerId = (body.customer_id || body.customerId) as string | undefined;
    const leadId = (body.lead_id || body.leadId) as string | undefined;
    const mobile = (body.customerMobile || body.mobile) as string | undefined;
    const interactionType = (body.interaction_type || body.interactionType || 'incoming_call') as string;
    const startedAt = (body.started_at || body.startedAt || body.dateTime || new Date().toISOString()) as string;
    const followUpRequired = Boolean(body.follow_up_required || body.followUpRequired);
    const followUpAt = (body.follow_up_at || body.followUpAt || body.followUpDate) as string | undefined;
    const followUpUserId = (body.follow_up_user_id || body.followUpUserId) as string | undefined;

    // 1. Validation: At least one of customerId, leadId, or mobile is required
    if (!customerId && !leadId && !mobile) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'ثبت تماس و تعامل نیازمند حداقل یکی از موارد: انتخاب مشتری، انتخاب سرنخ، یا وارد کردن شماره همراه است.',
      });
    }

    // 2. Validation: follow-up requirements
    if (followUpRequired) {
      if (!followUpAt) {
        return res.status(400).json({
          error: 'FOLLOW_UP_DATE_REQUIRED',
          message: 'در صورت فعال بودن پیگیری، تاریخ و ساعت پیگیری الزامی است.',
        });
      }
      if (!followUpUserId) {
        return res.status(400).json({
          error: 'FOLLOW_UP_USER_REQUIRED',
          message: 'در صورت فعال بودن پیگیری، انتخاب کارشناس مسئول پیگیری الزامی است.',
        });
      }
    }

    // 3. Authenticated user
    const authUser = await getAuthUser(req);
    const recordingUserId = authUser?.id || body.user_id || body.userId || 'usr-admin';
    const recordingUserName = authUser?.name || body.userName || 'کارشناس سامانه';

    // 4. Save interaction through centralDb (which handles lead creation / matching, task generation, dual-write)
    const saved = await centralDb.saveInteraction({
      ...body,
      user_id: recordingUserId,
      userId: recordingUserId,
      userName: recordingUserName,
      interaction_type: interactionType,
      interactionType: interactionType,
      started_at: startedAt,
      startedAt: startedAt,
      follow_up_required: followUpRequired,
      followUpRequired: followUpRequired,
      follow_up_at: followUpAt,
      followUpAt: followUpAt,
      follow_up_user_id: followUpUserId,
      followUpUserId: followUpUserId,
    });

    // 5. Audit log
    await centralDb.logAudit({
      userId: recordingUserId,
      userName: recordingUserName,
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'ثبت تعامل و مکالمه در مرکز تماس (Call Center)',
      module: ModuleName.CALLS,
      targetId: saved.id,
      targetType: 'INTERACTION',
      details: `تعامل ${saved.interaction_type} برای ${saved.customerName || saved.customerMobile} (شناسه: ${saved.id}) ثبت شد.`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      interaction: saved,
      revision: centralDb.getRevisionInfo().revision,
    });
  } catch (err: any) {
    console.error('Save interaction error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

apiRouter.patch('/interactions/:id', requirePermission(ModuleName.CALLS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const existing = centralDb.findInteractionById(id);
    if (!existing) {
      return res.status(404).json({
        error: 'INTERACTION_NOT_FOUND',
        message: 'تعامل مورد نظر یافت نشد.',
      });
    }

    const body = req.body || {};
    if (body.follow_up_required === true || body.followUpRequired === true) {
      const followUpAt = body.follow_up_at || body.followUpAt || existing.follow_up_at;
      const followUpUserId = body.follow_up_user_id || body.followUpUserId || existing.follow_up_user_id;
      if (!followUpAt) {
        return res.status(400).json({
          error: 'FOLLOW_UP_DATE_REQUIRED',
          message: 'تاریخ و زمان پیگیری الزامی است.',
        });
      }
      if (!followUpUserId) {
        return res.status(400).json({
          error: 'FOLLOW_UP_USER_REQUIRED',
          message: 'انتخاب کارشناس مسئول پیگیری الزامی است.',
        });
      }
    }

    const updated = await centralDb.patchInteraction(id, body);
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'ویرایش اطلاعات تعامل / مکالمه',
      module: ModuleName.CALLS,
      targetId: id,
      targetType: 'INTERACTION',
      details: `اطلاعات تعامل ${id} با موفقیت ویرایش و ممیزی شد.`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      interaction: updated,
      revision: centralDb.getRevisionInfo().revision,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

apiRouter.post('/interactions/:id/complete-follow-up', requirePermission(ModuleName.CALLS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const existing = centralDb.findInteractionById(id);
    if (!existing) {
      return res.status(404).json({
        error: 'INTERACTION_NOT_FOUND',
        message: 'تعامل مورد نظر یافت نشد.',
      });
    }

    const updated = await centralDb.completeInteractionFollowUp(id);
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'تکمیل پیگیری تعامل / تماس',
      module: ModuleName.CALLS,
      targetId: id,
      targetType: 'INTERACTION',
      details: `پیگیری تعامل ${id} به عنوان تکمیل‌شده علامت‌گذاری شد.`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      interaction: updated,
      revision: centralDb.getRevisionInfo().revision,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

apiRouter.delete('/interactions/:id', requirePermission(ModuleName.CALLS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const existing = centralDb.findInteractionById(id);
    if (!existing) {
      return res.status(404).json({
        error: 'INTERACTION_NOT_FOUND',
        message: 'تعامل مورد نظر یافت نشد.',
      });
    }

    const deleted = await centralDb.deleteInteraction(id);
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'حذف تعامل / مکالمه از مرکز تماس',
      module: ModuleName.CALLS,
      targetId: id,
      targetType: 'INTERACTION',
      details: `تعامل ${id} با موضوع "${existing.subject}" حذف شد.`,
      ipAddress: req.ip,
    });

    res.json({
      success: deleted,
      revision: centralDb.getRevisionInfo().revision,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

apiRouter.get('/voice-notes', requirePermission(ModuleName.NOTES, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ voiceNotes: centralDb.getState().voiceNotes });
});

// Audio streaming endpoint with HTTP Range Request (206 Partial Content) support for iOS/Safari/iPhone
apiRouter.get('/voice-notes/:id/audio', requirePermission(ModuleName.NOTES, PermissionAction.VIEW), (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const vn = centralDb.getState().voiceNotes.find((n) => n.id === id);
    if (!vn || !vn.audioDataUrl) {
      return res.status(404).send('Audio not found');
    }

    const dataUrl = vn.audioDataUrl;
    const matches = dataUrl.match(/^data:([a-zA-Z0-9\/+-.]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).send('Invalid audio data format');
    }

    // Step 4: prefer the authoritative MIME captured at record time; fall back
    // to the data URL header for legacy notes recorded before MIME persistence.
    const mimeType = (vn.mimeType && vn.mimeType.startsWith('audio/')) ? vn.mimeType : (matches[1] || 'audio/wav');
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const totalSize = buffer.length;

    // Handle HTTP Range Requests (Essential for iOS Safari playback & scrubbing)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(buffer.subarray(start, end + 1));
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Accept-Ranges': 'bytes',
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(buffer);
    }
  } catch (err: any) {
    console.error('Audio streaming error:', err);
    res.status(500).send('Internal audio streaming error');
  }
});

apiRouter.post('/voice-notes', requirePermission(ModuleName.NOTES, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const vn: VoiceNote = req.body;
    // Step 4: derive and persist an authoritative container/MIME + filename so
    // downstream serving never depends on re-inferring from a possibly-empty
    // data URL header (root-cause hardening for the iPhone 8 / WebM decode issue).
    const dataUrl = vn.audioDataUrl || '';
    if (dataUrl.startsWith('data:') && !vn.mimeType) {
      const headerMatch = dataUrl.match(/^data:([a-zA-Z0-9\/+-.]+);/);
      if (headerMatch && headerMatch[1] && headerMatch[1] !== 'application/octet-stream') {
        vn.mimeType = headerMatch[1];
      }
    }
    if (!vn.fileName && dataUrl) {
      const ext = vn.mimeType === 'audio/webm' ? 'webm' : vn.mimeType === 'audio/mp4' || vn.mimeType === 'audio/aac' ? 'm4a' : vn.mimeType === 'audio/wav' ? 'wav' : 'm4a';
      vn.fileName = `voice-${Date.now()}.${ext}`;
    }
    const saved = await centralDb.saveVoiceNote(vn);
    res.json({ success: true, voiceNote: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/voice-notes/:id', requirePermission(ModuleName.NOTES, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const deleted = await centralDb.deleteVoiceNote(req.params.id);
    res.json({ success: deleted, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Edit Text/Voice note — owner-or-admin only (Sprint 03 Patch 05)
apiRouter.put('/voice-notes/:id', requirePermission(ModuleName.NOTES, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    const id = req.params.id;
    const existing = centralDb.getState().voiceNotes.find((n) => n.id === id);
    if (!existing) return res.status(404).json({ success: false, message: 'یادداشت یافت نشد' });
    if (!authUser || !(authUser.id === existing.createdById || isAdmin(authUser))) {
      return res.status(403).json({ success: false, message: 'تنها نویسنده یا مدیر مجاز به ویرایش این یادداشت است.' });
    }
    const now = new Date().toISOString();
    const updated: VoiceNote = { ...existing, ...req.body, id: existing.id, updatedAt: now, updatedById: authUser.id, updatedByName: authUser.name, editedAt: now };
    const saved = await centralDb.saveVoiceNote(updated);
    res.json({ success: true, voiceNote: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// Tasks CRUD
// ----------------------------------------------------
apiRouter.get('/tasks', requirePermission(ModuleName.TASKS, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ tasks: centralDb.getState().tasks });
});

apiRouter.post('/tasks', requirePermission(ModuleName.TASKS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const task: Task = req.body;
    const saved = await centralDb.saveTask(task);
    res.json({ success: true, task: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/tasks/:id', requirePermission(ModuleName.TASKS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const task: Task = { ...req.body, id: req.params.id };
    const saved = await centralDb.saveTask(task);
    res.json({ success: true, task: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/tasks/:id', requirePermission(ModuleName.TASKS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const deleted = await centralDb.deleteTask(req.params.id);
    res.json({ success: deleted, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// Contracts CRUD
// ----------------------------------------------------
apiRouter.get('/contracts', requirePermission(ModuleName.CONTRACTS, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ contracts: centralDb.getState().contracts });
});

apiRouter.post('/contracts', requirePermission(ModuleName.CONTRACTS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const contract: Contract = req.body;
    const saved = await centralDb.saveContract(contract);
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'ثقر قرارداد جدید',
      module: ModuleName.CONTRACTS,
      targetId: saved.id,
      targetType: 'CONTRACT',
      details: `قرارداد جدید ${saved.contractNumber} با مبلغ ${saved.amount} برای مشتری ${saved.customerName} ثبت شد.`,
      ipAddress: req.ip,
    });
    res.json({ success: true, contract: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/contracts/:id', requirePermission(ModuleName.CONTRACTS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const contract: Contract = { ...req.body, id: req.params.id };
    const saved = await centralDb.saveContract(contract);
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'ویرایش قرارداد',
      module: ModuleName.CONTRACTS,
      targetId: saved.id,
      targetType: 'CONTRACT',
      details: `قرارداد ${saved.contractNumber} ویرایش شد.`,
      ipAddress: req.ip,
    });
    res.json({ success: true, contract: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/contracts/:id', requirePermission(ModuleName.CONTRACTS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const deleted = await centralDb.deleteContract(req.params.id);
    const authUser = await getAuthUser(req);
    if (deleted) {
      await centralDb.logAudit({
        userId: authUser?.id || 'system',
        userName: authUser?.name || 'کاربر سیستم',
        userRole: authUser?.role || UserRole.SUPER_ADMIN,
        action: 'حذف قرارداد',
        module: ModuleName.CONTRACTS,
        targetId: req.params.id,
        targetType: 'CONTRACT',
        details: `قرارداد ${req.params.id} حذف شد.`,
        ipAddress: req.ip,
      });
    }
    res.json({ success: deleted, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// Payments & Checks CRUD
// ----------------------------------------------------
apiRouter.get('/payments', requirePermission(ModuleName.PAYMENTS, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ payments: centralDb.getState().payments });
});

apiRouter.post('/payments', requirePermission(ModuleName.PAYMENTS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const payment: Payment = req.body;
    const saved = await centralDb.savePayment(payment);
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'ثبت پرداخت مالی جدید',
      module: ModuleName.PAYMENTS,
      targetId: saved.id,
      targetType: 'PAYMENT',
      details: `پرداخت به مبلغ ${saved.amount} ثبت شد.`,
      ipAddress: req.ip,
    });
    res.json({ success: true, payment: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/payments/:id', requirePermission(ModuleName.PAYMENTS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const payment: Payment = { ...req.body, id: req.params.id };
    const saved = await centralDb.savePayment(payment);
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'ویرایش پرداخت مالی',
      module: ModuleName.PAYMENTS,
      targetId: saved.id,
      targetType: 'PAYMENT',
      details: `پرداخت ${saved.id} ویرایش شد.`,
      ipAddress: req.ip,
    });
    res.json({ success: true, payment: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/payments/:id', requirePermission(ModuleName.PAYMENTS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const deleted = await centralDb.deletePayment(req.params.id);
    const authUser = await getAuthUser(req);
    if (deleted) {
      await centralDb.logAudit({
        userId: authUser?.id || 'system',
        userName: authUser?.name || 'کاربر سیستم',
        userRole: authUser?.role || UserRole.SUPER_ADMIN,
        action: 'حذف پرداخت مالی',
        module: ModuleName.PAYMENTS,
        targetId: req.params.id,
        targetType: 'PAYMENT',
        details: `پرداخت ${req.params.id} حذف شد.`,
        ipAddress: req.ip,
      });
    }
    res.json({ success: deleted, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/checks', requirePermission(ModuleName.CHECKS, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ checks: centralDb.getState().checks });
});

apiRouter.post('/checks', requirePermission(ModuleName.CHECKS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const check: Check = req.body;
    const saved = await centralDb.saveCheck(check);
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'ثبت چک جدید',
      module: ModuleName.CHECKS,
      targetId: saved.id,
      targetType: 'CHECK',
      details: `چک شماره ${saved.checkNumber} به مبلغ ${saved.amount} بانک ${saved.bankName} ثبت شد.`,
      ipAddress: req.ip,
    });
    res.json({ success: true, check: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/checks/:id', requirePermission(ModuleName.CHECKS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const check: Check = { ...req.body, id: req.params.id };
    const saved = await centralDb.saveCheck(check);
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'ویرایش چک',
      module: ModuleName.CHECKS,
      targetId: saved.id,
      targetType: 'CHECK',
      details: `چک شماره ${saved.checkNumber} ویرایش شد.`,
      ipAddress: req.ip,
    });
    res.json({ success: true, check: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/checks/:id', requirePermission(ModuleName.CHECKS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const deleted = await centralDb.deleteCheck(req.params.id);
    const authUser = await getAuthUser(req);
    if (deleted) {
      await centralDb.logAudit({
        userId: authUser?.id || 'system',
        userName: authUser?.name || 'کاربر سیستم',
        userRole: authUser?.role || UserRole.SUPER_ADMIN,
        action: 'حذف چک',
        module: ModuleName.CHECKS,
        targetId: req.params.id,
        targetType: 'CHECK',
        details: `چک ${req.params.id} حذف شد.`,
        ipAddress: req.ip,
      });
    }
    res.json({ success: deleted, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// SIM & Repairs CRUD
// ----------------------------------------------------
apiRouter.get('/sims', requirePermission(ModuleName.SIM_INVENTORY, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ sims: centralDb.getState().sims });
});

apiRouter.post('/sims', requirePermission(ModuleName.SIM_INVENTORY, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const sim: SimCard = req.body;
    const saved = await centralDb.saveSim(sim);
    res.json({ success: true, sim: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/sims/:id', requirePermission(ModuleName.SIM_INVENTORY, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const sim: SimCard = { ...req.body, id: req.params.id };
    const saved = await centralDb.saveSim(sim);
    res.json({ success: true, sim: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/sims/:id', requirePermission(ModuleName.SIM_INVENTORY, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const deleted = await centralDb.deleteSim(req.params.id);
    res.json({ success: deleted, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/repairs', requirePermission(ModuleName.REPAIRS, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ repairs: centralDb.getState().repairs });
});

apiRouter.post('/repairs', requirePermission(ModuleName.REPAIRS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const repair: Repair = req.body;
    const saved = await centralDb.saveRepair(repair);
    res.json({ success: true, repair: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/repairs/:id', requirePermission(ModuleName.REPAIRS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const repair: Repair = { ...req.body, id: req.params.id };
    const saved = await centralDb.saveRepair(repair);
    res.json({ success: true, repair: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/repairs/:id', requirePermission(ModuleName.REPAIRS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const deleted = await centralDb.deleteRepair(req.params.id);
    res.json({ success: deleted, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper to parse base64 dataUrl into binary buffer and determine exact MIME type
function parseAttachmentContent(dataUrl: string, fileName?: string, declaredMime?: string): { mimeType: string; buffer: Buffer } {
  let mimeType = declaredMime || 'application/octet-stream';
  let buffer: Buffer = Buffer.alloc(0);

  if (dataUrl && dataUrl.startsWith('data:')) {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx !== -1) {
      const headerPart = dataUrl.substring(5, commaIdx);
      const isBase64 = headerPart.includes(';base64');
      const rawType = headerPart.split(';')[0];
      if (rawType && rawType !== 'application/octet-stream') {
        mimeType = rawType;
      }
      const dataPayload = dataUrl.substring(commaIdx + 1);
      if (isBase64) {
        buffer = Buffer.from(dataPayload, 'base64');
      } else {
        buffer = Buffer.from(decodeURIComponent(dataPayload), 'utf-8');
      }
    }
  }

  // Refine MIME type if generic, missing, or JSON (browser sends wrong MIME for HEIC)
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  if (!mimeType || mimeType === 'application/octet-stream' || mimeType === 'application/json') {
    if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
    else if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'svg') mimeType = 'image/svg+xml';
    else if (ext === 'pdf') mimeType = 'application/pdf';
    else if (['txt', 'log'].includes(ext)) mimeType = 'text/plain; charset=utf-8';
    else if (ext === 'csv') mimeType = 'text/csv; charset=utf-8';
    else if (ext === 'json') mimeType = 'application/json';
    else if (['heic', 'heif'].includes(ext)) mimeType = 'image/heic';
    else if (['mp4', 'mov'].includes(ext)) mimeType = 'video/mp4';
    else if (ext === 'mp3') mimeType = 'audio/mpeg';
    else if (ext === 'm4a') mimeType = 'audio/mp4';
  }

  // Magic bytes sniffing for foolproof accuracy
  if (buffer.length >= 4) {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      mimeType = 'image/png';
    } else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      mimeType = 'image/jpeg';
    } else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      mimeType = 'image/gif';
    } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      // RIFF check for WEBP
      if (buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP') {
        mimeType = 'image/webp';
      }
    } else if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      mimeType = 'application/pdf';
    }
  }

  return { mimeType, buffer };
}

// ----------------------------------------------------
// Attachments CRUD & Flexible Linking & Secure Content Streaming
// ----------------------------------------------------
apiRouter.get('/attachments', requirePermission(ModuleName.CUSTOMERS, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ attachments: centralDb.getState().attachments });
});

apiRouter.get('/attachments/:id', requirePermission(ModuleName.CUSTOMERS, PermissionAction.VIEW), async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
  }

  const att = centralDb.getState().attachments.find((a) => a.id === req.params.id);
  if (!att) {
    return res.status(404).json({ success: false, message: 'سند یافت نشد.' });
  }

  res.json({ success: true, attachment: att });
});

// Secure Attachment Content & Preview Endpoint (Streams binary with exact Content-Type)
// Step 4: added HTTP Range support (206 / 416), Accept-Ranges on both paths, and
// SVG served as a download (attachment) so an uploaded SVG is not an XSS vector
// in the app origin.
apiRouter.get(['/attachments/:id/content', '/attachments/:id/preview'], requirePermission(ModuleName.CUSTOMERS, PermissionAction.VIEW), async (req: Request, res: Response) => {
  const att = centralDb.getState().attachments.find((a) => a.id === req.params.id);
  if (!att) {
    return res.status(404).json({ success: false, message: 'فایل پیوست یافت نشد.' });
  }

  if (!att.dataUrl) {
    return res.status(404).json({ success: false, message: 'محتوای فایل یافت نشد.' });
  }

  const { mimeType, buffer } = parseAttachmentContent(
    att.dataUrl,
    att.fileName || att.filename,
    att.mimeType || att.fileType
  );

  const isDownload = req.query.download === 'true' || req.query.download === '1';
  const fileName = att.fileName || att.filename || 'attachment';
  const encodedName = encodeURIComponent(fileName).replace(/['()]/g, escape);
  // SVG can carry active <script> content — never render it inline in the app
  // origin. Force a download unless the client explicitly asks for preview and
  // the record is not flagged sensitive.
  const isSvg = mimeType === 'image/svg+xml';
  const disposition = isDownload || isSvg ? 'attachment' : 'inline';
  const totalSize = buffer.length;

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${encodedName}"; filename*=UTF-8''${encodedName}`
  );

  // HTTP Range Request support (iOS/Safari audio + video scrubbing, PDF range).
  const range = req.headers.range;
  if (range) {
    const parsed = parseByteRange(range, totalSize);
    if (!parsed) {
      res.setHeader('Content-Range', `bytes */${totalSize}`);
      return res.status(416).send('Range Not Satisfiable');
    }
    const { start, end } = parsed;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': mimeType,
      'Cache-Control': 'private, max-age=86400',
    });
    return res.end(buffer.subarray(start, end + 1));
  }

  res.setHeader('Content-Length', totalSize);
  return res.send(buffer);
});

// Parse an HTTP byte-range header into a valid [start, end] within [0, size).
// Supports: bytes=a-b, bytes=a-, bytes=-n (suffix of last n bytes).
// Returns null for malformed / unsatisfiable ranges.
function parseByteRange(rangeHeader: string, size: number): { start: number; end: number } | null {
  const m = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!m) return null;
  const startStr = m[1];
  const endStr = m[2];
  if (startStr === '' && endStr === '') return null;
  if (startStr === '') {
    // suffix range: last N bytes
    const suffix = parseInt(endStr, 10);
    if (suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = parseInt(startStr, 10);
  if (start >= size) return null;
  if (endStr === '') return { start, end: size - 1 };
  const end = parseInt(endStr, 10);
  if (end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

apiRouter.post('/attachments', requirePermission(ModuleName.CUSTOMERS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const att: Attachment = req.body;
    const saved = await centralDb.saveAttachment(att);
    res.json({ success: true, attachment: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/attachments/:id', requirePermission(ModuleName.CUSTOMERS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const att: Attachment = { ...req.body, id: req.params.id };
    const saved = await centralDb.saveAttachment(att);
    res.json({ success: true, attachment: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/attachments/:id/link-customer', requirePermission(ModuleName.CUSTOMERS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const { customerId, customerName } = req.body;
    const saved = await centralDb.linkAttachmentCustomer(req.params.id, customerId, customerName);
    if (!saved) {
      return res.status(404).json({ success: false, message: 'سند یافت نشد' });
    }
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: customerId ? 'اتصال سند به مشتری' : 'حذف انتساب سند از مشتری',
      module: ModuleName.CUSTOMERS,
      targetId: req.params.id,
      targetType: 'ATTACHMENT',
      details: customerId
        ? `سند "${saved.fileName}" به پرونده مشتری "${customerName || customerId}" متصل گردید.`
        : `ارتباط سند "${saved.fileName}" با مشتری حذف شد و به فهرست اسناد بدون مشتری منتقل گشت.`,
      ipAddress: req.ip,
    });
    res.json({ success: true, attachment: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/attachments/:id', requirePermission(ModuleName.CUSTOMERS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const deleted = await centralDb.deleteAttachment(req.params.id);
    res.json({ success: deleted, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// Users & Roles Management
// ----------------------------------------------------
apiRouter.get('/users', requirePermission(ModuleName.USERS, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ users: sanitizeUsers(centralDb.getState().users) });
});

apiRouter.post('/users', sensitiveLimiter, requirePermission(ModuleName.USERS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const user: User = req.body;

    // Hash the password before saving (write site #1: user creation)
    if (user.password) {
      user.password = await auth.hashPassword(user.password);
    }

    const saved = await centralDb.saveUser(user);
    res.json({ success: true, user: sanitizeUser(saved), revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/users/:id', requirePermission(ModuleName.USERS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    if (!isAdmin(authUser)) {
      return res.status(403).json({ success: false, message: 'تنها مدیران ارشد مجاز به ویرایش مشخصات کاربران هستند.' });
    }

    const existing = centralDb.findUserById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'کاربر مورد نظر یافت نشد.' });
    }

    const incoming = req.body || {};
    let passwordToSave = existing.password;

    // Hash the password if a new one is being set (write site #2: admin edit)
    if (incoming.password || incoming.newPassword) {
      const rawNew = String(incoming.password || incoming.newPassword).trim();
      passwordToSave = await auth.hashPassword(rawNew);
    }

    const user: User = {
      ...existing,
      ...incoming,
      id: req.params.id,
      password: passwordToSave,
    };

    const saved = await centralDb.saveUser(user);

    await centralDb.logAudit({
      userId: authUser?.id || 'usr-admin',
      userName: authUser?.name || 'مدیر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'ویرایش مشخصات کاربر',
      module: ModuleName.USERS,
      targetId: saved.id,
      targetType: 'USER',
      details: `مشخصات و دسترسی‌های کاربر "${saved.name}" (@${saved.username}) توسط ${authUser?.name || 'مدیر'} به‌روزرسانی شد.`,
      ipAddress: req.ip,
    });

    const { password: _, ...sanitized } = saved;
    res.json({ success: true, user: sanitized, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/users/:id/reset-password', requirePermission(ModuleName.USERS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    if (!isAdmin(authUser)) {
      return res.status(403).json({
        success: false,
        message: 'تنها مدیران ارشد (Super Admin) و کاربر ارشد (God) مجاز به بازنشانی رمز عبور کاربران هستند.',
      });
    }

    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'کلمه عبور جدید باید حداقل ۳ کاراکتر باشد.',
      });
    }

    const targetUser = centralDb.findUserById(req.params.id) || centralDb.findUserByCredential(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'کاربر مورد نظر جهت تغییر رمز عبور یافت نشد.' });
    }

    // Hash the new password before storing (write site #4: admin reset)
    const hashedPassword = await auth.hashPassword(newPassword.trim());
    const updated = await centralDb.resetUserPassword(targetUser.id, hashedPassword);

    await centralDb.logAudit({
      userId: authUser?.id || 'usr-admin',
      userName: authUser?.name || 'مدیر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'بازنشانی کلمه عبور کاربر (Password Reset)',
      module: ModuleName.USERS,
      targetId: targetUser.id,
      targetType: 'USER',
      details: `کلمه عبور کاربر "${targetUser.name}" (@${targetUser.username}) با موفقیت بازنشانی شد.`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `رمز عبور کاربر "${targetUser.name}" با موفقیت تغییر یافت.`,
      user: sanitizeUser(updated),
      revision: centralDb.getRevisionInfo().revision,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/users/:id', requirePermission(ModuleName.USERS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    if (!isAdmin(authUser)) {
      return res.status(403).json({
        success: false,
        message: 'تنها مدیران ارشد (Super Admin) و کاربر ارشد (God) مجاز به حذف حساب‌های کاربری هستند.',
      });
    }

    const targetId = req.params.id;
    const targetUser = centralDb.findUserById(targetId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'کاربر مورد نظر یافت نشد.' });
    }

    if (targetUser.id === 'usr-admin' || targetUser.username?.toLowerCase() === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'حساب کاربری ریشه سامانه (@admin) غیرقابل حذف است.',
      });
    }

    if (authUser?.id === targetUser.id) {
      return res.status(400).json({
        success: false,
        message: 'امکان حذف حساب کاربری جاری خودتان وجود ندارد.',
      });
    }

    const deleted = await centralDb.deleteUser(targetId);

    if (deleted) {
      await centralDb.logAudit({
        userId: authUser?.id || 'usr-admin',
        userName: authUser?.name || 'مدیر سیستم',
        userRole: authUser?.role || UserRole.SUPER_ADMIN,
        action: 'حذف حساب کاربری (User Deletion)',
        module: ModuleName.USERS,
        targetId: targetUser.id,
        targetType: 'USER',
        details: `حساب کاربری "${targetUser.name}" (@${targetUser.username}) با نقش ${targetUser.role} توسط ${authUser?.name || 'مدیر'} حذف شد.`,
        ipAddress: req.ip,
      });
    }

    res.json({
      success: deleted,
      message: `حساب کاربری "${targetUser.name}" با موفقیت حذف گردید.`,
      revision: centralDb.getRevisionInfo().revision,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/roles', requirePermission(ModuleName.USERS, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ roles: centralDb.getState().roles });
});

apiRouter.put('/roles/:id', sensitiveLimiter, requirePermission(ModuleName.USERS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const role: Role = { ...req.body, id: req.params.id };
    const saved = await centralDb.saveRole(role);
    res.json({ success: true, role: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// Notifications, Devices & Web Push Engine
// ----------------------------------------------------
apiRouter.get('/notifications', requirePermission(ModuleName.NOTES, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ notifications: centralDb.getState().notifications });
});

apiRouter.post('/notifications', requirePermission(ModuleName.NOTES, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const n: Notification = req.body;
    const saved = await centralDb.saveNotification(n);
    res.json({ success: true, notification: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/notifications/:id/snooze', async (req: Request, res: Response) => {
  try {
    const minutes = Number(req.body.minutes) || 15;
    const snoozed = await centralDb.snoozeNotification(req.params.id, minutes);
    if (!snoozed) {
      return res.status(404).json({ success: false, message: 'اعلان یافت نشد' });
    }
    res.json({ success: true, notification: snoozed, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/notifications/read-all', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    await centralDb.markAllNotificationsRead(userId);
    res.json({ success: true, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Returns ONLY the public VAPID key (webPushService.getPublicKey()). The
// private key lives in webPushService (env override or data/vapid_keys.json)
// and never appears in any response. Authenticated since Step 3 §9.
apiRouter.get('/notifications/vapid-public-key', (req: Request, res: Response) => {
  res.json({ success: true, publicKey: webPushService.getPublicKey() });
});

apiRouter.get('/notifications/devices', (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  const devices = centralDb.getUserDevices(userId);
  res.json({ success: true, devices });
});

apiRouter.post('/notifications/devices/register', async (req: Request, res: Response) => {
  try {
    const device: UserNotificationDevice = req.body;
    const authUser = await getAuthUser(req);
    const enrichedDevice: UserNotificationDevice = {
      ...device,
      userId: device.userId || authUser?.id || 'usr-admin',
      userName: device.userName || authUser?.name || 'کاربر سیستم',
    };
    const registered = await centralDb.registerDevice(enrichedDevice);
    await centralDb.logAudit({
      userId: authUser?.id || registered.userId,
      userName: authUser?.name || registered.userName || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'PUSH_SUBSCRIPTION_CREATED',
      module: ModuleName.SETTINGS,
      targetId: registered.id,
      targetType: 'PUSH_SUBSCRIPTION',
      details: `ثبت اشتراک پوش برای دستگاه ${registered.deviceName || ''} (${registered.platform || ''}).`,
      ipAddress: req.ip,
    });
    res.json({ success: true, device: registered, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete the current user's push subscription (idempotent). The server derives
// ownership from the authenticated user — never trusts a client-provided userId.
apiRouter.delete('/notifications/push/subscription', async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as User | undefined;
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    }
    const removed = await centralDb.deleteAllUserDevices(authUser.id);
    const affectedCount = removed.filter((d) => d).length;
    await centralDb.logAudit({
      userId: authUser.id,
      userName: authUser.name,
      userRole: authUser.role,
      action: 'PUSH_SUBSCRIPTION_REMOVED',
      module: ModuleName.SETTINGS,
      targetId: authUser.id,
      targetType: 'USER',
      details: `حذف ${affectedCount} اشتراک پوش ثبت‌شده برای کاربر ${authUser.name} (@${authUser.username}).`,
      ipAddress: req.ip,
    });
    res.json({ success: true, removed: affectedCount, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/notifications/devices/:id/toggle', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    const { enabled } = req.body;
    const existing = centralDb.getUserDevices().find((d) => d.id === req.params.id);
    // Ownership enforcement: a user may only toggle their own device.
    if (!existing || existing.userId !== authUser?.id) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز: این دستگاه متعلق به شما نیست.' });
    }
    const updated = await centralDb.updateDevice(req.params.id, { enabled: Boolean(enabled) });
    res.json({ success: true, device: updated, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/notifications/devices/:id', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    const device = centralDb.getUserDevices().find((d) => d.id === req.params.id);
    // Ownership enforcement: a user may only delete their own device. Admins
    // may manage any device (spec: subscription cleanup / device management).
    if (!device || (device.userId !== authUser?.id && !isAdmin(authUser))) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز: این دستگاه متعلق به شما نیست.' });
    }
    const deleted = await centralDb.deleteDevice(req.params.id);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'PUSH_SUBSCRIPTION_REMOVED',
      module: ModuleName.SETTINGS,
      targetId: req.params.id,
      targetType: 'PUSH_SUBSCRIPTION',
      details: `حذف اشتراک پوش دستگاه ${device?.deviceName || ''} (${device?.platform || ''}).`,
      ipAddress: req.ip,
    });
    res.json({ success: deleted, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Test-push is rate-limited (spec §55) to stop clients spamming push requests.
apiRouter.post('/notifications/test-push', sensitiveLimiter, async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    const targetUserId = req.body.userId || authUser?.id || 'usr-admin';
    const title = req.body.title || 'آزمایش اعلان هوشمند MMBA';
    const body = req.body.body || 'سیستم هشدار صوتی و اعلان دستگاه‌های متصل فعال و پایدار است.';
    const notif = await notificationScheduler.sendTestNotification(targetUserId, title, body);
    await centralDb.logAudit({
      userId: authUser?.id || targetUserId,
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'TEST_NOTIFICATION_SENT',
      module: ModuleName.SETTINGS,
      targetId: notif.id,
      targetType: 'NOTIFICATION',
      details: 'ارسال اعلان پوش آزمایشی.',
      ipAddress: req.ip,
    });
    res.json({ success: true, notification: notif });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/notifications/deliveries', (req: Request, res: Response) => {
  const notificationId = req.query.notificationId as string | undefined;
  const userId = req.query.userId as string | undefined;
  const deliveries = centralDb.getDeliveries(notificationId, userId);
  res.json({ success: true, deliveries });
});

apiRouter.get('/notifications/settings', (req: Request, res: Response) => {
  const settings = centralDb.getNotificationSettings();
  res.json({ success: true, settings });
});

apiRouter.put('/notifications/settings', async (req: Request, res: Response) => {
  try {
    const updated = await centralDb.updateNotificationSettings(req.body);
    res.json({ success: true, settings: updated, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/audit-logs', requirePermission(ModuleName.AUDIT_LOGS, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ auditLogs: centralDb.getState().auditLogs });
});

apiRouter.post('/audit-logs', sensitiveLimiter, async (req: Request, res: Response) => {
  try {
    const log = await centralDb.logAudit({ ...req.body, ipAddress: req.ip });
    res.json({ success: true, log, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// Problem Reports & User Error Reporting
// ----------------------------------------------------
// Any authenticated user can submit a problem report
apiRouter.post('/problem-reports', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    const body: ProblemReport = req.body;
    const report: ProblemReport = {
      ...body,
      userId: body.userId || authUser?.id || 'anonymous',
      userName: body.userName || authUser?.name || 'کاربر سیستم',
      userRole: body.userRole || authUser?.role || UserRole.SALES,
      userEmail: body.userEmail || authUser?.email,
      userMobile: body.userMobile || authUser?.mobile,
      createdAt: body.createdAt || new Date().toISOString(),
    };

    const saved = await centralDb.saveProblemReport(report);

    // Notify administrators
    const admins = centralDb.getState().users.filter((u) => isAdmin(u));
    for (const adm of admins) {
      await centralDb.saveNotification({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: adm.id,
        title: 'گزارش خطای جدید توسط کاربر',
        message: `${saved.userName} یک مشکل جدید ثبت نمود: «${saved.title}»`,
        category: 'SYSTEM',
        severity: 'WARNING',
        read: false,
        relatedEntityType: 'PROBLEM_REPORT',
        relatedEntityId: saved.id,
        createdAt: new Date().toISOString(),
      });
    }

    res.json({ success: true, report: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin ONLY can view all problem reports
apiRouter.get('/problem-reports', async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  // If user is not admin, return only their own reports or 403
  if (authUser && !isAdmin(authUser)) {
    const userReports = centralDb.getState().problemReports.filter((r) => r.userId === authUser.id);
    return res.json({ reports: userReports });
  }
  res.json({ reports: centralDb.getState().problemReports });
});

// Admin ONLY can update or resolve problem reports
apiRouter.put('/problem-reports/:id', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    const report: ProblemReport = { ...req.body, id: req.params.id };
    if (authUser && !isAdmin(authUser) && report.userId !== authUser.id) {
      return res.status(403).json({ success: false, message: 'تنها مدیران سیستم مجاز به تغییر وضعیت گزارش هستند.' });
    }
    const saved = await centralDb.saveProblemReport(report);
    res.json({ success: true, report: saved, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin ONLY can delete problem reports
apiRouter.delete('/problem-reports/:id', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (authUser && !isAdmin(authUser)) {
      return res.status(403).json({ success: false, message: 'تنها مدیران سیستم مجاز به حذف گزارشات هستند.' });
    }
    const deleted = await centralDb.deleteProblemReport(req.params.id);
    res.json({ success: deleted, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// Settings
// ----------------------------------------------------
apiRouter.get('/settings', requirePermission(ModuleName.SETTINGS, PermissionAction.VIEW), (req: Request, res: Response) => {
  res.json({ settings: centralDb.getState().settings });
});

apiRouter.put('/settings', sensitiveLimiter, requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const updated = await centralDb.updateSettings(req.body);
    res.json({ success: true, settings: updated, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// Enterprise Backup & Restore Endpoints (RBAC Enforced)
// ----------------------------------------------------

// 1. List all backups
apiRouter.get('/backups', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (authUser && !isAdmin(authUser)) {
      return res.status(403).json({ success: false, message: 'تنها مدیران ارشد سیستم مجاز به دسترسی به پشتیبان‌ها هستند.' });
    }
    const backups = backupService.listBackups();
    res.json({ success: true, backups });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Health & Diagnostics Summary
apiRouter.get('/backups/health', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (authUser && !isAdmin(authUser)) {
      return res.status(403).json({ success: false, message: 'تنها مدیران ارشد سیستم مجاز به دسترسی به گزارش سلامت بکاپ هستند.' });
    }
    const health = backupService.getHealthSummary();
    res.json({ success: true, health });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Automatic Backup Schedule Settings
apiRouter.get('/backups/schedule', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (authUser && !isAdmin(authUser)) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز.' });
    }
    const schedule = backupService.getScheduleSettings();
    res.json({ success: true, schedule });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/backups/schedule', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (authUser && !isAdmin(authUser)) {
      return res.status(403).json({ success: false, message: 'تنها مدیران سیستم مجاز به تغییر زمان‌بندی پشتیبان‌گیری هستند.' });
    }
    const updated = backupService.updateScheduleSettings(req.body);
    res.json({ success: true, schedule: updated, message: 'تنظیمات زمان‌بندی پشتیبان‌گیری خودکار با موفقیت ذخیره شد.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Create Full Backup Manually
apiRouter.post('/backups/create', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    if (authUser && !isAdmin(authUser)) {
      return res.status(403).json({ success: false, message: 'تنها مدیران ارشد سیستم مجاز به تولید بکاپ هستند.' });
    }

    const { notes } = req.body || {};
    const meta = await backupService.createFullBackup({
      type: BackupType.MANUAL,
      operator: authUser,
      notes,
    });

    res.status(201).json({
      success: true,
      backup: meta,
      message: `پشتیبان جامع سیستم "${meta.filename}" با حجم ${meta.sizeFormatted} با موفقیت ایجاد شد.`,
    });
  } catch (err: any) {
    console.error('Backup creation endpoint error:', err);
    res.status(500).json({ success: false, message: err.message || 'خطا در ایجاد فایل پشتیبان' });
  }
});

// 5. Verify Backup Integrity
apiRouter.get('/backups/:id/verify', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (authUser && !isAdmin(authUser)) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز.' });
    }

    const pkg = backupService.getBackupPackage(req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'فایل پشتیبان مورد نظر یافت نشد.' });
    }

    const result = backupService.verifyBackupPackage(pkg);
    res.json({ success: true, verification: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Download Full Backup Package (Protected Endpoint)
apiRouter.get('/backups/:id/download', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (authUser && !isAdmin(authUser)) {
      return res.status(403).json({ success: false, message: 'تنها مدیران ارشد سیستم مجاز به دانلود فایل پشتیبان هستند.' });
    }

    const backupInfo = backupService.getBackupById(req.params.id);
    if (!backupInfo) {
      return res.status(404).json({ success: false, message: 'فایل پشتیبان یافت نشد.' });
    }

    const pkg = backupService.getBackupPackage(req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'بسته فایل پشتیبان قابل خواندن نیست.' });
    }

    const filename = backupInfo.meta.filename;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(pkg, null, 2));
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Delete Backup File
apiRouter.delete('/backups/:id', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (authUser && !isAdmin(authUser)) {
      return res.status(403).json({ success: false, message: 'تنها مدیران ارشد سیستم مجاز به حذف پشتیبان هستند.' });
    }

    const deleted = await backupService.deleteBackup(req.params.id, authUser);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'فایل پشتیبان یافت نشد یا حذف ناموفق بود.' });
    }

    res.json({ success: true, message: 'فایل پشتیبان با موفقیت از سرور حذف شد.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Restore System from Backup
apiRouter.post('/backups/:id/restore', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    if (!authUser || !isAdmin(authUser)) {
      return res.status(403).json({ success: false, message: 'تنها مدیران ارشد دارای صلاحیت مجاز به بازگردانی سیستم هستند.' });
    }

    const { confirmPhrase } = req.body || {};
    if (confirmPhrase !== 'RESTORE_CONFIRMED' && confirmPhrase !== 'RESTORE_MMBA') {
      return res.status(400).json({
        success: false,
        message: 'جهت جلوگیری از خطای ناخواسته، تاییدیه امنیتی معتبر الزامی است.',
      });
    }

    const result = await backupService.restoreBackup(req.params.id, authUser);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        result,
        message: result.message,
      });
    }

    res.json({
      success: true,
      result,
      message: result.message,
    });
  } catch (err: any) {
    console.error('Restore endpoint error:', err);
    res.status(500).json({ success: false, message: err.message || 'خطا در عملیات بازگردانی سیستم' });
  }
});

// 8. Upload Full System Backup Package
apiRouter.post('/backups/upload', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    if (!isAdmin(authUser)) {
      return res.status(403).json({ success: false, message: 'تنها مدیران ارشد مجاز به آپلود بسته پشتیبان هستند.' });
    }

    const packageData = req.body;
    if (!packageData || !packageData.database) {
      return res.status(400).json({ success: false, message: 'فایل ارسالی فاقد ساختار پایگاه داده است.' });
    }

    const savedBackup = await backupService.saveUploadedBackupPackage(packageData, authUser);
    res.json({
      success: true,
      message: `بسته پشتیبان "${savedBackup.filename}" با موفقیت دریافت و ثبت گردید.`,
      backup: savedBackup,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'خطا در آپلود بسته پشتیبان' });
  }
});

// 9. Legacy / Simple JSON Export & Import (Backward Compatibility)
apiRouter.get('/backup/export', sensitiveLimiter, requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), (req: Request, res: Response) => {
  const state = centralDb.getState();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=mmba_backup_${Date.now()}.json`);
  res.send(JSON.stringify(state, null, 2));
});

apiRouter.post('/backup/import', sensitiveLimiter, requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), async (req: Request, res: Response) => {
  try {
    const imported = await centralDb.importFullDatabase(req.body);
    res.json({ success: true, revision: imported.revision, message: 'بانک اطلاعاتی با موفقیت بازیابی شد.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// 10. MMBA Accounting Foundation Endpoints
// ----------------------------------------------------
apiRouter.get('/accounts', requirePermission(ModuleName.PAYMENTS, PermissionAction.VIEW), (req: Request, res: Response) => {
  try {
    const accounts = centralDb.getAccounts();
    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/accounts', requirePermission(ModuleName.PAYMENTS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const saved = await centralDb.saveAccount(req.body);
    const authUser = await getAuthUser(req);
    await centralDb.logAudit({
      userId: authUser?.id || 'system',
      userName: authUser?.name || 'کاربر سیستم',
      userRole: authUser?.role || UserRole.SUPER_ADMIN,
      action: 'ثبت / ویرایش حساب کل یا معین',
      module: ModuleName.PAYMENTS,
      targetId: saved.id,
      targetType: 'ACCOUNT',
      details: `حساب ${saved.name} (کد: ${saved.code}) ثبت/ویرایش گردید.`,
      ipAddress: req.ip,
    });
    res.json(saved);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/accounts/:id', requirePermission(ModuleName.PAYMENTS, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const deleted = await centralDb.deleteAccount(req.params.id);
    const authUser = await getAuthUser(req);
    if (deleted) {
      await centralDb.logAudit({
        userId: authUser?.id || 'system',
        userName: authUser?.name || 'کاربر سیستم',
        userRole: authUser?.role || UserRole.SUPER_ADMIN,
        action: 'حذف حساب حسابداری',
        module: ModuleName.PAYMENTS,
        targetId: req.params.id,
        targetType: 'ACCOUNT',
        details: `حساب ${req.params.id} از کدینگ حساب‌ها حذف شد.`,
        ipAddress: req.ip,
      });
    }
    res.json({ success: deleted });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.get('/journal-entries', requirePermission(ModuleName.PAYMENTS, PermissionAction.VIEW), (req: Request, res: Response) => {
  try {
    const entries = centralDb.getJournalEntries();
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/journal-entries/:id', requirePermission(ModuleName.PAYMENTS, PermissionAction.VIEW), (req: Request, res: Response) => {
  try {
    const entry = centralDb.findJournalEntryById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'سند حسابداری یافت نشد.' });
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/journal-entries', requirePermission(ModuleName.PAYMENTS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const { entry, lines } = req.body;
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    const entryData = {
      ...(entry || req.body),
      created_by: authUser?.id || 'usr-admin',
      created_by_name: authUser?.name || 'مدیر سیستم',
    };
    const linesData = lines || req.body.lines || [];
    const saved = await centralDb.saveJournalEntry(entryData, linesData);
    if (authUser) {
      await centralDb.logAudit({
        userId: authUser.id,
        userName: authUser.name || 'کاربر سیستم',
        userRole: authUser.role || UserRole.SUPER_ADMIN,
        action: 'ثبت سند حسابداری',
        module: ModuleName.PAYMENTS,
        targetId: saved.id,
        targetType: 'JOURNAL_ENTRY',
        details: `سند حسابداری ${saved.entry_number} با بدهکار ${saved.totalDebit} و بستانکار ${saved.totalCredit} ثبت شد.`,
        ipAddress: req.ip,
      });
    }
    res.json(saved);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.get('/accounting-periods', requirePermission(ModuleName.PAYMENTS, PermissionAction.VIEW), (req: Request, res: Response) => {
  try {
    const periods = centralDb.getAccountingPeriods();
    res.json(periods);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/accounting-periods', requirePermission(ModuleName.PAYMENTS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const saved = await centralDb.saveAccountingPeriod(req.body);
    res.json(saved);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// 11. Internal Document Sharing & Assignment Endpoints
// ----------------------------------------------------
apiRouter.get('/document-shares', requirePermission(ModuleName.CUSTOMERS, PermissionAction.VIEW), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    const { userId, limit, offset, status, onlyUnread } = req.query;
    let shares = centralDb.getDocumentShares();
    const targetId = String(userId || '') || authUser?.id || 'usr-admin';
    shares = shares.filter((s) => (s.recipient_user_id === targetId || s.recipientUserId === targetId));
    if (onlyUnread === 'true') shares = shares.filter((s) => String(s.status) === 'SENT');
    if (status) shares = shares.filter((s) => String(s.status) === String(status));
    shares.sort((a, b) => new Date(b.shared_at || b.sharedAt).getTime() - new Date(a.shared_at || a.sharedAt).getTime());
    const total = shares.length;
    const start = Math.min(parseInt(String(offset || '0'), 10) || 0, total);
    const lim = limit ? parseInt(String(limit), 10) || 25 : total;
    const end = Math.min(start + lim, total);
    const page = shares.slice(start, end);
    res.json({ success: true, shares: page, total, limit: lim, offset: start });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/document-shares', requirePermission(ModuleName.CUSTOMERS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    const { documentId, recipientUsers, message, customerId, customerName, documentFileName, documentFileSize, documentFileType } = req.body;

    if (!documentId) {
      return res.status(400).json({ success: false, message: 'شناسه سند الزامی است.' });
    }
    if (!recipientUsers || !Array.isArray(recipientUsers) || recipientUsers.length === 0) {
      return res.status(400).json({ success: false, message: 'حداقل یک گیرنده سازمانی باید انتخاب شود.' });
    }

    const shares = await centralDb.createDocumentShares({
      documentId,
      senderUser: { id: authUser?.id || 'usr-admin', name: authUser?.name || 'مدیر سیستم' },
      recipientUsers,
      message,
      customerId,
      customerName,
      documentFileName,
      documentFileSize,
      documentFileType,
    });

    res.json({ success: true, shares });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.put('/document-shares/:id/read', requirePermission(ModuleName.CUSTOMERS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    const updated = await centralDb.markDocumentShareRead(req.params.id, authUser?.id || '');
    res.json({ success: true, share: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.put('/document-shares/:id/archive', requirePermission(ModuleName.CUSTOMERS, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    const updated = await centralDb.archiveDocumentShare(req.params.id, authUser?.id || '');
    res.json({ success: true, share: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// 11b. Internal Chat Endpoints (Sprint 03 Patch 05)
// ----------------------------------------------------
function isConversationMember(userId: string, conversation: any, userRole?: string): boolean {
  if (!conversation) return false;
  if ((conversation.member_ids || []).includes(userId)) return true;
  const adminRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GOD, 'ADMIN'];
  if (userRole && adminRoles.includes(userRole as any)) return true;
  return false;
}

apiRouter.get('/conversations', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const result = centralDb.getConversationsForUser(authUser.id);
    res.json({ success: true, conversations: result.conversations, unreadCount: result.unreadCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin endpoint: List all conversations across the organization with stats
apiRouter.get('/conversations/admin', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const adminRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GOD, 'ADMIN'];
    const isAdmin = adminRoles.includes(authUser.role as any);
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'فقط مدیران سیستم به پنل نظارت پیام‌ها دسترسی دارند.' });
    }

    const { search, type, priority, archived } = req.query;
    const conversations = centralDb.getAllConversationsForAdmin({
      search: search ? String(search) : undefined,
      type: type ? String(type) : undefined,
      priority: priority ? String(priority) : undefined,
      archived: archived !== undefined ? archived === 'true' : undefined,
    });

    res.json({ success: true, conversations, count: conversations.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/conversations', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const { recipientUserId, recipientUserName } = req.body;
    if (!recipientUserId) return res.status(400).json({ success: false, message: 'کاربر گیرنده الزامی است.' });
    const recipient = centralDb.findUserById(recipientUserId);
    const conversation = await centralDb.getOrCreateDirectConversation(
      authUser.id, recipientUserId,
      authUser.name, recipient?.name || recipientUserName || 'کاربر'
    );
    await centralDb.logAudit({
      userId: authUser.id, userName: authUser.name, userRole: authUser.role,
      action: 'ایجاد گفتگوی داخلی', module: ModuleName.CHAT, entityType: 'CONVERSATION',
      targetId: conversation.id,
      details: `ایجاد گفتگوی مستقیم بین ${authUser.name} و ${recipient?.name || recipientUserName || ''}`,
    });
    res.json({ success: true, conversation });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stage 2: Create Group Conversation
apiRouter.post('/conversations/group', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const { title, memberIds, groupImageUrl, priority } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'عنوان گروه الزامی است.' });
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ success: false, message: 'انتخاب حداقل یک عضو برای گروه الزامی است.' });
    }

    const conversation = await centralDb.createGroupConversation(
      authUser.id,
      authUser.name,
      title.trim(),
      memberIds,
      groupImageUrl,
      priority
    );

    // Notify added members
    const now = new Date().toISOString();
    memberIds.forEach((mid: string) => {
      if (mid === authUser.id) return;
      centralDb.saveNotification({
        id: `notif-grp-${Date.now()}-${mid}`,
        userId: mid,
        title: 'عضویت در گروه گفتگو',
        message: `شما به گروه "${title}" توسط ${authUser.name} اضافه شدید.`,
        category: 'SYSTEM',
        severity: 'INFO',
        read: false,
        createdAt: now,
        relatedEntityType: 'CHAT',
        relatedEntityId: conversation.id,
      }).catch(() => {});
    });

    await centralDb.logAudit({
      userId: authUser.id, userName: authUser.name, userRole: authUser.role,
      action: 'ایجاد گروه گفتگوی تیمی', module: ModuleName.CHAT, entityType: 'CONVERSATION',
      targetId: conversation.id,
      details: `ایجاد گروه "${title}" با ${memberIds.length + 1} عضو`,
    });

    res.json({ success: true, conversation });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stage 2: Add member to group
apiRouter.post('/conversations/:id/members', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const conversation = centralDb.getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'گفتگو یافت نشد' });
    if (!isConversationMember(authUser.id, conversation, authUser.role)) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز.' });
    }

    const { userId, role } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'شناسه کاربر الزامی است.' });
    const targetUser = centralDb.findUserById(userId);
    const updated = await centralDb.addGroupMember(
      req.params.id,
      userId,
      targetUser?.name || 'کاربر جدید',
      role || 'MEMBER'
    );

    await centralDb.logAudit({
      userId: authUser.id, userName: authUser.name, userRole: authUser.role,
      action: 'افزودن عضو به گروه گفتگو', module: ModuleName.CHAT, entityType: 'CONVERSATION',
      targetId: req.params.id,
      details: `افزودن ${targetUser?.name || userId} به گفتگو توسط ${authUser.name}`,
    });

    res.json({ success: true, conversation: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stage 2: Remove member from group
apiRouter.delete('/conversations/:id/members/:userId', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const conversation = centralDb.getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'گفتگو یافت نشد' });
    if (!isConversationMember(authUser.id, conversation, authUser.role)) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز.' });
    }

    const updated = await centralDb.removeGroupMember(req.params.id, req.params.userId);
    res.json({ success: true, conversation: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stage 1 & 2: Update Conversation (Priority, Name, Description)
apiRouter.patch('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const conversation = centralDb.getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'گفتگو یافت نشد' });
    if (!isConversationMember(authUser.id, conversation, authUser.role)) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز.' });
    }

    const updated = await centralDb.updateConversation(req.params.id, req.body);
    res.json({ success: true, conversation: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stage 1: Pin / Unpin Conversation
apiRouter.post('/conversations/:id/pin', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const conversation = centralDb.getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'گفتگو یافت نشد' });

    const updated = await centralDb.toggleConversationPin(req.params.id, authUser.id);
    res.json({ success: true, conversation: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stage 1: Set Conversation Priority
apiRouter.post('/conversations/:id/priority', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const conversation = centralDb.getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'گفتگو یافت نشد' });

    const { priority } = req.body;
    const updated = await centralDb.setConversationPriority(req.params.id, priority);
    res.json({ success: true, conversation: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Super Admin: Delete conversation
apiRouter.delete('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const adminRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GOD, 'ADMIN'];
    if (!adminRoles.includes(authUser.role as any)) {
      return res.status(403).json({ success: false, message: 'فقط مدیران ارشد مجاز به حذف گفتگو هستند.' });
    }

    const deleted = await centralDb.deleteConversationBySuperAdmin(req.params.id);
    await centralDb.logAudit({
      userId: authUser.id, userName: authUser.name, userRole: authUser.role,
      action: 'حذف کامل گفتگو توسط مدیر', module: ModuleName.CHAT, entityType: 'CONVERSATION',
      targetId: req.params.id, details: `حذف گفتگو ${req.params.id}`,
    });

    res.json({ success: deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const conversation = centralDb.getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'گفتگو یافت نشد' });
    if (!isConversationMember(authUser.id, conversation, authUser.role)) return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز به گفتگو.' });
    const before = req.query.before as string | undefined;
    const limitNum = req.query.limit ? parseInt(String(req.query.limit), 10) || 50 : 50;
    let messages = centralDb.getChatMessagesByConversation(req.params.id);
    if (before) {
      const bi = messages.findIndex((m) => m.id === before);
      if (bi >= 0) messages = messages.slice(0, bi);
    }
    const page = messages.slice(Math.max(0, messages.length - limitNum));
    res.json({ success: true, messages: page, total: messages.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const conversation = centralDb.getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'گفتگو یافت نشد' });
    if (!isConversationMember(authUser.id, conversation, authUser.role)) return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز به گفتگو.' });
    const body = { ...(req.body || {}), conversation_id: req.params.id, conversationId: req.params.id, sender_user_id: authUser.id, senderUserId: authUser.id, sender_user_name: authUser.name, senderUserName: authUser.name };
    const message = await centralDb.sendChatMessage(body);
    // Notify other members via in-app notification
    const now = new Date().toISOString();
    (conversation.member_ids || []).forEach((mid) => {
      if (mid === authUser.id) return;
      centralDb.saveNotification({
        id: `notif-chat-${Date.now()}-${mid}`,
        userId: mid,
        title: 'پیام جدید',
        message: `${authUser.name}: ${(body.body || '')?.slice(0, 160)}`,
        category: 'SYSTEM',
        severity: 'INFO',
        read: false,
        createdAt: now,
        relatedEntityType: 'CHAT',
        relatedEntityId: conversation.id,
      }).catch(() => {});
    });
    await centralDb.logAudit({
      userId: authUser.id, userName: authUser.name, userRole: authUser.role,
      action: 'ارسال پیام داخلی', module: ModuleName.CHAT, entityType: 'CHAT_MESSAGE',
      targetId: message.id, details: `پیام در گفتگو ${conversation.id}`, targetType: 'CHAT',
    });
    res.json({ success: true, message, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stage 1: Soft Delete Message (with Deletion Reason & Audit)
apiRouter.delete('/conversations/:id/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const conversation = centralDb.getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'گفتگو یافت نشد' });
    if (!isConversationMember(authUser.id, conversation, authUser.role)) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز.' });
    }

    const { reason } = req.body || {};
    const updated = await centralDb.softDeleteChatMessage(
      req.params.messageId,
      authUser.id,
      authUser.name,
      reason
    );
    if (!updated) return res.status(404).json({ success: false, message: 'پیام یافت نشد' });

    await centralDb.logAudit({
      userId: authUser.id, userName: authUser.name, userRole: authUser.role,
      action: 'حذف پیام گفتگو (Soft Delete)', module: ModuleName.CHAT, entityType: 'CHAT_MESSAGE',
      targetId: req.params.messageId, details: `دلیل: ${reason || 'ثبت نشده'}`,
    });

    res.json({ success: true, message: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stage 1: Edit Message
apiRouter.put('/conversations/:id/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const { body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ success: false, message: 'متن پیام الزامی است.' });

    const updated = await centralDb.editChatMessage(req.params.messageId, authUser.id, body.trim());
    if (!updated) return res.status(403).json({ success: false, message: 'امکان ویرایش این پیام وجود ندارد.' });

    res.json({ success: true, message: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stage 2: Link Document Engine Attachment to Message
apiRouter.post('/conversations/:id/messages/:messageId/attachments', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const { documentId } = req.body;
    if (!documentId) return res.status(400).json({ success: false, message: 'شناسه سند الزامی است.' });

    const att = await centralDb.attachDocumentToMessage(req.params.messageId, documentId);
    if (!att) return res.status(404).json({ success: false, message: 'پیام یا سند یافت نشد.' });

    res.json({ success: true, attachment: att });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/conversations/:id/read', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const conversation = await centralDb.markChatConversationRead(req.params.id, authUser.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'گفتگو یافت نشد' });
    res.json({ success: true, conversation, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/conversations/:id/archive', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const conversation = await centralDb.archiveConversation(req.params.id, authUser.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'گفتگو یافت نشد' });
    res.json({ success: true, conversation, revision: centralDb.getRevisionInfo().revision });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// 11c. Broadcasts Endpoints (Stage 3)
// ----------------------------------------------------
apiRouter.post('/broadcasts', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const adminRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GOD, 'ADMIN'];
    if (!adminRoles.includes(authUser.role as any)) {
      return res.status(403).json({ success: false, message: 'فقط مدیران سیستم مجاز به ارسال پیام همگانی هستند.' });
    }

    const { title, body, targetType, recipientUserIds } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: 'متن پیام همگانی الزامی است.' });
    }

    let targetIds: string[] = [];
    if (targetType === 'SELECTED') {
      if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
        return res.status(400).json({ success: false, message: 'حداقل یک کاربر گیرنده باید انتخاب شود.' });
      }
      targetIds = recipientUserIds;
    } else {
      // ALL active users
      targetIds = (centralDb.getState().users || [])
        .filter((u: any) => u.status !== UserStatus.INACTIVE && u.status !== UserStatus.SUSPENDED)
        .map((u: any) => u.id);
    }

    const result = await centralDb.createBroadcast(
      authUser.id,
      authUser.name,
      title || 'اطلاعیه رسمی سامانه',
      body.trim(),
      targetType || 'ALL',
      targetIds
    );

    await centralDb.logAudit({
      userId: authUser.id, userName: authUser.name, userRole: authUser.role,
      action: 'ارسال پیام همگانی سیستمی', module: ModuleName.CHAT, entityType: 'BROADCAST',
      targetId: result.broadcast.id,
      details: `پیام همگانی "${title}" به ${targetIds.length} کاربر ارسال شد.`,
    });

    res.json({ success: true, broadcast: result.broadcast, recipientCount: result.recipients.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/broadcasts', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const broadcasts = centralDb.getBroadcastsForAdmin();
    res.json({ success: true, broadcasts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/broadcasts/:id', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const result = centralDb.getBroadcastById(req.params.id);
    if (!result.broadcast) return res.status(404).json({ success: false, message: 'پیام همگانی یافت نشد' });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/broadcasts/:id/read', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    const updated = await centralDb.markBroadcastRead(req.params.id, authUser.id);
    res.json({ success: true, marked: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// 12. Registered SIM Holders Endpoints (افراد ثبت‌کننده سیم‌کارت)
// ----------------------------------------------------
apiRouter.get('/registered-holders', requirePermission(ModuleName.SIM_INVENTORY, PermissionAction.VIEW), (req: Request, res: Response) => {
  try {
    const holders = centralDb.getRegisteredHolders();
    // Compute current active SIMs count per holder
    const sims = centralDb.getState().sims || [];
    const enriched = holders.map((h) => {
      const activeCount = sims.filter((s) => s.registeredHolderId === h.id && s.status !== 'SUSPENDED').length;
      return {
        ...h,
        activeSimCount: activeCount,
        maxCapacity: 10,
        remainingCapacity: Math.max(0, 10 - activeCount),
        isAtCapacity: activeCount >= 10,
      };
    });
    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/registered-holders', requirePermission(ModuleName.SIM_INVENTORY, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    const data = req.body || {};
    const fullName = (data.fullName || data.name || '').trim();
    const nationalId = (data.nationalId || data.nationalCode || '').trim();
    const mobile = (data.mobile || data.phone || '').trim();

    if (!fullName || !nationalId || !mobile) {
      return res.status(400).json({ success: false, message: 'نام و نام خانوادگی، کد ملی و شماره همراه الزامی است.' });
    }

    const saved = await centralDb.saveRegisteredHolder({
      ...data,
      fullName,
      nationalId,
      mobile,
      createdBy: data.createdBy || authUser?.id || 'usr-admin',
    });

    res.json({ success: true, holder: saved });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/registered-holders/:id', requirePermission(ModuleName.SIM_INVENTORY, PermissionAction.ARCHIVE), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    // Enforce Manager role check: Only managers / admins can delete registered holders
    const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GOD, 'ADMIN'];
    const isManager = authUser && (allowedRoles.includes(authUser.role) || (authUser.role as string) === 'SUPER_ADMIN');
    
    if (!isManager) {
      return res.status(403).json({
        success: false,
        message: 'فقط مدیران ارشد و سرپرست سامانه مجاز به حذف افراد ثبت‌کننده سیم‌کارت هستند.'
      });
    }

    const { reason } = req.body || {};
    const result = await centralDb.deleteRegisteredHolder(
      req.params.id,
      authUser?.name || authUser?.id || 'مدیر سامانه',
      reason
    );

    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/registered-holders/:id/id-card', requirePermission(ModuleName.SIM_INVENTORY, PermissionAction.EDIT), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { imageDataUrl, fileName, fileType, sizeBytes } = req.body || {};
    if (!imageDataUrl) {
      return res.status(400).json({ success: false, message: 'تصویر کارت ملی الزامی است.' });
    }

    const holders = centralDb.getRegisteredHolders();
    const holder = holders.find((h) => h.id === id);
    if (!holder) {
      return res.status(404).json({ success: false, message: 'مالک سیم‌کارت یافت نشد.' });
    }

    const updated = await centralDb.saveRegisteredHolder({
      ...holder,
      nationalIdImageUrl: imageDataUrl,
      nationalIdImageName: fileName || holder.nationalIdImageName || `idcard_${holder.nationalId || holder.id}.jpg`,
      nationalIdImageType: fileType || holder.nationalIdImageType || 'image/jpeg',
      nationalIdImageSize: sizeBytes || Math.round(imageDataUrl.length * 0.75),
    });

    res.json({ success: true, holder: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/registered-holders/:id/id-card', requirePermission(ModuleName.SIM_INVENTORY, PermissionAction.VIEW), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const holders = centralDb.getRegisteredHolders();
    const holder = holders.find((h) => h.id === id);
    if (!holder || !holder.nationalIdImageUrl) {
      return res.status(404).json({ success: false, message: 'تصویر کارت ملی برای این مالک ثبت نشده است.' });
    }

    res.json({
      success: true,
      holderId: holder.id,
      holderName: holder.fullName,
      nationalId: holder.nationalId,
      fileName: holder.nationalIdImageName,
      fileType: holder.nationalIdImageType,
      sizeBytes: holder.nationalIdImageSize,
      dataUrl: holder.nationalIdImageUrl,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// 13. Contract Installments & Finance Referral Endpoints
// ----------------------------------------------------
apiRouter.get('/contract-installments', requirePermission(ModuleName.CONTRACTS, PermissionAction.VIEW), (req: Request, res: Response) => {
  try {
    const contractId = req.query.contractId as string | undefined;
    const installments = centralDb.getContractInstallments(contractId);
    res.json(installments);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/contract-installments', requirePermission(ModuleName.CONTRACTS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  try {
    const saved = await centralDb.saveContractInstallment(req.body);
    res.json({ success: true, installment: saved });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.post('/contract-installments/:id/payments', requirePermission(ModuleName.PAYMENTS, PermissionAction.VERIFY), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    const installmentId = req.params.id;
    const paymentData = req.body;

    const result = await centralDb.recordInstallmentPayment(installmentId, {
      ...paymentData,
      recordedByUserId: authUser?.id,
      recordedByUserName: authUser?.name,
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Review by Finance Manager / ارجاع به مدیر مالی
apiRouter.post('/payments/:id/finance-review', requirePermission(ModuleName.PAYMENTS, PermissionAction.VERIFY), async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    const { status, notes } = req.body;
    const payment = (centralDb.getState().payments || []).find((p) => p.id === req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'رسید پرداخت یافت نشد' });
    }

    const updatedPayment: Payment = {
      ...payment,
      financeReviewStatus: status || 'REVIEWED',
      financeNotes: notes || '',
      financeReviewedBy: authUser?.name || 'مدیر مالی',
      financeReviewedAt: new Date().toISOString(),
    };

    await centralDb.savePayment(updatedPayment);
    res.json({ success: true, payment: updatedPayment });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// 14. Biometric WebAuthn & Trusted Devices Endpoints
// ----------------------------------------------------
apiRouter.get('/biometrics/devices', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    const userId = (req.query.userId as string) || authUser?.id;
    const devices = centralDb.getTrustedBiometricDevices(userId);
    res.json(devices);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/biometrics/register', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req) || centralDb.findUserById('usr-admin');
    const { credentialId, deviceName, deviceType, publicKey } = req.body;
    if (!credentialId) {
      return res.status(400).json({ success: false, message: 'شناسه امنیتی دستگاه الزامی است.' });
    }

    const savedDevice = await centralDb.registerBiometricDevice({
      id: `bio-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: authUser?.id || 'usr-admin',
      credentialId,
      deviceName: deviceName || 'دستگاه قابل اعتماد بیومتریک',
      deviceType: deviceType || 'FINGERPRINT',
      publicKey,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      isRevoked: false,
    });

    res.json({ success: true, device: savedDevice });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/biometrics/devices/:id', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    const revoked = await centralDb.revokeBiometricDevice(req.params.id, authUser?.id);
    if (!revoked) {
      return res.status(404).json({ success: false, message: 'دستگاه یافت نشد یا مجاز به ابطال نیستید' });
    }
    res.json({ success: true, message: 'دستگاه بیومتریک ابطال گردید' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Biometric Challenge
apiRouter.post('/auth/biometric-challenge', (req: Request, res: Response) => {
  const challenge = Buffer.from(Date.now().toString() + '-' + Math.random().toString()).toString('base64');
  res.json({ challenge });
});

// Biometric Login Verify
apiRouter.post('/auth/biometric-login', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.body;
    if (!credentialId) {
      return res.status(400).json({ success: false, message: 'شناسه اعتبارسنجی بیومتریک ارسال نشده است.' });
    }

    const device = centralDb.findBiometricDeviceByCredentialId(credentialId);
    if (!device) {
      return res.status(401).json({
        success: false,
        message: 'دستگاه بیومتریک ثبت‌نشده یا ابطال شده است. لطفاً ابتدا با نام کاربری و رمز عبور وارد شوید.'
      });
    }

    const user = centralDb.findUserById(device.userId);
    if (!user || user.status === UserStatus.INACTIVE || user.status === UserStatus.SUSPENDED) {
      return res.status(403).json({ success: false, message: 'حساب کاربری کاربر غیرفعال یا معلق است.' });
    }

    await centralDb.updateBiometricDeviceLastUsed(credentialId);

    const token = auth.signToken(user.id, user.tokenVersion);
    const now = new Date().toISOString();
    const updatedUser = { ...user, lastLoginAt: now };
    await centralDb.saveUser(updatedUser);

    res.json({
      success: true,
      token,
      user: sanitizeUser(updatedUser),
      message: 'ورود موفق با احراز هویت بیومتریک',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});



