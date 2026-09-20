import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../lib/i18n';
import {
  Customer, Call, Task, Contract, Payment, Check,
  SimCard, Repair, Attachment, CustomerTimelineEvent
} from '../../types';
import {
  PhoneCall, CheckSquare, FileText, CreditCard,
  Wrench, Smartphone, Paperclip, Calendar, Link2,
  Edit3, ArrowRight, User, Phone, MapPin, Building2,
  Tag, Plus, ShieldCheck, Mail, Clock
} from 'lucide-react';
import { formatPersianDate, formatPrice } from '../../lib/dateUtils';
import { canViewTask } from '../../lib/permissions';
import { storage } from '../../services/storage';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { CustomerTimeline } from './CustomerTimeline';
import { CustomerDateSuggestionModal } from './CustomerDateSuggestionModal';
import { CustomerShareLinkModal } from './CustomerShareLinkModal';

export interface CustomerDetailProps {
  customer: Customer;
  calls: Call[];
  tasks: Task[];
  contracts: Contract[];
  payments: Payment[];
  checks: Check[];
  sims: SimCard[];
  repairs: Repair[];
  attachments: Attachment[];
  onBack: () => void;
  onEditCustomer: (customer: Customer) => void;
  onOpenQuickCall: (customer: Customer) => void;
  onOpenQuickTask: (customer: Customer) => void;
  onOpenQuickPayment: (customer: Customer) => void;
  onOpenQuickRepair: (customer: Customer) => void;
  onOpenQuickContract: (customer: Customer) => void;
  onOpenQuickAttachment: (customer: Customer) => void;
}

