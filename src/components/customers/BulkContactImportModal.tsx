import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
  Upload, FileSpreadsheet, Contact, CheckCircle2, AlertTriangle, XCircle,
  ArrowRight, Check, RefreshCw, FileText, Sparkles, Filter, HelpCircle, Eye
} from 'lucide-react';
import { Customer, CustomerStatus, ContactImportRow, ContactImportMetadata } from '../../types';
import { normalizePhoneNumber } from '../../lib/numberUtils';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';

export interface BulkContactImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const BulkContactImportModal: React.FC<BulkContactImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const { success, error, warning } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'UPLOAD' | 'PREVIEW' | 'SUMMARY'>('UPLOAD');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'XLSX' | 'CSV' | 'VCF'>('XLSX');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  // Parsed and validated rows
  const [rows, setRows] = useState<ContactImportRow[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'NEW' | 'DUPLICATE' | 'INVALID'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  // Duplicate Strategy
  const [duplicateStrategy, setDuplicateStrategy] = useState<'SKIP' | 'UPDATE' | 'IMPORT_AS_NEW'>('SKIP');
  const [defaultReason, setDefaultReason] = useState('مشتری');

  // Summary Metadata
  const [summary, setSummary] = useState<ContactImportMetadata | null>(null);

  const resetState = () => {
    setStep('UPLOAD');
    setFileName('');
    setRows([]);
    setSummary(null);
    setFilterTab('ALL');
    setSearchFilter('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ----------------------------------------------------
  // VCF / vCard Parser
  // ----------------------------------------------------
  const parseVcard = (text: string): Partial<Customer>[] => {
    const contacts: Partial<Customer>[] = [];
    const vcards = text.split(/END:VCARD/i);

    for (const raw of vcards) {
      if (!raw.includes('BEGIN:VCARD')) continue;
      let name = '';
      let mobile = '';
      let phone = '';
      let email = '';
      let companyName = '';
      let jobTitle = '';
      let notes = '';

      const lines = raw.split(/\r\n|\r|\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // FN (Formatted Name)
        if (trimmed.startsWith('FN:') || trimmed.startsWith('FN;')) {
          const val = trimmed.substring(trimmed.indexOf(':') + 1).trim();
          if (val) name = val;
        } else if (!name && (trimmed.startsWith('N:') || trimmed.startsWith('N;'))) {
          // N:LastName;FirstName;Middle;Prefix;Suffix
          const val = trimmed.substring(trimmed.indexOf(':') + 1).trim();
          const parts = val.split(';').map((p) => p.trim()).filter(Boolean);
          if (parts.length > 0) name = parts.reverse().join(' ');
        } else if (trimmed.startsWith('TEL')) {
          const val = trimmed.substring(trimmed.indexOf(':') + 1).trim().replace(/[^\d+]/g, '');
          if (!mobile) {
            mobile = val;
          } else if (!phone) {
            phone = val;
          }
        } else if (trimmed.startsWith('EMAIL')) {
          const val = trimmed.substring(trimmed.indexOf(':') + 1).trim();
          if (!email) email = val;
        } else if (trimmed.startsWith('ORG')) {
          const val = trimmed.substring(trimmed.indexOf(':') + 1).trim();
          if (!companyName) companyName = val.split(';')[0]?.trim() || val;
        } else if (trimmed.startsWith('TITLE')) {
          const val = trimmed.substring(trimmed.indexOf(':') + 1).trim();
          if (!jobTitle) jobTitle = val;
        } else if (trimmed.startsWith('NOTE')) {
          const val = trimmed.substring(trimmed.indexOf(':') + 1).trim();
          if (!notes) notes = val;
        }
      }

      if (name || mobile) {
        contacts.push({
          name: name || 'مخاطب بدون نام',
          mobile: mobile || '',
          phone: phone || '',
          email: email || '',
          companyName: companyName || '',
          jobTitle: jobTitle || '',
          notes: notes || '',
        });
      }
    }

    return contacts;
  };

  // ----------------------------------------------------
  // Excel / CSV Parser
  // ----------------------------------------------------
  const parseSpreadsheet = (data: ArrayBuffer): Partial<Customer>[] => {
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    const contacts: Partial<Customer>[] = [];

    for (const r of jsonRows) {
      // Intelligently find columns regardless of exact English or Persian spelling
      let name = '';
      let mobile = '';
      let phone = '';
      let email = '';
      let companyName = '';
      let jobTitle = '';
      let notes = '';
      let registrationReason = defaultReason;

      for (const [key, val] of Object.entries(r)) {
        const k = key.toString().trim().toLowerCase();
        const v = String(val).trim();
        if (!v) continue;

        if (k.includes('نام و') || k.includes('name') || k === 'نام' || k === 'full name' || k === 'fullname') {
          name = v;
        } else if (k.includes('موبایل') || k.includes('mobile') || k.includes('همراه') || k.includes('cell') || k === 'شماره') {
          mobile = v;
        } else if (k.includes('تلفن') || k.includes('phone') || k.includes('ثابت')) {
          phone = v;
        } else if (k.includes('ایمیل') || k.includes('email') || k.includes('mail')) {
          email = v;
        } else if (k.includes('شرکت') || k.includes('company') || k.includes('سازمان') || k.includes('مجموعه')) {
          companyName = v;
        } else if (k.includes('سمت') || k.includes('job') || k.includes('عنوان') || k.includes('title') || k.includes('شغل')) {
          jobTitle = v;
        } else if (k.includes('دلیل') || k.includes('علت') || k.includes('reason')) {
          registrationReason = v;
        } else if (k.includes('توضیح') || k.includes('یادداشت') || k.includes('note') || k.includes('notes')) {
          notes = v;
        }
      }

      if (name || mobile) {
        contacts.push({
          name: name || 'مخاطب بدون نام',
          mobile: mobile || '',
          phone: phone || '',
          email: email || '',
          companyName: companyName || '',
          jobTitle: jobTitle || '',
          notes: notes || '',
          registrationReason,
        });
      }
    }

    return contacts;
  };

  // ----------------------------------------------------
  // Process File & Duplicate Detection
  // ----------------------------------------------------
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setFileName(file.name);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let rawContacts: Partial<Customer>[] = [];

      if (ext === 'vcf' || ext === 'vcard') {
        setFileType('VCF');
        const text = await file.text();
        rawContacts = parseVcard(text);
      } else {
        setFileType(ext === 'csv' ? 'CSV' : 'XLSX');
        const buffer = await file.arrayBuffer();
        rawContacts = parseSpreadsheet(buffer);
      }

      if (rawContacts.length === 0) {
        throw new Error('هیچ مخاطب معتبری در فایل مورد نظر یافت نشد.');
      }

      // Existing contacts for duplicate validation
      const existingCustomers = storage.getCustomers();
      const existingMobileMap = new Map<string, Customer>();
      existingCustomers.forEach((c) => {
        const norm = normalizePhoneNumber(c.mobile);
        if (norm) existingMobileMap.set(norm, c);
        const normPhone = normalizePhoneNumber(c.phone);
        if (normPhone) existingMobileMap.set(normPhone, c);
      });

      // Internal batch duplicate tracking (same file duplicates)
      const seenInBatch = new Set<string>();

      const validatedRows: ContactImportRow[] = rawContacts.map((raw, idx) => {
        const normMobile = normalizePhoneNumber(raw.mobile);
        const nameClean = (raw.name || '').trim();

        // 1. Validation Check
        if (!nameClean) {
          return {
            rowNumber: idx + 1,
            data: raw,
            status: 'INVALID',
            reason: 'نام مخاطب خالی است',
          };
        }

        if (!raw.mobile || !raw.mobile.trim()) {
          return {
            rowNumber: idx + 1,
            data: raw,
            status: 'INVALID',
            reason: 'شماره موبایل ثبت نشده است',
          };
        }

        if (!normMobile || normMobile.length < 10) {
          return {
            rowNumber: idx + 1,
            data: raw,
            status: 'INVALID',
            reason: `فرمت شماره موبایل نامعتبر است (${raw.mobile})`,
          };
        }

        // 2. Batch Duplicate Check
        if (seenInBatch.has(normMobile)) {
          return {
            rowNumber: idx + 1,
            data: raw,
            status: 'DUPLICATE',
            reason: 'شماره در سطرهای قبلی همین فایل تکرار شده است',
            normalizedMobile: normMobile,
          };
        }
        seenInBatch.add(normMobile);

        // 3. Existing DB Duplicate Check
        const existingDuplicate = existingMobileMap.get(normMobile);
        if (existingDuplicate) {
          return {
            rowNumber: idx + 1,
            data: raw,
            status: 'DUPLICATE',
            reason: `از قبل با نام «${existingDuplicate.name}» در سامانه ثبت شده است`,
            existingCustomerId: existingDuplicate.id,
            existingCustomerName: existingDuplicate.name,
            normalizedMobile: normMobile,
          };
        }

        // 4. Clean New Contact
        return {
          rowNumber: idx + 1,
          data: {
            ...raw,
            mobile: normMobile,
            registrationReason: raw.registrationReason || defaultReason,
          },
          status: 'NEW',
          normalizedMobile: normMobile,
        };
      });

      setRows(validatedRows);
      setStep('PREVIEW');
      success(`تعداد ${validatedRows.length} ردیف با موفقیت خوانده و اعتبارسنجی شد.`);
    } catch (err: any) {
      console.error('Import Error:', err);
      error(err.message || 'خطا در خواندن فایل');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------
  // Execute Import
  // ----------------------------------------------------
  const handleExecuteImport = async () => {
    setIsProcessingImport(true);
    try {
      let successCount = 0;
      let duplicateCount = 0;
      let invalidCount = 0;
      let skipCount = 0;
      let updateCount = 0;

      const existingCustomers = storage.getCustomers();

      for (const row of rows) {
        if (row.status === 'INVALID') {
          invalidCount++;
          continue;
        }

        if (row.status === 'DUPLICATE') {
          duplicateCount++;
          if (duplicateStrategy === 'SKIP') {
            skipCount++;
            continue;
          }

          if (duplicateStrategy === 'UPDATE' && row.existingCustomerId) {
            const existing = existingCustomers.find((c) => c.id === row.existingCustomerId);
            if (existing) {
              storage.saveCustomer({
                ...existing,
                companyName: row.data.companyName || existing.companyName,
                jobTitle: row.data.jobTitle || existing.jobTitle,
                email: row.data.email || existing.email,
                phone: row.data.phone || existing.phone,
                notes: row.data.notes ? `${existing.notes || ''}\n[بروزرسانی از فایل]: ${row.data.notes}` : existing.notes,
                updatedAt: new Date().toISOString(),
              }, true);
              updateCount++;
              continue;
            }
          }
        }

        // Import as new contact
        try {
          storage.saveCustomer({
            id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            code: `CUST-${1040 + existingCustomers.length + successCount + 1}`,
            name: row.data.name || 'مخاطب جدید',
            mobile: row.normalizedMobile || row.data.mobile || '',
            phone: row.data.phone || '',
            email: row.data.email || '',
            companyName: row.data.companyName || '',
            jobTitle: row.data.jobTitle || '',
            city: 'تهران',
            status: CustomerStatus.ACTIVE,
            registrationReason: row.data.registrationReason || defaultReason,
            notes: row.data.notes || `ثبت از فایل اکسل/vCard: ${fileName}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }, true);
          successCount++;
        } catch (e) {
          invalidCount++;
        }
      }

      const meta: ContactImportMetadata = {
        fileName,
        importedBy: storage.getCurrentUser().name,
        importedAt: new Date().toISOString(),
        totalRows: rows.length,
        successCount,
        duplicateCount,
        invalidCount,
        skipCount,
        updateCount,
      };

      setSummary(meta);
      setStep('SUMMARY');
      onImportComplete();
      success(`ورود اطلاعات با موفقیت انجام شد (${successCount} مخاطب جدید).`);
    } catch (err: any) {
      error(err.message || 'خطا در پردازش ورود گروهی');
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Row filtering for preview table
  const filteredRows = rows.filter((r) => {
    if (filterTab !== 'ALL' && r.status !== filterTab) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const n = (r.data.name || '').toLowerCase();
      const m = (r.data.mobile || '').toLowerCase();
      const c = (r.data.companyName || '').toLowerCase();
      return n.includes(q) || m.includes(q) || c.includes(q);
    }
    return true;
  });

  const totalNew = rows.filter((r) => r.status === 'NEW').length;
  const totalDuplicate = rows.filter((r) => r.status === 'DUPLICATE').length;
  const totalInvalid = rows.filter((r) => r.status === 'INVALID').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="ورود گروهی مخاطبان (Excel / CSV / vCard)"
      maxWidth="max-w-4xl"
    >
      {/* Step 1: Upload */}
      {step === 'UPLOAD' && (
        <div className="space-y-6 text-right">
          <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">راهنمای بارگذاری گروهی:</p>
              <p>شما می‌توانید فایل مخاطبان گوشی خود با فرمت <strong>VCF (vCard)</strong> یا فایل‌های <strong>Excel (.xlsx, .xls)</strong> و <strong>CSV</strong> را مستقیماً وارد کنید. سامانه به‌طور خودکار شماره‌های تکراری را شناسایی کرده و نام‌های فارسی و کاراکترهای یونیکد را پشتیبانی می‌کند.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                علت پیش‌فرض ثبت مخاطبان این فایل:
              </label>
              <Select
                value={defaultReason}
                onChange={(e) => setDefaultReason(e.target.value)}
              >
                <option value="مشتری">مشتری</option>
                <option value="مشتری بالقوه">مشتری بالقوه</option>
                <option value="همکار">همکار</option>
                <option value="تأمین‌کننده">تأمین‌کننده</option>
                <option value="دوست/آشنا">دوست / آشنا</option>
                <option value="تماس کاری">تماس کاری</option>
                <option value="پیگیری فروش">پیگیری فروش</option>
                <option value="سایر">سایر</option>
              </Select>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-3xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50 group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.vcf,.vcard"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />

            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
              {isLoading ? (
                <RefreshCw className="w-8 h-8 animate-spin" />
              ) : (
                <Upload className="w-8 h-8" />
              )}
            </div>

            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
              کلیک برای انتخاب فایل یا رها کردن فایل در این ناحیه
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              فرمت‌های مجاز: Excel (.xlsx, .xls), CSV, vCard (.vcf)
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Preview & Duplicate Handling */}
      {step === 'PREVIEW' && (
        <div className="space-y-4 text-right">
          {/* Top Status & Duplicate Options */}
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>فایل: {fileName}</span>
                <Badge variant="indigo">{fileType}</Badge>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                تعداد کل: {rows.length} | جدید: {totalNew} | تکراری: {totalDuplicate} | نامعتبر: {totalInvalid}
              </div>
            </div>

            {/* Duplicate Handling Selector */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-300">رفتار با تکراری‌ها:</span>
              <select
                value={duplicateStrategy}
                onChange={(e) => setDuplicateStrategy(e.target.value as any)}
                className="bg-transparent font-bold text-indigo-600 dark:text-indigo-400 outline-none cursor-pointer"
              >
                <option value="SKIP">رد کردن تکراری‌ها (پیش‌فرض)</option>
                <option value="UPDATE">بروزرسانی مخاطب موجود</option>
                <option value="IMPORT_AS_NEW">ثبت به‌عنوان مخاطب جدید</option>
              </select>
            </div>
          </div>

          {/* Filter Chips & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterTab('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  filterTab === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                همه ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('NEW')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  filterTab === 'NEW'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                جدید ({totalNew})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('DUPLICATE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  filterTab === 'DUPLICATE'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400'
                }`}
              >
                تکراری ({totalDuplicate})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('INVALID')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  filterTab === 'INVALID'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400'
                }`}
              >
                نامعتبر ({totalInvalid})
              </button>
            </div>

            <div className="w-full sm:w-64">
              <Input
                placeholder="جستجو در پیش‌نمایش..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Preview Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[46vh] overflow-y-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-12 text-center">ردیف</th>
                  <th className="p-3 w-28">وضعیت</th>
                  <th className="p-3">نام مخاطب</th>
                  <th className="p-3">شماره موبایل</th>
                  <th className="p-3">شرکت / سمت</th>
                  <th className="p-3">توضیح اعتبارسنجی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredRows.map((row) => (
                  <tr key={row.rowNumber} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 text-center text-slate-400 font-mono">{row.rowNumber}</td>
                    <td className="p-3">
                      {row.status === 'NEW' && <Badge variant="success">جدید</Badge>}
                      {row.status === 'DUPLICATE' && <Badge variant="warning">تکراری</Badge>}
                      {row.status === 'INVALID' && <Badge variant="danger">نامعتبر</Badge>}
                    </td>
                    <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{row.data.name || '—'}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300 dir-ltr text-right">{row.normalizedMobile || row.data.mobile || '—'}</td>
                    <td className="p-3 text-slate-500">
                      {row.data.companyName || ''} {row.data.jobTitle ? `(${row.data.jobTitle})` : ''}
                      {!row.data.companyName && !row.data.jobTitle && '—'}
                    </td>
                    <td className="p-3 text-slate-500 text-[11px]">
                      {row.reason ? (
                        <span className={row.status === 'INVALID' ? 'text-rose-500 font-medium' : 'text-amber-600'}>
                          {row.reason}
                        </span>
                      ) : (
                        <span className="text-emerald-600">آماده برای ورود</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      موردی با فیلتر انتخاب شده یافت نشد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={resetState}>
              انتخاب فایل دیگر
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleExecuteImport}
              isLoading={isProcessingImport}
              disabled={isProcessingImport || totalNew + totalDuplicate === 0}
              leftIcon={<Check className="w-4 h-4" />}
            >
              تأیید و اجرای ورود مخاطبان
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Summary */}
      {step === 'SUMMARY' && summary && (
        <div className="space-y-6 text-right">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="text-center">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              عملیات ورود اطلاعات با موفقیت انجام شد
            </h3>
            <p className="text-xs text-slate-500">
              مخاطبان جدید به دفترچه مخاطبان MMBA اضافه شدند.
            </p>
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-xl font-bold text-slate-900 dark:text-white">{summary.totalRows}</div>
              <div className="text-xs text-slate-500 mt-0.5">کل ردیف‌ها</div>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{summary.successCount}</div>
              <div className="text-xs text-emerald-600/80 mt-0.5">مخاطب جدید</div>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{summary.duplicateCount}</div>
              <div className="text-xs text-amber-600/80 mt-0.5">
                تکراری ({summary.skipCount > 0 ? `${summary.skipCount} رد شد` : `${summary.updateCount} بروز شد`})
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center">
              <div className="text-xl font-bold text-rose-600 dark:text-rose-400">{summary.invalidCount}</div>
              <div className="text-xs text-rose-600/80 mt-0.5">ردیف نامعتبر</div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <Button variant="primary" size="md" onClick={handleClose}>
              مشاهده فهرست مخاطبان
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
