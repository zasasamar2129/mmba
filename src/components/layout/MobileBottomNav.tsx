import React from 'react';
import { LayoutDashboard, Users, PhoneCall, CheckSquare, Menu } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

export interface MobileBottomNavProps {
  activeModule: string;
  onSelectModule: (module: string) => void;
  onOpenQuickCall: () => void;
  onToggleMenu: () => void;
  overdueTasksCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeModule,
  onSelectModule,
  onOpenQuickCall,
  onToggleMenu,
  overdueTasksCount = 0,
}) => {
  const { t } = useTranslation();

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 liquid-glass border-t border-slate-800/90 py-1.5 px-3 flex items-center justify-around pb-safe">
      <button
        type="button"
        onClick={() => onSelectModule('DASHBOARD')}
        className={`flex flex-col items-center gap-1 p-1.5 min-w-[54px] rounded-xl transition-colors ${
          activeModule === 'DASHBOARD' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px]">{t('nav.dashboard')}</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectModule('CUSTOMERS')}
        className={`flex flex-col items-center gap-1 p-1.5 min-w-[54px] rounded-xl transition-colors ${
          activeModule === 'CUSTOMERS' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Users className="w-5 h-5" />
        <span className="text-[10px]">{t('nav.customers')}</span>
      </button>

      {/* Center prominent Quick Call Button */}
      <button
        type="button"
        onClick={onOpenQuickCall}
        className="flex flex-col items-center justify-center -mt-5 w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/40 border-2 border-slate-900 active:scale-95 transition-transform"
        aria-label={t('header.logCall')}
      >
        <PhoneCall className="w-5 h-5" />
      </button>

      <button
        type="button"
        onClick={() => onSelectModule('TASKS')}
        className={`relative flex flex-col items-center gap-1 p-1.5 min-w-[54px] rounded-xl transition-colors ${
          activeModule === 'TASKS' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <CheckSquare className="w-5 h-5" />
        <span className="text-[10px]">{t('nav.tasks')}</span>
        {overdueTasksCount > 0 && (
          <span className="absolute top-1 end-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-950" />
        )}
      </button>

      <button
        type="button"
        onClick={onToggleMenu}
        className="flex flex-col items-center gap-1 p-1.5 min-w-[54px] rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px]">{t('common.more')}</span>
      </button>
    </div>
  );
};
