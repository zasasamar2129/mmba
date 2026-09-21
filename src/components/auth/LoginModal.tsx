import React, { useState } from 'react';
import { useTranslation } from '../../lib/i18n';
import { User, UserRole } from '../../types';
import { storage } from '../../services/storage';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import {
  Lock, User as UserIcon, LogIn, ArrowRight, ShieldCheck,
  CheckCircle2, Sparkles, KeyRound, Eye, EyeOff, Building2, Smartphone, HelpCircle, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: User) => void;
  availableUsers: User[];
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onLoginSuccess,
  availableUsers,
  onClose,
}) => {
  const { isRtl } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedQuickUser, setSelectedQuickUser] = useState<User | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSelectQuickUser = (user: User) => {
    setSelectedQuickUser(user);
    setIdentifier(user.username);
    setPassword('');
    setErrorMsg(null);
  };

  const handleClearSelection = () => {
    setSelectedQuickUser(null);
    setIdentifier('');
    setPassword('');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const loginId = selectedQuickUser ? selectedQuickUser.username : identifier;

    if (!loginId.trim()) {
      setErrorMsg(isRtl ? 'لطفاً نام کاربری، ایمیل یا شماره موبایل را وارد نمایید.' : 'Please enter your username, email, or mobile number.');
      return;
    }

    if (!password) {
      setErrorMsg(isRtl ? 'لطفاً رمز عبور خود را وارد نمایید.' : 'Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await storage.login(loginId, password);
      setIsLoading(false);

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(res.message || (isRtl ? 'نام کاربری یا کلمه عبور اشتباه است.' : 'Incorrect username or password.'));
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || (isRtl ? 'خطا در ارتباط با سرور مرکزی' : 'Error communicating with the central server'));
    }
  };

  const roleLabels: Record<string, string> = {
    [UserRole.GOD]: isRtl ? '⚡ دسترسی مطلق و نامحدود (GOD)' : '⚡ Absolute & Unlimited Access (GOD)',
    god: isRtl ? '⚡ دسترسی مطلق و نامحدود (GOD)' : '⚡ Absolute & Unlimited Access (GOD)',
    [UserRole.OWNER]: isRtl ? 'مالک و مدیریت ارشد' : 'Owner & Executive Management',
    [UserRole.SUPER_ADMIN]: isRtl ? 'مدیریت ارشد سامانه' : 'System Senior Admin',
    [UserRole.SUPERVISOR]: isRtl ? 'سرپرستی عملیات' : 'Operations Supervision',
    [UserRole.ACCOUNTING_ADMIN]: isRtl ? 'مدیریت مالی و حسابداری' : 'Finance & Accounting Admin',
    [UserRole.FINANCE_MANAGER]: isRtl ? 'مدیریت مالی و خزانه‌دار' : 'Finance & Treasury Manager',
    [UserRole.SALES]: isRtl ? 'کارشناس فروش' : 'Sales Specialist',
    [UserRole.SALES_AGENT]: isRtl ? 'کارشناس فروش و قرارداد' : 'Sales & Contract Specialist',
    [UserRole.STORE_OPERATIONS]: isRtl ? 'عملیات فروشگاه' : 'Store Operations',
    [UserRole.REPAIR_TECHNICIAN]: isRtl ? 'کارگاه تعمیرات' : 'Repair Workshop',
    [UserRole.TECHNICIAN]: isRtl ? 'تکنسین فنی' : 'Technical Technician',
    [UserRole.TECHNICAL]: isRtl ? 'فنی و زیرساخت' : 'Technical & Infrastructure',
    [UserRole.READ_ONLY]: isRtl ? 'کاربر فقط مشاهده' : 'Read-Only User',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 app-modal-backdrop bg-slate-950/60 dark:bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/90 shadow-2xl shadow-indigo-500/20 dark:shadow-indigo-950/40 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 pb-4 bg-gradient-to-b from-indigo-100 dark:from-indigo-950/40 to-transparent border-b border-slate-200 dark:border-slate-800/80 text-center relative">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute start-4 top-4 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center justify-center mb-3">
            <img
              src="/logo.svg"
              alt="MMBA PANEL"
              className="h-16 sm:h-20 w-auto object-contain drop-shadow-md hover:scale-105 transition-transform duration-200"
            />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {isRtl ? 'ورود به سامانه جامع MMBA' : 'MMBA Comprehensive System Login'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isRtl ? 'سیستم یکپارچه مدیریت مشتریان، خطوط رند، مکالمات صوتی، مالی و تعمیرات' : 'Integrated system for customer management, production lines, voice calls, finance, and repairs'}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-end">
          {/* Quick User Picker Card */}
          {!selectedQuickUser && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>{isRtl ? 'انتخاب سریع کاربر (جهت ورود یا تست نقش):' : 'Quick user selection (login or role test):'}</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">{isRtl ? 'رمز پیش‌فرض' : 'Default password'}: 123</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pe-1">
                {availableUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectQuickUser(u)}
                    className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-950/60 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 transition-all text-end flex items-center gap-2.5 group"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-600 to-sky-500 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center text-white text-xs font-bold">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        u.name.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-300 truncate">
                        {u.name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {roleLabels[u.role] || u.role}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* If a profile is chosen */}
          {selectedQuickUser && (
            <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl overflow-hidden bg-gradient-to-tr from-indigo-600 to-sky-500 border border-indigo-400 dark:border-indigo-500/40 shrink-0 flex items-center justify-center text-white text-base font-bold shadow-md">
                  {selectedQuickUser.avatar ? (
                    <img
                      src={selectedQuickUser.avatar}
                      alt={selectedQuickUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    selectedQuickUser.name.charAt(0)
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedQuickUser.name}</h3>
                    <Badge variant="purple" size="sm">
                      {roleLabels[selectedQuickUser.role] || selectedQuickUser.role}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isRtl ? 'نام کاربری:' : 'Username:'} <span className="font-mono text-indigo-600 dark:text-indigo-300 font-semibold">{selectedQuickUser.username}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearSelection}
                className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                {isRtl ? 'تغییر کاربر' : 'Change User'}
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!selectedQuickUser && (
              <Input
                label={isRtl ? 'نام کاربری، ایمیل یا شماره موبایل' : 'Username, email, or mobile number'}
                placeholder={isRtl ? 'مثال: sajjad_owner یا 09120000001' : 'e.g. sajjad_owner or 09120000001'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                rightIcon={<UserIcon className="w-4 h-4 text-slate-400" />}
                isRequired
              />
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRtl ? 'رمز عبور' : 'Password'} {selectedQuickUser && <span className="text-indigo-600 dark:text-indigo-400 font-normal">({selectedQuickUser.name})</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isRtl ? 'رمز عبور خود را وارد کنید...' : 'Enter your password...'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus={!!selectedQuickUser}
                  className="w-full h-11 px-3.5 pe-10 ps-10 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-all text-end"
                />
                <div className="absolute end-3.5 top-3 text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute start-3 top-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <span className="font-bold">{isRtl ? 'خطا:' : 'Error:'}</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                type="submit"
                isLoading={isLoading}
                leftIcon={<LogIn className="w-5 h-5" />}
                className="w-full shadow-lg shadow-indigo-600/30 font-bold"
              >
                {isRtl ? 'ورود به سامانه' : 'Sign In'}
              </Button>
            </div>
          </form>

          {/* Hint info */}
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <KeyRound className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>{isRtl ? 'رمز عبور پیش‌فرض تمام کاربران آزمایشی:' : 'Default password for all demo users:'}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-amber-600 dark:text-amber-300">
              123
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
