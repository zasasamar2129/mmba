import React, { useState, useEffect, useMemo } from 'react';
import {
  Account, JournalEntry, JournalEntryLine, AccountingPeriod,
  AccountType, JournalEntryStatus, AccountingPeriodStatus, User
} from '../../types';
import { storage, subscribeToStorage } from '../../services/storage';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import {
  Scale, Plus, Search, Printer, BookOpen, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, Calendar, Trash2, Edit3,
  FileSpreadsheet, ShieldAlert, Sparkles, Layers, Info
} from 'lucide-react';
import { formatPersianDate } from '../../lib/dateUtils';
import { formatToman } from '../../lib/currencyUtils';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { GlobalPrintModal } from '../common/GlobalPrintModal';

export interface AccountingDashboardProps {
  currentUser?: User;
}

export const AccountingDashboard: React.FC<AccountingDashboardProps> = ({ currentUser }) => {
  const { isRtl } = useTranslation();
  const { success, error, warning } = useToast();
  const [activeTab, setActiveTab] = useState<'JOURNAL' | 'ACCOUNTS' | 'PERIODS'>('JOURNAL');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);

  // Modals
  const [isNewEntryModalOpen, setIsNewEntryModalOpen] = useState(false);
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false);

  // Print state
  const [printTarget, setPrintTarget] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    documentNumber?: string;
    content: React.ReactNode;
  }>({
    isOpen: false,
    title: '',
    content: null,
  });

  // Expanded Journal Entry for lines view
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // New Journal Entry Form State
  const [entryDescription, setEntryDescription] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryRefType, setEntryRefType] = useState('MANUAL');
  const [entryLines, setEntryLines] = useState<Array<{
    accountId: string;
    debit: number;
    credit: number;
    description: string;
  }>>([
    { accountId: '', debit: 0, credit: 0, description: '' },
    { accountId: '', debit: 0, credit: 0, description: '' },
  ]);

  // New Account Form State
  const [newAccountCode, setNewAccountCode] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<AccountType>(AccountType.ASSET);
  const [newAccountParentId, setNewAccountParentId] = useState('');

  // New Period Form State
  const [newPeriodYear, setNewPeriodYear] = useState('1404');
  const [newPeriodStart, setNewPeriodStart] = useState('2025-03-21');
  const [newPeriodEnd, setNewPeriodEnd] = useState('2026-03-20');

  const refreshData = () => {
    setAccounts(storage.getAccounts());
    setJournalEntries(storage.getJournalEntries());
    setPeriods(storage.getAccountingPeriods());
  };

  useEffect(() => {
    refreshData();
    const unsub = subscribeToStorage(() => refreshData());
    return () => unsub();
  }, []);

  // Balance Check Calculation
  const totalDebitSum = entryLines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const totalCreditSum = entryLines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const balanceDifference = Math.abs(totalDebitSum - totalCreditSum);
  const isEntryBalanced = balanceDifference < 0.01 && totalDebitSum > 0;

  // Add line to new entry
  const handleAddLine = () => {
    setEntryLines((prev) => [
      ...prev,
      { accountId: '', debit: 0, credit: 0, description: entryDescription },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (entryLines.length <= 2) {
      warning(isRtl ? 'حداقل دو سطر برای سند حسابداری دوبل الزامی است.' : 'At least two lines are required for a double-entry journal entry.');
      return;
    }
    setEntryLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: string, val: any) => {
    setEntryLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  // Submit Journal Entry
  const handleSaveJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryDescription.trim()) {
      error(isRtl ? 'شرح کلی سند الزامی است.' : 'A general description for the entry is required.');
      return;
    }

    if (!isEntryBalanced) {
      error(isRtl ? `سند تراز نیست! اختلاف بدهکار و بستانکار: ${balanceDifference.toLocaleString()} ریال` : `Entry not balanced! Debit/credit difference: ${balanceDifference.toLocaleString()} Rial`);
      return;
    }

    // Check that every line has an account and at least debit or credit
    for (let i = 0; i < entryLines.length; i++) {
      const line = entryLines[i];
      if (!line.accountId) {
        error(isRtl ? `لطفاً حساب سطر شماره ${i + 1} را انتخاب کنید.` : `Please select an account for line ${i + 1}.`);
        return;
      }
      if (line.debit === 0 && line.credit === 0) {
        error(isRtl ? `سطر شماره ${i + 1} باید دارای مقدار بدهکار یا بستانکار باشد.` : `Line ${i + 1} must have a debit or credit amount.`);
        return;
      }
    }

    try {
      await storage.saveJournalEntry(
        {
          description: entryDescription.trim(),
          entry_date: new Date(entryDate).toISOString(),
          reference_type: entryRefType,
          status: JournalEntryStatus.POSTED,
        },
        entryLines.map((l) => ({
          account_id: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || entryDescription,
        }))
      );

      success(isRtl ? 'سند حسابداری با موفقیت ثبت قطعی شد.' : 'Journal entry posted successfully.');
      setIsNewEntryModalOpen(false);
      setEntryDescription('');
      setEntryLines([
        { accountId: '', debit: 0, credit: 0, description: '' },
        { accountId: '', debit: 0, credit: 0, description: '' },
      ]);
      refreshData();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در ثبت سند' : 'Error posting journal entry'));
    }
  };

  // Submit Account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountCode.trim() || !newAccountName.trim()) {
      error(isRtl ? 'کد و نام حساب الزامی است.' : 'Account code and name are required.');
      return;
    }

    try {
      await storage.saveAccount({
        code: newAccountCode.trim(),
        name: newAccountName.trim(),
        account_type: newAccountType,
        parent_id: newAccountParentId || undefined,
        is_active: true,
      });

      success(isRtl ? `حساب «${newAccountName}» با موفقیت ذخیره شد.` : `Account "${newAccountName}" saved successfully.`);
      setIsNewAccountModalOpen(false);
      setNewAccountCode('');
      setNewAccountName('');
      refreshData();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در ذخیره حساب' : 'Error saving account'));
    }
  };

  // Submit Period
  const handleSavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodYear.trim()) return;

    try {
      await storage.saveAccountingPeriod({
        period: newPeriodYear.trim(),
        start_date: new Date(newPeriodStart).toISOString(),
        end_date: new Date(newPeriodEnd).toISOString(),
        status: AccountingPeriodStatus.OPEN,
      });
      success(isRtl ? `دوره مالی ${newPeriodYear} ذخیره شد.` : `Fiscal period ${newPeriodYear} saved.`);
      setIsNewPeriodModalOpen(false);
      refreshData();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در ذخیره دوره مالی' : 'Error saving fiscal period'));
    }
  };

  // Grouped accounts
  const groupedAccounts = useMemo(() => {
    const map: Record<string, Account[]> = {
      [AccountType.ASSET]: [],
      [AccountType.LIABILITY]: [],
      [AccountType.EQUITY]: [],
      [AccountType.REVENUE]: [],
      [AccountType.EXPENSE]: [],
    };
    accounts.forEach((a) => {
      const type = a.account_type || AccountType.ASSET;
      if (!map[type]) map[type] = [];
      map[type].push(a);
    });
    return map;
  }, [accounts]);

  const getAccountTypeName = (type: AccountType | string) => {
    switch (type) {
      case AccountType.ASSET: return isRtl ? 'دارایی‌ها' : 'Assets';
      case AccountType.LIABILITY: return isRtl ? 'بدهی‌ها' : 'Liabilities';
      case AccountType.EQUITY: return isRtl ? 'حقوق صاحبان سرمایه' : 'Equity';
      case AccountType.REVENUE: return isRtl ? 'درآمدها' : 'Revenue';
      case AccountType.EXPENSE: return isRtl ? 'هزینه‌ها' : 'Expenses';
      default: return type;
    }
  };

  // Print Journal Entry
  const handlePrintEntry = (entry: JournalEntry) => {
    setPrintTarget({
      isOpen: true,
      title: isRtl ? `سند حسابداری شماره ${entry.entry_number || entry.id}` : `Accounting Voucher #${entry.entry_number || entry.id}`,
      subtitle: isRtl ? `شرح سند: ${entry.description}` : `Voucher description: ${entry.description}`,
      documentNumber: String(entry.entry_number || entry.id),
      documentDate: entry.entry_date || entry.created_at,
      content: (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-slate-500">{isRtl ? 'شماره سند:' : 'Entry #'}</span>{' '}
              <strong className="text-slate-900">{entry.entry_number || entry.id}</strong>
            </div>
            <div>
              <span className="text-slate-500">{isRtl ? 'تاریخ سند:' : 'Voucher Date:'}</span>{' '}
              <strong className="text-slate-900">{formatPersianDate(entry.entry_date || entry.created_at)}</strong>
            </div>
            <div>
              <span className="text-slate-500">{isRtl ? 'نوع عطف:' : 'Ref Type:'}</span>{' '}
              <strong className="text-slate-900">{entry.reference_type || (isRtl ? 'دستی' : 'Manual')}</strong>
            </div>
            <div>
              <span className="text-slate-500">{isRtl ? 'تنظیم‌کننده:' : 'Prepared by:'}</span>{' '}
              <strong className="text-slate-900">{entry.created_by_name || (isRtl ? 'کاربر سیستم' : 'System User')}</strong>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                <th className="border border-slate-300 dark:border-slate-700 p-2 text-center w-10">{isRtl ? 'ردیف' : '#'}</th>
                <th className="border border-slate-300 dark:border-slate-700 p-2 w-28 text-center">{isRtl ? 'کد حساب' : 'Acc. Code'}</th>
                <th className="border border-slate-300 dark:border-slate-700 p-2">{isRtl ? 'نام حساب' : 'Account Name'}</th>
                <th className="border border-slate-300 dark:border-slate-700 p-2">{isRtl ? 'شرح سطر' : 'Description'}</th>
                <th className="border border-slate-300 dark:border-slate-700 p-2 text-start w-36">{isRtl ? 'بدهکار (ریال)' : 'Debit (Rial)'}</th>
                <th className="border border-slate-300 dark:border-slate-700 p-2 text-start w-36">{isRtl ? 'بستانکار (ریال)' : 'Credit (Rial)'}</th>
              </tr>
            </thead>
            <tbody>
              {(entry.lines || []).map((line, idx) => (
                <tr key={line.id || idx}>
                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-center font-mono">{idx + 1}</td>
                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-center font-mono">{line.account_code || '—'}</td>
                  <td className="border border-slate-300 dark:border-slate-700 p-2 font-medium">{line.account_name || '—'}</td>
                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400">{line.description || entry.description}</td>
                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-start font-mono font-bold">
                    {line.debit > 0 ? Number(line.debit).toLocaleString() : '—'}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-start font-mono font-bold">
                    {line.credit > 0 ? Number(line.credit).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100">
                <td colSpan={4} className="border border-slate-300 dark:border-slate-700 p-2 text-end">{isRtl ? 'جمع کل سند (تراز):' : 'Total Entry (Balance):'}</td>
                <td className="border border-slate-300 dark:border-slate-700 p-2 text-start font-mono text-emerald-700 dark:text-emerald-400">
                  {Number(entry.totalDebit || 0).toLocaleString()}
                </td>
                <td className="border border-slate-300 dark:border-slate-700 p-2 text-start font-mono text-indigo-700 dark:text-indigo-300">
                  {Number(entry.totalCredit || 0).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-3 gap-4 pt-10 text-center text-xs text-slate-600">
            <div className="border-t border-slate-400 pt-1">{isRtl ? 'امضای تنظیم‌کننده' : "Preparer's Signature"}</div>
            <div className="border-t border-slate-400 pt-1">{isRtl ? 'امضای حسابدار مسئول' : "Chief Accountant's Signature"}</div>
            <div className="border-t border-slate-400 pt-1">{isRtl ? 'امضای مدیریت مالی' : "Finance Management's Signature"}</div>
          </div>
        </div>
      ),
    });
  };

  return (
    <div className="space-y-6 text-end animate-blur-fade-up">
      {/* Official Architecture Notice */}
      <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
        <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-bold">{isRtl ? 'پایه‌ریزی ساختار حسابداری دوبل' : 'Double-Entry Accounting Foundation'}:</strong>
          <p className="mt-0.5">
            {isRtl ? 'سامانه حسابداری هلو (Holo) همچنان مرجع اصلی امور مالی و صدور اسناد نهایی مجموعه است. این بخش زیرساخت حسابداری دوطرفه استاندارد MMBA شامل کدینگ حساب‌ها، دفتر روزنامه و کنترل تراز دقیق بدهکار/بستانکار را جهت آمادگی اتوماسیون آتی فراهم می‌سازد.' : 'Holo accounting remains the main financial reference and source of final vouchers. This section provides the standard MMBA double-entry infrastructure — chart of accounts, journal, and precise debit/credit balance control — readying the system for future automation.'}
          </p>
        </div>
      </div>

      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{isRtl ? 'پایه حسابداری' : 'Accounting Foundation'}</h2>
            <p className="text-xs text-slate-500">{isRtl ? 'کدینگ حساب‌ها، دفتر روزنامه دوبل و دوره‌های مالی' : 'Chart of accounts, double-entry journal and fiscal periods'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'JOURNAL' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsNewEntryModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {isRtl ? 'ثبت سند دوبل جدید' : 'New Double-Entry Voucher'}
            </Button>
          )}
          {activeTab === 'ACCOUNTS' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsNewAccountModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {isRtl ? 'تعریف حساب جدید' : 'New Account'}
            </Button>
          )}
          {activeTab === 'PERIODS' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsNewPeriodModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {isRtl ? 'تعریف دوره مالی' : 'New Fiscal Period'}
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('JOURNAL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'JOURNAL'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>{isRtl ? 'دفتر روزنامه' : 'Journal'} ({journalEntries.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ACCOUNTS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'ACCOUNTS'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{isRtl ? 'کدینگ حساب‌ها' : 'Chart of Accounts'} ({accounts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PERIODS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'PERIODS'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{isRtl ? 'دوره‌های مالی' : 'Fiscal Periods'} ({periods.length})</span>
        </button>
      </div>

      {/* TAB 1: JOURNAL BOOK */}
      {activeTab === 'JOURNAL' && (
        <div className="space-y-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full text-end text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-12 text-center">{isRtl ? 'شماره' : '#'}</th>
                  <th className="p-3 w-28">{isRtl ? 'تاریخ سند' : 'Date'}</th>
                  <th className="p-3">{isRtl ? 'شرح سند حسابداری' : 'Description'}</th>
                  <th className="p-3 w-28 text-center">{isRtl ? 'نوع عطف' : 'Ref Type'}</th>
                  <th className="p-3 text-start w-36">{isRtl ? 'مجموع بدهکار' : 'Total Debit'}</th>
                  <th className="p-3 text-start w-36">{isRtl ? 'مجموع بستانکار' : 'Total Credit'}</th>
                  <th className="p-3 w-24 text-center">{isRtl ? 'وضعیت' : 'Status'}</th>
                  <th className="p-3 w-28 text-center">{isRtl ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {journalEntries.map((entry) => {
                  const isExpanded = expandedEntryId === entry.id;
                  return (
                    <React.Fragment key={entry.id}>
                      <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                          {entry.entry_number || entry.id}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {formatPersianDate(entry.entry_date || entry.created_at)}
                        </td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          {entry.description}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="indigo">{entry.reference_type || 'MANUAL'}</Badge>
                        </td>
                        <td className="p-3 text-start font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {Number(entry.totalDebit || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-start font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {Number(entry.totalCredit || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="success">{isRtl ? 'ثبت قطعی' : 'Posted'}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                              title={isRtl ? 'مشاهده سطرهای سند' : 'View entry lines'}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintEntry(entry)}
                              className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 transition-colors"
                              title={isRtl ? 'چاپ سند استاندارد' : 'Print standard entry'}
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Lines */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-950/60">
                          <td colSpan={8} className="p-4 border-t border-b border-indigo-100 dark:border-indigo-900/40">
                            <div className="space-y-2">
                              <h4 className="font-bold text-xs text-indigo-900 dark:text-indigo-300">
                                {isRtl ? 'سطرهای آرتیکل سند' : 'Voucher Article Lines'} ({entry.lines?.length || 0} {isRtl ? 'سطر' : 'lines'}):
                              </h4>
                              <table className="w-full text-xs text-end border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                                  <tr>
                                    <th className="p-2 w-10 text-center">#</th>
                                    <th className="p-2 w-28 text-center">{isRtl ? 'کد حساب' : 'Code'}</th>
                                    <th className="p-2">{isRtl ? 'نام حساب' : 'Name'}</th>
                                    <th className="p-2">{isRtl ? 'شرح آرتیکل' : 'Description'}</th>
                                    <th className="p-2 text-start w-32">{isRtl ? 'بدهکار (ریال)' : 'Debit (Rial)'}</th>
                                    <th className="p-2 text-start w-32">{isRtl ? 'بستانکار (ریال)' : 'Credit (Rial)'}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                  {(entry.lines || []).map((line, idx) => (
                                    <tr key={line.id || idx}>
                                      <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                                      <td className="p-2 text-center font-mono">{line.account_code || '—'}</td>
                                      <td className="p-2 font-medium text-slate-800 dark:text-slate-200">{line.account_name || '—'}</td>
                                      <td className="p-2 text-slate-500">{line.description}</td>
                                      <td className="p-2 text-start font-mono text-emerald-600 font-bold">
                                        {line.debit > 0 ? Number(line.debit).toLocaleString() : '—'}
                                      </td>
                                      <td className="p-2 text-start font-mono text-indigo-600 font-bold">
                                        {line.credit > 0 ? Number(line.credit).toLocaleString() : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {journalEntries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      {isRtl ? 'هنوز سندی در دفتر روزنامه ثبت نشده است. با دکمه «ثبت سند دوبل جدید» اولین سند را صادر کنید.' : 'No vouchers in the journal yet. Use "New Double-Entry Voucher" to issue the first one.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CHART OF ACCOUNTS */}
      {activeTab === 'ACCOUNTS' && (
        <div className="space-y-6">
          {(Object.entries(groupedAccounts) as [string, Account[]][]).map(([typeKey, list]) => (
            <div key={typeKey} className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
              <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{isRtl ? 'سرفصل' : 'Category'} {getAccountTypeName(typeKey as any)}</span>
                  <Badge variant="indigo">{list.length} {isRtl ? 'حساب' : 'accounts'}</Badge>
                </h3>
              </div>
              <table className="w-full text-end text-xs">
                <thead className="text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3 w-28 text-center">{isRtl ? 'کد حساب' : 'Code'}</th>
                    <th className="p-3">{isRtl ? 'نام حساب' : 'Name'}</th>
                    <th className="p-3 w-32 text-center">{isRtl ? 'وضعیت' : 'Status'}</th>
                    <th className="p-3 w-40">{isRtl ? 'تاریخ ایجاد' : 'Created'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {list.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {acc.code}
                      </td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">
                        {acc.name}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={acc.is_active ? 'success' : 'danger'}>
                          {acc.is_active ? (isRtl ? 'فعال' : 'Active') : (isRtl ? 'غیرفعال' : 'Inactive')}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-500">
                        {formatPersianDate(acc.created_at)}
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400">
                        {isRtl ? 'حسابی در این گروه تعریف نشده است.' : 'No accounts defined in this group.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: ACCOUNTING PERIODS */}
      {activeTab === 'PERIODS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {periods.map((p) => (
              <div
                key={p.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                    {isRtl ? 'دوره مالی سال' : 'Fiscal Year'} {p.period}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {isRtl ? 'از' : 'From'} {formatPersianDate(p.start_date)} {isRtl ? 'تا' : 'to'} {formatPersianDate(p.end_date)}
                  </p>
                </div>
                <Badge variant={p.status === AccountingPeriodStatus.OPEN ? 'success' : 'danger'}>
                  {p.status === AccountingPeriodStatus.OPEN ? (isRtl ? 'دوره مالی باز' : 'Open Period') : (isRtl ? 'بسته شده' : 'Closed')}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: NEW DOUBLE-ENTRY JOURNAL ENTRY */}
      <Modal
        isOpen={isNewEntryModalOpen}
        onClose={() => setIsNewEntryModalOpen(false)}
        title={isRtl ? 'ثبت سند حسابداری دوطرفه' : 'Double-Entry Journal Entry'}
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleSaveJournalEntry} className="space-y-4 text-end">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isRtl ? 'شرح سند حسابداری:' : 'Voucher Description:'}
              </label>
              <Input
                required
                placeholder={isRtl ? 'مثال: سند واریز نقدی و تسویه فاکتور مشتری...' : 'e.g. Cash deposit and customer invoice settlement...'}
                value={entryDescription}
                onChange={(e) => setEntryDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isRtl ? 'تاریخ سند:' : 'Voucher Date:'}
              </label>
              <Input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
          </div>

          {/* Dynamic Lines Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isRtl ? 'سطرهای سند حسابداری (حداقل دو سطر):' : 'Voucher Lines (minimum two):'}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={handleAddLine} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                {isRtl ? 'افزودن سطر آرتیکل' : 'Add Article Line'}
              </Button>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-end text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2 w-10 text-center">#</th>
                    <th className="p-2 w-64">{isRtl ? 'انتخاب حساب' : 'Account'}</th>
                    <th className="p-2">{isRtl ? 'شرح سطر' : 'Description'}</th>
                    <th className="p-2 w-32">{isRtl ? 'بدهکار (ریال)' : 'Debit'}</th>
                    <th className="p-2 w-32">{isRtl ? 'بستانکار (ریال)' : 'Credit'}</th>
                    <th className="p-2 w-12 text-center">{isRtl ? 'حذف' : 'Del'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {entryLines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-2">
                        <select
                          required
                          value={line.accountId}
                          onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                          className="w-full p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                        >
                          <option value="">-- {isRtl ? 'انتخاب حساب' : 'Select account'} --</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name} ({getAccountTypeName(a.account_type)})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <Input
                          placeholder={isRtl ? 'شرح سطر...' : 'Line description...'}
                          value={line.description}
                          onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                          className="text-xs p-1.5"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          value={line.debit || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            handleLineChange(idx, 'debit', val);
                            if (val > 0) handleLineChange(idx, 'credit', 0);
                          }}
                          className="text-xs font-mono p-1.5 text-start"
                          placeholder={isRtl ? '۰' : '0'}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          value={line.credit || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            handleLineChange(idx, 'credit', val);
                            if (val > 0) handleLineChange(idx, 'debit', 0);
                          }}
                          className="text-xs font-mono p-1.5 text-start"
                          placeholder={isRtl ? '۰' : '0'}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title={isRtl ? 'حذف سطر' : 'Remove line'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Strict Balance Bar */}
          <div className={`p-4 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
            isEntryBalanced
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {isEntryBalanced ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <div>
                <strong className="font-bold">
                  {isEntryBalanced ? (isRtl ? 'سند کاملاً تراز است (بدهکار = بستانکار)' : 'Entry is balanced (Debit = Credit)') : (isRtl ? 'سند تراز نیست!' : 'Entry is NOT balanced!')}
                </strong>
                {!isEntryBalanced && (
                  <p className="mt-0.5">
                    {isRtl ? `اختلاف تراز: ${balanceDifference.toLocaleString()} ریال. طبق اصول حسابداری دوبل، مجموع بدهکار و بستانکار باید دقیقاً برابر باشد.` : `Balance difference: ${balanceDifference.toLocaleString()} Rial. In double-entry accounting, total debit and credit must match exactly.`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 font-mono font-bold text-sm">
              <div>{isRtl ? 'بدهکار:' : 'Debit:'} {totalDebitSum.toLocaleString()}</div>
              <div>{isRtl ? 'بستانکار:' : 'Credit:'} {totalCreditSum.toLocaleString()}</div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsNewEntryModalOpen(false)}>
              {isRtl ? 'انصراف' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!isEntryBalanced}
            >
              {isRtl ? 'ثبت قطعی سند حسابداری' : 'Post Voucher'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: NEW ACCOUNT */}
      <Modal
        isOpen={isNewAccountModalOpen}
        onClose={() => setIsNewAccountModalOpen(false)}
        title={isRtl ? 'تعریف حساب جدید در کدینگ' : 'Add New Account to Chart of Accounts'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveAccount} className="space-y-4 text-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'کد حساب (عددی):' : 'Account Code (numeric):'}
            </label>
            <Input
              required
              placeholder={isRtl ? 'مثال: 1104' : 'e.g. 1104'}
              value={newAccountCode}
              onChange={(e) => setNewAccountCode(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'نام حساب:' : 'Account Name:'}
            </label>
            <Input
              required
              placeholder={isRtl ? 'مثال: صندوق تنخواه‌گردان دفتر مرکزی' : 'e.g. Petty cash - head office'}
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'سرفصل حساب:' : 'Account Type:'}
            </label>
            <Select
              value={newAccountType}
              onChange={(e) => setNewAccountType(e.target.value as AccountType)}
            >
              <option value={AccountType.ASSET}>{isRtl ? 'دارایی‌ها' : 'Assets'}</option>
              <option value={AccountType.LIABILITY}>{isRtl ? 'بدهی‌ها' : 'Liabilities'}</option>
              <option value={AccountType.EQUITY}>{isRtl ? 'حقوق صاحبان سرمایه' : 'Equity'}</option>
              <option value={AccountType.REVENUE}>{isRtl ? 'درآمدها' : 'Revenue'}</option>
              <option value={AccountType.EXPENSE}>{isRtl ? 'هزینه‌ها' : 'Expenses'}</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsNewAccountModalOpen(false)}>
              {isRtl ? 'انصراف' : 'Cancel'}
            </Button>
            <Button type="submit" variant="primary" size="sm">
              {isRtl ? 'ذخیره حساب' : 'Save Account'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: NEW ACCOUNTING PERIOD */}
      <Modal
        isOpen={isNewPeriodModalOpen}
        onClose={() => setIsNewPeriodModalOpen(false)}
        title={isRtl ? 'تعریف دوره مالی جدید' : 'Add New Fiscal Period'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSavePeriod} className="space-y-4 text-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'سال دوره مالی:' : 'Fiscal Year:'}
            </label>
            <Input
              required
              placeholder={isRtl ? '۱۴۰۴' : '1404'}
              value={newPeriodYear}
              onChange={(e) => setNewPeriodYear(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'تاریخ شروع:' : 'Start Date:'}
            </label>
            <Input
              type="date"
              required
              value={newPeriodStart}
              onChange={(e) => setNewPeriodStart(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'تاریخ پایان:' : 'End Date:'}
            </label>
            <Input
              type="date"
              required
              value={newPeriodEnd}
              onChange={(e) => setNewPeriodEnd(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsNewPeriodModalOpen(false)}>
              {isRtl ? 'انصراف' : 'Cancel'}
            </Button>
            <Button type="submit" variant="primary" size="sm">
              {isRtl ? 'ذخیره دوره مالی' : 'Save Fiscal Period'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Global Print Modal for Journal Entry */}
      <GlobalPrintModal
        isOpen={printTarget.isOpen}
        onClose={() => setPrintTarget((p) => ({ ...p, isOpen: false }))}
        title={printTarget.title}
        subtitle={printTarget.subtitle}
        documentNumber={printTarget.documentNumber}
        documentDate={printTarget.documentDate}
      >
        {printTarget.content}
      </GlobalPrintModal>
    </div>
  );
};
