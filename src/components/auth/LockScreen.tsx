import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole } from '../../types';
import { storage } from '../../services/storage';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import {
  Lock, Unlock, Eye, EyeOff, KeyRound, ShieldAlert,
  Clock, ArrowRight, Sparkles, User as UserIcon, LogOut, CheckCircle2, UserCheck
} from 'lucide-react';
// dateUtils no longer needed — formatDate from useTranslation handles Jalali/Gregorian
import { motion, AnimatePresence } from 'motion/react';

export interface LockScreenProps {
  isLocked: boolean;
  lockedUser: User;
  onUnlockSuccess: (user: User) => void;
  onSwitchUser: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  isLocked,
  lockedUser,
  onUnlockSuccess,
  onSwitchUser,
}) => {
  const { isRtl, formatDate } = useTranslation();
  const { success } = useToast();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  const inputRef = useRef<HTMLInputElement>(null);

  // Live Clock & Date Update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString(isRtl ? 'fa-IR' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
      try {
        setCurrentDate(formatDate(now.toISOString(), false));
      } catch {
        setCurrentDate(formatDate(now.toISOString(), false));
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isRtl, formatDate]);

  // Focus input when lock screen becomes visible
  useEffect(() => {
    if (isLocked) {
      setPassword('');
      setErrorMsg(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isLocked, lockedUser]);

  if (!isLocked) return null;

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (!password) {
      setErrorMsg(isRtl ? 'لطفاً رمز عبور خود را وارد فرمایید.' : 'Please enter your password.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      inputRef.current?.focus();
      return;
    }

    setIsLoading(true);

    setTimeout(async () => {
      const res = await storage.unlockSession(password);
      setIsLoading(false);

      if (res.success && res.user) {
        success(isRtl ? `نشست کاری با موفقیت بازگشایی شد. خوش آمدید ${res.user.name}` : `Session unlocked successfully. Welcome back ${res.user.name}`);
        setPassword('');
        setErrorMsg(null);
        onUnlockSuccess(res.user);
      } else {
        setErrorMsg(res.message || (isRtl ? 'رمز عبور وارد شده نادرست است.' : 'Incorrect password entered.'));
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
        setPassword('');
        inputRef.current?.focus();
      }
    }, 200);
  };

  const roleColors: Record<UserRole, 'default' | 'primary' | 'success' | 'warning' | 'purple' | 'danger'> = {
    [UserRole.GOD]: 'danger',
    [UserRole.OWNER]: 'purple',
    [UserRole.SUPERVISOR]: 'primary',
    [UserRole.STORE_OPERATIONS]: 'warning',
    [UserRole.ACCOUNTING_ADMIN]: 'success',
    [UserRole.SALES]: 'primary',
    [UserRole.TECHNICAL]: 'warning',
    [UserRole.REPAIR_TECHNICIAN]: 'warning',
    [UserRole.SUPER_ADMIN]: 'purple',
    [UserRole.FINANCE_MANAGER]: 'success',
    [UserRole.SALES_AGENT]: 'default',
    [UserRole.TECHNICIAN]: 'warning',
    [UserRole.READ_ONLY]: 'default',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/92 backdrop-blur-xl select-none"
        dir="rtl"
      >
        {/* Subtle Background Glows */}
        <div className="absolute top-1/4 start-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 end-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Lock Screen Container */}
        <div className="w-full max-w-md relative z-10">
          {/* Top Clock & Date Header */}
          <div className="text-center mb-6 space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-semibold text-slate-300 shadow-inner">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-mono text-sm tracking-wider text-slate-100">{currentTime || '۰۰:۰۰:۰۰'}</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">{currentDate}</p>
          </div>

          {/* Main Card */}
          <div
            className={`p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800/90 shadow-2xl backdrop-blur-md text-center transition-transform ${
              isShaking ? 'animate-shake border-rose-500/50 ring-2 ring-rose-500/20' : ''
            }`}
          >
            {/* Lock Status Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold mb-6">
              <Lock className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span>{isRtl ? 'نشست کاری قفل شده است' : 'Work session is locked'}</span>
            </div>

            {/* Locked User Avatar */}
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="w-full h-full rounded-2xl overflow-hidden bg-gradient-to-tr from-indigo-600 to-purple-600 p-0.5 shadow-xl shadow-indigo-500/20">
                <div className="w-full h-full rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center">
                  {lockedUser.avatar ? (
                    <img
                      src={lockedUser.avatar}
                      alt={lockedUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-indigo-900 via-slate-900 to-purple-900 flex items-center justify-center text-3xl font-black text-white">
                      {lockedUser.name ? lockedUser.name.charAt(0) : <UserIcon className="w-10 h-10 text-indigo-400" />}
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute -bottom-1 -start-1 p-1.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-400 shadow-md">
                <KeyRound className="w-4 h-4" />
              </div>
            </div>

            {/* User Details */}
            <div className="space-y-1 mb-6">
              <h2 className="text-xl font-black text-slate-100">{lockedUser.name}</h2>
              <div className="flex items-center justify-center gap-2">
                <Badge variant={roleColors[lockedUser.role] || 'default'} size="sm">
                  {lockedUser.role}
                </Badge>
                <span className="text-xs text-slate-400 font-mono">@{lockedUser.username}</span>
              </div>
            </div>

            {/* Unlock Form */}
            <form onSubmit={handleUnlock} className="space-y-4 text-end">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>{isRtl ? 'کلمه عبور جهت بازگشایی:' : 'Password to unlock:'}</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({isRtl ? 'پیش‌فرض دمو:' : 'Demo default:'} <code className="text-indigo-300 font-mono">123</code>)
                  </span>
                </label>

                <div className="relative">
                  <input
                    ref={inputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder={isRtl ? 'کلمه عبور خود را وارد فرمایید...' : 'Enter your password...'}
                    disabled={isLoading}
                    className="w-full h-11 px-3.5 ps-10 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 font-mono text-end focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-all placeholder:text-slate-600"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-400 mt-2 font-medium flex items-center gap-1.5 animate-fadeIn">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </p>
                )}
              </div>

              {/* Unlock Action Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full shadow-lg shadow-indigo-600/25"
                isLoading={isLoading}
                leftIcon={<Unlock className="w-4 h-4" />}
              >
                {isRtl ? 'بازگشایی و ادامه کار' : 'Unlock & Continue'}
              </Button>
            </form>

            {/* Alternative Actions */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={onSwitchUser}
                className="text-slate-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isRtl ? 'ورود با کاربر دیگر' : 'Sign in with another user'}</span>
              </button>
            </div>
          </div>

          {/* Helper Shortcut Tip */}
          <div className="text-center mt-4">
            <p className="text-[11px] text-slate-500">
              {isRtl ? 'کلید میانبر قفل سریع در هر بخش از برنامه:' : 'Quick lock shortcut anywhere in the app:'} <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300">Alt + L</kbd>
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
