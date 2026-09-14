import React, { useState, useMemo } from 'react';
import { SimCard, SimOperator, SimType, SimStatus, Customer, Contract, User } from '../../types';
import {
  Smartphone, Search, Plus, Sparkles, AlertTriangle,
  CheckCircle2, Edit3, Trash2, Tag, Layers, ArrowLeftRight,
  Users, Bookmark, ShoppingCart, Lock, XCircle, UserCheck,
  Eye, ArrowUpDown, Handshake
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Checkbox } from '../ui/Checkbox';
import { ExportExcelButton } from '../ui/ExportExcelButton';
import { RTLNumber } from '../ui/RTLNumber';
import { exportSimsToExcel } from '../../lib/exportToExcel';
import { formatToman } from '../../lib/currencyUtils';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { RegisteredHoldersModal } from './RegisteredHoldersModal';
import { SimLifecycleModal, LifecycleMode } from './SimLifecycleModal';
import { ListViewControls, usePersistentViewMode } from '../ui/ListViewControls';

export interface SimListProps {
  sims: SimCard[];
  customers: Customer[];
  contracts?: Contract[];
  currentUser?: User;
  allUsers?: User[];
  onAddNewSim: () => void;
  onEditSim: (sim: SimCard) => void;
  onRefreshSims: () => void;
  onSelectCustomer: (customerId: string) => void;
}

