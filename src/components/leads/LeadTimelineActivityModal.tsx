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
import { useTranslation } from '../../lib/i18n';

export interface LeadTimelineActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  currentUser?: User;
  onActivityAdded?: (updatedLead: Lead) => void;
  onOpenConvertModal?: (lead: Lead) => void;
}

const ACTIVITY_LABELS: Record<LeadActivityType, { labelFa: string; labelEn: string; color: string }> = {
  CALL: { labelFa: 'تماس تلفنی', labelEn: 'Call', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  FOLLOW_UP: { labelFa: 'پیگیری', labelEn: 'Follow-up', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  APPOINTMENT: { labelFa: 'قرار ملاقات', labelEn: 'Appointment', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  MEETING_RESULT: { labelFa: 'نتیجه قرار', labelEn: 'Meeting Result', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  NOTE: { labelFa: 'یادداشت', labelEn: 'Note', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
  SMS: { labelFa: 'ارسال پیامک', labelEn: 'SMS', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300' },
  STATUS_CHANGE: { labelFa: 'تغییر وضعیت', labelEn: 'Status Change', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
};

export const LeadTimelineActivityModal: React.FC<LeadTimelineActivityModalProps> = ({
  isOpen,
  onClose,
  lead,
  currentUser,
  onActivityAdded,
  onOpenConvertModal,
}) => {
  const { success, error } = useToast();
  const { isRtl } = useTranslation();
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
      error(isRtl ? 'لطفاً شرح نتیجه مکالمه یا یادداشت را وارد فرمایید.' : 'Please enter the conversation result or note.');
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
          ? (isRtl ? 'فعالیت با موفقیت ثبت شد و وظیفه پیگیری در کارتابل ایجاد گردید.' : 'Activity saved and follow-up task created.')
          : (isRtl ? 'فعالیت با موفقیت در تاریخچه سرنخ ثبت گردید.' : 'Activity saved to lead history.')
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
      error(err.message || (isRtl ? 'خطا در ثبت فعالیت سرنخ' : 'Error saving lead activity'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${isRtl ? 'پرونده و تایم‌لاین سرنخ:' : 'Lead Timeline:'} ${lead.name || (isRtl ? 'بدون نام' : 'Unknown')} (${lead.leadCode})`}
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
                {lead.name || (isRtl ? 'مخاطب بدون نام' : 'Unnamed contact')}
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
                  {isRtl ? 'تبدیل به مشتری' : 'Convert to Customer'}
                </Button>
              )}
            </div>
          </div>

          {/* DUPLICATE CALL WARNING BANNER */}
          {lead.lastFollowUp && isRecentFollowUp && (
            <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <span className="font-bold">{isRtl ? 'هشدار تماس و پیگیری تکراری:' : 'Duplicate Call Alert:'} </span>
                {isRtl ? 'این سرنخ در تاریخ' : 'This lead was followed up on'} <span className="font-semibold text-amber-900 dark:text-amber-200">{lead.lastFollowUp.jalaliDate}</span> {isRtl ? 'توسط اپراتور' : 'by operator'}{' '}
                <span className="font-bold text-amber-900 dark:text-amber-200">{lead.lastFollowUp.operatorName}</span> {isRtl ? 'پیگیری شده است.' : '.'}
                {isDifferentOperator && (
                  <span className="block mt-0.5 text-amber-700 dark:text-amber-400 font-medium">
                    {isRtl ? 'توجه: همکار شما اخیراً با این مشتری گفتگو داشته است. برای جلوگیری از نارضایتی مشتری یا تداخل مذاکره، به نتیجه پیگیری قبلی توجه کنید.' : 'Note: a colleague recently spoke with this customer. Review the previous follow-up result to avoid conflicting negotiations.'}
                  </span>
                )}
                <div className="mt-1 text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-amber-200 dark:border-amber-900/40">
                  <span className="font-semibold">{isRtl ? 'آخرین نتیجه ثبت شده:' : 'Last recorded result:'} </span>
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
            <span>{isRtl ? 'تاریخچه و تایم‌لاین فعالیت‌ها' : 'Activity Timeline'} ({activities.length})</span>
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
            <span>{isRtl ? 'ثبت فعالیت و پیگیری جدید' : 'Add New Activity'}</span>
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
            <span>{isRtl ? 'گزارش حسابرسی' : 'Audit Log'} ({leadAuditLogs.length})</span>
          </button>
        </div>

        {/* TAB 1: TIMELINE TABLE (EXACT MATCH WITH PROMPT) */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'هنوز فعالیتی برای این سرنخ ثبت نشده است' : 'No activities recorded for this lead yet'}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {isRtl ? 'از زبانه «ثبت فعالیت و پیگیری جدید» برای ذخیره نتایج تماس، قرار ملاقات یا یادداشت استفاده کنید.' : 'Use the "Add New Activity" tab to record call results, appointments, or notes.'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('add_activity')}
                  className="mt-3"
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  {isRtl ? 'ثبت اولین فعالیت' : 'Add First Activity'}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-end text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3 w-36">{isRtl ? 'تاریخ و ساعت' : 'Date & Time'}</th>
                      <th className="p-3 w-28">{isRtl ? 'اپراتور' : 'Operator'}</th>
                      <th className="p-3 w-28">{isRtl ? 'نوع فعالیت' : 'Type'}</th>
                      <th className="p-3">{isRtl ? 'نتیجه و شرح مکالمه' : 'Result / Notes'}</th>
                      <th className="p-3 w-36">{isRtl ? 'پیگیری بعدی' : 'Next Follow-up'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {activities.map((act) => {
                      const actConfig = ACTIVITY_LABELS[act.type] || { labelFa: act.type, labelEn: act.type, color: 'bg-slate-100 text-slate-800' };
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
                              {isRtl ? actConfig.labelFa : actConfig.labelEn}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300 leading-relaxed">
                            {act.result}
                            {act.appointmentResult && (
                              <div className="mt-1 text-indigo-600 dark:text-indigo-400 text-[11px] font-medium">
                                {isRtl ? 'نتیجه جلسه:' : 'Meeting result:'} {act.appointmentResult}
                              </div>
                            )}
                            {act.newStatus && (
                              <div className="mt-1 text-slate-500 text-[10px]">
                                {isRtl ? 'تغییر وضعیت به:' : 'Status changed to:'} <span className="font-semibold">{act.newStatus}</span>
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
              <span>{isRtl ? 'ثبت سریع فعالیت، نتیجه مکالمه و زمان‌بندی پیگیری' : 'Quick Activity, Call Result & Follow-up'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'نوع فعالیت' : 'Activity Type'}
                </label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as LeadActivityType)}
                  className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="CALL">{isRtl ? 'تماس تلفنی' : 'Phone Call'}</option>
                  <option value="FOLLOW_UP">{isRtl ? 'پیگیری' : 'Follow-up'}</option>
                  <option value="APPOINTMENT">{isRtl ? 'قرار ملاقات حضوری / آنلاین' : 'In-person / Online Appointment'}</option>
                  <option value="MEETING_RESULT">{isRtl ? 'ثبت نتیجه جلسه / قرار' : 'Log Meeting Result'}</option>
                  <option value="NOTE">{isRtl ? 'یادداشت داخلی' : 'Internal Note'}</option>
                  <option value="SMS">{isRtl ? 'ارسال پیامک' : 'Send SMS'}</option>
                  <option value="STATUS_CHANGE">{isRtl ? 'تغییر وضعیت سرنخ' : 'Change Lead Status'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'وضعیت جدید سرنخ (اختیاری)' : 'New Lead Status (optional)'}
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">{isRtl ? 'بدون تغییر وضعیت' : 'No status change'} ({lead.status})</option>
                  <option value={LeadStatus.NEW_LEAD}>{isRtl ? 'سرنخ جدید' : 'New Lead'}</option>
                  <option value={LeadStatus.CONTACTED}>{isRtl ? 'تماس گرفته شده' : 'Contacted'}</option>
                  <option value={LeadStatus.FOLLOW_UP}>{isRtl ? 'در حال پیگیری' : 'In Follow-up'}</option>
                  <option value={LeadStatus.NEGOTIATION}>{isRtl ? 'در حال مذاکره' : 'In Negotiation'}</option>
                  <option value={LeadStatus.CONVERTED}>{isRtl ? 'تبدیل به مشتری' : 'Converted'}</option>
                  <option value={LeadStatus.LOST}>{isRtl ? 'عدم توافق / لغو' : 'Lost / Cancelled'}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isRtl ? 'نتیجه مکالمه / شرح فعالیت' : 'Call Result / Activity Detail'} <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
                placeholder={isRtl ? 'مثال: مشتری گفت دو روز دیگر خبر می‌دهد و علاقه‌مند به خرید سیم‌کارت رند بود...' : 'e.g. Customer said they will reply in two days and was interested in a premium SIM...'}
                rows={3}
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
                required
              />
            </div>

            {(activityType === 'APPOINTMENT' || activityType === 'MEETING_RESULT') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'نتیجه یا دستور کار قرار ملاقات' : 'Meeting Result / Agenda'}
                </label>
                <input
                  type="text"
                  value={appointmentResult}
                  onChange={(e) => setAppointmentResult(e.target.value)}
                  placeholder={isRtl ? 'موضوع جلسه، تصمیمات اتخاذ شده یا مدارک مورد توافق...' : 'Meeting topic, decisions made, or agreed documents...'}
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
                <span>{isRtl ? 'این سرنخ نیاز به پیگیری بعدی دارد (ایجاد خودکار وظیفه در کارتابل)' : 'This lead needs a follow-up (auto-create a task)'}</span>
              </label>

              {needsFollowUp && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {isRtl ? 'تاریخ پیگیری بعدی' : 'Follow-up Date'}
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
                      {isRtl ? 'ساعت پیگیری' : 'Follow-up Time'}
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
                {isRtl ? 'انصراف' : 'Cancel'}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                leftIcon={<Send className="w-4 h-4" />}
              >
                {isSubmitting ? (isRtl ? 'در حال ثبت...' : 'Saving...') : (isRtl ? 'ثبت قطعی فعالیت' : 'Save Activity')}
              </Button>
            </div>
          </form>
        )}

        {/* TAB 3: AUDIT TRAIL OF THIS LEAD */}
        {activeTab === 'audit' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              {isRtl ? 'تاریخچه امنیتی کلیه تغییرات، ویرایش‌ها و اقدامات انجام شده بر روی پرونده سرنخ به همراه مقادیر قبلی و جدید:' : 'Security history of all changes, edits and actions on this lead, with previous and new values:'}
            </div>

            {leadAuditLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                {isRtl ? 'هیچ رکورد حسابرسی برای این سرنخ ثبت نشده است.' : 'No audit records for this lead.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-end text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5 w-36">{isRtl ? 'تاریخ و زمان' : 'Date & Time'}</th>
                      <th className="p-2.5 w-32">{isRtl ? 'اپراتور' : 'Operator'}</th>
                      <th className="p-2.5 w-32">{isRtl ? 'عملیات' : 'Action'}</th>
                      <th className="p-2.5">{isRtl ? 'جزئیات تغییرات' : 'Change Details'}</th>
                      <th className="p-2.5">{isRtl ? 'مقدار قبلی / جدید' : 'Old / New Value'}</th>
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
                                  <span className="font-bold">{isRtl ? 'قبل:' : 'Before:'} </span>
                                  {typeof log.oldValue === 'object' ? JSON.stringify(log.oldValue) : String(log.oldValue)}
                                </div>
                              )}
                              {log.newValue && (
                                <div className="text-emerald-600 dark:text-emerald-400">
                                  <span className="font-bold">{isRtl ? 'بعد:' : 'After:'} </span>
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
