import React, { useMemo } from 'react';
import {
  Customer, Call, Task, Payment, CheckItem, Contract, SimCard, RepairTicket, VoiceNote
} from '../../types';
import {
  AlertTriangle, CheckCircle2, Clock, PhoneCall,
  CreditCard, Wrench, Smartphone, Users, TrendingUp,
  ArrowUpRight, Plus, Sparkles, CheckSquare, FileText,
  DollarSign, Mic, Volume2
} from 'lucide-react';
import { canViewTask } from '../../lib/permissions';
import { storage } from '../../services/storage';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ExportExcelButton } from '../ui/ExportExcelButton';
import { exportDashboardReportToExcel } from '../../lib/exportToExcel';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate, getRelativeTimeFa, isOverdue, isToday } from '../../lib/dateUtils';

export interface DashboardOverviewProps {
  customers: Customer[];
  calls: Call[];
  voiceNotes?: VoiceNote[];
  tasks: Task[];
  payments: Payment[];
  checks: CheckItem[];
  contracts: Contract[];
  sims: SimCard[];
  repairs: RepairTicket[];
  onNavigate: (tab: string) => void;
  onSelectCustomer: (customerId: string) => void;
  onQuickCall: () => void;
  onQuickVoiceNote?: () => void;
  onQuickTask: () => void;
  onQuickCustomer: () => void;
  onQuickPayment: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  customers = [],
  calls = [],
  voiceNotes = [],
  tasks = [],
  payments = [],
  checks = [],
  contracts = [],
  sims = [],
  repairs = [],
  onNavigate,
  onSelectCustomer,
  onQuickCall,
  onQuickVoiceNote,
  onQuickTask,
  onQuickCustomer,
  onQuickPayment,
}) => {
  const { language, t, isRtl, formatNumber, formatCurrency } = useTranslation();
  const currentUser = storage.getCurrentUser();

  const allowedTasks = useMemo(() => {
    return (tasks || []).filter((t) => canViewTask(currentUser, t));
  }, [tasks, currentUser]);

  // Urgent Items
  const overdueTasks = useMemo(() => {
    return allowedTasks.filter((t) => t.status !== 'COMPLETED' && isOverdue(t.dueDate));
  }, [allowedTasks]);

  const todayTasks = useMemo(() => {
    return allowedTasks.filter((t) => t.status !== 'COMPLETED' && isToday(t.dueDate));
  }, [allowedTasks]);

  const pendingChecks = useMemo(() => {
    return (checks || []).filter((c) => c.status === 'IN_SAFE' || c.status === 'DEPOSITED');
  }, [checks]);

  const urgentRepairs = useMemo(() => {
    return (repairs || []).filter((r) => r.status === 'RECEIVED' || r.status === 'IN_PROGRESS');
  }, [repairs]);

  // Financial Snapshot
  const totalRevenue = useMemo(() => {
    return (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  const availableSimCount = useMemo(() => {
    return (sims || []).filter((s) => s.status === 'AVAILABLE').length;
  }, [sims]);

  const handleExportDashboard = () => {
    return exportDashboardReportToExcel({
      stats: {
        [t('dashboard.activeCustomers')]: customers.length,
        [t('dashboard.totalRevenue')]: totalRevenue,
        [t('dashboard.pendingTasks')]: allowedTasks.filter((t) => t.status !== 'COMPLETED').length,
        [t('tasks.overdue')]: overdueTasks.length,
        [t('dashboard.simsInStock')]: availableSimCount,
        [t('dashboard.activeRepairs')]: urgentRepairs.length,
        [t('dashboard.checksInSafe')]: pendingChecks.length,
      },
      recentCustomers: customers.slice(0, 15),
      recentPayments: payments.slice(0, 15),
      upcomingTasks: allowedTasks.slice(0, 15),
      activeRepairs: repairs.slice(0, 15) as any,
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner with Brand Tagline & Quick Actions */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100">
              {t('dashboard.title')}
            </h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
              MMBA OS
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t('dashboard.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <ExportExcelButton
            onExport={handleExportDashboard}
            label={t('common.export')}
            variant="outline"
            className="flex-1 sm:flex-none"
          />

          {onQuickVoiceNote && (
            <Button
              variant="danger"
              size="sm"
              onClick={onQuickVoiceNote}
              leftIcon={<Mic className="w-4 h-4" />}
              className="flex-1 sm:flex-none font-bold"
            >
              {t('header.recordVoice')}
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={onQuickCall}
            leftIcon={<PhoneCall className="w-4 h-4" />}
            className="flex-1 sm:flex-none shadow-indigo-600/20 font-bold"
          >
            {t('header.logCall')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onQuickTask}
            leftIcon={<Plus className="w-4 h-4 text-emerald-500" />}
            className="flex-1 sm:flex-none"
          >
            {t('header.newTask')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onQuickPayment}
            leftIcon={<DollarSign className="w-4 h-4 text-amber-500" />}
            className="flex-1 sm:flex-none"
          >
            {t('header.newPayment')}
          </Button>
        </div>
      </div>

      {/* Critical Alerts & Immediate Attention Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
              {t('dashboard.criticalAlerts')}
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {formatNumber(overdueTasks.length + pendingChecks.length + urgentRepairs.length)} {t('common.records')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Overdue Tasks Alert */}
          <div
            onClick={() => onNavigate('tasks')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer group shadow-xs ${
              overdueTasks.length > 0
                ? 'border-rose-200 dark:border-rose-500/30 hover:border-rose-300 dark:hover:border-rose-500/60 bg-rose-50/60 dark:bg-rose-950/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('tasks.overdue')}
              </span>
              <Badge variant={overdueTasks.length > 0 ? 'danger' : 'success'} size="sm" dot>
                {formatNumber(overdueTasks.length)} {t('nav.tasks')}
              </Badge>
            </div>
            <div className="mt-3">
              {overdueTasks.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300 truncate">
                    {overdueTasks[0].title}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'fa'
                      ? `سررسید: ${getRelativeTimeFa(overdueTasks[0].dueDate)}`
                      : `Due: ${overdueTasks[0].dueDate}`}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs py-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{language === 'fa' ? 'هیچ اقدام معوقی وجود ندارد.' : 'No overdue tasks.'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Pending Checks in Safe */}
          <div
            onClick={() => onNavigate('checks')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer group shadow-xs ${
              pendingChecks.length > 0
                ? 'border-amber-200 dark:border-amber-500/30 hover:border-amber-300 dark:hover:border-amber-500/60 bg-amber-50/60 dark:bg-amber-950/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('dashboard.checksInSafe')}
              </span>
              <Badge variant={pendingChecks.length > 0 ? 'warning' : 'success'} size="sm" dot>
                {formatNumber(pendingChecks.length)} {t('nav.checks')}
              </Badge>
            </div>
            <div className="mt-3">
              {pendingChecks.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300 truncate">
                    {formatCurrency(pendingChecks[0].amount)} ({pendingChecks[0].bankName})
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'fa'
                      ? `سررسید: ${formatPersianDate(pendingChecks[0].dueDate)}`
                      : `Due: ${pendingChecks[0].dueDate}`}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs py-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{language === 'fa' ? 'تمامی چک‌ها وصول شده‌اند.' : 'All checks cleared.'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Active Hardware Repairs */}
          <div
            onClick={() => onNavigate('repairs')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer group shadow-xs ${
              urgentRepairs.length > 0
                ? 'border-indigo-200 dark:border-indigo-500/30 hover:border-indigo-300 dark:hover:border-indigo-500/60 bg-indigo-50/60 dark:bg-indigo-950/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('dashboard.activeRepairs')}
              </span>
              <Badge variant={urgentRepairs.length > 0 ? 'info' : 'success'} size="sm" dot>
                {formatNumber(urgentRepairs.length)} {t('nav.repairs')}
              </Badge>
            </div>
            <div className="mt-3">
              {urgentRepairs.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-bold text-indigo-700 dark:text-indigo-300 truncate">
                    {urgentRepairs[0].deviceModel} ({urgentRepairs[0].customerName})
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {urgentRepairs[0].problemDescription}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs py-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{language === 'fa' ? 'دستگاه بلاتکلیفی در تعمیرگاه نیست.' : 'No pending repairs.'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Customers Count */}
        <div
          onClick={() => onNavigate('customers')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/60 cursor-pointer transition-all group space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('dashboard.activeCustomers')}
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {formatNumber(customers.length)}
          </div>
          <p className="text-[11px] text-slate-400">{t('customers.subtitle')}</p>
        </div>

        {/* Total Revenue */}
        <div
          onClick={() => onNavigate('finances')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/60 cursor-pointer transition-all group space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('dashboard.totalRevenue')}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalRevenue)}
          </div>
          <p className="text-[11px] text-slate-400">
            {formatNumber(payments.length)} {t('common.records')}
          </p>
        </div>

        {/* SIM Cards In Stock */}
        <div
          onClick={() => onNavigate('sims')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700/60 cursor-pointer transition-all group space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('dashboard.simsInStock')}
            </span>
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
            {formatNumber(availableSimCount)}
          </div>
          <p className="text-[11px] text-slate-400">{t('sims.subtitle')}</p>
        </div>

        {/* Contracts Count */}
        <div
          onClick={() => onNavigate('contracts')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700/60 cursor-pointer transition-all group space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('nav.contracts')}
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-700 dark:text-purple-300">
            {formatNumber(contracts.length)}
          </div>
          <p className="text-[11px] text-slate-400">{t('contracts.subtitle')}</p>
        </div>
      </div>

      {/* Two columns: Today's Tasks Agenda & Recent Calls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Tasks Agenda */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              <span>{t('dashboard.todayAgenda')} ({formatNumber(todayTasks.length)})</span>
            </h3>
            <Button variant="ghost" size="xs" onClick={() => onNavigate('tasks')}>
              {t('dashboard.viewAll')}
            </Button>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs">
            {todayTasks.length === 0 ? (
              <div className="text-center py-6 text-slate-400 space-y-1">
                <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500/60 mb-1" />
                <p className="text-xs font-medium">{t('dashboard.noTasksToday')}</p>
              </div>
            ) : (
              todayTasks.map((taskItem) => (
                <div
                  key={taskItem.id}
                  onClick={() => onNavigate('tasks')}
                  className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {taskItem.title}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {taskItem.customerName ? `${t('common.customer')}: ${taskItem.customerName} • ` : ''}
                        {t('tasks.assignee')}: {taskItem.assignedUserName}
                      </p>
                    </div>
                  </div>
                  <Badge variant={taskItem.priority === 'URGENT' ? 'danger' : 'warning'} size="sm">
                    {taskItem.priority}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Calls & Negotiations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-sky-500" />
              <span>{t('dashboard.recentCalls')} ({formatNumber(calls.length)})</span>
            </h3>
            <Button variant="ghost" size="xs" onClick={() => onNavigate('calls')}>
              {t('dashboard.viewAll')}
            </Button>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs">
            {calls.slice(0, 4).map((cl) => (
              <div
                key={cl.id}
                onClick={() => {
                  if (cl.customerId) onSelectCustomer(cl.customerId);
                  else onNavigate('calls');
                }}
                className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sky-500 shrink-0 mt-0.5">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                        {cl.customerName || t('common.customer')}
                      </span>
                      <Badge variant="purple" size="sm">
                        {cl.callType}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5 truncate">
                      {cl.subject}
                    </p>
                    {cl.notes && (
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                        {cl.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 shrink-0">
                  <span>{language === 'fa' ? getRelativeTimeFa(cl.createdAt) : cl.createdAt?.substring(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
