import React, { useState, useMemo } from 'react';
import {
  Customer, Call, Task, Contract, Payment, CheckItem,
  SimCard, RepairTicket, Attachment, User, CustomerTimelineEvent, VoiceNote, ModuleName, PermissionAction
} from '../../types';
import {
  PhoneCall, CheckSquare, FileText, CreditCard,
  Wrench, Smartphone, Paperclip, Calendar, Link2,
  Edit3, ArrowRight, User as UserIcon, Phone, MapPin, Building2,
  Tag, Plus, ShieldCheck, Mail, Clock, DollarSign, Share2, Sparkles,
  Mic, Volume2, Copy, Check, Trash2, AlertTriangle, Printer
} from 'lucide-react';
import { formatPersianDate, getRelativeTimeFa } from '../../lib/dateUtils';
import { formatToman } from '../../lib/currencyUtils';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { AudioPlayer } from '../ui/AudioPlayer';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { hasPermission, isAdmin, canViewTask } from '../../lib/permissions';
import { AttachmentPreview } from '../attachments/AttachmentPreview';
import { GlobalPrintModal } from '../common/GlobalPrintModal';

export interface CustomerDetailViewProps {
  customer: Customer;
  allCustomers: Customer[];
  allUsers: User[];
  currentUser?: User;
  onBack: () => void;
  onEditCustomer: (customer: Customer) => void;
  onRefreshCustomer: () => void;
  onDeleteCustomer?: (id: string) => void;
  onOpenNewCall: (customer: Customer) => void;
  onOpenNewTask: (customer: Customer) => void;
  onOpenNewPayment: (customer: Customer) => void;
  onOpenNewCheck: (customer: Customer) => void;
  onOpenNewContract: (customer: Customer) => void;
  onOpenNewRepair: (customer: Customer) => void;
  onOpenNewVoiceNote?: (customer: Customer) => void;
}

