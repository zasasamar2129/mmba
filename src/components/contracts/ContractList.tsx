import React, { useState, useMemo } from 'react';
import { Contract, ContractType, ContractStatus, Customer, User } from '../../types';
import {
  FileSignature, Search, Plus, Calendar, AlertTriangle,
  CheckCircle2, Edit3, Trash2, ShieldCheck, FileText, ArrowRight,
  Receipt, Eye
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { ExportExcelButton } from '../ui/ExportExcelButton';
import { RTLNumber } from '../ui/RTLNumber';
import { exportContractsToExcel } from '../../lib/exportToExcel';
import { formatToman } from '../../lib/currencyUtils';
import { formatPersianDate, isOverdue } from '../../lib/dateUtils';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { ContractInstallmentsModal } from './ContractInstallmentsModal';
import { ListViewControls, usePersistentViewMode } from '../ui/ListViewControls';

export interface ContractListProps {
  contracts: Contract[];
  customers: Customer[];
  currentUser?: User;
  onAddNewContract: () => void;
  onEditContract: (contract: Contract) => void;
  onRefreshContracts: () => void;
  onSelectCustomer: (customerId: string) => void;
}

export const ContractList: React.FC<ContractListProps> = ({
  contracts = [],
  customers = [],
  currentUser = { id: 'usr-admin', name: 'مدیر سامانه', role: 'SUPER_ADMIN' as any } as User,
  onAddNewContract,
  onEditContract,
  onRefreshContracts,
  onSelectCustomer,
}) => {
  const { success } = useToast();
  const { t, isRtl, formatNumber } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedContractForInstallments, setSelectedContractForInstallments] = useState<Contract | null>(null);

  // View Mode & Pagination
  const [viewMode, setViewMode] = usePersistentViewMode('contracts', 'list');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredContracts = useMemo(() => {
    return (contracts || [])
      .filter((c) => {
        if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
        if (typeFilter !== 'ALL' && c.contractType !== typeFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          c.title.toLowerCase().includes(q) ||
          c.contractNumber.toLowerCase().includes(q) ||
          c.customerName.toLowerCase().includes(q) ||
          (c.terms && c.terms.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [contracts, searchQuery, statusFilter, typeFilter]);

  const totalPages = Math.ceil(filteredContracts.length / pageSize) || 1;
  const paginatedContracts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredContracts.slice(start, start + pageSize);
  }, [filteredContracts, currentPage, pageSize]);

  const totalContractValue = useMemo(() => {
    return filteredContracts.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
  }, [filteredContracts]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(isRtl ? 'آیا از حذف این قرارداد از پرونده اطمینان دارید؟' : 'Are you sure you want to delete this contract?')) {
      storage.deleteContract(id);
      success(isRtl ? 'قرارداد با موفقیت حذف شد' : 'Contract deleted successfully');
      onRefreshContracts();
    }
  };

  const getStatusBadge = (status: ContractStatus) => {
    switch (status) {
      case ContractStatus.ACTIVE:
        return <Badge variant="emerald" size="sm">{t('contracts.statusActive')}</Badge>;
      case ContractStatus.COMPLETED:
        return <Badge variant="info" size="sm">{t('contracts.statusCompleted')}</Badge>;
      case ContractStatus.PENDING_SIGNATURE:
        return <Badge variant="warning" size="sm">{t('contracts.statusPendingSignature')}</Badge>;
      case ContractStatus.TERMINATED:
        return <Badge variant="danger" size="sm">{t('contracts.statusTerminated')}</Badge>;
      case ContractStatus.DRAFT:
      default:
        return <Badge variant="default" size="sm">{t('contracts.statusDraft')}</Badge>;
    }
  };

  const getTypeLabel = (tp: ContractType | string) => {
    switch (tp) {
      case ContractType.SALES:
      case 'SALES':
      case 'SALE':
        return t('contracts.typeSale');
      case ContractType.SERVICE:
      case 'SERVICE':
        return t('contracts.typeService');
      case ContractType.INSTALLMENT:
      case 'INSTALLMENT':
        return t('contracts.typeInstallment');
      case ContractType.SIM_SALE:
      case 'SIM_SALE':
        return 'فروش سیم‌کارت';
      case ContractType.SUBSCRIPTION:
      case 'SUBSCRIPTION':
        return 'اشتراک و اجاره';
      case ContractType.REPAIR:
      case 'REPAIR':
        return 'تعمیرات و خدمات';
      default:
        return String(tp);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{t('contracts.title')}</span>
            </h1>
            <Badge variant="purple" size="sm">
              <RTLNumber value={filteredContracts.length} type="count" suffix={t('contracts.countSuffix')} />
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('contracts.subtitle')} - مجموع ارزش قراردادها: <strong className="text-emerald-600 dark:text-emerald-400">{formatToman(totalContractValue)}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ExportExcelButton
            onExport={() => exportContractsToExcel(filteredContracts)}
            filename="contracts_list"
            size="sm"
          />

          <Button
            variant="primary"
            size="sm"
            onClick={onAddNewContract}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('contracts.newContractBtn')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
        <Input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          placeholder={t('contracts.searchPlaceholder')}
          rightIcon={<Search className="w-4 h-4 text-slate-400" />}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('contracts.status')}:</span>
            {['ALL', 'ACTIVE', 'COMPLETED', 'PENDING_SIGNATURE', 'TERMINATED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {st === 'ALL'
                  ? t('common.all')
                  : st === 'ACTIVE'
                  ? t('contracts.statusActive')
                  : st === 'COMPLETED'
                  ? t('contracts.statusCompleted')
                  : st === 'PENDING_SIGNATURE'
                  ? t('contracts.statusPendingSignature')
                  : t('contracts.statusTerminated')}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('contracts.type')}:</span>
            {['ALL', 'SALES', 'SERVICE', 'INSTALLMENT', 'SIM_SALE'].map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => {
                  setTypeFilter(tp);
                  setCurrentPage(1);
                }}
                className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                  typeFilter === tp
                    ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {tp === 'ALL'
                  ? t('common.all')
                  : tp === 'SALES'
                  ? t('contracts.typeSale')
                  : tp === 'SERVICE'
                  ? t('contracts.typeService')
                  : tp === 'INSTALLMENT'
                  ? t('contracts.typeInstallment')
                  : 'سیم‌کارت'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Standard ListViewControls with View Toggle (Card vs Row/List) & Pagination */}
      <ListViewControls
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredContracts.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      {/* Main Content: Empty State, Table View, or Card View */}
      {filteredContracts.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <FileSignature className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-300">{t('contracts.noContractsFound')}</h3>
          <Button variant="primary" size="sm" onClick={onAddNewContract}>
            {t('contracts.newContractBtn')}
          </Button>
        </div>
      ) : viewMode === 'list' ? (
        /* ROW / LIST VIEW (TABLE) */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3 w-32">شماره قرارداد</th>
                <th className="p-3">عنوان قرارداد</th>
                <th className="p-3 w-40">طرف قرارداد (مشتری)</th>
                <th className="p-3 w-28">نوع</th>
                <th className="p-3 w-36">مبلغ کل</th>
                <th className="p-3 w-32">پیش‌پرداخت</th>
                <th className="p-3 w-28">وضعیت</th>
                <th className="p-3 w-32">تاریخ شروع</th>
                <th className="p-3 text-left w-48">اقدامات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedContracts.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onEditContract(c)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  {/* Contract Number */}
                  <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                    {c.contractNumber}
                  </td>

                  {/* Title */}
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                    {c.title}
                  </td>

                  {/* Customer */}
                  <td className="p-3 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {c.customerName}
                  </td>

                  {/* Type */}
                  <td className="p-3 whitespace-nowrap">
                    <Badge variant="purple" size="sm">
                      {getTypeLabel(c.contractType)}
                    </Badge>
                  </td>

                  {/* Total Amount */}
                  <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {formatToman(c.totalAmount)}
                  </td>

                  {/* Down Payment */}
                  <td className="p-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {formatToman(c.downPayment || 0)}
                  </td>

                  {/* Status */}
                  <td className="p-3 whitespace-nowrap">
                    {getStatusBadge(c.status)}
                  </td>

                  {/* Start Date */}
                  <td className="p-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap text-[11px]" dir="ltr">
                    {formatPersianDate(c.startDate)}
                  </td>

                  {/* Actions */}
                  <td className="p-3 text-left whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContractForInstallments(c);
                        }}
                        leftIcon={<Receipt className="w-3.5 h-3.5 text-indigo-600" />}
                      >
                        اقساط ({c.installments?.length || 0})
                      </Button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditContract(c);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="ویرایش"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(c.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARD VIEW */
        <div className="space-y-3">
          {paginatedContracts.map((c) => {
            const hasEnded = c.endDate && isOverdue(c.endDate) && c.status === ContractStatus.ACTIVE;

            return (
              <div
                key={c.id}
                onClick={() => onEditContract(c)}
                className={`p-4 sm:p-5 rounded-2xl liquid-glass-card border transition-all cursor-pointer space-y-3 bg-white dark:bg-slate-900 ${
                  hasEnded
                    ? 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/10 hover:border-amber-500/60'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      <FileText className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                          {c.title}
                        </span>
                        {getStatusBadge(c.status)}
                        <Badge variant="purple" size="sm">
                          {getTypeLabel(c.contractType)}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>{t('contracts.contractNumber')}: <RTLNumber value={c.contractNumber} type="code" className="font-mono text-slate-900 dark:text-slate-200 font-bold" /></span>
                        <span>{t('contracts.customer')}: <strong className="text-slate-900 dark:text-slate-200">{c.customerName}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className={isRtl ? 'text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between' : 'text-right sm:text-left flex sm:flex-col items-center sm:items-start justify-between'}>
                    <div className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-300">
                      <RTLNumber value={c.totalAmount} type="price" />
                    </div>
                    <span className="text-xs text-slate-500">
                      {t('contracts.downPayment')}: <RTLNumber value={c.downPayment} type="price" />
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-4">
                    <span>
                      {t('contracts.startDate')}: {formatPersianDate(c.startDate)}
                    </span>
                    {c.endDate && (
                      <span className={hasEnded ? 'text-amber-600 font-bold' : ''}>
                        {t('contracts.endDate')}: {formatPersianDate(c.endDate)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContractForInstallments(c);
                      }}
                      leftIcon={<Receipt className="w-3.5 h-3.5 text-indigo-500" />}
                    >
                      اقساط ({c.installments?.length || 0})
                    </Button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditContract(c);
                      }}
                      className="p-1 hover:text-indigo-400 transition-colors"
                      title={t('common.edit')}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(c.id, e)}
                      className="p-1 hover:text-rose-500 transition-colors"
                      title={t('common.delete')}
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

      {/* Contract Installments Modal */}
      {selectedContractForInstallments && (
        <ContractInstallmentsModal
          isOpen={!!selectedContractForInstallments}
          onClose={() => setSelectedContractForInstallments(null)}
          contract={selectedContractForInstallments}
          currentUser={currentUser}
          onInstallmentsUpdated={() => {
            onRefreshContracts();
            if (selectedContractForInstallments) {
              const updated = storage.getContracts().find((c) => c.id === selectedContractForInstallments.id);
              if (updated) setSelectedContractForInstallments(updated);
            }
          }}
        />
      )}
    </div>
  );
};
