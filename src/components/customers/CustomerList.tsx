import React, { useState, useMemo } from 'react';
import { Customer, CustomerStatus, User, ModuleName, PermissionAction } from '../../types';
import {
  Users, Search, Plus, PhoneCall, CheckSquare,
  Building2, MapPin, Phone, Filter, ArrowUpDown, Tag, Star,
  Clock, ArrowDownAZ, Coins, Trash2, Edit3, AlertTriangle,
  Check, X, CheckCheck, FileSpreadsheet, ShieldAlert,
  LayoutGrid, List, Printer, Upload, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Checkbox } from '../ui/Checkbox';
import { ExportExcelButton } from '../ui/ExportExcelButton';
import { RTLNumber } from '../ui/RTLNumber';
import { ModernDropdown } from '../ui/ModernDropdown';
import { exportCustomersToExcel } from '../../lib/exportToExcel';
import { formatPrice, formatPersianDate } from '../../lib/dateUtils';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { hasPermission, isAdmin } from '../../lib/permissions';
import { useTranslation } from '../../lib/i18n';
import { BulkContactImportModal } from './BulkContactImportModal';
import { GlobalPrintModal } from '../common/GlobalPrintModal';
import { ListViewControls } from '../ui/ListViewControls';

export interface CustomerListProps {
  customers: Customer[];
  currentUser?: User;
  onSelectCustomer: (customer: Customer) => void;
  onAddNewCustomer: () => void;
  onEditCustomer?: (customer: Customer) => void;
  onRefreshCustomers?: () => void;
  onQuickCall: (customer: Customer) => void;
  onQuickTask: (customer: Customer) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({
  customers,
  currentUser,
  onSelectCustomer,
  onAddNewCustomer,
  onEditCustomer,
  onRefreshCustomers,
  onQuickCall,
  onQuickTask,
}) => {
  const { success, error, info } = useToast();
  const { t, isRtl, formatNumber } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [registrationReasonFilter, setRegistrationReasonFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'NAME' | 'CREDIT'>('NEWEST');
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    try {
      return (localStorage.getItem('mmba_contacts_view_mode') as 'card' | 'table') || 'card';
    } catch {
      return 'card';
    }
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPrintListModalOpen, setIsPrintListModalOpen] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete Confirmation Modal State
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    targets: Customer[];
  }>({
    isOpen: false,
    targets: [],
  });

  // Current logged in user fallback
  const user = currentUser || storage.getCurrentUser();

