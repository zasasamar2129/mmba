import React, { useState, useMemo } from 'react';
import { RepairTicket, RepairStatus, Customer, User } from '../../types';
import {
  Wrench, Search, Plus, Calendar, AlertTriangle,
  CheckCircle2, Edit3, Trash2, ShieldCheck, Clock, User as UserIcon
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { ExportExcelButton } from '../ui/ExportExcelButton';
import { RTLNumber } from '../ui/RTLNumber';
import { exportRepairsToExcel } from '../../lib/exportToExcel';
import { formatToman } from '../../lib/currencyUtils';
import { formatPersianDate, getRelativeTimeFa } from '../../lib/dateUtils';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { AttachmentPreview } from '../attachments/AttachmentPreview';

export interface RepairListProps {
  repairs: RepairTicket[];
  customers: Customer[];
  users: User[];
  onAddNewRepair: () => void;
  onEditRepair: (repair: RepairTicket) => void;
  onRefreshRepairs: () => void;
  onSelectCustomer: (customerId: string) => void;
}

export const RepairList: React.FC<RepairListProps> = ({
  repairs = [],
  customers = [],
  users = [],
  onAddNewRepair,
  onEditRepair,
  onRefreshRepairs,
  onSelectCustomer,
}) => {
  const { success } = useToast();
  const { t, isRtl, formatNumber } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredRepairs = useMemo(() => {
    return (repairs || [])
      .filter((r) => {
        if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          r.deviceModel.toLowerCase().includes(q) ||
          r.ticketNumber.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          (r.imei && r.imei.includes(q)) ||
          r.problemDescription.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  }, [repairs, searchQuery, statusFilter]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(isRtl ? 'آیا از حذف این قبض تعمیرات اطمینان دارید؟' : 'Are you sure you want to delete this repair ticket?')) {
      storage.deleteRepairTicket(id);
      success(isRtl ? 'قبض تعمیرات حذف شد' : 'Repair ticket deleted');
      onRefreshRepairs();
    }
  };

  const getStatusBadge = (status: RepairStatus) => {
    switch (status) {
      case RepairStatus.READY_DELIVERY:
        return <Badge variant="emerald" size="sm">{t('repairs.statusReady')}</Badge>;
      case RepairStatus.DELIVERED:
        return <Badge variant="default" size="sm">{t('repairs.statusDelivered')}</Badge>;
      case RepairStatus.IN_PROGRESS:
        return <Badge variant="info" size="sm">{t('repairs.statusInProgress')}</Badge>;
      case RepairStatus.DIAGNOSING:
        return <Badge variant="purple" size="sm">{t('repairs.statusDiagnosing')}</Badge>;
      case RepairStatus.WAITING_PARTS:
        return <Badge variant="warning" size="sm">{t('repairs.statusWaitingParts')}</Badge>;
      case RepairStatus.UNREPAIRABLE:
        return <Badge variant="danger" size="sm">{t('repairs.statusUnrepairable')}</Badge>;
      case RepairStatus.RECEIVED:
      default:
        return <Badge variant="default" size="sm">{t('repairs.statusReceived')}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-blur-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {t('repairs.title')}
            </h1>
            <Badge variant="warning" size="sm">
              <RTLNumber value={filteredRepairs.length} type="count" suffix={isRtl ? 'قبض پذیرش' : 'tickets'} />
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('repairs.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <ExportExcelButton
            onExport={() => exportRepairsToExcel(filteredRepairs)}
            itemCount={filteredRepairs.length}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={onAddNewRepair}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('repairs.newRepairBtn')}
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
              placeholder={t('repairs.searchPlaceholder')}
              rightIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60">
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{t('repairs.status')}:</span>
          {[
            { key: 'ALL', label: t('common.all') },
            { key: 'RECEIVED', label: t('repairs.statusReceived') },
            { key: 'IN_PROGRESS', label: t('repairs.statusInProgress') },
            { key: 'WAITING_PARTS', label: t('repairs.statusWaitingParts') },
            { key: 'READY_DELIVERY', label: t('repairs.statusReady') },
            { key: 'DELIVERED', label: t('repairs.statusDelivered') },
          ].map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => setStatusFilter(st.key)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === st.key
                  ? 'bg-amber-600 text-white font-semibold shadow-md shadow-amber-600/30'
                  : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filteredRepairs.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-3xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3">
          <Wrench className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-300">{t('repairs.noRepairsFound')}</h3>
          <p className="text-xs text-slate-500">{t('repairs.noRepairsDesc')}</p>
          <Button variant="primary" size="sm" onClick={onAddNewRepair}>
            {t('repairs.newRepairBtn')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRepairs.map((r) => (
            <div
              key={r.id}
              onClick={() => onEditRepair(r)}
              className="p-4 sm:p-5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <Wrench className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                        {r.deviceModel}
                      </span>
                      {getStatusBadge(r.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>{t('repairs.ticketNumber')}: <RTLNumber value={r.ticketNumber} type="code" className="font-mono text-slate-900 dark:text-slate-200 font-bold" /></span>
                      {r.imei && <span>IMEI: <RTLNumber value={r.imei} type="code" className="font-mono text-slate-800 dark:text-slate-300 font-bold" /></span>}
                      <span>{t('repairs.customer')}: <strong className="text-slate-900 dark:text-slate-200">{r.customerName}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between">
                  <div className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {r.finalCost ? formatToman(r.finalCost) : r.estimatedCost ? `${isRtl ? 'برآورد: ' : 'Est: '}${formatToman(r.estimatedCost)}` : (isRtl ? 'تعیین نشده' : 'Not specified')}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    {t('repairs.receivedAt')}: {formatPersianDate(r.receivedAt, false)} ({getRelativeTimeFa(r.receivedAt)})
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                <p>
                  <strong className="text-slate-600 dark:text-slate-400">{t('repairs.problem')}: </strong> {r.problemDescription}
                </p>
                {r.technicianNotes && (
                  <p className="text-indigo-700 dark:text-indigo-300 pt-1 border-t border-slate-200 dark:border-slate-800/80">
                    <strong className="text-indigo-600 dark:text-indigo-400">{t('repairs.technicianNotes')}: </strong> {r.technicianNotes}
                  </p>
                )}
                {(() => {
                  const repairAtts = storage.getAttachmentsByEntity('REPAIR', r.id);
                  if (repairAtts.length === 0) return null;
                  return (
                    <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800/80" onClick={(e) => e.stopPropagation()}>
                      <AttachmentPreview.List attachments={repairAtts} viewMode="chips" />
                    </div>
                  );
                })()}
              </div>

              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-800/60 gap-2">
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <span>{t('repairs.technician')}: {r.assignedTechnicianName || (isRtl ? 'تعیین نشده' : 'Unassigned')}</span>
                  {r.warrantyUntil && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {t('repairs.warranty')}: {formatPersianDate(r.warrantyUntil, false)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onSelectCustomer(r.customerId)}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline ml-2"
                  >
                    {isRtl ? 'پرونده مشتری ←' : 'Customer Profile →'}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditRepair(r)}
                    className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDelete(r.id, e)}
                    className="text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
