import React, { useState, useMemo } from 'react';
import { CheckItem, CheckType, CheckStatus, Customer } from '../../types';
import {
  CreditCard, Search, Plus, Calendar, AlertTriangle,
  CheckCircle2, Edit3, Trash2, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { ExportExcelButton } from '../ui/ExportExcelButton';
import { RTLNumber } from '../ui/RTLNumber';
import { exportChecksToExcel } from '../../lib/exportToExcel';
import { formatToman } from '../../lib/currencyUtils';
import { formatPersianDate, getRelativeTimeFa, isOverdue } from '../../lib/dateUtils';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';

export interface CheckListProps {
  checks: CheckItem[];
  customers: Customer[];
  onAddNewCheck: () => void;
  onEditCheck: (check: CheckItem) => void;
  onRefreshChecks: () => void;
  onSelectCustomer: (customerId: string) => void;
}

export const CheckList: React.FC<CheckListProps> = ({
  checks = [],
  customers = [],
  onAddNewCheck,
  onEditCheck,
  onRefreshChecks,
  onSelectCustomer,
}) => {
  const { success } = useToast();
  const { t, isRtl, formatNumber } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredChecks = useMemo(() => {
    return (checks || [])
      .filter((c) => {
        if (typeFilter !== 'ALL' && c.type !== typeFilter) return false;
        if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          c.checkNumber.includes(q) ||
          (c.sayadNumber && c.sayadNumber.includes(q)) ||
          c.bankName.toLowerCase().includes(q) ||
          c.issuerName.toLowerCase().includes(q) ||
          (c.customerName && c.customerName.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [checks, searchQuery, typeFilter, statusFilter]);

  const totalAmount = useMemo(() => {
    return filteredChecks.reduce((sum, c) => sum + (c.amount || 0), 0);
  }, [filteredChecks]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(isRtl ? 'آیا از حذف این رکورد چک اطمینان دارید؟' : 'Are you sure you want to delete this check?')) {
      storage.deleteCheck(id);
      success(isRtl ? 'چک از سامانه حذف شد' : 'Check deleted');
      onRefreshChecks();
    }
  };

  const getStatusBadge = (status: CheckStatus) => {
    switch (status) {
      case CheckStatus.CLEARED:
        return <Badge variant="emerald" size="sm">{t('checks.statusCleared')}</Badge>;
      case CheckStatus.BOUNCED:
      case CheckStatus.RETURNED:
        return <Badge variant="danger" size="sm">{t('checks.statusBounced')}</Badge>;
      case CheckStatus.DEPOSITED:
        return <Badge variant="info" size="sm">{t('checks.statusDeposited')}</Badge>;
      case CheckStatus.TRANSFERRED:
        return <Badge variant="purple" size="sm">{t('checks.statusTransferred')}</Badge>;
      case CheckStatus.IN_SAFE:
      default:
        return <Badge variant="warning" size="sm">{t('checks.statusInSafe')}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-blur-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {t('checks.title')}
            </h1>
            <Badge variant="warning" size="sm">
              <RTLNumber value={filteredChecks.length} type="count" suffix={isRtl ? 'فقره چک' : 'checks'} />
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('checks.totalAmount')}: <span className="text-amber-600 dark:text-amber-400 font-bold"><RTLNumber value={totalAmount} type="price" /></span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <ExportExcelButton
            onExport={() => exportChecksToExcel(filteredChecks)}
            itemCount={filteredChecks.length}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={onAddNewCheck}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('checks.newCheckBtn')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3.5 sm:p-4 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('checks.searchPlaceholder')}
              rightIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{t('checks.type')}:</span>
            {['ALL', 'RECEIVED', 'PAID'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                  typeFilter === type
                    ? 'bg-amber-600 text-white font-semibold shadow-md shadow-amber-600/30'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {type === 'ALL' ? t('checks.typeAll') : type === 'RECEIVED' ? t('checks.typeReceived') : t('checks.typePaid')}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{t('checks.status')}:</span>
            {['ALL', 'IN_SAFE', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'TRANSFERRED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`text-xs px-2 py-0.5 rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {st === 'ALL'
                  ? t('common.all')
                  : st === 'IN_SAFE'
                  ? t('checks.statusInSafe')
                  : st === 'DEPOSITED'
                  ? t('checks.statusDeposited')
                  : st === 'CLEARED'
                  ? t('checks.statusCleared')
                  : st === 'BOUNCED'
                  ? t('checks.statusBounced')
                  : t('checks.statusTransferred')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Check list */}
      {filteredChecks.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-3xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3">
          <CreditCard className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-300">{t('checks.noChecksFound')}</h3>
          <Button variant="primary" size="sm" onClick={onAddNewCheck}>
            {t('checks.newCheckBtn')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredChecks.map((c) => {
            const overdue = isOverdue(c.dueDate) && c.status !== CheckStatus.CLEARED && c.status !== CheckStatus.RETURNED;

            return (
              <div
                key={c.id}
                onClick={() => onEditCheck(c)}
                className={`p-4 sm:p-5 rounded-2xl liquid-glass-card border transition-all cursor-pointer space-y-3 ${
                  overdue
                    ? 'border-rose-500/40 bg-rose-50 dark:bg-rose-950/10 hover:border-rose-500/60'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        c.type === 'RECEIVED'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {c.type === 'RECEIVED' ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                          {c.bankName} {c.branchName ? `(${c.branchName})` : ''}
                        </span>
                        {getStatusBadge(c.status)}
                        {overdue && (
                          <Badge variant="danger" size="sm">
                            {t('checks.overdueAlert')}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>{t('checks.checkNumber')}: <RTLNumber value={c.checkNumber} type="code" className="font-mono text-slate-900 dark:text-slate-200 font-bold" /></span>
                        {c.sayadNumber && (
                          <span>{t('checks.sayadNumber')}: <RTLNumber value={c.sayadNumber} type="sayad" className="text-indigo-600 dark:text-indigo-300 font-bold" /></span>
                        )}
                        <span>{t('checks.issuerName')}: <strong className="text-slate-900 dark:text-slate-200">{c.issuerName}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className={isRtl ? 'text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between' : 'text-right sm:text-left flex sm:flex-col items-center sm:items-start justify-between'}>
                    <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
                      <RTLNumber value={c.amount} type="price" />
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {t('checks.dueDate')}: {formatPersianDate(c.dueDate, false)} ({getRelativeTimeFa(c.dueDate)})
                    </span>
                  </div>
                </div>

                {c.notes && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200 dark:border-slate-800/80">
                    {c.notes}
                  </p>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                  <div>
                    {c.customerId && c.customerName && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCustomer(c.customerId!);
                        }}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {t('checks.customer')}: {c.customerName}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditCheck(c)}
                      className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(c.id, e)}
                      className="text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