  // RBAC Permission checks
  const canCreate = hasPermission(user, ModuleName.CUSTOMERS, PermissionAction.CREATE);
  const canEdit = hasPermission(user, ModuleName.CUSTOMERS, PermissionAction.EDIT);
  const canDelete =
    hasPermission(user, ModuleName.CUSTOMERS, PermissionAction.ARCHIVE) ||
    hasPermission(user, ModuleName.CUSTOMERS, PermissionAction.MANAGE) ||
    isAdmin(user);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.tags) c.tags.forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [customers]);

  // Filter and Sort Customers
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        // Status Filter
        if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
        // Tag Filter
        if (tagFilter !== 'ALL' && (!c.tags || !c.tags.includes(tagFilter))) return false;
        // Registration Reason Filter
        if (registrationReasonFilter !== 'ALL' && (c.registrationReason || 'مشتری') !== registrationReasonFilter) return false;
        // Query Search
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          c.name.toLowerCase().includes(q) ||
          c.mobile.includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.companyName && c.companyName.toLowerCase().includes(q)) ||
          (c.nationalCode && c.nationalCode.includes(q)) ||
          c.code.toLowerCase().includes(q) ||
          (c.city && c.city.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'NAME') return a.name.localeCompare(b.name, 'fa');
        if (sortBy === 'CREDIT') return (b.creditLimit || 0) - (a.creditLimit || 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [customers, searchQuery, statusFilter, tagFilter, registrationReasonFilter, sortBy]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  // Selection calculations
  const isAllFilteredSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((c) => selectedIds.has(c.id));
  const isSomeFilteredSelected =
    filteredCustomers.some((c) => selectedIds.has(c.id)) && !isAllFilteredSelected;

  const selectedCustomersList = useMemo(() => {
    return customers.filter((c) => selectedIds.has(c.id));
  }, [customers, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Unselect all visible
      const newSet = new Set(selectedIds);
      filteredCustomers.forEach((c) => newSet.delete(c.id));
      setSelectedIds(newSet);
    } else {
      // Select all visible
      const newSet = new Set(selectedIds);
      filteredCustomers.forEach((c) => newSet.add(c.id));
      setSelectedIds(newSet);
    }
  };

  const handleToggleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Open delete confirmation for single customer
  const handlePromptSingleDelete = (customer: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!canDelete) {
      error(isRtl ? 'شما مجوز حذف پرونده مشتریان را ندارید' : 'You do not have permission to delete customer records');
      return;
    }
    setDeleteModalState({
      isOpen: true,
      targets: [customer],
    });
  };

  // Open delete confirmation for multiple selected customers
  const handlePromptBulkDelete = () => {
    if (!canDelete) {
      error(isRtl ? 'شما مجوز حذف پرونده مشتریان را ندارید' : 'You do not have permission to delete customer records');
      return;
    }
    if (selectedCustomersList.length === 0) return;
    setDeleteModalState({
      isOpen: true,
      targets: selectedCustomersList,
    });
  };

  // Perform confirmed deletion
  const handleConfirmDelete = () => {
    const targets = deleteModalState.targets;
    if (targets.length === 0) return;

    try {
      if (targets.length === 1) {
        storage.deleteCustomer(targets[0].id);
        success(isRtl ? `پرونده مخاطب «${targets[0].name}» با موفقیت حذف شد` : `Customer record "${targets[0].name}" deleted successfully`);
      } else {
        const ids = targets.map((t) => t.id);
        storage.deleteMultipleCustomers(ids);
        success(isRtl ? `تعداد ${targets.length} پرونده مخاطب با موفقیت حذف شدند` : `Successfully deleted ${targets.length} customer records`);
      }

      // Remove from selected set
      const newSet = new Set(selectedIds);
      targets.forEach((t) => newSet.delete(t.id));
      setSelectedIds(newSet);

      setDeleteModalState({ isOpen: false, targets: [] });
      if (onRefreshCustomers) onRefreshCustomers();
    } catch (err: any) {
      error(err?.message || (isRtl ? 'خطا در حذف پرونده‌های مخاطبان' : 'Error deleting customer records'));
    }
  };

  // Export only selected customers
  const handleExportSelected = () => {
    if (selectedCustomersList.length === 0) return;
    exportCustomersToExcel(selectedCustomersList);
    info(isRtl ? `فایل اکسل شامل ${selectedCustomersList.length} مخاطب انتخاب‌شده آماده دانلود گردید` : `Excel file with ${selectedCustomersList.length} selected contacts ready for download`);
  };

  // Statistics
  const totalCount = customers.length;
  const vipCount = customers.filter((c) => c.status === CustomerStatus.VIP).length;
  const activeCount = customers.filter((c) => c.status === CustomerStatus.ACTIVE).length;
  const prospectCount = customers.filter((c) => c.status === CustomerStatus.PROSPECT).length;

  const statusBadges: Record<string, { label: string; variant: 'purple' | 'success' | 'warning' | 'default' | 'danger' }> = {
    VIP: { label: t('customers.statusVip'), variant: 'purple' },
    ACTIVE: { label: t('customers.statusActive'), variant: 'success' },
    PROSPECT: { label: t('customers.statusProspect'), variant: 'warning' },
    INACTIVE: { label: t('customers.statusInactive'), variant: 'default' },
    BLACKLISTED: { label: t('customers.statusBlacklisted'), variant: 'danger' },
  };

  return (
    <div className="space-y-6 animate-blur-fade-up pb-24 sm:pb-12">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-end">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {t('customers.title')}
            </h1>
            <Badge variant="purple" size="sm">
              <RTLNumber value={filteredCustomers.length} type="count" /> {isRtl ? ' از ' : ' of '} <RTLNumber value={totalCount} type="count" />
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('customers.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setViewMode('card');
                try {
                  localStorage.setItem('mmba_contacts_view_mode', 'card');
                } catch {}
              }}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${
                viewMode === 'card'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title={isRtl ? 'نمای کارت‌ها' : 'Card View'}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden md:inline">{isRtl ? 'کارت‌ها' : 'Cards'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('table');
                try {
                  localStorage.setItem('mmba_contacts_view_mode', 'table');
                } catch {}
              }}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title={isRtl ? 'نمای جدول و فهرست فشرده' : 'Compact Table View'}
            >
              <List className="w-4 h-4" />
              <span className="hidden md:inline">{isRtl ? 'جدول فشرده' : 'Table'}</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            {isRtl ? 'ورود گروهی (Excel / vCard)' : 'Bulk Import (Excel / vCard)'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPrintListModalOpen(true)}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            {isRtl ? 'چاپ فهرست' : 'Print List'}
          </Button>

          <ExportExcelButton
            onExport={() => exportCustomersToExcel(filteredCustomers)}
            itemCount={filteredCustomers.length}
          />
          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={onAddNewCustomer}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {t('customers.newCustomerBtn')}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Counter Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 liquid-glass-card border border-slate-200 dark:border-slate-800 text-end shadow-sm">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{t('customers.totalCustomers')}</span>
          <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100"><RTLNumber value={totalCount} type="count" suffix="" /></span>
        </div>
        <div className="p-3.5 rounded-2xl liquid-glass-card border border-indigo-200 dark:border-indigo-500/20 text-end bg-indigo-50/70 dark:bg-indigo-950/20 shadow-sm">
          <span className="text-[11px] text-indigo-700 dark:text-indigo-300 block font-medium">{t('customers.vipCustomers')}</span>
          <span className="text-base sm:text-lg font-bold text-indigo-900 dark:text-indigo-200"><RTLNumber value={vipCount} type="count" suffix="" /></span>
        </div>
        <div className="p-3.5 rounded-2xl liquid-glass-card border border-emerald-200 dark:border-emerald-500/20 text-end bg-emerald-50/70 dark:bg-emerald-950/20 shadow-sm">
          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block font-medium">{t('customers.activeCustomers')}</span>
          <span className="text-base sm:text-lg font-bold text-emerald-900 dark:text-emerald-200"><RTLNumber value={activeCount} type="count" suffix="" /></span>
        </div>
        <div className="p-3.5 rounded-2xl liquid-glass-card border border-amber-200 dark:border-amber-500/20 text-end bg-amber-50/70 dark:bg-amber-950/20 shadow-sm">
          <span className="text-[11px] text-amber-700 dark:text-amber-300 block font-medium">{t('customers.prospectCustomers')}</span>
          <span className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-200"><RTLNumber value={prospectCount} type="count" suffix="" /></span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/90 liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="w-full sm:flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('customers.searchPlaceholder')}
              rightIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Sort Selector */}
          <div className="w-full sm:w-auto flex items-center gap-2">
            <ModernDropdown<'NEWEST' | 'NAME' | 'CREDIT'>
              value={sortBy}
              onChange={(newSort) => setSortBy(newSort)}
              label={t('customers.sortBy')}
              prefixIcon={ArrowUpDown}
              options={[
                {
                  value: 'NEWEST',
                  label: t('customers.sortNewest'),
                  description: '',
                  icon: Clock,
                },
                {
                  value: 'NAME',
                  label: t('customers.sortName'),
                  description: '',
                  icon: ArrowDownAZ,
                },
                {
                  value: 'CREDIT',
                  label: t('customers.sortCredit'),
                  description: '',
                  icon: Coins,
                },
              ]}
            />
          </div>
        </div>

        {/* Selection and Filter Toolbar Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/60">
          {/* Select All Checkbox control */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <input
                type="checkbox"
                checked={isAllFilteredSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isSomeFilteredSelected;
                }}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 transition-colors cursor-pointer"
              />
              <span>
                {isAllFilteredSelected
                  ? t('customers.deselectAll') : `${t('customers.selectAll')} (${filteredCustomers.length})`}
              </span>
            </label>

            {selectedIds.size > 0 && (
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                {selectedIds.size} {t('customers.selectedCount')}
              </span>
            )}
          </div>

          {/* Status & Tag Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ms-1">{t('customers.filterStatus')}:</span>
            {['ALL', 'VIP', 'ACTIVE', 'PROSPECT', 'INACTIVE', 'BLACKLISTED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {st === 'ALL' ? t('common.all') : statusBadges[st]?.label || st}
              </button>
            ))}

            {allTags.length > 0 && (
              <>
                <span className="text-xs text-slate-400 dark:text-slate-500 me-2">{isRtl ? '| برچسب:' : '| Tag:'}</span>
                <button
                  type="button"
                  onClick={() => setTagFilter('ALL')}
                  className={`text-xs px-2 py-0.5 rounded-lg transition-all ${
                    tagFilter === 'ALL'
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {isRtl ? 'همه' : 'All'}
                </button>
                {allTags.slice(0, 4).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTagFilter(tag)}
                    className={`text-xs px-2 py-0.5 rounded-lg transition-all ${
                      tagFilter === tag
                        ? 'bg-purple-600 text-white font-semibold'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Registration Reason Filter */}
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ms-1">{isRtl ? 'علت ثبت شماره:' : 'Registration Reason:'}</span>
            {['ALL', 'مشتری', 'مشتری بالقوه', 'همکار', 'تأمین‌کننده', 'دوست/آشنا', 'تماس کاری', 'پیگیری فروش', 'سایر'].map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => {
                  setRegistrationReasonFilter(reason);
                  setCurrentPage(1);
                }}
                className={`text-xs px-2.5 py-0.5 rounded-lg transition-all ${
                  registrationReasonFilter === reason
                    ? 'bg-amber-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {reason === 'ALL' ? (isRtl ? 'همه دلایل' : 'All Reasons') : reason}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ListViewControls Component */}
      <ListViewControls
        viewMode={viewMode === 'table' ? 'list' : 'card'}
        onViewModeChange={(mode) => {
          const next = mode === 'list' ? 'table' : 'card';
          setViewMode(next);
          try {
            localStorage.setItem('mmba_contacts_view_mode', next);
          } catch {}
        }}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredCustomers.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[12, 24, 48, 96]}
      />

      {/* Customer List / Table / Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-3xl bg-white dark:bg-slate-900/90 liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3">
          <Users className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">{t('customers.noCustomersFound')}</h3>
          <p className="text-xs text-slate-500">{t('customers.noCustomersDesc')}</p>
          {canCreate && (
            <Button variant="primary" size="sm" onClick={onAddNewCustomer}>
              {t('customers.newCustomerBtn')}
            </Button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-end text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="p-3">{isRtl ? 'کد و نام مخاطب' : 'Code & Contact Name'}</th>
                <th className="p-3">{isRtl ? 'شماره همراه و تلفن' : 'Mobile & Phone'}</th>
                <th className="p-3">{isRtl ? 'شرکت و سمت شغلی' : 'Company & Position'}</th>
                <th className="p-3">{isRtl ? 'علت ثبت شماره' : 'Registration Reason'}</th>
                <th className="p-3">{isRtl ? 'تاریخ ثبت (شمسی)' : 'Registration Date (Jalali)'}</th>
                <th className="p-3">{isRtl ? 'سقف اعتبار' : 'Credit Limit'}</th>
                <th className="p-3">{isRtl ? 'وضعیت' : 'Status'}</th>
                <th className="p-3 text-center">{isRtl ? 'عملیات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedCustomers.map((c) => {
                const isSelected = selectedIds.has(c.id);

                return (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCustomer(c)}
                    className={`cursor-pointer transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 ${
                      isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/40' : ''
                    }`}
                  >
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleSelectOne(c.id);
                        }}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center shrink-0 text-xs">
                          {c.name.substring(0, 2)}
                        </div>
                        <div>
                          <div>{c.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{c.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-sky-700 dark:text-sky-300 dir-ltr text-end">{c.mobile}</div>
                      {c.phone && <div className="font-mono text-slate-400 text-[11px] dir-ltr text-end">{c.phone}</div>}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">
                      <div>{c.companyName || '—'}</div>
                      {c.jobTitle && <div className="text-[11px] text-indigo-600 dark:text-indigo-400">{c.jobTitle}</div>}
                    </td>
                    <td className="p-3">
                      <Badge variant="warning" size="sm">
                        {c.registrationReason || (isRtl ? 'مشتری' : 'Customer')}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                      {formatPersianDate(c.createdAt)}
                    </td>
                    <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">
                      {formatPrice(c.creditLimit)}
                    </td>
                    <td className="p-3">
                      <Badge variant={statusBadges[c.status]?.variant || 'default'} size="sm">
                        {statusBadges[c.status]?.label || c.status}
                      </Badge>
                    </td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectCustomer(c)}
                          className="p-1 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title={isRtl ? 'مشاهده پرونده' : 'View Profile'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickCall(c)}
                          className="p-1 rounded-md text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                          title={isRtl ? 'تماس سریع' : 'Quick Call'}
                        >
                          <PhoneCall className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickTask(c)}
                          className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          title={isRtl ? 'ثبت وظیفه' : 'Create Task'}
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>
                        {canEdit && onEditCustomer && (
                          <button
                            type="button"
                            onClick={() => onEditCustomer(c)}
                            className="p-1 rounded-md text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                            title={isRtl ? 'ویرایش' : 'Edit'}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={(e) => handlePromptSingleDelete(c, e)}
                            className="p-1 rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title={isRtl ? 'حذف' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedCustomers.map((c) => {
            const isSelected = selectedIds.has(c.id);

            return (
              <div
                key={c.id}
                onClick={() => onSelectCustomer(c)}
                className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/90 liquid-glass-card border transition-all cursor-pointer text-end flex flex-col justify-between group relative shadow-sm ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/25 shadow-lg shadow-indigo-500/10 dark:shadow-indigo-950/40 ring-1 ring-indigo-500/40'
                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:shadow-indigo-950/30'
                }`}
              >
                <div className="space-y-3">
                  {/* Header Row with Checkbox & Avatar */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {/* Checkbox */}
                      <div
                        onClick={(e) => handleToggleSelectOne(c.id, e)}
                        className="p-1 -me-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                        title={isRtl ? 'انتخاب مخاطب' : 'Select Contact'}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleSelectOne(c.id);
                          }}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                        />
                      </div>

                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-sm shrink-0">
                        {c.name.substring(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors line-clamp-1">
                          {c.name}
                        </h3>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {c.code}
                          </span>
                          {c.jobTitle && (
                            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium truncate max-w-[120px]">
                              • {c.jobTitle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge variant={statusBadges[c.status]?.variant || 'default'} size="sm">
                        {statusBadges[c.status]?.label || c.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Company & Details */}
                  {c.companyName && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span className="truncate">{c.companyName}</span>
                    </div>
                  )}

                  {/* Contact info */}
                  <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <RTLNumber value={c.mobile} type="phone" className="text-xs font-mono font-medium text-sky-700 dark:text-sky-300" />
                    </div>
                    {c.phone && (
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <RTLNumber value={c.phone} type="phone" className="text-xs font-mono text-slate-500 dark:text-slate-400" />
                      </div>
                    )}
                    {c.city && (
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{c.city}</span>
                      </div>
                    )}
                  </div>

                  {/* Reason and Date info */}
                  <div className="flex items-center justify-between gap-1 pt-1 text-[11px] border-t border-slate-100 dark:border-slate-800/60">
                    <Badge variant="warning" size="sm">
                      {isRtl ? 'علت: ' : 'Reason: '}{c.registrationReason || (isRtl ? 'مشتری' : 'Customer')}
                    </Badge>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      {isRtl ? 'ثبت: ' : 'Date: '}{formatPersianDate(c.createdAt)}
                    </span>
                  </div>

                  {/* Tags */}
                  {c.tags && c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {c.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                        >
                          {t}
                        </span>
                      ))}
                      {c.tags.length > 3 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">+{c.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons Bar at bottom of card */}
                <div
                  className="flex items-center justify-between pt-3 mt-4 border-t border-slate-200 dark:border-slate-800/70"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('customers.credit')}: <strong className="text-emerald-600 dark:text-emerald-400 font-normal">{formatPrice(c.creditLimit)}</strong>
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Quick Call */}
                    <button
                      type="button"
                      onClick={() => onQuickCall(c)}
                      className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors border border-sky-200 dark:border-sky-500/20"
                      title={t('customers.quickCall')}
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                    </button>

                    {/* Quick Task */}
                    <button
                      type="button"
                      onClick={() => onQuickTask(c)}
                      className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors border border-emerald-200 dark:border-emerald-500/20"
                      title={t('customers.quickTask')}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Customer (if permitted) */}
                    {canEdit && onEditCustomer && (
                      <button
                        type="button"
                        onClick={() => onEditCustomer(c)}
                        className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors border border-indigo-200 dark:border-indigo-500/20"
                        title={t('customers.editCustomer')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete Customer (if permitted) */}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => handlePromptSingleDelete(c, e)}
                        className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors border border-rose-200 dark:border-rose-500/20"
                        title={t('customers.deleteCustomer')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Multi-Select Batch Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 start-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl p-3 sm:p-4 rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-indigo-300 dark:border-indigo-500/40 shadow-2xl shadow-slate-900/20 dark:shadow-black/80 flex items-center justify-between gap-3 text-end"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-600/30 border border-indigo-200 dark:border-indigo-500/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs shrink-0">
                {selectedIds.size}
              </div>
              <div className="text-xs sm:text-sm">
                <span className="font-bold text-slate-900 dark:text-white block sm:inline">
                  {selectedIds.size} {isRtl ? 'مخاطب انتخاب شده' : 'contacts selected'}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] hidden sm:inline me-2">
                  ({isRtl ? `از مجموع ${filteredCustomers.length} مخاطب` : `out of ${filteredCustomers.length} contacts`})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Export to Excel */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportSelected}
                leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                className="text-xs py-1.5 px-3 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                {t('customers.exportSelected')} ({selectedIds.size})
              </Button>

              {/* Bulk Delete Button */}
              {canDelete ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handlePromptBulkDelete}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  className="text-xs py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
                >
                  {t('customers.deleteSelected')} ({selectedIds.size})
                </Button>
              ) : (
                <span
                  title={isRtl ? 'شما مجوز حذف پرونده‌ها را ندارید' : 'You do not have permission to delete records'}
                  className="text-xs text-rose-600 dark:text-rose-400/80 flex items-center gap-1 px-2 py-1 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-lg"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {t('customers.noDeletePermission')}
                </span>
              )}

              {/* Deselect All */}
              <button
                type="button"
                onClick={handleClearSelection}
                className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={isRtl ? 'لغو انتخاب‌ها' : 'Clear Selection'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deletion Confirmation Dialog Modal */}
      <Modal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, targets: [] })}
        maxWidth="md"
        title={
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>
              {deleteModalState.targets.length === 1
                ? isRtl ? 'تأیید حذف پرونده مخاطب' : 'Confirm Delete Contact'
                : isRtl ? `تأیید حذف گروهی ${deleteModalState.targets.length} مخاطب` : `Confirm Bulk Delete of ${deleteModalState.targets.length} Contacts`}
            </span>
          </div>
        }
        subtitle={t('customers.deleteWarning')}
      >
        <div className="space-y-4 text-end">
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {deleteModalState.targets.length === 1 ? (
              <>
                {isRtl ? 'آیا از حذف پرونده مخاطب «' : 'Are you sure you want to delete contact «'}
                <strong className="text-slate-900 dark:text-white font-bold">{deleteModalState.targets[0]?.name}</strong>
                {isRtl ? '» اطمینان دارید؟' : '»?'}
              </>
            ) : (
              <>
                {isRtl ? 'آیا از حذف کامل ' : 'Are you sure you want to delete all '}
                <strong className="text-rose-600 dark:text-rose-400 font-bold">{deleteModalState.targets.length}</strong>
                {isRtl ? ' مخاطب انتخاب‌شده اطمینان دارید؟' : ' selected contacts?'}
              </>
            )}
          </p>

          {/* Preview list of items to be deleted */}
          <div className="max-h-48 overflow-y-auto p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2">
            {deleteModalState.targets.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 flex items-center justify-center font-bold text-[10px]">
                    {t.name.substring(0, 1)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-200 block">{t.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{t.code}</span>
                  </div>
                </div>
                <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]" dir="ltr">
                  {t.mobile}
                </span>
              </div>
            ))}

            {deleteModalState.targets.length > 5 && (
              <div className="text-center text-[11px] text-slate-500 pt-1">
                {isRtl ? `و ${deleteModalState.targets.length - 5} مخاطب دیگر...` : `and ${deleteModalState.targets.length - 5} more contacts...`}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setDeleteModalState({ isOpen: false, targets: [] })}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={handleConfirmDelete}
              leftIcon={<Trash2 className="w-4 h-4" />}
              className="bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
            >
              {t('customers.confirmDelete')} ({deleteModalState.targets.length})
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Contact Import Modal */}
      <BulkContactImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={() => {
          setIsImportModalOpen(false);
          // If window event or state refresh is needed
          window.dispatchEvent(new CustomEvent('mmba_data_updated'));
        }}
      />

      {/* Global Print Modal for Customer List */}
      <GlobalPrintModal
        isOpen={isPrintListModalOpen}
        onClose={() => setIsPrintListModalOpen(false)}
        title={isRtl ? 'فهرست و کاردکس مخاطبان و مشتریان' : 'Contact & Customer List and Ledger'}
        subtitle={isRtl ? `گزارش استخراج شده شامل ${filteredCustomers.length} رکورد - سامانه جامع MMBA` : `Extracted report contains ${filteredCustomers.length} records - MMBA Comprehensive System`}
        documentDate={new Date().toISOString()}
      >
        <div className="space-y-4 text-slate-800">
          <table className="w-full text-end text-xs border border-slate-300 dark:border-slate-700 border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-300 dark:border-slate-700">
                <th className="p-2 border-l border-slate-300 dark:border-slate-700 w-12 text-center">{isRtl ? 'ردیف' : '#'}</th>
                <th className="p-2 border-l border-slate-300 dark:border-slate-700">{isRtl ? 'کد' : 'Code'}</th>
                <th className="p-2 border-l border-slate-300 dark:border-slate-700">{isRtl ? 'نام و نام خانوادگی' : 'Full Name'}</th>
                <th className="p-2 border-l border-slate-300 dark:border-slate-700">{isRtl ? 'شرکت / سمت' : 'Company / Position'}</th>
                <th className="p-2 border-l border-slate-300 dark:border-slate-700">{isRtl ? 'شماره همراه' : 'Mobile'}</th>
                <th className="p-2 border-l border-slate-300 dark:border-slate-700">{isRtl ? 'علت ثبت' : 'Reason'}</th>
                <th className="p-2 border-l border-slate-300 dark:border-slate-700">{isRtl ? 'تاریخ ثبت' : 'Date'}</th>
                <th className="p-2">{isRtl ? 'وضعیت' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((c, idx) => (
                <tr key={c.id} className="border-b border-slate-200 dark:border-slate-700">
                  <td className="p-2 border-l border-slate-300 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                  <td className="p-2 border-l border-slate-300 dark:border-slate-700 font-mono">{c.code}</td>
                  <td className="p-2 border-l border-slate-300 dark:border-slate-700 font-bold">{c.name}</td>
                  <td className="p-2 border-l border-slate-300 dark:border-slate-700">
                    {c.companyName ? `${c.companyName} ${c.jobTitle ? `(${c.jobTitle})` : ''}` : c.jobTitle || '—'}
                  </td>
                  <td className="p-2 border-l border-slate-300 dark:border-slate-700 font-mono" dir="ltr">{c.mobile}</td>
                  <td className="p-2 border-l border-slate-300 dark:border-slate-700">{c.registrationReason || (isRtl ? 'مشتری' : 'Customer')}</td>
                  <td className="p-2 border-l border-slate-300 dark:border-slate-700 font-mono">{formatPersianDate(c.createdAt)}</td>
                  <td className="p-2">{statusBadges[c.status]?.label || c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlobalPrintModal>
    </div>
  );
};