export const SimList: React.FC<SimListProps> = ({
  sims = [],
  customers = [],
  contracts = [],
  currentUser = { id: 'usr-admin', name: 'مدیر سیستم', role: 'SUPER_ADMIN' as any } as User,
  allUsers = [],
  onAddNewSim,
  onEditSim,
  onRefreshSims,
  onSelectCustomer,
}) => {
  const { success } = useToast();
  const { t, isRtl, formatNumber } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [operatorFilter, setOperatorFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roundOnly, setRoundOnly] = useState(false);
  const [selectedHolderFilter, setSelectedHolderFilter] = useState<{ id: string; name: string } | null>(null);
  const [sortBy, setSortBy] = useState<'price_desc' | 'price_asc' | 'phone'>('price_desc');

  // View Mode & Pagination
  const [viewMode, setViewMode] = usePersistentViewMode('sims', 'list');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [isHoldersModalOpen, setIsHoldersModalOpen] = useState(false);
  const [lifecycleModal, setLifecycleModal] = useState<{
    isOpen: boolean;
    sim: SimCard | null;
    mode: LifecycleMode;
  }>({
    isOpen: false,
    sim: null,
    mode: 'RESERVE',
  });

  const filteredSims = useMemo(() => {
    return (sims || [])
      .filter((s) => {
        if (operatorFilter !== 'ALL' && s.operator !== operatorFilter) return false;
        if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
        if (roundOnly && !s.isRound) return false;
        if (selectedHolderFilter && s.registeredHolderId !== selectedHolderFilter.id) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          s.phoneNumber.includes(q) ||
          (s.roundCategory && s.roundCategory.toLowerCase().includes(q)) ||
          (s.ownerCustomerName && s.ownerCustomerName.toLowerCase().includes(q)) ||
          (s.registeredHolderName && s.registeredHolderName.toLowerCase().includes(q)) ||
          (s.reservationCustomerName && s.reservationCustomerName.toLowerCase().includes(q)) ||
          (s.notes && s.notes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return (a.salePrice || 0) - (b.salePrice || 0);
        if (sortBy === 'phone') return a.phoneNumber.localeCompare(b.phoneNumber);
        return (b.salePrice || 0) - (a.salePrice || 0);
      });
  }, [sims, searchQuery, operatorFilter, statusFilter, roundOnly, selectedHolderFilter, sortBy]);

  const totalPages = Math.ceil(filteredSims.length / pageSize) || 1;
  const paginatedSims = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSims.slice(start, start + pageSize);
  }, [filteredSims, currentPage, pageSize]);

  const totalInventoryValue = useMemo(() => {
    return filteredSims
      .filter((s) => s.status === SimStatus.AVAILABLE)
      .reduce((sum, s) => sum + (s.salePrice || 0), 0);
  }, [filteredSims]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(isRtl ? 'آیا از حذف این سیم‌کارت از انبار اطمینان دارید؟' : 'Are you sure you want to delete this SIM card?')) {
      storage.deleteSimCard(id);
      success(isRtl ? 'سیم‌کارت از انبار حذف شد' : 'SIM card removed from inventory');
      onRefreshSims();
    }
  };

  const openLifecycle = (sim: SimCard, mode: LifecycleMode, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLifecycleModal({
      isOpen: true,
      sim,
      mode,
    });
  };

  const getStatusBadge = (status: SimStatus | string, isConsigned?: boolean) => {
    if (status === 'CONSIGNMENT' || isConsigned) {
      return <Badge variant="indigo" size="sm">{isRtl ? 'امانی' : 'Consignment'}</Badge>;
    }
    switch (status) {
      case SimStatus.AVAILABLE:
      case 'AVAILABLE':
        return <Badge variant="emerald" size="sm">{t('sims.statusAvailable')}</Badge>;
      case SimStatus.SOLD:
      case 'SOLD':
        return <Badge variant="default" size="sm">{t('sims.statusSold')}</Badge>;
      case SimStatus.RESERVED:
      case 'RESERVED':
        return <Badge variant="warning" size="sm">{t('sims.statusReserved')}</Badge>;
      case SimStatus.RENTED:
      case 'RENTED':
        return <Badge variant="purple" size="sm">{t('sims.statusRented')}</Badge>;
      case SimStatus.SUSPENDED:
      case 'SUSPENDED':
      default:
        return <Badge variant="danger" size="sm">{isRtl ? 'توقیف / قطع' : 'Suspended'}</Badge>;
    }
  };

  const getOperatorBadge = (op: SimOperator | string) => {
    switch (op) {
      case SimOperator.MCI:
      case 'MCI':
        return <span className="text-[11px] px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-bold">{t('sims.mci')}</span>;
      case SimOperator.IRANCELL:
      case 'IRANCELL':
        return <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">{t('sims.irancell')}</span>;
      case SimOperator.RIGHTEL:
      case 'RIGHTEL':
        return <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold">{t('sims.rightel')}</span>;
      default:
        return <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400 font-bold">{op}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{t('sims.title')}</span>
            </h1>
            <Badge variant="purple" size="sm">
              <RTLNumber value={filteredSims.length} type="count" suffix={t('sims.countSuffix')} />
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('sims.subtitle')} - ارزش انبار آماده فروش: <strong className="text-emerald-600 dark:text-emerald-400">{formatToman(totalInventoryValue)}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHoldersModalOpen(true)}
            leftIcon={<Users className="w-4 h-4 text-indigo-600" />}
          >
            مدیریت سندزن‌ها
          </Button>

          <ExportExcelButton
            onExport={() => exportSimsToExcel(filteredSims)}
            filename="sim_cards_inventory"
            size="sm"
          />

          <Button
            variant="primary"
            size="sm"
            onClick={onAddNewSim}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('sims.newSimBtn')}
          </Button>
        </div>
      </div>

      {/* Selected Holder Filter Alert Banner */}
      {selectedHolderFilter && (
        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 flex items-center justify-between text-xs">
          <span>
            فیلتر فعال: سیم‌کارت‌های به نام <strong>{selectedHolderFilter.name}</strong>
          </span>
          <button
            type="button"
            onClick={() => setSelectedHolderFilter(null)}
            className="hover:text-indigo-900 dark:hover:text-indigo-100 underline text-xs font-semibold"
          >
            حذف فیلتر
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t('sims.searchPlaceholder')}
              rightIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="price_desc">مرتب‌سازی: گران‌ترین به ارزان‌ترین</option>
              <option value="price_asc">مرتب‌سازی: ارزان‌ترین به گران‌ترین</option>
              <option value="phone">مرتب‌سازی: شماره سیم‌کارت</option>
            </select>

            <Checkbox
              variant="pill"
              checked={roundOnly}
              onChange={(e) => {
                setRoundOnly(e.target.checked);
                setCurrentPage(1);
              }}
              label={t('sims.roundOnly')}
              icon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
              colorScheme="amber"
              size="sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('sims.operator')}:</span>
            {['ALL', 'MCI', 'IRANCELL', 'RIGHTEL'].map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => {
                  setOperatorFilter(op);
                  setCurrentPage(1);
                }}
                className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                  operatorFilter === op
                    ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {op === 'ALL' ? t('common.all') : op === 'MCI' ? t('sims.mci') : op === 'IRANCELL' ? t('sims.irancell') : t('sims.rightel')}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('sims.status')}:</span>
            {['ALL', 'AVAILABLE', 'RESERVED', 'SOLD'].map((st) => (
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
                {st === 'ALL' ? t('common.all') : st === 'AVAILABLE' ? t('sims.statusAvailable') : st === 'RESERVED' ? t('sims.statusReserved') : t('sims.statusSold')}
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
        totalItems={filteredSims.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      {/* Content: Empty State, Table View, or Card View */}
      {filteredSims.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <Smartphone className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">{t('sims.noSimsFound')}</h3>
          <p className="text-xs text-slate-500">{t('sims.noSimsDesc')}</p>
          <Button variant="primary" size="sm" onClick={onAddNewSim}>
            {t('sims.newSimBtn')}
          </Button>
        </div>
      ) : viewMode === 'list' ? (
        /* ROW / LIST VIEW (TABLE) */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3 w-40">شماره سیم‌کارت</th>
                <th className="p-3 w-28">اپراتور</th>
                <th className="p-3 w-24">نوع</th>
                <th className="p-3 w-32">قیمت فروش</th>
                <th className="p-3 w-28">وضعیت</th>
                <th className="p-3 w-36">سندزن (دارنده)</th>
                <th className="p-3">رزرو / خریدار / رهن</th>
                <th className="p-3 text-left w-52">اقدامات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedSims.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onEditSim(s)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  {/* Phone number */}
                  <td className="p-3 font-mono font-black text-indigo-700 dark:text-indigo-300 text-sm whitespace-nowrap" dir="ltr">
                    <div className="flex items-center gap-1.5">
                      <span>{s.phoneNumber}</span>
                      {s.isRound && (
                        <span className="p-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400" title={s.roundCategory || 'رند'}>
                          <Sparkles className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Operator */}
                  <td className="p-3 whitespace-nowrap">
                    {getOperatorBadge(s.operator)}
                  </td>

                  {/* Type */}
                  <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {s.type === 'PERMANENT' ? t('sims.permanent') : t('sims.creditType')}
                  </td>

                  {/* Sale Price */}
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {s.salePrice ? formatToman(s.salePrice) : 'توافقی'}
                  </td>

                  {/* Status */}
                  <td className="p-3 whitespace-nowrap">
                    {getStatusBadge(s.status, s.isConsigned)}
                    {s.isMortgaged && (
                      <span className="mr-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-300 font-bold border border-purple-500/30">
                        رهنی
                      </span>
                    )}
                  </td>

                  {/* Registered Holder */}
                  <td className="p-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {s.registeredHolderName || '-'}
                  </td>

                  {/* Customer / Notes / Reservation */}
                  <td className="p-3 text-slate-600 dark:text-slate-400 text-[11px]">
                    {s.status === 'RESERVED' && s.reservationCustomerName && (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        رزرو: {s.reservationCustomerName}
                      </span>
                    )}
                    {s.ownerCustomerName && (
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        مالک: {s.ownerCustomerName}
                      </span>
                    )}
                    {s.notes && !s.reservationCustomerName && !s.ownerCustomerName && (
                      <span className="truncate max-w-xs block">{s.notes}</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="p-3 text-left whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {s.status === SimStatus.AVAILABLE || s.status === 'AVAILABLE' ? (
                        <>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={(e) => openLifecycle(s, 'RESERVE', e)}
                            leftIcon={<Bookmark className="w-3 h-3 text-amber-500" />}
                          >
                            رزرو
                          </Button>
                          <Button
                            variant="success"
                            size="xs"
                            onClick={(e) => openLifecycle(s, 'SELL', e)}
                            leftIcon={<ShoppingCart className="w-3 h-3" />}
                          >
                            فروش
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={(e) => openLifecycle(s, 'CONSIGNMENT', e)}
                            leftIcon={<Handshake className="w-3 h-3 text-indigo-500" />}
                          >
                            امانی
                          </Button>
                        </>
                      ) : s.status === SimStatus.RESERVED || s.status === 'RESERVED' ? (
                        <>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={(e) => openLifecycle(s, 'CANCEL_RESERVE', e)}
                            leftIcon={<XCircle className="w-3 h-3 text-rose-500" />}
                          >
                            لغو
                          </Button>
                          <Button
                            variant="success"
                            size="xs"
                            onClick={(e) => openLifecycle(s, 'SELL', e)}
                            leftIcon={<ShoppingCart className="w-3 h-3" />}
                          >
                            فروش
                          </Button>
                        </>
                      ) : null}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSim(s);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="ویرایش"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(s.id, e)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {paginatedSims.map((s) => (
            <div
              key={s.id}
              onClick={() => onEditSim(s)}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 liquid-glass-card border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700 transition-all cursor-pointer space-y-3 flex flex-col justify-between shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    {getOperatorBadge(s.operator)}
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {s.type === 'PERMANENT' ? t('sims.permanent') : t('sims.creditType')}
                    </span>
                    {s.isMortgaged && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/30">
                        رهنی
                      </span>
                    )}
                  </div>

                  {getStatusBadge(s.status, s.isConsigned)}
                </div>

                <div className="pt-2 text-center">
                  <div className="text-lg sm:text-xl font-mono font-black text-indigo-700 dark:text-indigo-200 tracking-wider">
                    <RTLNumber value={s.phoneNumber} type="phone" />
                  </div>

                  {s.isRound && s.roundCategory && (
                    <div className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-bold border border-amber-200 dark:border-amber-500/20">
                      <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                      <span>{s.roundCategory}</span>
                    </div>
                  )}
                </div>

                {/* Price & Registered Holder Info */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{t('sims.salePrice')}:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {s.salePrice ? formatToman(s.salePrice) : 'توافقی'}
                    </span>
                  </div>

                  {s.registeredHolderName && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>سندزن:</span>
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{s.registeredHolderName}</span>
                    </div>
                  )}

                  {s.status === 'RESERVED' && s.reservationCustomerName && (
                    <div className="flex items-center justify-between pt-1 border-t border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400">
                      <span className="flex items-center gap-1">
                        <Bookmark className="w-3 h-3" />
                        <span>رزرو برای:</span>
                      </span>
                      <span className="font-bold">{s.reservationCustomerName}</span>
                    </div>
                  )}
                </div>

                {/* Lifecycle Quick Actions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2" onClick={(e) => e.stopPropagation()}>
                  {s.status === SimStatus.AVAILABLE || s.status === 'AVAILABLE' ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => openLifecycle(s, 'RESERVE', e)}
                        className="text-[11px] px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 font-semibold flex items-center gap-1"
                      >
                        <Bookmark className="w-3 h-3" />
                        رزرو / بیعانه
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openLifecycle(s, 'SELL', e)}
                        className="text-[11px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 font-semibold flex items-center gap-1"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        فروش قطعی
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openLifecycle(s, 'CONSIGNMENT', e)}
                        className="text-[11px] px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 font-semibold flex items-center gap-1"
                      >
                        <Handshake className="w-3 h-3" />
                        امانی
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openLifecycle(s, 'MORTGAGE', e)}
                        className="text-[11px] px-2 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 font-semibold flex items-center gap-1"
                      >
                        <Lock className="w-3 h-3" />
                        رهن
                      </button>
                    </>
                  ) : s.status === SimStatus.RESERVED || s.status === 'RESERVED' ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => openLifecycle(s, 'CANCEL_RESERVE', e)}
                        className="text-[11px] px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 font-semibold flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        لغو رزرو
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openLifecycle(s, 'SELL', e)}
                        className="text-[11px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 font-semibold flex items-center gap-1"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        تبدیل به فروش
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                <div>
                  {s.ownerCustomerId && s.ownerCustomerName ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCustomer(s.ownerCustomerId!);
                      }}
                      className="text-indigo-500 hover:underline"
                    >
                      {isRtl ? 'خریدار:' : 'Buyer:'} {s.ownerCustomerName}
                    </button>
                  ) : (
                    <span>{s.notes || '-'}</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditSim(s);
                    }}
                    className="p-1 hover:text-indigo-400 transition-colors"
                    title={t('common.edit')}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(s.id, e)}
                    className="p-1 hover:text-rose-500 transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Registered Holders Modal */}
      <RegisteredHoldersModal
        isOpen={isHoldersModalOpen}
        onClose={() => setIsHoldersModalOpen(false)}
        currentUser={currentUser}
        onSelectHolderForFilter={(holderId, holderName) => {
          setSelectedHolderFilter({ id: holderId, name: holderName });
          setIsHoldersModalOpen(false);
          setCurrentPage(1);
        }}
      />

      {/* Sim Lifecycle Modal (Reserve, Sell, Mortgage, Cancel) */}
      <SimLifecycleModal
        key={`lifecycle-${lifecycleModal.mode}-${lifecycleModal.sim?.id || 'none'}`}
        isOpen={lifecycleModal.isOpen}
        onClose={() => setLifecycleModal({ isOpen: false, sim: null, mode: 'RESERVE' })}
        sim={lifecycleModal.sim}
        mode={lifecycleModal.mode}
        currentUser={currentUser}
        allUsers={allUsers}
        customers={customers || []}
        contracts={(contracts && contracts.length > 0 ? contracts : storage.getContracts()) || []}
        onSuccess={() => {
          onRefreshSims();
          setLifecycleModal({ isOpen: false, sim: null, mode: 'RESERVE' });
        }}
      />
    </div>
  );
};
