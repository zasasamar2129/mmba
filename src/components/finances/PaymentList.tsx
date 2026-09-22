import React, { useState, useMemo } from 'react';
import { Payment, Customer, User, Attachment, PermissionAction, ModuleName } from '../../types';
import {
  DollarSign, Search, Plus, Calendar, Receipt,
  CreditCard, ArrowDownLeft, FileSpreadsheet, Paperclip,
  Eye, Edit, Download, Image as ImageIcon, FileText, CheckCircle2,
  Trash2, Edit3
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { ExportExcelButton } from '../ui/ExportExcelButton';
import { RTLNumber } from '../ui/RTLNumber';
import { FilePreviewModal } from '../ui/FilePreviewModal';
import { storage } from '../../services/storage';
import { exportPaymentsToExcel } from '../../lib/exportToExcel';
import { formatToman } from '../../lib/currencyUtils';
import { formatPersianDate, formatPersianDateTime, toPersianDigits } from '../../lib/dateUtils';
import { useTranslation } from '../../lib/i18n';
import { ListViewControls, usePersistentViewMode } from '../ui/ListViewControls';

export interface PaymentListProps {
  payments: Payment[];
  customers: Customer[];
  currentUser?: User;
  onAddNewPayment: () => void;
  onEditPayment?: (payment: Payment) => void;
  onSelectCustomer: (customerId: string) => void;
  onRefreshPayments?: () => void;
}

export const PaymentList: React.FC<PaymentListProps> = ({
  payments = [],
  customers = [],
  currentUser,
  onAddNewPayment,
  onEditPayment,
  onSelectCustomer,
  onRefreshPayments,
}) => {
  const { t, isRtl, formatNumber } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  // View Mode & Pagination
  const [viewMode, setViewMode] = usePersistentViewMode('payments', 'list');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const allAttachments = useMemo(() => {
    return storage.getAttachments();
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return (payments || [])
      .filter((p) => {
        if (typeFilter !== 'ALL' && p.paymentType !== typeFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          (p.customerName && p.customerName.toLowerCase().includes(q)) ||
          (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.notes && p.notes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.paymentDate || b.date || 0).getTime() - new Date(a.paymentDate || a.date || 0).getTime());
  }, [payments, searchQuery, typeFilter]);

  const totalPages = Math.ceil(filteredPayments.length / pageSize) || 1;
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, currentPage, pageSize]);

  const totalReceived = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [filteredPayments]);

  const getPaymentAttachments = (payment: Payment): Attachment[] => {
    const fromEntity = allAttachments.filter(
      (a) => a.relatedEntityType === 'PAYMENT' && a.relatedEntityId === payment.id
    );
    if (fromEntity.length > 0) return fromEntity;

    if (payment.attachmentIds && payment.attachmentIds.length > 0) {
      return allAttachments.filter((a) => payment.attachmentIds?.includes(a.id));
    }
    return [];
  };

  const getPaymentTypeLabel = (type?: string) => {
    switch (type) {
      case 'BANK_TRANSFER':
        return t('payments.methodBankTransfer');
      case 'POS':
        return `${t('payments.methodPos')} (POS)`;
      case 'CASH':
        return t('payments.methodCash');
      case 'ONLINE_GATEWAY':
        return t('payments.methodGateway');
      default:
        return type || t('payments.methodPos');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-(--bg-surface) p-4 rounded-2xl border border-(--border-subtle) shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold text-(--text-primary) flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{t('payments.title')}</span>
            </h1>
            <Badge variant="emerald" size="sm">
              <RTLNumber value={filteredPayments.length} type="count" suffix={t('payments.countSuffix')} />
            </Badge>
          </div>
          <p className="text-xs text-(--text-muted) mt-0.5">
            {t('payments.subtitle')} - {isRtl ? 'مجموع دریافتی‌ها:' : 'Total received:'} <strong className="text-(--success)">{formatToman(totalReceived)}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ExportExcelButton
            onExport={() => exportPaymentsToExcel(filteredPayments)}
            filename="payments_ledger"
            size="sm"
          />

          <Button
            variant="primary"
            size="sm"
            onClick={onAddNewPayment}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('payments.newPaymentBtn')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-(--bg-surface) liquid-glass-card border border-(--border-subtle) space-y-3 shadow-xs">
        <Input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          placeholder={t('payments.searchPlaceholder')}
          rightIcon={<Search className="w-4 h-4 text-slate-400" />}
        />

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60">
          <span className="text-xs text-(--text-muted) font-medium">{t('payments.filterMethod')}:</span>
          {['ALL', 'BANK_TRANSFER', 'POS', 'CASH', 'ONLINE_GATEWAY'].map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => {
                setTypeFilter(tp);
                setCurrentPage(1);
              }}
              className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                typeFilter === tp
                  ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-600/30'
                  : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {tp === 'ALL'
                ? t('common.all')
                : tp === 'BANK_TRANSFER'
                ? t('payments.methodBankTransfer')
                : tp === 'POS'
                ? (isRtl ? 'کارتخوان (POS)' : 'POS (Card Reader)')
                : tp === 'CASH'
                ? t('payments.methodCash')
                : t('payments.methodGateway')}
            </button>
          ))}
        </div>
      </div>

      {/* Standard ListViewControls with View Toggle (Card vs Row/List) & Pagination */}
      <ListViewControls
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredPayments.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      {/* Main Content: Empty State, Table View, or Card View */}
      {filteredPayments.length === 0 ? (
        <div className="p-12 text-center text-(--text-muted) rounded-2xl bg-(--bg-surface) border border-(--border-subtle) space-y-3 shadow-xs">
          <Receipt className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-base font-bold text-(--text-secondary)">{t('payments.noPaymentsFound')}</h3>
          <p className="text-xs text-(--text-muted)">
            {t('payments.noPaymentsDesc')}
          </p>
          <Button variant="primary" size="sm" onClick={onAddNewPayment}>
            {t('payments.newPaymentBtn')}
          </Button>
        </div>
      ) : viewMode === 'list' ? (
        /* ROW / LIST VIEW (TABLE) */
        <div className="overflow-x-auto rounded-2xl border border-(--border-subtle) bg-(--bg-surface) shadow-2xs">
          <table className="w-full text-end text-xs">
            <thead className="bg-(--bg-surface-subtle) dark:bg-slate-800/80 text-(--text-secondary) border-b border-(--border-subtle) font-bold">
              <tr>
                <th className="p-3 w-36">{isRtl ? 'تاریخ پرداخت' : 'Payment Date'}</th>
                <th className="p-3">{isRtl ? 'نام طرف حساب / مشتری' : 'Customer / Party'}</th>
                <th className="p-3 w-36">{isRtl ? 'مبلغ دریافتی' : 'Amount Received'}</th>
                <th className="p-3 w-32">{isRtl ? 'روش پرداخت' : 'Payment Method'}</th>
                <th className="p-3 w-36">{isRtl ? 'شماره ارجاع / پیگیری' : 'Reference / Tracking'}</th>
                <th className="p-3 w-28">{isRtl ? 'فیش و پیوست' : 'Receipt & Attachments'}</th>
                <th className="p-3">{isRtl ? 'شرح / بابت' : 'Description / Purpose'}</th>
                <th className="p-3 text-start w-24">{isRtl ? 'عملیات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedPayments.map((p) => {
                const paymentAtts = getPaymentAttachments(p);

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Date */}
                    <td className="p-3 font-mono text-(--text-muted) whitespace-nowrap text-[11px]" dir="ltr">
                      {formatPersianDate(p.paymentDate || p.date, false)}
                    </td>

                    {/* Customer */}
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => onSelectCustomer(p.customerId)}
                        className="font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                      >
                        {p.customerName || (isRtl ? 'مشتری ناشناس' : 'Unknown Customer')}
                      </button>
                    </td>

                    {/* Amount */}
                    <td className="p-3 font-mono font-bold text-(--success) whitespace-nowrap text-sm">
                      {formatToman(p.amount)}
                    </td>

                    {/* Method */}
                    <td className="p-3 whitespace-nowrap">
                      <Badge variant="emerald" size="sm">
                        {getPaymentTypeLabel(p.paymentType as string)}
                      </Badge>
                    </td>

                    {/* Reference number */}
                    <td className="p-3 font-mono text-(--text-secondary) whitespace-nowrap text-[11px]" dir="ltr">
                      {p.referenceNumber || '-'}
                    </td>

                    {/* Attachments */}
                    <td className="p-3 whitespace-nowrap">
                      {paymentAtts.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(paymentAtts[0])}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded"
                        >
                          <Paperclip className="w-3 h-3" />
                          <span>{paymentAtts.length} {isRtl ? 'فایل' : 'file'}</span>
                        </button>
                      ) : (
                        <span className="text-(--text-muted) text-[11px]">-</span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="p-3 text-(--text-muted) truncate max-w-xs text-[11px]">
                      {p.description || p.notes || '-'}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-start whitespace-nowrap">
                      {onEditPayment && (
                        <button
                          type="button"
                          onClick={() => onEditPayment(p)}
                          className="p-1.5 text-(--text-muted) hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title={isRtl ? 'ویرایش پرداخت' : 'Edit payment'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARD VIEW */
        <div className="space-y-3.5">
          {paginatedPayments.map((p) => {
            const paymentAtts = getPaymentAttachments(p);
            return (
              <div
                key={p.id}
                className="p-4 sm:p-5 rounded-2xl bg-(--bg-surface) border border-(--border-subtle) hover:border-(--border-primary) dark:hover:border-(--border-subtle) transition-all space-y-3 shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      <ArrowDownLeft className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectCustomer(p.customerId)}
                          className="text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                        >
                          {p.customerName || (isRtl ? 'مشتری ناشناس' : 'Unknown Customer')}
                        </button>
                        <Badge variant="emerald" size="sm">
                          {getPaymentTypeLabel(p.paymentType as string)}
                        </Badge>
                        {paymentAtts.length > 0 && (
                          <Badge variant="indigo" size="sm">
                            <Paperclip className="w-3 h-3 me-1 inline" />
                            {paymentAtts.length} {isRtl ? 'پیوست / فیش' : 'attachments'}
                          </Badge>
                        )}
                      </div>
                      {p.referenceNumber && (
                        <p className="text-xs text-(--text-muted) mt-1">
                          {t('payments.referenceNumber')}: <span className="font-mono text-(--text-primary) font-semibold">{p.referenceNumber}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={isRtl ? 'text-left' : 'text-right'}>
                    <div className="text-base sm:text-lg font-black text-(--success)">
                      <RTLNumber value={p.amount} type="price" />
                    </div>
                    <span className="text-xs text-(--text-muted) block mt-0.5 font-medium">
                      {t('payments.paymentDate')}: {formatPersianDate(p.paymentDate || p.date, false)}
                    </span>
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-(--text-secondary) bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80">
                    {t('payments.description')}: {p.description}
                  </p>
                )}

                {/* Attached Files Preview Grid */}
                {paymentAtts.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
                    <span className="text-xs font-semibold text-(--text-secondary) block">
                      {isRtl ? 'فیش‌های واریزی و مدارک متصل:' : 'Payment receipts & attached documents:'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {paymentAtts.map((att) => (
                        <button
                          key={att.id}
                          type="button"
                          onClick={() => setPreviewAttachment(att)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-(--bg-surface) dark:bg-slate-800 border border-(--border-subtle) text-xs text-(--text-secondary) hover:border-indigo-400 transition-colors"
                        >
                          {att.mimeType?.startsWith('image/') ? (
                            <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                          )}
                          <span className="max-w-[150px] truncate">{att.fileName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {onEditPayment && (
                  <div className="flex justify-end pt-1">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onEditPayment(p)}
                      leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                    >
                      {isRtl ? 'ویرایش رکورد' : 'Edit Record'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={!!previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        attachment={previewAttachment}
      />
    </div>
  );
};
