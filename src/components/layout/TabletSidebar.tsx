import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavSectionConfig } from './navConfig';
import { Badge } from '../ui/Badge';
import { useTranslation } from '../../lib/i18n';

export interface TabletSidebarProps {
  sections: NavSectionConfig[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TabletSidebar: React.FC<TabletSidebarProps> = ({
  sections,
  activeTab,
  onTabChange,
}) => {
  const { language, t, isRtl, formatNumber } = useTranslation();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  return (
    <aside
      className={`hidden md:flex lg:hidden bg-white dark:bg-slate-950 border-e border-slate-200 dark:border-slate-800 flex-col h-full min-h-0 overflow-hidden shrink-0 transition-all duration-300 z-20 select-none ${
        isExpanded ? 'w-56' : 'w-[64px]'
      }`}
      aria-label={t('nav.group.main')}
    >
      {/* Items Scroll Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-none py-3">
        {(sections || []).map((section, sectionIdx) => {
          const sectionTitle = t(section.titleKey) || (language === 'fa' ? section.defaultTitleFa : section.defaultTitleEn);
          const sectionItems = section.items || [];

          return (
            <div key={section.id} className="space-y-1">
              {/* Section Header */}
              {isExpanded ? (
                <div className="px-2 py-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate text-start">
                  {sectionTitle}
                </div>
              ) : (
                sectionIdx > 0 && (
                  <div className="flex items-center justify-center my-1.5">
                    <div className="w-5 h-[1px] bg-slate-200 dark:bg-slate-800" />
                  </div>
                )
              )}

              {/* Nav Items */}
              <div className="space-y-0.5">
                {sectionItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const itemTitle = t(item.titleKey) || (language === 'fa' ? item.defaultTitleFa : item.defaultTitleEn);

                  return (
                    <div
                      key={item.id}
                      className="relative flex items-center"
                      onMouseEnter={() => setHoveredItemId(item.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                    >
                      <button
                        type="button"
                        onClick={() => onTabChange(item.id)}
                        title={!isExpanded ? itemTitle : undefined}
                        className={`w-full min-h-[40px] flex items-center rounded-xl text-xs font-medium transition-all group relative ${
                          isExpanded ? 'px-2.5 py-2 justify-between gap-2' : 'justify-center p-2'
                        } ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <div className={`flex items-center ${isExpanded ? 'gap-2.5 truncate' : 'justify-center'}`}>
                          <div className="relative flex items-center justify-center">
                            <Icon
                              className={`w-4 h-4 transition-transform group-hover:scale-110 shrink-0 ${
                                isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                              }`}
                            />

                            {/* Floating Badge Counter in Compact Mode */}
                            {!isExpanded && item.badge && (
                              <span className="absolute -top-1.5 -end-1.5 min-w-[15px] h-3.5 px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-mono font-bold flex items-center justify-center border border-white dark:border-slate-950 shadow-xs">
                                {formatNumber(item.badge)}
                              </span>
                            )}
                          </div>

                          {isExpanded && (
                            <span className="truncate text-start">{itemTitle}</span>
                          )}
                        </div>

                        {isExpanded && item.badge && (
                          <Badge
                            variant={isActive ? 'default' : item.badgeVariant || 'default'}
                            size="sm"
                            className={isActive ? 'bg-white/20 text-white border-transparent' : ''}
                          >
                            {formatNumber(item.badge)}
                          </Badge>
                        )}
                      </button>

                      {/* Tooltip on Compact Hover */}
                      {!isExpanded && hoveredItemId === item.id && (
                        <div
                          className={`absolute ${
                            isRtl ? 'right-[calc(100%+8px)]' : 'left-[calc(100%+8px)]'
                          } z-50 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold shadow-xl whitespace-nowrap pointer-events-none animate-fadeIn border border-slate-700`}
                        >
                          {itemTitle}
                          {item.badge && (
                            <span className="ms-1.5 px-1 rounded bg-indigo-500 text-[10px]">
                              {formatNumber(item.badge)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expand / Collapse toggle footer */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center py-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          title={isExpanded ? (isRtl ? 'بستن منو' : 'Collapse') : (isRtl ? 'باز کردن منو' : 'Expand')}
        >
          {isExpanded ? (
            isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
          ) : (
            isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
};
