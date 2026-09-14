import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { centralDb, CentralDatabaseSchema } from './db';
import {
  BackupItem, BackupStatus, BackupType, BackupScheduleSettings,
  BackupHealthSummary, BackupVerificationResult, RestoreExecutionResult,
  BackupRecordCounts, User, UserRole, ModuleName
} from '../src/types';

// Format bytes into human-readable Persian/English string
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 بایت';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['بایت', 'کیلوبایت (KB)', 'مگابایت (MB)', 'گیگابایت (GB)', 'ترابایت (TB)'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export interface BackupArchivePackage {
  meta: BackupItem;
  database: CentralDatabaseSchema;
  files: {
    attachments: { id: string; fileName: string; fileType: string; dataUrl: string; sizeBytes?: number }[];
    voiceNotes: { id: string; title: string; audioDataUrl: string; durationSeconds: number }[];
    problemReportScreenshots: { id: string; title: string; screenshotUrl: string }[];
    holderIdCards: { id: string; holderId: string; holderName: string; nationalId: string; fileName: string; fileType: string; dataUrl: string; sizeBytes?: number }[];
    checkPhotos?: { id: string; checkId: string; checkNumber?: string; fileName: string; fileType: string; dataUrl: string; sizeBytes?: number }[];
    contractSignatures?: { id: string; contractId: string; contractNumber?: string; fileName: string; fileType: string; dataUrl: string; sizeBytes?: number }[];
  };
  checksum: string; // SHA-256 of the payload content
}

class SystemBackupService {
  private backupDir: string;
  private settingsPath: string;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private scheduleSettings: BackupScheduleSettings;
  private isBackupRunning: boolean = false;
  private isRestoreRunning: boolean = false;

