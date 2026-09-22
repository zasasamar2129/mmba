import React, { useState, useEffect, useMemo } from 'react';
import { Lead, LeadStatus, Customer, User } from '../../types';
import { storage, subscribeToStorage } from '../../services/storage';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { LeadConvertModal } from './LeadConvertModal';
import { LeadTimelineActivityModal } from './LeadTimelineActivityModal';
import { ListViewControls, usePersistentViewMode } from '../ui/ListViewControls';
import {
  UserPlus, Search, Phone, PhoneCall, Calendar, ArrowUpRight,
  UserCheck, Clock, CheckCircle2, AlertCircle, Filter, Sparkles, MessageSquare,
  ChevronLeft, Trash2, Edit3, Plus, AlertTriangle, History, ArrowUpDown
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { formatPersianDate } from '../../lib/dateUtils';
import { useTranslation } from '../../lib/i18n';

export interface LeadListProps {
  currentUser?: User;
  onRecordCallForLead?: (lead: Lead) => void;
  onOpenCustomerDetail?: (customerId: string) => void;
}

export const LeadList: React.FC<LeadListProps> = ({
  currentUser,
  onRecordCallForLead,
  onOpenCustomerDetail,
}) => {
  const { success, error } = useToast();
  const { t, isRtl } = useTranslation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'code'>('newest');

  // View Mode & Pagination State
  const [viewMode, setViewMode] = usePersistentViewMode('leads', 'list');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals State
  const [selectedLeadForConvert, setSelectedLeadForConvert] = useState<Lead | null>(null);
  const [selectedLeadForTimeline, setSelectedLeadForTimeline] = useState<Lead | null>(null);
  const [isQuickLeadModalOpen, setIsQuickLeadModalOpen] = useState(false);
  const [quickMobile, setQuickMobile] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickSource, setQuickSource] = useState(isRtl ? 'تماس ورودی' : 'Inbound Call');

  const refreshLeads = () => {
    setLeads(storage.getLeads());
  };

  useEffect(() => {
    refreshLeads();
    const unsub = subscribeToStorage(() => {
      refreshLeads();
    });
    return () => unsub();
  }, []);

  const filteredLeads = useMemo(() => {
    return leads
      .filter((l) => {
        if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = l.name?.toLowerCase().includes(q);
          const matchCode = l.leadCode?.toLowerCase().includes(q);
          const matchMobile = l.mobile?.includes(q);
          const matchNotes = l.notes?.toLowerCase().includes(q);
          const matchFollowUp = l.lastFollowUp?.result?.toLowerCase().includes(q) || l.lastFollowUp?.operatorName?.toLowerCase().includes(q);
          return matchName || matchCode || matchMobile || matchNotes || matchFollowUp;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortOrder === 'code') {
          return a.leadCode.localeCompare(b.leadCode);
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [leads, statusFilter, searchQuery, sortOrder]);

  // Paginated Slices
  const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  const handleCreateQuickLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMobile.trim()) {
      error(isRtl ? 'شماره موبایل برای ایجاد سرنخ الزامی است' : 'A mobile number is required to create a lead');
      return;
    }
    try {
      const saved = storage.saveLead({
        mobile: quickMobile.trim(),
        name: quickName.trim() || undefined,
        notes: quickNotes.trim() || undefined,
        source: quickSource.trim() || (isRtl ? 'تماس ورودی' : 'Incoming Call'),
        status: LeadStatus.NEW_LEAD,
      });
      success(isRtl ? `سرنخ جدید با کد «${saved.leadCode}» ثبت شد.` : `New lead saved with code "${saved.leadCode}".`);
      setIsQuickLeadModalOpen(false);
      setQuickMobile('');
      setQuickName('');
      setQuickNotes('');
      refreshLeads();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در ثبت سرنخ' : 'Error creating lead'));
    }
  };

  const handleDeleteLead = (id: string, code: string) => {
    if (window.confirm(isRtl ? `آیا از حذف سرنخ ${code} اطمینان دارید؟` : `Are you sure you want to delete lead ${code}?`)) {
      storage.deleteLead(id);
      success(isRtl ? 'سرنخ با موفقیت حذف گردید' : 'Lead deleted successfully');
      refreshLeads();
      if (selectedLeadForTimeline?.id === id) {
        setSelectedLeadForTimeline(null);
      }
    }
  };

  const getStatusBadge = (status: LeadStatus | string) => {
    switch (status) {
      case LeadStatus.NEW_LEAD:
        return <Badge variant="info">{isRtl ? 'سرنخ جدید' : 'New Lead'}</Badge>;
      case LeadStatus.CONTACTED:
        return <Badge variant="default">{isRtl ? 'تماس گرفته شده' : 'Contacted'}</Badge>;
      case LeadStatus.FOLLOW_UP:
        return <Badge variant="warning">{isRtl ? 'نیازمند پیگیری' : 'Needs Follow-up'}</Badge>;
      case LeadStatus.NEGOTIATION:
        return <Badge variant="indigo">{isRtl ? 'در حال مذاکره' : 'In Negotiation'}</Badge>;
      case LeadStatus.CONVERTED:
        return <Badge variant="success">{isRtl ? 'تبدیل شده به مشتری' : 'Converted'}</Badge>;
      case LeadStatus.LOST:
        return <Badge variant="danger">{isRtl ? 'عدم توافق / لغو' : 'Lost / Cancelled'}</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const isRecentlyContacted = (lead: Lead) => {
    if (!lead.lastFollowUp?.date) return false;
    const lastTime = new Date(lead.lastFollowUp.date).getTime();
    const diffHours = (Date.now() - lastTime) / (1000 * 60 * 60);
    return diffHours <= 48;
  };

  return (
    <div className="space-y-4">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>{isRtl ? 'مدیریت سرنخ‌ها، تایم‌لاین پیگیری و جلوگیری از تماس تکراری' : 'Lead Management, Timeline Tracking & Duplicate Call Prevention'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isRtl ? 'ثبت سریع تماس‌ها، تاریخچه دقیق مکالمات اپراتورها، هشدارهای تداخل تماس، و تبدیل فوری به پرونده مشتری' : 'Fast call logging, detailed operator conversation history, collision alerts, and instant conversion to customer file'}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsQuickLeadModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            {isRtl ? 'ثبت سرنخ جدید' : 'New Lead'}
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="sm:col-span-6 relative">
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={isRtl ? 'جستجو بر اساس شماره موبایل، کد سرنخ، نام، یادداشت یا نتیجه پیگیری...' : 'Search by mobile, lead code, name, note or follow-up result...'}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="ALL">{isRtl ? `همه وضعیت‌ها (${leads.length})` : `All Statuses (${leads.length})`}</option>
            <option value={LeadStatus.NEW_LEAD}>{isRtl ? 'سرنخ‌های جدید' : 'New Leads'}</option>
            <option value={LeadStatus.CONTACTED}>{isRtl ? 'تماس گرفته شده' : 'Contacted'}</option>
            <option value={LeadStatus.FOLLOW_UP}>{isRtl ? 'در انتظار پیگیری' : 'Pending Follow-up'}</option>
            <option value={LeadStatus.NEGOTIATION}>{isRtl ? 'در حال مذاکره' : 'In Negotiation'}</option>
            <option value={LeadStatus.CONVERTED}>{isRtl ? 'تبدیل شده به مشتری' : 'Converted to Customer'}</option>
            <option value={LeadStatus.LOST}>{isRtl ? 'لغو شده / ناموفق' : 'Lost / Cancelled'}</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="newest">{isRtl ? 'مرتب‌سازی: جدیدترین سرنخ‌ها' : 'Sort: Newest leads'}</option>
            <option value="oldest">{isRtl ? 'مرتب‌سازی: قدیمی‌ترین سرنخ‌ها' : 'Sort: Oldest leads'}</option>
            <option value="code">{isRtl ? 'مرتب‌سازی: بر اساس کد سرنخ' : 'Sort: Lead code'}</option>
          </select>
        </div>
      </div>

      {/* Standard ListViewControls with View Toggle (Card vs Row/List) & Pagination */}
      <ListViewControls
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredLeads.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      {/* Main Content: Empty State or Paginated Items */}
      {filteredLeads.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <UserPlus className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'سرنخی با شرایط فوق یافت نشد' : 'No leads match the current filters'}</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            با برقراری تماس‌های ناشناس یا دکمه «ثبت سرنخ جدید»، اطلاعات در سامانه درج می‌شود.
          </p>
        </div>
      ) : viewMode === 'list' ? (
        /* ROW / LIST VIEW (TABLE) */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <table className="w-full text-end text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3 w-28">{isRtl ? 'کد سرنخ' : 'Lead Code'}</th>
                <th className="p-3">{isRtl ? 'نام و مخاطب' : 'Name & Contact'}</th>
                <th className="p-3 w-32">{isRtl ? 'شماره تماس' : 'Phone'}</th>
                <th className="p-3 w-32">{isRtl ? 'وضعیت' : 'Status'}</th>
                <th className="p-3 w-28">{isRtl ? 'منبع' : 'Source'}</th>
                <th className="p-3 min-w-[220px]">{isRtl ? 'آخرین پیگیری / اپراتور' : 'Last Follow-up / Agent'}</th>
                <th className="p-3 w-36">{isRtl ? 'وضعیت هشدار' : 'Alert'}</th>
                <th className="p-3 text-start w-52">{isRtl ? 'اقدامات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedLeads.map((lead) => {
                const isConverted = lead.status === LeadStatus.CONVERTED;
                const hasRecentContact = isRecentlyContacted(lead);
                const leadInteractions = storage.getInteractions({ leadId: lead.id, mobile: lead.mobile });

                return (
                  <tr
                    key={lead.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                      isConverted ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                    }`}
                  >
                    {/* Code */}
                    <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      {lead.leadCode}
                    </td>

                    {/* Name */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {lead.name || (isRtl ? 'مخاطب ناشناس / بدون نام' : 'Unnamed lead')}
                      </div>
                      {lead.notes && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs mt-0.5">
                          {lead.notes}
                        </div>
                      )}
                    </td>

                    {/* Mobile */}
                    <td className="p-3 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap" dir="ltr">
                      {lead.mobile}
                    </td>

                    {/* Status */}
                    <td className="p-3 whitespace-nowrap">
                      {getStatusBadge(lead.status)}
                    </td>

                    {/* Source */}
                    <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {lead.source || (isRtl ? 'تماس ورودی' : 'Incoming Call')}
                    </td>

                    {/* Last Follow-Up & Operator */}
                    <td className="p-3">
                      {lead.lastFollowUp ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                            <span className="font-mono text-[10px] text-slate-500" dir="ltr">
                              {lead.lastFollowUp.jalaliDate}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-indigo-600 dark:text-indigo-400">{lead.lastFollowUp.operatorName}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-xs">
                            {lead.lastFollowUp.result}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">{isRtl ? 'بدون پیگیری' : 'No follow-up'}</span>
                      )}
                    </td>

                    {/* Duplicate Warning Badge */}
                    <td className="p-3 whitespace-nowrap">
                      {hasRecentContact ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          پیگیری اخیر (مراقبت)
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">{isRtl ? 'عادی' : 'Normal'}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-start whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setSelectedLeadForTimeline(lead)}
                          leftIcon={<History className="w-3.5 h-3.5 text-indigo-600" />}
                          title={isRtl ? 'تایم‌لاین و ثبت فعالیت' : 'Timeline & log activity'}
                        >
                          تایم‌لاین ({lead.activities?.length || 0})
                        </Button>

                        {onRecordCallForLead && (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => onRecordCallForLead(lead)}
                            leftIcon={<PhoneCall className="w-3.5 h-3.5 text-blue-600" />}
                            title={isRtl ? 'ثبت تماس تلفنی' : 'Log phone call'}
                          >
                            تماس
                          </Button>
                        )}

                        {!isConverted ? (
                          <Button
                            variant="success"
                            size="xs"
                            onClick={() => setSelectedLeadForConvert(lead)}
                            leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                            title={isRtl ? 'تبدیل به پرونده مشتری دائمی' : 'Convert to permanent customer'}
                          >
                            تبدیل
                          </Button>
                        ) : (
                          lead.convertedCustomerId && onOpenCustomerDetail && (
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => onOpenCustomerDetail(lead.convertedCustomerId!)}
                              leftIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
                              title={isRtl ? 'مشاهده پرونده مشتری' : 'View customer profile'}
                            >
                              مشتری
                            </Button>
                          )
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteLead(lead.id, lead.leadCode)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title={isRtl ? 'حذف سرنخ' : 'Delete lead'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {paginatedLeads.map((lead) => {
            const isConverted = lead.status === LeadStatus.CONVERTED;
            const hasRecentContact = isRecentlyContacted(lead);
            const leadInteractions = storage.getInteractions({ leadId: lead.id, mobile: lead.mobile });

            return (
              <div
                key={lead.id}
                className={`p-4 rounded-2xl border transition-all hover:shadow-md bg-white dark:bg-slate-900 ${
                  isConverted
                    ? 'border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                        {lead.leadCode}
                      </span>
                      {getStatusBadge(lead.status)}
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1.5">
                      {lead.name || (isRtl ? 'مخاطب ناشناس / بدون نام' : 'Unnamed lead')}
                    </h3>
                  </div>

                  <div className="text-start">
                    <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg" dir="ltr">
                      {lead.mobile}
                    </span>
                  </div>
                </div>

                {/* DUPLICATE CALL WARNING BANNER (CARD) */}
                {hasRecentContact && lead.lastFollowUp && (
                  <div className="mt-2.5 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">
                      {isRtl ? `پیگیری در ${lead.lastFollowUp.jalaliDate} توسط ${lead.lastFollowUp.operatorName}` : `Followed up on ${lead.lastFollowUp.jalaliDate} by ${lead.lastFollowUp.operatorName}`}
                    </span>
                  </div>
                )}

                {/* Last Follow-up summary or Notes */}
                {lead.lastFollowUp ? (
                  <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl mt-2.5 border border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                      <span>{isRtl ? 'آخرین پیگیری:' : 'Last follow-up:'} {lead.lastFollowUp.operatorName}</span>
                      <span dir="ltr">{lead.lastFollowUp.jalaliDate}</span>
                    </div>
                    <p className="line-clamp-2 text-slate-700 dark:text-slate-200">{lead.lastFollowUp.result}</p>
                  </div>
                ) : lead.notes ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl mt-2.5 line-clamp-2 border border-slate-100 dark:border-slate-800/60">
                    {lead.notes}
                  </p>
                ) : null}

                {/* Stats row */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {lead.activities?.length || 0} {isRtl ? 'فعالیت ثبت شده' : 'activities logged'}
                  </span>
                  <span>{isRtl ? 'منبع:' : 'Source:'} {lead.source || (isRtl ? 'تماس ورودی' : 'Incoming Call')}</span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setSelectedLeadForTimeline(lead)}
                    leftIcon={<History className="w-3.5 h-3.5 text-indigo-600" />}
                    className="flex-1"
                  >
                    تایم‌لاین
                  </Button>

                  {onRecordCallForLead && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onRecordCallForLead(lead)}
                      leftIcon={<PhoneCall className="w-3.5 h-3.5 text-blue-500" />}
                    >
                      تماس
                    </Button>
                  )}

                  {!isConverted ? (
                    <Button
                      variant="success"
                      size="xs"
                      onClick={() => setSelectedLeadForConvert(lead)}
                      leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                    >
                      تبدیل
                    </Button>
                  ) : (
                    lead.convertedCustomerId && onOpenCustomerDetail && (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => onOpenCustomerDetail(lead.convertedCustomerId!)}
                        leftIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
                        className="text-emerald-700 dark:text-emerald-300"
                      >
                        مشتری
                      </Button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteLead(lead.id, lead.leadCode)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={isRtl ? 'حذف سرنخ' : 'Delete lead'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lead Timeline & Fast Activity Modal */}
      <LeadTimelineActivityModal
        isOpen={!!selectedLeadForTimeline}
        onClose={() => setSelectedLeadForTimeline(null)}
        lead={selectedLeadForTimeline}
        currentUser={currentUser}
        onActivityAdded={() => {
          refreshLeads();
          if (selectedLeadForTimeline) {
            const updated = storage.getLeadById(selectedLeadForTimeline.id);
            if (updated) setSelectedLeadForTimeline(updated);
          }
        }}
        onOpenConvertModal={(leadToConvert) => {
          setSelectedLeadForConvert(leadToConvert);
        }}
      />

      {/* Convert to Customer Modal */}
      <LeadConvertModal
        isOpen={!!selectedLeadForConvert}
        onClose={() => setSelectedLeadForConvert(null)}
        lead={selectedLeadForConvert}
        onConverted={(customer) => {
          refreshLeads();
          if (onOpenCustomerDetail) {
            onOpenCustomerDetail(customer.id);
          }
        }}
      />

      {/* Quick Lead Modal */}
      <Modal
        isOpen={isQuickLeadModalOpen}
        onClose={() => setIsQuickLeadModalOpen(false)}
        maxWidth="md"
        title={
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            <span>{isRtl ? 'ثبت سریع سرنخ جدید' : 'Quick Add Lead'}</span>
          </div>
        }
      >
        <form onSubmit={handleCreateQuickLead} className="space-y-3.5 text-end">
          <Input
            label={isRtl ? 'شماره موبایل *' : 'Mobile *'}
            value={quickMobile}
            onChange={(e) => setQuickMobile(e.target.value)}
            placeholder="0912xxxxxxx"
            isRequired
            autoFocus
            dir="ltr"
          />

          <Input
            label={isRtl ? 'نام مخاطب (در صورت اعلام)' : 'Contact Name (if provided)'}
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            placeholder={isRtl ? 'مثال: آقای اکبری' : 'e.g. Mr. Akbari'}
          />

          <Input
            label={isRtl ? 'منبع تماس / ارجاع' : 'Call / Referral Source'}
            value={quickSource}
            onChange={(e) => setQuickSource(e.target.value)}
            placeholder={isRtl ? 'تماس ورودی، وبسایت، تبلیغات، ...' : 'Incoming call, website, ads...'}
          />

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              یادداشت یا نیاز اولیه
            </label>
            <textarea
              value={quickNotes}
              onChange={(e) => setQuickNotes(e.target.value)}
              rows={3}
              className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
              placeholder={isRtl ? 'درخواست استعلام قیمت سیم‌کارت، مشاوره و...' : 'e.g. SIM price inquiry, consultation...'}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsQuickLeadModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit" leftIcon={<UserPlus className="w-4 h-4" />}>
              ثبت سرنخ
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
