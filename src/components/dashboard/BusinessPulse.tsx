import React from 'react';
import {
  User, UserRole, Task, TaskStatus, Payment, PaymentStatus,
  Repair, RepairStatus, Call, Check, CheckStatus, Customer
} from '../../types';
import {
  AlertTriangle, CheckCircle2, Clock, PhoneCall,
  CreditCard, Wrench, Smartphone, Users, TrendingUp,
  ArrowUpRight, Plus, Sparkles, CheckSquare
} from 'lucide-react';
import { formatPrice, getRelativeTimeFa, isOverdue, isToday } from '../../lib/dateUtils';
import { useTranslation } from '../../lib/i18n';
import { canViewTask } from '../../lib/permissions';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface BusinessPulseProps {
  currentUser: User;
  customers: Customer[];
  tasks: Task[];
  payments: Payment[];
  repairs: Repair[];
  calls: Call[];
  checks: Check[];
  onNavigate: (module: string, itemId?: string) => void;
  onOpenQuickAction: (actionType: string) => void;
}

export const BusinessPulse: React.FC<BusinessPulseProps> = ({
  currentUser,
  customers = [],
  tasks = [],
  payments = [],
  repairs = [],
  calls = [],
  checks = [],
  onNavigate,
  onOpenQuickAction,
}) => {
  const { isRtl } = useTranslation();
  // 1. WHAT NEEDS ATTENTION NOW?
  const allowedTasks = (tasks || []).filter((t) => canViewTask(currentUser, t));
  const overdueTasks = allowedTasks.filter((t) => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED && isOverdue(t.dueDate));
  const pendingPayments = (payments || []).filter((p) => p.status === PaymentStatus.REPORTED || p.status === PaymentStatus.PENDING);
  const urgentRepairs = (repairs || []).filter((r) => r.status === RepairStatus.WAITING_FOR_APPROVAL || r.status === RepairStatus.RECEIVED);
  const followUpCalls = (calls || []).filter((c) => c.followUpRequired);

  // 2. WHAT DO I NEED TO DO TODAY?
  const todayTasks = allowedTasks.filter((t) => isToday(t.dueDate) && t.status !== TaskStatus.COMPLETED);
  const todayChecks = (checks || []).filter((c) => isToday(c.dueDate) && c.status === CheckStatus.RECEIVED);

  // Summary Metrics
  const activeCustomersCount = (customers || []).length;
  const inProgressRepairsCount = (repairs || []).filter((r) => r.status === RepairStatus.IN_PROGRESS).length;
  const totalReceivables = (payments || [])
    .filter((p) => p.status === PaymentStatus.COMPLETED)
    .reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-6 animate-blur-fade-up">
      {/* Top Banner / Welcome with Role Context */}
      <div className="p-4 sm:p-6 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/20 text-end flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              سلام، {currentUser.name}
            </h1>
            <Badge variant="purple" size="sm">
              {currentUser.department}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            سیستم عامل MMBA — تمرکز امروز شما بر مشتری، تسریع پیگیری‌ها و انضباط مالی است.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onOpenQuickAction('CALL')}
            leftIcon={<PhoneCall className="w-4 h-4" />}
            className="flex-1 sm:flex-none"
          >
            ثبت تماس سریع
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenQuickAction('TASK')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="flex-1 sm:flex-none"
          >
            وظیفه جدید
          </Button>
        </div>
      </div>

      {/* SECTION 1: WHAT NEEDS ATTENTION NOW? (The Hero Section) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              چه مواردی همین الان نیاز به اقدام فوری دارند؟
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {overdueTasks.length + pendingPayments.length + urgentRepairs.length} مورد معوق
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Overdue Tasks Alert Card */}
          <div
            onClick={() => onNavigate('TASKS')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer text-end group ${
              overdueTasks.length > 0
                ? 'border-rose-300 dark:border-rose-500/30 hover:border-rose-400 dark:hover:border-rose-500/60 bg-rose-50/50 dark:bg-rose-950/10'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRtl ? 'وظایف معوق / عقب‌افتاده' : 'Overdue / Late Tasks'}</span>
              <Badge variant={overdueTasks.length > 0 ? 'danger' : 'success'} size="sm" dot>
                {overdueTasks.length} وظیفه
              </Badge>
            </div>
            <div className="mt-3">
              {overdueTasks.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-rose-700 dark:text-rose-300 truncate">
                    {overdueTasks[0].title}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {isRtl ? 'مسئول:' : 'Assignee:'} {overdueTasks[0].assignedUserName || (isRtl ? 'تعیین نشده' : 'Unassigned')} • {isRtl ? 'سررسید:' : 'Due:'} {isRtl ? getRelativeTimeFa(overdueTasks[0].dueDate) : getRelativeTimeFa(overdueTasks[0].dueDate)}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs py-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{isRtl ? 'عالی! هیچ وظیفه معوقی وجود ندارد.' : 'Great! No overdue tasks.'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Pending Financial Approvals Card */}
          <div
            onClick={() => onNavigate('PAYMENTS')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer text-end group ${
              pendingPayments.length > 0
                ? 'border-amber-300 dark:border-amber-500/30 hover:border-amber-400 dark:hover:border-amber-500/60 bg-amber-50/50 dark:bg-amber-950/10'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRtl ? 'دریافتی‌های منتظر تایید مالی' : 'Payments Awaiting Finance Approval'}</span>
              <Badge variant={pendingPayments.length > 0 ? 'warning' : 'success'} size="sm" dot>
                {pendingPayments.length} {isRtl ? 'سند' : 'records'}
              </Badge>
            </div>
            <div className="mt-3">
              {pendingPayments.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300 truncate">
                    {formatPrice(pendingPayments[0].amount)} ({pendingPayments[0].customerName})
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    روش: {pendingPayments[0].method} • ثبت توسط: {pendingPayments[0].reportedByUserName}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs py-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{isRtl ? 'تمامی پرداخت‌ها بررسی و تایید شده‌اند.' : 'All payments are reviewed and verified.'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Urgent Repairs / Awaiting Approval Card */}
          <div
            onClick={() => onNavigate('REPAIRS')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer text-end group ${
              urgentRepairs.length > 0
                ? 'border-indigo-300 dark:border-indigo-500/30 hover:border-indigo-400 dark:hover:border-indigo-500/60 bg-indigo-50/50 dark:bg-indigo-950/10'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRtl ? 'تعمیرات نیازمند تایید مشتری' : 'Repairs Awaiting Customer Approval'}</span>
              <Badge variant={urgentRepairs.length > 0 ? 'purple' : 'success'} size="sm" dot>
                {urgentRepairs.length} {isRtl ? 'دستگاه' : 'devices'}
              </Badge>
            </div>
            <div className="mt-3">
              {urgentRepairs.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 truncate">
                    {urgentRepairs[0].brand} {urgentRepairs[0].model} ({urgentRepairs[0].trackingCode})
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    مشتری: {urgentRepairs[0].customerName} • وضعیت: {urgentRepairs[0].status}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs py-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{isRtl ? 'دستگاه بلاتکلیفی در تعمیرگاه نیست.' : 'No pending devices in the repair shop.'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: WHAT DO I NEED TO DO TODAY? */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's Tasks Column (2 Cols on lg) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                برنامه و وظایف سررسید امروز
              </h3>
            </div>
            <Button variant="ghost" size="xs" onClick={() => onNavigate('TASKS')}>
              مشاهده تمام وظایف
            </Button>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs p-3 divide-y divide-slate-100 dark:divide-slate-800/60">
            {todayTasks.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 space-y-1">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/60 dark:text-emerald-400/60 mb-2" />
                <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">{isRtl ? 'برای امروز وظیفه اضطراری باقی نمانده است' : 'No urgent tasks remain for today'}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{isRtl ? 'می‌توانید وظایف روزهای آینده را بررسی کنید.' : 'You can review upcoming tasks for the next days.'}</p>
              </div>
            ) : (
              todayTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onNavigate('TASKS', t.id)}
                  className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors cursor-pointer text-end"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">
                        {t.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {t.customerName ? `${isRtl ? 'مشتری:' : 'Customer:'} ${t.customerName} • ` : ''}{isRtl ? 'مسئول:' : 'Assignee:'} {t.assignedUserName}
                      </p>
                    </div>
                  </div>
                  <Badge variant={t.priority === 'URGENT' ? 'danger' : 'warning'} size="sm">
                    {t.priority}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Operational Highlights / Role Snapshot */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{isRtl ? 'خلاصه عملیات کسب‌وکار' : 'Business Operations Summary'}</span>
            </h3>
          </div>

          <div className="space-y-2.5">
            <div
              onClick={() => onNavigate('CUSTOMERS')}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs cursor-pointer flex items-center justify-between text-end transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{isRtl ? 'کل پرونده‌های فعال مشتریان' : 'Total Active Customer Records'}</span>
                  <p className="text-base font-bold text-slate-900 dark:text-slate-100">{activeCustomersCount} {isRtl ? 'مشتری' : 'customers'}</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>

            <div
              onClick={() => onNavigate('PAYMENTS')}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs cursor-pointer flex items-center justify-between text-end transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{isRtl ? 'مجموع وصولی‌های قطعی' : 'Total Collected Revenue'}</span>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(totalReceivables)}</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>

            <div
              onClick={() => onNavigate('REPAIRS')}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs cursor-pointer flex items-center justify-between text-end transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{isRtl ? 'دستگاه‌های در حال تعمیر' : 'Devices In Repair'}</span>
                  <p className="text-base font-bold text-amber-600 dark:text-amber-300">{inProgressRepairsCount} {isRtl ? 'دستگاه' : 'devices'}</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: RECENT ACTIVITY STREAM (Unified Customer Pulse) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              آخرین رویدادها و تماس‌های ثبت شده
            </h3>
          </div>
          <Button variant="ghost" size="xs" onClick={() => onNavigate('CALLS')}>
            تاریخچه مکالمات
          </Button>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60">
          {calls.slice(0, 5).map((cl) => (
            <div
              key={cl.id}
              onClick={() => onNavigate('CUSTOMERS', cl.customerId)}
              className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer text-end flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-sky-50 dark:bg-slate-800 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-200">
                      {cl.customerName || (isRtl ? 'مشتری' : 'Customer')}
                    </span>
                    <Badge variant="purple" size="sm">
                      {cl.callType}
                    </Badge>
                    <Badge variant="default" size="sm">
                      نتیجه: {cl.result}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1 truncate">
                    {cl.subject}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {cl.notes}
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center text-[11px] text-slate-400 dark:text-slate-500 shrink-0 pt-1 sm:pt-0">
                <span>{isRtl ? 'ثبت:' : 'By:'} {cl.userName}</span>
                <span>{getRelativeTimeFa(cl.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
