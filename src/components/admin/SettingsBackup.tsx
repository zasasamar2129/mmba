import React, { useState, useEffect } from 'react';
import {
  Download, Upload, RefreshCw, Database, Sparkles, Check, Key,
  Terminal, AlertTriangle, Sliders, ArchiveRestore, ShieldCheck, Bell, Users
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { DebugLogViewer } from './DebugLogViewer';
import { ProblemReportViewer } from './ProblemReportViewer';
import { BackupManager } from './BackupManager';
import { NotificationSettingsManager } from './NotificationSettingsManager';
import { RegisteredHoldersModal } from '../sims/RegisteredHoldersModal';
import { User } from '../../types';
import { useTranslation } from '../../lib/i18n';

export interface SettingsBackupProps {
  onFullReset: () => void;
  currentUser?: User;
  initialTab?: 'backups' | 'general' | 'notifications' | 'logs' | 'reports' | 'holders';
}

export const SettingsBackup: React.FC<SettingsBackupProps> = ({ onFullReset, currentUser, initialTab = 'backups' }) => {
  const { language, t, isRtl } = useTranslation();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState<'backups' | 'general' | 'notifications' | 'logs' | 'reports' | 'holders'>(initialTab);
  const [apiKeyInput, setApiKeyInput] = useState(storage.getCustomGeminiKey() || '');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isHoldersModalOpen, setIsHoldersModalOpen] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    storage.setCustomGeminiKey(apiKeyInput.trim());
    success(t('common.success'));
  };

  const handleExportBackup = () => {
    const jsonStr = storage.exportAllDataJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mmba_quick_export_${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    success(language === 'fa' ? 'فایل پشتیبان سریع JSON دانلود شد' : 'Quick JSON export downloaded');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const res = storage.importAllDataJson(content);
        if (res) {
          success(language === 'fa' ? 'داده‌ها با موفقیت بازیابی شدند' : 'Backup imported successfully');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          error(language === 'fa' ? 'ساختار فایل نامعتبر است' : 'Invalid backup structure');
        }
      } catch (err) {
        error(language === 'fa' ? 'خطا در بازیابی فایل' : 'Error importing backup');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmReset = () => {
    storage.resetToProduction();
    success(language === 'fa' ? 'سامانه به وضعیت اولیه بازنشانی شد' : 'System reset to clean state');
    setShowResetConfirm(false);
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {activeTab === 'backups' ? t('backups.title') : t('settings.title')}
            </h1>
            <Badge variant="indigo" size="sm">
              Enterprise Admin
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {activeTab === 'backups' ? t('backups.subtitle') : t('settings.subtitle')}
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('backups')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'backups'
              ? 'bg-indigo-600 text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ArchiveRestore className="w-4 h-4 text-emerald-400" />
          <span>{t('backups.title')} (Backup & Restore)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'general'
              ? 'bg-indigo-600 text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>{t('settings.aiConfig')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'notifications'
              ? 'bg-indigo-600 text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Bell className="w-4 h-4 text-amber-400" />
          <span>{isRtl ? 'اعلان‌ها و دستگاه‌ها' : 'Notifications & Push'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'logs'
              ? 'bg-indigo-600 text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Live Logs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'reports'
              ? 'bg-indigo-600 text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Bug Reports</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('holders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'holders'
              ? 'bg-indigo-600 text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-400" />
          <span>{isRtl ? 'افراد ثبت‌کننده (سندزن - سقف ۱۰ خط)' : 'Registered Holders (10-line cap)'}</span>
        </button>
      </div>

      {/* Tab: Registered SIM Holders */}
      {activeTab === 'holders' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold">
                <Users className="w-5 h-5 text-indigo-500" />
                <span>{isRtl ? 'مدیریت متمرکز افراد ثبت‌کننده (سندزن سیم‌کارت‌ها)' : 'Central Management of Registered Holders (SIM documenters)'}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isRtl
                  ? 'طبق قوانین و بخشنامه رگولاتوری ارتباطات، هر کدملی حداکثر مجاز به ثبت ۱۰ سیم‌کارت فعال در کلیه اپراتورهاست. در این بخش می‌توانید پرونده افراد سندزن، کدملی، شماره شبا جهت تسویه و سیم‌کارت‌های متصل به هر فرد را بررسی فرمایید.'
                  : 'Per telecom regulatory rules, each national ID is limited to a maximum of 10 active SIMs across all operators. Review documenter records, national IDs, IBANs for settlement, and their linked SIMs here.'}
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsHoldersModalOpen(true)}
              leftIcon={<Users className="w-4 h-4" />}
            >
              {isRtl ? 'مدیریت و ثبت سندزن جدید' : 'Manage & Add New Documenter'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {storage.getRegisteredHolders().map((h) => {
              const activeCount = h.activeSimCount || 0;
              const isFull = activeCount >= 10;
              return (
                <div
                  key={h.id}
                  onClick={() => setIsHoldersModalOpen(true)}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700 cursor-pointer transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{h.fullName}</span>
                    {isFull ? (
                      <Badge variant="danger" size="sm">{isRtl ? 'تکمیل ظرفیت (۱۰/۱۰)' : 'Capacity Full (10/10)'}</Badge>
                    ) : (
                      <Badge variant="emerald" size="sm">{activeCount}/10 {isRtl ? 'فعال' : 'active'}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <div>{isRtl ? 'کدملی:' : 'National ID:'} <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{h.nationalId}</span></div>
                    <div>{isRtl ? 'موبایل:' : 'Mobile:'} <span className="font-mono">{h.mobile}</span></div>
                    {h.shebaNumber && (
                      <div className="truncate">{isRtl ? 'شبا:' : 'IBAN:'} <span className="font-mono text-[11px]">{h.shebaNumber}</span></div>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="space-y-1 pt-1">
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isFull ? 'bg-rose-500' : activeCount >= 8 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, (activeCount / 10) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{10 - activeCount} {isRtl ? 'جایگاه خالی' : 'slots left'}</span>
                      <span>{isRtl ? 'سقف: ۱۰ سیم‌کارت' : 'Cap: 10 SIMs'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <RegisteredHoldersModal
            isOpen={isHoldersModalOpen}
            onClose={() => setIsHoldersModalOpen(false)}
            currentUser={currentUser || storage.getCurrentUser()}
          />
        </div>
      )}

      {/* Tab: Full Backup & Restore Engine */}
      {activeTab === 'backups' && (
        <BackupManager
          currentUser={currentUser || storage.getCurrentUser()}
          onRefreshData={onFullReset}
        />
      )}

      {/* Tab: General Settings & Quick Tools */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gemini AI config */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-100 dark:border-slate-800 pb-3">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <span>{t('settings.aiConfig')}</span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === 'fa'
                ? 'سامانه به صورت پیش‌فرض از هوش مصنوعی سرور استفاده می‌کند. در صورت تمایل می‌توانید کلید اختصاصی Gemini API خود را وارد نمایید.'
                : 'The system uses server-side Gemini by default. You may also provide a custom API key.'}
            </p>

            <form onSubmit={handleSaveApiKey} className="space-y-3">
              <Input
                label="Gemini API Key"
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                leftIcon={<Key className="w-4 h-4 text-indigo-500" />}
              />

              <div className="flex justify-end">
                <Button variant="primary" size="sm" type="submit" leftIcon={<Check className="w-4 h-4" />}>
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </div>

          {/* Quick Client-Side Reset & Raw Tools */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-100 dark:border-slate-800 pb-3">
              <Database className="w-5 h-5 text-emerald-500" />
              <span>{t('settings.systemReset')}</span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === 'fa'
                ? 'استخراج سریع خروجی سبک JSON یا بازنشانی کش محلی مرورگر جهت شروع پنل عملیاتی جدید.'
                : 'Fast JSON data export or emergency local reset.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportBackup}
                leftIcon={<Download className="w-4 h-4 text-indigo-500" />}
                className="flex-1"
              >
                JSON Export
              </Button>

              <label className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer transition-all border border-slate-200 dark:border-slate-700 flex-1">
                <Upload className="w-4 h-4 text-emerald-500" />
                <span>JSON Import</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                {t('settings.systemReset')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Push Notifications & Devices */}
      {activeTab === 'notifications' && <NotificationSettingsManager />}

      {/* Tab: Live Debug Logs */}
      {activeTab === 'logs' && <DebugLogViewer />}

      {/* Tab: Problem / Bug Reports */}
      {activeTab === 'reports' && (
        <ProblemReportViewer currentUser={currentUser || storage.getCurrentUser()} />
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <Modal
          isOpen={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          maxWidth="sm"
          title={t('settings.systemReset')}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {language === 'fa'
                ? 'آیا مطمئن هستید که می‌خواهید سامانه را پاکسازی کرده و با پنل خام شروع کنید؟'
                : 'Are you sure you want to reset the system and start with a clean state?'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="danger" size="sm" onClick={handleConfirmReset}>
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
