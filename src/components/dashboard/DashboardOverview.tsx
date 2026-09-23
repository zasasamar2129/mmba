import React, { useState, useMemo } from 'react';
import {
  Customer, Call, Task, Payment, CheckItem, Contract, SimCard, RepairTicket, VoiceNote
} from '../../types';
import {
  AlertTriangle, CheckCircle2, Clock, PhoneCall,
  CreditCard, Wrench, Smartphone, Users, TrendingUp,
  ArrowUpRight, Plus, Sparkles, CheckSquare, FileText,
  DollarSign, Mic, MoreVertical, ShieldAlert, Activity,
  Layers, HardDrive, Cpu, Laptop, Terminal, Calendar,
  ChevronDown, ExternalLink, RefreshCw
} from 'lucide-react';
import { canViewTask } from '../../lib/permissions';
import { storage } from '../../services/storage';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ExportExcelButton } from '../ui/ExportExcelButton';
import { exportDashboardReportToExcel } from '../../lib/exportToExcel';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate, formatPersianShortDate, gregorianToJalali, isOverdue, isToday } from '../../lib/dateUtils';

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

  const [timeframePulse, setTimeframePulse] = useState<'all' | 'weekly' | 'daily'>('all');
  const [timeframeTable, setTimeframeTable] = useState<'all' | 'weekly' | 'daily'>('all');
  const [hoveredTrendMonth, setHoveredTrendMonth] = useState<number>(new Date().getMonth());

  // 1. FILTERED CORE METRICS
  const allowedTasks = useMemo(() => {
    return (tasks || []).filter((task) => canViewTask(currentUser, task));
  }, [tasks, currentUser]);

  const completedTasks = useMemo(() => {
    return allowedTasks.filter((task) => task.status === 'COMPLETED');
  }, [allowedTasks]);

  const pendingTasks = useMemo(() => {
    return allowedTasks.filter((task) => task.status !== 'COMPLETED');
  }, [allowedTasks]);

  const overdueTasks = useMemo(() => {
    return pendingTasks.filter((task) => isOverdue(task.dueDate));
  }, [pendingTasks]);

  const todayTasks = useMemo(() => {
    return pendingTasks.filter((task) => isToday(task.dueDate));
  }, [pendingTasks]);

  const activeContracts = useMemo(() => {
    return (contracts || []).filter((c) => c.status === 'ACTIVE');
  }, [contracts]);

  const pendingChecks = useMemo(() => {
    return (checks || []).filter((c) => c.status === 'IN_SAFE' || c.status === 'DEPOSITED');
  }, [checks]);

  const passedChecks = useMemo(() => {
    return (checks || []).filter((c) => c.status === 'PASSED');
  }, [checks]);

  const urgentRepairs = useMemo(() => {
    return (repairs || []).filter((r) => r.status === 'RECEIVED' || r.status === 'IN_PROGRESS');
  }, [repairs]);

  const completedRepairs = useMemo(() => {
    return (repairs || []).filter((r) => r.status === 'DELIVERED' || r.status === 'REPAIRED');
  }, [repairs]);

  const totalRevenue = useMemo(() => {
    return (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  const availableSimCount = useMemo(() => {
    return (sims || []).filter((s) => s.status === 'AVAILABLE').length;
  }, [sims]);

  // 2. DYNAMIC OPERATIONAL HEALTH SCORE (0 - 1000)
  const healthScore = useMemo(() => {
    let score = 500; // Base baseline

    // Task fulfillment factor (up to +180 points)
    if (allowedTasks.length > 0) {
      const taskCompletionRatio = completedTasks.length / allowedTasks.length;
      score += Math.round(taskCompletionRatio * 180);
    } else {
      score += 100;
    }

    // Overdue tasks penalty (up to -150 points)
    if (overdueTasks.length > 0) {
      score -= Math.min(overdueTasks.length * 25, 150);
    }

    // Cheques health factor (up to +150 points)
    if (checks.length > 0) {
      const checksPassRatio = passedChecks.length / checks.length;
      score += Math.round(checksPassRatio * 150);
    } else {
      score += 80;
    }

    // Active contracts factor (up to +150 points)
    if (contracts.length > 0) {
      const activeContractRatio = activeContracts.length / contracts.length;
      score += Math.round(activeContractRatio * 150);
    } else {
      score += 80;
    }

    // Customer & Repair satisfaction (up to +120 points)
    if (repairs.length > 0) {
      const repairFinishRatio = completedRepairs.length / repairs.length;
      score += Math.round(repairFinishRatio * 120);
    } else {
      score += 60;
    }

    return Math.max(150, Math.min(score, 990));
  }, [allowedTasks, completedTasks, overdueTasks, checks, passedChecks, contracts, activeContracts, repairs, completedRepairs]);

  const healthScoreStatus = useMemo(() => {
    if (healthScore >= 750) return { label: isRtl ? 'عالی / High' : 'Optimal', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40' };
    if (healthScore >= 550) return { label: isRtl ? 'مطلوب / Good' : 'Good', color: 'text-violet-400 bg-violet-500/20 border-violet-500/40' };
    if (healthScore >= 400) return { label: isRtl ? 'متوسط / Normal' : 'Normal', color: 'text-amber-400 bg-amber-500/20 border-amber-500/40' };
    return { label: isRtl ? 'نیازمند بررسی / Low' : 'Attention', color: 'text-rose-400 bg-rose-500/20 border-rose-500/40' };
  }, [healthScore, isRtl]);

  // 3. REAL MONTHLY AGGREGATIONS FOR TREND SPLINE CHART
  const trendMonthsFa = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const trendMonthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const months = language === 'fa' ? trendMonthsFa : trendMonthsEn;

  const monthlyStats = useMemo(() => {
    const monthlyRevenues = new Array(12).fill(0);
    const monthlyOperations = new Array(12).fill(0);

    const getMonthIndex = (dateStr?: string | Date | null): number => {
      if (!dateStr) return 0;
      try {
        const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        if (isNaN(d.getTime())) return 0;
        if (language === 'fa') {
          const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
          return Math.max(0, Math.min(j.jm - 1, 11));
        }
        return d.getMonth();
      } catch {
        return 0;
      }
    };

    (payments || []).forEach((p) => {
      const idx = getMonthIndex(p.date || p.createdAt);
      monthlyRevenues[idx] += p.amount || 0;
      monthlyOperations[idx] += 1;
    });

    (contracts || []).forEach((c) => {
      const idx = getMonthIndex(c.startDate || c.createdAt);
      monthlyOperations[idx] += 1;
    });

    (calls || []).forEach((cl) => {
      const idx = getMonthIndex(cl.createdAt);
      monthlyOperations[idx] += 1;
    });

    (repairs || []).forEach((r) => {
      const idx = getMonthIndex(r.createdAt);
      monthlyOperations[idx] += 1;
    });

    return { monthlyRevenues, monthlyOperations };
  }, [payments, contracts, calls, repairs, language]);

  // Compute SVG Points for the Spline
  const splineChartData = useMemo(() => {
    const maxVal = Math.max(...monthlyStats.monthlyRevenues, ...monthlyStats.monthlyOperations.map(o => o * 500000), 1000000);
    const points: Array<{ x: number; y: number; revenue: number; ops: number }> = [];

    const width = 1000;
    const height = 200;
    const padding = 20;

    for (let i = 0; i < 12; i++) {
      const x = (i / 11) * (width - padding * 2) + padding;
      const val = monthlyStats.monthlyRevenues[i] || (monthlyStats.monthlyOperations[i] * 500000);
      const normalizedY = height - padding - ((val / maxVal) * (height - padding * 2));
      points.push({
        x: Math.round(x),
        y: Math.round(Math.max(padding, Math.min(height - padding, normalizedY))),
        revenue: monthlyStats.monthlyRevenues[i],
        ops: monthlyStats.monthlyOperations[i],
      });
    }

    // Build cubic bezier path
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) / 2;
      const cy1 = p0.y;
      const cx2 = p0.x + (p1.x - p0.x) / 2;
      const cy2 = p1.y;
      d += ` C ${cx1},${cy1} ${cx2},${cy2} ${p1.x},${p1.y}`;
    }

    const areaPath = `${d} L ${points[11].x},${height} L ${points[0].x},${height} Z`;

    return { points, linePath: d, areaPath, maxVal };
  }, [monthlyStats]);

  // 4. REAL REVENUE & SERVICES BREAKDOWN (DONUT CHART)
  const breakdownStats = useMemo(() => {
    const crmCount = calls.length + (voiceNotes?.length || 0);
    const repairCount = repairs.length;
    const contractCount = contracts.length;
    const simCount = sims.length;

    const total = crmCount + repairCount + contractCount + simCount;
    const safeTotal = total > 0 ? total : 1;

    const crmPct = Math.round((crmCount / safeTotal) * 100);
    const repairPct = Math.round((repairCount / safeTotal) * 100);
    const contractPct = Math.round((contractCount / safeTotal) * 100);
    const simPct = Math.max(0, 100 - (crmPct + repairPct + contractPct));

    const radius = 58;
    const circumference = 2 * Math.PI * radius; // ~364.42

    const crmDash = (crmPct / 100) * circumference;
    const repairDash = (repairPct / 100) * circumference;
    const contractDash = (contractPct / 100) * circumference;
    const simDash = (simPct / 100) * circumference;

    const crmOffset = 0;
    const repairOffset = -crmDash;
    const contractOffset = -(crmDash + repairDash);
    const simOffset = -(crmDash + repairDash + contractDash);

    return {
      crmCount, repairCount, contractCount, simCount, total,
      crmPct, repairPct, contractPct, simPct,
      circumference,
      crmDash, repairDash, contractDash, simDash,
      crmOffset, repairOffset, contractOffset, simOffset,
    };
  }, [calls, voiceNotes, repairs, contracts, sims]);

  // 5. UNIFIED RECENT ACTIVITIES LIST (SORTED BY DATE)
  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string;
      timestamp: number;
      dateFormatted: string;
      customer: string;
      operation: string;
      department: string;
      status: string;
      statusColor: 'emerald' | 'violet' | 'amber' | 'sky' | 'rose';
      tab: string;
    }> = [];

    (payments || []).forEach((p) => {
      const dateObj = p.date ? new Date(p.date) : (p.createdAt ? new Date(p.createdAt) : new Date());
      const ts = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
      list.push({
        id: `pay-${p.id}`,
        timestamp: ts,
        dateFormatted: language === 'fa' ? formatPersianDate(dateObj) : formatPersianShortDate(dateObj),
        customer: p.customerName || (isRtl ? 'مشتری نامشخص' : 'Direct Customer'),
        operation: `${isRtl ? 'دریافت وجه' : 'Payment'}: ${formatCurrency(p.amount || 0)}`,
        department: isRtl ? 'امور مالی' : 'Finance',
        status: isRtl ? 'تسویه شده' : 'Cleared',
        statusColor: 'emerald',
        tab: 'finances'
      });
    });

    (contracts || []).forEach((c) => {
      const dateObj = c.startDate ? new Date(c.startDate) : (c.createdAt ? new Date(c.createdAt) : new Date());
      const ts = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
      list.push({
        id: `con-${c.id}`,
        timestamp: ts,
        dateFormatted: language === 'fa' ? formatPersianDate(dateObj) : formatPersianShortDate(dateObj),
        customer: c.customerName || (isRtl ? 'طرف قرارداد' : 'Contract Party'),
        operation: c.title || (isRtl ? 'قرارداد خدمات' : 'Contract Agreement'),
        department: isRtl ? 'قراردادها' : 'Contracts',
        status: c.status === 'ACTIVE' ? (isRtl ? 'جاری' : 'Active') : c.status,
        statusColor: 'violet',
        tab: 'contracts'
      });
    });

    (calls || []).forEach((cl) => {
      const dateObj = cl.createdAt ? new Date(cl.createdAt) : new Date();
      const ts = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
      list.push({
        id: `call-${cl.id}`,
        timestamp: ts,
        dateFormatted: language === 'fa' ? formatPersianDate(dateObj) : formatPersianShortDate(dateObj),
        customer: cl.customerName || (isRtl ? 'تماس ورودی' : 'Inquiry Lead'),
        operation: cl.subject || (isRtl ? 'مشاوره تلفنی' : 'Phone Inquiry'),
        department: isRtl ? 'مرکز تماس' : 'CRM & Calls',
        status: cl.callType || 'COMPLETED',
        statusColor: 'sky',
        tab: 'calls'
      });
    });

    (repairs || []).forEach((r) => {
      const dateObj = r.createdAt ? new Date(r.createdAt) : new Date();
      const ts = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
      list.push({
        id: `rep-${r.id}`,
        timestamp: ts,
        dateFormatted: language === 'fa' ? formatPersianDate(dateObj) : formatPersianShortDate(dateObj),
        customer: r.customerName || (isRtl ? 'مشتری تعمیرات' : 'Repair Client'),
        operation: `${r.deviceModel || ''} - ${r.problemDescription || (isRtl ? 'پذیرش دستگاه' : 'Hardware Intake')}`,
        department: isRtl ? 'تعمیرگاه' : 'Repairs',
        status: r.status,
        statusColor: r.status === 'DELIVERED' ? 'emerald' : 'amber',
        tab: 'repairs'
      });
    });

    // Sort by timestamp descending
    list.sort((a, b) => b.timestamp - a.timestamp);

    // Filter based on timeframeTable
    if (timeframeTable === 'daily') {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const filtered = list.filter((item) => item.timestamp >= oneDayAgo);
      return filtered.length > 0 ? filtered.slice(0, 7) : list.slice(0, 5);
    }
    if (timeframeTable === 'weekly') {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const filtered = list.filter((item) => item.timestamp >= oneWeekAgo);
      return filtered.length > 0 ? filtered.slice(0, 7) : list.slice(0, 5);
    }

    return list.slice(0, 7);
  }, [payments, contracts, calls, repairs, language, isRtl, formatCurrency, timeframeTable]);

  // 6. REAL DEPARTMENT PERFORMANCE METRICS
  const deptPerformance = useMemo(() => {
    // CRM
    const crmTotal = calls.length;
    const crmHandled = calls.filter(c => c.subject || c.notes).length;
    const crmPct = crmTotal > 0 ? Math.round((crmHandled / crmTotal) * 100) : 100;

    // Repairs
    const repTotal = repairs.length;
    const repDone = completedRepairs.length;
    const repPct = repTotal > 0 ? Math.round((repDone / repTotal) * 100) : 100;

    // Finances
    const finTotal = payments.length + checks.length;
    const finDone = payments.length + passedChecks.length;
    const finPct = finTotal > 0 ? Math.round((finDone / finTotal) * 100) : 100;

    // Inventory
    const simTotal = sims.length;
    const simPct = simTotal > 0 ? Math.round((availableSimCount / simTotal) * 100) : 100;

    return {
      crm: { total: crmTotal, pct: Math.min(100, Math.max(10, crmPct)) },
      repairs: { total: repTotal, pct: Math.min(100, Math.max(10, repPct)) },
      finance: { total: finTotal, pct: Math.min(100, Math.max(10, finPct)) },
      inventory: { total: simTotal, pct: Math.min(100, Math.max(10, simPct)) },
    };
  }, [calls, repairs, completedRepairs, payments, checks, passedChecks, sims, availableSimCount]);

  const handleExportDashboard = () => {
    return exportDashboardReportToExcel({
      stats: {
        [t('dashboard.activeCustomers')]: customers.length,
        [t('dashboard.totalRevenue')]: totalRevenue,
        [t('dashboard.pendingTasks')]: pendingTasks.length,
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

  const selectedMonthData = splineChartData.points[hoveredTrendMonth] || splineChartData.points[0];

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* ──────────────────────────────────────────────────────────────────────────
          ROW 1: CURRENT OPERATIONS PULSE (5 CARDS) + OPERATIONS HEALTH SCORE
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Card A: Current Operations Pulse (70% width on lg) */}
        <div className="lg:col-span-8 bg-[#131622] border border-white/[0.08] rounded-3xl p-4 sm:p-5 shadow-xl shadow-black/40 flex flex-col justify-between relative overflow-hidden">
          {/* Card Header */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {isRtl ? 'وضعیت لحظه‌ای و شاخص‌های کلیدی سازمان' : 'Current Operations Pulse'}
              </h2>
            </div>

            {/* Quick Actions & Excel Export */}
            <div className="flex items-center gap-2">
              <ExportExcelButton
                onExport={handleExportDashboard}
                size="sm"
              />
            </div>
          </div>

          {/* 5 Vertical Metric Cards Grid (Real Calculated Data) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-1">
            {/* 1. Rose/Pink: Leads & Inquiries */}
            <div
              onClick={() => onNavigate('calls')}
              className="bg-[#181b2a] hover:bg-[#1f2438] border border-white/[0.06] hover:border-rose-500/40 rounded-2xl p-3.5 flex flex-col justify-between transition-all cursor-pointer group shadow-sm"
              title={isRtl ? 'مشاهده تماس‌ها و لیدها' : 'View Calls & CRM'}
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <MoreVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
              </div>
              <div className="mt-4 space-y-0.5">
                <div className="text-xl sm:text-2xl font-black text-white group-hover:text-rose-400 transition-colors">
                  {formatNumber(calls.length + customers.length)}
                </div>
                <p className="text-[11px] text-slate-400 font-medium truncate">
                  {isRtl ? 'مشتریان و تماس‌ها' : 'Leads & Clients'}
                </p>
                <p className="text-[10px] text-rose-400 font-bold truncate">
                  {formatNumber(calls.length)} {isRtl ? 'تماس' : 'calls'} / {formatNumber(customers.length)} {isRtl ? 'مشتری' : 'cust.'}
                </p>
              </div>
            </div>

            {/* 2. Purple/Violet: Active Contracts */}
            <div
              onClick={() => onNavigate('contracts')}
              className="bg-[#181b2a] hover:bg-[#1f2438] border border-white/[0.06] hover:border-purple-500/40 rounded-2xl p-3.5 flex flex-col justify-between transition-all cursor-pointer group shadow-sm"
              title={isRtl ? 'مشاهده قراردادها' : 'View Contracts'}
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">
                  <FileText className="w-4 h-4" />
                </div>
                <MoreVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
              </div>
              <div className="mt-4 space-y-0.5">
                <div className="text-xl sm:text-2xl font-black text-white group-hover:text-purple-400 transition-colors">
                  {formatNumber(contracts.length)}
                </div>
                <p className="text-[11px] text-slate-400 font-medium truncate">
                  {isRtl ? 'قراردادهای جاری' : 'Contracts'}
                </p>
                <p className="text-[10px] text-purple-400 font-bold truncate">
                  {formatNumber(activeContracts.length)} {isRtl ? 'قرارداد فعال' : 'active'}
                </p>
              </div>
            </div>

            {/* 3. Magenta/Pink: Pending Tasks */}
            <div
              onClick={() => onNavigate('tasks')}
              className="bg-[#181b2a] hover:bg-[#1f2438] border border-white/[0.06] hover:border-pink-500/40 rounded-2xl p-3.5 flex flex-col justify-between transition-all cursor-pointer group shadow-sm"
              title={isRtl ? 'مشاهده وظایف' : 'View Tasks'}
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/40 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <MoreVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
              </div>
              <div className="mt-4 space-y-0.5">
                <div className="text-xl sm:text-2xl font-black text-white group-hover:text-pink-400 transition-colors">
                  {formatNumber(pendingTasks.length)}
                </div>
                <p className="text-[11px] text-slate-400 font-medium truncate">
                  {isRtl ? 'وظایف در جریان' : 'Pending Tasks'}
                </p>
                <p className={`text-[10px] font-bold truncate ${overdueTasks.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {overdueTasks.length > 0
                    ? `${formatNumber(overdueTasks.length)} ${isRtl ? 'معوقه' : 'overdue'}`
                    : `${formatNumber(todayTasks.length)} ${isRtl ? 'امروز' : 'today'}`}
                </p>
              </div>
            </div>

            {/* 4. Blue/Cyan: Checks & Docs */}
            <div
              onClick={() => onNavigate('checks')}
              className="bg-[#181b2a] hover:bg-[#1f2438] border border-white/[0.06] hover:border-blue-500/40 rounded-2xl p-3.5 flex flex-col justify-between transition-all cursor-pointer group shadow-sm"
              title={isRtl ? 'مشاهده چک‌ها' : 'View Checks'}
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">
                  <CreditCard className="w-4 h-4" />
                </div>
                <MoreVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
              </div>
              <div className="mt-4 space-y-0.5">
                <div className="text-xl sm:text-2xl font-black text-white group-hover:text-blue-400 transition-colors">
                  {formatNumber(checks.length)}
                </div>
                <p className="text-[11px] text-slate-400 font-medium truncate">
                  {isRtl ? 'اسناد و چک‌ها' : 'Checks & Docs'}
                </p>
                <p className="text-[10px] text-blue-400 font-bold truncate">
                  {formatNumber(pendingChecks.length)} {isRtl ? 'در گاوصندوق' : 'in safe'}
                </p>
              </div>
            </div>

            {/* 5. Sky/Teal: Hardware & SIMs */}
            <div
              onClick={() => onNavigate('sims')}
              className="bg-[#181b2a] hover:bg-[#1f2438] border border-white/[0.06] hover:border-sky-500/40 rounded-2xl p-3.5 flex flex-col justify-between transition-all cursor-pointer group shadow-sm col-span-2 sm:col-span-1"
              title={isRtl ? 'مشاهده سیم‌کارت‌ها و انبار' : 'View SIMs & Stock'}
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">
                  <Smartphone className="w-4 h-4" />
                </div>
                <MoreVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
              </div>
              <div className="mt-4 space-y-0.5">
                <div className="text-xl sm:text-2xl font-black text-white group-hover:text-sky-400 transition-colors">
                  {formatNumber(availableSimCount)}
                </div>
                <p className="text-[11px] text-slate-400 font-medium truncate">
                  {isRtl ? 'سیم‌کارت‌های آزاد' : 'Available SIMs'}
                </p>
                <p className="text-[10px] text-sky-400 font-bold truncate">
                  {formatNumber(sims.length)} {isRtl ? 'کل خطوط' : 'total in stock'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card B: Risk Score / Operations Health Score (30% width on lg) */}
        <div className="lg:col-span-4 bg-[#131622] border border-white/[0.08] rounded-3xl p-4 sm:p-5 shadow-xl shadow-black/40 flex flex-col justify-between relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              {isRtl ? 'شاخص سلامت و امنیت عملیات' : 'Operational Health Score'}
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-slate-400 hover:text-white transition-colors"
              title={isRtl ? 'گزارش تحلیلی' : 'Analytics'}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Semi-circular Speedometer / Arc Gauge */}
          <div className="relative flex flex-col items-center justify-center my-auto pt-2 pb-1">
            <svg viewBox="0 0 200 115" className="w-48 sm:w-56 overflow-visible">
              {/* Background Arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#1f2438"
                strokeWidth="14"
                strokeLinecap="round"
              />
              {/* Colored Gradient Arc */}
              <defs>
                <linearGradient id="scoreGradientReal" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="50%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="url(#scoreGradientReal)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray="251"
                strokeDashoffset={251 - (251 * (healthScore / 1000))}
                className="transition-all duration-1000 ease-out"
              />
              {/* Dynamic Gauge Indicator Knob */}
              {(() => {
                const angle = Math.PI * (1 - (healthScore / 1000));
                const cx = 100 + 80 * Math.cos(angle);
                const cy = 100 - 80 * Math.sin(angle);
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="6"
                    fill="#ffffff"
                    stroke="#8b5cf6"
                    strokeWidth="3"
                    className="shadow-lg transition-all duration-1000 ease-out"
                  />
                );
              })()}
            </svg>

            {/* Score Center Text */}
            <div className="absolute top-12 flex flex-col items-center text-center">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {isRtl ? 'امتیاز سامانه' : 'Health Score'}
              </span>
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {formatNumber(healthScore)}
              </span>
              <div className="mt-1">
                <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-extrabold shadow-sm ${healthScoreStatus.color}`}>
                  {healthScoreStatus.label}
                </span>
              </div>
            </div>

            {/* Min and Max Range */}
            <div className="w-full flex items-center justify-between px-6 text-[10px] font-bold text-slate-400">
              <span>0</span>
              <span>1000</span>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          ROW 2: OPERATIONAL & REVENUE TREND + REVENUE & SERVICES BREAKDOWN
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Card C: Trend Spline Chart (70% width on lg) */}
        <div className="lg:col-span-8 bg-[#131622] border border-white/[0.08] rounded-3xl p-4 sm:p-5 shadow-xl shadow-black/40 flex flex-col justify-between relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                {isRtl ? 'روند درآمد و فعالیت‌های عملیاتی ۱۲ ماهه' : '12-Month Operations & Revenue Trend'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isRtl ? `مجموع درآمدهای دریافتی: ${formatCurrency(totalRevenue)}` : `Total Cleared Revenue: ${formatCurrency(totalRevenue)}`}
              </p>
            </div>

            {/* Month selector indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#181b2a] border border-white/[0.08] text-xs font-bold text-slate-300">
              <span>{months[hoveredTrendMonth]}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          {/* Spline Area Line Chart with Gradient Fill & Real Tooltip */}
          <div className="relative w-full h-56 sm:h-64 pt-4">
            {/* Dashed Horizontal Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
              <div className="border-b border-white/[0.05] w-full flex justify-end text-[10px] text-slate-500 font-mono">
                {formatCurrency(splineChartData.maxVal)}
              </div>
              <div className="border-b border-white/[0.05] w-full flex justify-end text-[10px] text-slate-500 font-mono">
                {formatCurrency(Math.round(splineChartData.maxVal * 0.75))}
              </div>
              <div className="border-b border-white/[0.05] w-full flex justify-end text-[10px] text-slate-500 font-mono">
                {formatCurrency(Math.round(splineChartData.maxVal * 0.5))}
              </div>
              <div className="border-b border-white/[0.05] w-full flex justify-end text-[10px] text-slate-500 font-mono">
                {formatCurrency(Math.round(splineChartData.maxVal * 0.25))}
              </div>
              <div className="border-b border-white/[0.05] w-full flex justify-end text-[10px] text-slate-500 font-mono">
                {formatCurrency(0)}
              </div>
            </div>

            {/* Spline SVG */}
            <svg viewBox="0 0 1000 200" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="purpleAreaGradReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
                  <stop offset="80%" stopColor="#8b5cf6" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Area Fill */}
              <path
                d={splineChartData.areaPath}
                fill="url(#purpleAreaGradReal)"
              />

              {/* Glowing Stroke Curve */}
              <path
                d={splineChartData.linePath}
                fill="none"
                stroke="#a855f7"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="filter drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]"
              />

              {/* Interactive Points on each Month */}
              {splineChartData.points.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredTrendMonth === idx ? 7 : 4}
                  fill={hoveredTrendMonth === idx ? '#ffffff' : '#8b5cf6'}
                  stroke={hoveredTrendMonth === idx ? '#a855f7' : '#ffffff'}
                  strokeWidth={hoveredTrendMonth === idx ? 4 : 1.5}
                  className="cursor-pointer transition-all duration-200 hover:scale-125"
                  onClick={() => setHoveredTrendMonth(idx)}
                />
              ))}
            </svg>

            {/* Dynamic Real Tooltip */}
            <div
              className="absolute -top-3 bg-[#1f2338] border border-violet-500/60 rounded-xl px-3.5 py-1.5 shadow-2xl shadow-violet-950/90 text-center pointer-events-none z-10 transition-all duration-300"
              style={{
                left: `${(hoveredTrendMonth / 11) * 85 + 7}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="text-[10px] text-slate-300 font-bold">
                {months[hoveredTrendMonth]}
              </div>
              <div className="text-xs font-black text-violet-300">
                {selectedMonthData.revenue > 0
                  ? formatCurrency(selectedMonthData.revenue)
                  : `${formatNumber(selectedMonthData.ops)} ${isRtl ? 'فعالیت ثبتی' : 'events'}`}
              </div>
            </div>

            {/* X-Axis Months labels */}
            <div className="absolute bottom-0 inset-x-0 flex items-center justify-between text-[10px] sm:text-xs font-semibold text-slate-400 px-2 pt-2">
              {months.map((m, idx) => (
                <span
                  key={m}
                  onClick={() => setHoveredTrendMonth(idx)}
                  className={`cursor-pointer transition-colors ${
                    hoveredTrendMonth === idx ? 'text-violet-400 font-black scale-105' : 'hover:text-slate-200'
                  }`}
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Card D: Revenue & Services Breakdown Donut (30% width on lg) */}
        <div className="lg:col-span-4 bg-[#131622] border border-white/[0.08] rounded-3xl p-4 sm:p-5 shadow-xl shadow-black/40 flex flex-col justify-between relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              {isRtl ? 'ترکیب منابع خدمات و فعالیت‌ها' : 'Operations Breakdown'}
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-slate-400 hover:text-white"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Donut Chart SVG with Real Proportions */}
          <div className="relative flex items-center justify-center my-3">
            <svg viewBox="0 0 160 160" className="w-36 h-36">
              {/* Background Ring */}
              <circle cx="80" cy="80" r="58" fill="none" stroke="#181b2a" strokeWidth="16" />

              {/* Segment 1: CRM (Violet) */}
              {breakdownStats.crmPct > 0 && (
                <circle
                  cx="80" cy="80" r="58" fill="none"
                  stroke="#8b5cf6" strokeWidth="16"
                  strokeDasharray={`${breakdownStats.crmDash} ${breakdownStats.circumference - breakdownStats.crmDash}`}
                  strokeDashoffset={breakdownStats.crmOffset}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              )}

              {/* Segment 2: Repairs (Pink) */}
              {breakdownStats.repairPct > 0 && (
                <circle
                  cx="80" cy="80" r="58" fill="none"
                  stroke="#ec4899" strokeWidth="16"
                  strokeDasharray={`${breakdownStats.repairDash} ${breakdownStats.circumference - breakdownStats.repairDash}`}
                  strokeDashoffset={breakdownStats.repairOffset}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              )}

              {/* Segment 3: Contracts (Cyan) */}
              {breakdownStats.contractPct > 0 && (
                <circle
                  cx="80" cy="80" r="58" fill="none"
                  stroke="#06b6d4" strokeWidth="16"
                  strokeDasharray={`${breakdownStats.contractDash} ${breakdownStats.circumference - breakdownStats.contractDash}`}
                  strokeDashoffset={breakdownStats.contractOffset}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              )}

              {/* Segment 4: SIMs (Blue) */}
              {breakdownStats.simPct > 0 && (
                <circle
                  cx="80" cy="80" r="58" fill="none"
                  stroke="#3b82f6" strokeWidth="16"
                  strokeDasharray={`${breakdownStats.simDash} ${breakdownStats.circumference - breakdownStats.simDash}`}
                  strokeDashoffset={breakdownStats.simOffset}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              )}
            </svg>

            {/* Center Donut Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {isRtl ? 'کل پرونده‌ها' : 'Total Items'}
              </span>
              <span className="text-xl sm:text-2xl font-black text-white">
                {formatNumber(breakdownStats.total)}
              </span>
            </div>
          </div>

          {/* Donut Legend with Real Values */}
          <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-300 pt-1">
            <div
              onClick={() => onNavigate('calls')}
              className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] shrink-0" />
              <span className="truncate">{isRtl ? 'CRM و تماس' : 'CRM'}: ({formatNumber(breakdownStats.crmPct)}٪)</span>
            </div>
            <div
              onClick={() => onNavigate('repairs')}
              className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#ec4899] shrink-0" />
              <span className="truncate">{isRtl ? 'تعمیرات' : 'Hardware'}: ({formatNumber(breakdownStats.repairPct)}٪)</span>
            </div>
            <div
              onClick={() => onNavigate('contracts')}
              className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4] shrink-0" />
              <span className="truncate">{isRtl ? 'قراردادها' : 'Contracts'}: ({formatNumber(breakdownStats.contractPct)}٪)</span>
            </div>
            <div
              onClick={() => onNavigate('sims')}
              className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shrink-0" />
              <span className="truncate">{isRtl ? 'سیم‌کارت' : 'SIMs'}: ({formatNumber(breakdownStats.simPct)}٪)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          ROW 3: RECENT ACTIVITIES TABLE + DEPARTMENT PERFORMANCE PROGRESS
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Card E: Recent Activities & Operations Table (70% width on lg) */}
        <div className="lg:col-span-8 bg-[#131622] border border-white/[0.08] rounded-3xl p-4 sm:p-5 shadow-xl shadow-black/40 flex flex-col justify-between relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              {isRtl ? 'تراکنش‌ها و رویدادهای اخیر ثبت‌شده' : 'Real-time Recent Operations'}
            </h3>

            {/* Timeframe Table Filter */}
            <div className="flex items-center gap-1 bg-[#181b2a] border border-white/[0.08] rounded-xl p-0.5 text-xs font-bold text-slate-300">
              <button
                type="button"
                onClick={() => setTimeframeTable('daily')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  timeframeTable === 'daily'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isRtl ? '۲۴ ساعت' : '24h'}
              </button>
              <button
                type="button"
                onClick={() => setTimeframeTable('weekly')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  timeframeTable === 'weekly'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isRtl ? 'هفتگی' : '7d'}
              </button>
              <button
                type="button"
                onClick={() => setTimeframeTable('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  timeframeTable === 'all'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isRtl ? 'همه' : 'All'}
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto min-h-[180px]">
            {recentActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                <Activity className="w-8 h-8 opacity-40" />
                <p className="text-xs font-semibold">
                  {isRtl ? 'هیچ رویدادی در این بازه زمانی ثبت نشده است' : 'No recorded events in this timeframe'}
                </p>
              </div>
            ) : (
              <table className="w-full text-start text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-white/[0.08] text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                    <th className="pb-3 text-start">{isRtl ? 'تاریخ و زمان' : 'Date'}</th>
                    <th className="pb-3 text-start">{isRtl ? 'طرف حساب / مشتری' : 'Client / Lead'}</th>
                    <th className="pb-3 text-start">{isRtl ? 'موضوع عملیات' : 'Operation'}</th>
                    <th className="pb-3 text-start">{isRtl ? 'بخش' : 'Module'}</th>
                    <th className="pb-3 text-end">{isRtl ? 'وضعیت' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {recentActivities.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => onNavigate(item.tab)}
                      className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 font-mono text-[11px] text-slate-400 group-hover:text-slate-200">
                        {item.dateFormatted}
                      </td>
                      <td className="py-3 font-bold text-white group-hover:text-violet-400 transition-colors">
                        {item.customer}
                      </td>
                      <td className="py-3 text-slate-300 font-medium truncate max-w-[200px]">
                        {item.operation}
                      </td>
                      <td className="py-3 text-slate-400">
                        {item.department}
                      </td>
                      <td className="py-3 text-end">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          item.statusColor === 'emerald'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : item.statusColor === 'violet'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : item.statusColor === 'sky'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : item.statusColor === 'amber'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-700 text-slate-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Card F: Department Real Performance (30% width on lg) */}
        <div className="lg:col-span-4 bg-[#131622] border border-white/[0.08] rounded-3xl p-4 sm:p-5 shadow-xl shadow-black/40 flex flex-col justify-between relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              {isRtl ? 'راندمان و پیشرفت بخش‌های سازمان' : 'Department Performance'}
            </h3>
            <button type="button" className="text-slate-400 hover:text-white">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Department items with real calculated mini progress rings */}
          <div className="space-y-3 pt-2">
            {/* Dept 1: CRM */}
            <div
              onClick={() => onNavigate('calls')}
              className="flex items-center justify-between p-2.5 rounded-2xl bg-[#181b2a] hover:bg-[#1f2438] border border-white/[0.05] transition-all cursor-pointer group"
              title={isRtl ? 'واحد CRM' : 'CRM Department'}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Laptop className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {isRtl ? 'واحد CRM و پاسخگویی' : 'CRM & Inquiries (01)'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatNumber(deptPerformance.crm.total)} {isRtl ? 'تعامل ثبت‌شده' : 'Records'}
                  </p>
                </div>
              </div>

              {/* Circular mini progress with real dept percentage */}
              <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#252a40" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="14" fill="none" stroke="#8b5cf6" strokeWidth="3"
                    strokeDasharray="88 88"
                    strokeDashoffset={88 - (88 * (deptPerformance.crm.pct / 100))}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute text-[9px] font-extrabold text-violet-400">
                  {formatNumber(deptPerformance.crm.pct)}٪
                </span>
              </div>
            </div>

            {/* Dept 2: Repairs */}
            <div
              onClick={() => onNavigate('repairs')}
              className="flex items-center justify-between p-2.5 rounded-2xl bg-[#181b2a] hover:bg-[#1f2438] border border-white/[0.05] transition-all cursor-pointer group"
              title={isRtl ? 'تعمیرگاه و پشتیبانی سخت‌افزار' : 'Hardware & Repairs'}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-pink-600/20 text-pink-400 border border-pink-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {isRtl ? 'پشتیبانی فنی و تعمیرگاه' : 'Hardware & Repairs (02)'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatNumber(deptPerformance.repairs.total)} {isRtl ? 'پرونده فنی' : 'Tickets'}
                  </p>
                </div>
              </div>

              {/* Circular mini progress */}
              <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#252a40" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="14" fill="none" stroke="#ec4899" strokeWidth="3"
                    strokeDasharray="88 88"
                    strokeDashoffset={88 - (88 * (deptPerformance.repairs.pct / 100))}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute text-[9px] font-extrabold text-pink-400">
                  {formatNumber(deptPerformance.repairs.pct)}٪
                </span>
              </div>
            </div>

            {/* Dept 3: Finance */}
            <div
              onClick={() => onNavigate('finances')}
              className="flex items-center justify-between p-2.5 rounded-2xl bg-[#181b2a] hover:bg-[#1f2438] border border-white/[0.05] transition-all cursor-pointer group"
              title={isRtl ? 'امور مالی و حسابداری' : 'Finance & Billing'}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {isRtl ? 'امور مالی و پرداخت‌ها' : 'Finance & Billing (03)'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatNumber(deptPerformance.finance.total)} {isRtl ? 'سند مالی' : 'Docs'}
                  </p>
                </div>
              </div>

              {/* Circular mini progress */}
              <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#252a40" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="3"
                    strokeDasharray="88 88"
                    strokeDashoffset={88 - (88 * (deptPerformance.finance.pct / 100))}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute text-[9px] font-extrabold text-emerald-400">
                  {formatNumber(deptPerformance.finance.pct)}٪
                </span>
              </div>
            </div>

            {/* Dept 4: Inventory */}
            <div
              onClick={() => onNavigate('sims')}
              className="flex items-center justify-between p-2.5 rounded-2xl bg-[#181b2a] hover:bg-[#1f2438] border border-white/[0.05] transition-all cursor-pointer group"
              title={isRtl ? 'انبار و سیم‌کارت‌ها' : 'SIMs & Inventory'}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-600/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {isRtl ? 'انبار سیم‌کارت و خطوط' : 'SIMs & Inventory (04)'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatNumber(deptPerformance.inventory.total)} {isRtl ? 'خط موجود' : 'In stock'}
                  </p>
                </div>
              </div>

              {/* Circular mini progress */}
              <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#252a40" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="14" fill="none" stroke="#38bdf8" strokeWidth="3"
                    strokeDasharray="88 88"
                    strokeDashoffset={88 - (88 * (deptPerformance.inventory.pct / 100))}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute text-[9px] font-extrabold text-sky-400">
                  {formatNumber(deptPerformance.inventory.pct)}٪
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
