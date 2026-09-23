import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import {
  Menu, Moon, Sun, Database, RefreshCw, Plus, Mic, Upload, PhoneCall,
  Users, CheckSquare, CreditCard, Globe, Sparkles, Search, Bell, MessageSquare
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      onNavigate('customers');
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-[#0b0d14]/95 border-b border-white/[0.08] backdrop-blur-xl px-3 sm:px-4 lg:px-6 py-2.5 flex items-center justify-between gap-3 select-none transition-colors max-w-full overflow-x-hidden">
      {/* Left: Mobile hamburger & User Profile Greeting matching screenshot */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileNav && (
          <button
            type="button"
            onClick={onToggleMobileNav}
            aria-expanded="false"
            className="lg:hidden w-9 h-9 rounded-xl bg-[#161928] hover:bg-[#1f2438] text-slate-300 border border-white/[0.08] flex items-center justify-center transition-all shadow-xs active:scale-95 shrink-0"
            aria-label={t('common.menu')}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        {/* User Welcome / Avatar Block (Exact counterpart of Welcome! Kathryn Murphy in screenshot) */}
        <div
          onClick={onOpenProfile}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
          title={t('profile.title')}
        >
          <div className="relative">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#181b2c] border-2 border-emerald-500/80 p-0.5 overflow-hidden flex items-center justify-center shadow-md shadow-emerald-500/10">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <span className="font-extrabold text-sm text-violet-400">{currentUser.name.charAt(0)}</span>
              )}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0b0d14]" />
          </div>

          <div className="hidden sm:flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-xs sm:text-sm text-slate-100 group-hover:text-violet-400 transition-colors truncate">
                {isRtl ? `خوش آمدید! ${currentUser.name}` : `Welcome! ${currentUser.name}`}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[220px]">
              {isRtl ? 'سیستم مدیریت و عملیات هوشمند MMBA' : 'Security is a process, not a product'}
            </p>
          </div>
        </div>
      </div>

      {/* Center: Search pill bar (counterpart of Search Here in screenshot) */}
      <div className="flex-1 max-w-md mx-2 sm:mx-6 hidden md:block">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute start-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={isRtl ? 'جستجو در سامانه، مشتریان و اسناد...' : 'Search Here...'}
            className="w-full ps-10 pe-4 py-2 rounded-full bg-[#151824] hover:bg-[#181b2a] focus:bg-[#191c2c] border border-white/[0.08] focus:border-violet-500/60 text-xs sm:text-sm text-slate-200 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-1 focus:ring-violet-500/30"
          />
        </div>
      </div>

      {/* Right: Controls & Icon Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Messages / Chat button (counterpart of message icon in screenshot) */}
        <button
          type="button"
          onClick={() => onNavigate('chat')}
          title={isRtl ? 'پیام‌ها و گفتگو' : 'Messages & Chat'}
          className="w-9 h-9 rounded-full bg-[#151824] hover:bg-[#1f2438] border border-white/[0.08] flex items-center justify-center text-slate-300 hover:text-violet-400 transition-all relative shadow-xs"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
        </button>

        {/* Notifications / Alerts button (counterpart of bell in screenshot) */}
        <button
          type="button"
          onClick={() => onNavigate('audit')}
          title={isRtl ? 'اعلانات و گزارش رخدادها' : 'Notifications & Audit'}
          className="w-9 h-9 rounded-full bg-[#151824] hover:bg-[#1f2438] border border-white/[0.08] flex items-center justify-center text-slate-300 hover:text-amber-400 transition-all shadow-xs"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* DB Sync Status Pill */}
        <button
          type="button"
          onClick={handleManualSync}
          title={`${t('header.dbConnected')} - ${t('header.dbRevision')} ${syncStatus.serverRevision || 1}`}
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#151824] hover:bg-[#1f2438] border border-white/[0.08] text-slate-300 transition-all text-xs shadow-xs"
        >
          <span className={`w-2 h-2 rounded-full ${syncStatus.isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500'}`} />
          <Database className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[11px] font-medium hidden 2xl:inline">
            {syncStatus.isConnected ? t('header.dbConnected') : t('header.dbConnecting')}
          </span>
          <RefreshCw className={`w-3 h-3 text-slate-400 transition-transform ${isSyncingSpin || syncStatus.isSyncing ? 'animate-spin text-violet-400' : ''}`} />
        </button>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={handleToggleTheme}
          className="w-9 h-9 rounded-full bg-[#151824] hover:bg-[#1f2438] border border-white/[0.08] flex items-center justify-center text-slate-300 transition-all shadow-xs"
          title={isDark ? t('header.themeLight') : t('header.themeDark')}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-violet-400" />}
        </button>

        {/* Language Switcher Pill */}
        <div className="flex items-center rounded-full bg-[#151824] border border-white/[0.08] p-0.5 font-bold text-[11px] shadow-xs">
          <button
            type="button"
            onClick={() => setLanguage('fa')}
            className={`px-2 py-1 rounded-full transition-all ${
              language === 'fa'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="فارسی (RTL)"
          >
            FA
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2 py-1 rounded-full transition-all ${
              language === 'en'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="English (LTR)"
          >
            EN
          </button>
        </div>

        {/* Quick Action Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowQuickMenu(!showQuickMenu)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-600/25 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('common.quickAction')}</span>
          </button>

          {showQuickMenu && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
                onClick={() => setShowQuickMenu(false)}
              />
              <div className={`fixed sm:absolute ${isRtl ? 'left-3 sm:left-0' : 'right-3 sm:right-0'} top-14 sm:top-auto sm:mt-2 w-[280px] sm:w-64 rounded-2xl bg-[#131622] border border-white/[0.1] text-slate-100 shadow-2xl p-2 z-50 animate-fadeIn`}>
                <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 border-b border-white/[0.08] flex items-center justify-between">
                  <span>{t('header.quickCreate')}</span>
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                </div>

                <div className="py-1.5 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenNewVoiceNote('RECORD');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-300 hover:bg-rose-950/40 rounded-xl transition-colors font-medium border border-rose-900/40"
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
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-indigo-300 hover:bg-indigo-950/40 rounded-xl transition-colors font-medium border border-indigo-900/40"
                  >
                    <Upload className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>{t('header.uploadVoice')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenNewCall();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-[#1f2438] rounded-xl transition-colors font-medium"
                  >
                    <PhoneCall className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>{t('header.logCall')}</span>
                  </button>

                  {canCreateCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickMenu(false);
                        onOpenNewCustomer();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-[#1f2438] rounded-xl transition-colors font-medium"
                    >
                      <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>{t('header.newCustomer')}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenNewTask();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-[#1f2438] rounded-xl transition-colors font-medium"
                  >
                    <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{t('header.newTask')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenNewPayment();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-[#1f2438] rounded-xl transition-colors font-medium"
                  >
                    <CreditCard className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{t('header.newPayment')}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
