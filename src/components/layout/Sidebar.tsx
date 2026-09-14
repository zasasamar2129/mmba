import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Lock, LogOut, Shield } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { User } from '../../types';
import { getNavSections } from './navConfig';
import { TabletSidebar } from './TabletSidebar';
import { MobileDrawer } from './MobileDrawer';
import { useTranslation } from '../../lib/i18n';

export interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: User;
  tasksCount?: number;
  checksCount?: number;
  repairsCount?: number;
  voiceNotesCount?: number;
  inboxUnreadCount?: number;
  chatUnreadCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onLockSession?: () => void;
  onLogout?: () => void;
  onOpenUserProfile?: () => void;
  onOpenReportIssue?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  tasksCount = 0,
  checksCount = 0,
  repairsCount = 0,
  voiceNotesCount = 0,
  inboxUnreadCount = 0,
  chatUnreadCount = 0,
  isMobileOpen = false,
  onCloseMobile = () => {},
  onLockSession,
  onLogout,
  onOpenUserProfile,
  onOpenReportIssue,
}) => {
  const { language, t, isRtl, formatNumber } = useTranslation();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const navSections = getNavSections(
    currentUser,
    {
      tasksCount,
      checksCount,
      repairsCount,
      voiceNotesCount,
      inboxUnreadCount,
      chatUnreadCount,
    },
    language
  );

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <>
      {/* 1. Mobile Drawer */}
      <MobileDrawer
        isOpen={isMobileOpen}
        onClose={onCloseMobile}
        sections={navSections}
        activeTab={activeTab}
        onTabChange={onTabChange}
        currentUser={currentUser}
        onLockSession={onLockSession}
        onLogout={onLogout}
        onOpenUserProfile={onOpenUserProfile}
        onOpenReportIssue={onOpenReportIssue}
      />

      {/* 2. Tablet Sidebar */}
      <TabletSidebar
        sections={navSections}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />

      {/* 3. Desktop Sidebar */}
      <aside
        className="hidden lg:flex w-60 xl:w-64 bg-white dark:bg-slate-950 border-e border-slate-200 dark:border-slate-800 flex-col h-full min-h-0 overflow-hidden shrink-0 select-none transition-colors z-20"
        aria-label={t('nav.group.main')}
      >
        {/* Navigation Item List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3.5 scrollbar-thin">
          {(navSections || []).map((section) => {
            const isCollapsed = !!collapsedGroups[section.id];
            const sectionTitle = t(section.titleKey) || (language === 'fa' ? section.defaultTitleFa : section.defaultTitleEn);
            const sectionItems = section.items || [];
            const hasActiveItem = sectionItems.some((i) => i.id === activeTab);

            return (
              <div key={section.id} className="space-y-1">
                {/* Group Heading with collapse button */}
                <button
                  type="button"
                  onClick={() => toggleGroup(section.id)}
                  className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 uppercase tracking-wider transition-colors rounded-lg group"
                >
                  <span className={hasActiveItem ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : ''}>
                    {sectionTitle}
                  </span>
                  <div className="text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-transform">
                    {isCollapsed ? (
                      isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </div>
                </button>

                {/* Items */}
                {!isCollapsed && (
                  <div className="space-y-0.5 animate-fadeIn">
                    {sectionItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      const itemTitle = t(item.titleKey) || (language === 'fa' ? item.defaultTitleFa : item.defaultTitleEn);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onTabChange(item.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group relative ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900'
                          }`}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                                isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                              }`}
                            />
                            <span className="truncate">{itemTitle}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.badge && (
                              <Badge
                                variant={isActive ? 'default' : item.badgeVariant || 'default'}
                                size="sm"
                                className={isActive ? 'bg-white/20 text-white border-transparent' : ''}
                              >
                                {formatNumber(item.badge)}
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer with user quick info & actions */}
        {currentUser && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onOpenUserProfile}
              className="flex items-center gap-2.5 min-w-0 text-start hover:opacity-85 transition-opacity"
              title={t('profile.title')}
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-200 dark:border-indigo-800 shrink-0 overflow-hidden">
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  currentUser.name.charAt(0)
                )}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{currentUser.name}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{currentUser.username}</div>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              {onLockSession && (
                <button
                  type="button"
                  onClick={onLockSession}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  title={t('profile.lockSession')}
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>
              )}
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title={t('profile.logout')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