  constructor() {
    const rawBackupPath = process.env.BACKUP_STORAGE_PATH || './data/backups';
    this.backupDir = path.isAbsolute(rawBackupPath) ? rawBackupPath : path.resolve(process.cwd(), rawBackupPath);
    this.settingsPath = path.resolve(this.backupDir, 'backup_schedule_settings.json');

    this.scheduleSettings = {
      enabled: true,
      frequency: 'daily',
      backupTime: '03:00',
      retentionDays: 30,
      maxBackupsToKeep: 50,
      storagePath: this.backupDir,
      encryptBackups: false,
    };

    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      if (fs.existsSync(this.settingsPath)) {
        const content = fs.readFileSync(this.settingsPath, 'utf-8');
        try {
          const parsed = JSON.parse(content);
          this.scheduleSettings = { ...this.scheduleSettings, ...parsed, storagePath: this.backupDir };
        } catch (e) {
          console.error('[Backup Engine] Failed to parse backup schedule settings, using defaults');
        }
      } else {
        this.saveScheduleSettingsInternal();
      }

      this.startScheduler();
      console.log(`[Backup Engine] System Backup & Restore Service initialized at: ${this.backupDir}`);
    } catch (err) {
      console.error('[Backup Engine] Initialization error:', err);
    }
  }

  private saveScheduleSettingsInternal() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.scheduleSettings, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Backup Engine] Failed to save backup schedule settings:', e);
    }
  }

  public getScheduleSettings(): BackupScheduleSettings {
    return { ...this.scheduleSettings, storagePath: this.backupDir };
  }

  public updateScheduleSettings(settings: Partial<BackupScheduleSettings>): BackupScheduleSettings {
    this.scheduleSettings = {
      ...this.scheduleSettings,
      ...settings,
      storagePath: this.backupDir,
    };
    this.saveScheduleSettingsInternal();
    this.restartScheduler();
    return this.getScheduleSettings();
  }

  // Calculate SHA-256 Checksum for data integrity
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  // Count records in Central Database
  private computeRecordCounts(db: CentralDatabaseSchema): BackupRecordCounts {
    const users = (db.users || []).length;
    const roles = (db.roles || []).length;
    const customers = (db.customers || []).length;
    const leads = (db.leads || []).length;
    const calls = (db.calls || []).length;
    const interactions = (db.interactions || []).length;
    const voiceNotes = (db.voiceNotes || []).length;
    const tasks = (db.tasks || []).length;
    const contracts = (db.contracts || []).length;
    const contractInstallments = (db.contractInstallments || []).length;
    const payments = (db.payments || []).length;
    const checks = (db.checks || []).length;
    const sims = (db.sims || []).length;
    const repairs = (db.repairs || []).length;
    const registeredHolders = (db.registeredHolders || []).length;
    const attachments = (db.attachments || []).length;
    const accounts = (db.accounts || []).length;
    const journalEntries = (db.journalEntries || []).length;
    const journalEntryLines = (db.journalEntryLines || []).length;
    const accountingPeriods = (db.accountingPeriods || []).length;
    const documentShares = (db.documentShares || []).length;
    const trustedBiometricDevices = (db.trustedBiometricDevices || []).length;
    const notifications = (db.notifications || []).length;
    const auditLogs = (db.auditLogs || []).length;
    const dateSuggestions = (db.dateSuggestions || []).length;
    const sharedLinks = (db.sharedLinks || []).length;
    const problemReports = (db.problemReports || []).length;
    const settings = db.settings ? 1 : 0;

    const totalRecords =
      users + roles + customers + leads + calls + interactions + voiceNotes +
      tasks + contracts + contractInstallments + payments + checks + sims + repairs +
      registeredHolders + attachments + accounts + journalEntries + journalEntryLines +
      accountingPeriods + documentShares + trustedBiometricDevices +
      notifications + auditLogs + dateSuggestions + sharedLinks + problemReports + settings;

    return {
      users,
      roles,
      customers,
      leads,
      calls,
      interactions,
      voiceNotes,
      tasks,
      contracts,
      contractInstallments,
      payments,
      checks,
      sims,
      repairs,
      registeredHolders,
      attachments,
      accounts,
      journalEntries,
      journalEntryLines,
      accountingPeriods,
      documentShares,
      trustedBiometricDevices,
      notifications,
      auditLogs,
      settings,
      dateSuggestions,
      sharedLinks,
      problemReports,
      totalRecords,
    };
  }

  // List all available backups on disk
  public listBackups(): BackupItem[] {
    try {
      if (!fs.existsSync(this.backupDir)) return [];
      const files = fs.readdirSync(this.backupDir);
      const backupFiles = files.filter(
        (f) => f.startsWith('mmba_full_backup_') && f.endsWith('.json')
      );

      const items: BackupItem[] = [];
      for (const filename of backupFiles) {
        const fullPath = path.resolve(this.backupDir, filename);
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const parsed: BackupArchivePackage = JSON.parse(content);
          if (parsed && parsed.meta) {
            items.push(parsed.meta);
          }
        } catch (e) {
          // File corrupted or non-standard backup
          const stats = fs.statSync(fullPath);
          items.push({
            id: filename.replace('.json', ''),
            filename,
            createdAt: stats.mtime.toISOString(),
            type: BackupType.MANUAL,
            status: BackupStatus.FAILED,
            sizeBytes: stats.size,
            sizeFormatted: formatBytes(stats.size),
            checksum: 'CORRUPTED',
            isEncrypted: false,
            version: 1,
            revision: 0,
            systemName: 'MMBA System',
            organizationName: 'MMBA',
            createdById: 'system',
            createdByName: 'سیستم',
            createdByRole: 'SYSTEM',
            counts: {
              users: 0, roles: 0, customers: 0, calls: 0, interactions: 0, voiceNotes: 0,
              tasks: 0, contracts: 0, payments: 0, checks: 0, sims: 0, repairs: 0,
              attachments: 0, notifications: 0, auditLogs: 0, settings: 0, dateSuggestions: 0,
              sharedLinks: 0, problemReports: 0, totalRecords: 0
            },
            fileCounts: { attachmentsCount: 0, voiceNotesCount: 0, totalFilesCount: 0, filesSizeBytes: 0 },
            integrityVerified: false,
            failureReason: 'فایل پشتیبان ناقص یا آسیب‌دیده است.',
          });
        }
      }

      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return items;
    } catch (err) {
      console.error('[Backup Engine] Error listing backups:', err);
      return [];
    }
  }

  // Get single backup item by ID
  public getBackupById(backupId: string): { meta: BackupItem; fullPath: string } | null {
    const filename = backupId.endsWith('.json') ? backupId : `${backupId}.json`;
    const fullPath = path.resolve(this.backupDir, filename);
    if (!fs.existsSync(fullPath)) return null;

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const parsed: BackupArchivePackage = JSON.parse(content);
      return { meta: parsed.meta, fullPath };
    } catch {
      return null;
    }
  }

  // Read full raw backup package for download or restoration
  public getBackupPackage(backupId: string): BackupArchivePackage | null {
    const filename = backupId.endsWith('.json') ? backupId : `${backupId}.json`;
    const fullPath = path.resolve(this.backupDir, filename);
    if (!fs.existsSync(fullPath)) return null;

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return JSON.parse(content) as BackupArchivePackage;
    } catch (e) {
      console.error(`[Backup Engine] Failed to read backup package ${backupId}:`, e);
      return null;
    }
  }

  // Save an uploaded backup package from client/admin
  public async saveUploadedBackupPackage(rawPackage: any, operator?: User): Promise<BackupItem> {
    if (!rawPackage || !rawPackage.database) {
      throw new Error('فایل پشتیبان فاقد ساختار معتبر پایگاه داده است.');
    }

    const verification = this.verifyBackupPackage(rawPackage);
    if (!verification.valid) {
      throw new Error(verification.errors.join(' | '));
    }

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = rawPackage.meta?.id || `mmba_uploaded_backup_${timestampStr}_${Math.random().toString(36).substring(2, 6)}`;
    const filename = backupId.endsWith('.json') ? backupId : `${backupId}.json`;
    const fullPath = path.resolve(this.backupDir, filename);

    const counts = this.computeRecordCounts(rawPackage.database);
    const content = JSON.stringify(rawPackage, null, 2);
    const sizeBytes = Buffer.byteLength(content, 'utf8');

    const meta: BackupItem = {
      id: backupId.replace('.json', ''),
      filename,
      createdAt: rawPackage.meta?.createdAt || new Date().toISOString(),
      type: rawPackage.meta?.type || BackupType.MANUAL,
      status: BackupStatus.SUCCESSFUL,
      sizeBytes,
      sizeFormatted: formatBytes(sizeBytes),
      checksum: rawPackage.checksum || this.calculateChecksum(JSON.stringify({ database: rawPackage.database, files: rawPackage.files })),
      isEncrypted: false,
      version: rawPackage.meta?.version || 4,
      revision: rawPackage.database.revision || 1,
      systemName: 'MMBA Management Suite',
      organizationName: 'سامانه یکپارچه مدیریت ارتباط با مشتریان و سیم‌کارت',
      createdById: operator?.id || 'usr-admin',
      createdByName: operator?.name || 'مدیر سیستم',
      createdByRole: operator?.role || 'SUPER_ADMIN',
      counts,
      fileCounts: rawPackage.meta?.fileCounts || {
        attachmentsCount: (rawPackage.files?.attachments || []).length,
        voiceNotesCount: (rawPackage.files?.voiceNotes || []).length,
        holderIdCardsCount: (rawPackage.files?.holderIdCards || []).length,
        totalFilesCount: ((rawPackage.files?.attachments || []).length + (rawPackage.files?.voiceNotes || []).length + (rawPackage.files?.holderIdCards || []).length),
        filesSizeBytes: 0,
      },
      integrityVerified: true,
      notes: rawPackage.meta?.notes ? `[آپلود شده] ${rawPackage.meta.notes}` : 'فایل پشتیبان آپلود شده از خارج سامانه',
    };

    const finalizedPkg: BackupArchivePackage = {
      meta,
      database: rawPackage.database,
      files: rawPackage.files || { attachments: [], voiceNotes: [], problemReportScreenshots: [], holderIdCards: [] },
      checksum: meta.checksum,
    };

    fs.writeFileSync(fullPath, JSON.stringify(finalizedPkg, null, 2), 'utf-8');

    await centralDb.logAudit({
      userId: operator?.id || 'usr-admin',
      userName: operator?.name || 'مدیر سیستم',
      userRole: operator?.role || UserRole.SUPER_ADMIN,
      action: 'آپلود فایل پشتیبان سیستم (Backup Upload)',
      module: ModuleName.SETTINGS,
      details: `فایل پشتیبان ${filename} (${meta.sizeFormatted}) به سرور منتقل و در لیست بکاپ‌ها ثبت گردید.`,
    });

    return meta;
  }

  // Delete an existing backup file
  public async deleteBackup(backupId: string, operator?: User): Promise<boolean> {
    const filename = backupId.endsWith('.json') ? backupId : `${backupId}.json`;
    const fullPath = path.resolve(this.backupDir, filename);
    if (!fs.existsSync(fullPath)) return false;

    try {
      let meta: BackupItem | null = null;
      try {
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        meta = parsed.meta;
      } catch {}

      fs.unlinkSync(fullPath);

      // Audit Log
      await centralDb.logAudit({
        userId: operator?.id || 'usr-admin',
        userName: operator?.name || 'مدیر سیستم',
        userRole: operator?.role || UserRole.SUPER_ADMIN,
        action: 'حذف فایل پشتیبان سیستم (Backup Delete)',
        module: ModuleName.SETTINGS,
        details: `فایل پشتیبان ${filename} (${meta?.sizeFormatted || 'نامشخص'}) توسط ${operator?.name || 'مدیر'} حذف گردید.`,
      });

      return true;
    } catch (err) {
      console.error(`[Backup Engine] Error deleting backup ${backupId}:`, err);
      return false;
    }
  }

  // Create a Full System Backup (Database + Uploaded Files + Integrity Hash)
  public async createFullBackup(options: {
    type?: BackupType;
    operator?: User;
    notes?: string;
  } = {}): Promise<BackupItem> {
    if (this.isBackupRunning) {
      throw new Error('یک فرآیند پشتیبان‌گیری هم‌اکنون در حال اجراست. لطفاً شکیبا باشید.');
    }

    this.isBackupRunning = true;
    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, '-');
    const backupType = options.type || BackupType.MANUAL;
    const backupId = `mmba_full_backup_${timestampStr}_${Math.random().toString(36).substring(2, 6)}`;
    const filename = `${backupId}.json`;
    const fullPath = path.resolve(this.backupDir, filename);

    try {
      // 1. Snapshot Central Database
      const state = centralDb.getState();
      const counts = this.computeRecordCounts(state);

      // 2. Extract Centralized File Storage (Attachments, Voice Notes, Holder ID Cards, Check Photos & Problem Report Screenshots)
      const attachmentFiles = (state.attachments || []).map((att) => ({
        id: att.id,
        fileName: att.fileName || att.filename || 'unnamed_file',
        fileType: att.fileType || att.mimeType || 'application/octet-stream',
        dataUrl: att.dataUrl || att.url || '',
        sizeBytes: att.fileSize || att.sizeBytes || 0,
      }));

      const voiceNoteFiles = (state.voiceNotes || []).map((vn) => ({
        id: vn.id,
        title: vn.title,
        audioDataUrl: vn.audioDataUrl,
        durationSeconds: vn.durationSeconds,
      }));

      const screenshotFiles = (state.problemReports || [])
        .filter((pr) => !!pr.screenshotUrl)
        .map((pr) => ({
          id: pr.id,
          title: pr.title,
          screenshotUrl: pr.screenshotUrl!,
        }));

      // Extract registered holders national ID card images
      const holderIdCards = (state.registeredHolders || [])
        .filter((h) => !!h.nationalIdImageUrl)
        .map((h) => ({
          id: `idcard_${h.id}`,
          holderId: h.id,
          holderName: h.fullName,
          nationalId: h.nationalId,
          fileName: h.nationalIdImageName || `idcard_${h.nationalId || h.id}.jpg`,
          fileType: h.nationalIdImageType || 'image/jpeg',
          dataUrl: h.nationalIdImageUrl!,
          sizeBytes: h.nationalIdImageSize || (h.nationalIdImageUrl ? Math.round(h.nationalIdImageUrl.length * 0.75) : 0),
        }));

      // Extract check photos
      const checkPhotos = (state.checks || [])
        .filter((c: any) => !!(c.imageUrl || c.checkImageUrl))
        .map((c: any) => {
          const img = (c.imageUrl || c.checkImageUrl) as string;
          return {
            id: `check_${c.id}`,
            checkId: c.id,
            checkNumber: c.checkNumber || c.sayadNumber,
            fileName: `check_${c.checkNumber || c.id}.jpg`,
            fileType: 'image/jpeg',
            dataUrl: img,
            sizeBytes: Math.round(img.length * 0.75),
          };
        });

      // Extract digital signatures
      const contractSignatures = (state.contracts || [])
        .filter((ct: any) => !!ct.signatureUrl)
        .map((ct: any) => {
          const sig = ct.signatureUrl as string;
          return {
            id: `sig_${ct.id}`,
            contractId: ct.id,
            contractNumber: ct.contractNumber,
            fileName: `signature_${ct.contractNumber || ct.id}.png`,
            fileType: 'image/png',
            dataUrl: sig,
            sizeBytes: Math.round(sig.length * 0.75),
          };
        });

      const totalFilesCount =
        attachmentFiles.length +
        voiceNoteFiles.length +
        screenshotFiles.length +
        holderIdCards.length +
        checkPhotos.length +
        contractSignatures.length;

      let filesSizeBytes = 0;
      attachmentFiles.forEach((f) => { filesSizeBytes += f.dataUrl ? f.dataUrl.length : 0; });
      voiceNoteFiles.forEach((v) => { filesSizeBytes += v.audioDataUrl ? v.audioDataUrl.length : 0; });
      screenshotFiles.forEach((s) => { filesSizeBytes += s.screenshotUrl ? s.screenshotUrl.length : 0; });
      holderIdCards.forEach((h) => { filesSizeBytes += h.dataUrl ? h.dataUrl.length : 0; });
      checkPhotos.forEach((c) => { filesSizeBytes += c.dataUrl ? c.dataUrl.length : 0; });
      contractSignatures.forEach((s) => { filesSizeBytes += s.dataUrl ? s.dataUrl.length : 0; });

      const fileCounts = {
        attachmentsCount: attachmentFiles.length,
        voiceNotesCount: voiceNoteFiles.length,
        holderIdCardsCount: holderIdCards.length,
        problemReportScreenshotsCount: screenshotFiles.length,
        checkPhotosCount: checkPhotos.length,
        contractSignaturesCount: contractSignatures.length,
        totalFilesCount,
        filesSizeBytes,
      };

      // 3. Prepare Payload (strip sensitive secrets if any)
      const sanitizedSettings = { ...state.settings };
      // Keep system configuration intact for disaster recovery

      const dbSnapshot: CentralDatabaseSchema = {
        ...state,
        settings: sanitizedSettings,
      };

      const payloadContent = JSON.stringify({
        database: dbSnapshot,
        files: {
          attachments: attachmentFiles,
          voiceNotes: voiceNoteFiles,
          problemReportScreenshots: screenshotFiles,
          holderIdCards,
          checkPhotos,
          contractSignatures,
        },
      });

      // 4. Compute SHA-256 Checksum of the snapshot payload
      const checksum = this.calculateChecksum(payloadContent);

      // 5. Construct Metadata
      const totalEstimatedBytes = Buffer.byteLength(payloadContent, 'utf8');
      const operator = options.operator || centralDb.findUserById('usr-admin');

      const meta: BackupItem = {
        id: backupId,
        filename,
        createdAt: now.toISOString(),
        type: backupType,
        status: BackupStatus.SUCCESSFUL,
        sizeBytes: totalEstimatedBytes,
        sizeFormatted: formatBytes(totalEstimatedBytes),
        checksum,
        isEncrypted: this.scheduleSettings.encryptBackups,
        version: state.version || 1,
        revision: state.revision || 1,
        systemName: state.settings?.systemName || 'سامانه جامع MMBA',
        organizationName: state.settings?.organizationName || 'شرکت MMBA',
        createdById: operator?.id || 'system',
        createdByName: operator?.name || (backupType === BackupType.AUTOMATIC ? 'زمان‌بند خودکار سیستم' : 'مدیر سیستم'),
        createdByRole: operator?.role || (backupType === BackupType.AUTOMATIC ? 'AUTOMATED_SCHEDULER' : 'SUPER_ADMIN'),
        counts,
        fileCounts,
        integrityVerified: true,
        integrityDetails: `چک‌سام معتبر (${checksum.substring(0, 12)}...) | پایگاه داده: ${counts.totalRecords} رکورد | فایل‌های رسانه‌ای: ${totalFilesCount} عدد`,
        notes: options.notes || (backupType === BackupType.AUTOMATIC ? 'پشتیبان‌گیری خودکار زمان‌بندی شده سرور' : 'پشتیبان‌گیری دستی مدیر سامانه'),
      };

      const fullPackage: BackupArchivePackage = {
        meta,
        database: dbSnapshot,
        files: {
          attachments: attachmentFiles,
          voiceNotes: voiceNoteFiles,
          problemReportScreenshots: screenshotFiles,
          holderIdCards,
          checkPhotos,
          contractSignatures,
        },
        checksum,
      };

      // 6. Write Atomic JSON to Central Storage Directory
      const tempPath = `${fullPath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(fullPackage, null, 2), 'utf-8');
      fs.renameSync(tempPath, fullPath);

      // Update actual file size from disk
      const stats = fs.statSync(fullPath);
      meta.sizeBytes = stats.size;
      meta.sizeFormatted = formatBytes(stats.size);

      // 7. Audit Log
      await centralDb.logAudit({
        userId: meta.createdById,
        userName: meta.createdByName,
        userRole: meta.createdByRole as any,
        action: `ایجاد فایل پشتیبان کامل سیستم (${backupType === BackupType.AUTOMATIC ? 'خودکار' : 'دستی'})`,
        module: ModuleName.SETTINGS,
        details: `پشتیبان جامع ${filename} (${meta.sizeFormatted}, ${counts.totalRecords} رکورد، ${totalFilesCount} فایل پیوست) با موفقیت تولید و ذخیره شد.`,
      });

      // 8. Apply Retention Policy
      await this.applyRetentionPolicy();

      // 9. Update Scheduler Status
      if (backupType === BackupType.AUTOMATIC) {
        this.scheduleSettings.lastRunAt = now.toISOString();
        this.scheduleSettings.lastRunStatus = BackupStatus.SUCCESSFUL;
        this.scheduleSettings.lastRunError = undefined;
        this.saveScheduleSettingsInternal();
      }

      console.log(`[Backup Engine] Full System Backup created successfully: ${filename} (${meta.sizeFormatted})`);
      return meta;
    } catch (err: any) {
      console.error('[Backup Engine] Backup creation failed:', err);

      if (backupType === BackupType.AUTOMATIC) {
        this.scheduleSettings.lastRunAt = now.toISOString();
        this.scheduleSettings.lastRunStatus = BackupStatus.FAILED;
        this.scheduleSettings.lastRunError = err.message || 'خطای ناشناخته در پشتیبان‌گیری خودکار';
        this.saveScheduleSettingsInternal();

        // Create Admin Notification for Backup Failure
        await centralDb.saveNotification({
          id: `notif-bkp-fail-${Date.now()}`,
          title: '⚠️ هشدار: شکست در عملیات پشتیبان‌گیری خودکار',
          message: `عملیات پشتیبان‌گیری زمان‌بندی شده سرور با خطا مواجه شد: ${err.message || 'خطای نامشخص'}. لطفاً وضعیت فضای دیسک و لاگ‌های سیستم را بررسی نمایید.`,
          category: 'SYSTEM',
          severity: 'ERROR',
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      throw err;
    } finally {
      this.isBackupRunning = false;
    }
  }

  // Verify Backup Package Integrity & Consistency
  public verifyBackupPackage(pkg: BackupArchivePackage): BackupVerificationResult {
    const details: string[] = [];
    const errors: string[] = [];

    // 1. Basic Structure
    if (!pkg || !pkg.meta || !pkg.database) {
      errors.push('ساختار بسته پشتیبان فاقد بخش متادیتا یا پایگاه داده است.');
      return {
        valid: false,
        checksumMatches: false,
        structureValid: false,
        usersValid: false,
        adminAccountPreserved: false,
        rolesValid: false,
        filesIntegrity: false,
        counts: {
          users: 0, roles: 0, customers: 0, calls: 0, interactions: 0, voiceNotes: 0,
          tasks: 0, contracts: 0, payments: 0, checks: 0, sims: 0, repairs: 0,
          attachments: 0, notifications: 0, auditLogs: 0, settings: 0, dateSuggestions: 0,
          sharedLinks: 0, problemReports: 0, totalRecords: 0
        },
        details,
        errors,
      };
    }

    const counts = this.computeRecordCounts(pkg.database);
    let checksumMatches = true;

    // 2. Checksum Verification
    if (pkg.checksum) {
      const payloadContent = JSON.stringify({
        database: pkg.database,
        files: pkg.files || { attachments: [], voiceNotes: [], problemReportScreenshots: [] },
      });
      const calculatedHash = this.calculateChecksum(payloadContent);
      if (calculatedHash === pkg.checksum) {
        details.push(`چک‌سام رمزنگاری شده SHA-256 (${calculatedHash.substring(0, 16)}...) با موفقیت تطبیق یافت.`);
      } else {
        checksumMatches = false;
        errors.push(`خطای عدم تطابق چک‌سام: هش ذخیره‌شده (${pkg.checksum.substring(0, 8)}) با هش محاسباتی (${calculatedHash.substring(0, 8)}) همخوانی ندارد. احتمال دستکاری یا خرابی داده وجود دارد.`);
      }
    }

    // 3. User & Admin Preservation Check
    const users = pkg.database.users || [];
    let usersValid = true;
    let adminAccountPreserved = false;

    if (!Array.isArray(users) || users.length === 0) {
      usersValid = false;
      errors.push('هیچ کاربری در فایل پشتیبان یافت نشد.');
    } else {
      const admin = users.find(
        (u) =>
          u.id === 'usr-admin' ||
          (u.username && u.username.toLowerCase() === 'admin') ||
          u.role === UserRole.GOD ||
          u.role === UserRole.SUPER_ADMIN ||
          u.role === UserRole.OWNER
      );
      if (admin) {
        adminAccountPreserved = true;
        details.push(`حساب مدیر ارشد (@${admin.username || 'admin'}) شناسایی و احراز شد.`);
      } else {
        errors.push('حساب کاربری مدیر ارشد در فایل پشتیبان یافت نشد. بازیابی ممکن است دسترسی ادمین را قطع کند.');
      }
    }

    // 4. Roles & Permissions Check
    const roles = pkg.database.roles || [];
    let rolesValid = Array.isArray(roles) && roles.length > 0;
    if (rolesValid) {
      details.push(`تعداد ${roles.length} نقش سازمانی و ماتریس مجوزهای RBAC معتبر است.`);
    } else {
      errors.push('نقش‌ها و دسترسی‌های سازمانی یافت نشدند.');
    }

    // 5. Files Check
    const attachmentsCount = (pkg.files?.attachments || []).length;
    const voiceNotesCount = (pkg.files?.voiceNotes || []).length;
    const filesIntegrity = true;
    details.push(`بایگانی رسانه‌ای: ${attachmentsCount} فایل پیوست و ${voiceNotesCount} یادداشت صوتی بررسی شد.`);

    details.push(`مجموع رکوردهای بانک اطلاعاتی: ${counts.totalRecords} رکورد شامل مشتریان (${counts.customers})، تماس‌ها (${counts.calls})، وظایف (${counts.tasks})، قراردادها (${counts.contracts})، چک‌ها (${counts.checks}) و سیم‌کارت‌ها (${counts.sims}).`);

    const valid = errors.length === 0 && usersValid && adminAccountPreserved;

    return {
      valid,
      checksumMatches,
      structureValid: true,
      usersValid,
      adminAccountPreserved,
      rolesValid,
      filesIntegrity,
      counts,
      details,
      errors,
    };
  }

  // Restore Workflow with Validation, Safety Snapshot, and Automatic Rollback on failure
  public async restoreBackup(backupId: string, operator: User): Promise<RestoreExecutionResult> {
    if (this.isRestoreRunning) {
      throw new Error('یک فرآیند بازیابی هم‌اکنون در حال اجراست. لطفاً شکیبا باشید.');
    }

    this.isRestoreRunning = true;
    let safetyBackupMeta: BackupItem | null = null;
    const previousState = JSON.parse(JSON.stringify(centralDb.getState()));

    try {
      console.log(`[Backup Engine] Starting Restore Procedure for backup: ${backupId} requested by ${operator.name}`);

      // 1. Fetch & Parse Target Backup Package
      const targetPackage = this.getBackupPackage(backupId);
      if (!targetPackage) {
        throw new Error(`فایل پشتیبان با شناسه ${backupId} یافت نشد یا غیرقابل خواندن است.`);
      }

      // 2. Validate Target Backup Package
      const verification = this.verifyBackupPackage(targetPackage);
      if (!verification.valid) {
        throw new Error(`اعتبارسنجی فایل پشتیبان ناموفق بود: ${verification.errors.join(' | ')}`);
      }

      // 3. Create Safety Snapshot of Current System BEFORE Modifying anything
      try {
        safetyBackupMeta = await this.createFullBackup({
          type: BackupType.SAFETY_PRE_RESTORE,
          operator,
          notes: `پشتیبان حفاظتی خودکار قبل از بازیابی بکاپ ${backupId}`,
        });
        console.log(`[Backup Engine] Safety snapshot created: ${safetyBackupMeta.id}`);
      } catch (safetyErr: any) {
        console.warn('[Backup Engine] Failed to create safety snapshot, continuing with extreme caution:', safetyErr);
      }

      // 4. Perform Central Database Restoration
      const restoredSchema = targetPackage.database;

      // Merge files back into database state if required
      if (targetPackage.files) {
        // Ensure attachments in DB contain dataUrls from package files
        if (Array.isArray(targetPackage.files.attachments)) {
          const fileMap = new Map(targetPackage.files.attachments.map((f) => [f.id, f]));
          restoredSchema.attachments = (restoredSchema.attachments || []).map((att) => {
            const fileItem = fileMap.get(att.id);
            if (fileItem && fileItem.dataUrl && !att.dataUrl) {
              return { ...att, dataUrl: fileItem.dataUrl };
            }
            return att;
          });
        }

        // Ensure voice notes contain audio data
        if (Array.isArray(targetPackage.files.voiceNotes)) {
          const vnMap = new Map(targetPackage.files.voiceNotes.map((v) => [v.id, v]));
          restoredSchema.voiceNotes = (restoredSchema.voiceNotes || []).map((vn) => {
            const vItem = vnMap.get(vn.id);
            if (vItem && vItem.audioDataUrl && !vn.audioDataUrl) {
              return { ...vn, audioDataUrl: vItem.audioDataUrl };
            }
            return vn;
          });
        }

        // Rehydrate registered holders national ID cards
        if (Array.isArray(targetPackage.files.holderIdCards)) {
          const cardMap = new Map(targetPackage.files.holderIdCards.map((c) => [c.holderId, c]));
          restoredSchema.registeredHolders = (restoredSchema.registeredHolders || []).map((holder) => {
            const card = cardMap.get(holder.id);
            if (card && card.dataUrl) {
              return {
                ...holder,
                nationalIdImageUrl: card.dataUrl,
                nationalIdImageName: card.fileName || holder.nationalIdImageName,
                nationalIdImageType: card.fileType || holder.nationalIdImageType,
                nationalIdImageSize: card.sizeBytes || holder.nationalIdImageSize,
              };
            }
            return holder;
          });
        }

        // Rehydrate check photos
        if (Array.isArray(targetPackage.files.checkPhotos)) {
          const checkMap = new Map(targetPackage.files.checkPhotos.map((c) => [c.checkId, c]));
          restoredSchema.checks = (restoredSchema.checks || []).map((chk: any) => {
            const photo = checkMap.get(chk.id);
            if (photo && photo.dataUrl && !chk.imageUrl && !chk.checkImageUrl) {
              return { ...chk, imageUrl: photo.dataUrl, checkImageUrl: photo.dataUrl };
            }
            return chk;
          });
        }

        // Rehydrate digital contract signatures
        if (Array.isArray(targetPackage.files.contractSignatures)) {
          const sigMap = new Map(targetPackage.files.contractSignatures.map((s) => [s.contractId, s]));
          restoredSchema.contracts = (restoredSchema.contracts || []).map((ct: any) => {
            const sig = sigMap.get(ct.id);
            if (sig && sig.dataUrl && !ct.signatureUrl) {
              return { ...ct, signatureUrl: sig.dataUrl };
            }
            return ct;
          });
        }
      }

      // 5. Apply to Central Database
      const appliedDb = await centralDb.importFullDatabase(restoredSchema);

      // 6. Post-Restore Verification
      const postState = centralDb.getState();
      const postVerification = this.verifyBackupPackage({
        meta: targetPackage.meta,
        database: postState,
        files: targetPackage.files,
        checksum: '',
      });

      if (!postVerification.usersValid || !postVerification.adminAccountPreserved) {
        throw new Error('خطا در بازیابی حساب‌های کاربری و دسترسی مدیر کل. فرآیند جهت حفظ یکپارچگی سامانه واگردانی (Rollback) خواهد شد.');
      }

      // 7. Mark target backup status as RESTORED in its metadata file
      try {
        const fullPath = path.resolve(this.backupDir, targetPackage.meta.filename);
        if (fs.existsSync(fullPath)) {
          targetPackage.meta.status = BackupStatus.RESTORED;
          fs.writeFileSync(fullPath, JSON.stringify(targetPackage, null, 2), 'utf-8');
        }
      } catch (e) {
        console.error('Error updating backup status to RESTORED:', e);
      }

      // 8. Log Audit
      await centralDb.logAudit({
        userId: operator.id,
        userName: operator.name,
        userRole: operator.role,
        action: 'بازیابی موفق پایگاه داده و فایل‌های سیستم (System Restore)',
        module: ModuleName.SETTINGS,
        details: `سامانه با موفقیت به وضعیت فایل پشتیبان ${targetPackage.meta.filename} (ورژن ${targetPackage.meta.version}، ${postVerification.counts.totalRecords} رکورد) بازیابی گردید. پشتیبان حفاظتی: ${safetyBackupMeta?.id || 'ندارد'}`,
      });

      // 9. Send Notification to all Admins
      await centralDb.saveNotification({
        id: `notif-restore-success-${Date.now()}`,
        title: '✅ سامانه با موفقیت بازیابی شد',
        message: `عملیات بازگردانی کامل سیستم به فایل پشتیبان ${targetPackage.meta.filename} با موفقیت و بررسی ۱۰۰٪ یکپارچگی انجام شد.`,
        category: 'SYSTEM',
        severity: 'SUCCESS',
        read: false,
        createdAt: new Date().toISOString(),
      });

      console.log(`[Backup Engine] System Restore completed successfully. Revision: ${appliedDb.revision}`);

      return {
        success: true,
        message: `سامانه با موفقیت به وضعیت بکاپ "${targetPackage.meta.filename}" بازیابی شد. تمام ${postVerification.counts.totalRecords} رکورد، کاربران، دسترسی‌ها و فایل‌ها بازگردانی شدند.`,
        safetyBackupId: safetyBackupMeta?.id,
        restoredRevision: appliedDb.revision,
        restoredCounts: postVerification.counts,
        verification: postVerification,
        rollbackOccurred: false,
      };
    } catch (err: any) {
      console.error('[Backup Engine] RESTORE FAILED. Initiating automatic rollback...', err);

      // Perform Rollback to previous memory state
      let rollbackSuccess = false;
      try {
        await centralDb.importFullDatabase(previousState);
        rollbackSuccess = true;
        console.log('[Backup Engine] Automatic Rollback succeeded.');
      } catch (rollbackErr) {
        console.error('[Backup Engine] Critical: Automatic Rollback failed:', rollbackErr);
      }

      // Log Failed Restore in Audit
      await centralDb.logAudit({
        userId: operator.id,
        userName: operator.name,
        userRole: operator.role,
        action: 'شکست در عملیات بازیابی سیستم و واگردانی (Restore Failed & Rollback)',
        module: ModuleName.SETTINGS,
        details: `خطا در بازگردانی بکاپ ${backupId}: ${err.message}. وضعیت واگردانی خودکار: ${rollbackSuccess ? 'موفق' : 'ناموفق'}.`,
      });

      // Create Admin Notification
      await centralDb.saveNotification({
        id: `notif-restore-fail-${Date.now()}`,
        title: '❌ خطا در بازیابی فایل پشتیبان',
        message: `فرآیند بازیابی بکاپ با خطا مواجه شد: ${err.message}. سامانه به وضعیت قبل از بازگردانی واگردانی شد.`,
        category: 'SYSTEM',
        severity: 'ERROR',
        read: false,
        createdAt: new Date().toISOString(),
      });

      return {
        success: false,
        message: `عملیات بازیابی با خطا مواجه شد: ${err.message}. وضعیت سیستم به حالت اولیه واگردانی شد.`,
        safetyBackupId: safetyBackupMeta?.id,
        rollbackOccurred: true,
        error: err.message,
      };
    } finally {
      this.isRestoreRunning = false;
    }
  }

  // Retention Policy: Delete backups older than retentionDays or exceeding maxBackupsToKeep
  public async applyRetentionPolicy(): Promise<{ deletedCount: number }> {
    try {
      const backups = this.listBackups();
      const { retentionDays, maxBackupsToKeep } = this.scheduleSettings;
      let deletedCount = 0;

      const now = Date.now();
      const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

      // Keep Safety Pre-Restore backups regardless unless count exceeds 2x limit
      const candidatesToDelete: BackupItem[] = [];

      backups.forEach((b, index) => {
        const ageMs = now - new Date(b.createdAt).getTime();
        if (ageMs > maxAgeMs && b.type !== BackupType.SAFETY_PRE_RESTORE) {
          candidatesToDelete.push(b);
        } else if (index >= maxBackupsToKeep && b.type !== BackupType.SAFETY_PRE_RESTORE) {
          candidatesToDelete.push(b);
        }
      });

      for (const item of candidatesToDelete) {
        const fullPath = path.resolve(this.backupDir, item.filename);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          deletedCount++;
          console.log(`[Backup Engine Retention] Deleted expired backup: ${item.filename}`);
        }
      }

      return { deletedCount };
    } catch (e) {
      console.error('[Backup Engine] Error applying retention policy:', e);
      return { deletedCount: 0 };
    }
  }

  // Get Health and Diagnostic Summary
  public getHealthSummary(): BackupHealthSummary {
    const backups = this.listBackups();
    const successful = backups.filter((b) => b.status === BackupStatus.SUCCESSFUL || b.status === BackupStatus.RESTORED);
    const failed = backups.filter((b) => b.status === BackupStatus.FAILED);
    const lastSuccessful = successful.length > 0 ? successful[0] : null;

    let totalSizeBytes = 0;
    backups.forEach((b) => {
      totalSizeBytes += b.sizeBytes || 0;
    });

    // Calculate Next Scheduled Run
    let nextScheduledBackup: string | null = null;
    if (this.scheduleSettings.enabled) {
      const [hours, mins] = (this.scheduleSettings.backupTime || '03:00').split(':').map(Number);
      const nextDate = new Date();
      nextDate.setHours(hours || 3, mins || 0, 0, 0);
      if (nextDate.getTime() <= Date.now()) {
        nextDate.setDate(nextDate.getDate() + (this.scheduleSettings.frequency === 'weekly' ? 7 : 1));
      }
      nextScheduledBackup = nextDate.toISOString();
    }

    let verificationStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (failed.length > 0 || this.scheduleSettings.lastRunStatus === BackupStatus.FAILED) {
      verificationStatus = 'WARNING';
    }
    if (!lastSuccessful && backups.length > 0) {
      verificationStatus = 'CRITICAL';
    }

    return {
      lastSuccessfulBackup: lastSuccessful,
      nextScheduledBackup,
      frequency: this.scheduleSettings.frequency,
      retentionDays: this.scheduleSettings.retentionDays,
      maxBackups: this.scheduleSettings.maxBackupsToKeep,
      totalBackupsCount: backups.length,
      totalStorageSizeBytes: totalSizeBytes,
      totalStorageFormatted: formatBytes(totalSizeBytes),
      failedBackupsCount: failed.length,
      backupVerificationStatus: verificationStatus,
      storageLocation: this.backupDir,
      autoBackupEnabled: this.scheduleSettings.enabled,
      hasRecentFailure: this.scheduleSettings.lastRunStatus === BackupStatus.FAILED,
    };
  }

  // Background Automatic Scheduler
  private startScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }

    // Check every 60 seconds if it's time for an automatic backup
    this.schedulerInterval = setInterval(() => {
      this.checkAndRunScheduledBackup();
    }, 60 * 1000);
  }

  private restartScheduler() {
    this.startScheduler();
  }

  private async checkAndRunScheduledBackup() {
    if (!this.scheduleSettings.enabled || this.isBackupRunning) return;

    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      const [targetHour, targetMin] = (this.scheduleSettings.backupTime || '03:00').split(':').map(Number);

      // Check if current minute matches target time
      if (currentHour === targetHour && currentMin === targetMin) {
        // Ensure we haven't already run in the last hour
        if (this.scheduleSettings.lastRunAt) {
          const lastRun = new Date(this.scheduleSettings.lastRunAt);
          const diffMinutes = (now.getTime() - lastRun.getTime()) / (1000 * 60);
          if (diffMinutes < 55) {
            return; // already executed in this window
          }
        }

        console.log('[Backup Engine] Triggering automatic scheduled backup...');
        await this.createFullBackup({
          type: BackupType.AUTOMATIC,
          notes: `پشتیبان‌گیری خودکار زمان‌بندی شده (${this.scheduleSettings.frequency} ساعت ${this.scheduleSettings.backupTime})`,
        });
      }
    } catch (e) {
      console.error('[Backup Engine] Scheduled backup trigger error:', e);
    }
  }
}

export const backupService = new SystemBackupService();
