import { ModuleName, PermissionAction, Permission, Role, User, UserRole, Task } from '../types';

// Small helper to build a Permission entry concisely
const mod = (module: ModuleName, ...actions: PermissionAction[]): Permission => ({ module, actions });

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'role-god',
    name: UserRole.GOD,
    titleFa: 'دسترسی مطلق (GOD / نامحدود)',
    titleEn: 'GOD / Supreme Master',
    descriptionFa: 'دسترسی نامحدود، مطلق و بی‌قید و شرط به تمام داده‌ها، ماژول‌ها، اسناد مالی، تنظیمات، لاگ‌ها، کاربران و پایگاه‌های داده سیستم.',
    descriptionEn: 'Supreme all-access pass to every module, permission, transaction, and system configuration.',
    permissions: Object.values(ModuleName).map((mod) => ({
      module: mod,
      actions: Object.values(PermissionAction),
    })),
  },
  {
    id: 'role-owner',
    name: UserRole.OWNER,
    titleFa: 'مالک / مدیر ارشد',
    titleEn: 'Owner & Executive Director',
    descriptionFa: 'دسترسی کامل و بدون محدودیت به تمام ماژول‌ها، تنظیمات، تراکنش‌های مالی و گزارشات راهبردی.',
    descriptionEn: 'Full unconstrained access to all operational, financial, and administrative domains.',
    permissions: Object.values(ModuleName).map((mod) => ({
      module: mod,
      actions: Object.values(PermissionAction),
    })),
  },
  {
    id: 'role-supervisor',
    name: UserRole.SUPERVISOR,
    titleFa: 'سرپرست عملیات',
    titleEn: 'Operations Supervisor',
    descriptionFa: 'مدیریت تیم‌ها، نظارت بر تماس‌ها، وظایف، عملیات فروشگاه و بازبینی گزارش‌ها.',
    descriptionEn: 'Supervision of operational workflows, staff tasks, calls, and performance audits.',
    permissions: [
      { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.EXPORT] },
      { module: ModuleName.LEADS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.EXPORT] },
      { module: ModuleName.CALLS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.EXPORT] },
      { module: ModuleName.TASKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.ARCHIVE, PermissionAction.APPROVE] },
      { module: ModuleName.CONTRACTS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.PAYMENTS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.VERIFY] },
      { module: ModuleName.CHECKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
      { module: ModuleName.SIM_INVENTORY, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.MANAGE] },
      { module: ModuleName.REPAIRS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.APPROVE] },
      { module: ModuleName.REPORTS, actions: [PermissionAction.VIEW, PermissionAction.EXPORT] },
      { module: ModuleName.USERS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.AUDIT_LOGS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.SETTINGS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.NOTES, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.CHAT, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
    ],
  },
  {
    id: 'role-accounting',
    name: UserRole.ACCOUNTING_ADMIN,
    titleFa: 'مدیر مالی و حسابداری',
    titleEn: 'Accounting Administrator',
    descriptionFa: 'تأیید و نهایی‌سازی پرداخت‌ها، مدیریت اسناد و چک‌های صیادی، قراردادها و گزارشات مالی.',
    descriptionEn: 'Verification and finalization of financial transactions, checks, and ledger reports.',
    permissions: [
      { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW, PermissionAction.EDIT] },
      { module: ModuleName.LEADS, actions: [PermissionAction.VIEW, PermissionAction.EDIT] },
      { module: ModuleName.CALLS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
      { module: ModuleName.TASKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.CONTRACTS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.FINALIZE, PermissionAction.EXPORT] },
      { module: ModuleName.PAYMENTS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.VERIFY, PermissionAction.FINALIZE, PermissionAction.EXPORT, PermissionAction.MANAGE] },
      { module: ModuleName.CHECKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.FINALIZE, PermissionAction.EXPORT, PermissionAction.MANAGE] },
      { module: ModuleName.REPORTS, actions: [PermissionAction.VIEW, PermissionAction.EXPORT] },
      { module: ModuleName.AUDIT_LOGS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.SETTINGS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.NOTES, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.CHAT, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
    ],
  },
  {
    id: 'role-sales',
    name: UserRole.SALES,
    titleFa: 'کارشناس فروش و ارتباطات',
    titleEn: 'Sales Specialist',
    descriptionFa: 'ثبت مشتریان، ثبت سریع تماس‌ها با صدا، پیگیری لیدها، عقد قرارداد و ثبت پرداخت‌ها.',
    descriptionEn: 'Customer acquisition, lightning call logging, leads nurturing, and draft contracts.',
    permissions: [
      { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.LEADS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.CALLS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.TASKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.CONTRACTS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
      { module: ModuleName.PAYMENTS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
      { module: ModuleName.CHECKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
      { module: ModuleName.SIM_INVENTORY, actions: [PermissionAction.VIEW] },
      { module: ModuleName.REPAIRS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
      { module: ModuleName.NOTES, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.CHAT, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
    ],
  },
  {
    id: 'role-store-ops',
    name: UserRole.STORE_OPERATIONS,
    titleFa: 'مدیر عملیات فروشگاه',
    titleEn: 'Store Operations Officer',
    descriptionFa: 'مدیریت انبار سیم‌کارت، تحویل و دریافت مرسولات، پذیرش تعمیرات و ثبت گزارشات روزانه.',
    descriptionEn: 'SIM stock inventory, customer walk-in services, device intake, and operations logging.',
    permissions: [
      { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.LEADS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.CALLS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
      { module: ModuleName.TASKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.PAYMENTS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
      { module: ModuleName.SIM_INVENTORY, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.MANAGE] },
      { module: ModuleName.REPAIRS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.REPORTS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.NOTES, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.CHAT, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
    ],
  },
  {
    id: 'role-repair-technician',
    name: UserRole.REPAIR_TECHNICIAN,
    titleFa: 'تکنسین تخصصی تعمیرات',
    titleEn: 'Repair Technician',
    descriptionFa: 'عیب‌یابی، ثبت فرآیند تعمیر، قطعات مصرفی، تغییر وضعیت دستگاه و تست نهایی.',
    descriptionEn: 'Device diagnostic workbench, status transitions, parts logging, and delivery validation.',
    permissions: [
      { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.TASKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.REPAIRS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.FINALIZE] },
    ],
  },
  {
    id: 'role-technical',
    name: UserRole.TECHNICAL,
    titleFa: 'کارشناس فنی و شبکه',
    titleEn: 'Technical & Infrastructure Specialist',
    descriptionFa: 'پشتیبانی زیرساخت فنی، تخصیص خطوط، رسیدگی به وظایف سیستمی و عیب‌یابی ارتباطی.',
    descriptionEn: 'System support, technical tasks, network provisioning, and hardware logistics.',
    permissions: [
      { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.TASKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.SIM_INVENTORY, actions: [PermissionAction.VIEW, PermissionAction.EDIT] },
      { module: ModuleName.REPAIRS, actions: [PermissionAction.VIEW, PermissionAction.EDIT] },
      { module: ModuleName.REPORTS, actions: [PermissionAction.VIEW] },
    ],
  },
  {
    id: 'role-finance',
    name: UserRole.FINANCE_MANAGER,
    titleFa: 'مدیر مالی و خزانه‌دار',
    titleEn: 'Finance Manager / Treasurer',
    descriptionFa: 'مدیریت مالی، تأیید و نهایی‌سازی تراکنش‌ها، چک‌ها، قراردادها و گزارش‌های راهبردی مالی. اطلاعات مشتریان را مشاهده و ویرایش می‌کند؛ ایجاد مشتری با مجوز اختصاصی از پنل کاربران فعال می‌شود.',
    descriptionEn: 'Financial control, transaction verification, checks, contracts, and finance reports. Views and edits customer records; customer creation is enabled via per-user grant.',
    permissions: [
      { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW, PermissionAction.EDIT, PermissionAction.EXPORT] },
      { module: ModuleName.LEADS, actions: [PermissionAction.VIEW, PermissionAction.EDIT] },
      { module: ModuleName.CALLS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
      { module: ModuleName.TASKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.CONTRACTS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.FINALIZE, PermissionAction.EXPORT] },
      { module: ModuleName.PAYMENTS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.VERIFY, PermissionAction.FINALIZE, PermissionAction.EXPORT, PermissionAction.MANAGE] },
      { module: ModuleName.CHECKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.FINALIZE, PermissionAction.EXPORT, PermissionAction.MANAGE] },
      { module: ModuleName.SIM_INVENTORY, actions: [PermissionAction.VIEW] },
      { module: ModuleName.REPAIRS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.REPORTS, actions: [PermissionAction.VIEW, PermissionAction.EXPORT] },
      { module: ModuleName.AUDIT_LOGS, actions: [PermissionAction.VIEW] },
    ],
  },
  {
    id: 'role-sales-agent',
    name: UserRole.SALES_AGENT,
    titleFa: 'کارشناس فروش و قرارداد',
    titleEn: 'Sales & Contract Agent',
    descriptionFa: 'ثبت مشتریان و لیدها، ثبت تماس‌ها، صدور و ویرایش قراردادها و ثبت پرداخت‌ها.',
    descriptionEn: 'Customer and lead registration, calls logging, contract drafting, and payment recording.',
    permissions: [
      { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW, PermissionAction.EDIT, PermissionAction.EXPORT] },
      { module: ModuleName.LEADS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.CALLS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.TASKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.CONTRACTS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.PAYMENTS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
      { module: ModuleName.CHECKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
      { module: ModuleName.SIM_INVENTORY, actions: [PermissionAction.VIEW] },
      { module: ModuleName.REPAIRS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
      { module: ModuleName.NOTES, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.CHAT, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
    ],
  },
  {
    id: 'role-technician',
    name: UserRole.TECHNICIAN,
    titleFa: 'تکنسین تعمیرات و سخت‌افزار',
    titleEn: 'Hardware & Repair Technician',
    descriptionFa: 'عیب‌یابی، ثبت فرآیند تعمیر، قطعات مصرفی و تغییر وضعیت دستگاه.',
    descriptionEn: 'Device diagnostic workbench, repairs staging, status transitions, and final validation.',
    permissions: [
      { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.TASKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT] },
      { module: ModuleName.REPAIRS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.FINALIZE] },
    ],
  },
  {
    id: 'role-readonly',
    name: UserRole.READ_ONLY,
    titleFa: 'فقط مشاهده (حسابرس)',
    titleEn: 'Read-Only / Auditor',
    descriptionFa: 'دسترسی فقط‌خواندنی برای مشاهده گزارشات و پرونده‌ها بدون امکان ثبت، ویرایش یا حذف.',
    descriptionEn: 'View-only access to records and reports without create, edit, or delete.',
    permissions: [
      { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.LEADS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.CALLS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.TASKS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.CONTRACTS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.PAYMENTS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.CHECKS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.SIM_INVENTORY, actions: [PermissionAction.VIEW] },
      { module: ModuleName.REPAIRS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.REPORTS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.AUDIT_LOGS, actions: [PermissionAction.VIEW] },
      { module: ModuleName.NOTES, actions: [PermissionAction.VIEW] },
      { module: ModuleName.CHAT, actions: [PermissionAction.VIEW] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Admin UI coarse permission keys -> RBAC module/action mapping
// These are the checkboxes shown in the Admin User Matrix. Stored on
// user.permissions as grant-only overrides (they ADD on top of the role).
// ---------------------------------------------------------------------------
export const PERMISSION_KEYS = {
  VIEW_CUSTOMERS: 'VIEW_CUSTOMERS',
  CREATE_CUSTOMERS: 'CREATE_CUSTOMERS',
  DELETE_CUSTOMERS: 'DELETE_CUSTOMERS',
  VIEW_FINANCES: 'VIEW_FINANCES',
  MANAGE_FINANCES: 'MANAGE_FINANCES',
  MANAGE_CONTRACTS: 'MANAGE_CONTRACTS',
  MANAGE_SIM_CARDS: 'MANAGE_SIM_CARDS',
  MANAGE_REPAIRS: 'MANAGE_REPAIRS',
  VIEW_REPORTS: 'VIEW_REPORTS',
  ADMIN_USERS: 'ADMIN_USERS',
  EXPORT_DATA: 'EXPORT_DATA',
} as const;

export type PermissionKey = keyof typeof PERMISSION_KEYS;

type PermissionKeyRbac = { module: ModuleName; actions: PermissionAction[] }[];

// Each coarse key maps to one or more (module, action) pairs used by hasPermission.
export const PERMISSION_KEY_TO_RBAC: Record<string, PermissionKeyRbac> = {
  [PERMISSION_KEYS.VIEW_CUSTOMERS]: [mod(ModuleName.CUSTOMERS, PermissionAction.VIEW)],
  [PERMISSION_KEYS.CREATE_CUSTOMERS]: [mod(ModuleName.CUSTOMERS, PermissionAction.CREATE, PermissionAction.EDIT)],
  [PERMISSION_KEYS.DELETE_CUSTOMERS]: [mod(ModuleName.CUSTOMERS, PermissionAction.ARCHIVE, PermissionAction.MANAGE)],
  [PERMISSION_KEYS.VIEW_FINANCES]: [mod(ModuleName.PAYMENTS, PermissionAction.VIEW), mod(ModuleName.CHECKS, PermissionAction.VIEW)],
  [PERMISSION_KEYS.MANAGE_FINANCES]: [
    mod(ModuleName.PAYMENTS, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.VERIFY, PermissionAction.FINALIZE),
    mod(ModuleName.CHECKS, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.FINALIZE),
  ],
  [PERMISSION_KEYS.MANAGE_CONTRACTS]: [mod(ModuleName.CONTRACTS, PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.FINALIZE)],
  [PERMISSION_KEYS.MANAGE_SIM_CARDS]: [mod(ModuleName.SIM_INVENTORY, PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.MANAGE)],
  [PERMISSION_KEYS.MANAGE_REPAIRS]: [mod(ModuleName.REPAIRS, PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.MANAGE)],
  [PERMISSION_KEYS.VIEW_REPORTS]: [mod(ModuleName.REPORTS, PermissionAction.VIEW, PermissionAction.EXPORT)],
  [PERMISSION_KEYS.ADMIN_USERS]: [mod(ModuleName.USERS, PermissionAction.VIEW, PermissionAction.MANAGE)],
  [PERMISSION_KEYS.EXPORT_DATA]: [
    mod(ModuleName.CUSTOMERS, PermissionAction.EXPORT),
    mod(ModuleName.CONTRACTS, PermissionAction.EXPORT),
    mod(ModuleName.REPORTS, PermissionAction.EXPORT),
  ],
};

// Default permission keys pre-selected when a role is chosen in the AdminUserMatrix.
export function getPermissionKeysForRole(role: UserRole | string): string[] {
  const r = String(role || '');
  if (isAdminLikeRole(r)) {
    return Object.values(PERMISSION_KEYS);
  }
  const base = [PERMISSION_KEYS.VIEW_CUSTOMERS, PERMISSION_KEYS.CREATE_CUSTOMERS, PERMISSION_KEYS.MANAGE_CONTRACTS];
  switch (r) {
    case UserRole.FINANCE_MANAGER:
    case UserRole.ACCOUNTING_ADMIN:
      return [PERMISSION_KEYS.VIEW_CUSTOMERS, PERMISSION_KEYS.VIEW_FINANCES, PERMISSION_KEYS.MANAGE_FINANCES, PERMISSION_KEYS.MANAGE_CONTRACTS, PERMISSION_KEYS.VIEW_REPORTS];
    case UserRole.SALES:
    case UserRole.SALES_AGENT:
    case UserRole.STORE_OPERATIONS:
      return [PERMISSION_KEYS.VIEW_CUSTOMERS, PERMISSION_KEYS.CREATE_CUSTOMERS, PERMISSION_KEYS.MANAGE_CONTRACTS, PERMISSION_KEYS.MANAGE_SIM_CARDS];
    case UserRole.REPAIR_TECHNICIAN:
    case UserRole.TECHNICIAN:
      return [PERMISSION_KEYS.VIEW_CUSTOMERS, PERMISSION_KEYS.MANAGE_REPAIRS];
    case UserRole.READ_ONLY:
      return [PERMISSION_KEYS.VIEW_CUSTOMERS, PERMISSION_KEYS.VIEW_FINANCES, PERMISSION_KEYS.VIEW_REPORTS];
    default:
      return base;
  }
}

function isAdminLikeRole(role: string): boolean {
  return role === UserRole.GOD || role === UserRole.OWNER || role === UserRole.SUPER_ADMIN || role === 'GOD' || role === 'OWNER' || role === 'SUPER_ADMIN';
}

export function isGod(user: User | null | undefined): boolean {
  if (!user) return false;
  const roleStr = String(user.role || '').trim().toUpperCase();
  return user.role === UserRole.GOD || roleStr === 'GOD';
}

export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const roleStr = String(user.role || '').trim().toUpperCase();
  return (
    user.role === UserRole.GOD ||
    roleStr === 'GOD' ||
    user.role === UserRole.OWNER ||
    roleStr === 'OWNER' ||
    user.role === UserRole.SUPER_ADMIN ||
    roleStr === 'SUPER_ADMIN'
  );
}

export function hasPermission(
  user: User | null | undefined,
  module: ModuleName,
  action: PermissionAction,
  rolesList: Role[] = DEFAULT_ROLES
): boolean {
  if (!user) return false;
  if (isGod(user) || user.role === UserRole.OWNER || user.role === UserRole.SUPER_ADMIN) return true;

  // Module USERS and SETTINGS and AUDIT_LOGS are strictly ADMIN ONLY
  if (module === ModuleName.USERS || module === ModuleName.SETTINGS) {
    return isAdmin(user);
  }

  // Grant-only per-user overrides: admin checkbox keys stored on user.permissions
  // ADD access on top of the role. Kept after the admin gate so ADMIN_USERS can't escalate.
  if (Array.isArray(user.permissions)) {
    for (const key of user.permissions as string[]) {
      const mapped = PERMISSION_KEY_TO_RBAC[key];
      if (!mapped) continue;
      const match = mapped.find(
        (p) => p.module === module && (p.actions.includes(action) || p.actions.includes(PermissionAction.MANAGE))
      );
      if (match) return true;
    }
  }

  const userRole = rolesList.find((r) => r.name === user.role);
  if (!userRole) return false;

  const modulePerm = userRole.permissions.find((p) => p.module === module);
  if (!modulePerm) return false;

  return modulePerm.actions.includes(action) || modulePerm.actions.includes(PermissionAction.MANAGE);
}

export function canManageUsers(user: User | null | undefined): boolean {
  return isAdmin(user);
}

export function canDeleteUser(operator: User | null | undefined, targetUser: User | null | undefined): boolean {
  if (!operator || !targetUser) return false;
  if (!isAdmin(operator)) return false;
  // Cannot delete root admin account
  if (targetUser.id === 'usr-admin' || targetUser.username?.toLowerCase() === 'admin') return false;
  // Cannot delete self
  if (operator.id === targetUser.id) return false;
  return true;
}

export function canResetUserPassword(operator: User | null | undefined, targetUser: User | null | undefined): boolean {
  if (!operator || !targetUser) return false;
  if (!isAdmin(operator)) return false;
  // GOD, Owner and Super Admin can reset password
  return true;
}


export function canApprovePayments(user: User | null): boolean {
  return hasPermission(user, ModuleName.PAYMENTS, PermissionAction.VERIFY) ||
         hasPermission(user, ModuleName.PAYMENTS, PermissionAction.FINALIZE);
}

export function canViewFinancials(user: User | null): boolean {
  return hasPermission(user, ModuleName.PAYMENTS, PermissionAction.VIEW) ||
         hasPermission(user, ModuleName.CHECKS, PermissionAction.VIEW);
}

/**
 * Checks if a user can view a specific task.
 * Rule:
 * 1. Admin/Owner can see all tasks (and created tasks).
 * 2. Creator of the task can see it.
 * 3. Assigned user can see it.
 * 4. Users with whom the task has been explicitly shared (sharedWithUserIds) can see it.
 */
export function canViewTask(user: User | null | undefined, task: Task): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (task.creatorUserId && task.creatorUserId === user.id) return true;
  if (task.assignedUserId && task.assignedUserId === user.id) return true;
  if (task.sharedWithUserIds && task.sharedWithUserIds.includes(user.id)) return true;
  return false;
}

/**
 * Checks if a user can execute, complete, or toggle status of a task.
 * Rule:
 * 1. Admin/Owner can execute any task.
 * 2. Assigned user can execute the task.
 * 3. Shared users can execute the task.
 * 4. Creator can also execute if needed.
 */
export function canExecuteTask(user: User | null | undefined, task: Task): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (task.assignedUserId && task.assignedUserId === user.id) return true;
  if (task.sharedWithUserIds && task.sharedWithUserIds.includes(user.id)) return true;
  if (task.creatorUserId && task.creatorUserId === user.id) return true;
  return false;
}

/**
 * Checks if a user can share or reassign/delegate a task to other users.
 * Rule:
 * 1. Admin/Owner
 * 2. Creator of the task
 * 3. Currently assigned user
 */
export function canShareTask(user: User | null | undefined, task: Task): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (task.assignedUserId && task.assignedUserId === user.id) return true;
  if (task.creatorUserId && task.creatorUserId === user.id) return true;
  return false;
}

