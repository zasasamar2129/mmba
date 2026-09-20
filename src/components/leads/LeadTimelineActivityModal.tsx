import React, { useState } from 'react';
import {
  Lead, LeadActivity, LeadActivityType, LeadStatus, User, TaskPriority, ModuleName
} from '../../types';
import { storage } from '../../services/storage';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import {
  PhoneCall, Calendar, Clock, AlertTriangle, UserCheck, ShieldAlert,
  Plus, CheckCircle2, History, FileText, Send, User as UserIcon,
  Tag, MessageSquare, ArrowRight, ShieldCheck, ChevronRight
} from 'lucide-react';
import { formatPersianDate, gregorianToJalali } from '../../lib/dateUtils';

export interface LeadTimelineActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  currentUser?: User;
  onActivityAdded?: (updatedLead: Lead) => void;
  onOpenConvertModal?: (lead: Lead) => void;
}

const ACTIVITY_LABELS: Record<LeadActivityType, { label: string; color: string }> = {
  CALL: { label: 'تماس تلفنی', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  FOLLOW_UP: { label: 'پیگیری', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  APPOINTMENT: { label: 'قرار ملاقات', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  MEETING_RESULT: { label: 'نتیجه قرار', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  NOTE: { label: 'یادداشت', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
  SMS: { label: 'ارسال پیامک', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300' },
  STATUS_CHANGE: { label: 'تغییر وضعیت', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
};

export const LeadTimelineActivityModal: React.FC<LeadTimelineActivityModalProps> = ({
  isOpen,
  onClose,
  lead,
  currentUser,
  onActivityAdded,
  onOpenConvertModal,
}) => {
  const { success, error, warning } = useToast();
  const [activeTab, setActiveTab] = useState<'timeline' | 'add_activity' | 'audit'>('timeline');

  // New Activity Form State
  const [activityType, setActivityType] = useState<LeadActivityType>('CALL');
  const [resultText, setResultText] = useState('');
  const [appointmentResult, setAppointmentResult] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');
  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('10:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !lead) return null;

  const activities = storage.getLeadActivities(lead.id);
  const leadAuditLogs = storage.getAuditLogsForEntity('LEAD', lead.id);

  // Check for Duplicate Call Warning (if last follow-up occurred within 24 hours)
  const isRecentFollowUp = (() => {
    if (!lead.lastFollowUp?.date) return false;
    const lastDate = new Date(lead.lastFollowUp.date).getTime();
    const diffHours = (Date.now() - lastDate) / (1000 * 60 * 60);
    return diffHours <= 48; // within last 48 hours
  })();

  const isDifferentOperator = lead.lastFollowUp && currentUser && lead.lastFollowUp.operatorId !== currentUser.id;

  const handleRegisterActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultText.trim()) {
      error('لطفاً شرح نتیجه مکالمه یا یادداشت را وارد فرمایید.');
      return;
    }

    setIsSubmitting(true);
    try {
      let nextFollowUpIso: string | undefined = undefined;
      let nextFollowUpJalali: string | undefined = undefined;

      if (needsFollowUp && followUpDate) {
        const fullDateTimeStr = `${followUpDate}T${followUpTime || '10:00'}:00`;
        const fDate = new Date(fullDateTimeStr);
        if (!isNaN(fDate.getTime())) {
          nextFollowUpIso = fDate.toISOString();
          const j = gregorianToJalali(fDate.getFullYear(), fDate.getMonth() + 1, fDate.getDate());
          nextFollowUpJalali = `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')} ${followUpTime || '10:00'}`;
        }
      }

      const res = storage.addLeadActivity(lead.id, {
        type: activityType,
        result: resultText.trim(),
        operatorId: currentUser?.id,
        operatorName: currentUser?.name,
        appointmentResult: appointmentResult.trim() || undefined,
        newStatus: newStatus ? (newStatus as LeadStatus) : undefined,
        nextFollowUpDate: nextFollowUpIso,
        nextFollowUpJalali,
      });

      success(
        res.task
          ? 'فعالیت با موفقیت ثبت شد و وظیفه پیگیری در کارتابل ایجاد گردید.'
          : 'فعالیت با موفقیت در تاریخچه سرنخ ثبت گردید.'
      );

      // Reset form
      setResultText('');
      setAppointmentResult('');
      setNeedsFollowUp(false);
      setFollowUpDate('');
      setActiveTab('timeline');

      if (onActivityAdded) {
        onActivityAdded(res.lead);
      }
    } catch (err: any) {
      error(err.message || 'خطا در ثبت فعالیت سرنخ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`پرونده و تایم‌لاین سرنخ: ${lead.name || 'بدون نام'} (${lead.leadCode})`}
      size="xl"
    >
      <div className="space-y-4">
        {/* Top Summary & Duplicate Call Alert */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-1 rounded-lg">
                {lead.leadCode}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                {lead.name || 'مخاطب بدون نام'}
              </span>
              <span className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700" dir="ltr">
                {lead.mobile}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={lead.status === LeadStatus.CONVERTED ? 'success' : 'default'}>
                {lead.status}
              </Badge>
              {lead.status !== LeadStatus.CONVERTED && onOpenConvertModal && (
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => {
                    onClose();
                    onOpenConvertModal(lead);
                  }}
                  leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                >
                  تبدیل به مشتری
                </Button>
              )}
            </div>
          </div>

          {/* DUPLICATE CALL WARNING BANNER */}
          {lead.lastFollowUp && isRecentFollowUp && (
            <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <span className="font-bold">هشدار تماس و پیگیری تکراری: </span>
                این سرنخ در تاریخ <span className="font-semibold text-amber-900 dark:text-amber-200">{lead.lastFollowUp.jalaliDate}</span> توسط اپراتور{' '}
                <span className="font-bold text-amber-900 dark:text-amber-200">{lead.lastFollowUp.operatorName}</span> پیگیری شده است.
                {isDifferentOperator && (
                  <span className="block mt-0.5 text-amber-700 dark:text-amber-400 font-medium">
                    توجه: همکار شما اخیراً با این مشتری گفتگو داشته است. برای جلوگیری از نارضایتی مشتری یا تداخل مذاکره، به نتیجه پیگیری قبلی توجه کنید.
                  </span>
                )}
                <div className="mt-1 text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-amber-200 dark:border-amber-900/40">
                  <span className="font-semibold">آخرین نتیجه ثبت شده: </span>
                  {lead.lastFollowUp.result}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'timeline'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>تاریخچه و تایم‌لاین فعالیت‌ها ({activities.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('add_activity')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'add_activity'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>ثبت فعالیت و پیگیری جدید</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'audit'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>گزارش حسابرسی (Audit Log) ({leadAuditLogs.length})</span>
          </button>
        </div>

        {/* TAB 1: TIMELINE TABLE (EXACT MATCH WITH PROMPT) */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">هنوز فعالیتی برای این سرنخ ثبت نشده است</p>
                <p className="text-xs text-slate-500 mt-1">
                  از زبانه «ثبت فعالیت و پیگیری جدید» برای ذخیره نتایج تماس، قرار ملاقات یا یادداشت استفاده کنید.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('add_activity')}
                  className="mt-3"
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  ثبت اولین فعالیت
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-end text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3 w-36">تاریخ و ساعت</th>
                      <th className="p-3 w-28">اپراتور</th>
                      <th className="p-3 w-28">نوع فعالیت</th>
                      <th className="p-3">نتیجه و شرح مکالمه</th>
                      <th className="p-3 w-36">پیگیری بعدی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {activities.map((act) => {
                      const actConfig = ACTIVITY_LABELS[act.type] || { label: act.type, color: 'bg-slate-100 text-slate-800' };
                      return (
                        <tr key={act.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap" dir="ltr">
                            {act.jalaliDate}
                          </td>
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <UserIcon className="w-3 h-3 text-slate-400" />
                              {act.operatorName}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${actConfig.color}`}>
                              {actConfig.label}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300 leading-relaxed">
                            {act.result}
                            {act.appointmentResult && (
                              <div className="mt-1 text-indigo-600 dark:text-indigo-400 text-[11px] font-medium">
                                نتیجه جلسه: {act.appointmentResult}
                              </div>
                            )}
                            {act.newStatus && (
                              <div className="mt-1 text-slate-500 text-[10px]">
                                تغییر وضعیت به: <span className="font-semibold">{act.newStatus}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]" dir="ltr">
                            {act.nextFollowUpJalali ? (
                              <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/60">
                                {act.nextFollowUpJalali}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REGISTER NEW ACTIVITY FORM */}
        {activeTab === 'add_activity' && (
          <form onSubmit={handleRegisterActivity} className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>ثبت سریع فعالیت، نتیجه مکالمه و زمان‌بندی پیگیری</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  نوع فعالیت
                </label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as LeadActivityType)}
                  className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="CALL">تماس تلفنی</option>
                  <option value="FOLLOW_UP">پیگیری</option>
                  <option value="APPOINTMENT">قرار ملاقات حضوری / آنلاین</option>
                  <option value="MEETING_RESULT">ثبت نتیجه جلسه / قرار</option>
                  <option value="NOTE">یادداشت داخلی</option>
                  <option value="SMS">ارسال پیامک</option>
                  <option value="STATUS_CHANGE">تغییر وضعیت سرنخ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  وضعیت جدید سرنخ (اختیاری)
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">بدون تغییر وضعیت ({lead.status})</option>
                  <option value={LeadStatus.NEW_LEAD}>سرنخ جدید</option>
                  <option value={LeadStatus.CONTACTED}>تماس گرفته شده</option>
                  <option value={LeadStatus.FOLLOW_UP}>در حال پیگیری</option>
                  <option value={LeadStatus.NEGOTIATION}>در حال مذاکره</option>
                  <option value={LeadStatus.CONVERTED}>تبدیل به مشتری</option>
                  <option value={LeadStatus.LOST}>عدم توافق / لغو</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                نتیجه مکالمه / شرح فعالیت <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
                placeholder="مثال: مشتری گفت دو روز دیگر خبر می‌دهد و علاقه‌مند به خرید سیم‌کارت رند بود..."
                rows={3}
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
                required
              />
            </div>

            {(activityType === 'APPOINTMENT' || activityType === 'MEETING_RESULT') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  نتیجه یا دستور کار قرار ملاقات
                </label>
                <input
                  type="text"
                  value={appointmentResult}
                  onChange={(e) => setAppointmentResult(e.target.value)}
                  placeholder="موضوع جلسه، تصمیمات اتخاذ شده یا مدارک مورد توافق..."
                  className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Checkbox for next follow-up & Task creation */}
            <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={needsFollowUp}
                  onChange={(e) => setNeedsFollowUp(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span>این سرنخ نیاز به پیگیری بعدی دارد (ایجاد خودکار وظیفه در کارتابل)</span>
              </label>

              {needsFollowUp && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      تاریخ پیگیری بعدی
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                      required={needsFollowUp}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      ساعت پیگیری
                    </label>
                    <input
                      type="time"
                      value={followUpTime}
                      onChange={(e) => setFollowUpTime(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('timeline')}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                leftIcon={<Send className="w-4 h-4" />}
              >
                {isSubmitting ? 'در حال ثبت...' : 'ثبت قطعی فعالیت'}
              </Button>
            </div>
          </form>
        )}

        {/* TAB 3: AUDIT TRAIL OF THIS LEAD */}
        {activeTab === 'audit' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              تاریخچه امنیتی کلیه تغییرات، ویرایش‌ها و اقدامات انجام شده بر روی پرونده سرنخ به همراه مقادیر قبلی و جدید:
            </div>

            {leadAuditLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                هیچ رکورد حسابرسی برای این سرنخ ثبت نشده است.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-end text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5 w-36">تاریخ و زمان</th>
                      <th className="p-2.5 w-32">اپراتور</th>
                      <th className="p-2.5 w-32">عملیات</th>
                      <th className="p-2.5">جزئیات تغییرات</th>
                      <th className="p-2.5">مقدار قبلی / جدید</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {leadAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2.5 font-mono text-slate-500 whitespace-nowrap text-[11px]" dir="ltr">
                          {formatPersianDate(log.timestamp, true)}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {log.userName}
                        </td>
                        <td className="p-2.5 text-indigo-600 dark:text-indigo-400 font-medium whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="p-2.5 text-slate-700 dark:text-slate-300">
                          {log.details}
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-500">
                          {log.oldValue || log.newValue ? (
                            <div className="space-y-0.5">
                              {log.oldValue && (
                                <div className="text-rose-600 dark:text-rose-400">
                                  <span className="font-bold">قبل: </span>
                                  {typeof log.oldValue === 'object' ? JSON.stringify(log.oldValue) : String(log.oldValue)}
                                </div>
                              )}
                              {log.newValue && (
                                <div className="text-emerald-600 dark:text-emerald-400">
                                  <span className="font-bold">بعد: </span>
                                  {typeof log.newValue === 'object' ? JSON.stringify(log.newValue) : String(log.newValue)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
