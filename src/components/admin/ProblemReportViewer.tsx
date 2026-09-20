import React, { useState, useEffect, useMemo } from 'react';
import { ProblemReport, ProblemReportStatus, ProblemReportPriority, User } from '../../types';
import { storage, subscribeToStorage } from '../../services/storage';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { formatPersianDate, getRelativeTimeFa } from '../../lib/dateUtils';
import { useToast } from '../ui/Toast';
import {
  AlertTriangle, CheckCircle2, Clock, Eye, Trash2, Filter,
  Search, Shield, User as UserIcon, MessageSquare, Camera, ExternalLink,
  Laptop, RefreshCw, Send, Check, XCircle, AlertCircle, Sparkles
} from 'lucide-react';

export interface ProblemReportViewerProps {
  currentUser: User;
}

export const ProblemReportViewer: React.FC<ProblemReportViewerProps> = ({ currentUser }) => {
  const { success, error: toastError } = useToast();
  const [reports, setReports] = useState<ProblemReport[]>(() => storage.getProblemReports());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [selectedReport, setSelectedReport] = useState<ProblemReport | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleSync = () => {
      setReports(storage.getProblemReports());
    };
    const unsubscribe = subscribeToStorage(handleSync);
    return () => unsubscribe();
  }, []);

  const filteredReports = useMemo(() => {
    return reports
      .filter((r) => {
        if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
        if (priorityFilter !== 'ALL' && r.priority !== priorityFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.userName.toLowerCase().includes(q) ||
          (r.adminNotes && r.adminNotes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reports, searchQuery, statusFilter, priorityFilter]);

  const handleUpdateStatus = async (reportId: string, newStatus: ProblemReportStatus | string) => {
    try {
      setIsUpdating(true);
      const updated = await storage.updateProblemReportStatus(reportId, newStatus, adminNote, currentUser);
      if (updated) {
        setReports(storage.getProblemReports());
        setSelectedReport(updated);
        success(`وضعیت گزارش به «${getStatusTitle(newStatus)}» تغییر یافت.`);
      }
    } catch (err: any) {
      toastError('خطا در به‌روزرسانی وضعیت گزارش');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('آیا از حذف این گزارش خطا اطمینان دارید؟')) return;
    try {
      await storage.deleteProblemReport(reportId);
      setReports(storage.getProblemReports());
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
      }
      success('گزارش با موفقیت حذف گردید.');
    } catch {
      toastError('خطا در حذف گزارش');
    }
  };

  const getStatusTitle = (status: string) => {
    switch (status) {
      case ProblemReportStatus.RESOLVED:
      case 'RESOLVED':
        return 'حل شده (Resolved)';
      case ProblemReportStatus.IN_PROGRESS:
      case 'IN_PROGRESS':
        return 'در حال بررسی (In Progress)';
      case ProblemReportStatus.REJECTED:
      case 'REJECTED':
        return 'رد شده (Rejected)';
      case ProblemReportStatus.PENDING:
      case 'PENDING':
      default:
        return 'در انتظار بررسی (Pending)';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return <Badge variant="success" size="sm" dot>حل شده</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="info" size="sm" dot>در حال پیگیری</Badge>;
      case 'REJECTED':
        return <Badge variant="danger" size="sm" dot>رد شده</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="warning" size="sm" dot>در انتظار بررسی</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <Badge variant="danger" size="sm">بحرانی</Badge>;
      case 'HIGH':
        return <Badge variant="rose" size="sm">مهم و فوری</Badge>;
      case 'LOW':
        return <Badge variant="default" size="sm">کم</Badge>;
      case 'NORMAL':
      default:
        return <Badge variant="info" size="sm">عادی</Badge>;
    }
  };

  const getCategoryTitle = (cat?: string) => {
    switch (cat) {
      case 'BUG':
        return '🐛 خطای نرم‌افزاری';
      case 'UI_ISSUE':
        return '🎨 به‌هم‌ریختگی ظاهری';
      case 'DATA_SYNC':
        return '🔄 مشکل همگام‌سازی داده';
      case 'FEATURE_REQUEST':
        return '💡 پیشنهاد امکانات جدید';
      default:
        return '❓ سایر موضوعات';
    }
  };

  return (
    <div className="space-y-6 animate-blur-fade-up text-end">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
              مدیریت و پیگیری گزارشات خطای کاربران (Bug Reports)
            </h2>
            <Badge variant="rose" size="sm">
              {filteredReports.length} گزارش
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            مشاهده گزارش‌های ارسالی همکاران، اسکرین‌شات‌های ثبت شده، اولویت‌بندی و ثبت پاسخ و وضعیت حل مشکلات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReports(storage.getProblemReports())}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            بروزرسانی لیست
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجو در عنوان، شرح مشکل، نام کاربر ثبت‌کننده..."
          rightIcon={<Search className="w-4 h-4" />}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs text-slate-500 dark:text-slate-400">وضعیت:</span>
            {['ALL', 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {st === 'ALL'
                  ? 'همه'
                  : st === 'PENDING'
                  ? 'در انتظار'
                  : st === 'IN_PROGRESS'
                  ? 'در حال پیگیری'
                  : st === 'RESOLVED'
                  ? 'حل شده'
                  : 'رد شده'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs text-slate-500 dark:text-slate-400">اولویت:</span>
            {['ALL', 'CRITICAL', 'HIGH', 'NORMAL', 'LOW'].map((pr) => (
              <button
                key={pr}
                type="button"
                onClick={() => setPriorityFilter(pr)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                  priorityFilter === pr
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {pr === 'ALL'
                  ? 'همه'
                  : pr === 'CRITICAL'
                  ? 'بحرانی'
                  : pr === 'HIGH'
                  ? 'بالا'
                  : pr === 'NORMAL'
                  ? 'عادی'
                  : 'پایین'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reports Grid / List */}
      {filteredReports.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-3xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-3">
          <AlertCircle className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">هیچ گزارش خطایی با فیلترهای انتخابی یافت نشد</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">تمام گزارشات ثبت شده توسط کاربران در این بخش به مدیران نمایش داده می‌شود.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className={`p-4 rounded-2xl border transition-all text-end space-y-3 ${
                report.status === 'RESOLVED'
                  ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                  : report.priority === 'CRITICAL'
                  ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/40 hover:border-rose-300 dark:hover:border-rose-500/60 shadow-xs'
                  : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/40 shadow-xs'
              }`}
            >
              {/* Header row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-800/80">
                <div className="flex flex-wrap items-center gap-2">
                  {getStatusBadge(report.status)}
                  {getPriorityBadge(report.priority)}
                  <span className="text-xs text-indigo-700 dark:text-indigo-300 font-medium px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
                    {getCategoryTitle(report.category)}
                  </span>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                    {report.title}
                  </h4>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span>{formatPersianDate(report.createdAt, true)}</span>
                  <span className="text-slate-400 dark:text-slate-500">({getRelativeTimeFa(report.createdAt)})</span>
                </div>
              </div>

              {/* Body description & Screenshot thumbnail */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                <div className="md:col-span-3 space-y-2">
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {report.description}
                  </p>

                  {report.adminNotes && (
                    <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 text-xs text-indigo-900 dark:text-indigo-200">
                      <span className="font-bold text-indigo-800 dark:text-indigo-300 block mb-1">یادداشت و نتیجه بررسی مدیریت:</span>
                      <p>{report.adminNotes}</p>
                    </div>
                  )}

                  {/* Reporter info */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>ثبت توسط: <strong className="text-slate-800 dark:text-slate-200">{report.userName}</strong> ({report.userRole})</span>
                    </span>
                    {report.userMobile && <span>• موبایل: {report.userMobile}</span>}
                    {report.userEmail && <span>• ایمیل: {report.userEmail}</span>}
                  </div>
                </div>

                {/* Screenshot thumbnail */}
                {report.screenshotUrl && (
                  <div className="md:col-span-1 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1 group relative">
                    <img
                      src={report.screenshotUrl}
                      alt="اسکرین‌شات خطا"
                      className="w-full h-24 object-cover rounded-lg cursor-pointer group-hover:scale-105 transition-transform"
                      onClick={() => setPreviewImage(report.screenshotUrl || null)}
                    />
                    <button
                      type="button"
                      onClick={() => setPreviewImage(report.screenshotUrl || null)}
                      className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 text-center mt-1">تصویر پیوست</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedReport(report);
                      setAdminNote(report.adminNotes || '');
                    }}
                    leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                  >
                    بررسی و پاسخ به گزارش
                  </Button>

                  {report.status !== 'RESOLVED' ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleUpdateStatus(report.id, 'RESOLVED')}
                      leftIcon={<Check className="w-3.5 h-3.5" />}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                    >
                      علامت‌گذاری به عنوان حل شده
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(report.id, 'IN_PROGRESS')}
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    >
                      بازگشایی مجدد
                    </Button>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDeleteReport(report.id)}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  حذف گزارش
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details & Admin Note Modal */}
      {selectedReport && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedReport(null)}
          maxWidth="lg"
          title={
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">بررسی گزارش مشکل: {selectedReport.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">ثبت وضعیت و توضیحات پاسخ برای کاربر</p>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-end text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800 dark:text-slate-200">شرح ارسالی کاربر ({selectedReport.userName}):</span>
                {getStatusBadge(selectedReport.status)}
              </div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedReport.description}</p>
            </div>

            {selectedReport.screenshotUrl && (
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">اسکرین‌شات ثبت شده:</label>
                <div
                  className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 max-h-60 cursor-pointer"
                  onClick={() => setPreviewImage(selectedReport.screenshotUrl || null)}
                >
                  <img
                    src={selectedReport.screenshotUrl}
                    alt="اسکرین‌شات"
                    className="w-full object-contain max-h-60"
                  />
                </div>
              </div>
            )}

            {/* Change Status */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">تغییر وضعیت گزارش:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'PENDING', label: 'در انتظار', color: 'border-amber-500/40 text-amber-600 dark:text-amber-300' },
                  { key: 'IN_PROGRESS', label: 'در حال پیگیری', color: 'border-sky-500/40 text-sky-600 dark:text-sky-300' },
                  { key: 'RESOLVED', label: 'حل شده', color: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-300' },
                  { key: 'REJECTED', label: 'رد شده', color: 'border-rose-500/40 text-rose-600 dark:text-rose-300' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleUpdateStatus(selectedReport.id, item.key)}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      selectedReport.status === item.key
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : `bg-slate-50 dark:bg-slate-900 ${item.color} hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800`
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Admin Note textarea */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                توضیحات و پاسخ مدیریت (جهت ثبت در سابقه):
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="توضیحاتی پیرامون نحوه رفع مشکل یا دلیل رد گزارش بنویسید..."
                rows={3}
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setSelectedReport(null)}>
                بستن
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleUpdateStatus(selectedReport.id, selectedReport.status)}
                disabled={isUpdating}
                leftIcon={<Check className="w-4 h-4" />}
              >
                ذخیره یادداشت مدیریت
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Image full preview modal */}
      {previewImage && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewImage(null)}
          maxWidth="2xl"
          title="مشاهده بزرگ اسکرین‌شات پیوست"
        >
          <div className="text-center">
            <img
              src={previewImage}
              alt="اسکرین شات بزرگ"
              className="max-w-full max-h-[75vh] object-contain mx-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
            />
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={() => setPreviewImage(null)}>
                بستن تصویر
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