export const CustomerDetail: React.FC<CustomerDetailProps> = ({
  customer,
  calls,
  tasks,
  contracts,
  payments,
  checks,
  sims,
  repairs,
  attachments,
  onBack,
  onEditCustomer,
  onOpenQuickCall,
  onOpenQuickTask,
  onOpenQuickPayment,
  onOpenQuickRepair,
  onOpenQuickContract,
  onOpenQuickAttachment,
}) => {
  const [activeTab, setActiveTab] = useState<'TIMELINE' | 'CALLS' | 'TASKS' | 'FINANCES' | 'CONTRACTS' | 'TECH' | 'FILES'>('TIMELINE');
  const [showDateModal, setShowDateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const { t, isRtl } = useTranslation();

  const currentUser = storage.getCurrentUser();
  const visibleTasks = useMemo(() => {
    return (tasks || []).filter((t) => canViewTask(currentUser, t));
  }, [tasks, currentUser]);

  // Compile Unified Chronological Timeline Events
  const timelineEvents: CustomerTimelineEvent[] = useMemo(() => {
    const list: CustomerTimelineEvent[] = [];

    // Calls
    calls.forEach((c) => {
      list.push({
        id: `t-call-${c.id}`,
        type: 'CALL',
        title: isRtl ? `تماس ${c.callType}: ${c.subject}` : `Call ${c.callType}: ${c.subject}`,
        description: c.notes + (c.followUpRequired ? (isRtl ? ' (دارای پیگیری بعدی)' : ' (Follow-up Required)') : ''),
        timestamp: c.dateTime || c.createdAt,
        userId: c.userId,
        userName: c.userName || (isRtl ? 'کارشناس' : 'Specialist'),
        entityId: c.id,
      });
    });

    // Tasks
    visibleTasks.forEach((t) => {
      list.push({
        id: `t-task-${t.id}`,
        type: 'TASK',
        title: `وظیفه: ${t.title} (${t.status})`,
        description: t.description || 'بدون توضیحات تکمیلی',
        timestamp: t.createdAt,
        userId: t.creatorUserId,
        userName: t.creatorUserName || 'مدیر',
        entityId: t.id,
      });
    });

    // Payments
    payments.forEach((p) => {
      list.push({
        id: `t-pay-${p.id}`,
        type: 'PAYMENT',
        title: `پرداخت وجه: ${formatPrice(p.amount)} (${p.status})`,
        description: `شماره رسید: ${p.receiptNumber} • روش پرداخت: ${p.method} • ${p.notes || ''}`,
        timestamp: p.date || p.createdAt,
        userId: p.reportedByUserId,
        userName: p.reportedByUserName || 'حسابداری',
        entityId: p.id,
      });
    });

    // Checks
    checks.forEach((chk) => {
      list.push({
        id: `t-chk-${chk.id}`,
        type: 'CHECK',
        title: `چک صیادی: ${formatPrice(chk.amount)} (${chk.status})`,
        description: `بانک ${chk.bankName} • سررسید: ${formatPersianDate(chk.dueDate)} • شماره: ${chk.checkNumber}`,
        timestamp: chk.createdAt,
        userId: '',
        userName: 'سیستم چک',
        entityId: chk.id,
      });
    });

    // Contracts
    contracts.forEach((cnt) => {
      list.push({
        id: `t-cntr-${cnt.id}`,
        type: 'CONTRACT',
        title: `قرارداد ${cnt.title} (${cnt.contractNumber})`,
        description: `مبلغ: ${formatPrice(cnt.amount)} • وضعیت: ${cnt.status}`,
        timestamp: cnt.createdAt,
        userId: cnt.createdById,
        userName: 'واحد قرارداد',
        entityId: cnt.id,
      });
    });

    // Repairs
    repairs.forEach((r) => {
      list.push({
        id: `t-rep-${r.id}`,
        type: 'REPAIR',
        title: `پذیرش تعمیر: ${r.brand} ${r.model} (${r.trackingCode})`,
        description: `ایراد: ${r.problemDescription} • وضعیت: ${r.status}`,
        timestamp: r.receivedDate || r.createdAt,
        userId: r.technicianUserId || '',
        userName: r.technicianUserName || 'کارگاه',
        entityId: r.id,
      });
    });

    // SIMs
    sims.forEach((s) => {
      list.push({
        id: `t-sim-${s.id}`,
        type: 'SIM',
        title: `سیم‌کارت تخصیص یافته: ${s.phoneNumber}`,
        description: `اپراتور: ${s.operator} • وضعیت: ${s.status} • ICCID: ${s.iccid}`,
        timestamp: s.createdAt,
        userId: '',
        userName: 'انبار سیم‌کارت',
        entityId: s.id,
      });
    });

    // Attachments
    attachments.forEach((a) => {
      list.push({
        id: `t-att-${a.id}`,
        type: 'ATTACHMENT',
        title: `پیوست فایل: ${a.originalName}`,
        description: `حجم: ${(a.sizeBytes / 1024).toFixed(1)} KB • آپلود شده توسط: ${a.uploadedByUserName}`,
        timestamp: a.uploadedAt,
        userId: a.uploadedByUserId,
        userName: a.uploadedByUserName,
        entityId: a.id,
      });
    });

    // Sort newest first
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [calls, tasks, payments, checks, contracts, repairs, sims, attachments]);

  const customerStatusBadges: Record<string, { label: string; variant: 'purple' | 'success' | 'warning' | 'default' | 'danger' }> = {
    VIP: { label: isRtl ? 'مشتری VIP' : 'VIP Customer', variant: 'purple' },
    ACTIVE: { label: isRtl ? 'فعال' : 'Active', variant: 'success' },
    PROSPECT: { label: isRtl ? 'لید / در حال مذاکره' : 'Lead / In Negotiation', variant: 'warning' },
    INACTIVE: { label: isRtl ? 'غیرفعال' : 'Inactive', variant: 'default' },
    BLACKLISTED: { label: isRtl ? 'لیست سیاه' : 'Blacklisted', variant: 'danger' },
  };

  return (
    <div className="space-y-6 animate-blur-fade-up">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 font-semibold transition-colors"
        >
          <ArrowRight className="w-4 h-4 rtl-flip" />
          <span>{isRtl ? 'بازگشت به فهرست مشتریان' : 'Back to Customer List'}</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={() => setShowShareModal(true)}
            leftIcon={<Link2 className="w-4 h-4" />}
          >
            {isRtl ? 'لینک امن مشتری' : 'Secure Customer Link'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditCustomer(customer)}
            leftIcon={<Edit3 className="w-4 h-4" />}
          >
            {isRtl ? 'ویرایش پرونده' : 'Edit Profile'}
          </Button>
        </div>
      </div>

      {/* Customer Hero Profile Header Card */}
      <div className="p-5 sm:p-7 rounded-3xl liquid-glass-card border border-slate-800 text-end space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-xl shrink-0">
              {customer.name.substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100">
                  {customer.name}
                </h1>
                <Badge variant={customerStatusBadges[customer.status]?.variant || 'default'}>
                  {customerStatusBadges[customer.status]?.label || customer.status}
                </Badge>
                <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                  {customer.code}
                </span>
              </div>
              {customer.companyName && (
                <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span>{customer.companyName}</span>
                </p>
              )}
            </div>
          </div>

          {/* Quick Stat Pill */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">{isRtl ? 'سقف اعتبار مالی' : 'Credit Limit'}</span>
              <span className="font-bold text-emerald-400 text-sm">
                {formatPrice(customer.creditLimit)}
              </span>
            </div>
            <div className="border-r border-slate-800 pe-4">
              <span className="text-slate-400 block text-[11px]">{isRtl ? 'عضویت' : 'Member Since'}</span>
              <span className="text-slate-200">{formatPersianDate(customer.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Contact info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/40">
            <Phone className="w-4 h-4 text-sky-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 block">{isRtl ? 'موبایل' : 'Mobile'}</span>
              <a href={`tel:${customer.mobile}`} className="font-semibold hover:text-indigo-400">
                {customer.mobile}
              </a>
            </div>
          </div>

          {customer.phone && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/40">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block">{isRtl ? 'تلفن دفتر' : 'Office Phone'}</span>
                <span>{customer.phone}</span>
              </div>
            </div>
          )}

          {customer.email && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/40">
              <Mail className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block">{isRtl ? 'ایمیل' : 'Email'}</span>
                <span className="truncate max-w-[150px]">{customer.email}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/40">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-500 block">{isRtl ? 'موقعیت' : 'Location'}</span>
              <span className="truncate">{customer.city || (isRtl ? 'تهران' : 'Tehran')}</span>
            </div>
          </div>
        </div>

        {/* Tags and Notes */}
        <div className="space-y-2 pt-1">
          {customer.tags && customer.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-500 me-1" />
              {customer.tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/80"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {customer.notes && (
            <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-200/90 leading-relaxed">
              <span className="font-bold text-indigo-300 block mb-0.5">{isRtl ? 'یادداشت پرونده:' : 'Case Notes:'}</span>
              {customer.notes}
            </div>
          )}
        </div>

        {/* Action Bar (Section 15: Fast customer actions) */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onOpenQuickCall(customer)}
            leftIcon={<PhoneCall className="w-4 h-4" />}
          >
            {isRtl ? 'ثبت تماس صوتی' : 'Log Voice Call'}
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={() => onOpenQuickTask(customer)}
            leftIcon={<CheckSquare className="w-4 h-4" />}
          >
            {isRtl ? 'وظیفه جدید' : 'New Task'}
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={() => onOpenQuickPayment(customer)}
            leftIcon={<CreditCard className="w-4 h-4" />}
          >
            {isRtl ? 'ثبت پرداخت' : 'Log Payment'}
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={() => onOpenQuickRepair(customer)}
            leftIcon={<Wrench className="w-4 h-4" />}
          >
            {isRtl ? 'پذیرش تعمیر' : 'Submit Repair'}
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={() => onOpenQuickContract(customer)}
            leftIcon={<FileText className="w-4 h-4" />}
          >
            {isRtl ? 'قرارداد جدید' : 'New Contract'}
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={() => onOpenQuickAttachment(customer)}
            leftIcon={<Paperclip className="w-4 h-4" />}
          >
            {isRtl ? 'پیوست مدرک' : 'Attach Document'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDateModal(true)}
            leftIcon={<Calendar className="w-4 h-4" />}
          >
            {isRtl ? 'پیشنهاد زمان جلسه' : 'Suggest Meeting Time'}
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 gap-2 sm:gap-4 overflow-x-auto text-xs font-semibold pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('TIMELINE')}
          className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'TIMELINE'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          {isRtl ? `تایم‌لاین جامع رویدادها (${timelineEvents.length})` : `Comprehensive Event Timeline (${timelineEvents.length})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CALLS')}
          className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'CALLS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          {isRtl ? `مکالمات (${calls.length})` : `Conversations (${calls.length})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TASKS')}
          className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'TASKS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          {isRtl ? `وظایف (${tasks.length})` : `Tasks (${tasks.length})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('FINANCES')}
          className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'FINANCES'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          {isRtl ? `مالی و چک‌ها (${payments.length + checks.length})` : `Finances & Checks (${payments.length + checks.length})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CONTRACTS')}
          className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'CONTRACTS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          {isRtl ? `قراردادها (${contracts.length})` : `Contracts (${contracts.length})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TECH')}
          className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'TECH'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          {isRtl ? `تعمیرات و سیم‌کارت (${repairs.length + sims.length})` : `Repairs & SIMs (${repairs.length + sims.length})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('FILES')}
          className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'FILES'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          {isRtl ? `پیوست‌ها (${attachments.length})` : `Attachments (${attachments.length})`}
        </button>
      </div>

      {/* Tab Content Panels */}
      {activeTab === 'TIMELINE' && (
        <div className="space-y-4">
          <CustomerTimeline events={timelineEvents} />
        </div>
      )}

      {activeTab === 'CALLS' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-200">{isRtl ? 'تاریخچه تماس‌های این مشتری' : 'Customer Call History'}</h3>
            <Button
              variant="primary"
              size="xs"
              onClick={() => onOpenQuickCall(customer)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'ثبت تماس جدید' : 'Log New Call'}
            </Button>
          </div>
          {calls.length === 0 ? (
            <div className="text-center py-10 text-slate-500 rounded-2xl liquid-glass-subtle">
              {isRtl ? 'هیچ تماسی ثبت نشده است' : 'No calls have been recorded'}
            </div>
          ) : (
            calls.map((c) => (
              <div key={c.id} className="p-4 rounded-2xl liquid-glass-card border border-slate-800 text-end space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-100">{c.subject}</span>
                  <Badge variant="purple" size="sm">{c.callType}</Badge>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{c.notes}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                  <span>{isRtl ? `ثبت توسط: ${c.userName}` : `Logged by: ${c.userName}`}</span>
                  <span>{formatPersianDate(c.dateTime, true)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'TASKS' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-200">{isRtl ? 'وظایف مرتبط با این مشتری' : 'Tasks Related to This Customer'}</h3>
            <Button
              variant="primary"
              size="xs"
              onClick={() => onOpenQuickTask(customer)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'ایجاد وظیفه' : 'Create Task'}
            </Button>
          </div>
          {visibleTasks.length === 0 ? (
            <div className="text-center py-10 text-slate-500 rounded-2xl liquid-glass-subtle">
              {isRtl ? 'هیچ وظیفه قابل مشاهده‌ای ثبت نشده است' : 'No visible tasks have been recorded'}
            </div>
          ) : (
            visibleTasks.map((t) => (
              <div key={t.id} className="p-4 rounded-2xl liquid-glass-card border border-slate-800 text-end space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-100">{t.title}</span>
                  <Badge variant={t.priority === 'URGENT' ? 'danger' : 'warning'} size="sm">
                    {t.priority}
                  </Badge>
                </div>
                {t.description && <p className="text-xs text-slate-300">{t.description}</p>}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                  <span>{isRtl ? `مسئول: ${t.assignedUserName}` : `Assigned to: ${t.assignedUserName}`}</span>
                  <span>{isRtl ? `سررسید: ${formatPersianDate(t.dueDate)}` : `Due: ${formatPersianDate(t.dueDate)}`}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'FINANCES' && (
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200">{isRtl ? 'رسیدهای پرداختی' : 'Payment Receipts'}</h3>
            {payments.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl liquid-glass-card border border-slate-800 text-end flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-emerald-400">{formatPrice(p.amount)}</span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isRtl ? `رسید: ${p.receiptNumber} • روش: ${p.method} • ${p.notes || ''}` : `Receipt: ${p.receiptNumber} • Method: ${p.method} • ${p.notes || ''}`}
                  </p>
                </div>
                <Badge variant={p.status === 'COMPLETED' ? 'success' : 'warning'} size="sm">
                  {p.status}
                </Badge>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200">{isRtl ? 'چک‌های صیادی' : 'Checks'}</h3>
            {checks.map((chk) => (
              <div key={chk.id} className="p-4 rounded-2xl liquid-glass-card border border-slate-800 text-end flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-purple-300">{formatPrice(chk.amount)}</span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isRtl ? `بانک ${chk.bankName} • سررسید: ${formatPersianDate(chk.dueDate)} • شماره: ${chk.checkNumber}` : `Bank ${chk.bankName} • Due: ${formatPersianDate(chk.dueDate)} • No: ${chk.checkNumber}`}
                  </p>
                </div>
                <Badge variant={chk.status === 'CLEARED' ? 'success' : 'purple'} size="sm">
                  {chk.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'CONTRACTS' && (
        <div className="space-y-3">
          {contracts.map((cnt) => (
            <div key={cnt.id} className="p-4 rounded-2xl liquid-glass-card border border-slate-800 text-end space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-100">{cnt.title}</span>
                <Badge variant="purple" size="sm">{cnt.status}</Badge>
              </div>
              <p className="text-xs text-slate-400">
                شماره: {cnt.contractNumber} • مبلغ: {formatPrice(cnt.amount)} • نوع: {cnt.type}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'TECH' && (
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200">{isRtl ? 'دستگاه‌های تعمیراتی' : 'Repair Devices'}</h3>
            {repairs.map((r) => (
              <div key={r.id} className="p-4 rounded-2xl liquid-glass-card border border-slate-800 text-end space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-100">{r.brand} {r.model} ({r.trackingCode})</span>
                  <Badge variant="amber" size="sm">{r.status}</Badge>
                </div>
                <p className="text-xs text-slate-300">{r.problemDescription}</p>
                <p className="text-[11px] text-slate-500">{isRtl ? `هزینه نهایی: ${formatPrice(r.finalCost || r.estimatedCost)}` : `Final Cost: ${formatPrice(r.finalCost || r.estimatedCost)}`}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200">{isRtl ? 'سیم‌کارت‌های تخصیص یافته' : 'Assigned SIM Cards'}</h3>
            {sims.map((s) => (
              <div key={s.id} className="p-3.5 rounded-2xl liquid-glass-card border border-slate-800 text-end flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-cyan-400">{s.phoneNumber}</span>
                  <p className="text-xs text-slate-400">{isRtl ? `اپراتور: ${s.operator} • ICCID: ${s.iccid}` : `Operator: ${s.operator} • ICCID: ${s.iccid}`}</p>
                </div>
                <Badge variant="info" size="sm">{s.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'FILES' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-200">{isRtl ? 'اسناد و پیوست‌های پرونده' : 'Case Documents & Attachments'}</h3>
            <Button
              variant="primary"
              size="xs"
              onClick={() => onOpenQuickAttachment(customer)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'افزودن مدرک' : 'Add Document'}
            </Button>
          </div>
          {attachments.length === 0 ? (
            <div className="text-center py-10 text-slate-500 rounded-2xl liquid-glass-subtle">
              {isRtl ? 'هیچ مدرکی پیوست نشده است' : 'No documents have been attached'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {attachments.map((a) => (
                <div key={a.id} className="p-3.5 rounded-2xl liquid-glass-card border border-slate-800 flex items-center justify-between text-end">
                  <div className="flex items-center gap-3">
                    <Paperclip className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 truncate max-w-[180px]">{a.originalName}</h4>
                      <p className="text-[10px] text-slate-400">{(a.sizeBytes / 1024).toFixed(1)} KB • {formatPersianDate(a.uploadedAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Date Suggestion Modal */}
      {showDateModal && (
        <CustomerDateSuggestionModal
          isOpen={showDateModal}
          onClose={() => setShowDateModal(false)}
          customer={customer}
        />
      )}

      {/* Shareable Link Modal */}
      {showShareModal && (
        <CustomerShareLinkModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          customer={customer}
        />
      )}
    </div>
  );
};
