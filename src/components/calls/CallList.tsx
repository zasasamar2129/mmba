import React, { useState, useMemo } from 'react';
import { Call, Customer, User, InteractionType } from '../../types';
import {
  PhoneCall,
  Search,
  Plus,
  Calendar,
  Clock,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  PhoneIncoming,
  PhoneOutgoing,
  MapPin,
  MessageSquare,
  HelpCircle,
  Check,
  FileText,
  Mic,
  Trash2,
  Filter,
  ArrowUpDown,
  CheckCheck
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { ExportExcelButton } from '../ui/ExportExcelButton';
import { exportCallsToExcel } from '../../lib/exportToExcel';
import { formatPersianDate, getRelativeTimeFa } from '../../lib/dateUtils';
import { storage } from '../../services/storage';
import { api } from '../../services/api';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { ListViewControls, usePersistentViewMode } from '../ui/ListViewControls';

export interface CallListProps {
  calls: Call[];
  customers: Customer[];
  currentUser?: User;
  onAddNewCall: () => void;
  onSelectCustomer: (customerId: string) => void;
  onRefreshCalls?: () => void;
}

export const CallList: React.FC<CallListProps> = ({
  calls = [],
  customers = [],
  currentUser,
  onAddNewCall,
  onSelectCustomer,
  onRefreshCalls,
}) => {
  const { success, error } = useToast();
  const { t, isRtl, formatNumber, language } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState<string>('ALL');
  const [followUpFilter, setFollowUpFilter] = useState<'ALL' | 'REQUIRED' | 'PENDING' | 'DONE'>('ALL');
  const [completingId, setCompletingId] = useState<string | null>(null);

  // View Mode & Pagination
  const [viewMode, setViewMode] = usePersistentViewMode('calls', 'list');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Stats calculation
  const stats = useMemo(() => {
    const total = calls.length;
    const followUpRequired = calls.filter((c) => c.followUpRequired).length;
    const followUpPending = calls.filter((c) => c.followUpRequired && !c.followUpCompleted).length;
    const followUpDone = calls.filter((c) => c.followUpRequired && c.followUpCompleted).length;
    const totalDurationSec = calls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
    const totalDurationMin = Math.round(totalDurationSec / 60);

    return {
      total,
      followUpRequired,
      followUpPending,
      followUpDone,
      totalDurationMin,
    };
  }, [calls]);

  const filteredCalls = useMemo(() => {
    return (calls || [])
      .filter((c) => {
        // Type filter
        if (callTypeFilter !== 'ALL') {
          const type = (c.callType || '').toLowerCase();
          const target = callTypeFilter.toLowerCase();
          if (target === 'incoming_call' || target === 'inbound') {
            if (type !== 'incoming_call' && type !== 'inbound') return false;
          } else if (target === 'outgoing_call' || target === 'outbound') {
            if (type !== 'outgoing_call' && type !== 'outbound') return false;
          } else if (target === 'visit' || target === 'meeting') {
            if (type !== 'visit' && type !== 'meeting') return false;
          } else if (target === 'message') {
            if (type !== 'message') return false;
          } else if (type !== target) {
            return false;
          }
        }

        // Follow up filter
        if (followUpFilter === 'REQUIRED' && !c.followUpRequired) return false;
        if (followUpFilter === 'PENDING' && (!c.followUpRequired || c.followUpCompleted)) return false;
        if (followUpFilter === 'DONE' && (!c.followUpRequired || !c.followUpCompleted)) return false;

        // Search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          (c.subject && c.subject.toLowerCase().includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q)) ||
          (c.customerRequest && c.customerRequest.toLowerCase().includes(q)) ||
          (c.outcome && c.outcome.toLowerCase().includes(q)) ||
          (c.voiceTranscript && c.voiceTranscript.toLowerCase().includes(q)) ||
          (c.customerName && c.customerName.toLowerCase().includes(q)) ||
          (c.customerMobile && c.customerMobile.includes(q)) ||
          (c.userName && c.userName.toLowerCase().includes(q)) ||
          (c.followUpUserName && c.followUpUserName.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [calls, searchQuery, callTypeFilter, followUpFilter]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return isRtl ? '۰ ثانیه' : '0 sec';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return isRtl ? `${secs} ثانیه` : `${secs} sec`;
    if (secs === 0) return isRtl ? `${mins} دقیقه` : `${mins} min`;
    return isRtl ? `${mins} دقیقه و ${secs} ثانیه` : `${mins} min ${secs} sec`;
  };

  const getTypeBadgeInfo = (callType: string = '') => {
    const typeStr = callType.toLowerCase();
    if (typeStr === 'incoming_call' || typeStr === 'inbound') {
      return {
        label: t('calls.typeIncoming'),
        icon: <PhoneIncoming className="w-4 h-4 text-sky-400" />,
        badgeVariant: 'default' as const,
        bgClass: 'bg-sky-500/10 border-sky-500/20 text-sky-300',
      };
    }
    if (typeStr === 'outgoing_call' || typeStr === 'outbound') {
      return {
        label: t('calls.typeOutgoing'),
        icon: <PhoneOutgoing className="w-4 h-4 text-emerald-400" />,
        badgeVariant: 'success' as const,
        bgClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
      };
    }
    if (typeStr === 'visit' || typeStr === 'meeting') {
      return {
        label: t('calls.typeVisit'),
        icon: <MapPin className="w-4 h-4 text-amber-400" />,
        badgeVariant: 'warning' as const,
        bgClass: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
      };
    }
    if (typeStr === 'message') {
      return {
        label: t('calls.typeMessage'),
        icon: <MessageSquare className="w-4 h-4 text-indigo-400" />,
        badgeVariant: 'purple' as const,
        bgClass: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300',
      };
    }
    return {
      label: isRtl ? 'سایر تعاملات' : 'Other Interactions',
      icon: <PhoneCall className="w-4 h-4 text-slate-400" />,
      badgeVariant: 'default' as const,
      bgClass: 'bg-slate-800/80 border-slate-700 text-slate-300',
    };
  };

  const handleCompleteFollowUp = async (callId: string) => {
    setCompletingId(callId);
    try {
      // Complete via API
      await api.completeInteractionFollowUp(callId);
      
      // Update local storage call state
      const targetCall = calls.find((c) => c.id === callId);
      if (targetCall) {
        storage.saveCall({
          ...targetCall,
          followUpCompleted: true,
        });
      }

      success(isRtl ? 'پیگیری تعامل با موفقیت به عنوان انجام‌شده ثبت گردید' : 'Interaction marked as followed up');
      if (onRefreshCalls) onRefreshCalls();
    } catch (err: any) {
      console.error(err);
      error(err.message || (isRtl ? 'خطا در ثبت وضعیت پیگیری' : 'Error updating follow-up status'));
    } finally {
      setCompletingId(null);
    }
  };

  const handleDeleteCall = async (callId: string) => {
    if (!window.confirm(isRtl ? 'آیا از حذف این رکورد مکالمه اطمینان دارید؟' : 'Are you sure you want to delete this call record?')) return;
    try {
      storage.deleteCall(callId);
      await api.deleteInteraction(callId).catch(() => {});
      success(isRtl ? 'مکالمه با موفقیت حذف گردید' : 'Call deleted successfully');
      if (onRefreshCalls) onRefreshCalls();
    } catch (err: any) {
      error(isRtl ? 'خطا در حذف مکالمه' : 'Error deleting call');
    }
  };

  return (
    <div className="space-y-6 animate-blur-fade-up">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-end">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {t('calls.title')}
            </h1>
            <Badge variant="purple" size="sm">
              {filteredCalls.length} {t('calls.filterType')}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('calls.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <ExportExcelButton
            onExport={() => exportCallsToExcel(filteredCalls)}
            itemCount={filteredCalls.length}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={onAddNewCall}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('calls.newCallBtn')}
          </Button>
        </div>
      </div>

      {/* Overview Metric Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 text-end">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('calls.totalCalls')}</span>
          <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.total} {isRtl ? 'رکورد' : 'records'}</div>
        </div>

        <div className="p-3.5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 text-end">
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">{t('calls.pendingFollowups')}</span>
          <div className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-300 mt-1">{stats.followUpPending} {isRtl ? 'مورد' : 'items'}</div>
        </div>

        <div className="p-3.5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 text-end">
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{t('calls.completedFollowups')}</span>
          <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-300 mt-1">{stats.followUpDone} {isRtl ? 'مورد' : 'items'}</div>
        </div>

        <div className="p-3.5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 text-end">
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">{t('calls.totalDuration')}</span>
          <div className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-300 mt-1">{stats.totalDurationMin} {isRtl ? 'دقیقه' : 'min'}</div>
        </div>
      </div>

      {/* Filter & Search Panel */}
      <div className="p-4 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3.5 text-end">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('calls.searchPlaceholder')}
              rightIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
        </div>

        {/* Type & Follow-up Filter Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/60 text-xs">
          {/* Interaction Type Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-600 dark:text-slate-400 font-medium ms-1">{t('calls.filterType')}:</span>
            {[
              { id: 'ALL', label: t('common.all') },
              { id: InteractionType.OUTGOING_CALL, label: isRtl ? 'تماس خروجی' : 'Outgoing Call' },
              { id: InteractionType.INCOMING_CALL, label: isRtl ? 'تماس ورودی' : 'Incoming Call' },
              { id: InteractionType.VISIT, label: t('calls.typeVisit') },
              { id: InteractionType.MESSAGE, label: isRtl ? 'پیام‌رسان / پیامک' : 'Messenger / SMS' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCallTypeFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  callTypeFilter === f.id
                    ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Follow-up State Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-600 dark:text-slate-400 font-medium ms-1">{t('calls.filterFollowUp')}:</span>
            {[
              { id: 'ALL', label: isRtl ? 'همه' : 'All' },
              { id: 'REQUIRED', label: isRtl ? 'دارای پیگیری' : 'Has Follow-up' },
              { id: 'PENDING', label: isRtl ? 'معوق / منتظر' : 'Pending' },
              { id: 'DONE', label: isRtl ? 'انجام‌شده' : 'Done' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFollowUpFilter(f.id as any)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  followUpFilter === f.id
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold border border-slate-300 dark:border-slate-600'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calls / Interactions Stream */}
      {filteredCalls.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-3xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3">
          <PhoneCall className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-300">{isRtl ? 'هیچ مکالمه یا تعاملی با این مشخصات یافت نشد' : 'No calls or interactions match your filter'}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{isRtl ? 'می‌توانید فیلترها را تغییر داده یا تعامل جدیدی را ثبت کنید' : 'Try changing filters or log a new interaction'}</p>
          <Button variant="primary" size="sm" onClick={onAddNewCall} leftIcon={<Plus className="w-4 h-4" />}>
            {t('calls.newCallBtn')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCalls.map((cl) => {
            const typeInfo = getTypeBadgeInfo(cl.callType);
            const isFollowUpPending = cl.followUpRequired && !cl.followUpCompleted;
            const isFollowUpDone = cl.followUpRequired && cl.followUpCompleted;

            return (
              <div
                key={cl.id}
                className="p-4 sm:p-5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-end space-y-3.5 relative overflow-hidden"
              >
                {/* Top Row: Type, Customer, Subject, Time */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl border ${typeInfo.bgClass} shrink-0 mt-0.5`}>
                      {typeInfo.icon}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectCustomer(cl.customerId)}
                          className="text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors hover:underline"
                        >
                          {cl.customerName || (isRtl ? 'مشتری بدون نام' : 'Unnamed customer')}
                        </button>
                        {cl.customerMobile && (
                          <span className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
                            {cl.customerMobile}
                          </span>
                        )}
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${typeInfo.bgClass} font-medium`}>
                          {typeInfo.label}
                        </span>
                        {cl.result && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {cl.result}
                          </span>
                        )}
                      </div>

                      <h3 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
                        {cl.subject}
                      </h3>
                    </div>
                  </div>

                  {/* Date & Duration */}
                  <div className="text-start sm:text-start text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    <div className="flex items-center gap-1.5 sm:justify-end text-slate-700 dark:text-slate-300 font-medium">
                      <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{formatDuration(cl.durationSeconds)}</span>
                    </div>
                    <span className="text-slate-500 block mt-0.5">
                      {formatPersianDate(cl.dateTime, true)} ({getRelativeTimeFa(cl.dateTime)})
                    </span>
                  </div>
                </div>

                {/* Structured Details: Customer Request & Outcome */}
                {(cl.customerRequest || cl.outcome) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {cl.customerRequest && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>{isRtl ? 'درخواست و نیاز مشتری:' : 'Customer Request:'}</span>
                        </div>
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                          {cl.customerRequest}
                        </p>
                      </div>
                    )}

                    {cl.outcome && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3.5 h-3.5" />
                          <span>{isRtl ? 'نتیجه و توافق حاصل‌شده:' : 'Outcome & Agreement:'}</span>
                        </div>
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                          {cl.outcome}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* General Notes */}
                {cl.notes && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      <FileText className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>{isRtl ? 'خلاصه مذاکرات:' : 'Negotiation Summary:'}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/60">
                      {cl.notes}
                    </p>
                  </div>
                )}

                {/* Voice Transcript if present */}
                {(cl.voiceTranscript || cl.transcript) && (
                  <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/30 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-600 dark:text-purple-400">
                      <Mic className="w-3.5 h-3.5" />
                      <span>{isRtl ? 'متن پیاده‌سازی صوتی:' : 'Voice Transcript:'}</span>
                    </div>
                    <p className="text-xs text-purple-900 dark:text-purple-200 font-mono leading-relaxed">
                      {cl.voiceTranscript || cl.transcript}
                    </p>
                  </div>
                )}

                {/* Follow-up Status Banner */}
                {cl.followUpRequired && (
                  <div
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-all ${
                      isFollowUpDone
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isFollowUpDone ? (
                        <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold">
                          {isFollowUpDone ? (isRtl ? 'پیگیری تکمیل گردید' : 'Follow-up Completed') : (isRtl ? 'نیازمند پیگیری:' : 'Needs Follow-up:')}
                        </span>{' '}
                        <span>
                          {cl.followUpDate ? formatPersianDate(cl.followUpDate, true) : (isRtl ? 'بدون تاریخ مشخص' : 'No date set')}
                        </span>
                        {cl.followUpUserName && (
                          <span className="text-slate-500 dark:text-slate-400 me-2">
                            (مسئول: {cl.followUpUserName})
                          </span>
                        )}
                      </div>
                    </div>

                    {!isFollowUpDone && (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => handleCompleteFollowUp(cl.id)}
                        isLoading={completingId === cl.id}
                        leftIcon={<Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />}
                      >
                        علامت‌گذاری به عنوان انجام‌شده
                      </Button>
                    )}
                  </div>
                )}

                {/* Footer: Recorded By, Customer Link, Delete Action */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <span>{isRtl ? 'ثبت‌کننده:' : 'Logged by:'} {cl.userName || (isRtl ? 'کارشناس' : 'Agent')}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectCustomer(cl.customerId)}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors"
                    >
                      مشاهده پرونده کامل مشتری ←
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCall(cl.id)}
                      className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
                      title={isRtl ? 'حذف این رکورد' : 'Delete this record'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
