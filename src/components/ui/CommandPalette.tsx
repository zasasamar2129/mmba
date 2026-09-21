import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Users, PhoneCall, CheckSquare, FileText,
  CreditCard, Smartphone, Wrench, ArrowLeft, X
} from 'lucide-react';
import { storage } from '../../services/storage';
import { canViewTask } from '../../lib/permissions';
import { useTranslation } from '../../lib/i18n';
import { Badge } from './Badge';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: string, itemId?: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const { isRtl } = useTranslation();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery('');
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const currentUser = storage.getCurrentUser();
  const customers = useMemo(() => storage.getCustomers(), [isOpen]);
  const tasks = useMemo(() => storage.getTasks().filter((t) => canViewTask(currentUser, t)), [isOpen, currentUser]);
  const calls = useMemo(() => storage.getCalls(), [isOpen]);
  const payments = useMemo(() => storage.getPayments(), [isOpen]);
  const checks = useMemo(() => storage.getChecks(), [isOpen]);
  const sims = useMemo(() => storage.getSims(), [isOpen]);
  const repairs = useMemo(() => storage.getRepairs(), [isOpen]);
  const contracts = useMemo(() => storage.getContracts(), [isOpen]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: Array<{
      id: string;
      title: string;
      subtitle: string;
      module: string;
      itemId: string;
      icon: React.ReactNode;
      badgeText: string;
      badgeVariant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'amber';
    }> = [];

    // Customers
    customers.forEach((c) => {
      if (
        c.name.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        c.code.toLowerCase().includes(q)
      ) {
        results.push({
          id: `c-${c.id}`,
          title: c.name,
          subtitle: `${c.companyName ? c.companyName + ' • ' : ''}${c.mobile} (${c.code})`,
          module: 'CUSTOMERS',
          itemId: c.id,
          icon: <Users className="w-4 h-4 text-indigo-400" />,
          badgeText: isRtl ? 'مشتری' : 'Customer',
          badgeVariant: 'purple',
        });
      }
    });

    // Tasks
    tasks.forEach((t) => {
      if (
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.customerName && t.customerName.toLowerCase().includes(q))
      ) {
        results.push({
          id: `t-${t.id}`,
          title: t.title,
          subtitle: `${t.customerName ? t.customerName + ' • ' : ''}اولویت: ${t.priority}`,
          module: 'TASKS',
          itemId: t.id,
          icon: <CheckSquare className="w-4 h-4 text-emerald-400" />,
          badgeText: isRtl ? 'وظیفه' : 'Task',
          badgeVariant: 'success',
        });
      }
    });

    // Calls
    calls.forEach((cl) => {
      if (
        cl.subject.toLowerCase().includes(q) ||
        cl.notes.toLowerCase().includes(q) ||
        (cl.customerName && cl.customerName.toLowerCase().includes(q))
      ) {
        results.push({
          id: `cl-${cl.id}`,
          title: cl.subject,
          subtitle: `${cl.customerName || ''} • ${cl.notes.substring(0, 50)}...`,
          module: 'CALLS',
          itemId: cl.id,
          icon: <PhoneCall className="w-4 h-4 text-sky-400" />,
          badgeText: isRtl ? 'تماس' : 'Call',
          badgeVariant: 'info',
        });
      }
    });

    // Repairs
    repairs.forEach((r) => {
      if (
        r.trackingCode.toLowerCase().includes(q) ||
        r.deviceType.toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        r.model.toLowerCase().includes(q) ||
        (r.customerName && r.customerName.toLowerCase().includes(q))
      ) {
        results.push({
          id: `r-${r.id}`,
          title: `${r.brand} ${r.model} (${r.trackingCode})`,
          subtitle: `${r.customerName || ''} • ${r.problemDescription}`,
          module: 'REPAIRS',
          itemId: r.id,
          icon: <Wrench className="w-4 h-4 text-amber-400" />,
          badgeText: isRtl ? 'تعمیرات' : 'Repair',
          badgeVariant: 'amber',
        });
      }
    });

    // SIMs
    sims.forEach((s) => {
      if (
        s.phoneNumber.includes(q) ||
        s.iccid.includes(q) ||
        (s.customerName && s.customerName.toLowerCase().includes(q))
      ) {
        results.push({
          id: `s-${s.id}`,
          title: s.phoneNumber,
          subtitle: `اپراتور: ${s.operator} • ICCID: ${s.iccid}`,
          module: 'SIM_INVENTORY',
          itemId: s.id,
          icon: <Smartphone className="w-4 h-4 text-cyan-400" />,
          badgeText: isRtl ? 'سیم‌کارت' : 'SIM',
          badgeVariant: 'info',
        });
      }
    });

    // Payments & Checks
    payments.forEach((p) => {
      if (
        p.receiptNumber.toLowerCase().includes(q) ||
        (p.customerName && p.customerName.toLowerCase().includes(q)) ||
        (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q))
      ) {
        results.push({
          id: `p-${p.id}`,
          title: `رسید ${p.receiptNumber} (${p.amount.toLocaleString()} تومان)`,
          subtitle: `${p.customerName || ''} • روش: ${p.method}`,
          module: 'PAYMENTS',
          itemId: p.id,
          icon: <CreditCard className="w-4 h-4 text-emerald-400" />,
          badgeText: isRtl ? 'پرداخت' : 'Payment',
          badgeVariant: 'success',
        });
      }
    });

    checks.forEach((chk) => {
      if (
        chk.checkNumber.includes(q) ||
        (chk.sayadNumber && chk.sayadNumber.includes(q)) ||
        (chk.customerName && chk.customerName.toLowerCase().includes(q)) ||
        chk.bankName.toLowerCase().includes(q)
      ) {
        results.push({
          id: `chk-${chk.id}`,
          title: `چک صیادی ${chk.checkNumber} (${chk.bankName})`,
          subtitle: `${chk.customerName || ''} • مبلغ: ${chk.amount.toLocaleString()} تومان`,
          module: 'CHECKS',
          itemId: chk.id,
          icon: <FileText className="w-4 h-4 text-purple-400" />,
          badgeText: isRtl ? 'چک صیادی' : 'Check',
          badgeVariant: 'purple',
        });
      }
    });

    // Contracts
    contracts.forEach((cnt) => {
      if (
        cnt.contractNumber.toLowerCase().includes(q) ||
        cnt.title.toLowerCase().includes(q) ||
        (cnt.customerName && cnt.customerName.toLowerCase().includes(q))
      ) {
        results.push({
          id: `cnt-${cnt.id}`,
          title: `${cnt.title} (${cnt.contractNumber})`,
          subtitle: `${cnt.customerName || ''} • نوع: ${cnt.type}`,
          module: 'CONTRACTS',
          itemId: cnt.id,
          icon: <FileText className="w-4 h-4 text-indigo-400" />,
          badgeText: isRtl ? 'قرارداد' : 'Contract',
          badgeVariant: 'purple',
        });
      }
    });

    return results;
  }, [query, customers, tasks, calls, payments, checks, sims, repairs, contracts]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/85 backdrop-blur-md"
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl z-10 overflow-hidden flex flex-col max-h-[80vh]"
        >
          {/* Search Input Box */}
          <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 gap-3">
            <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isRtl ? 'جستجو در مشتریان، شماره تماس، وظایف، چک‌ها، تعمیرات، سیم‌کارت و...' : 'Search customers, phone numbers, tasks, checks, repairs, SIMs...'}
              className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 text-sm focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-end"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/40 max-h-[60vh]">
            {!query ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <p className="text-sm">{isRtl ? 'برای شروع، عبارت مورد نظر خود را بنویسید' : 'Start typing to search'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-600">
                  {isRtl ? 'جستجوی هوشمند در تمامی بخش‌های سامانه عملیات MMBA' : 'Smart search across all MMBA modules'}
                </p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <p className="text-sm font-semibold">{isRtl ? `نتیجه‌ای برای «${query}» یافت نشد` : `No results for "${query}"`}</p>
                <p className="text-xs text-slate-500">
                  {isRtl ? 'شماره تماس، نام شخص، شماره پیگیری یا موضوع را بررسی کنید' : 'Check the phone number, name, reference or topic'}
                </p>
              </div>
            ) : (
              searchResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.module, item.itemId);
                    onClose();
                  }}
                  className="flex items-center justify-between p-3 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 text-end">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/90 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-600/20 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
                          {item.title}
                        </h4>
                        <Badge variant={item.badgeVariant} size="sm">
                          {item.badgeText}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0 me-2" />
                </div>
              ))
            )}
          </div>

          {/* Footer Shortcuts */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{isRtl ? 'برای خروج کلید ESC را فشار دهید' : 'Press ESC to close'}</span>
            <span>{isRtl ? 'میانبر سریع:' : 'Shortcut:'} Cmd + K / Ctrl + K</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
