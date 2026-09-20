import React, { useState, useMemo } from 'react';
import { AuditLog, User, UserRole } from '../../types';
import {
  History, Search, Shield, Clock, User as UserIcon, Filter,
  ShieldCheck, ShieldAlert, ArrowUpDown, Trash2, Download, Eye,
  Lock, RefreshCw
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { formatPersianDate } from '../../lib/dateUtils';
import { useTranslation } from '../../lib/i18n';
import { RTLNumber } from '../ui/RTLNumber';
import { ListViewControls, usePersistentViewMode } from '../ui/ListViewControls';
import { storage } from '../../services/storage';

export interface AuditLogViewerProps {
  auditLogs?: AuditLog[];
  logs?: AuditLog[];
  allUsers?: User[];
  currentUser?: User;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  auditLogs,
  logs,
  allUsers = [],
  currentUser,
}) => {
  const { t, isRtl } = useTranslation();
  const { success, error, warning, info } = useToast();

  const [rawLogs, setRawLogs] = useState<AuditLog[]>(auditLogs || logs || storage.getAuditLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [userFilter, setUserFilter] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // View Mode & Pagination
  const [viewMode, setViewMode] = usePersistentViewMode('audit_logs', 'list');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const effectiveLogs = auditLogs || logs || rawLogs;

  const filteredLogs = useMemo(() => {
    return (effectiveLogs || [])
      .filter((l) => {
        if (entityFilter !== 'ALL' && l.entityType !== entityFilter && l.module !== entityFilter) return false;
        if (userFilter !== 'ALL' && l.userId !== userFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          l.userName.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          (l.entityName && l.entityName.toLowerCase().includes(q)) ||
          (l.details && l.details.toLowerCase().includes(q)) ||
          (l.targetId && l.targetId.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [effectiveLogs, searchQuery, entityFilter, userFilter]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const getActionBadge = (action: string) => {
    if (action.includes('CREATE') || action.includes('ثبت') || action.includes('ایجاد')) {
      return <Badge variant="emerald" size="sm">{action}</Badge>;
    }
    if (action.includes('UPDATE') || action.includes('ویرایش')) {
      return <Badge variant="info" size="sm">{action}</Badge>;
    }
    if (action.includes('DELETE') || action.includes('حذف')) {
      return <Badge variant="danger" size="sm">{action}</Badge>;
    }
    return <Badge variant="default" size="sm">{action}</Badge>;
  };

  const entityFilters = [
    { key: 'ALL', label: 'همه بخش‌ها' },
    { key: 'LEAD', label: 'سرنخ‌ها' },
    { key: 'CUSTOMER', label: 'مشتریان' },
    { key: 'PAYMENT', label: 'پرداخت‌ها' },
    { key: 'CHECK', label: 'خزانه‌داری و چک' },
    { key: 'CONTRACT', label: 'قراردادها' },
    { key: 'SIM_CARD', label: 'انبار سیم‌کارت' },
    { key: 'REPAIR_TICKET', label: 'تعمیرات' },
    { key: 'USER', label: 'کاربران' },
    { key: 'SETTINGS', label: 'تنظیمات و پشتیبان' },
  ];

  const handleExportCsv = () => {
    try {
      const headers = ['تاریخ و زمان', 'شناسه کاربر', 'نام کاربر', 'نقش', 'عملیات', 'بخش', 'موجودیت', 'شرح جزئیات'];
      const rows = filteredLogs.map((l) => [
        `"${formatPersianDate(l.timestamp, true)}"`,
        `"${l.userId}"`,
        `"${l.userName}"`,
        `"${l.userRole || ''}"`,
        `"${l.action}"`,
        `"${l.module || l.entityType || ''}"`,
        `"${l.entityName || l.targetId || ''}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
      ]);
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mmba_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      success('فایل اکسل/CSV لاگ‌های امنیتی دانلود شد.');
    } catch (err) {
      error('خطا در خروجی لاگ‌ها');
    }
  };

  const handleDeleteLog = (id: string) => {
    const res = storage.deleteAuditLog(id, currentUser);
    if (!res.success) {
      error(res.message);
      return;
    }
    success('لاگ حسابرسی با موفقیت حذف گردید.');
    setRawLogs(storage.getAuditLogs());
  };

  return (
    <div className="space-y-4">
      {/* Header & Immutability Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>مرکز ثبت رویدادها و گزارش‌های حسابرسی (Audit Trail & Security Logs)</span>
            </h1>
            <Badge variant="purple" size="sm">
              <RTLNumber value={filteredLogs.length} type="count" suffix="رویداد" />
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            ردیابی دقیق و دائمی تمامی تغییرات سامانه به همراه اپراتور مجری، تاریخ و ساعت، مقادیر قبلی و جدید (غیرقابل حذف توسط کاربران عادی)
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            leftIcon={<Download className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            خروجی CSV / اکسل
          </Button>
        </div>
      </div>

      {/* Immutability & Security Notice */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>امنیت لاگ‌ها:</strong> داده‌های حسابرسی به صورت غیرقابل دستکاری ثبت می‌شوند و هیچ کاربر عادی یا اپراتوری امکان ویرایش یا حذف تاریخچه فعالیت‌ها را ندارد.
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-500 hidden md:inline">
          ISO-27001 Compliance Level
        </span>
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
            placeholder="جستجو در لاگ‌ها (نام اپراتور، کد، نوع عملیات، متن جزئیات)..."
            rightIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
          >
            {entityFilters.map((ent) => (
              <option key={ent.key} value={ent.key}>
                {ent.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={userFilter}
            onChange={(e) => {
              setUserFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="ALL">همه اپراتورها و کاربران</option>
            {allUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.username})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Standard ListViewControls with View Toggle (Card vs Row/List) & Pagination */}
      <ListViewControls
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredLogs.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      {/* Main Content: Empty State or Paginated Items */}
      {filteredLogs.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-3">
          <History className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300">هیچ رویدادی با شرایط فوق ثبت نشده است</h3>
        </div>
      ) : viewMode === 'list' ? (
        /* ROW / LIST VIEW (TABLE) */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <table className="w-full text-end text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3 w-36">تاریخ و ساعت</th>
                <th className="p-3 w-32">اپراتور مجری</th>
                <th className="p-3 w-32">نوع عملیات</th>
                <th className="p-3 w-28">واحد / ماژول</th>
                <th className="p-3">شرح جزئیات و تغییرات</th>
                <th className="p-3 w-48">مقدار قبلی / جدید</th>
                <th className="p-3 text-start w-20">مشاهده</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  {/* Timestamp */}
                  <td className="p-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap text-[11px]" dir="ltr">
                    {formatPersianDate(log.timestamp, true)}
                  </td>

                  {/* Operator */}
                  <td className="p-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="w-3 h-3 text-slate-400" />
                      {log.userName}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="p-3 whitespace-nowrap">
                    {getActionBadge(log.action)}
                  </td>

                  {/* Module / Unit */}
                  <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                    {log.module || log.entityType || '-'}
                  </td>

                  {/* Details */}
                  <td className="p-3 text-slate-700 dark:text-slate-300 leading-relaxed max-w-md">
                    {log.details}
                  </td>

                  {/* Old vs New Value */}
                  <td className="p-3 text-[11px]">
                    {log.oldValue || log.newValue ? (
                      <div className="space-y-0.5 max-w-xs overflow-hidden text-ellipsis">
                        {log.oldValue && (
                          <div className="text-rose-600 dark:text-rose-400 truncate">
                            <span className="font-bold">قبل: </span>
                            {typeof log.oldValue === 'object' ? JSON.stringify(log.oldValue) : String(log.oldValue)}
                          </div>
                        )}
                        {log.newValue && (
                          <div className="text-emerald-600 dark:text-emerald-400 truncate">
                            <span className="font-bold">بعد: </span>
                            {typeof log.newValue === 'object' ? JSON.stringify(log.newValue) : String(log.newValue)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="p-3 text-start whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg"
                      title="مشاهده مشخصات کامل لاگ"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {paginatedLogs.map((log) => (
            <div
              key={log.id}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all hover:shadow-md space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getActionBadge(log.action)}
                    <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                      {log.module || log.entityType || 'SYSTEM'}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1.5 flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>{log.userName}</span>
                  </div>
                </div>

                <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap" dir="ltr">
                  {formatPersianDate(log.timestamp, true)}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
                {log.details}
              </p>

              {(log.oldValue || log.newValue) && (
                <div className="text-[11px] space-y-1 bg-slate-100/70 dark:bg-slate-800/50 p-2 rounded-lg">
                  {log.oldValue && (
                    <div className="text-rose-600 dark:text-rose-400 line-clamp-2">
                      <span className="font-bold">مقدار قبلی: </span>
                      {typeof log.oldValue === 'object' ? JSON.stringify(log.oldValue) : String(log.oldValue)}
                    </div>
                  )}
                  {log.newValue && (
                    <div className="text-emerald-600 dark:text-emerald-400 line-clamp-2">
                      <span className="font-bold">مقدار جدید: </span>
                      {typeof log.newValue === 'object' ? JSON.stringify(log.newValue) : String(log.newValue)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setSelectedLog(log)}
                  leftIcon={<Eye className="w-3.5 h-3.5" />}
                >
                  مشاهده لاگ
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal for Selected Log */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span>مشخصات کامل لاگ امنیتی {selectedLog.id}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-500">اپراتور: </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedLog.userName} ({selectedLog.userId})</span>
                </div>
                <div>
                  <span className="text-slate-500">نقش: </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLog.userRole || 'نامشخص'}</span>
                </div>
                <div>
                  <span className="text-slate-500">تاریخ و زمان: </span>
                  <span className="font-mono text-slate-700 dark:text-slate-300" dir="ltr">{formatPersianDate(selectedLog.timestamp, true)}</span>
                </div>
                <div>
                  <span className="text-slate-500">واحد / بخش: </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLog.module || selectedLog.entityType || '-'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block mb-1 font-semibold">شرح کامل اقدام:</span>
                <p className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-slate-800 dark:text-slate-200 leading-relaxed">
                  {selectedLog.details}
                </p>
              </div>

              {selectedLog.oldValue && (
                <div>
                  <span className="text-rose-600 font-semibold block mb-1">مقدار قبلی (Old Value):</span>
                  <pre className="p-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-300 rounded-xl overflow-x-auto font-mono text-[11px]">
                    {JSON.stringify(selectedLog.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValue && (
                <div>
                  <span className="text-emerald-600 font-semibold block mb-1">مقدار جدید (New Value):</span>
                  <pre className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 rounded-xl overflow-x-auto font-mono text-[11px]">
                    {JSON.stringify(selectedLog.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSelectedLog(null)}
              >
                بستن
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
