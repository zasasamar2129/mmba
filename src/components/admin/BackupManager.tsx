import React, { useState, useEffect, useRef } from 'react';
import {
  Database, ShieldCheck, Download, Trash2, RotateCcw, CheckCircle2,
  AlertTriangle, Clock, RefreshCw, HardDrive, Calendar, FileText,
  Lock, AlertCircle, ArrowUpRight, Activity, Plus, Check, Play,
  FileCheck, ShieldAlert, Cpu, Sparkles, FolderArchive, Layers, Info,
  UploadCloud, CreditCard, Image, FileCheck2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { api } from '../../services/api';
import {
  BackupItem, BackupHealthSummary, BackupScheduleSettings,
  BackupVerificationResult, BackupStatus, BackupType, User
} from '../../types';
import { formatPersianDate } from '../../lib/dateUtils';
import { useTranslation } from '../../lib/i18n';
import { RTLNumber } from '../ui/RTLNumber';

export interface BackupManagerProps {
  currentUser?: User;
  onRefreshData?: () => void;
}

export const BackupManager: React.FC<BackupManagerProps> = ({ currentUser, onRefreshData }) => {
  const { success, error, warning, info } = useToast();
  const { t, isRtl } = useTranslation();

  // State
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [health, setHealth] = useState<BackupHealthSummary | null>(null);
  const [schedule, setSchedule] = useState<BackupScheduleSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Selected backup for details / verification / restore
  const [selectedBackup, setSelectedBackup] = useState<BackupItem | null>(null);
  const [verificationResult, setVerificationResult] = useState<BackupVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Restore Modal State
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [backupToRestore, setBackupToRestore] = useState<BackupItem | null>(null);
  const [restoreStep, setRestoreStep] = useState<1 | 2>(1);
  const [confirmPhraseInput, setConfirmPhraseInput] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<BackupItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Schedule Settings Form State
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<BackupScheduleSettings>({
    enabled: true,
    frequency: 'daily',
    backupTime: '03:00',
    retentionDays: 30,
    maxBackupsToKeep: 50,
    encryptBackups: false,
  });

  // Load All Backup Data
  const loadBackupData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [backupsRes, healthRes, scheduleRes] = await Promise.all([
        api.getBackups(),
        api.getBackupHealth(),
        api.getBackupSchedule(),
      ]);

      if (backupsRes.success) setBackups(backupsRes.backups || []);
      if (healthRes.success) setHealth(healthRes.health);
      if (scheduleRes.success && scheduleRes.schedule) {
        setSchedule(scheduleRes.schedule);
        setScheduleForm(scheduleRes.schedule);
      }
    } catch (err: any) {
      console.error('Failed to load backup data:', err);
      if (!silent) error(isRtl ? 'خطا در دریافت اطلاعات پشتیبان‌ها از سرور' : 'Failed to fetch backup details from server');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBackupData();
  }, []);

  // Handle Manual Backup Creation
  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      const res = await api.createFullBackup(notesInput.trim() || undefined);
      if (res.success) {
        success(isRtl ? `پشتیبان کامل سیستم (${res.backup.sizeFormatted}) با موفقیت ایجاد گردید.` : `Full system backup (${res.backup.sizeFormatted}) created successfully.`);
        setNotesInput('');
        loadBackupData(true);
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در ایجاد فایل پشتیبان' : 'Failed to create backup archive'));
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Backup Package Upload / Import
  const handleUploadBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data && data.database) {
        // Full System Backup Package
        const res = await api.uploadBackupPackage(data);
        if (res.success) {
          success(isRtl ? `بسته پشتیبان جامع "${res.backup.filename}" با موفقیت در سامانه ثبت شد.` : `Full backup package "${res.backup.filename}" uploaded successfully.`);
          await loadBackupData(true);
          if (onRefreshData) onRefreshData();
        } else {
          error(res.message || (isRtl ? 'خطا در ثبت بسته پشتیبان' : 'Failed to register backup package'));
        }
      } else {
        // Raw or legacy database dump
        const res = await api.importDatabase(data);
        if (res.success) {
          success(isRtl ? 'پایگاه داده با موفقیت بازیابی شد.' : 'Database state restored successfully.');
          await loadBackupData(true);
          if (onRefreshData) onRefreshData();
        } else {
          error(res.message || (isRtl ? 'ساختار فایل ارسالی نامعتبر است' : 'Invalid backup format'));
        }
      }
    } catch (err: any) {
      console.error('Failed to parse and upload backup package:', err);
      error(isRtl ? 'خطا در پردازش فایل پشتیبان ارسالی. لطفاً فایل JSON معتبر انتخاب نمایید.' : 'Failed to parse backup package file.');
    } finally {
      setIsUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  // Verify Backup Integrity
  const handleVerifyBackup = async (backup: BackupItem) => {
    setSelectedBackup(backup);
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const res = await api.verifyBackupIntegrity(backup.id);
      if (res.success) {
        setVerificationResult(res.verification);
        if (res.verification.valid) {
          success(isRtl ? 'یکپارچگی و سلامت ساختار داده‌ها و فایل‌ها با موفقیت تأیید شد.' : 'Database and file integrity verified successfully.');
        } else {
          warning(isRtl ? 'هشدار: مواردی در بررسی یکپارچگی فایل مشاهده گردید.' : 'Warning: issues detected during integrity check.');
        }
      }
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در اعتبارسنجی فایل پشتیبان' : 'Failed to verify backup integrity'));
    } finally {
      setIsVerifying(false);
    }
  };

  // Delete Backup Handlers
  const handlePromptDelete = (backup: BackupItem) => {
    setBackupToDelete(backup);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!backupToDelete) return;
    setIsDeleting(true);
    try {
      const res = await api.deleteBackup(backupToDelete.id);
      if (res.success) {
        success(isRtl ? `فایل پشتیبان "${backupToDelete.filename}" با موفقیت حذف گردید.` : `Backup file "${backupToDelete.filename}" deleted.`);
        setBackups((prev) => prev.filter((b) => b.id !== backupToDelete.id));
        setDeleteModalOpen(false);
        setBackupToDelete(null);
        loadBackupData(true);
      } else {
        error(res.message || (isRtl ? 'خطا در حذف فایل پشتیبان' : 'Failed to delete backup'));
      }
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در حذف فایل پشتیبان از سرور' : 'Failed to delete backup from server'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Restore Modal
  const handleStartRestore = (backup: BackupItem) => {
    setBackupToRestore(backup);
    setRestoreStep(1);
    setConfirmPhraseInput('');
    setRestoreModalOpen(true);
  };

  // Execute Restore Step 2
  const handleConfirmRestore = async () => {
    if (!backupToRestore) return;
    if (confirmPhraseInput.trim() !== 'RESTORE_CONFIRMED' && confirmPhraseInput.trim() !== 'RESTORE_MMBA') {
      warning(isRtl ? 'عبارت تاییدیه امنیتی نادرست است. لطفاً عبارت دقیق را تایپ فرمایید.' : 'Security confirmation phrase is incorrect.');
      return;
    }

    setIsRestoring(true);
    try {
      const res = await api.restoreSystemBackup(backupToRestore.id, confirmPhraseInput.trim());
      if (res.success) {
        success(isRtl ? 'سامانه با موفقیت به فایل پشتیبان انتخاب‌شده بازگردانی شد.' : 'System successfully restored to selected backup.');
        setRestoreModalOpen(false);
        setBackupToRestore(null);
        if (onRefreshData) onRefreshData();
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        error(res.message || (isRtl ? 'خطا در بازگردانی سامانه' : 'Failed to restore system'));
      }
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در فرآیند بازیابی سیستم' : 'Error during restore process'));
    } finally {
      setIsRestoring(false);
    }
  };

  // Save Schedule Settings
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSchedule(true);
    try {
      const res = await api.updateBackupSchedule(scheduleForm);
      if (res.success) {
        success(isRtl ? 'تنظیمات زمان‌بندی پشتیبان‌گیری خودکار ذخیره شد.' : 'Automated backup schedule saved.');
        setSchedule(res.schedule);
        loadBackupData(true);
      }
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در ذخیره تنظیمات زمان‌بندی' : 'Failed to save schedule settings'));
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // Download Protected Backup
  const handleDownload = (backup: BackupItem) => {
    const downloadUrl = `/api/backups/${backup.id}/download`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = backup.filename;
    a.click();
    info(isRtl ? 'درخواست دانلود بسته کامل سیستم ارسال گردید.' : 'Full system backup download started.');
  };

  return (
    <div className={`space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
      {/* 1. Health & Status Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Last Successful Backup */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isRtl ? 'آخرین پشتیبان موفق' : 'Last Successful Backup'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {health?.lastSuccessfulBackup
                ? formatPersianDate(health.lastSuccessfulBackup.createdAt)
                : (isRtl ? 'بدون فایل پشتیبان' : 'No Backups')}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span>{isRtl ? 'حجم:' : 'Size:'} {health?.lastSuccessfulBackup?.sizeFormatted || '—'}</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400">{isRtl ? 'یکپارچه و فعال' : 'Healthy & Active'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Next Scheduled Backup */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isRtl ? 'پشتیبان‌گیری خودکار بعدی' : 'Next Scheduled Backup'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {schedule?.enabled && health?.nextScheduledBackup
                ? formatPersianDate(health.nextScheduledBackup)
                : (isRtl ? 'غیرفعال شده' : 'Disabled')}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span>{isRtl ? 'دوره:' : 'Freq:'} {schedule?.frequency === 'daily' ? (isRtl ? 'روزانه' : 'Daily') : (isRtl ? 'هفتگی' : 'Weekly')} ({schedule?.backupTime})</span>
              <span>•</span>
              <span className={schedule?.enabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}>
                {schedule?.enabled ? (isRtl ? 'زمان‌بند سرور' : 'Active Daemon') : (isRtl ? 'متوقف' : 'Stopped')}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Storage Usage */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isRtl ? 'فضای اشغال‌شده سرور' : 'Storage Consumed'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {health?.totalStorageFormatted || (isRtl ? '0 بایت' : '0 Bytes')}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span>{isRtl ? 'تعداد کل فایل‌ها:' : 'Total Archives:'} <RTLNumber value={health?.totalBackupsCount || 0} type="count" /> {isRtl ? 'نسخه' : 'files'}</span>
              <span>•</span>
              <span>{isRtl ? 'ماندگاری:' : 'Retention:'} {schedule?.retentionDays || 30} {isRtl ? 'روز' : 'days'}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Integrity & Health Status */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isRtl ? 'وضعیت سلامت پشتیبان‌ها' : 'Backup Health Status'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  health?.backupVerificationStatus === 'HEALTHY'
                    ? 'success'
                    : health?.backupVerificationStatus === 'WARNING'
                    ? 'warning'
                    : 'danger'
                }
                size="sm"
              >
                {health?.backupVerificationStatus === 'HEALTHY'
                  ? (isRtl ? 'کاملاً سالم و امن (HEALTHY)' : 'HEALTHY & VERIFIED')
                  : health?.backupVerificationStatus === 'WARNING'
                  ? (isRtl ? 'دارای هشدار (WARNING)' : 'WARNING DETECTED')
                  : (isRtl ? 'بحرانی (CRITICAL)' : 'CRITICAL ISSUE')}
              </Badge>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {isRtl ? 'محل ذخیره:' : 'Location:'} <span className="font-mono text-slate-700 dark:text-slate-300">/data/backups</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Manual Backup Creation & Action Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t('backups.createBackupBtn')} (Full System Snapshot)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isRtl
                ? 'پشتیبان جامع شامل کلیه جداول دیتابیس (مشتریان، قراردادها، اقساط، سیم‌کارت‌ها، مالکان، اسناد مالی، کاربران و لاگ‌ها) و کلیه فایل‌ها (کارت‌های ملی، چک‌ها، امضاها و پیوست‌ها) به همراه هش SHA-256 می‌باشد.'
                : 'Full system backup containing all database tables and all files (ID cards, check photos, signatures, attachments) with SHA-256 checksum.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              ref={uploadInputRef}
              onChange={handleUploadBackupFile}
              accept=".json,application/json"
              className="hidden"
            />
            <div className="w-full md:w-60">
              <Input
                placeholder={isRtl ? 'یادداشت اختیاری...' : 'Optional notes...'}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                disabled={isCreating || isUploading}
              />
            </div>
            <Button
              variant="primary"
              onClick={handleCreateBackup}
              disabled={isCreating || isUploading}
              leftIcon={<Database className="w-4 h-4" />}
            >
              {isCreating ? (isRtl ? 'در حال تهیه پشتیبان...' : 'Creating...') : t('backups.createBackupBtn')}
            </Button>
            <Button
              variant="outline"
              onClick={() => uploadInputRef.current?.click()}
              disabled={isCreating || isUploading}
              leftIcon={<UploadCloud className="w-4 h-4 text-indigo-500" />}
              title={isRtl ? 'آپلود بسته پشتیبان از رایانه' : 'Upload Backup Package'}
            >
              {isUploading ? (isRtl ? 'در حال آپلود...' : 'Uploading...') : (isRtl ? 'آپلود فایل بکاپ' : 'Upload Backup')}
            </Button>
            <Button
              variant="outline"
              onClick={() => loadBackupData()}
              disabled={isLoading}
              title={isRtl ? 'تازه‌سازی فهرست' : 'Refresh Archive'}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Main Split View: Backups Table (Left/Top) and Automated Schedule (Right/Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Existing Backups Table (Takes 2 spans) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FolderArchive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('backups.backupList')}</h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                <RTLNumber value={backups.length} type="count" suffix={isRtl ? 'نسخه ثبت‌شده' : 'Archives'} />
              </span>
            </div>

            {isLoading && backups.length === 0 ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
                <span>{isRtl ? 'در حال بارگذاری لیست پشتیبان‌های سرور...' : 'Loading backup archives from server...'}</span>
              </div>
            ) : backups.length === 0 ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <Database className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">{isRtl ? 'هیچ فایل پشتیبانی یافت نشد' : 'No Backup Archives Found'}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {isRtl ? 'برای تهیه اولین نسخه کامل، از دکمه «ایجاد پشتیبان دستی» در بالا استفاده نمایید.' : 'Click "Create Full Manual Backup" above to generate your first snapshot.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pe-1">
                {backups.map((backup) => {
                  const isSuccess = backup.status === BackupStatus.SUCCESSFUL || backup.status === BackupStatus.RESTORED;
                  const isSelected = selectedBackup?.id === backup.id;

                  return (
                    <div
                      key={backup.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-500/60 shadow-xs'
                          : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-200" dir="ltr">
                              {backup.filename}
                            </span>
                            <Badge
                              variant={
                                backup.type === BackupType.AUTOMATIC
                                  ? 'info'
                                  : backup.type === BackupType.SAFETY_PRE_RESTORE
                                  ? 'warning'
                                  : 'default'
                              }
                              size="sm"
                            >
                              {backup.type === BackupType.AUTOMATIC
                                ? (isRtl ? 'خودکار سرور' : 'Auto Daemon')
                                : backup.type === BackupType.SAFETY_PRE_RESTORE
                                ? (isRtl ? 'حفاظتی قبل از بازیابی' : 'Safety Snapshot')
                                : (isRtl ? 'دستی مدیر' : 'Manual')}
                            </Badge>
                            {backup.status === BackupStatus.RESTORED && (
                              <Badge variant="success" size="sm">
                                {isRtl ? 'بازگردانی‌شده' : 'Restored'}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                            <span>{isRtl ? 'تاریخ:' : 'Date:'} {formatPersianDate(backup.createdAt)}</span>
                            <span>•</span>
                            <span>{isRtl ? 'حجم:' : 'Size:'} <strong className="text-slate-700 dark:text-slate-300">{backup.sizeFormatted}</strong></span>
                            <span>•</span>
                            <span>
                              {isRtl ? 'رکوردهای دیتابیس:' : 'DB Records:'} <strong className="text-slate-700 dark:text-slate-300">{backup.counts?.totalRecords || '—'}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              {isRtl ? 'پیوست‌ها:' : 'Attachments:'} <strong className="text-slate-700 dark:text-slate-300">{backup.fileCounts?.attachmentsCount || 0} {isRtl ? 'فایل' : 'files'}</strong>
                            </span>
                            {(backup.fileCounts?.holderIdCardsCount || 0) > 0 && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                  <CreditCard className="w-3 h-3" />
                                  <span>{isRtl ? 'کارت ملی:' : 'ID Cards:'} <strong>{backup.fileCounts?.holderIdCardsCount}</strong></span>
                                </span>
                              </>
                            )}
                            {(backup.fileCounts?.checkPhotosCount || 0) > 0 && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                  <Image className="w-3 h-3" />
                                  <span>{isRtl ? 'چک‌ها:' : 'Checks:'} <strong>{backup.fileCounts?.checkPhotosCount}</strong></span>
                                </span>
                              </>
                            )}
                            {(backup.fileCounts?.contractSignaturesCount || 0) > 0 && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                  <FileCheck2 className="w-3 h-3" />
                                  <span>{isRtl ? 'امضاها:' : 'Signatures:'} <strong>{backup.fileCounts?.contractSignaturesCount}</strong></span>
                                </span>
                              </>
                            )}
                          </div>

                          {backup.notes && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                              {isRtl ? 'یادداشت:' : 'Note:'} {backup.notes}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVerifyBackup(backup)}
                            title={t('backups.verifyBackup')}
                            className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                          >
                            <FileCheck className="w-4 h-4" />
                            <span className="text-[11px]">{t('backups.verifyBackup')}</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(backup)}
                            title={t('backups.downloadBackup')}
                            className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                          >
                            <Download className="w-4 h-4" />
                            <span className="text-[11px]">{isRtl ? 'دانلود' : 'Download'}</span>
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleStartRestore(backup)}
                            title={t('backups.restoreBackup')}
                            className="bg-amber-600 hover:bg-amber-500 text-white"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span className="text-[11px]">{isRtl ? 'بازیابی' : 'Restore'}</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePromptDelete(backup)}
                            title={t('backups.deleteBackup')}
                            className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Verification Details Modal/Card (if selected) */}
          {selectedBackup && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/40 shadow-xs space-y-4 animate-blur-fade-up">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5" />
                  <span>{isRtl ? 'نتیجه اعتبارسنجی و جزئیات بسته:' : 'Verification Result:'} {selectedBackup.filename}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBackup(null);
                    setVerificationResult(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs"
                >
                  {isRtl ? 'بستن' : 'Close'}
                </button>
              </div>

              {isVerifying ? (
                <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span>{isRtl ? 'در حال محاسبه چک‌سام SHA-256 و اعتبارسنجی ساختار پایگاه داده و فایل‌ها...' : 'Computing SHA-256 checksums and verifying DB tables...'}</span>
                </div>
              ) : verificationResult ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div
                    className={`p-3 rounded-xl border flex items-center gap-3 ${
                      verificationResult.valid
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/50 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {verificationResult.valid ? (
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
                    )}
                    <div className="text-xs">
                      <div className="font-bold">
                        {verificationResult.valid
                          ? (isRtl ? 'فایل پشتیبان کاملاً معتبر و ۱۰۰٪ آماده بازیابی است' : 'Backup verified 100% healthy and ready for restore')
                          : (isRtl ? 'خطا در اعتبارسنجی فایل پشتیبان' : 'Verification failed')}
                      </div>
                      <div className="text-[11px] opacity-90 mt-0.5">
                        {verificationResult.valid
                          ? (isRtl ? 'تمامی جداول، حساب مدیر، مجوزها و فایل‌های پیوست بدون کوچک‌ترین مغایرت احراز شدند.' : 'All schema tables, admin accounts, RBAC permissions, and binary files matched SHA-256.')
                          : (verificationResult.errors || []).join(' | ')}
                      </div>
                    </div>
                  </div>

                  {/* Summary Breakdown Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">{isRtl ? 'مشتریان و تماس‌ها' : 'Customers & Calls'}</div>
                      <div className="text-slate-900 dark:text-slate-100 font-bold mt-1">
                        {verificationResult.counts.customers} {isRtl ? 'مشتری' : 'cust'} / {verificationResult.counts.calls} {isRtl ? 'تماس' : 'calls'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">{isRtl ? 'اسناد مالی و قراردادها' : 'Finances & Contracts'}</div>
                      <div className="text-slate-900 dark:text-slate-100 font-bold mt-1">
                        {verificationResult.counts.contracts} {isRtl ? 'قرارداد' : 'contracts'} / {verificationResult.counts.payments + verificationResult.counts.checks} {isRtl ? 'سند مالی' : 'docs'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">{isRtl ? 'سیم‌کارت‌ها و تعمیرات' : 'SIMs & Repairs'}</div>
                      <div className="text-slate-900 dark:text-slate-100 font-bold mt-1">
                        {verificationResult.counts.sims} {isRtl ? 'خط' : 'SIMs'} / {verificationResult.counts.repairs} {isRtl ? 'پرونده' : 'repairs'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">{isRtl ? 'کاربران و لاگ‌ها' : 'Users & Logs'}</div>
                      <div className="text-slate-900 dark:text-slate-100 font-bold mt-1">
                        {verificationResult.counts.users} {isRtl ? 'کاربر' : 'users'} / {verificationResult.counts.auditLogs} {isRtl ? 'لاگ' : 'logs'}
                      </div>
                    </div>

                    {/* Files & Holders Breakdown */}
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">{isRtl ? 'مالکان و تصاویر کارت ملی' : 'Holders & ID Cards'}</div>
                      <div className="text-slate-900 dark:text-slate-100 font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                        {verificationResult.counts.registeredHolders || 0} {isRtl ? 'مالک' : 'holders'} / {verificationResult.counts.holderIdCards || 0} {isRtl ? 'کارت ملی' : 'ID cards'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">{isRtl ? 'تصاویر چک‌ها و امضاها' : 'Checks & Signatures'}</div>
                      <div className="text-slate-900 dark:text-slate-100 font-bold mt-1 text-blue-600 dark:text-blue-400">
                        {verificationResult.counts.checkPhotos || 0} {isRtl ? 'چک' : 'checks'} / {verificationResult.counts.contractSignatures || 0} {isRtl ? 'امضا' : 'signatures'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">{isRtl ? 'پیوست‌ها و فایل‌های سامانه' : 'Attachments & Files'}</div>
                      <div className="text-slate-900 dark:text-slate-100 font-bold mt-1">
                        {verificationResult.counts.attachments} {isRtl ? 'فایل پیوست' : 'attachments'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">{isRtl ? 'مجموع رکوردهای پایگاه داده' : 'Total DB Records'}</div>
                      <div className="text-slate-900 dark:text-slate-100 font-bold mt-1 text-indigo-600 dark:text-indigo-400">
                        {verificationResult.counts.totalRecords} {isRtl ? 'رکورد جامع' : 'records'}
                      </div>
                    </div>
                  </div>

                  {/* Verification Items List */}
                  <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    <div className="font-semibold text-slate-500 dark:text-slate-400 text-[11px]">{isRtl ? 'چک‌لیست سلامت:' : 'Integrity Checklist:'}</div>
                    {(verificationResult.details || []).map((det, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{det}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Right Column: Automatic Backup Scheduling & Disaster Recovery Guide */}
        <div className="space-y-6">
          {/* Automatic Schedule Form */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('backups.autoSchedule')}</h3>
              </div>
              <Badge variant={scheduleForm.enabled ? 'success' : 'default'} size="sm">
                {scheduleForm.enabled ? (isRtl ? 'فعال' : 'Enabled') : (isRtl ? 'غیرفعال' : 'Disabled')}
              </Badge>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {isRtl
                ? 'سرویس پشتیبان‌گیری خودکار به صورت دائمی بر روی سرور اجرا می‌شود و نیازی به باز بودن مرورگر کاربر ندارد.'
                : 'Automated backup daemon runs continuously on the server and executes scheduled snapshots independent of browser status.'}
            </p>

            <form onSubmit={handleSaveSchedule} className="space-y-4 text-xs">
              {/* Enable / Disable Toggle */}
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleForm.enabled}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, enabled: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {isRtl ? 'فعال‌سازی پشتیبان‌گیری خودکار زمان‌بندی‌شده سرور' : 'Enable Automated Server Backup Daemon'}
                </span>
              </label>

              {/* Frequency */}
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-semibold block">{isRtl ? 'دوره تکرار (Frequency):' : 'Schedule Frequency:'}</label>
                <select
                  value={scheduleForm.frequency}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  disabled={!scheduleForm.enabled}
                >
                  <option value="daily">{isRtl ? 'روزانه (Daily - توصیه می‌شود)' : 'Daily (Recommended)'}</option>
                  <option value="weekly">{isRtl ? 'هفتگی (Weekly)' : 'Weekly'}</option>
                </select>
              </div>

              {/* Backup Time */}
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-semibold block">{t('backups.backupTime')}:</label>
                <Input
                  type="time"
                  value={scheduleForm.backupTime}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, backupTime: e.target.value })}
                  disabled={!scheduleForm.enabled}
                  helperText={isRtl ? 'ساعت کم‌ترافیک شبانه سرور (پیش‌فرض: 03:00 بامداد)' : 'Low-traffic hours (default: 03:00 AM)'}
                />
              </div>

              {/* Retention Policy */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold block">{t('backups.retentionDays')}:</label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={scheduleForm.retentionDays}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, retentionDays: parseInt(e.target.value) || 30 })}
                    disabled={!scheduleForm.enabled}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold block">{isRtl ? 'حداکثر نسخه‌های مجاز:' : 'Max Backups:'}</label>
                  <Input
                    type="number"
                    min="5"
                    max="200"
                    value={scheduleForm.maxBackupsToKeep}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, maxBackupsToKeep: parseInt(e.target.value) || 50 })}
                    disabled={!scheduleForm.enabled}
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={isSavingSchedule}
                  leftIcon={<Check className="w-4 h-4" />}
                  className="w-full"
                >
                  {isSavingSchedule ? (isRtl ? 'در حال ذخیره...' : 'Saving...') : t('backups.saveSchedule')}
                </Button>
              </div>
            </form>
          </div>

          {/* Disaster Recovery Architecture Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <Layers className="w-4 h-4" />
              <span>{isRtl ? 'معماری بازیابی پس از بحران (Disaster Recovery)' : 'Disaster Recovery Architecture'}</span>
            </div>

            <div className="text-[11px] text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-[9px] mt-0.5 border border-indigo-200 dark:border-indigo-500/30">
                  ۱
                </div>
                <div>
                  <strong>{isRtl ? 'اعتبارسنجی خودکار قبل از بازیابی:' : 'Pre-Restore Verification:'}</strong> {isRtl ? 'سلامت فایل پشتیبان و حضور حساب ادمین احراز می‌شود.' : 'Integrity and admin existence verified.'}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-[9px] mt-0.5 border border-indigo-200 dark:border-indigo-500/30">
                  ۲
                </div>
                <div>
                  <strong>{isRtl ? 'پشتیبان حفاظتی آنی (Safety Snapshot):' : 'Safety Snapshot:'}</strong> {isRtl ? 'قبل از دستکاری دیتابیس، یک نسخه خودکار از سیستم فعلی گرفته می‌شود.' : 'An automatic snapshot is captured before any DB mutation.'}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-[9px] mt-0.5 border border-indigo-200 dark:border-indigo-500/30">
                  ۳
                </div>
                <div>
                  <strong>{isRtl ? 'مکانیزم واگردانی خودکار (Rollback):' : 'Automated Rollback:'}</strong> {isRtl ? 'در صورت بروز هرگونه قطعی یا خطا در بازگردانی، سامانه به حالت اولیه بازمی‌گردد.' : 'System rolls back seamlessly if any failure occurs during restoration.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Multi-Step Safety Restore Modal */}
      {restoreModalOpen && backupToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className={`w-full max-w-lg p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 ${isRtl ? 'text-right' : 'text-left'}`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-bold text-base">
                <AlertTriangle className="w-5 h-5" />
                <span>{t('backups.restoreBackup')} (System Restore)</span>
              </div>
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs"
                disabled={isRestoring}
              >
                {t('common.cancel')}
              </button>
            </div>

            {/* Step 1: Warning & Impact Analysis */}
            {restoreStep === 1 && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/40 text-amber-800 dark:text-amber-200 text-xs leading-relaxed space-y-2">
                  <div className="font-bold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>{isRtl ? 'هشدار امنیتی بسیار مهم:' : 'Critical Security Warning:'}</span>
                  </div>
                  <p>
                    {t('backups.restoreWarning')}
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300/80">
                    {isRtl ? '* جهت امنیت کامل، یک نسخه پشتیبان حفاظتی (Safety Snapshot) پیش از شروع فرآیند توسط سرور به طور خودکار تهیه خواهد شد.' : '* A safety snapshot is automatically captured by the server before restoration starts.'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 dark:text-slate-200">{isRtl ? 'مشخصات نسخه انتخابی جهت بازگردانی:' : 'Selected Backup Target:'}</div>
                  <div className="text-slate-700 dark:text-slate-300 font-mono text-[11px]" dir="ltr">{backupToRestore.filename}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    {isRtl ? 'تاریخ:' : 'Date:'} {formatPersianDate(backupToRestore.createdAt)} | {isRtl ? 'حجم:' : 'Size:'} {backupToRestore.sizeFormatted} | {isRtl ? 'رکوردها:' : 'Records:'} {backupToRestore.counts?.totalRecords || '—'}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setRestoreModalOpen(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    className="bg-amber-600 hover:bg-amber-500 text-white"
                    onClick={() => setRestoreStep(2)}
                  >
                    {isRtl ? 'ادامه به مرحله تایید نهایی' : 'Proceed to Confirmation'}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Explicit Confirmation & Execution */}
            {restoreStep === 2 && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs space-y-2">
                  <div className="font-bold">{isRtl ? 'تاییدیه نهایی مدیر سیستم:' : 'Administrator Final Confirmation:'}</div>
                  <p>
                    {isRtl ? 'لطفاً عبارت امنیتی' : 'Please type'} <strong className="font-mono text-rose-950 dark:text-white bg-rose-200 dark:bg-rose-900/60 px-1.5 py-0.5 rounded">RESTORE_CONFIRMED</strong> {isRtl ? 'را در کادر زیر تایپ نمایید تا دکمه بازیابی فعال گردد.' : 'below to enable the restore action.'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    {isRtl ? 'تایپ عبارت تاییدیه:' : 'Type Confirmation Phrase:'}
                  </label>
                  <Input
                    placeholder="RESTORE_CONFIRMED"
                    value={confirmPhraseInput}
                    onChange={(e) => setConfirmPhraseInput(e.target.value)}
                    dir="ltr"
                    className="font-mono text-center"
                    disabled={isRestoring}
                  />
                </div>

                <div className="flex justify-between items-center pt-3 border-slate-200 dark:border-slate-800">
                  <Button
                    variant="outline"
                    onClick={() => setRestoreStep(1)}
                    disabled={isRestoring}
                  >
                    {isRtl ? 'بازگشت' : 'Back'}
                  </Button>

                  <Button
                    variant="danger"
                    onClick={handleConfirmRestore}
                    disabled={
                      isRestoring ||
                      (confirmPhraseInput.trim() !== 'RESTORE_CONFIRMED' && confirmPhraseInput.trim() !== 'RESTORE_MMBA')
                    }
                    leftIcon={<RotateCcw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />}
                  >
                    {isRestoring ? (isRtl ? 'در حال بازیابی پایگاه داده و فایل‌ها...' : 'Restoring Data...') : t('backups.confirmRestore')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Delete Confirmation Modal */}
      {deleteModalOpen && backupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className={`w-full max-w-md p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 ${isRtl ? 'text-right' : 'text-left'}`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-bold text-base">
                <Trash2 className="w-5 h-5" />
                <span>{t('backups.deleteBackup')}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteModalOpen(false);
                    setBackupToDelete(null);
                  }
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs"
                disabled={isDeleting}
              >
                {t('common.cancel')}
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 text-xs">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {isRtl ? 'آیا از حذف دائمی این فایل پشتیبان از فضای ذخیره‌سازی سرور اطمینان دارید؟' : 'Are you sure you want to permanently delete this backup archive?'}
              </p>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono text-[11px]">
                <div className="text-slate-800 dark:text-slate-200 font-bold truncate dir-ltr">{backupToDelete.filename}</div>
                <div className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span>{isRtl ? 'حجم:' : 'Size:'} {backupToDelete.sizeFormatted}</span>
                  <span>•</span>
                  <span>{isRtl ? 'تاریخ:' : 'Date:'} {formatPersianDate(backupToDelete.createdAt)}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] leading-relaxed">
                {isRtl ? 'توجه: این عملیات غیرقابل بازگشت است و فایل از دیسک سرور پاک خواهد شد.' : 'Warning: This action is permanent and the file will be removed from disk.'}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setBackupToDelete(null);
                }}
                disabled={isDeleting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                leftIcon={<Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />}
              >
                {isDeleting ? (isRtl ? 'در حال حذف...' : 'Deleting...') : (isRtl ? 'بله، حذف فایل پشتیبان' : 'Confirm Delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
