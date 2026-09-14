import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronDown, ChevronUp, Sun, Moon, Lock, LogOut,
  Sparkles, ShieldCheck
} from 'lucide-react';
import { NavSectionConfig } from './navConfig';
import { User } from '../../types';
import { Badge } from '../ui/Badge';
import { getInitialTheme, toggleTheme } from '../../lib/theme';
import { useTranslation } from '../../lib/i18n';

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sections: NavSectionConfig[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: User;
  onLockSession?: () => void;
  onLogout?: () => void;
  onOpenUserProfile?: () => void;
  onOpenReportIssue?: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  sections,
  activeTab,
  onTabChange,
  currentUser,
  onLockSession,
  onLogout,
  onOpenUserProfile,
  onOpenReportIssue,
}) => {
  const { language, setLanguage, t, isRtl, formatNumber } = useTranslation();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [isDark, setIsDark] = useState<boolean>(() => getInitialTheme() === 'dark');

  // Listen to theme change events
  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail?.theme) {
        setIsDark(e.detail.theme === 'dark');
      }
    };
    window.addEventListener('mmba-theme-change', handleThemeChange);
    return () => window.removeEventListener('mmba-theme-change', handleThemeChange);
  }, []);

  const handleToggleTheme = () => {
    const next = toggleTheme();
    setIsDark(next === 'dark');
  };

  // Prevent background body scrolling while drawer is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleItemClick = (tabId: string) => {
    onTabChange(tabId);
    onClose();
  };

  const handleOpenProfileModal = () => {
    onClose();
    if (onOpenUserProfile) {
      onOpenUserProfile();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed inset-0 z-50 md:hidden flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer container */}
          <motion.aside
            initial={{ x: isRtl ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: isRtl ? '100%' : '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className={`relative w-[300px] max-w-[85vw] h-full bg-white dark:bg-slate-950 ${
              isRtl ? 'border-l' : 'border-r'
            } border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 select-none overflow-hidden`}
            aria-label="Mobile Navigation"
          >
            {/* Header / Brand */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center shrink-0">
                  <img 
                    src="/logo.svg" 
                    alt="MMBA PANEL" 
                    className="h-12 w-auto object-contain"
                  />
                </div>
                <div>
                  <div className="font-extrabold text-slate-900 dark:text-white text-sm">MMBA PANEL</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">سامانه هوشمند مدیریت ارتباطات و اسناد</div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Language & Theme Switcher Bar */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
              {/* Language Switch */}
              <div className="flex items-center rounded-lg bg-slate-200 dark:bg-slate-800 p-0.5 font-bold text-[11px]">
                <button
                  type="button"
                  onClick={() => setLanguage('fa')}
                  className={`px-2 py-1 rounded-md transition-all ${
                    language === 'fa' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  فارسی
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-1 rounded-md transition-all ${
                    language === 'en' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  EN
                </button>
              </div>

              {/* Theme Switch */}
              <button
                type="button"
                onClick={handleToggleTheme}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors font-medium text-[11px]"
              >
                {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
                <span>{isDark ? t('header.themeLight') : t('header.themeDark')}</span>
              </button>
            </div>

            {/* Navigation Sections */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
              {(sections || []).map((section) => {
                const isCollapsed = !!collapsedSections[section.id];
                const sectionTitle = t(section.titleKey) || (language === 'fa' ? section.defaultTitleFa : section.defaultTitleEn);
                const sectionItems = section.items || [];

                return (
                  <div key={section.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider transition-colors rounded-lg text-start"
                    >
                      <span>{sectionTitle}</span>
                      {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    </button>

                    {!isCollapsed && (
                      <div className="space-y-0.5">
                        {sectionItems.map((item) => {
                          const Icon = item.icon;
                          const isActive = activeTab === item.id;
                          const itemTitle = t(item.titleKey) || (language === 'fa' ? item.defaultTitleFa : item.defaultTitleEn);

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleItemClick(item.id)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                                isActive
                                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                                <span className="truncate">{itemTitle}</span>
                              </div>

                              {item.badge && (
                                <Badge
                                  variant={isActive ? 'default' : item.badgeVariant || 'default'}
                                  size="sm"
                                  className={isActive ? 'bg-white/20 text-white border-transparent' : ''}
                                >
                                  {formatNumber(item.badge)}
                                </Badge>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* User Profile Footer */}
            {currentUser && (
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleOpenProfileModal}
                  className="flex items-center gap-2.5 min-w-0 text-start hover:opacity-80 transition-opacity"
                >
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-200 dark:border-indigo-800 shrink-0 overflow-hidden">
                    {currentUser.avatar ? (
                      <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                    ) : (
                      currentUser.name.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{currentUser.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{currentUser.username}</div>
                  </div>
                </button>

                <div className="flex items-center gap-1">
                  {onLockSession && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onLockSession();
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
                      title={t('profile.lockSession')}
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onLogout();
                      }}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      title={t('profile.logout')}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
