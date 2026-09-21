import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Call, CallType, CallResult, Customer, Lead, LeadStatus, User, InteractionType } from '../../types';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Badge } from '../ui/Badge';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { VoiceInputButton } from '../ui/VoiceInputButton';
import { storage } from '../../services/storage';
import { api } from '../../services/api';
import { useToast } from '../ui/Toast';
import {
  PhoneCall,
  User as UserIcon,
  Calendar,
  Check,
  CheckSquare,
  Mic,
  MessageSquare,
  FileText,
  Clock,
  Sparkles,
  HelpCircle,
  Search,
  UserPlus,
  UserCheck,
  Building2,
  ChevronDown,
  ChevronUp,
  ArrowUpRight
} from 'lucide-react';
import { LeadConvertModal } from '../leads/LeadConvertModal';
import { useTranslation } from '../../lib/i18n';

export interface CallFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomer?: Customer | null;
  initialLead?: Lead | null;
  initialMobile?: string;
  allCustomers?: Customer[];
  allUsers?: User[];
  onSaved: (call: Call) => void;
  onOpenCustomerDetail?: (customerId: string) => void;
}

export const CallFormModal: React.FC<CallFormModalProps> = ({
  isOpen,
  onClose,
  initialCustomer,
  initialLead,
  initialMobile = '',
  allCustomers = [],
  allUsers = [],
  onSaved,
  onOpenCustomerDetail,
}) => {
  const { success, error } = useToast();
  const { t, isRtl } = useTranslation();
  const currentUser = storage.getCurrentUser();
  const availableUsers = (allUsers && allUsers.length > 0) ? allUsers : (storage.getUsers() || []);

  // Contact resolution state
  const [contactQuery, setContactQuery] = useState('');
  const [resolvedContactType, setResolvedContactType] = useState<'CUSTOMER' | 'LEAD' | 'UNKNOWN'>('UNKNOWN');
  const [resolvedCustomer, setResolvedCustomer] = useState<Customer | null>(null);
  const [resolvedLead, setResolvedLead] = useState<Lead | null>(null);
  const [resolvedStats, setResolvedStats] = useState<any>({});
  const [showOptionalLeadFields, setShowOptionalLeadFields] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadSource, setLeadSource] = useState(isRtl ? 'تماس ورودی' : 'Inbound Call');

  // Call / Interaction details
  const [callType, setCallType] = useState<string>(InteractionType.INCOMING_CALL);
  const [subject, setSubject] = useState('');
  const [customerRequest, setCustomerRequest] = useState('');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('180');
  const [result, setResult] = useState<CallResult>(CallResult.ANSWERED);

  // Follow-up details
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpUserId, setFollowUpUserId] = useState(currentUser.id);
  const [createTaskForFollowUp, setCreateTaskForFollowUp] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Convert Lead Modal state
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);

  // Debounced Contact Lookup
  const lookupTimerRef = useRef<any>(null);

  const performLookup = async (query: string) => {
    if (!query.trim()) {
      setResolvedContactType('UNKNOWN');
      setResolvedCustomer(null);
      setResolvedLead(null);
      setResolvedStats({});
      return;
    }

    try {
      const res = await storage.lookupContact(query.trim());
      setResolvedContactType(res.contactType);
      setResolvedCustomer(res.customer);
      setResolvedLead(res.lead);
      setResolvedStats(res.stats || {});
      if (res.lead?.name) setLeadName(res.lead.name);
    } catch (err) {
      console.warn('Contact lookup error:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFollowUpUserId(currentUser.id);
      if (initialCustomer) {
        setContactQuery(initialCustomer.mobile || initialCustomer.name || initialCustomer.id);
        setResolvedContactType('CUSTOMER');
        setResolvedCustomer(initialCustomer);
        setResolvedLead(null);
      } else if (initialLead) {
        setContactQuery(initialLead.mobile || initialLead.leadCode);
        setResolvedContactType('LEAD');
        setResolvedLead(initialLead);
        setResolvedCustomer(null);
        if (initialLead.name) setLeadName(initialLead.name);
      } else if (initialMobile) {
        setContactQuery(initialMobile);
        performLookup(initialMobile);
      } else {
        setContactQuery('');
        setResolvedContactType('UNKNOWN');
        setResolvedCustomer(null);
        setResolvedLead(null);
        setLeadName('');
        setLeadCompany('');
      }
    }
  }, [isOpen, initialCustomer, initialLead, initialMobile, currentUser.id]);

  const handleContactQueryChange = (val: string) => {
    setContactQuery(val);
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    lookupTimerRef.current = setTimeout(() => {
      performLookup(val);
    }, 250);
  };

  const handleSelectCustomerDirect = (cust: Customer) => {
    setContactQuery(cust.mobile || cust.name);
    setResolvedContactType('CUSTOMER');
    setResolvedCustomer(cust);
    setResolvedLead(null);
  };

  const handleSubmit = async (e?: React.FormEvent, forceFollowUp = false) => {
    if (e) e.preventDefault();

    const effectiveQuery = contactQuery.trim();
    if (!effectiveQuery) {
      error(isRtl ? 'لطفاً شماره تماس، نام یا کد مخاطب را وارد کنید' : 'Please enter the phone number, name, or customer code');
      return;
    }

    if (!subject.trim()) {
      error(isRtl ? 'لطفاً موضوع مکالمه را مشخص کنید' : 'Please specify the conversation topic');
      return;
    }

    const isFollowUp = forceFollowUp || followUpRequired;
    if (isFollowUp) {
      if (!followUpDate) {
        error(isRtl ? 'در صورت تنظیم پیگیری، تعیین تاریخ و ساعت الزامی است' : 'Setting a follow-up requires a date and time');
        return;
      }
      if (!followUpUserId) {
        error(isRtl ? 'در صورت تنظیم پیگیری، انتخاب کارشناس مسئول الزامی است' : 'Setting a follow-up requires selecting a responsible expert');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let targetCustomerId: string | undefined = resolvedCustomer?.id;
      let targetCustomerName = resolvedCustomer?.name || '';
      let targetCustomerMobile = resolvedCustomer?.mobile || effectiveQuery;
      let targetLeadId: string | undefined = resolvedLead?.id;

      // If Unknown number, auto-create Lead without forcing full customer registration
      if (resolvedContactType === 'UNKNOWN') {
        const newLead = storage.saveLead({
          mobile: effectiveQuery,
          name: leadName.trim() || undefined,
          company: leadCompany.trim() || undefined,
          source: leadSource || (isRtl ? 'تماس ورودی' : 'Inbound Call'),
          notes: notes.trim() || customerRequest.trim() || undefined,
          status: isFollowUp ? LeadStatus.FOLLOW_UP : LeadStatus.CONTACTED,
          assignedUserId: currentUser.id,
          assignedUserName: currentUser.name,
        });
        targetLeadId = newLead.id;
        targetCustomerName = newLead.name || (isRtl ? `سرنخ ${newLead.leadCode}` : `Lead ${newLead.leadCode}`);
      } else if (resolvedContactType === 'LEAD' && resolvedLead) {
        // Update existing lead status & note
        storage.saveLead({
          id: resolvedLead.id,
          mobile: resolvedLead.mobile,
          name: leadName.trim() || resolvedLead.name,
          company: leadCompany.trim() || resolvedLead.company,
          status: isFollowUp ? LeadStatus.FOLLOW_UP : LeadStatus.CONTACTED,
        });
        targetLeadId = resolvedLead.id;
        targetCustomerName = resolvedLead.name || (isRtl ? `سرنخ ${resolvedLead.leadCode}` : `Lead ${resolvedLead.leadCode}`);
      }

      const assignedUser = availableUsers.find((u) => u.id === followUpUserId);

      // Construct Call record
      const callPayload: Call = {
        id: '',
        customerId: targetCustomerId || targetLeadId || '',
        customerName: targetCustomerName || effectiveQuery,
        customerMobile: targetCustomerMobile,
        userId: currentUser.id,
        userName: currentUser.name,
        callType,
        dateTime: new Date().toISOString(),
        durationSeconds: Number(durationSeconds) || 0,
        subject: subject.trim(),
        customerRequest: customerRequest.trim(),
        outcome: outcome.trim(),
        notes: notes.trim(),
        voiceTranscript: voiceTranscript.trim(),
        transcript: voiceTranscript.trim(),
        result,
        followUpRequired: isFollowUp,
        followUpDate: isFollowUp && followUpDate ? followUpDate : undefined,
        followUpUserId: isFollowUp ? followUpUserId : undefined,
        followUpUserName: isFollowUp ? (assignedUser?.name || currentUser.name) : undefined,
        followUpCompleted: false,
        createdAt: new Date().toISOString(),
      };

      const savedCall = storage.saveCall(callPayload);

      // Record Unified Interaction via API / Central Storage
      try {
        await api.saveInteraction({
          id: savedCall.id,
          customer_id: targetCustomerId || undefined,
          lead_id: targetLeadId || undefined,
          user_id: currentUser.id,
          interaction_type: callType,
          started_at: callPayload.dateTime,
          duration_seconds: callPayload.durationSeconds,
          subject: callPayload.subject,
          customer_request: callPayload.customerRequest,
          outcome: callPayload.outcome,
          note: callPayload.notes,
          voice_transcript: callPayload.voiceTranscript,
          follow_up_required: isFollowUp,
          follow_up_at: followUpDate || undefined,
          follow_up_user_id: followUpUserId || undefined,
          createTask: createTaskForFollowUp,
        });
      } catch (apiErr) {
        console.warn('API Interaction call fallback notice:', apiErr);
      }

      // If follow-up required, create Task in Central Storage
      if (isFollowUp && createTaskForFollowUp) {
        storage.saveTask({
          id: '',
          title: isRtl ? `پیگیری تماس: ${subject.trim()} (${targetCustomerName || effectiveQuery})` : `Call follow-up: ${subject.trim()} (${targetCustomerName || effectiveQuery})`,
          description: isRtl
                ? `درخواست مخاطب: ${customerRequest.trim() || '—'}\nنتیجه مذاکره: ${outcome.trim() || '—'}\nیادداشت: ${notes.trim() || '—'}`
                : `Customer request: ${customerRequest.trim() || '—'}\nOutcome: ${outcome.trim() || '—'}\nNotes: ${notes.trim() || '—'}`,
          customerId: targetCustomerId || targetLeadId,
          customerName: targetCustomerName || effectiveQuery,
          assignedUserId: followUpUserId || currentUser.id,
          assignedUserName: assignedUser?.name || currentUser.name,
          creatorUserId: currentUser.id,
          creatorUserName: currentUser.name,
          priority: 'HIGH' as any,
          status: 'PENDING' as any,
          dueDate: followUpDate || new Date(Date.now() + 86400000 * 2).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      success(
        resolvedContactType === 'UNKNOWN'
          ? (isRtl ? 'سرنخ و تعامل ورودی با موفقیت در سامانه ثبت گردید' : 'Lead and incoming interaction registered successfully in the system')
          : (isRtl ? 'مکالمه و تعامل با موفقیت در پرونده ثبت شد' : 'Call and interaction successfully recorded in the file')
      );

      onSaved(savedCall);
      onClose();
    } catch (err: any) {
      console.error(err);
      error(err.message || (isRtl ? 'خطا در ثبت تعامل' : 'Error recording the interaction'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const subjectPresets = isRtl
    ? [
        'استعلام قیمت سیم‌کارت',
        'پیگیری سفارش و تحویل',
        'درخواست پیش‌فاکتور',
        'پشتیبانی و رفع مشکل',
        'مشاوره بسته و خدمات',
      ]
    : [
        'SIM card price inquiry',
        'Order and delivery follow-up',
        'Proforma invoice request',
        'Support and issue resolution',
        'Package and services consultation',
      ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      title={
        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base">{isRtl ? 'ثبت تماس و تعامل جدید (Incoming & Outgoing Center)' : 'Log New Call & Interaction (Incoming & Outgoing Center)'}</h3>
            <p className="text-xs text-slate-500 font-normal">
              {isRtl ? 'پشتیبانی از ثبت فوری شماره‌های ناشناس (سرنخ) و مشتریان دائمی' : 'Supports instant logging of unknown numbers (leads) and permanent customers'}
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={(e) => handleSubmit(e)} className="space-y-4 text-end">
        {/* Contact Lookup Bar */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
            <span>{isRtl ? 'شماره تماس، نام مخاطب یا کد پرونده *' : 'Phone number, contact name, or case code *'}</span>
            {resolvedContactType === 'CUSTOMER' && <Badge variant="success">{isRtl ? 'مشتری دائمی' : 'Permanent Customer'}</Badge>}
            {resolvedContactType === 'LEAD' && <Badge variant="warning">{isRtl ? 'سرنخ موجود' : 'Existing Lead'}</Badge>}
            {resolvedContactType === 'UNKNOWN' && contactQuery.trim() && (
              <Badge variant="info">{isRtl ? 'تماس ناشناس (ثبت به عنوان سرنخ)' : 'Unknown Call (Log as Lead)'}</Badge>
            )}
          </label>

          <div className="relative">
            <input
              type="text"
              value={contactQuery}
              onChange={(e) => handleContactQueryChange(e.target.value)}
              placeholder={isRtl ? 'شماره موبایل (مثال: 09121234567) یا نام مشتری...' : 'Mobile number (e.g. 09121234567) or customer name...'}
              className="w-full h-11 px-4 pe-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 text-sm font-medium shadow-xs"
              dir="auto"
              autoFocus
            />
            <div className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Search className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Dynamic Context Card based on Lookup */}
        {resolvedContactType === 'CUSTOMER' && resolvedCustomer && (
          <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                  {resolvedCustomer.name}
                </span>
                <span className="text-[11px] font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300">
                  {resolvedCustomer.code}
                </span>
                <Badge variant="success">{resolvedCustomer.status || (isRtl ? 'فعال' : 'Active')}</Badge>
              </div>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-400">
                {resolvedCustomer.companyName ? `${resolvedCustomer.companyName} | ` : ''}
                {isRtl ? 'موبایل' : 'Mobile'}: {resolvedCustomer.mobile || '—'}
                {resolvedStats.interactionCount ? (isRtl ? ` | سوابق تعاملات: ${resolvedStats.interactionCount} بار` : ` | Interaction history: ${resolvedStats.interactionCount} times`) : ''}
              </p>
            </div>

            {onOpenCustomerDetail && (
              <Button
                variant="outline"
                size="xs"
                type="button"
                onClick={() => onOpenCustomerDetail(resolvedCustomer.id)}
                leftIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
                className="shrink-0 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
              >
                {isRtl ? 'مشاهده پرونده مشتری' : 'View Customer Profile'}
              </Button>
            )}
          </div>
        )}

        {resolvedContactType === 'LEAD' && resolvedLead && (
          <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-950 dark:text-amber-200">
                  {resolvedLead.name || (isRtl ? 'سرنخ بدون نام' : 'Unnamed lead')}
                </span>
                <span className="text-[11px] font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/80 text-amber-700 dark:text-amber-300">
                  {resolvedLead.leadCode}
                </span>
                <Badge variant="warning">{resolvedLead.status}</Badge>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-400">
                {isRtl ? 'شماره' : 'Phone'}: {resolvedLead.mobile} | {isRtl ? 'منبع' : 'Source'}: {resolvedLead.source || (isRtl ? 'تماس ورودی' : 'Inbound Call')}
                {resolvedStats.interactionCount ? (isRtl ? ` | سابقه: ${resolvedStats.interactionCount} تعامل` : ` | History: ${resolvedStats.interactionCount} interactions`) : ''}
              </p>
            </div>

            <Button
              variant="success"
              size="xs"
              type="button"
              onClick={() => setLeadToConvert(resolvedLead)}
              leftIcon={<UserCheck className="w-3.5 h-3.5" />}
              className="shrink-0"
            >
              {isRtl ? 'تبدیل به پرونده مشتری' : 'Convert to Customer'}
            </Button>
          </div>
        )}

        {resolvedContactType === 'UNKNOWN' && contactQuery.trim() && (
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 text-xs space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {isRtl ? 'این شماره در بانک اطلاعاتی موجود نیست و به صورت خودکار به عنوان «سرنخ جدید (Lead)» ثبت می‌شود.' : 'This number is not in the database and will be automatically logged as a new lead.'}
              </span>

              <button
                type="button"
                onClick={() => setShowOptionalLeadFields(!showOptionalLeadFields)}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                {showOptionalLeadFields ? (
                  <>
                    {isRtl ? 'بستن فیلدهای تکمیلی' : 'Collapse optional fields'} <ChevronUp className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    {isRtl ? 'تکمیل نام و مشخصات اختیاری' : 'Complete optional details'} <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>

            {showOptionalLeadFields && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-indigo-100 dark:border-indigo-900/60 animate-fadeIn">
                <Input
                  label={isRtl ? 'نام یا عنوان مخاطب' : 'Contact Name / Title'}
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder={isRtl ? 'مثال: آقای حسینی' : 'e.g. Mr. Hosseini'}
                  size="sm"
                />
                <Input
                  label={isRtl ? 'نام شرکت / مجموعه' : 'Company Name'}
                  value={leadCompany}
                  onChange={(e) => setLeadCompany(e.target.value)}
                  placeholder={isRtl ? 'مثال: بازرگانی پارس' : 'e.g. Pars Trading'}
                  size="sm"
                />
                <Input
                  label={isRtl ? 'منبع ارجاع' : 'Referral Source'}
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  placeholder={isRtl ? 'تماس ورودی، وبسایت...' : 'Incoming call, website...'}
                  size="sm"
                />
              </div>
            )}
          </div>
        )}

        {/* Interaction Type, Result, Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Select
            label={isRtl ? 'نوع تعامل' : 'Interaction Type'}
            value={callType}
            onChange={(e) => setCallType(e.target.value)}
            options={[
              { value: InteractionType.INCOMING_CALL, label: isRtl ? 'تماس ورودی (Incoming)' : 'Incoming Call' },
              { value: InteractionType.OUTGOING_CALL, label: isRtl ? 'تماس خروجی (Outgoing)' : 'Outgoing Call' },
              { value: InteractionType.VISIT, label: isRtl ? 'مراجعه / جلسه حضوری (Visit)' : 'In-Person Visit' },
              { value: InteractionType.MESSAGE, label: isRtl ? 'پیام‌رسان / پیامک (Message)' : 'Messenger / SMS' },
              { value: InteractionType.OTHER, label: isRtl ? 'سایر موارد (Other)' : 'Other' },
            ]}
          />

          <Select
            label={isRtl ? 'نتیجه مکالمه' : 'Call Outcome'}
            value={result}
            onChange={(e) => setResult(e.target.value as CallResult)}
            options={[
              { value: CallResult.ANSWERED, label: isRtl ? 'پاسخ داده شد / مذاکره کامل' : 'Answered / Full Negotiation' },
              { value: CallResult.MEETING_SCHEDULED, label: isRtl ? 'جلسه تنظیم شد' : 'Meeting Scheduled' },
              { value: CallResult.ORDER_PLACED, label: isRtl ? 'سفارش / قرارداد ثبت شد' : 'Order / Contract Placed' },
              { value: CallResult.BUSY, label: isRtl ? 'اشغال بود' : 'Busy' },
              { value: CallResult.NO_ANSWER, label: isRtl ? 'پاسخ نداد' : 'No Answer' },
              { value: CallResult.LEFT_VOICEMAIL, label: isRtl ? 'پیام ارسال شد' : 'Message Left' },
            ]}
          />

          <div>
            <Input
              label={isRtl ? 'مدت مکالمه (ثانیه)' : 'Call Duration (seconds)'}
              type="number"
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(e.target.value)}
            />
            <div className="flex items-center gap-1 mt-1 justify-end">
              {[
                { label: isRtl ? '۱ دقیقه' : '1 min', val: '60' },
                { label: isRtl ? '۳ دقیقه' : '3 min', val: '180' },
                { label: isRtl ? '۵ دقیقه' : '5 min', val: '300' },
              ].map((chip) => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => setDurationSeconds(chip.val)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700/60"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Subject with Quick Presets */}
        <div className="space-y-1.5">
          <Input
            label={isRtl ? 'موضوع اصلی مکالمه *' : 'Main Call Topic *'}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={isRtl ? 'مثال: استعلام قیمت سیم‌کارت و شرایط پرداخت اقساطی' : 'e.g. SIM price inquiry and installment terms'}
            isRequired
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400">{isRtl ? 'عناوین متداول:' : 'Common topics:'}</span>
            {subjectPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSubject(preset)}
                className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors border border-slate-200 dark:border-slate-700/60"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Request & Outcome Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                {isRtl ? 'درخواست و نیاز تماس‌گیرنده (Request)' : 'Caller Request & Needs (Request)'}
              </label>
              <VoiceInputButton
                onTranscript={(transcript) => {
                  setCustomerRequest((prev) => (prev ? `${prev} ${transcript}` : transcript));
                }}
              />
            </div>
            <textarea
              value={customerRequest}
              onChange={(e) => setCustomerRequest(e.target.value)}
              rows={3}
              className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none leading-relaxed resize-none"
              placeholder={isRtl ? 'تماس‌گیرنده چه درخواستی داشت؟ (استعلام قیمت، فعال‌سازی بسته، تغییر نام، ...)' : 'What did the caller request? (price inquiry, plan activation, name change, ...)'}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                {isRtl ? 'نتیجه مذاکره و توافق (Outcome)' : 'Negotiation Result & Agreement (Outcome)'}
              </label>
              <VoiceInputButton
                onTranscript={(transcript) => {
                  setOutcome((prev) => (prev ? `${prev} ${transcript}` : transcript));
                }}
              />
            </div>
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              rows={3}
              className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none leading-relaxed resize-none"
              placeholder={isRtl ? 'نتیجه گفتگو چه شد؟ (توضیحات داده شد، پیش‌فاکتور ارسال شد، مهلت بررسی خواسته شد...)' : 'What was the outcome? (info given, proforma sent, review time requested...)'}
            />
          </div>
        </div>

        {/* General Notes */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              {isRtl ? 'یادداشت‌های تکمیلی و نکات مهم' : 'Additional Notes & Key Points'}
            </label>
            <VoiceInputButton
              onTranscript={(transcript) => {
                setNotes((prev) => (prev ? `${prev} ${transcript}` : transcript));
              }}
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none leading-relaxed resize-none"
            placeholder={isRtl ? 'هرگونه یادداشت تکمیلی، ترجیحات تماس‌گیرنده، سقف بودجه و...' : 'Additional notes, caller preferences, budget range...'}
          />
        </div>

        {/* Voice Transcript (Speech Recognition) */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-purple-500" />
              {isRtl ? 'متن پیاده‌سازی شده صوتی (Voice Transcript)' : 'Voice Transcript'}
            </span>
            <VoiceInputButton
              onTranscript={(transcript) => {
                setVoiceTranscript((prev) => (prev ? `${prev} ${transcript}` : transcript));
              }}
            />
          </div>
          <textarea
            value={voiceTranscript}
            onChange={(e) => setVoiceTranscript(e.target.value)}
            rows={2}
            className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-300 focus:border-purple-500 focus:outline-none font-mono resize-none"
            placeholder={isRtl ? 'متن تبدیل شده از صوت به نوشتار به صورت زنده در این قسمت قرار می‌گیرد...' : 'Live speech-to-text transcription appears here...'}
          />
        </div>

        {/* Follow-up Section */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-3">
          <Checkbox
            checked={followUpRequired}
            onChange={(e) => setFollowUpRequired(e.target.checked)}
            label={isRtl ? 'این تعامل نیازمند پیگیری بعدی (Follow-up) است' : 'This interaction requires follow-up'}
            colorScheme="indigo"
            size="md"
          />

          {followUpRequired && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 animate-fadeIn">
              <JalaliDatePicker
                label={isRtl ? 'تاریخ و ساعت دقیق پیگیری بعدی *' : 'Exact Follow-up Date & Time *'}
                value={followUpDate}
                onChange={(val) => setFollowUpDate(val)}
                showTime
                isRequired
              />

              <Select
                label={isRtl ? 'کارشناس مسئول پیگیری *' : 'Responsible Agent *'}
                value={followUpUserId}
                onChange={(e) => setFollowUpUserId(e.target.value)}
                isRequired
                options={(availableUsers || []).map((u) => ({
                  value: u.id,
                  label: `${u.name} (${u.role || (isRtl ? 'کارشناس' : 'Agent')})`,
                }))}
              />

              <div className="sm:col-span-2 flex items-center pt-1">
                <Checkbox
                  checked={createTaskForFollowUp}
                  onChange={(e) => setCreateTaskForFollowUp(e.target.checked)}
                  label={isRtl ? 'ایجاد خودکار وظیفه (Task) دارای مهلت در کارتابل پیگیری‌های کارشناس' : 'Auto-create a dated follow-up task in the agent inbox'}
                  icon={<CheckSquare className="w-3.5 h-3.5 text-indigo-500" />}
                  colorScheme="indigo"
                  size="sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons & Quick presets */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none"
            >
              {isRtl ? 'انصراف' : 'Cancel'}
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!followUpRequired && (
              <Button
                variant="secondary"
                size="sm"
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setFollowUpRequired(true);
                  if (!followUpDate) {
                    // Default to 2 days later
                    const twoDays = new Date(Date.now() + 86400000 * 2).toISOString();
                    setFollowUpDate(twoDays);
                  }
                }}
                leftIcon={<Calendar className="w-4 h-4 text-indigo-500" />}
                className="flex-1 sm:flex-none"
              >
                {isRtl ? 'ثبت و تنظیم پیگیری' : 'Save & Set Follow-up'}
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={isSubmitting}
              leftIcon={<Check className="w-4 h-4" />}
              className="flex-1 sm:flex-none"
            >
              {isRtl ? 'ثبت نهایی تعامل' : 'Submit Interaction'}
            </Button>
          </div>
        </div>
      </form>

      {/* Convert Modal if lead conversion clicked */}
      <LeadConvertModal
        isOpen={!!leadToConvert}
        onClose={() => setLeadToConvert(null)}
        lead={leadToConvert}
        onConverted={(newCust) => {
          setResolvedContactType('CUSTOMER');
          setResolvedCustomer(newCust);
          setResolvedLead(null);
          setContactQuery(newCust.mobile || newCust.name);
          setLeadToConvert(null);
        }}
      />
    </Modal>
  );
};