export const CustomerDetailView: React.FC<CustomerDetailViewProps> = ({
  customer,
  allCustomers,
  allUsers,
  currentUser,
  onBack,
  onEditCustomer,
  onRefreshCustomer,
  onDeleteCustomer,
  onOpenNewCall,
  onOpenNewTask,
  onOpenNewPayment,
  onOpenNewCheck,
  onOpenNewContract,
  onOpenNewRepair,
  onOpenNewVoiceNote,
}) => {
  const { success, error } = useToast();
  const { t, isRtl } = useTranslation();
  const [activeTab, setActiveTab] = useState<'TIMELINE' | 'VOICENOTES' | 'CALLS' | 'TASKS' | 'FINANCES' | 'CHECKS' | 'CONTRACTS' | 'SIMS' | 'REPAIRS' | 'FILES'>('TIMELINE');
  const [copiedVoiceId, setCopiedVoiceId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const activeUser = currentUser || storage.getCurrentUser();
  const canEdit = hasPermission(activeUser, ModuleName.CUSTOMERS, PermissionAction.EDIT);
  const canDelete =
    hasPermission(activeUser, ModuleName.CUSTOMERS, PermissionAction.ARCHIVE) ||
    hasPermission(activeUser, ModuleName.CUSTOMERS, PermissionAction.MANAGE) ||
    isAdmin(activeUser);

  // Load customer specific data
  const customerCalls = useMemo(() => storage.getCallsByCustomerId(customer.id), [customer.id]);
  const customerVoiceNotes = useMemo(() => storage.getVoiceNotesByCustomerId(customer.id), [customer.id]);
  const customerTasks = useMemo(() => {
    return storage.getTasksByCustomerId(customer.id).filter((t) => canViewTask(activeUser, t));
  }, [customer.id, activeUser]);
  const customerPayments = useMemo(() => storage.getPaymentsByCustomerId(customer.id), [customer.id]);
  const customerChecks = useMemo(() => storage.getChecksByCustomerId(customer.id), [customer.id]);
  const customerContracts = useMemo(() => storage.getContractsByCustomerId(customer.id), [customer.id]);
  const customerSims = useMemo(() => storage.getSimCardsByCustomerId(customer.id), [customer.id]);
  const customerRepairs = useMemo(() => storage.getRepairTicketsByCustomerId(customer.id), [customer.id]);
  const customerAttachments = useMemo(() => storage.getAttachmentsByCustomerId(customer.id), [customer.id]);

  // Unified Chronological Timeline
  const timelineEvents = useMemo(() => {
    const list: {
      id: string;
      type: string;
      title: string;
      description: string;
      timestamp: string;
      userName: string;
      badgeVariant: 'indigo' | 'emerald' | 'warning' | 'purple' | 'info' | 'rose';
      audioDataUrl?: string;
      durationSeconds?: number;
    }[] = [];

    customerVoiceNotes.forEach((vn) => {
      list.push({
        id: `vn-${vn.id}`,
        type: 'یادداشت صوتی',
        title: vn.title,
        description: vn.transcription || 'فایل صوتی ضمیمه شده به پرونده',
        timestamp: vn.createdAt,
        userName: vn.createdByName,
        badgeVariant: 'rose',
        audioDataUrl: vn.audioDataUrl,
        durationSeconds: vn.durationSeconds,
      });
    });

    customerCalls.forEach((c) => {
      list.push({
        id: `call-${c.id}`,
        type: 'مذاکره و تماس',
        title: `${c.callType}: ${c.subject}`,
        description: c.notes,
        timestamp: c.createdAt,
        userName: c.userName,
        badgeVariant: 'info',
      });
    });

    customerTasks.forEach((t) => {
      list.push({
        id: `task-${t.id}`,
        type: 'اقدام و وظیفه',
        title: `${t.title} (${t.status})`,
        description: t.description || 'بدون توضیحات',
        timestamp: t.createdAt,
        userName: t.assignedUserName || 'مسئول',
        badgeVariant: 'warning',
      });
    });

    customerPayments.forEach((p) => {
      list.push({
        id: `pay-${p.id}`,
        type: 'دریافت وجه',
        title: `واریز ${formatToman(p.amount)} (${p.method})`,
        description: `شماره رسید: ${p.receiptNumber} • ${p.notes || ''}`,
        timestamp: p.date,
        userName: 'واحد مالی',
        badgeVariant: 'emerald',
      });
    });

    customerChecks.forEach((chk) => {
      list.push({
        id: `chk-${chk.id}`,
        type: 'چک صیادی',
        title: `چک ${formatToman(chk.amount)} (${chk.bankName})`,
        description: `سررسید: ${formatPersianDate(chk.dueDate)} • شماره صیاد: ${chk.sayadNumber}`,
        timestamp: chk.createdAt,
        userName: 'خزانه',
        badgeVariant: 'purple',
      });
    });

    customerContracts.forEach((cnt) => {
      list.push({
        id: `cnt-${cnt.id}`,
        type: 'قرارداد',
        title: `قرارداد ${cnt.title} (${cnt.contractNumber})`,
        description: `مبلغ کل: ${formatToman(cnt.totalAmount)} • وضعیت: ${cnt.status}`,
        timestamp: cnt.createdAt,
        userName: 'واحد قرارداد',
        badgeVariant: 'indigo',
      });
    });

    customerRepairs.forEach((r) => {
      list.push({
        id: `rep-${r.id}`,
        type: 'تعمیرگاه',
        title: `پذیرش ${r.deviceModel} (${r.trackingCode})`,
        description: `ایراد: ${r.problemDescription} • وضعیت: ${r.status}`,
        timestamp: r.receivedDate,
        userName: r.assignedTechnicianName || 'تکنسین',
        badgeVariant: 'info',
      });
    });

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [customerVoiceNotes, customerCalls, customerTasks, customerPayments, customerChecks, customerContracts, customerRepairs]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/#customer-${customer.id}`);
    success('لینک پرونده مشتری در کلیپ‌بورد کپی شد');
  };

  const handleCopyVoiceTranscript = (id: string, text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedVoiceId(id);
    success('متن یادداشت صوتی کپی شد');
    setTimeout(() => setCopiedVoiceId(null), 2000);
  };

  const handleDeleteVoiceNote = (id: string) => {
    storage.deleteVoiceNote(id);
    success('یادداشت صوتی با موفقیت حذف شد');
    onRefreshCustomer();
  };

  return (
    <div className="space-y-6 animate-blur-fade-up">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 font-semibold transition-colors"
        >
          <ArrowRight className="w-4 h-4 rtl-flip" />
          <span>{isRtl ? 'بازگشت به فهرست مشتریان' : 'Back to Customers List'}</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPrintModalOpen(true)}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            {isRtl ? 'چاپ پرونده (A4/A5)' : 'Print Dossier (A4/A5)'}
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={handleCopyLink}
            leftIcon={<Share2 className="w-4 h-4" />}
          >
            {isRtl ? 'اشتراک پرونده' : 'Share Dossier'}
          </Button>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditCustomer(customer)}
              leftIcon={<Edit3 className="w-4 h-4" />}
            >
              {isRtl ? 'ویرایش مشخصات' : 'Edit Profile'}
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(true)}
              leftIcon={<Trash2 className="w-4 h-4" />}
              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50"
            >
              {isRtl ? 'حذف پرونده' : 'Delete Dossier'}
            </Button>
          )}
        </div>
      </div>

      {/* Customer Header Dossier */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-end space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-500/20 dark:to-purple-600/30 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xl shrink-0 shadow-xs">
              {customer.name.substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {customer.name}
                </h1>
                <Badge variant={customer.category === 'VIP' ? 'purple' : 'indigo'}>
                  {customer.category}
                </Badge>
                <Badge variant="default">
                  {isRtl ? 'مرحله:' : 'Stage:'} {customer.leadStage}
                </Badge>
                <Badge variant="warning">
                  {isRtl ? 'دلیل ثبت:' : 'Reg. Reason:'} {customer.registrationReason || (isRtl ? 'مشتری' : 'Customer')}
                  {customer.registrationReasonOther ? ` (${customer.registrationReasonOther})` : ''}
                </Badge>
                <span className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  {customer.code}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {customer.company && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span>{customer.company}</span>
                  </span>
                )}
                {customer.jobTitle && (
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                    {isRtl ? 'سمت:' : 'Position:'} {customer.jobTitle}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">{isRtl ? 'سقف اعتبار مصوب' : 'Approved Credit Limit'}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                {formatToman(customer.creditLimit || 0)}
              </span>
            </div>
            <div className="border-r border-slate-200 dark:border-slate-800 pe-4">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">{isRtl ? 'تاریخ ثبت در MMBA' : 'MMBA Registration Date'}</span>
              <span className="text-slate-700 dark:text-slate-200 font-bold">{formatPersianDate(customer.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Contact Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-transparent">
            <Phone className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 block">{isRtl ? 'تلفن همراه' : 'Mobile Phone'}</span>
              <a href={`tel:${customer.phone}`} className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400">
                {customer.phone}
              </a>
            </div>
          </div>

          {customer.email && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-transparent">
              <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block">پست الکترونیک</span>
                <span className="truncate max-w-[150px] font-medium text-slate-800 dark:text-slate-200">{customer.email}</span>
              </div>
            </div>
          )}

          {customer.nationalId && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-transparent">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block">کد ملی / شناسه</span>
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{customer.nationalId}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-transparent">
            <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-500 block">آدرس و موقعیت</span>
              <span className="truncate font-medium text-slate-800 dark:text-slate-200">{customer.address || 'ثبت نشده'}</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {customer.tags && customer.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Tag className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 me-1" />
            {customer.tags.map((t) => (
              <span
                key={t}
                className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Fast Actions Bar */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
          {onOpenNewVoiceNote && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onOpenNewVoiceNote(customer)}
              leftIcon={<Mic className="w-4 h-4" />}
              className="shadow-rose-600/20 bg-rose-600 hover:bg-rose-500 font-bold"
            >
              ضبط یادداشت صوتی (Voice Note)
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => onOpenNewCall(customer)}
            leftIcon={<PhoneCall className="w-4 h-4" />}
            className="font-bold"
          >
            ثبت تماس صوتی (AI)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenNewTask(customer)}
            leftIcon={<CheckSquare className="w-4 h-4" />}
          >
            تعریف وظیفه
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenNewPayment(customer)}
            leftIcon={<DollarSign className="w-4 h-4" />}
          >
            ثبت دریافت وجه
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenNewCheck(customer)}
            leftIcon={<FileText className="w-4 h-4" />}
          >
            ثبت چک صیادی
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenNewContract(customer)}
            leftIcon={<FileText className="w-4 h-4" />}
          >
            صدور قرارداد
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenNewRepair(customer)}
            leftIcon={<Wrench className="w-4 h-4" />}
          >
            پذیرش تعمیرگاه
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto text-xs font-semibold pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('TIMELINE')}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'TIMELINE'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          تایم‌لاین یکپارچه ({timelineEvents.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('VOICENOTES')}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'VOICENOTES'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          <Mic className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          <span>یادداشت‌های صوتی ({customerVoiceNotes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CALLS')}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'CALLS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          مکالمات و تماس‌ها ({customerCalls.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TASKS')}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'TASKS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          اقدامات و پیگیری ({customerTasks.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('FINANCES')}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'FINANCES'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          واریزی‌ها ({customerPayments.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CHECKS')}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'CHECKS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          چک‌ها ({customerChecks.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CONTRACTS')}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'CONTRACTS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          قراردادها ({customerContracts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SIMS')}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'SIMS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          سیم‌کارت‌ها ({customerSims.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REPAIRS')}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'REPAIRS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          تعمیرات ({customerRepairs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('FILES')}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'FILES'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          <Paperclip className="w-3.5 h-3.5" />
          <span>پیوست‌ها و مدارک ({customerAttachments.length})</span>
        </button>
      </div>

      {/* Panels */}
      {activeTab === 'TIMELINE' && (
        <div className="space-y-3">
          {timelineEvents.length === 0 ? (
            <div className="p-8 text-center text-slate-500 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              هیچ رویدادی در پرونده مشتری ثبت نشده است
            </div>
          ) : (
            <div className="space-y-2.5">
              {timelineEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-end space-y-2 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={evt.badgeVariant} size="sm">
                        {evt.type}
                      </Badge>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">{evt.title}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {getRelativeTimeFa(evt.timestamp)}
                    </span>
                  </div>

                  {evt.audioDataUrl && (
                    <div className="pt-1">
                      <AudioPlayer
                        src={evt.audioDataUrl}
                        duration={evt.durationSeconds}
                        compact
                      />
                    </div>
                  )}

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{evt.description}</p>

                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                    <span>ثبت: {evt.userName}</span>
                    <span>{formatPersianDate(evt.timestamp, true)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'VOICENOTES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Mic className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>یادداشت‌های صوتی اختصاصی پرونده ({customerVoiceNotes.length})</span>
            </h3>
            {onOpenNewVoiceNote && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => onOpenNewVoiceNote(customer)}
                leftIcon={<Plus className="w-4 h-4" />}
                className="bg-rose-600 hover:bg-rose-500 font-bold"
              >
                ضبط یادداشت جدید
              </Button>
            )}
          </div>

          {customerVoiceNotes.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 space-y-3 shadow-xs">
              <Volume2 className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600" />
              <p className="text-xs">هیچ یادداشت صوتی برای این پرونده ضبط نشده است.</p>
              {onOpenNewVoiceNote && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenNewVoiceNote(customer)}
                  leftIcon={<Mic className="w-4 h-4" />}
                >
                  ضبط اولین یادداشت صوتی
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {customerVoiceNotes.map((vn) => (
                <div
                  key={vn.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-end space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{vn.title}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        ثبت شده توسط {vn.createdByName} • {formatPersianDate(vn.createdAt, true)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteVoiceNote(vn.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="حذف صوت"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <AudioPlayer src={vn.audioDataUrl} duration={vn.durationSeconds} title={vn.title} />

                  {vn.transcription && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-300">
                          <Sparkles className="w-3 h-3" />
                          <span>متن پیاده‌سازی شده:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyVoiceTranscript(vn.id, vn.transcription)}
                          className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          {copiedVoiceId === vn.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">کپی شد</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span className="text-[10px]">کپی</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{vn.transcription}</p>
                    </div>
                  )}

                  {vn.tags && vn.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Tag className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      {vn.tags.map((t, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'CALLS' && (
        <div className="space-y-3">
          {customerCalls.map((c) => (
            <div key={c.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-end space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{c.subject}</span>
                <Badge variant="indigo" size="sm">{c.callType}</Badge>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{c.notes}</p>
              {c.transcript && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-0.5">متن پیاده‌سازی شده صوت:</span>
                  {c.transcript}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'TASKS' && (
        <div className="space-y-3">
          {customerTasks.map((t) => (
            <div key={t.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-end space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.title}</span>
                <Badge variant={t.priority === 'URGENT' ? 'danger' : 'warning'} size="sm">{t.priority}</Badge>
              </div>
              {t.description && <p className="text-xs text-slate-700 dark:text-slate-300">{t.description}</p>}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'FINANCES' && (
        <div className="space-y-3">
          {customerPayments.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">هیچ واریزی برای این مشتری ثبت نشده است.</p>
          ) : (
            customerPayments.map((p) => {
              const paymentAtts = storage.getAttachmentsByEntity('PAYMENT', p.id);
              return (
                <div key={p.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-end space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatToman(p.amount)}</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        روش: {p.paymentType || p.method || 'واریزی'} • تاریخ: {formatPersianDate(p.paymentDate || p.date, false)}
                      </p>
                    </div>
                    <Badge variant="emerald" size="sm">
                      {p.referenceNumber ? `پیگیری: ${p.referenceNumber}` : 'ثبت شده'}
                    </Badge>
                  </div>
                  {p.description && (
                    <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                      بابت: {p.description}
                    </p>
                  )}
                  {paymentAtts.length > 0 && (
                    <div className="pt-1.5 space-y-1.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                        <Paperclip className="w-3 h-3 text-indigo-500" />
                        <span>فیش‌های واریزی و ضمائم ({paymentAtts.length}):</span>
                      </span>
                      <AttachmentPreview.List attachments={paymentAtts} viewMode="chips" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'CHECKS' && (
        <div className="space-y-3">
          {customerChecks.map((chk) => (
            <div key={chk.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-end flex items-center justify-between shadow-xs">
              <div>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-300">{formatToman(chk.amount)}</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">بانک {chk.bankName} • سررسید: {formatPersianDate(chk.dueDate)}</p>
              </div>
              <Badge variant="purple" size="sm">{chk.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'CONTRACTS' && (
        <div className="space-y-3">
          {customerContracts.map((cnt) => (
            <div key={cnt.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-end space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{cnt.title}</span>
                <Badge variant="indigo" size="sm">{cnt.status}</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">شماره: {cnt.contractNumber} • مبلغ کل: {formatToman(cnt.totalAmount)}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'SIMS' && (
        <div className="space-y-3">
          {customerSims.map((sim) => (
            <div key={sim.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-end flex items-center justify-between shadow-xs">
              <div>
                <span className="text-sm font-bold font-mono text-cyan-600 dark:text-cyan-400">{sim.phoneNumber}</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">اپراتور: {sim.operator} • وضعیت: {sim.status}</p>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatToman(sim.salePrice)}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'REPAIRS' && (
        <div className="space-y-3">
          {customerRepairs.map((rep) => (
            <div key={rep.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-end space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{rep.deviceModel} ({rep.trackingCode})</span>
                <Badge variant="info" size="sm">{rep.status}</Badge>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300">{rep.problemDescription}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'FILES' && (
        <div className="space-y-4">
          <AttachmentPreview.List
            attachments={customerAttachments}
            viewMode="grid"
            emptyMessage="هیچ مدرک یا سندی برای این مشتری بارگذاری نشده است."
            onDelete={(id) => {
              storage.deleteAttachment(id);
              onRefreshCustomer();
            }}
          />
        </div>
      )}

      {/* Delete Single Customer Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        maxWidth="md"
        title={
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>تأیید حذف پرونده مخاطب</span>
          </div>
        }
        subtitle="این عملیات غیرقابل بازگشت است و تمام سوابق مخاطب حذف خواهند شد."
      >
        <div className="space-y-4 text-end">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            آیا از حذف پرونده مخاطب «<strong className="text-white font-bold">{customer.name}</strong>» با شماره{' '}
            <span className="font-mono text-rose-300 font-bold" dir="ltr">{customer.mobile}</span> و کد سیستم{' '}
            <span className="font-mono text-slate-200">{customer.code}</span> اطمینان دارید؟
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              انصراف
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={() => {
                storage.deleteCustomer(customer.id);
                success(`پرونده مخاطب «${customer.name}» با موفقیت حذف شد`);
                setIsDeleteModalOpen(false);
                if (onDeleteCustomer) onDeleteCustomer(customer.id);
                onBack();
              }}
              leftIcon={<Trash2 className="w-4 h-4" />}
              className="bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
            >
              تأیید و حذف نهایی مخاطب
            </Button>
          </div>
        </div>
      </Modal>

      {/* Global Print Modal for Customer Dossier */}
      <GlobalPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={`پرونده جامع مخاطب: ${customer.name}`}
        subtitle="خلاصه سوابق ارتباطی، مالی و حقوقی در سامانه MMBA"
        documentNumber={customer.code || customer.id}
        documentDate={new Date().toISOString()}
      >
        <div className="space-y-4 text-xs">
          {/* Identity Block */}
          <div className="border border-slate-300 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-900/60">
            <h3 className="font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1">مشخصات هویتی و ثبتی</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div><span className="text-slate-500">نام و عنوان:</span> <strong className="text-slate-900">{customer.name}</strong></div>
              <div><span className="text-slate-500">شماره موبایل:</span> <strong className="text-slate-900 dir-ltr font-mono">{customer.mobile || customer.phone}</strong></div>
              <div><span className="text-slate-500">کد پرونده:</span> <strong className="text-slate-900 font-mono">{customer.code}</strong></div>
              <div><span className="text-slate-500">کد / شناسه ملی:</span> <strong className="text-slate-900 font-mono">{customer.nationalCode || customer.nationalId || '—'}</strong></div>
              <div><span className="text-slate-500">شرکت / سازمان:</span> <strong className="text-slate-900">{customer.companyName || customer.company || '—'}</strong></div>
              <div><span className="text-slate-500">سمت شغلی:</span> <strong className="text-slate-900">{customer.jobTitle || '—'}</strong></div>
              <div><span className="text-slate-500">علت ثبت شماره:</span> <strong className="text-slate-900">{customer.registrationReason || 'مشتری'} {customer.registrationReasonOther ? `(${customer.registrationReasonOther})` : ''}</strong></div>
              <div><span className="text-slate-500">تاریخ ثبت در سامانه:</span> <strong className="text-slate-900">{formatPersianDate(customer.createdAt)}</strong></div>
              <div><span className="text-slate-500">سقف اعتبار مالی:</span> <strong className="text-slate-900 font-mono">{formatToman(customer.creditLimit || 0)}</strong></div>
            </div>
            {customer.address && (
              <div className="mt-2 pt-2 border-t border-slate-200">
                <span className="text-slate-500">نشانی دقیق:</span> <span className="text-slate-800">{customer.address}</span>
              </div>
            )}
            {customer.notes && (
              <div className="mt-1.5">
                <span className="text-slate-500">یادداشت پرونده:</span> <span className="text-slate-800">{customer.notes}</span>
              </div>
            )}
          </div>

          {/* Activity Statistics */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="border border-slate-300 dark:border-slate-700 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60">
              <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{customerCalls.length}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">تماس و تعامل</div>
            </div>
            <div className="border border-slate-300 dark:border-slate-700 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60">
              <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{customerContracts.length}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">قرارداد</div>
            </div>
            <div className="border border-slate-300 dark:border-slate-700 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60">
              <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{customerPayments.length}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">پرداخت و تسویه</div>
            </div>
            <div className="border border-slate-300 dark:border-slate-700 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60">
              <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{customerChecks.length}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">برگه چک</div>
            </div>
          </div>

          {/* Recent Timeline Records */}
          <div className="border border-slate-300 rounded-lg p-3">
            <h4 className="font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1">آخرین وقایع و تعاملات ثبت‌شده</h4>
            <div className="space-y-1.5">
              {timelineEvents.slice(0, 5).map((ev) => (
                <div key={ev.id} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-none">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{ev.title}</span>
                    <span className="text-slate-500 truncate max-w-md">{ev.description}</span>
                  </div>
                  <span className="text-slate-500 font-mono shrink-0">{formatPersianDate(ev.timestamp)}</span>
                </div>
              ))}
              {timelineEvents.length === 0 && (
                <p className="text-slate-400 text-center py-2">سابقه تعاملی برای این مخاطب ثبت نشده است.</p>
              )}
            </div>
          </div>
        </div>
      </GlobalPrintModal>
    </div>
  );
};
