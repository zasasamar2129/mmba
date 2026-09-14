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
import { GlobalPrintModal } from '../common/GlobalPrintModal';

export interface AccountingDashboardProps {
  currentUser?: User;
}

export const AccountingDashboard: React.FC<AccountingDashboardProps> = ({ currentUser }) => {
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
      warning('حداقل دو سطر برای سند حسابداری دوبل الزامی است.');
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
      error('شرح کلی سند الزامی است.');
      return;
    }

    if (!isEntryBalanced) {
      error(`سند تراز نیست! اختلاف بدهکار و بستانکار: ${balanceDifference.toLocaleString()} ریال`);
      return;
    }

    // Check that every line has an account and at least debit or credit
    for (let i = 0; i < entryLines.length; i++) {
      const line = entryLines[i];
      if (!line.accountId) {
        error(`لطفاً حساب سطر شماره ${i + 1} را انتخاب کنید.`);
        return;
      }
      if (line.debit === 0 && line.credit === 0) {
        error(`سطر شماره ${i + 1} باید دارای مقدار بدهکار یا بستانکار باشد.`);
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

      success('سند حسابداری با موفقیت ثبت قطعی شد.');
      setIsNewEntryModalOpen(false);
      setEntryDescription('');
      setEntryLines([
        { accountId: '', debit: 0, credit: 0, description: '' },
        { accountId: '', debit: 0, credit: 0, description: '' },
      ]);
      refreshData();
    } catch (err: any) {
      error(err.message || 'خطا در ثبت سند');
    }
  };

  // Submit Account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountCode.trim() || !newAccountName.trim()) {
      error('کد و نام حساب الزامی است.');
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

      success(`حساب «${newAccountName}» با موفقیت ذخیره شد.`);
      setIsNewAccountModalOpen(false);
      setNewAccountCode('');
      setNewAccountName('');
      refreshData();
    } catch (err: any) {
      error(err.message || 'خطا در ذخیره حساب');
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
      success(`دوره مالی ${newPeriodYear} ذخیره شد.`);
      setIsNewPeriodModalOpen(false);
      refreshData();
    } catch (err: any) {
      error(err.message || 'خطا در ذخیره دوره مالی');
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
      case AccountType.ASSET: return 'دارایی‌ها';
      case AccountType.LIABILITY: return 'بدهی‌ها';
      case AccountType.EQUITY: return 'حقوق صاحبان سرمایه';
      case AccountType.REVENUE: return 'درآمدها';
      case AccountType.EXPENSE: return 'هزینه‌ها';
      default: return type;
    }
  };

  // Print Journal Entry
  const handlePrintEntry = (entry: JournalEntry) => {
    setPrintTarget({
      isOpen: true,
      title: `سند حسابداری شماره ${entry.entry_number || entry.id}`,
      subtitle: `شرح سند: ${entry.description}`,
      documentNumber: String(entry.entry_number || entry.id),
      documentDate: entry.entry_date || entry.created_at,
      content: (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-slate-500">شماره سند:</span>{' '}
              <strong className="text-slate-900">{entry.entry_number || entry.id}</strong>
            </div>
            <div>
              <span className="text-slate-500">تاریخ سند:</span>{' '}
              <strong className="text-slate-900">{formatPersianDate(entry.entry_date || entry.created_at)}</strong>
            </div>
            <div>
              <span className="text-slate-500">نوع عطف:</span>{' '}
              <strong className="text-slate-900">{entry.reference_type || 'دستی'}</strong>
            </div>
            <div>
              <span className="text-slate-500">تنظیم‌کننده:</span>{' '}
              <strong className="text-slate-900">{entry.created_by_name || 'کاربر سیستم'}</strong>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                <th className="border border-slate-300 dark:border-slate-700 p-2 text-center w-10">ردیف</th>
                <th className="border border-slate-300 dark:border-slate-700 p-2 w-28 text-center">کد حساب</th>
                <th className="border border-slate-300 dark:border-slate-700 p-2">نام حساب</th>
                <th className="border border-slate-300 dark:border-slate-700 p-2">شرح سطر</th>
                <th className="border border-slate-300 dark:border-slate-700 p-2 text-left w-36">بدهکار (ریال)</th>
                <th className="border border-slate-300 dark:border-slate-700 p-2 text-left w-36">بستانکار (ریال)</th>
              </tr>
            </thead>
            <tbody>
              {(entry.lines || []).map((line, idx) => (
                <tr key={line.id || idx}>
                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-center font-mono">{idx + 1}</td>
                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-center font-mono">{line.account_code || '—'}</td>
                  <td className="border border-slate-300 dark:border-slate-700 p-2 font-medium">{line.account_name || '—'}</td>
                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400">{line.description || entry.description}</td>
                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-left font-mono font-bold">
                    {line.debit > 0 ? Number(line.debit).toLocaleString() : '—'}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-left font-mono font-bold">
                    {line.credit > 0 ? Number(line.credit).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100">
                <td colSpan={4} className="border border-slate-300 dark:border-slate-700 p-2 text-right">جمع کل سند (تراز):</td>
                <td className="border border-slate-300 dark:border-slate-700 p-2 text-left font-mono text-emerald-700 dark:text-emerald-400">
                  {Number(entry.totalDebit || 0).toLocaleString()}
                </td>
                <td className="border border-slate-300 dark:border-slate-700 p-2 text-left font-mono text-indigo-700 dark:text-indigo-300">
                  {Number(entry.totalCredit || 0).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-3 gap-4 pt-10 text-center text-xs text-slate-600">
            <div className="border-t border-slate-400 pt-1">امضای تنظیم‌کننده</div>
            <div className="border-t border-slate-400 pt-1">امضای حسابدار مسئول</div>
            <div className="border-t border-slate-400 pt-1">امضای مدیریت مالی</div>
          </div>
        </div>
      ),
    });
  };

  return (
    <div className="space-y-6 text-right animate-blur-fade-up">
      {/* Official Architecture Notice */}
      <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
        <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-bold">پایه‌ریزی ساختار حسابداری دوبل (Accounting Foundation):</strong>
          <p className="mt-0.5">
            سامانه حسابداری هلو (Holo) همچنان مرجع اصلی امور مالی و صدور اسناد نهایی مجموعه است. این بخش زیرساخت حسابداری دوطرفه استاندارد MMBA شامل کدینگ حساب‌ها، دفتر روزنامه و کنترل تراز دقیق بدهکار/بستانکار را جهت آمادگی اتوماسیون آتی فراهم می‌سازد.
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">پایه حسابداری (Accounting Foundation)</h2>
            <p className="text-xs text-slate-500">کدینگ حساب‌ها، دفتر روزنامه دوبل و دوره‌های مالی</p>
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
              ثبت سند دوبل جدید
            </Button>
          )}
          {activeTab === 'ACCOUNTS' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsNewAccountModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              تعریف حساب جدید
            </Button>
          )}
          {activeTab === 'PERIODS' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsNewPeriodModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              تعریف دوره مالی
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
          <span>دفتر روزنامه ({journalEntries.length})</span>
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
          <span>کدینگ حساب‌ها ({accounts.length})</span>
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
          <span>دوره‌های مالی ({periods.length})</span>
        </button>
      </div>

      {/* TAB 1: JOURNAL BOOK */}
      {activeTab === 'JOURNAL' && (
        <div className="space-y-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-12 text-center">شماره</th>
                  <th className="p-3 w-28">تاریخ سند</th>
                  <th className="p-3">شرح سند حسابداری</th>
                  <th className="p-3 w-28 text-center">نوع عطف</th>
                  <th className="p-3 text-left w-36">مجموع بدهکار</th>
                  <th className="p-3 text-left w-36">مجموع بستانکار</th>
                  <th className="p-3 w-24 text-center">وضعیت</th>
                  <th className="p-3 w-28 text-center">عملیات</th>
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
                        <td className="p-3 text-left font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {Number(entry.totalDebit || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {Number(entry.totalCredit || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="success">ثبت قطعی</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                              title="مشاهده سطرهای سند"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintEntry(entry)}
                              className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 transition-colors"
                              title="چاپ سند استاندارد"
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
                                سطرهای آرتیکل سند ({entry.lines?.length || 0} سطر):
                              </h4>
                              <table className="w-full text-xs text-right border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                                  <tr>
                                    <th className="p-2 w-10 text-center">#</th>
                                    <th className="p-2 w-28 text-center">کد حساب</th>
                                    <th className="p-2">نام حساب</th>
                                    <th className="p-2">شرح آرتیکل</th>
                                    <th className="p-2 text-left w-32">بدهکار (ریال)</th>
                                    <th className="p-2 text-left w-32">بستانکار (ریال)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                  {(entry.lines || []).map((line, idx) => (
                                    <tr key={line.id || idx}>
                                      <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                                      <td className="p-2 text-center font-mono">{line.account_code || '—'}</td>
                                      <td className="p-2 font-medium text-slate-800 dark:text-slate-200">{line.account_name || '—'}</td>
                                      <td className="p-2 text-slate-500">{line.description}</td>
                                      <td className="p-2 text-left font-mono text-emerald-600 font-bold">
                                        {line.debit > 0 ? Number(line.debit).toLocaleString() : '—'}
                                      </td>
                                      <td className="p-2 text-left font-mono text-indigo-600 font-bold">
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
                      هنوز سندی در دفتر روزنامه ثبت نشده است. با دکمه «ثبت سند دوبل جدید» اولین سند را صادر کنید.
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
                  <span>سرفصل {getAccountTypeName(typeKey as any)}</span>
                  <Badge variant="indigo">{list.length} حساب</Badge>
                </h3>
              </div>
              <table className="w-full text-right text-xs">
                <thead className="text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3 w-28 text-center">کد حساب</th>
                    <th className="p-3">نام حساب</th>
                    <th className="p-3 w-32 text-center">وضعیت</th>
                    <th className="p-3 w-40">تاریخ ایجاد</th>
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
                          {acc.is_active ? 'فعال' : 'غیرفعال'}
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
                        حسابی در این گروه تعریف نشده است.
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
                    دوره مالی سال {p.period}
                  </h4>
                  <p className="text-xs text-slate-500">
                    از {formatPersianDate(p.start_date)} تا {formatPersianDate(p.end_date)}
                  </p>
                </div>
                <Badge variant={p.status === AccountingPeriodStatus.OPEN ? 'success' : 'danger'}>
                  {p.status === AccountingPeriodStatus.OPEN ? 'دوره مالی باز' : 'بسته شده'}
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
        title="ثبت سند حسابداری دوطرفه (Double-Entry Journal Entry)"
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleSaveJournalEntry} className="space-y-4 text-right">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                شرح سند حسابداری:
              </label>
              <Input
                required
                placeholder="مثال: سند واریز نقدی و تسویه فاکتور مشتری..."
                value={entryDescription}
                onChange={(e) => setEntryDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                تاریخ سند:
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
                سطرهای سند حسابداری (حداقل دو سطر):
              </span>
              <Button type="button" variant="outline" size="sm" onClick={handleAddLine} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                افزودن سطر آرتیکل
              </Button>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2 w-10 text-center">#</th>
                    <th className="p-2 w-64">انتخاب حساب</th>
                    <th className="p-2">شرح سطر</th>
                    <th className="p-2 w-32">بدهکار (ریال)</th>
                    <th className="p-2 w-32">بستانکار (ریال)</th>
                    <th className="p-2 w-12 text-center">حذف</th>
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
                          <option value="">-- انتخاب حساب --</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name} ({getAccountTypeName(a.account_type)})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <Input
                          placeholder="شرح سطر..."
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
                          className="text-xs font-mono p-1.5 text-left"
                          placeholder="0"
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
                          className="text-xs font-mono p-1.5 text-left"
                          placeholder="0"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title="حذف سطر"
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
                  {isEntryBalanced ? 'سند کاملاً تراز است (بدهکار = بستانکار)' : 'سند تراز نیست!'}
                </strong>
                {!isEntryBalanced && (
                  <p className="mt-0.5">
                    اختلاف تراز: {balanceDifference.toLocaleString()} ریال. طبق اصول حسابداری دوبل، مجموع بدهکار و بستانکار باید دقیقاً برابر باشد.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 font-mono font-bold text-sm">
              <div>بدهکار: {totalDebitSum.toLocaleString()}</div>
              <div>بستانکار: {totalCreditSum.toLocaleString()}</div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsNewEntryModalOpen(false)}>
              انصراف
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!isEntryBalanced}
            >
              ثبت قطعی سند حسابداری
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: NEW ACCOUNT */}
      <Modal
        isOpen={isNewAccountModalOpen}
        onClose={() => setIsNewAccountModalOpen(false)}
        title="تعریف حساب جدید در کدینگ"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveAccount} className="space-y-4 text-right">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              کد حساب (عددی):
            </label>
            <Input
              required
              placeholder="مثال: 1104"
              value={newAccountCode}
              onChange={(e) => setNewAccountCode(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              نام حساب:
            </label>
            <Input
              required
              placeholder="مثال: صندوق تنخواه‌گردان دفتر مرکزی"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              سرفصل حساب:
            </label>
            <Select
              value={newAccountType}
              onChange={(e) => setNewAccountType(e.target.value as AccountType)}
            >
              <option value={AccountType.ASSET}>دارایی‌ها (Assets)</option>
              <option value={AccountType.LIABILITY}>بدهی‌ها (Liabilities)</option>
              <option value={AccountType.EQUITY}>حقوق صاحبان سرمایه (Equity)</option>
              <option value={AccountType.REVENUE}>درآمدها (Revenue)</option>
              <option value={AccountType.EXPENSE}>هزینه‌ها (Expense)</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsNewAccountModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" variant="primary" size="sm">
              ذخیره حساب
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: NEW ACCOUNTING PERIOD */}
      <Modal
        isOpen={isNewPeriodModalOpen}
        onClose={() => setIsNewPeriodModalOpen(false)}
        title="تعریف دوره مالی جدید"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSavePeriod} className="space-y-4 text-right">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              سال دوره مالی:
            </label>
            <Input
              required
              placeholder="1404"
              value={newPeriodYear}
              onChange={(e) => setNewPeriodYear(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              تاریخ شروع:
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
              تاریخ پایان:
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
              انصراف
            </Button>
            <Button type="submit" variant="primary" size="sm">
              ذخیره دوره مالی
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
