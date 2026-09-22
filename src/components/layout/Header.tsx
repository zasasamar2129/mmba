import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import {
  Menu, Moon, Sun, Database, RefreshCw, Plus, Mic, Upload, PhoneCall,
  Users, CheckSquare, CreditCard, Globe, Sparkles
} from 'lucide-react';
import { getInitialTheme, toggleTheme } from '../../lib/theme';
import { storage } from '../../services/storage';
import { useTranslation } from '../../lib/i18n';
import { hasPermission } from '../../lib/permissions';
import { ModuleName, PermissionAction } from '../../types';

export interface HeaderProps {
  currentUser: User;
  allUsers: User[];
  onUserChange: (user: User) => void;
  onLogout: () => void;
  onLockSession: () => void;
  onOpenNewCustomer: () => void;
  onOpenNewCall: () => void;
  onOpenNewTask: () => void;
  onOpenNewPayment: () => void;
  onOpenNewVoiceNote: (mode?: 'RECORD' | 'UPLOAD') => void;
  onNavigate: (tab: string) => void;
  onToggleMobileNav?: () => void;
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  onUserChange,
  onLogout,
  onLockSession,
  onOpenNewCustomer,
  onOpenNewCall,
  onOpenNewTask,
  onOpenNewPayment,
  onOpenNewVoiceNote,
  onNavigate,
  onToggleMobileNav,
  onOpenProfile,
}) => {
  const { language, setLanguage, toggleLanguage, t, isRtl } = useTranslation();
  const canCreateCustomer = hasPermission(currentUser, ModuleName.CUSTOMERS, PermissionAction.CREATE);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => getInitialTheme() === 'dark');
  const [syncStatus, setSyncStatus] = useState(() => storage.getSyncStatus());
  const [isSyncingSpin, setIsSyncingSpin] = useState(false);

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail?.theme) {
        setIsDark(e.detail.theme === 'dark');
      }
    };
    window.addEventListener('mmba-theme-change', handleThemeChange);

    const syncTimer = setInterval(() => {
      setSyncStatus(storage.getSyncStatus());
    }, 2000);

    return () => {
      window.removeEventListener('mmba-theme-change', handleThemeChange);
      clearInterval(syncTimer);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncingSpin(true);
    await storage.forceSync();
    setSyncStatus(storage.getSyncStatus());
    setTimeout(() => setIsSyncingSpin(false), 600);
  };

  const handleToggleTheme = () => {
    const next = toggleTheme();
    setIsDark(next === 'dark');
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 dark:bg-slate-950/95 border-b border-slate-200 dark:border-slate-800/80 backdrop-blur-xl px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-3 select-none transition-colors">
      {/* Brand & Mobile Hamburger */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onToggleMobileNav && (
          <button
            type="button"
            onClick={onToggleMobileNav}
            className="lg:hidden w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 flex items-center justify-center transition-all shadow-xs active:scale-95 shrink-0"
            aria-label="Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none group shrink-0"
          title={`MMBA PANEL - ${isRtl ? 'صفحه اصلی' : 'Home'}`}
        >
          <div className="flex items-center justify-center shrink-0">
            <img 
              src="/logo.svg" 
              alt="MMBA PANEL" 
              className="h-11 sm:h-14 md:h-16 w-auto object-contain group-hover:scale-105 transition-transform duration-200"
            />
          </div>
          <div className="hidden sm:flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="hidden md:inline-block text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                سامانه هوشمند
              </span>
            </div>
            <p className="hidden xl:block text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[260px]">
              مدیریت هوشمند مشتریان، خطوط رند، تماسها و اسناد
            </p>
          </div>
        </div>
      </div>

      {/* Center / Right controls: Language, Sync, Theme, Quick Actions, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Language Switcher Pill */}
        <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 font-bold text-[11px] shadow-xs">
          <button
            type="button"
            onClick={() => setLanguage('fa')}
            className={`px-2 py-1 rounded-lg transition-all ${
              language === 'fa'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="فارسی (RTL)"
          >
            FA
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2 py-1 rounded-lg transition-all ${
              language === 'en'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="English (LTR)"
          >
            EN
          </button>
        </div>

        {/* Central DB Sync Status Pill */}
        <button
          type="button"
          onClick={handleManualSync}
          title={`${t('header.dbConnected')} - ${t('header.dbRevision')} ${syncStatus.serverRevision || 1}`}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-all text-xs shadow-xs"
        >
          <span className={`w-2 h-2 rounded-full ${syncStatus.isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500'}`} />
          <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-[11px] font-medium">
            {syncStatus.isConnected ? t('header.dbConnected') : t('header.dbConnecting')}
          </span>
          <RefreshCw className={`w-3 h-3 text-slate-400 dark:text-slate-500 transition-transform ${isSyncingSpin || syncStatus.isSyncing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
        </button>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={handleToggleTheme}
          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all shadow-xs"
          title={isDark ? t('header.themeLight') : t('header.themeDark')}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>

        {/* Quick Action Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowQuickMenu(!showQuickMenu)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('common.quickAction')}</span>
          </button>

          {showQuickMenu && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
                onClick={() => setShowQuickMenu(false)}
              />
              <div className={`fixed sm:absolute ${isRtl ? 'left-3 sm:left-0' : 'right-3 sm:right-0'} top-14 sm:top-auto sm:mt-2 w-[280px] sm:w-64 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl p-2 z-50 animate-fadeIn`}>
                <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <span>{t('header.quickCreate')}</span>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                </div>

                <div className="py-1.5 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenNewVoiceNote('RECORD');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors font-medium border border-rose-200 dark:border-rose-900/40"
                  >
                    <Mic className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{t('header.recordVoice')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenNewVoiceNote('UPLOAD');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors font-medium border border-indigo-200 dark:border-indigo-900/40"
                  >
                    <Upload className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>{t('header.uploadVoice')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenNewCall();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors font-medium"
                  >
                    <PhoneCall className="w-4 h-4 text-sky-500 shrink-0" />
                    <span>{t('header.logCall')}</span>
                  </button>

                  {canCreateCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickMenu(false);
                        onOpenNewCustomer();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors font-medium"
                    >
                      <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>{t('header.newCustomer')}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenNewTask();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors font-medium"
                  >
                    <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{t('header.newTask')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenNewPayment();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors font-medium"
                  >
                    <CreditCard className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{t('header.newPayment')}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Profile Trigger Button */}
        {currentUser && (
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-all text-xs font-semibold shadow-xs"
            title={t('profile.title')}
          >
            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-[11px] overflow-hidden">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                currentUser.name.charAt(0)
              )}
            </div>
            <span className="hidden sm:inline max-w-[100px] truncate text-slate-800 dark:text-slate-200">
              {currentUser.name}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
