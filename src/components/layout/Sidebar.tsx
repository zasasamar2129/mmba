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
        className="hidden lg:flex w-60 xl:w-64 bg-[#0e1017] border-e border-white/[0.06] flex-col h-full min-h-0 overflow-hidden shrink-0 select-none transition-colors z-20"
        aria-label={isRtl ? 'ناوبری اصلی' : 'Main navigation'}
      >
        {/* Brand Logo at Top of Sidebar */}
        <div className="p-4 pb-2 flex items-center gap-3 border-b border-white/[0.05]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white font-black text-base shadow-lg shadow-violet-600/30">
            M
          </div>
          <div>
            <div className="font-black text-sm tracking-wide text-white flex items-center gap-1.5">
              <span>MMBA</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-violet-500/20 text-violet-300 font-bold">OS</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">Business Security & ERP</div>
          </div>
        </div>

        {/* Navigation Item List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3.5 scrollbar-none no-scrollbar">
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
                  aria-expanded={!isCollapsed}
                  className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider transition-colors rounded-lg group"
                >
                  <span className={hasActiveItem ? 'text-violet-400 font-extrabold' : ''}>
                    {sectionTitle}
                  </span>
                  <div className="opacity-60 group-hover:opacity-100 transition-transform">
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
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative ${
                            isActive
                              ? 'bg-[#8b5cf6] text-white shadow-lg shadow-purple-600/30 font-bold'
                              : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                          }`}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                                isActive ? 'text-white' : 'text-slate-400 group-hover:text-violet-400'
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

          {/* Bottom Security / Upgrade Feature Card (Counterpart of sidebar banner in screenshot) */}
          <div className="pt-2">
            <div className="rounded-2xl p-3.5 bg-gradient-to-b from-[#181a29] to-[#121422] border border-violet-500/20 text-center space-y-2 relative overflow-hidden shadow-lg shadow-black/40">
              <div className="w-8 h-8 mx-auto rounded-full bg-violet-600/20 text-violet-400 flex items-center justify-center border border-violet-500/30">
                <Shield className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-200">
                  {isRtl ? 'امنیت و پایش پیشرفته' : 'Advanced Operations'}
                </p>
                <p className="text-[10px] text-slate-400 line-clamp-2">
                  {isRtl ? 'سامانه یکپارچه هوشمند و رمزنگاری اسناد' : 'End-to-end security & automated workflows'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onTabChange('reports')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-400 hover:text-violet-300 transition-colors pt-1"
              >
                <span>{isRtl ? 'مشاهده گزارش‌ها' : 'Upgrade & View'}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer with user quick info & actions */}
        {currentUser && (
          <div className="p-3 border-t border-white/[0.06] bg-[#0c0d15] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onOpenUserProfile}
              className="flex items-center gap-2.5 min-w-0 text-start hover:opacity-85 transition-opacity"
              title={t('profile.title')}
            >
              <div className="w-8 h-8 rounded-xl bg-violet-950/80 text-violet-300 flex items-center justify-center font-bold text-xs border border-violet-800/60 shrink-0 overflow-hidden shadow-xs">
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  currentUser.name.charAt(0)
                )}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-100 truncate">{currentUser.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{currentUser.username}</div>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              {onLockSession && (
                <button
                  type="button"
                  onClick={onLockSession}
                  aria-label={t('profile.lockSession')}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label={t('profile.logout')}
                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
