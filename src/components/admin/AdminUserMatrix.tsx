import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import {
  ShieldCheck, User as UserIcon, Plus, Edit3, Check, ShieldAlert,
  Lock, Trash2, KeyRound, Copy, RefreshCw, Eye, EyeOff, AlertTriangle
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { AvatarUploader } from '../ui/AvatarUploader';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { isAdmin, isGod, canDeleteUser, canResetUserPassword, PERMISSION_KEYS, getPermissionKeysForRole, PERMISSION_KEY_TO_RBAC } from '../../lib/permissions';
import { useTranslation } from '../../lib/i18n';
import { RTLNumber } from '../ui/RTLNumber';

export interface AdminUserMatrixProps {
  users: User[];
  currentUser?: User;
  onRefreshUsers: () => void;
}


export type PermissionKey = keyof typeof PERMISSION_KEYS;

export const AdminUserMatrix: React.FC<AdminUserMatrixProps> = ({
  users,
  currentUser,
  onRefreshUsers,
}) => {
  const { success, error } = useToast();
  const { t, isRtl } = useTranslation();

  // All hooks are declared unconditionally (BEFORE any early-return) to satisfy
  // React's rules of hooks. The admin-only guard below uses a plain variable.
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.SALES_AGENT);
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Reset Password Modal State
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Delete User Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  const ALL_PERMISSIONS: { key: string; label: string; desc: string }[] = [
    { key: PERMISSION_KEYS.VIEW_CUSTOMERS, label: isRtl ? 'مشاهده لیست و پرونده مشتریان' : 'View Customer Records', desc: isRtl ? 'دسترسی به اطلاعات تماس و جزئیات مشتری' : 'Access contact details and customer files' },
    { key: PERMISSION_KEYS.CREATE_CUSTOMERS, label: isRtl ? 'ثبت و ویرایش مشتری جدید' : 'Create & Edit Customers', desc: isRtl ? 'امکان ایجاد پرونده مشتری' : 'Ability to register and update customer profiles' },
    { key: PERMISSION_KEYS.DELETE_CUSTOMERS, label: isRtl ? 'حذف مشتریان' : 'Delete Customers', desc: isRtl ? 'پاکسازی اطلاعات مشتریان' : 'Remove customer records' },
    { key: PERMISSION_KEYS.VIEW_FINANCES, label: isRtl ? 'مشاهده تراکنش‌ها و چک‌ها' : 'View Financial Records', desc: isRtl ? 'دسترسی به دفاتر مالی و دریافت‌ها' : 'Access payment ledger and check archives' },
    { key: PERMISSION_KEYS.MANAGE_FINANCES, label: isRtl ? 'ثبت واریز و چک جدید' : 'Manage Financial Transactions', desc: isRtl ? 'صدور و ویرایش اسناد مالی' : 'Issue and manage payments and checks' },
    { key: PERMISSION_KEYS.MANAGE_CONTRACTS, label: isRtl ? 'مدیریت قراردادها' : 'Manage Contracts', desc: isRtl ? 'صدور، ویرایش و فسخ قراردادهای رسمی' : 'Draft, edit and terminate formal contracts' },
    { key: PERMISSION_KEYS.MANAGE_SIM_CARDS, label: isRtl ? 'مدیریت انبار سیم‌کارت‌ها' : 'Manage SIM Inventory', desc: isRtl ? 'تغییر وضعیت و قیمت‌گذاری خطوط' : 'Update status and pricing of SIM cards' },
    { key: PERMISSION_KEYS.MANAGE_REPAIRS, label: isRtl ? 'مدیریت واحد تعمیرات' : 'Manage Repair Services', desc: isRtl ? 'صدور قبض تعمیرگاه و اعلام هزینه' : 'Issue repair receipts and update repair stages' },
    { key: PERMISSION_KEYS.VIEW_REPORTS, label: isRtl ? 'مشاهده گزارشات مدیریتی و هوش تجاری' : 'View Reports & BI Analytics', desc: isRtl ? 'داشبورد نموداری و تحلیل درآمد' : 'Charts, business intelligence and revenue metrics' },
    { key: PERMISSION_KEYS.ADMIN_USERS, label: isRtl ? 'مدیریت کاربران و دسترسی‌ها' : 'Manage Users & Permissions', desc: isRtl ? 'تعریف کارشناس و تعیین مجوزها' : 'Create team accounts and define permissions' },
    { key: PERMISSION_KEYS.EXPORT_DATA, label: isRtl ? 'خروجی اکسل و بک‌آپ' : 'Export Excel & Backup', desc: isRtl ? 'استخراج داده‌های سازمانی' : 'Extract company records to Excel and manage backups' },
  ];

  if (currentUser && !isAdmin(currentUser)) {
    return (
      <div className="p-8 text-center rounded-3xl liquid-glass border border-rose-500/30 max-w-lg mx-auto my-12 space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('users.accessDenied')}</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {t('users.accessDeniedDesc')}
        </p>
      </div>
    );
  }

  const generateRandomPassword = () => {
    const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const symbols = '!@#$%';
    let res = '';
    for (let i = 0; i < 4; i++) res += letters.charAt(Math.floor(Math.random() * letters.length));
    for (let i = 0; i < 3; i++) res += digits.charAt(Math.floor(Math.random() * digits.length));
    res += symbols.charAt(Math.floor(Math.random() * symbols.length));
    return res;
  };

  const handleOpenNew = () => {
    setUserToEdit(null);
    setName('');
    setUsername('');
    setRole(UserRole.SALES_AGENT);
    setEmail('');
    setAvatar(undefined);
    setPassword('');
    setShowPassword(false);
    setSelectedPermissions(getPermissionKeysForRole(UserRole.SALES_AGENT));
    setIsModalOpen(true);
  };

  // Convert a user's stored permissions (coarse keys, {module,actions} objects, or legacy
  // entries) into the set of known PERMISSION_KEYS so the admin checkboxes reflect reality.
  const normalizePermissionsForEdit = (user: User): string[] => {
    const raw = Array.isArray(user.permissions) ? user.permissions : [];
    const out = new Set<string>();

    for (const p of raw) {
      if (typeof p === 'string' && PERMISSION_KEY_TO_RBAC[p]) {
        out.add(p);
      } else if (p && typeof p === 'object') {
        const permObj = p as { module?: string };
        if (!permObj.module) continue;
        // Map a module name back to any coarse key that covers it
        (Object.entries(PERMISSION_KEY_TO_RBAC) as [string, { module: string; actions: unknown[] }[]][]).forEach(
          ([key, rbac]) => {
            if (rbac.some((r) => r.module === permObj.module)) out.add(key);
          }
        );
      }
    }
    return Array.from(out);
  };

  const handleOpenEdit = (user: User) => {
    setUserToEdit(user);
    setName(user.name);
    setUsername(user.username);
    setRole(user.role);
    setEmail(user.email || '');
    setAvatar(user.avatar);
    setPassword('');
    setShowPassword(false);
    setSelectedPermissions(normalizePermissionsForEdit(user));
    setIsModalOpen(true);
  };

  const handleOpenResetPassword = (user: User) => {
    setUserToResetPassword(user);
    const suggested = generateRandomPassword();
    setResetNewPassword(suggested);
    setShowResetPassword(true);
    setCopiedPassword(false);
    setIsResetPasswordOpen(true);
  };

  const handleCopyPassword = () => {
    if (!resetNewPassword) return;
    navigator.clipboard.writeText(resetNewPassword);
    setCopiedPassword(true);
    success(isRtl ? 'رمز عبور در کلیپ‌بورد کپی شد' : 'Password copied to clipboard');
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  const handleConfirmResetPassword = async () => {
    if (!userToResetPassword) return;
    const cleanPwd = resetNewPassword.trim();
    if (!cleanPwd || cleanPwd.length < 3) {
      error(isRtl ? 'کلمه عبور جدید باید حداقل ۳ کاراکتر باشد' : 'New password must be at least 3 characters');
      return;
    }

    setIsSubmittingReset(true);
    try {
      const res = await storage.resetUserPassword(userToResetPassword.id, cleanPwd);
      success(res?.message || (isRtl ? `رمز عبور کاربر "${userToResetPassword.name}" با موفقیت تغییر یافت.` : 'Password updated successfully.'));
      setIsResetPasswordOpen(false);
      setUserToResetPassword(null);
      setResetNewPassword('');
      onRefreshUsers();
    } catch (err: any) {
      error(err?.message || (isRtl ? 'خطا در بازنشانی رمز عبور' : 'Failed to reset password'));
    } finally {
      setIsSubmittingReset(false);
    }
  };

  const handleOpenDelete = (user: User) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsSubmittingDelete(true);
    try {
      await storage.deleteUser(userToDelete.id);
      success(isRtl ? `حساب کاربری "${userToDelete.name}" با موفقیت حذف گردید.` : 'User deleted successfully.');
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      onRefreshUsers();
    } catch (err: any) {
      error(err?.message || (isRtl ? 'خطا در حذف کاربر' : 'Failed to delete user'));
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const handleTogglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanName || !cleanUsername) {
      error(isRtl ? 'لطفاً نام و نام کاربری را تکمیل کنید' : 'Please fill in name and username');
      return;
    }

    // Check duplicate username if adding new or changing username
    if (!userToEdit) {
      const duplicate = users.some((u) => u.username?.toLowerCase() === cleanUsername);
      if (duplicate) {
        error(isRtl ? 'این نام کاربری قبلاً در سامانه ثبت شده است.' : 'This username is already registered.');
        return;
      }
    } else {
      const duplicate = users.some(
        (u) => u.id !== userToEdit.id && u.username?.toLowerCase() === cleanUsername
      );
      if (duplicate) {
        error(isRtl ? 'این نام کاربری متعلق به حساب کاربری دیگری است.' : 'This username belongs to another account.');
        return;
      }
    }

    const payload: User = {
      ...(userToEdit || {}),
      id: userToEdit?.id || (cleanUsername === 'admin' ? 'usr-admin' : ''),
      name: cleanName,
      username: cleanUsername,
      role,
      email: email.trim() || undefined,
      avatar: avatar,
      permissions: selectedPermissions,
      isActive: true,
      createdAt: userToEdit?.createdAt || new Date().toISOString(),
    };

    if (password.trim()) {
      payload.password = password.trim();
    }

    storage.saveUser(payload);
    success(userToEdit ? (isRtl ? 'اطلاعات کاربر با موفقیت ویرایش شد' : 'User updated successfully') : (isRtl ? 'کاربر سازمانی جدید با موفقیت ایجاد گردید' : 'User created successfully'));
    setIsModalOpen(false);
    onRefreshUsers();
  };

  return (
    <div className="space-y-6 animate-blur-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {t('users.title')}
            </h1>
            <Badge variant="indigo" size="sm">
              <RTLNumber value={users.length} type="count" suffix={isRtl ? 'کاربر فعال' : 'Active Users'} />
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('users.subtitle')}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenNew}
          leftIcon={<Plus className="w-4 h-4" />}
          className="self-start sm:self-auto"
        >
          {t('users.newUserBtn')}
        </Button>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u) => (
          <div
            key={u.id}
            className={`p-5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all ${isRtl ? 'text-right' : 'text-left'} space-y-4 flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0 border border-slate-200 dark:border-slate-700">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      u.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">{u.name}</h3>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">@{u.username}</span>
                  </div>
                </div>

                <Badge
                  variant={
                    u.role === UserRole.GOD || String(u.role).toUpperCase() === 'GOD'
                      ? 'rose'
                      : u.role === UserRole.SUPER_ADMIN || u.role === UserRole.OWNER
                      ? 'purple'
                      : 'indigo'
                  }
                  size="sm"
                >
                  {u.role === UserRole.GOD || String(u.role).toUpperCase() === 'GOD'
                    ? (isRtl ? '⚡ GOD (دسترسی نامحدود)' : '⚡ GOD (Unlimited)')
                    : u.role}
                </Badge>
              </div>

              {/* Permissions list summary */}
              <div className="mt-3 space-y-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">{t('users.assignedPermissions')}:</span>
                <div className="flex flex-wrap gap-1">
                  {(u.permissions || []).map((p: any) => {
                    const label = typeof p === 'string' ? p : p.module || 'CUSTOM';
                    return (
                      <span
                        key={label}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end flex-wrap gap-2">
              {canResetUserPassword(currentUser, u) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenResetPassword(u)}
                  leftIcon={<KeyRound className="w-3.5 h-3.5 text-amber-500" />}
                  title={isRtl ? 'بازنشانی یا تغییر رمز عبور' : 'Reset Password'}
                >
                  {isRtl ? 'تغییر رمز' : 'Reset Password'}
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenEdit(u)}
                leftIcon={<Edit3 className="w-3.5 h-3.5" />}
              >
                {t('users.editUser')}
              </Button>

              {canDeleteUser(currentUser, u) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenDelete(u)}
                  leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                  className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  title={isRtl ? 'حذف کاربر' : 'Delete User'}
                >
                  {isRtl ? 'حذف' : 'Delete'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* User Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="lg"
        title={
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <span>{userToEdit ? t('users.editUser') : t('users.newUserBtn')}</span>
          </div>
        }
        subtitle={t('users.permissionsTitle')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Uploader */}
          <div className="space-y-1.5 pb-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              {isRtl ? 'تصویر پروفایل کاربر:' : 'User Profile Avatar:'}
            </label>
            <AvatarUploader
              currentAvatar={avatar}
              userName={name || (isRtl ? 'کاربر' : 'User')}
              onAvatarChange={(newAvatar) => setAvatar(newAvatar)}
              size="md"
              showPresets={true}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label={t('users.fullName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isRtl ? 'مثال: سجاد راجحی' : 'e.g. Sajjad Rajehi'}
              isRequired
            />

            <Input
              label={isRtl ? 'نام کاربری (لاگین)' : 'Username (login)'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="sajjad"
              isRequired
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Select
              label={t('users.role')}
              value={role}
              onChange={(e) => {
                const nextRole = e.target.value as UserRole;
                setRole(nextRole);
                // When switching roles in the admin form, refresh the permission
                // checkboxes to that role's sensible default set.
                setSelectedPermissions(getPermissionKeysForRole(nextRole));
              }}
              options={[
                { value: UserRole.GOD, label: isRtl ? '⚡ دسترسی مطلق (GOD - دسترسی نامحدود به همه بخش‌ها)' : '⚡ GOD (Unlimited Access to All Modules)' },
                { value: UserRole.SUPER_ADMIN, label: isRtl ? 'مدیر ارشد (دسترسی کامل)' : 'Super Admin (Full Access)' },
                { value: UserRole.FINANCE_MANAGER, label: isRtl ? 'مدیر مالی و خزانه‌دار' : 'Finance Manager / Treasurer' },
                { value: UserRole.SALES_AGENT, label: isRtl ? 'کارشناس فروش و قرارداد' : 'Sales & Contract Agent' },
                { value: UserRole.TECHNICIAN, label: isRtl ? 'تکنسین تعمیرات و سخت‌فزار' : 'Hardware & Repair Technician' },
                { value: UserRole.READ_ONLY, label: isRtl ? 'فقط مشاهده (حسابرس)' : 'Read-Only / Auditor' },
              ]}
            />

            <Input
              label={t('users.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
            />
          </div>

          {/* Password field */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-500" />
                <span>
                  {userToEdit
                    ? (isRtl ? 'کلمه عبور جدید (اختیاری - در صورت تمایل به تغییر)' : 'New Password (optional)')
                    : (isRtl ? 'کلمه عبور ورود (پیش‌فرض: 123456)' : 'Login Password (default: 123456)')}
                </span>
              </label>
              <button
                type="button"
                onClick={() => setPassword(generateRandomPassword())}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{isRtl ? 'تولید رمز تصادفی' : 'Generate'}</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={userToEdit ? (isRtl ? 'کلمه عبور بدون تغییر باقی می‌ماند' : 'Leave empty to keep unchanged') : '123456'}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 end-0 px-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Granular permissions checkbox list */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {t('users.permissionsTitle')}:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              {ALL_PERMISSIONS.map((perm) => {
                const checked = selectedPermissions.includes(perm.key);
                return (
                  <label
                    key={perm.key}
                    onClick={() => handleTogglePermission(perm.key)}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all border select-none ${
                      checked
                        ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-500/40'
                        : 'bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onChange={(e) => {
                        // Inner checkbox clicks should also toggle (and not double-fire
                        // through the wrapping label). Stop propagation to avoid a double toggle.
                        e.stopPropagation();
                        handleTogglePermission(perm.key);
                      }}
                      label={perm.label}
                      description={perm.desc}
                      size="sm"
                      colorScheme="indigo"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" size="sm" type="submit" leftIcon={<Check className="w-4 h-4" />}>
              {userToEdit ? t('common.save') : t('users.newUserBtn')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={isResetPasswordOpen}
        onClose={() => {
          if (!isSubmittingReset) {
            setIsResetPasswordOpen(false);
            setUserToResetPassword(null);
          }
        }}
        maxWidth="md"
        title={
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <KeyRound className="w-5 h-5" />
            <span>{isRtl ? 'بازنشانی کلمه عبور کاربر' : 'Reset User Password'}</span>
          </div>
        }
        subtitle={
          userToResetPassword
            ? `${userToResetPassword.name} (@${userToResetPassword.username})`
            : undefined
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {isRtl
                ? 'با ثبت کلمه عبور جدید، دسترسی کاربر بلافاصله با این رمز معتبر خواهد بود. می‌توانید رمز تصادفی تولید و کپی کنید.'
                : 'Setting a new password immediately updates the user credentials. You can generate and copy a strong random password.'}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isRtl ? 'کلمه عبور جدید:' : 'New Password:'}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setResetNewPassword(generateRandomPassword())}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'تولید مجدد' : 'Regenerate'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedPassword ? (isRtl ? 'کپی شد!' : 'Copied!') : (isRtl ? 'کپی رمز' : 'Copy')}</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type={showResetPassword ? 'text' : 'password'}
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="********"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                className="absolute inset-y-0 end-0 px-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              disabled={isSubmittingReset}
              onClick={() => {
                setIsResetPasswordOpen(false);
                setUserToResetPassword(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isSubmittingReset}
              onClick={handleConfirmResetPassword}
              leftIcon={<KeyRound className="w-4 h-4" />}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isRtl ? 'تغییر و ثبت رمز عبور' : 'Confirm Password Reset'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isSubmittingDelete) {
            setIsDeleteModalOpen(false);
            setUserToDelete(null);
          }
        }}
        maxWidth="md"
        title={
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Trash2 className="w-5 h-5" />
            <span>{isRtl ? 'حذف حساب کاربری' : 'Delete User Account'}</span>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm text-rose-900 dark:text-rose-200">
                {isRtl ? 'آیا از حذف این کاربر اطمینان دارید؟' : 'Are you sure you want to delete this user?'}
              </p>
              <p>
                {userToDelete && (
                  <span>
                    {isRtl ? 'کاربر:' : 'User:'} <strong>{userToDelete.name}</strong> (@{userToDelete.username})
                  </span>
                )}
              </p>
              <p className="opacity-90">
                {isRtl
                  ? 'با حذف این حساب کاربری، کاربر دیگر قادر به ورود به سامانه نخواهد بود. تاریخچه فعالیت‌ها و گزارش‌های ثبت شده توسط این کاربر در دیتابیس حفظ خواهد شد.'
                  : 'Deleting this account will revoke login access immediately. Past logs and recorded activities will remain in system audit archives.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isSubmittingDelete}
              onClick={() => {
                setIsDeleteModalOpen(false);
                setUserToDelete(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isSubmittingDelete}
              onClick={handleConfirmDelete}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              {isRtl ? 'بله، کاربر حذف شود' : 'Yes, Delete User'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
