import React, { useState, useMemo } from 'react';
import {
  Customer, Call, Task, Payment, CheckItem, Contract, SimCard, RepairTicket
} from '../../types';
import {
  BarChart3, TrendingUp, Users, DollarSign, Smartphone, Wrench,
  Calendar, CheckCircle2, ArrowUpRight, ArrowDownRight, PieChart as PieIcon, Download
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ExportExcelButton } from '../ui/ExportExcelButton';
import { RTLNumber } from '../ui/RTLNumber';
import { exportToExcel } from '../../lib/exportToExcel';
import { formatToman } from '../../lib/currencyUtils';
import { useTranslation } from '../../lib/i18n';

export interface ReportsDashboardProps {
  customers: Customer[];
  calls: Call[];
  tasks: Task[];
  payments: Payment[];
  checks: CheckItem[];
  contracts: Contract[];
  sims: SimCard[];
  repairs: RepairTicket[];
}

export const ReportsDashboard: React.FC<ReportsDashboardProps> = ({
  customers,
  calls,
  tasks,
  payments,
  checks,
  contracts,
  sims,
  repairs,
}) => {
  const { t, isRtl, formatCurrency } = useTranslation();
  const [dateRange, setDateRange] = useState<'all' | 'month' | 'quarter'>('all');

  // Stats calculation
  const totalRevenue = useMemo(() => {
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  const totalChecksInSafe = useMemo(() => {
    return checks
      .filter((c) => c.status === 'IN_SAFE' || c.status === 'DEPOSITED')
      .reduce((sum, c) => sum + (c.amount || 0), 0);
  }, [checks]);

  const totalContractsValue = useMemo(() => {
    return contracts.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
  }, [contracts]);

  const completedTasksRatio = useMemo(() => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  const totalSimInventoryValue = useMemo(() => {
    return sims
      .filter((s) => s.status === 'AVAILABLE')
      .reduce((sum, s) => sum + (s.salePrice || 0), 0);
  }, [sims]);

  // Lead stages distribution
  const leadStagesCount = useMemo(() => {
    const counts: Record<string, number> = {};
    customers.forEach((c) => {
      counts[c.leadStage] = (counts[c.leadStage] || 0) + 1;
    });
    return counts;
  }, [customers]);

  // Operator distribution
  const operatorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    sims.forEach((s) => {
      counts[s.operator] = (counts[s.operator] || 0) + 1;
    });
    return counts;
  }, [sims]);

  return (
    <div className="space-y-6 animate-blur-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {t('reports.title')}
            </h1>
            <Badge variant="indigo" size="sm">
              BI & Analytics
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('reports.subtitle')}
          </p>
        </div>

        <ExportExcelButton
          onExport={() => {
            const summaryRows = [
              { [t('reports.kpiCol')]: t('reports.totalRevenueKPI'), [t('reports.valueCol')]: totalRevenue, [t('reports.unitCol')]: isRtl ? 'تومان' : 'Toman' },
              { [t('reports.kpiCol')]: t('reports.checksInSafeKPI'), [t('reports.valueCol')]: totalChecksInSafe, [t('reports.unitCol')]: isRtl ? 'تومان' : 'Toman' },
              { [t('reports.kpiCol')]: t('reports.contractsValueKPI'), [t('reports.valueCol')]: totalContractsValue, [t('reports.unitCol')]: isRtl ? 'تومان' : 'Toman' },
              { [t('reports.kpiCol')]: t('reports.simInventoryValueKPI'), [t('reports.valueCol')]: totalSimInventoryValue, [t('reports.unitCol')]: isRtl ? 'تومان' : 'Toman' },
              { [t('reports.kpiCol')]: t('reports.taskCompletionRate'), [t('reports.valueCol')]: `${completedTasksRatio}%`, [t('reports.unitCol')]: '%' },
              { [t('reports.kpiCol')]: t('reports.totalCustomersCount'), [t('reports.valueCol')]: customers.length, [t('reports.unitCol')]: isRtl ? 'مشتری' : 'Customers' },
              { [t('reports.kpiCol')]: t('reports.totalCallsCount'), [t('reports.valueCol')]: calls.length, [t('reports.unitCol')]: isRtl ? 'مکالمه' : 'Calls' },
              { [t('reports.kpiCol')]: t('reports.totalRepairsCount'), [t('reports.valueCol')]: repairs.length, [t('reports.unitCol')]: isRtl ? 'قبض' : 'Tickets' },
            ];
            exportToExcel(summaryRows, isRtl ? 'خلاصه_گزارشات_مدیریتی_MMBA' : 'MMBA_Management_Reports');
          }}
          label={t('reports.exportExcelBtn')}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-4 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-2 ${isRtl ? 'text-right' : 'text-left'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('reports.totalRevenueKPI')}</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            <RTLNumber value={totalRevenue} type="price" />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('reports.revenueSub')}</p>
        </div>

        <div className={`p-4 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-2 ${isRtl ? 'text-right' : 'text-left'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('reports.checksInSafeKPI')}</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
            <RTLNumber value={totalChecksInSafe} type="price" />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('reports.checksInSafeSub')}</p>
        </div>

        <div className={`p-4 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-2 ${isRtl ? 'text-right' : 'text-left'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('reports.contractsValueKPI')}</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-300">
            <RTLNumber value={totalContractsValue} type="price" />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400"><RTLNumber value={contracts.length} type="count" suffix={isRtl ? 'فقره قرارداد رسمی' : 'contracts'} /></p>
        </div>

        <div className={`p-4 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-2 ${isRtl ? 'text-right' : 'text-left'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('reports.taskCompletionRate')}</span>
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-300">
            <RTLNumber value={completedTasksRatio} type="percentage" />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{isRtl ? `از مجموع ${tasks.length} اقدام تعریف شده` : `Out of ${tasks.length} total tasks`}</p>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Pipeline Breakdown */}
        <div className={`p-5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-4 ${isRtl ? 'text-right' : 'text-left'}`}>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{t('reports.leadsPipeline')}</span>
            </h3>
            <Badge variant="indigo" size="sm">
              <RTLNumber value={customers.length} type="count" suffix={isRtl ? 'مشتری' : 'customers'} />
            </Badge>
          </div>

          <div className="space-y-3">
            {[
              { stage: 'LEAD', label: t('customers.leadStages.lead'), color: 'bg-slate-500' },
              { stage: 'CONTACTED', label: t('customers.leadStages.contacted'), color: 'bg-sky-500' },
              { stage: 'PROPOSAL_SENT', label: t('customers.leadStages.proposal_sent'), color: 'bg-indigo-500' },
              { stage: 'NEGOTIATION', label: t('customers.leadStages.negotiation'), color: 'bg-amber-500' },
              { stage: 'WON', label: t('customers.leadStages.won'), color: 'bg-emerald-500' },
              { stage: 'LOST', label: t('customers.leadStages.lost'), color: 'bg-rose-500' },
            ].map((st) => {
              const count = leadStagesCount[st.stage] || 0;
              const percent = customers.length > 0 ? Math.round((count / customers.length) * 100) : 0;

              return (
                <div key={st.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{st.label}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-200">
                      <RTLNumber value={count} type="count" suffix={isRtl ? 'نفر' : ''} /> ({percent}٪)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${st.color} rounded-full transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SIM Inventory & Hardware Summary */}
        <div className={`p-5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-4 ${isRtl ? 'text-right' : 'text-left'}`}>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{t('reports.simAndTechDistribution')}</span>
            </h3>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
              {t('reports.inventoryValue')}: <RTLNumber value={totalSimInventoryValue} type="price" />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t('reports.mciSims')}</span>
              <div className="text-lg font-black text-teal-600 dark:text-teal-400">
                <RTLNumber value={operatorCounts['MCI'] || 0} type="count" suffix={isRtl ? 'خط' : 'lines'} />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t('reports.otherSims')}</span>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400">
                <RTLNumber value={(operatorCounts['IRANCELL'] || 0) + (operatorCounts['RIGHTEL'] || 0)} type="count" suffix={isRtl ? 'خط' : 'lines'} />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t('reports.activeRepairsCount')}</span>
              <div className="text-lg font-black text-indigo-600 dark:text-indigo-300">
                <RTLNumber value={repairs.filter((r) => r.status !== 'DELIVERED').length} type="count" suffix={isRtl ? 'دستگاه' : 'devices'} />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t('reports.loggedCallsCount')}</span>
              <div className="text-lg font-black text-sky-600 dark:text-sky-400">
                <RTLNumber value={calls.length} type="count" suffix={isRtl ? 'تماس' : 'calls'} />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/20 text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
            💡 <strong>{t('reports.aiInsightTitle')}:</strong> {t('reports.aiInsightDesc')}
          </div>
        </div>
      </div>
    </div>
  );
};
