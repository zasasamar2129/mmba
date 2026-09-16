import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  User, UserRole, UserStatus, Customer, CustomerStatus, Call, Task, Contract,
  Payment, Check, SimCard, Repair, Attachment, Notification,
  AuditLog, Role, DateSuggestion, ShareableLink, VoiceNote, ModuleName, PermissionAction,
  Interaction, InteractionType, ProblemReport, Lead, LeadStatus,
  UserNotificationDevice, NotificationDelivery, NotificationSettings,
  Account, AccountType, JournalEntry, JournalEntryLine, JournalEntryStatus,
  AccountingPeriod, AccountingPeriodStatus, DocumentShare, DocumentShareStatus,
  RegisteredHolder, ContractInstallment, InstallmentStatus, TrustedBiometricDevice,
  ChatConversation, ChatMessage, ConversationType, ChatMemberRole, MessageStatus,
  ConversationPriority, Broadcast, BroadcastStatus, BroadcastRecipient, BroadcastRecipientStatus, MessageAttachment,
  ConversationMember
} from '../src/types';
import { DEFAULT_ROLES } from '../src/lib/permissions';

export const DEFAULT_SEED_ACCOUNTS: Account[] = [
  { id: 'acc-101', code: '101', name: 'صندوق مرکزی', account_type: AccountType.ASSET, is_active: true, created_at: new Date().toISOString(), description: 'موجودی نقدی صندوق شرکت' },
  { id: 'acc-102', code: '102', name: 'بانک ملت (جاری)', account_type: AccountType.ASSET, is_active: true, created_at: new Date().toISOString(), description: 'حساب بانکی اصلی شرکت' },
  { id: 'acc-103', code: '103', name: 'بانک سامان (پوز فروشگاهی)', account_type: AccountType.ASSET, is_active: true, created_at: new Date().toISOString(), description: 'حساب متصل به دستگاه پوز' },
  { id: 'acc-104', code: '104', name: 'اسناد دریافتنی (چک‌های مشتریان)', account_type: AccountType.ASSET, is_active: true, created_at: new Date().toISOString(), description: 'چک‌های در راه وصول و در صندوق' },
  { id: 'acc-105', code: '105', name: 'حساب‌های دریافتنی تجاری (مشتریان)', account_type: AccountType.ASSET, is_active: true, created_at: new Date().toISOString(), description: 'مطالبات از مشتریان' },
  { id: 'acc-201', code: '201', name: 'حساب‌های پرداختنی تجاری (تأمین‌کنندگان)', account_type: AccountType.LIABILITY, is_active: true, created_at: new Date().toISOString(), description: 'بدهی به طرف‌های تجاری و فروشندگان' },
  { id: 'acc-202', code: '202', name: 'پیش‌دریافت مشتریان', account_type: AccountType.LIABILITY, is_active: true, created_at: new Date().toISOString(), description: 'وجوه دریافتی بابت خدمات یا سیم‌کارت آتی' },
  { id: 'acc-203', code: '203', name: 'اسناد پرداختنی (چک‌های صادره شرکت)', account_type: AccountType.LIABILITY, is_active: true, created_at: new Date().toISOString(), description: 'چک‌های صادره عهده بانک‌ها' },
  { id: 'acc-301', code: '301', name: 'سرمایه اولیه سهامداران', account_type: AccountType.EQUITY, is_active: true, created_at: new Date().toISOString(), description: 'حقوق صاحبان سهام و آورده شرکا' },
  { id: 'acc-401', code: '401', name: 'درآمد حاصل از فروش خطوط و سیم‌کارت', account_type: AccountType.REVENUE, is_active: true, created_at: new Date().toISOString(), description: 'درآمد ناخالص واگذاری خطوط' },
  { id: 'acc-402', code: '402', name: 'درآمد خدمات تعمیرات و سخت‌افزار', account_type: AccountType.REVENUE, is_active: true, created_at: new Date().toISOString(), description: 'درآمد اجرت تعمیرگاه و سرویس' },
  { id: 'acc-403', code: '403', name: 'سایر درآمدهای عملیاتی و متفرقه', account_type: AccountType.REVENUE, is_active: true, created_at: new Date().toISOString(), description: 'درآمدهای غیرمستقیم' },
  { id: 'acc-501', code: '501', name: 'بهای تمام‌شده سیم‌کارت‌ها و تجهیزات', account_type: AccountType.EXPENSE, is_active: true, created_at: new Date().toISOString(), description: 'هزینه خرید خطوط' },
  { id: 'acc-502', code: '502', name: 'هزینه قطعات و ملزومات تعمیرگاهی', account_type: AccountType.EXPENSE, is_active: true, created_at: new Date().toISOString(), description: 'خرید ال‌سی‌دی، باتری و بردهای تعویضی' },
  { id: 'acc-503', code: '503', name: 'هزینه‌های عمومی و اداری', account_type: AccountType.EXPENSE, is_active: true, created_at: new Date().toISOString(), description: 'هزینه‌های جاری فروشگاه و دفتر' },
];

export const DEFAULT_SEED_PERIODS: AccountingPeriod[] = [
  { id: 'prd-1403', period: '1403', start_date: '2024-03-20T00:00:00.000Z', end_date: '2025-03-20T23:59:59.000Z', status: AccountingPeriodStatus.OPEN, created_at: new Date().toISOString() },
  { id: 'prd-1404', period: '1404', start_date: '2025-03-21T00:00:00.000Z', end_date: '2026-03-20T23:59:59.000Z', status: AccountingPeriodStatus.OPEN, created_at: new Date().toISOString() },
];

export interface CentralDatabaseSchema {
  version: number;
  revision: number;
  lastUpdatedAt: string;
  users: User[];
  roles: Role[];
  customers: Customer[];
  leads: Lead[];
  calls: Call[];
  interactions: Interaction[];
  voiceNotes: VoiceNote[];
  tasks: Task[];
  contracts: Contract[];
  payments: Payment[];
  checks: Check[];
  sims: SimCard[];
  repairs: Repair[];
  attachments: Attachment[];
  accounts: Account[];
  journalEntries: JournalEntry[];
  journalEntryLines: JournalEntryLine[];
  accountingPeriods: AccountingPeriod[];
  documentShares: DocumentShare[];
  conversations: ChatConversation[];
  chatMessages: ChatMessage[];
  broadcasts?: Broadcast[];
  broadcastRecipients?: BroadcastRecipient[];
  messageAttachments?: MessageAttachment[];
  registeredHolders: RegisteredHolder[];
  contractInstallments: ContractInstallment[];
  trustedBiometricDevices: TrustedBiometricDevice[];
  notifications: Notification[];
  userNotificationDevices: UserNotificationDevice[];
  notificationDeliveries: NotificationDelivery[];
  notificationSettings?: NotificationSettings;
  auditLogs: AuditLog[];
  dateSuggestions: DateSuggestion[];
  sharedLinks: ShareableLink[];
  problemReports: ProblemReport[];
  settings: {
    systemName: string;
    organizationName: string;
    currency: string;
    autoLockMinutes: number;
    requireTwoFactor: boolean;
    geminiApiKey?: string;
    systemPrompt?: string;
    maintenanceMode?: boolean;
    updatedAt: string;
  };
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enableNotifications: true,
  enableSound: true,
  soundVolume: 80,
  soundChime: 'crystal',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:30',
  defaultSnoozeMinutes: 15,
};

const DEFAULT_SETTINGS = {
  systemName: 'سامانه مدیریت یکپارچه مشتریان و عملیات MMBA',
  organizationName: 'شرکت خدمات ارتباطی و فناوری MMBA',
  currency: 'تومان',
  autoLockMinutes: 15,
  requireTwoFactor: false,
  updatedAt: new Date().toISOString(),
};

const SEED_USERS: User[] = [
  {
    id: 'usr-admin',
    name: 'مدیر کل سامانه (Admin)',
    username: 'admin',
    password: '123',
    email: 'admin@mmba.ir',
    mobile: '09120000000',
    role: UserRole.SUPER_ADMIN,
    department: 'مدیریت ارشد',
    status: UserStatus.ACTIVE,
    avatar: '/avatars/avatar-1.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  },
];

export function normalizePhone(raw: string | undefined | null): string {
  if (!raw) return '';
  let str = String(raw).trim();
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  for (let i = 0; i < 10; i++) {
    str = str.replace(new RegExp(persianDigits[i], 'g'), String(i));
    str = str.replace(new RegExp(arabicDigits[i], 'g'), String(i));
  }
  str = str.replace(/\D/g, '');
  if (str.startsWith('98') && str.length === 12) {
    str = '0' + str.substring(2);
  } else if (str.startsWith('0098') && str.length === 14) {
    str = '0' + str.substring(4);
  }
  return str;
}

// Merge persisted roles with the latest DEFAULT_ROLES definitions so newly added
// roles survive server restarts and restores. Persisted entries are retained;
// definitions win on name conflict and any new definitions are appended.
function mergeRoles(persisted: Role[], seedRoles: Role[]): Role[] {
  if (!Array.isArray(persisted) || persisted.length === 0) return seedRoles;
  const byName = new Map<string, Role>();
  persisted.forEach((r) => byName.set(r.name, r));
  seedRoles.forEach((r) => byName.set(r.name, r)); // seed wins on name conflict
  return Array.from(byName.values());
}

class CentralDatabase {
  private dbPath: string;
  private memoryDb: CentralDatabaseSchema | null = null;
  private isWriting = false;
  private writeQueue: (() => Promise<void>)[] = [];

  constructor() {
    const rawPath = process.env.DATABASE_PATH || './data/mmba_production_database.json';
    this.dbPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
    this.init();
  }

  private init() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, 'utf-8');
        try {
          const parsed = JSON.parse(content);
          this.memoryDb = this.sanitizeAndMigrate(parsed);
          console.log(`[MMBA Central DB] Loaded centralized database from ${this.dbPath} (Revision: ${this.memoryDb.revision}, Users: ${this.memoryDb.users.length}, Customers: ${this.memoryDb.customers.length})`);
        } catch (e) {
          console.error('[MMBA Central DB] Database file corrupted, creating backup and seeding initial state:', e);
          const backupPath = `${this.dbPath}.corrupt.${Date.now()}.bak`;
          fs.writeFileSync(backupPath, content);
          this.memoryDb = this.createDefaultSeed();
          this.persistSync();
        }
      } else {
        console.log(`[MMBA Central DB] Initializing fresh centralized production database at ${this.dbPath}`);
        this.memoryDb = this.createDefaultSeed();
        this.persistSync();
      }
    } catch (err) {
      console.error('[MMBA Central DB] Failed to initialize database file, falling back to memory seed:', err);
      this.memoryDb = this.createDefaultSeed();
    }
  }

  private createDefaultSeed(): CentralDatabaseSchema {
    return {
      version: 1,
      revision: 1,
      lastUpdatedAt: new Date().toISOString(),
      users: SEED_USERS,
      roles: DEFAULT_ROLES,
      customers: [],
      leads: [],
      calls: [],
      interactions: [],
      voiceNotes: [],
      tasks: [],
      contracts: [],
      payments: [],
      checks: [],
      sims: [],
      repairs: [],
      attachments: [],
      accounts: DEFAULT_SEED_ACCOUNTS,
      journalEntries: [],
      journalEntryLines: [],
      accountingPeriods: DEFAULT_SEED_PERIODS,
      documentShares: [],
      conversations: [],
      chatMessages: [],
      registeredHolders: [],
      contractInstallments: [],
      trustedBiometricDevices: [],
      notifications: [],
      userNotificationDevices: [],
      notificationDeliveries: [],
      notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      auditLogs: [
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: 'usr-admin',
          userName: 'مدیر کل سامانه (Admin)',
          userRole: UserRole.SUPER_ADMIN,
          action: 'راه‌اندازی پایگاه داده مرکزی MMBA',
          module: ModuleName.SETTINGS,
          details: 'بانک اطلاعاتی متمرکز سرور با موفقیت ایجاد گردید.',
        }
      ],
      dateSuggestions: [],
      sharedLinks: [],
      problemReports: [],
      settings: DEFAULT_SETTINGS,
    };
  }

  private sanitizeAndMigrate(data: any): CentralDatabaseSchema {
    const seed = this.createDefaultSeed();
    const rawUsers: User[] = Array.isArray(data?.users) && data.users.length > 0 ? data.users : seed.users;

    // Deduplicate and normalize all users, guaranteeing EXACTLY ONE centralized @admin account
    const deduplicatedUsers: User[] = [];
    const seenUsernames = new Set<string>();
    const seenIds = new Set<string>();

    // 1. Locate primary admin account if present in saved database
    const rawAdmin = rawUsers.find(
      (u) =>
        u.id === 'usr-admin' ||
        (u.username && u.username.toLowerCase() === 'admin') ||
        u.role === UserRole.GOD ||
        String(u.role).toUpperCase() === 'GOD' ||
        u.role === UserRole.SUPER_ADMIN ||
        u.role === UserRole.OWNER
    );

    const masterAdmin: User = {
      ...(SEED_USERS[0]),
      ...(rawAdmin || {}),
      id: 'usr-admin',
      username: 'admin',
      role: rawAdmin?.role || UserRole.SUPER_ADMIN,
      isActive: true,
      status: UserStatus.ACTIVE,
    };

    deduplicatedUsers.push(masterAdmin);
    seenUsernames.add('admin');
    seenIds.add('usr-admin');

    // 2. Process and normalize other users, deduplicating by normalized username and ID
    for (const u of rawUsers) {
      if (!u) continue;
      const normUsername = (u.username || '').trim().toLowerCase();
      const normId = (u.id || '').trim();

      // Skip admin as it is already added as the deterministic masterAdmin
      if (normUsername === 'admin' || normId === 'usr-admin') {
        continue;
      }

      if (normUsername && seenUsernames.has(normUsername)) {
        continue;
      }

      if (normId && seenIds.has(normId)) {
        continue;
      }

      const finalId = normId || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const cleanUser: User = {
        ...u,
        id: finalId,
        username: normUsername || u.username,
      };

      if (normUsername) seenUsernames.add(normUsername);
      seenIds.add(finalId);
      deduplicatedUsers.push(cleanUser);
    }

    const clean: CentralDatabaseSchema = {
      version: data?.version || seed.version,
      revision: data?.revision || 1,
      lastUpdatedAt: data?.lastUpdatedAt || new Date().toISOString(),
      users: deduplicatedUsers,
      // Merge persisted roles with the latest definitions so newly-added roles
      // (e.g. FINANCE_MANAGER / SALES_AGENT / TECHNICIAN / READ_ONLY) survive
      // server restarts and restores. Persisted entries are kept; DEFAULT_ROLES
      // definitions win on name conflict and any extras are appended.
      roles: mergeRoles(Array.isArray(data?.roles) ? data.roles : [], seed.roles),
      customers: Array.isArray(data?.customers) ? data.customers : [],
      leads: Array.isArray(data?.leads) ? data.leads : [],
      calls: Array.isArray(data?.calls) ? data.calls : [],
      interactions: Array.isArray(data?.interactions) ? data.interactions : [],
      voiceNotes: Array.isArray(data?.voiceNotes) ? data.voiceNotes : [],
      tasks: Array.isArray(data?.tasks) ? data.tasks : [],
      contracts: Array.isArray(data?.contracts) ? data.contracts : [],
      payments: Array.isArray(data?.payments) ? data.payments : [],
      checks: Array.isArray(data?.checks) ? data.checks : [],
      sims: Array.isArray(data?.sims) ? data.sims : [],
      repairs: Array.isArray(data?.repairs) ? data.repairs : [],
      attachments: Array.isArray(data?.attachments) ? data.attachments : [],
      accounts: Array.isArray(data?.accounts) && data.accounts.length > 0 ? data.accounts : DEFAULT_SEED_ACCOUNTS,
      journalEntries: Array.isArray(data?.journalEntries) ? data.journalEntries : [],
      journalEntryLines: Array.isArray(data?.journalEntryLines) ? data.journalEntryLines : [],
      accountingPeriods: Array.isArray(data?.accountingPeriods) && data.accountingPeriods.length > 0 ? data.accountingPeriods : DEFAULT_SEED_PERIODS,
      documentShares: Array.isArray(data?.documentShares) ? data.documentShares : [],
      conversations: Array.isArray(data?.conversations) ? data.conversations : [],
      chatMessages: Array.isArray(data?.chatMessages) ? data.chatMessages : [],
      registeredHolders: Array.isArray(data?.registeredHolders) ? data.registeredHolders : [],
      contractInstallments: Array.isArray(data?.contractInstallments) ? data.contractInstallments : [],
      trustedBiometricDevices: Array.isArray(data?.trustedBiometricDevices) ? data.trustedBiometricDevices : [],
      notifications: Array.isArray(data?.notifications) ? data.notifications : [],
      userNotificationDevices: Array.isArray(data?.userNotificationDevices) ? data.userNotificationDevices : [],
      notificationDeliveries: Array.isArray(data?.notificationDeliveries) ? data.notificationDeliveries : [],
      notificationSettings: data?.notificationSettings ? { ...DEFAULT_NOTIFICATION_SETTINGS, ...data.notificationSettings } : DEFAULT_NOTIFICATION_SETTINGS,
      auditLogs: Array.isArray(data?.auditLogs) ? data.auditLogs : seed.auditLogs,
      dateSuggestions: Array.isArray(data?.dateSuggestions) ? data.dateSuggestions : [],
      sharedLinks: Array.isArray(data?.sharedLinks) ? data.sharedLinks : [],
      problemReports: Array.isArray(data?.problemReports) ? data.problemReports : [],
      settings: data?.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : DEFAULT_SETTINGS,
    };

    return clean;
  }

  private async processWriteQueue() {
    if (this.isWriting || this.writeQueue.length === 0) return;
    this.isWriting = true;
    const task = this.writeQueue.shift();
    if (task) {
      try {
        await task();
      } catch (err) {
        console.error('[MMBA Central DB] Write task error:', err);
      }
    }
    this.isWriting = false;
    if (this.writeQueue.length > 0) {
      setImmediate(() => this.processWriteQueue());
    }
  }

  public async persist(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.writeQueue.push(async () => {
        try {
          if (!this.memoryDb) return;
          this.memoryDb.revision = (this.memoryDb.revision || 0) + 1;
          this.memoryDb.lastUpdatedAt = new Date().toISOString();

          const tempFile = `${this.dbPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
          const json = JSON.stringify(this.memoryDb, null, 2);
          await fs.promises.writeFile(tempFile, json, 'utf-8');
          await fs.promises.rename(tempFile, this.dbPath);
          resolve();
        } catch (err) {
          console.error('[MMBA Central DB] Persistence failed:', err);
          reject(err);
        }
      });
      this.processWriteQueue();
    });
  }

  private persistSync(): void {
    if (!this.memoryDb) return;
    try {
      const tempFile = `${this.dbPath}.tmp.sync`;
      const json = JSON.stringify(this.memoryDb, null, 2);
      fs.writeFileSync(tempFile, json, 'utf-8');
      fs.renameSync(tempFile, this.dbPath);
    } catch (e) {
      console.error('[MMBA Central DB] Sync persist error:', e);
    }
  }

  // State Accessors
  public getState(): CentralDatabaseSchema {
    if (!this.memoryDb) {
      this.init();
    }
    return this.memoryDb!;
  }

  public getDatabase(): CentralDatabaseSchema {
    return this.getState();
  }

  public getRevisionInfo(): { revision: number; lastUpdatedAt: string } {
    const state = this.getState();
    return {
      revision: state.revision,
      lastUpdatedAt: state.lastUpdatedAt,
    };
  }

  // Transaction Mutation Helper
  public async mutate<T>(mutationFn: (db: CentralDatabaseSchema) => T): Promise<T> {
    const state = this.getState();
    const result = mutationFn(state);
    await this.persist();
    return result;
  }

  // Auth Operations
  public findUserByCredential(usernameOrEmailOrMobile: string): User | undefined {
    const clean = usernameOrEmailOrMobile.trim().toLowerCase();
    const cleanPhone = clean.replace(/\s+/g, '');
    return this.getState().users.find(
      (u) =>
        (u.username && u.username.toLowerCase() === clean) ||
        (u.email && u.email.toLowerCase() === clean) ||
        (u.mobile && u.mobile.replace(/\s+/g, '') === cleanPhone)
    );
  }

  public findUserById(id: string): User | undefined {
    return this.getState().users.find((u) => u.id === id);
  }

  public async saveUser(user: User): Promise<User> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const normUsername = (user.username || '').trim().toLowerCase();
      const normEmail = (user.email || '').trim().toLowerCase();
      const targetId = (user.id || '').trim();

      // Find existing user by ID or by normalized username or email
      const existingIdx = db.users.findIndex((u) => {
        if (targetId && u.id === targetId) return true;
        if (normUsername && u.username && u.username.toLowerCase() === normUsername) return true;
        if (normEmail && u.email && u.email.toLowerCase() === normEmail) return true;
        return false;
      });

      if (existingIdx >= 0) {
        const existing = db.users[existingIdx];
        const finalId = (normUsername === 'admin' || existing.username?.toLowerCase() === 'admin')
          ? 'usr-admin'
          : (existing.id || targetId || `usr-${Date.now()}`);

        const finalUsername = normUsername || existing.username;
        const finalRole = (finalUsername === 'admin' || finalId === 'usr-admin')
          ? (user.role || existing.role || UserRole.SUPER_ADMIN)
          : (user.role || existing.role);

        db.users[existingIdx] = {
          ...existing,
          ...user,
          id: finalId,
          username: finalUsername,
          role: finalRole,
          updatedAt: now,
        };

        // Remove any other duplicate entries with the same ID or username
        db.users = db.users.filter(
          (u, idx) => idx === existingIdx || (u.id !== finalId && u.username?.toLowerCase() !== finalUsername.toLowerCase())
        );

        return db.users[existingIdx];
      } else {
        const finalId = (normUsername === 'admin' || targetId === 'usr-admin')
          ? 'usr-admin'
          : (targetId || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);

        const newUser: User = {
          ...user,
          id: finalId,
          username: normUsername || user.username,
          createdAt: user.createdAt || now,
          updatedAt: now,
        };
        db.users.push(newUser);
        return newUser;
      }
    });
  }

  public async deleteUser(id: string): Promise<boolean> {
    return this.mutate((db) => {
      const initialLen = db.users.length;
      db.users = db.users.filter((u) => u.id !== id);
      return db.users.length < initialLen;
    });
  }

  public async resetUserPassword(id: string, newPassword: string): Promise<User> {
    return this.mutate((db) => {
      const idx = db.users.findIndex((u) => u.id === id || u.username?.toLowerCase() === id.toLowerCase());
      if (idx < 0) {
        throw new Error('کاربر مورد نظر یافت نشد.');
      }
      db.users[idx] = {
        ...db.users[idx],
        password: newPassword,
        updatedAt: new Date().toISOString(),
      };
      return db.users[idx];
    });
  }

  // Customer Operations
  public findCustomerByMobile(mobile: string): Customer | undefined {
    const clean = normalizePhone(mobile);
    if (!clean) return undefined;
    const db = this.getState();
    return db.customers?.find((c) => {
      const cMob = normalizePhone(c.mobile);
      const cPh = normalizePhone(c.phone);
      return (cMob && cMob === clean) || (cPh && cPh === clean);
    });
  }

  public async saveCustomer(customer: Customer): Promise<Customer> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const existingIdx = db.customers.findIndex((c) => c.id === customer.id);
      if (existingIdx >= 0) {
        db.customers[existingIdx] = {
          ...db.customers[existingIdx],
          ...customer,
          updatedAt: now,
        };
        return db.customers[existingIdx];
      } else {
        const newCustomer: Customer = {
          ...customer,
          id: customer.id || `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: customer.createdAt || now,
          updatedAt: now,
        };
        db.customers.unshift(newCustomer);
        return newCustomer;
      }
    });
  }

  public async deleteCustomer(id: string): Promise<boolean> {
    return this.mutate((db) => {
      const initialLen = db.customers.length;
      db.customers = db.customers.filter((c) => c.id !== id);
      return db.customers.length < initialLen;
    });
  }

  public async deleteMultipleCustomers(ids: string[]): Promise<number> {
    return this.mutate((db) => {
      const set = new Set(ids);
      const initialLen = db.customers.length;
      db.customers = db.customers.filter((c) => !set.has(c.id));
      return initialLen - db.customers.length;
    });
  }

  // Lead Operations
  public getLeads(filter?: {
    status?: string;
    query?: string;
  }): Lead[] {
    const db = this.getState();
    let list = Array.isArray(db.leads) ? [...db.leads] : [];

    if (!filter) return list;

    if (filter.status && filter.status !== 'ALL') {
      list = list.filter((l) => l.status === filter.status);
    }
    if (filter.query) {
      const q = filter.query.trim().toLowerCase();
      const qNorm = normalizePhone(q);
      list = list.filter((l) => {
        const matchName = l.name && l.name.toLowerCase().includes(q);
        const matchCode = l.leadCode && l.leadCode.toLowerCase().includes(q);
        const matchMobile = l.mobile && (l.mobile.includes(q) || (qNorm && normalizePhone(l.mobile).includes(qNorm)));
        const matchNotes = l.notes && l.notes.toLowerCase().includes(q);
        return matchName || matchCode || matchMobile || matchNotes;
      });
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public findLeadById(id: string): Lead | undefined {
    const db = this.getState();
    return db.leads?.find((l) => l.id === id || l.leadCode === id);
  }

  public findLeadByMobile(mobile: string): Lead | undefined {
    const clean = normalizePhone(mobile);
    if (!clean) return undefined;
    const db = this.getState();
    return db.leads?.find((l) => normalizePhone(l.mobile) === clean);
  }

  public async saveLead(lead: Partial<Lead> & { mobile: string }): Promise<Lead> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      if (!db.leads) db.leads = [];

      const normMobile = normalizePhone(lead.mobile) || lead.mobile;
      const existingIdx = db.leads.findIndex(
        (l) => (lead.id && l.id === lead.id) || (lead.leadCode && l.leadCode === lead.leadCode) || normalizePhone(l.mobile) === normMobile
      );

      if (existingIdx >= 0) {
        const current = db.leads[existingIdx];
        const updated: Lead = {
          ...current,
          ...lead,
          mobile: normMobile || current.mobile,
          updatedAt: now,
        };
        db.leads[existingIdx] = updated;
        return updated;
      } else {
        const count = db.leads.length + 1;
        const leadCode = lead.leadCode || `LEAD-${1000 + count}`;
        const newLead: Lead = {
          id: lead.id || `lead-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          leadCode,
          mobile: normMobile,
          name: lead.name || '',
          status: lead.status || LeadStatus.NEW_LEAD,
          source: lead.source || 'تماس ورودی',
          notes: lead.notes || '',
          assignedUserId: lead.assignedUserId,
          assignedUserName: lead.assignedUserName,
          createdAt: lead.createdAt || now,
          updatedAt: now,
          interactionCount: lead.interactionCount || 0,
        };
        db.leads.unshift(newLead);
        return newLead;
      }
    });
  }

  public async deleteLead(id: string): Promise<boolean> {
    return this.mutate((db) => {
      if (!db.leads) return false;
      const initialLen = db.leads.length;
      db.leads = db.leads.filter((l) => l.id !== id && l.leadCode !== id);
      return db.leads.length < initialLen;
    });
  }

  public async convertLeadToCustomer(leadId: string, customerData: Partial<Customer>): Promise<{ customer: Customer; lead: Lead }> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      if (!db.leads) db.leads = [];
      if (!db.customers) db.customers = [];

      const leadIdx = db.leads.findIndex((l) => l.id === leadId || l.leadCode === leadId);
      if (leadIdx < 0) {
        throw new Error('سرنخ با شناسه مورد نظر یافت نشد.');
      }
      const lead = db.leads[leadIdx];

      const normMobile = normalizePhone(customerData.mobile || lead.mobile);
      let existingCust = db.customers.find((c) => (customerData.id && c.id === customerData.id) || (normMobile && normalizePhone(c.mobile) === normMobile));

      let finalCustomer: Customer;
      if (existingCust) {
        // Update existing customer, attach leadId
        existingCust = {
          ...existingCust,
          ...customerData,
          name: (customerData.name || existingCust.name).trim(),
          leadId: lead.id,
          leadCode: lead.leadCode,
          updatedAt: now,
        };
        finalCustomer = existingCust;
      } else {
        const nextCode = `CUST-${1000 + db.customers.length + 1}`;
        finalCustomer = {
          id: customerData.id || `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          code: customerData.code || nextCode,
          name: (customerData.name || lead.name || 'مشتری جدید').trim(),
          mobile: normMobile || lead.mobile,
          phone: customerData.phone,
          nationalId: customerData.nationalId || customerData.nationalCode,
          nationalCode: customerData.nationalCode || customerData.nationalId,
          company: customerData.company || customerData.companyName,
          companyName: customerData.companyName || customerData.company,
          address: customerData.address,
          city: customerData.city,
          notes: [lead.notes, customerData.notes].filter(Boolean).join('\n') || lead.notes,
          status: customerData.status || CustomerStatus.ACTIVE,
          leadStage: 'WON',
          leadId: lead.id,
          leadCode: lead.leadCode,
          createdAt: now,
          updatedAt: now,
        };
        db.customers.unshift(finalCustomer);
      }

      // Update Lead status to CONVERTED
      const updatedLead: Lead = {
        ...lead,
        status: LeadStatus.CONVERTED,
        convertedCustomerId: finalCustomer.id,
        convertedCustomerName: finalCustomer.name,
        convertedAt: now,
        updatedAt: now,
      };
      db.leads[leadIdx] = updatedLead;

      // Migrate/re-link all interactions, calls, tasks from lead to customer
      if (Array.isArray(db.interactions)) {
        db.interactions = db.interactions.map((inter) => {
          if (inter.lead_id === lead.id || inter.leadId === lead.id || (inter.customerMobile && normalizePhone(inter.customerMobile) === normMobile)) {
            return {
              ...inter,
              customer_id: finalCustomer.id,
              customerId: finalCustomer.id,
              customerName: finalCustomer.name,
              lead_id: lead.id,
              leadId: lead.id,
              leadCode: lead.leadCode,
            };
          }
          return inter;
        });
      }

      if (Array.isArray(db.calls)) {
        db.calls = db.calls.map((call) => {
          if (call.leadId === lead.id || (call.customerMobile && normalizePhone(call.customerMobile) === normMobile)) {
            return {
              ...call,
              customerId: finalCustomer.id,
              customerName: finalCustomer.name,
              leadId: lead.id,
              leadCode: lead.leadCode,
            };
          }
          return call;
        });
      }

      if (Array.isArray(db.tasks)) {
        db.tasks = db.tasks.map((task) => {
          if (task.leadId === lead.id) {
            return {
              ...task,
              customerId: finalCustomer.id,
              customerName: finalCustomer.name,
            };
          }
          return task;
        });
      }

      return { customer: finalCustomer, lead: updatedLead };
    });
  }

  // Call Operations
  public async saveCall(call: Call): Promise<Call> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const existingIdx = db.calls.findIndex((c) => c.id === call.id);
      if (existingIdx >= 0) {
        db.calls[existingIdx] = { ...db.calls[existingIdx], ...call };
        return db.calls[existingIdx];
      } else {
        const newCall: Call = {
          ...call,
          id: call.id || `call-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: call.createdAt || now,
        };
        db.calls.unshift(newCall);
        return newCall;
      }
    });
  }

  public async deleteCall(id: string): Promise<boolean> {
    return this.mutate((db) => {
      const len = db.calls.length;
      db.calls = db.calls.filter((c) => c.id !== id);
      return db.calls.length < len;
    });
  }

  // Interaction (Call Center) Operations
  public findInteractionById(id: string): Interaction | undefined {
    const db = this.getState();
    return db.interactions?.find((i) => String(i.id) === String(id));
  }

  public getInteractions(filter?: {
    customerId?: string;
    leadId?: string;
    mobile?: string;
    type?: string;
    from?: string;
    to?: string;
    followUpRequired?: boolean;
    followUpFrom?: string;
    followUpTo?: string;
  }): Interaction[] {
    const db = this.getState();
    let list = Array.isArray(db.interactions) ? [...db.interactions] : [];

    if (!filter) return list;

    if (filter.customerId) {
      list = list.filter((i) => i.customer_id === filter.customerId || i.customerId === filter.customerId);
    }
    if (filter.leadId) {
      list = list.filter((i) => i.lead_id === filter.leadId || i.leadId === filter.leadId || i.leadCode === filter.leadId);
    }
    if (filter.mobile) {
      const norm = normalizePhone(filter.mobile);
      list = list.filter((i) => (i.customerMobile && normalizePhone(i.customerMobile) === norm));
    }
    if (filter.type) {
      list = list.filter((i) => i.interaction_type === filter.type || i.interactionType === filter.type);
    }
    if (filter.from) {
      const fromTime = new Date(filter.from).getTime();
      list = list.filter((i) => new Date(i.started_at || i.startedAt || i.created_at || 0).getTime() >= fromTime);
    }
    if (filter.to) {
      const toTime = new Date(filter.to).getTime();
      list = list.filter((i) => new Date(i.started_at || i.startedAt || i.created_at || 0).getTime() <= toTime);
    }
    if (filter.followUpRequired !== undefined) {
      list = list.filter((i) => Boolean(i.follow_up_required || i.followUpRequired) === Boolean(filter.followUpRequired));
    }
    if (filter.followUpFrom) {
      const fTime = new Date(filter.followUpFrom).getTime();
      list = list.filter((i) => {
        const at = i.follow_up_at || i.followUpAt || i.followUpDate;
        return at ? new Date(at).getTime() >= fTime : false;
      });
    }
    if (filter.followUpTo) {
      const tTime = new Date(filter.followUpTo).getTime();
      list = list.filter((i) => {
        const at = i.follow_up_at || i.followUpAt || i.followUpDate;
        return at ? new Date(at).getTime() <= tTime : false;
      });
    }

    return list.sort((a, b) => {
      const timeA = new Date(a.started_at || a.startedAt || a.created_at || 0).getTime();
      const timeB = new Date(b.started_at || b.startedAt || b.created_at || 0).getTime();
      return timeB - timeA;
    });
  }

  public async saveInteraction(interaction: Partial<Interaction> & { mobile?: string }): Promise<Interaction> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      if (!db.interactions) db.interactions = [];
      if (!db.leads) db.leads = [];
      if (!db.tasks) db.tasks = [];

      const rawMobile = interaction.customerMobile || interaction.mobile || '';
      const normMobile = normalizePhone(rawMobile);

      let customer = (interaction.customer_id || interaction.customerId)
        ? db.customers.find((c) => c.id === (interaction.customer_id || interaction.customerId))
        : undefined;

      if (!customer && normMobile) {
        customer = db.customers.find((c) => {
          const cMob = normalizePhone(c.mobile);
          const cPh = normalizePhone(c.phone);
          return (cMob && cMob === normMobile) || (cPh && cPh === normMobile);
        });
      }

      let lead = (interaction.lead_id || interaction.leadId)
        ? db.leads.find((l) => l.id === (interaction.lead_id || interaction.leadId) || l.leadCode === (interaction.lead_id || interaction.leadId))
        : undefined;

      if (!customer && !lead && normMobile) {
        lead = db.leads.find((l) => normalizePhone(l.mobile) === normMobile);
      }

      // Quick Lead Creation: If unknown mobile and no customer and no existing lead, create minimal Lead! (Scenario A)
      if (!customer && !lead && normMobile) {
        const count = db.leads.length + 1;
        lead = {
          id: `lead-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          leadCode: `LEAD-${1000 + count}`,
          mobile: normMobile,
          name: interaction.customerName || '',
          status: (interaction.follow_up_required || interaction.followUpRequired) ? LeadStatus.FOLLOW_UP : LeadStatus.NEW_LEAD,
          source: 'تماس ورودی',
          notes: interaction.note || interaction.notes || '',
          createdAt: now,
          updatedAt: now,
          lastContactAt: now,
          interactionCount: 1,
        };
        db.leads.unshift(lead);
      } else if (lead) {
        // Update existing Lead stats & contact info (Scenario B)
        lead.lastContactAt = now;
        lead.interactionCount = (lead.interactionCount || 0) + 1;
        if (interaction.customerName && !lead.name) {
          lead.name = interaction.customerName;
        }
        if (lead.status === LeadStatus.NEW_LEAD || !lead.status) {
          lead.status = (interaction.follow_up_required || interaction.followUpRequired) ? LeadStatus.FOLLOW_UP : LeadStatus.CONTACTED;
        }
        lead.updatedAt = now;
      }

      const customerId = customer ? customer.id : undefined;
      const customerName = customer ? customer.name : (lead?.name || interaction.customerName || (lead ? `سرنخ (${lead.leadCode})` : 'تماس ورودی'));
      const customerMobile = customer ? (customer.mobile || customer.phone || normMobile) : (lead?.mobile || normMobile || rawMobile);

      const user = db.users.find((u) => u.id === (interaction.user_id || interaction.userId));
      const followUpUser = (interaction.follow_up_user_id || interaction.followUpUserId)
        ? db.users.find((u) => u.id === (interaction.follow_up_user_id || interaction.followUpUserId))
        : undefined;

      const followUpRequired = Boolean(interaction.follow_up_required || interaction.followUpRequired);
      const followUpAt = interaction.follow_up_at || interaction.followUpAt || interaction.followUpDate;

      let followUpTaskId = interaction.follow_up_task_id || interaction.followUpTaskId;

      // Automatically generate Follow-up task if requested and not yet linked
      if (followUpRequired && followUpAt && !followUpTaskId) {
        followUpTaskId = `task-fu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const taskSubject = interaction.subject || 'پیگیری تماس ورودی';
        const taskDesc = [
          interaction.customer_request || interaction.customerRequest ? `درخواست تماس‌گیرنده: ${interaction.customer_request || interaction.customerRequest}` : '',
          interaction.outcome ? `نتیجه تماس: ${interaction.outcome}` : '',
          interaction.note || interaction.notes ? `یادداشت: ${interaction.note || interaction.notes}` : '',
          customerMobile ? `شماره تماس: ${customerMobile}` : '',
        ].filter(Boolean).join('\n');

        const newTask: Task = {
          id: followUpTaskId,
          title: `پیگیری: ${customerName || customerMobile || 'سرنخ جدید'} - ${taskSubject}`,
          description: taskDesc,
          customerId: customerId,
          customerName: customerName,
          leadId: lead?.id,
          leadCode: lead?.leadCode,
          assignedUserId: interaction.follow_up_user_id || interaction.followUpUserId || interaction.user_id || interaction.userId || 'usr-admin',
          assignedUserName: followUpUser?.name || user?.name || 'کارشناس پیگیری',
          creatorUserId: interaction.user_id || interaction.userId || 'usr-admin',
          creatorUserName: user?.name || 'سیستم ثبت تماس',
          priority: 'HIGH',
          status: 'PENDING',
          dueDate: followUpAt,
          createdAt: now,
          updatedAt: now,
        };
        db.tasks.unshift(newTask);
      }

      const normalized: Interaction = {
        ...interaction,
        id: interaction.id ? String(interaction.id) : `inter-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        customer_id: customerId,
        customerId: customerId,
        lead_id: lead?.id,
        leadId: lead?.id,
        leadCode: lead?.leadCode,
        customerName: customerName,
        customerMobile: customerMobile,
        user_id: interaction.user_id || interaction.userId || 'usr-admin',
        userId: interaction.user_id || interaction.userId || 'usr-admin',
        userName: user?.name || interaction.userName || 'کارشناس سیستم',
        interaction_type: interaction.interaction_type || interaction.interactionType || 'incoming_call',
        interactionType: interaction.interaction_type || interaction.interactionType || 'incoming_call',
        started_at: interaction.started_at || interaction.startedAt || interaction.dateTime || now,
        startedAt: interaction.started_at || interaction.startedAt || interaction.dateTime || now,
        dateTime: interaction.started_at || interaction.startedAt || interaction.dateTime || now,
        duration_seconds: interaction.duration_seconds !== undefined ? Number(interaction.duration_seconds) : (interaction.durationSeconds !== undefined ? Number(interaction.durationSeconds) : 0),
        durationSeconds: interaction.duration_seconds !== undefined ? Number(interaction.duration_seconds) : (interaction.durationSeconds !== undefined ? Number(interaction.durationSeconds) : 0),
        subject: interaction.subject || 'مذاکره و تماس تلفنی',
        customer_request: interaction.customer_request || interaction.customerRequest || '',
        customerRequest: interaction.customer_request || interaction.customerRequest || '',
        outcome: interaction.outcome || '',
        note: interaction.note || interaction.notes || '',
        notes: interaction.note || interaction.notes || '',
        voice_transcript: interaction.voice_transcript || interaction.voiceTranscript || '',
        voiceTranscript: interaction.voice_transcript || interaction.voiceTranscript || '',
        follow_up_required: followUpRequired,
        followUpRequired: followUpRequired,
        follow_up_at: followUpAt,
        followUpAt: followUpAt,
        followUpDate: followUpAt,
        follow_up_user_id: interaction.follow_up_user_id || interaction.followUpUserId,
        followUpUserId: interaction.follow_up_user_id || interaction.followUpUserId,
        followUpUserName: followUpUser?.name || interaction.followUpUserName,
        follow_up_task_id: followUpTaskId,
        followUpTaskId: followUpTaskId,
        follow_up_completed: Boolean(interaction.follow_up_completed || interaction.followUpCompleted),
        followUpCompleted: Boolean(interaction.follow_up_completed || interaction.followUpCompleted),
        created_at: interaction.created_at || interaction.createdAt || now,
        createdAt: interaction.created_at || interaction.createdAt || now,
        updated_at: now,
        updatedAt: now,
      };

      const existingIdx = db.interactions.findIndex((i) => String(i.id) === String(normalized.id));
      if (existingIdx >= 0) {
        db.interactions[existingIdx] = normalized;
      } else {
        db.interactions.unshift(normalized);
      }

      // Keep legacy calls array in sync
      const legacyCallIdx = db.calls.findIndex((c) => c.id === normalized.id);
      const callEquiv: Call = {
        id: normalized.id,
        customerId: normalized.customerId,
        leadId: normalized.leadId,
        leadCode: normalized.leadCode,
        customerName: normalized.customerName,
        customerMobile: normalized.customerMobile,
        userId: normalized.user_id,
        userName: normalized.userName,
        callType: normalized.interaction_type,
        dateTime: normalized.started_at,
        durationSeconds: normalized.duration_seconds,
        subject: normalized.subject || '',
        notes: [normalized.note, normalized.customer_request ? `درخواست: ${normalized.customer_request}` : '', normalized.outcome ? `نتیجه: ${normalized.outcome}` : ''].filter(Boolean).join('\n') || normalized.note || '',
        customerRequest: normalized.customer_request,
        outcome: normalized.outcome,
        transcript: normalized.voice_transcript,
        voiceTranscript: normalized.voice_transcript,
        result: normalized.outcome || 'ANSWERED',
        followUpRequired: normalized.follow_up_required,
        followUpDate: normalized.follow_up_at,
        followUpUserId: normalized.follow_up_user_id,
        followUpTaskId: normalized.follow_up_task_id,
        followUpCompleted: normalized.follow_up_completed,
        createdAt: normalized.created_at,
      };

      if (legacyCallIdx >= 0) {
        db.calls[legacyCallIdx] = callEquiv;
      } else {
        db.calls.unshift(callEquiv);
      }

      return normalized;
    });
  }

  public async patchInteraction(id: string, updates: Partial<Interaction>): Promise<Interaction | null> {
    return this.mutate((db) => {
      if (!db.interactions) db.interactions = [];
      const idx = db.interactions.findIndex((i) => String(i.id) === String(id));
      if (idx < 0) return null;

      const current = db.interactions[idx];
      const now = new Date().toISOString();
      const updated: Interaction = {
        ...current,
        ...updates,
        updated_at: now,
        updatedAt: now,
      };
      db.interactions[idx] = updated;

      // Update call mirror
      const callIdx = db.calls.findIndex((c) => c.id === id);
      if (callIdx >= 0) {
        db.calls[callIdx] = {
          ...db.calls[callIdx],
          subject: updated.subject || db.calls[callIdx].subject,
          notes: updated.note || updated.notes || db.calls[callIdx].notes,
          outcome: updated.outcome || db.calls[callIdx].outcome,
          followUpCompleted: updated.follow_up_completed,
        };
      }

      return updated;
    });
  }

  public async completeInteractionFollowUp(id: string): Promise<Interaction | null> {
    return this.mutate((db) => {
      if (!db.interactions) db.interactions = [];
      const idx = db.interactions.findIndex((i) => String(i.id) === String(id));
      if (idx < 0) return null;

      const current = db.interactions[idx];
      const now = new Date().toISOString();
      current.follow_up_completed = true;
      current.followUpCompleted = true;
      current.updated_at = now;
      current.updatedAt = now;

      // If linked to a task, also complete task
      if (current.follow_up_task_id) {
        const task = db.tasks.find((t) => t.id === current.follow_up_task_id);
        if (task) {
          task.status = 'COMPLETED';
          task.completedAt = now;
          task.updatedAt = now;
        }
      }

      // Update call mirror
      const callIdx = db.calls.findIndex((c) => c.id === id);
      if (callIdx >= 0) {
        db.calls[callIdx].followUpCompleted = true;
      }

      return current;
    });
  }

  public async deleteInteraction(id: string): Promise<boolean> {
    return this.mutate((db) => {
      if (!db.interactions) return false;
      const initial = db.interactions.length;
      db.interactions = db.interactions.filter((i) => String(i.id) !== String(id));
      db.calls = db.calls.filter((c) => String(c.id) !== String(id));
      return db.interactions.length < initial;
    });
  }

  // Voice Note Operations
  public async saveVoiceNote(vn: VoiceNote): Promise<VoiceNote> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const existingIdx = db.voiceNotes.findIndex((v) => v.id === vn.id);
      if (existingIdx >= 0) {
        db.voiceNotes[existingIdx] = { ...db.voiceNotes[existingIdx], ...vn, updatedAt: now };
        return db.voiceNotes[existingIdx];
      } else {
        const newVn: VoiceNote = {
          ...vn,
          id: vn.id || `vn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: vn.createdAt || now,
          updatedAt: now,
        };
        db.voiceNotes.unshift(newVn);
        return newVn;
      }
    });
  }

  public async deleteVoiceNote(id: string): Promise<boolean> {
    return this.mutate((db) => {
      const len = db.voiceNotes.length;
      db.voiceNotes = db.voiceNotes.filter((v) => v.id !== id);
      return db.voiceNotes.length < len;
    });
  }

  // Task Operations
  public async saveTask(task: Task): Promise<Task> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const existingIdx = db.tasks.findIndex((t) => t.id === task.id);
      if (existingIdx >= 0) {
        db.tasks[existingIdx] = { ...db.tasks[existingIdx], ...task, updatedAt: now };
        return db.tasks[existingIdx];
      } else {
        const newTask: Task = {
          ...task,
          id: task.id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: task.createdAt || now,
          updatedAt: now,
        };
        db.tasks.unshift(newTask);
        return newTask;
      }
    });
  }

  public async deleteTask(id: string): Promise<boolean> {
    return this.mutate((db) => {
      const len = db.tasks.length;
      db.tasks = db.tasks.filter((t) => t.id !== id);
      return db.tasks.length < len;
    });
  }

  // Contract Operations
  public async saveContract(contract: Contract): Promise<Contract> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const existingIdx = db.contracts.findIndex((c) => c.id === contract.id);
      if (existingIdx >= 0) {
        db.contracts[existingIdx] = { ...db.contracts[existingIdx], ...contract, updatedAt: now };
        return db.contracts[existingIdx];
      } else {
        const newContract: Contract = {
          ...contract,
          id: contract.id || `cnt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: contract.createdAt || now,
          updatedAt: now,
        };
        db.contracts.unshift(newContract);
        return newContract;
      }
    });
  }

  public async deleteContract(id: string): Promise<boolean> {
    return this.mutate((db) => {
      const len = db.contracts.length;
      db.contracts = db.contracts.filter((c) => c.id !== id);
      return db.contracts.length < len;
    });
  }

  // Payment Operations
  public async savePayment(payment: Payment): Promise<Payment> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const existingIdx = db.payments.findIndex((p) => p.id === payment.id);
      if (existingIdx >= 0) {
        db.payments[existingIdx] = { ...db.payments[existingIdx], ...payment };
        return db.payments[existingIdx];
      } else {
        const newPayment: Payment = {
          ...payment,
          id: payment.id || `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: payment.createdAt || now,
        };
        db.payments.unshift(newPayment);
        return newPayment;
      }
    });
  }

  public async deletePayment(id: string): Promise<boolean> {
    return this.mutate((db) => {
      const len = db.payments.length;
      db.payments = db.payments.filter((p) => p.id !== id);
      return db.payments.length < len;
    });
  }

  // Check Operations
  public async saveCheck(check: Check): Promise<Check> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const existingIdx = db.checks.findIndex((c) => c.id === check.id);
      if (existingIdx >= 0) {
        db.checks[existingIdx] = { ...db.checks[existingIdx], ...check, updatedAt: now };
        return db.checks[existingIdx];
      } else {
        const newCheck: Check = {
          ...check,
          id: check.id || `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: check.createdAt || now,
          updatedAt: now,
        };
        db.checks.unshift(newCheck);
        return newCheck;
      }
    });
  }

  public async deleteCheck(id: string): Promise<boolean> {
    return this.mutate((db) => {
      const len = db.checks.length;
      db.checks = db.checks.filter((c) => c.id !== id);
      return db.checks.length < len;
    });
  }

  // SIM Operations
  public async saveSim(sim: SimCard): Promise<SimCard> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const existingIdx = db.sims.findIndex((s) => s.id === sim.id);
      if (existingIdx >= 0) {
        db.sims[existingIdx] = { ...db.sims[existingIdx], ...sim, updatedAt: now };
        return db.sims[existingIdx];
      } else {
        const newSim: SimCard = {
          ...sim,
          id: sim.id || `sim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: sim.createdAt || now,
          updatedAt: now,
        };
        db.sims.unshift(newSim);
        return newSim;
      }
    });
  }

  public async deleteSim(id: string): Promise<boolean> {
    return this.mutate((db) => {
      const len = db.sims.length;
      db.sims = db.sims.filter((s) => s.id !== id);
      return db.sims.length < len;
    });
  }

  // Repair Operations
  public async saveRepair(repair: Repair): Promise<Repair> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const existingIdx = db.repairs.findIndex((r) => r.id === repair.id);
      if (existingIdx >= 0) {
        db.repairs[existingIdx] = { ...db.repairs[existingIdx], ...repair, updatedAt: now };
        return db.repairs[existingIdx];
      } else {
        const newRepair: Repair = {
          ...repair,
          id: repair.id || `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: repair.createdAt || now,
          updatedAt: now,
        };
        db.repairs.unshift(newRepair);
        return newRepair;
      }
    });
  }

  public async deleteRepair(id: string): Promise<boolean> {
    return this.mutate((db) => {
      const len = db.repairs.length;
      db.repairs = db.repairs.filter((r) => r.id !== id);
      return db.repairs.length < len;
    });
  }

  // Attachment Operations
  public async saveAttachment(att: Attachment): Promise<Attachment> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const existingIdx = db.attachments.findIndex((a) => a.id === att.id);
      if (existingIdx >= 0) {
        const existing = db.attachments[existingIdx];
        const updated: Attachment = {
          ...existing,
          ...att,
          updatedAt: now,
        };
        // Explicitly support unlinking customer (customerId = undefined or null)
        if (att.customerId === undefined || att.customerId === null || att.customerId === '') {
          delete updated.customerId;
          delete updated.customerName;
        }
        db.attachments[existingIdx] = updated;
        return updated;
      } else {
        const newAtt: Attachment = {
          ...att,
          id: att.id || `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: att.createdAt || now,
          updatedAt: now,
        };
        if (newAtt.customerId === undefined || newAtt.customerId === null || newAtt.customerId === '') {
          delete newAtt.customerId;
          delete newAtt.customerName;
        }
        db.attachments.unshift(newAtt);
        return newAtt;
      }
    });
  }

  public async linkAttachmentCustomer(
    id: string,
    customerId?: string,
    customerName?: string
  ): Promise<Attachment | null> {
    return this.mutate((db) => {
      const idx = db.attachments.findIndex((a) => a.id === id);
      if (idx < 0) return null;
      const now = new Date().toISOString();
      const att = { ...db.attachments[idx], updatedAt: now };
      if (customerId) {
        att.customerId = customerId;
        att.customerName = customerName || '';
      } else {
        delete att.customerId;
        delete att.customerName;
      }
      db.attachments[idx] = att;
      return att;
    });
  }

  public async deleteAttachment(id: string): Promise<boolean> {
    return this.mutate((db) => {
      const len = db.attachments.length;
      db.attachments = db.attachments.filter((a) => a.id !== id);
      return db.attachments.length < len;
    });
  }

  // Role Operations
  public async saveRole(role: Role): Promise<Role> {
    return this.mutate((db) => {
      const existingIdx = db.roles.findIndex((r) => r.id === role.id || r.name === role.name);
      if (existingIdx >= 0) {
        db.roles[existingIdx] = { ...db.roles[existingIdx], ...role };
        return db.roles[existingIdx];
      } else {
        db.roles.push(role);
        return role;
      }
    });
  }

  // Notifications
  public async saveNotification(notification: Notification): Promise<Notification> {
    return this.mutate((db) => {
      const existingIdx = db.notifications.findIndex((n) => n.id === notification.id);
      if (existingIdx >= 0) {
        db.notifications[existingIdx] = { ...db.notifications[existingIdx], ...notification, updatedAt: new Date().toISOString() };
        return db.notifications[existingIdx];
      } else {
        const newN: Notification = {
          ...notification,
          id: notification.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: notification.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.notifications.unshift(newN);
        return newN;
      }
    });
  }

  public async snoozeNotification(id: string, minutes: number): Promise<Notification | null> {
    return this.mutate((db) => {
      const idx = db.notifications.findIndex((n) => n.id === id);
      if (idx < 0) return null;
      const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      const updated: Notification = {
        ...db.notifications[idx],
        snoozedUntil,
        read: false,
        updatedAt: new Date().toISOString(),
      };
      db.notifications[idx] = updated;
      return updated;
    });
  }

  public async markAllNotificationsRead(userId?: string): Promise<void> {
    return this.mutate((db) => {
      db.notifications = db.notifications.map((n) => {
        if (!userId || n.userId === userId || !n.userId) {
          return { ...n, read: true, isRead: true, readAt: new Date().toISOString() };
        }
        return n;
      });
    });
  }

  // Device & Web Push Operations
  public getUserDevices(userId?: string): UserNotificationDevice[] {
    const devices = this.getDatabase().userNotificationDevices || [];
    if (!userId) return devices;
    return devices.filter((d) => d.userId === userId);
  }

  public async registerDevice(device: UserNotificationDevice): Promise<UserNotificationDevice> {
    return this.mutate((db) => {
      if (!db.userNotificationDevices) db.userNotificationDevices = [];
      const now = new Date().toISOString();
      // Match existing device by endpoint or (userId + browser + platform)
      const existingIdx = db.userNotificationDevices.findIndex(
        (d) =>
          (device.pushEndpoint && d.pushEndpoint === device.pushEndpoint) ||
          (d.id && d.id === device.id) ||
          (d.userId === device.userId && d.deviceName === device.deviceName && d.browser === device.browser)
      );

      if (existingIdx >= 0) {
        const updated: UserNotificationDevice = {
          ...db.userNotificationDevices[existingIdx],
          ...device,
          lastSeenAt: now,
          updatedAt: now,
        };
        db.userNotificationDevices[existingIdx] = updated;
        return updated;
      } else {
        const newDevice: UserNotificationDevice = {
          ...device,
          id: device.id || `dev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          enabled: device.enabled !== undefined ? device.enabled : true,
          lastSeenAt: now,
          createdAt: device.createdAt || now,
          updatedAt: now,
        };
        db.userNotificationDevices.unshift(newDevice);
        return newDevice;
      }
    });
  }

  public async updateDevice(deviceId: string, updates: Partial<UserNotificationDevice>): Promise<UserNotificationDevice | null> {
    return this.mutate((db) => {
      if (!db.userNotificationDevices) return null;
      const idx = db.userNotificationDevices.findIndex((d) => d.id === deviceId);
      if (idx < 0) return null;
      db.userNotificationDevices[idx] = {
        ...db.userNotificationDevices[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      return db.userNotificationDevices[idx];
    });
  }

  public async deleteDevice(deviceId: string): Promise<boolean> {
    return this.mutate((db) => {
      if (!db.userNotificationDevices) return false;
      const len = db.userNotificationDevices.length;
      db.userNotificationDevices = db.userNotificationDevices.filter((d) => d.id !== deviceId);
      return db.userNotificationDevices.length < len;
    });
  }

  // Delivery Tracking Operations
  public getDeliveries(notificationId?: string, userId?: string): NotificationDelivery[] {
    const list = this.getDatabase().notificationDeliveries || [];
    return list.filter((del) => {
      if (notificationId && del.notificationId !== notificationId) return false;
      if (userId && del.userId !== userId) return false;
      return true;
    });
  }

  public async recordDelivery(delivery: NotificationDelivery): Promise<NotificationDelivery> {
    return this.mutate((db) => {
      if (!db.notificationDeliveries) db.notificationDeliveries = [];
      const now = new Date().toISOString();
      const record: NotificationDelivery = {
        ...delivery,
        id: delivery.id || `del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: delivery.createdAt || now,
        updatedAt: now,
      };
      db.notificationDeliveries.unshift(record);
      if (db.notificationDeliveries.length > 3000) {
        db.notificationDeliveries = db.notificationDeliveries.slice(0, 3000);
      }
      return record;
    });
  }

  public async updateDelivery(id: string, updates: Partial<NotificationDelivery>): Promise<NotificationDelivery | null> {
    return this.mutate((db) => {
      if (!db.notificationDeliveries) return null;
      const idx = db.notificationDeliveries.findIndex((d) => d.id === id);
      if (idx < 0) return null;
      db.notificationDeliveries[idx] = {
        ...db.notificationDeliveries[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      return db.notificationDeliveries[idx];
    });
  }

  // Notification Settings
  public getNotificationSettings(): NotificationSettings {
    return this.getDatabase().notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
  }

  public async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    return this.mutate((db) => {
      db.notificationSettings = {
        ...(db.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS),
        ...settings,
      };
      return db.notificationSettings;
    });
  }

  // Audit Logs
  public async logAudit(audit: Partial<AuditLog>): Promise<AuditLog> {
    return this.mutate((db) => {
      const newAudit: AuditLog = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        userId: audit.userId || 'system',
        userName: audit.userName || 'سامانه',
        userRole: audit.userRole || UserRole.SUPER_ADMIN,
        action: audit.action || 'عملیات نامشخص',
        module: audit.module || ModuleName.SETTINGS,
        targetId: audit.targetId,
        targetType: audit.targetType,
        details: audit.details || '',
        ipAddress: audit.ipAddress,
      };
      db.auditLogs.unshift(newAudit);
      if (db.auditLogs.length > 2000) {
        db.auditLogs = db.auditLogs.slice(0, 2000);
      }
      return newAudit;
    });
  }

  // Problem Reports
  public async saveProblemReport(report: ProblemReport): Promise<ProblemReport> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const existingIdx = db.problemReports.findIndex((r) => r.id === report.id);
      let saved: ProblemReport;
      if (existingIdx >= 0) {
        saved = {
          ...db.problemReports[existingIdx],
          ...report,
          updatedAt: now,
        };
        db.problemReports[existingIdx] = saved;
      } else {
        saved = {
          ...report,
          id: report.id || `report-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: report.createdAt || now,
          updatedAt: now,
        };
        db.problemReports.unshift(saved);
      }
      return saved;
    });
  }

  public async deleteProblemReport(id: string): Promise<boolean> {
    return this.mutate((db) => {
      const before = db.problemReports.length;
      db.problemReports = db.problemReports.filter((r) => r.id !== id);
      return db.problemReports.length < before;
    });
  }

  // Settings
  public async updateSettings(settings: Partial<CentralDatabaseSchema['settings']>): Promise<CentralDatabaseSchema['settings']> {
    return this.mutate((db) => {
      db.settings = {
        ...db.settings,
        ...settings,
        updatedAt: new Date().toISOString(),
      };
      return db.settings;
    });
  }

  // Accounting Foundation Operations
  public getAccounts(): Account[] {
    const db = this.getState();
    return Array.isArray(db.accounts) ? [...db.accounts] : [];
  }

  public async saveAccount(account: Partial<Account> & { code: string; name: string; account_type: string }): Promise<Account> {
    return this.mutate((db) => {
      if (!db.accounts) db.accounts = [...DEFAULT_SEED_ACCOUNTS];
      const now = new Date().toISOString();
      const existingIdx = db.accounts.findIndex((a) => (account.id && a.id === account.id) || a.code === account.code);
      if (existingIdx >= 0) {
        const current = db.accounts[existingIdx];
        const updated: Account = {
          ...current,
          ...account,
          id: current.id,
        };
        db.accounts[existingIdx] = updated;
        return updated;
      } else {
        const newAcc: Account = {
          id: account.id || `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          code: account.code,
          name: account.name,
          account_type: account.account_type,
          parent_id: account.parent_id,
          is_active: account.is_active !== undefined ? account.is_active : true,
          created_at: account.created_at || now,
          description: account.description || '',
        };
        db.accounts.push(newAcc);
        return newAcc;
      }
    });
  }

  public async deleteAccount(id: string): Promise<boolean> {
    return this.mutate((db) => {
      if (!db.accounts) return false;
      // Check if account has lines
      const inUse = (db.journalEntryLines || []).some((l) => l.account_id === id);
      if (inUse) {
        throw new Error('این حساب در اسناد حسابداری استفاده شده و امکان حذف ندارد.');
      }
      const initial = db.accounts.length;
      db.accounts = db.accounts.filter((a) => a.id !== id);
      return db.accounts.length < initial;
    });
  }

  // Journal Entries
  public getJournalEntries(): JournalEntry[] {
    const db = this.getState();
    const entries = Array.isArray(db.journalEntries) ? [...db.journalEntries] : [];
    const lines = Array.isArray(db.journalEntryLines) ? db.journalEntryLines : [];
    const accounts = Array.isArray(db.accounts) ? db.accounts : [];
    const accountMap = new Map<string, Account>();
    accounts.forEach((a) => accountMap.set(a.id, a));

    return entries.map((e) => {
      const entryLines = lines
        .filter((l) => l.journal_entry_id === e.id)
        .map((l) => {
          const acc = accountMap.get(l.account_id);
          return {
            ...l,
            account_code: acc?.code || l.account_code,
            account_name: acc?.name || l.account_name,
          };
        });
      const totalDebit = entryLines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
      const totalCredit = entryLines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
      return {
        ...e,
        lines: entryLines,
        totalDebit,
        totalCredit,
      };
    }).sort((a, b) => new Date(b.entry_date || b.created_at).getTime() - new Date(a.entry_date || a.created_at).getTime());
  }

  public findJournalEntryById(id: string): JournalEntry | undefined {
    const entries = this.getJournalEntries();
    return entries.find((e) => e.id === id || String(e.entry_number) === id);
  }

  public async saveJournalEntry(
    entry: Partial<JournalEntry> & { description: string },
    lines: { account_id: string; debit: number; credit: number; description?: string }[]
  ): Promise<JournalEntry> {
    return this.mutate((db) => {
      if (!db.journalEntries) db.journalEntries = [];
      if (!db.journalEntryLines) db.journalEntryLines = [];
      if (!lines || lines.length < 2) {
        throw new Error('هر سند حسابداری دوبل باید حداقل دارای دو سطر (بدهکار و بستانکار) باشد.');
      }

      const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
      const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);

      // Strict Double-Entry Rule Validation: Total Debit MUST equal Total Credit
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`سند تراز نیست! مجموع بدهکار (${totalDebit.toLocaleString()}) با مجموع بستانکار (${totalCredit.toLocaleString()}) برابر نمی‌باشد.`);
      }

      const now = new Date().toISOString();
      const existingIdx = entry.id ? db.journalEntries.findIndex((e) => e.id === entry.id) : -1;

      let entryId = entry.id;
      let entryNumber = entry.entry_number;

      if (!entryNumber) {
        const maxNum = db.journalEntries.reduce((max, e) => {
          const n = Number(e.entry_number);
          return !isNaN(n) && n > max ? n : max;
        }, 1000);
        entryNumber = maxNum + 1;
      }

      let savedEntry: JournalEntry;

      if (existingIdx >= 0 && entryId) {
        savedEntry = {
          ...db.journalEntries[existingIdx],
          ...entry,
          id: entryId,
          entry_number: entryNumber,
          updated_at: now,
        };
        db.journalEntries[existingIdx] = savedEntry;
        // Remove old lines
        db.journalEntryLines = db.journalEntryLines.filter((l) => l.journal_entry_id !== entryId);
      } else {
        entryId = `je-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        savedEntry = {
          id: entryId,
          entry_number: entryNumber,
          entry_date: entry.entry_date || now,
          description: entry.description,
          reference_type: entry.reference_type || 'MANUAL',
          reference_id: entry.reference_id,
          status: entry.status || JournalEntryStatus.POSTED,
          created_by: entry.created_by || 'usr-admin',
          created_by_name: entry.created_by_name || 'مدیر سیستم',
          created_at: entry.created_at || now,
          updated_at: now,
        };
        db.journalEntries.push(savedEntry);
      }

      // Add new lines
      const createdLines: JournalEntryLine[] = lines.map((l, idx) => ({
        id: `jel-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
        journal_entry_id: entryId!,
        account_id: l.account_id,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description || entry.description,
      }));

      db.journalEntryLines.push(...createdLines);

      savedEntry.lines = createdLines;
      savedEntry.totalDebit = totalDebit;
      savedEntry.totalCredit = totalCredit;
      return savedEntry;
    });
  }

  // Accounting Periods
  public getAccountingPeriods(): AccountingPeriod[] {
    const db = this.getState();
    return Array.isArray(db.accountingPeriods) ? [...db.accountingPeriods] : DEFAULT_SEED_PERIODS;
  }

  public async saveAccountingPeriod(p: Partial<AccountingPeriod> & { period: string }): Promise<AccountingPeriod> {
    return this.mutate((db) => {
      if (!db.accountingPeriods) db.accountingPeriods = [...DEFAULT_SEED_PERIODS];
      const existingIdx = db.accountingPeriods.findIndex((x) => (p.id && x.id === p.id) || x.period === p.period);
      if (existingIdx >= 0) {
        const current = db.accountingPeriods[existingIdx];
        const updated: AccountingPeriod = { ...current, ...p };
        db.accountingPeriods[existingIdx] = updated;
        return updated;
      } else {
        const newP: AccountingPeriod = {
          id: p.id || `prd-${Date.now()}`,
          period: p.period,
          start_date: p.start_date || new Date().toISOString(),
          end_date: p.end_date || new Date().toISOString(),
          status: p.status || AccountingPeriodStatus.OPEN,
          created_at: new Date().toISOString(),
        };
        db.accountingPeriods.push(newP);
        return newP;
      }
    });
  }

  // Document Sharing Operations
  public getDocumentShares(): DocumentShare[] {
    const db = this.getState();
    return Array.isArray(db.documentShares) ? [...db.documentShares] : [];
  }

  public async createDocumentShares(payload: {
    documentId: string;
    senderUser: { id: string; name: string };
    recipientUsers: { id: string; name: string }[];
    message?: string;
    customerId?: string;
    customerName?: string;
    documentFileName?: string;
    documentFileSize?: number;
    documentFileType?: string;
  }): Promise<DocumentShare[]> {
    return this.mutate((db) => {
      if (!db.documentShares) db.documentShares = [];
      if (!db.notifications) db.notifications = [];
      const now = new Date().toISOString();
      const created: DocumentShare[] = [];

      for (const rec of payload.recipientUsers) {
        const share: DocumentShare = {
          id: `dsh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          document_id: payload.documentId,
          documentId: payload.documentId,
          sender_user_id: payload.senderUser.id,
          senderUserId: payload.senderUser.id,
          sender_user_name: payload.senderUser.name,
          senderUserName: payload.senderUser.name,
          recipient_user_id: rec.id,
          recipientUserId: rec.id,
          recipient_user_name: rec.name,
          recipientUserName: rec.name,
          shared_at: now,
          sharedAt: now,
          message: payload.message || '',
          status: DocumentShareStatus.SENT,
          document_file_name: payload.documentFileName,
          documentFileName: payload.documentFileName,
          document_file_size: payload.documentFileSize,
          documentFileSize: payload.documentFileSize,
          document_file_type: payload.documentFileType,
          documentFileType: payload.documentFileType,
          customer_id: payload.customerId,
          customerId: payload.customerId,
          customer_name: payload.customerName,
          customerName: payload.customerName,
        };
        db.documentShares.push(share);
        created.push(share);

        // Also create in-app notification for recipient
        db.notifications.push({
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId: rec.id,
          title: `سند جدید به اشتراک گذاشته شد`,
          message: `کاربر ${payload.senderUser.name} سند «${payload.documentFileName || 'ضمیمه'}» را با شما به اشتراک گذاشت.`,
          category: 'SYSTEM',
          severity: 'INFO',
          read: false,
          relatedEntityType: 'ATTACHMENT',
          relatedEntityId: payload.documentId,
          createdAt: now,
        });
      }

      return created;
    });
  }

  public async markDocumentShareRead(shareId: string, userId: string): Promise<DocumentShare | undefined> {
    return this.mutate((db) => {
      if (!db.documentShares) return undefined;
      const share = db.documentShares.find((s) => s.id === shareId && (s.recipient_user_id === userId || s.recipientUserId === userId));
      if (share) {
        const now = new Date().toISOString();
        share.status = DocumentShareStatus.READ;
        share.read_at = now;
        share.readAt = now;
      }
      return share;
    });
  }

  public async archiveDocumentShare(shareId: string, userId: string): Promise<DocumentShare | undefined> {
    return this.mutate((db) => {
      if (!db.documentShares) return undefined;
      const share = db.documentShares.find((s) => s.id === shareId && (s.recipient_user_id === userId || s.recipientUserId === userId || s.sender_user_id === userId || s.senderUserId === userId));
      if (share) {
        const now = new Date().toISOString();
        share.status = DocumentShareStatus.ARCHIVED;
        share.archived_at = now;
        share.archivedAt = now;
      }
      return share;
    });
  }

  // ----------------------------------------------------
  // Chat Operations (Sprint 03 Patch 05)
  // ----------------------------------------------------
  public getConversations(): ChatConversation[] {
    return Array.isArray(this.getState().conversations) ? [...this.getState().conversations] : [];
  }

  public getConversationById(id: string): ChatConversation | undefined {
    return (this.getState().conversations || []).find((c) => c.id === id);
  }

  public getConversationsForUser(userId: string): { conversations: ChatConversation[]; unreadCount: number } {
    const mine = (this.getState().conversations || []).filter(
      (c) => (c.member_ids || []).includes(userId) && !(c.is_archived_by || []).includes(userId)
    ).sort((a, b) => new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime());
    const readonlyMembership = (conv: ChatConversation) => (conv.members || []).find((m) => m.user_id === userId);
    let unreadCount = 0;
    const enriched = mine.map((c) => {
      const lastReadAt = readonlyMembership(c)?.last_read_at;
      const msgs = this.getChatMessagesByConversation(c.id);
      const unread = msgs.filter((m) => m.sender_user_id !== userId && (!lastReadAt || new Date(m.created_at) > new Date(lastReadAt))).length;
      unreadCount += unread;
      return { ...c, _unread: unread };
    });
    return { conversations: enriched, unreadCount };
  }

  public getChatMessagesByConversation(conversationId: string): ChatMessage[] {
    return (this.getState().chatMessages || [])
      .filter((m) => m.conversation_id === conversationId || m.conversationId === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  public findConversationBetween(aId: string, bId: string): ChatConversation | undefined {
    const both = new Set([aId, bId]);
    return this.getConversations().find((c) => c.type === ConversationType.DIRECT
      && (c.member_ids || []).length === 2
      && c.member_ids.every((id) => both.has(id)));
  }

  public async getOrCreateDirectConversation(userAId: string, userBId: string, aName: string, bName: string): Promise<ChatConversation> {
    const existing = this.findConversationBetween(userAId, userBId);
    if (existing) return existing;
    const now = new Date().toISOString();
    const convo: ChatConversation = {
      id: `conv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: ConversationType.DIRECT,
      members: [
        { user_id: userAId, user_name: aName, joined_at: now },
        { user_id: userBId, user_name: bName, joined_at: now },
      ],
      member_ids: [userAId, userBId],
      created_by: userAId,
      created_by_name: aName,
      created_at: now,
      updated_at: now,
    };
    return this.mutate((db) => {
      db.conversations.unshift(convo);
      return convo;
    });
  }

  public async sendChatMessage(msg: Partial<ChatMessage> & { conversation_id: string; conversationId?: string }): Promise<ChatMessage> {
    const body = msg as ChatMessage;
    return this.mutate((db) => {
      const cid = body.conversation_id || body.conversationId;
      if (!cid) throw new Error('conversation_id required');
      const convo = db.conversations.find((c) => c.id === cid);
      if (!convo) throw new Error('Conversation not found');
      const now = new Date().toISOString();
      const message: ChatMessage = {
        ...body,
        id: body.id || `msg-${Date.now()}`,
        conversation_id: body.conversation_id || body.conversationId || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: MessageStatus.SENT,
        read_by_user_ids: body.read_by_user_ids || [],
        readByUserIds: body.read_by_user_ids || [],
        client_message_id: body.client_message_id || `cmid-${Date.now()}`,
      };
      (db.chatMessages || (db.chatMessages = [])).unshift(message);
      // bump conversation
      const idx = db.conversations.findIndex((c) => c.id === cid);
      if (idx >= 0) {
        db.conversations[idx] = {
          ...db.conversations[idx],
          last_message: body.body,
          lastMessage: body.body,
          last_message_at: body.created_at || new Date().toISOString(),
          lastMessageAt: body.created_at || new Date().toISOString(),
          last_message_user_id: body.sender_user_id,
          lastMessageUserId: body.sender_user_id,
          last_message_user_name: body.sender_user_name,
          lastMessageUserName: body.sender_user_name,
          updated_at: new Date().toISOString(),
        };
      }
      return body;
    });
  }

  public async markChatConversationRead(conversationId: string, userId: string): Promise<ChatConversation | undefined> {
    return this.mutate((db) => {
      const convo = db.conversations.find((c) => c.id === conversationId);
      if (!convo) return undefined;
      const member = (convo.members || []).find((m) => m.user_id === userId);
      if (!member) return convo;
      member.last_read_at = new Date().toISOString();
      member.lastReadAt = new Date().toISOString();
      const msgs = (db.chatMessages || []).filter((m) => m.conversation_id === conversationId || m.conversationId === conversationId);
      msgs.forEach((m) => {
        if (m.sender_user_id === userId) return;
        const rb = m.read_by_user_ids || [];
        if (!rb.includes(userId)) rb.push(userId);
        if (rb.length >= ((convo.member_ids || []).length - 1)) {
          m.status = MessageStatus.READ;
          m.read_at = new Date().toISOString();
        }
      });
      return convo;
    });
  }

  public async archiveConversation(conversationId: string, userId: string): Promise<ChatConversation | undefined> {
    return this.mutate((db) => {
      const idx = (db.conversations || []).findIndex((c) => c.id === conversationId);
      if (idx < 0) return undefined;
      if (!((db.conversations[idx].member_ids || []).includes(userId))) return undefined;
      const now = new Date().toISOString();
      const updated: ChatConversation = {
        ...db.conversations[idx],
        is_archived_by: [...(db.conversations[idx].is_archived_by || []), userId],
        isArchivedBy: [...(db.conversations[idx].isArchivedBy || []), userId],
        updated_at: new Date().toISOString(),
      };
      db.conversations[idx] = updated;
      return updated;
    });
  }

  public getAllConversationsForAdmin(options?: { search?: string; type?: string; priority?: string; archived?: boolean }): (ChatConversation & { message_count: number })[] {
    let list = Array.isArray(this.getState().conversations) ? [...this.getState().conversations] : [];
    const msgs = this.getState().chatMessages || [];

    // Enrich with message counts
    let enriched = list.map((c) => {
      const convMsgs = msgs.filter((m) => m.conversation_id === c.id || m.conversationId === c.id);
      return {
        ...c,
        message_count: convMsgs.length,
      };
    });

    if (options?.archived !== undefined) {
      if (options.archived) {
        enriched = enriched.filter((c) => Boolean(c.archived_at) || (c.is_archived_by && c.is_archived_by.length > 0));
      } else {
        enriched = enriched.filter((c) => !c.archived_at && (!c.is_archived_by || c.is_archived_by.length === 0));
      }
    }

    if (options?.type && options.type !== 'ALL') {
      enriched = enriched.filter((c) => c.type === options.type);
    }

    if (options?.priority && options.priority !== 'ALL') {
      enriched = enriched.filter((c) => c.priority === options.priority);
    }

    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      enriched = enriched.filter((c) => {
        const titleMatch = (c.title || c.group_name || '').toLowerCase().includes(q);
        const lastMsgMatch = (c.last_message || '').toLowerCase().includes(q);
        const memberMatch = (c.members || []).some((m) => (m.user_name || '').toLowerCase().includes(q));
        return titleMatch || lastMsgMatch || memberMatch;
      });
    }

    // Sort newest activity first
    return enriched.sort((a, b) => new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime());
  }

  public async createGroupConversation(
    creatorUserId: string,
    creatorUserName: string,
    title: string,
    memberUserIds: string[],
    groupImageUrl?: string,
    priority: string = ConversationPriority.NORMAL
  ): Promise<ChatConversation> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const uniqueMemberIds = Array.from(new Set([creatorUserId, ...memberUserIds]));
      const members: ConversationMember[] = uniqueMemberIds.map((uid) => {
        const u = db.users.find((user) => user.id === uid);
        const isCreator = uid === creatorUserId;
        return {
          user_id: uid,
          userId: uid,
          user_name: u?.name || (isCreator ? creatorUserName : 'کاربر'),
          userName: u?.name || (isCreator ? creatorUserName : 'کاربر'),
          role: isCreator ? ChatMemberRole.ADMIN : ChatMemberRole.MEMBER,
          joined_at: now,
          joinedAt: now,
        };
      });

      const convo: ChatConversation = {
        id: `conv-grp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: ConversationType.GROUP,
        title,
        group_name: title,
        group_image_url: groupImageUrl,
        members,
        member_ids: uniqueMemberIds,
        created_by: creatorUserId,
        createdById: creatorUserId,
        created_by_name: creatorUserName,
        createdByName: creatorUserName,
        priority,
        created_at: now,
        createdAt: now,
        updated_at: now,
        updatedAt: now,
        message_count: 0,
        pinned_by_user_ids: [],
      };

      if (!db.conversations) db.conversations = [];
      db.conversations.unshift(convo);
      return convo;
    });
  }

  public async addGroupMember(
    conversationId: string,
    userId: string,
    userName: string,
    role: string = ChatMemberRole.MEMBER
  ): Promise<ChatConversation | undefined> {
    return this.mutate((db) => {
      const convo = (db.conversations || []).find((c) => c.id === conversationId);
      if (!convo) return undefined;
      const now = new Date().toISOString();
      if (!convo.member_ids.includes(userId)) {
        convo.member_ids.push(userId);
        convo.members = convo.members || [];
        convo.members.push({
          user_id: userId,
          userId,
          user_name: userName,
          userName,
          role,
          joined_at: now,
          joinedAt: now,
        });
        convo.updated_at = now;
        convo.updatedAt = now;
      }
      return convo;
    });
  }

  public async removeGroupMember(conversationId: string, userId: string): Promise<ChatConversation | undefined> {
    return this.mutate((db) => {
      const convo = (db.conversations || []).find((c) => c.id === conversationId);
      if (!convo) return undefined;
      const now = new Date().toISOString();
      convo.member_ids = (convo.member_ids || []).filter((id) => id !== userId);
      if (convo.members) {
        const mem = convo.members.find((m) => m.user_id === userId);
        if (mem) {
          mem.left_at = now;
        }
      }
      convo.updated_at = now;
      convo.updatedAt = now;
      return convo;
    });
  }

  public async updateConversation(conversationId: string, updates: Partial<ChatConversation>): Promise<ChatConversation | undefined> {
    return this.mutate((db) => {
      const idx = (db.conversations || []).findIndex((c) => c.id === conversationId);
      if (idx < 0) return undefined;
      const now = new Date().toISOString();
      db.conversations[idx] = {
        ...db.conversations[idx],
        ...updates,
        updated_at: now,
        updatedAt: now,
      };
      return db.conversations[idx];
    });
  }

  public async setConversationPriority(conversationId: string, priority: string): Promise<ChatConversation | undefined> {
    return this.updateConversation(conversationId, { priority });
  }

  public async toggleConversationPin(conversationId: string, userId: string): Promise<ChatConversation | undefined> {
    return this.mutate((db) => {
      const convo = (db.conversations || []).find((c) => c.id === conversationId);
      if (!convo) return undefined;
      let pinnedIds = convo.pinned_by_user_ids || [];
      if (pinnedIds.includes(userId)) {
        pinnedIds = pinnedIds.filter((id) => id !== userId);
      } else {
        pinnedIds = [...pinnedIds, userId];
      }
      convo.pinned_by_user_ids = pinnedIds;
      convo.is_pinned = pinnedIds.length > 0;
      convo.pinnedByUserId = pinnedIds[0] || undefined;
      convo.pinned_at = pinnedIds.includes(userId) ? new Date().toISOString() : undefined;
      convo.updated_at = new Date().toISOString();
      return convo;
    });
  }

  public async softDeleteChatMessage(
    messageId: string,
    userId: string,
    userName: string,
    reason?: string
  ): Promise<ChatMessage | undefined> {
    return this.mutate((db) => {
      const msg = (db.chatMessages || []).find((m) => m.id === messageId);
      if (!msg) return undefined;
      const now = new Date().toISOString();
      msg.deleted_at = now;
      msg.deletedAt = now;
      msg.deleted_by_user_id = userId;
      msg.deletedByUserId = userId;
      msg.deleted_by_user_name = userName;
      msg.deletedByUserName = userName;
      msg.deletion_reason = reason || 'حذف شده توسط کاربر یا مدیر';
      msg.body = 'این پیام حذف شده است.';
      msg.body_text = 'این پیام حذف شده است.';
      msg.updated_at = now;
      msg.updatedAt = now;
      return msg;
    });
  }

  public async editChatMessage(
    messageId: string,
    userId: string,
    newBody: string
  ): Promise<ChatMessage | undefined> {
    return this.mutate((db) => {
      const msg = (db.chatMessages || []).find((m) => m.id === messageId);
      if (!msg) return undefined;
      if (msg.sender_user_id !== userId && msg.senderUserId !== userId) return undefined;
      const now = new Date().toISOString();
      msg.body = newBody;
      msg.body_text = newBody;
      msg.is_edited = true;
      msg.edited_at = now;
      msg.editedAt = now;
      msg.updated_at = now;
      msg.updatedAt = now;
      return msg;
    });
  }

  public async deleteConversationBySuperAdmin(conversationId: string): Promise<boolean> {
    return this.mutate((db) => {
      const initialCount = (db.conversations || []).length;
      db.conversations = (db.conversations || []).filter((c) => c.id !== conversationId);
      db.chatMessages = (db.chatMessages || []).filter((m) => m.conversation_id !== conversationId && m.conversationId !== conversationId);
      return db.conversations.length < initialCount;
    });
  }

  public async adminArchiveConversation(conversationId: string, adminUserId: string): Promise<ChatConversation | undefined> {
    return this.mutate((db) => {
      const convo = (db.conversations || []).find((c) => c.id === conversationId);
      if (!convo) return undefined;
      const now = new Date().toISOString();
      convo.archived_at = now;
      convo.is_archived_by = Array.from(new Set([...(convo.is_archived_by || []), adminUserId]));
      convo.isArchivedBy = convo.is_archived_by;
      convo.updated_at = now;
      return convo;
    });
  }

  public async attachDocumentToMessage(messageId: string, documentId: string): Promise<MessageAttachment | undefined> {
    return this.mutate((db) => {
      const msg = (db.chatMessages || []).find((m) => m.id === messageId);
      if (!msg) return undefined;
      const doc = (db.attachments || []).find((a) => a.id === documentId);
      if (!doc) return undefined;

      const now = new Date().toISOString();
      const att: MessageAttachment = {
        id: `matt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        message_id: messageId,
        document_id: documentId,
        documentFileName: doc.fileName || doc.filename,
        documentFileType: doc.fileType,
        documentFileSize: doc.fileSize,
        documentUrl: doc.url || doc.dataUrl,
        createdAt: now,
      };

      if (!db.messageAttachments) db.messageAttachments = [];
      db.messageAttachments.push(att);

      // Also ensure message has attachment reference
      if (!msg.attachments) msg.attachments = [];
      if (!msg.attachments.some((a) => a.attachment_id === documentId || a.attachmentId === documentId)) {
        msg.attachments.push({
          attachment_id: documentId,
          attachmentId: documentId,
          attachment_name: doc.fileName || doc.filename || 'سند',
          attachmentName: doc.fileName || doc.filename || 'سند',
          attachment_file_size: doc.fileSize,
          attachmentFileSize: doc.fileSize,
          attachment_file_type: doc.fileType,
          attachmentFileType: doc.fileType,
          data_url: doc.dataUrl,
          thumbnail_data_url: doc.thumbnailDataUrl,
        });
      }
      if (!msg.message_attachments) msg.message_attachments = [];
      msg.message_attachments.push(att);
      return att;
    });
  }

  // ----------------------------------------------------
  // Broadcast Operations (Stage 3)
  // ----------------------------------------------------
  public async createBroadcast(
    senderUserId: string,
    senderUserName: string,
    title: string,
    body: string,
    targetType: 'ALL' | 'SELECTED',
    recipientUserIds: string[]
  ): Promise<{ broadcast: Broadcast; recipients: BroadcastRecipient[] }> {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const broadcastId = `bc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const recipients: BroadcastRecipient[] = recipientUserIds.map((uid) => {
        const u = db.users.find((user) => user.id === uid);
        return {
          id: `bcr-${Date.now()}-${uid}`,
          broadcast_id: broadcastId,
          broadcastId,
          user_id: uid,
          userId: uid,
          user_name: u?.name,
          userName: u?.name,
          status: BroadcastRecipientStatus.DELIVERED,
          delivered_at: now,
          deliveredAt: now,
        };
      });

      const broadcast: Broadcast = {
        id: broadcastId,
        sender_user_id: senderUserId,
        senderUserId,
        sender_user_name: senderUserName,
        senderUserName,
        title,
        body,
        target_type: targetType,
        created_at: now,
        createdAt: now,
        status: BroadcastStatus.SENT,
        recipient_count: recipients.length,
        sent_count: recipients.length,
        delivered_count: recipients.length,
        read_count: 0,
        failed_count: 0,
      };

      if (!db.broadcasts) db.broadcasts = [];
      if (!db.broadcastRecipients) db.broadcastRecipients = [];
      db.broadcasts.unshift(broadcast);
      db.broadcastRecipients.push(...recipients);

      // Create in-app notifications for each recipient
      recipients.forEach((rec) => {
        const notifId = `notif-bc-${Date.now()}-${rec.user_id}`;
        db.notifications = db.notifications || [];
        db.notifications.unshift({
          id: notifId,
          userId: rec.user_id,
          title: `پیام همگانی: ${title || 'اطلاعیه جدید'}`,
          message: body.slice(0, 150),
          category: 'SYSTEM',
          severity: 'INFO',
          read: false,
          createdAt: now,
          relatedEntityType: 'BROADCAST',
          relatedEntityId: broadcastId,
        });
      });

      return { broadcast, recipients };
    });
  }

  public getBroadcastsForAdmin(): Broadcast[] {
    return Array.isArray(this.getState().broadcasts)
      ? [...this.getState().broadcasts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      : [];
  }

  public getBroadcastById(id: string): { broadcast?: Broadcast; recipients: BroadcastRecipient[] } {
    const state = this.getState();
    const broadcast = (state.broadcasts || []).find((b) => b.id === id);
    const recipients = (state.broadcastRecipients || []).filter((r) => r.broadcast_id === id || r.broadcastId === id);
    return { broadcast, recipients };
  }

  public async markBroadcastRead(broadcastId: string, userId: string): Promise<boolean> {
    return this.mutate((db) => {
      const rec = (db.broadcastRecipients || []).find((r) => (r.broadcast_id === broadcastId || r.broadcastId === broadcastId) && (r.user_id === userId || r.userId === userId));
      if (!rec || rec.status === BroadcastRecipientStatus.READ) return false;
      const now = new Date().toISOString();
      rec.status = BroadcastRecipientStatus.READ;
      rec.read_at = now;
      rec.readAt = now;

      const bc = (db.broadcasts || []).find((b) => b.id === broadcastId);
      if (bc) {
        bc.read_count = (bc.read_count || 0) + 1;
      }
      return true;
    });
  }

  // ----------------------------------------------------
  // Registered SIM Holders (افراد ثبت‌کننده سیم‌کارت)
  // =========================================================================
  public getRegisteredHolders(includeDeleted = false): RegisteredHolder[] {
    const holders = this.getState().registeredHolders || [];
    if (includeDeleted) return holders;
    return holders.filter((h) => !h.isDeleted);
  }

  public async saveRegisteredHolder(holder: RegisteredHolder): Promise<RegisteredHolder> {
    return this.mutate((db) => {
      if (!db.registeredHolders) db.registeredHolders = [];
      const now = new Date().toISOString();
      const existingIdx = db.registeredHolders.findIndex((h) => h.id === holder.id);
      
      if (existingIdx >= 0) {
        const updated = {
          ...db.registeredHolders[existingIdx],
          ...holder,
          updatedAt: now,
        };
        db.registeredHolders[existingIdx] = updated;
        return updated;
      } else {
        const newHolder: RegisteredHolder = {
          ...holder,
          id: holder.id || `hld-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          isActive: holder.isActive ?? true,
          createdAt: holder.createdAt || now,
          updatedAt: now,
        };
        db.registeredHolders.push(newHolder);
        return newHolder;
      }
    });
  }

  public async deleteRegisteredHolder(id: string, deletedBy: string, deleteReason?: string): Promise<{ success: boolean; message: string }> {
    return this.mutate((db) => {
      if (!db.registeredHolders) return { success: false, message: 'رکوردی یافت نشد' };
      const holder = db.registeredHolders.find((h) => h.id === id);
      if (!holder) return { success: false, message: 'شخص ثبت‌کننده یافت نشد' };

      // Check if active SIMs are linked
      const linkedSims = (db.sims || []).filter((s) => s.registeredHolderId === id && s.status !== 'SUSPENDED');
      if (linkedSims.length > 0) {
        return {
          success: false,
          message: `امکان حذف این شخص وجود ندارد؛ تعداد ${linkedSims.length} سیم‌کارت فعال به نام ایشان ثبت است.`
        };
      }

      const now = new Date().toISOString();
      holder.isDeleted = true;
      holder.deletedBy = deletedBy;
      holder.deletedAt = now;
      holder.deleteReason = deleteReason || 'حذف توسط مدیر سامانه';

      // Audit log entry
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push({
        id: `audit-${Date.now()}`,
        timestamp: now,
        userId: deletedBy,
        userName: 'مدیر سامانه',
        userRole: UserRole.SUPER_ADMIN,
        action: 'حذف شخص ثبت‌کننده سیم‌کارت',
        module: ModuleName.SIM_INVENTORY,
        details: `شخص ثبتی «${holder.fullName}» با کد ملی «${holder.nationalId}» حذف گردید. علت: ${holder.deleteReason}`
      });

      return { success: true, message: 'شخص ثبت‌کننده با ثبت لاگ مدیریتی حذف گردید' };
    });
  }

  // =========================================================================
  // Contract Installments (اقساط قراردادها و فروش)
  // =========================================================================
  public getContractInstallments(contractId?: string): ContractInstallment[] {
    const list = this.getState().contractInstallments || [];
    if (!contractId) return list;
    return list.filter((i) => i.contractId === contractId);
  }

  public async saveContractInstallment(installment: ContractInstallment): Promise<ContractInstallment> {
    return this.mutate((db) => {
      if (!db.contractInstallments) db.contractInstallments = [];
      const now = new Date().toISOString();
      const existingIdx = db.contractInstallments.findIndex((i) => i.id === installment.id);
      if (existingIdx >= 0) {
        const updated = { ...db.contractInstallments[existingIdx], ...installment, updatedAt: now };
        db.contractInstallments[existingIdx] = updated;
        return updated;
      } else {
        const created: ContractInstallment = {
          ...installment,
          id: installment.id || `inst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: installment.createdAt || now,
          updatedAt: now,
        };
        db.contractInstallments.push(created);
        return created;
      }
    });
  }

  public async recordInstallmentPayment(installmentId: string, payment: Payment): Promise<{ installment?: ContractInstallment; payment: Payment }> {
    return this.mutate((db) => {
      if (!db.payments) db.payments = [];
      if (!db.contractInstallments) db.contractInstallments = [];

      const now = new Date().toISOString();
      const newPayment: Payment = {
        ...payment,
        id: payment.id || `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        installmentId,
        createdAt: payment.createdAt || now,
        updatedAt: now,
      };
      db.payments.push(newPayment);

      const installment = db.contractInstallments.find((i) => i.id === installmentId);
      if (installment) {
        if (!installment.payments) installment.payments = [];
        installment.payments.push(newPayment);
        const totalPaid = (installment.paidAmount || 0) + Number(payment.amount || 0);
        installment.paidAmount = totalPaid;
        installment.remainingAmount = Math.max(0, (installment.totalDue || 0) - totalPaid);
        if (installment.remainingAmount === 0) {
          installment.status = InstallmentStatus.PAID;
        } else {
          installment.status = InstallmentStatus.PARTIALLY_PAID;
        }
        installment.updatedAt = now;
      }

      return { installment, payment: newPayment };
    });
  }

  // =========================================================================
  // Biometric Devices & Passkeys (WebAuthn)
  // =========================================================================
  public getTrustedBiometricDevices(userId?: string): TrustedBiometricDevice[] {
    const list = this.getState().trustedBiometricDevices || [];
    if (!userId) return list;
    return list.filter((d) => d.userId === userId && !d.isRevoked);
  }

  public async registerBiometricDevice(device: TrustedBiometricDevice): Promise<TrustedBiometricDevice> {
    return this.mutate((db) => {
      if (!db.trustedBiometricDevices) db.trustedBiometricDevices = [];
      const now = new Date().toISOString();
      const existingIdx = db.trustedBiometricDevices.findIndex((d) => d.credentialId === device.credentialId);
      if (existingIdx >= 0) {
        db.trustedBiometricDevices[existingIdx] = {
          ...db.trustedBiometricDevices[existingIdx],
          ...device,
          isRevoked: false,
          revokedAt: undefined,
          lastUsedAt: now,
        };
        return db.trustedBiometricDevices[existingIdx];
      } else {
        const newDevice: TrustedBiometricDevice = {
          ...device,
          id: device.id || `bio-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: device.createdAt || now,
          lastUsedAt: now,
          isRevoked: false,
        };
        db.trustedBiometricDevices.push(newDevice);
        return newDevice;
      }
    });
  }

  public async revokeBiometricDevice(deviceId: string, userId?: string): Promise<boolean> {
    return this.mutate((db) => {
      if (!db.trustedBiometricDevices) return false;
      const device = db.trustedBiometricDevices.find((d) => d.id === deviceId && (!userId || d.userId === userId));
      if (device) {
        device.isRevoked = true;
        device.revokedAt = new Date().toISOString();
        return true;
      }
      return false;
    });
  }

  public findBiometricDeviceByCredentialId(credentialId: string): TrustedBiometricDevice | undefined {
    return (this.getState().trustedBiometricDevices || []).find((d) => d.credentialId === credentialId && !d.isRevoked);
  }

  public async updateBiometricDeviceLastUsed(credentialId: string): Promise<void> {
    await this.mutate((db) => {
      const device = (db.trustedBiometricDevices || []).find((d) => d.credentialId === credentialId);
      if (device) {
        device.lastUsedAt = new Date().toISOString();
      }
      return db;
    });
  }

  // Batch Push / Conflict Resolution
  public async batchSyncPush(payload: Partial<CentralDatabaseSchema>): Promise<CentralDatabaseSchema> {
    return this.mutate((db) => {
      const mergeEntityList = <T extends { id: string; updatedAt?: string; createdAt?: string }>(
        currentList: T[],
        incomingList?: T[]
      ): T[] => {
        if (!incomingList || !Array.isArray(incomingList)) return currentList;
        const map = new Map<string, T>();
        currentList.forEach((item) => map.set(item.id, item));

        incomingList.forEach((incoming) => {
          if (!incoming.id) return;
          const existing = map.get(incoming.id);
          if (!existing) {
            map.set(incoming.id, incoming);
          } else {
            // Timestamp conflict resolution
            const incomingTime = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();
            const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
            if (incomingTime >= existingTime) {
              map.set(incoming.id, { ...existing, ...incoming });
            }
          }
        });
        return Array.from(map.values());
      };

      if (payload.customers) db.customers = mergeEntityList(db.customers, payload.customers);
      if (payload.leads) db.leads = mergeEntityList(db.leads, payload.leads);
      if (payload.calls) db.calls = mergeEntityList(db.calls, payload.calls);
      if (payload.interactions) db.interactions = mergeEntityList(db.interactions, payload.interactions);
      if (payload.voiceNotes) db.voiceNotes = mergeEntityList(db.voiceNotes, payload.voiceNotes);
      if (payload.tasks) db.tasks = mergeEntityList(db.tasks, payload.tasks);
      if (payload.contracts) db.contracts = mergeEntityList(db.contracts, payload.contracts);
      if (payload.payments) db.payments = mergeEntityList(db.payments, payload.payments);
      if (payload.checks) db.checks = mergeEntityList(db.checks, payload.checks);
      if (payload.sims) db.sims = mergeEntityList(db.sims, payload.sims);
      if (payload.repairs) db.repairs = mergeEntityList(db.repairs, payload.repairs);
      if (payload.attachments) db.attachments = mergeEntityList(db.attachments, payload.attachments);
      if (payload.accounts) db.accounts = mergeEntityList(db.accounts, payload.accounts);
      if (payload.journalEntries) db.journalEntries = mergeEntityList(db.journalEntries, payload.journalEntries);
      if (payload.journalEntryLines) db.journalEntryLines = mergeEntityList(db.journalEntryLines, payload.journalEntryLines);
      if (payload.accountingPeriods) db.accountingPeriods = mergeEntityList(db.accountingPeriods, payload.accountingPeriods);
      if (payload.documentShares) db.documentShares = mergeEntityList(db.documentShares, payload.documentShares);
      if (payload.conversations) db.conversations = mergeEntityList(db.conversations, payload.conversations);
      if (payload.chatMessages) db.chatMessages = mergeEntityList(db.chatMessages, payload.chatMessages);
      if (payload.registeredHolders) db.registeredHolders = mergeEntityList(db.registeredHolders, payload.registeredHolders);
      if (payload.contractInstallments) db.contractInstallments = mergeEntityList(db.contractInstallments, payload.contractInstallments);
      if (payload.trustedBiometricDevices) db.trustedBiometricDevices = mergeEntityList(db.trustedBiometricDevices, payload.trustedBiometricDevices);
      if (payload.problemReports) db.problemReports = mergeEntityList(db.problemReports, payload.problemReports);
      if (payload.users) db.users = mergeEntityList(db.users, payload.users);
      if (payload.roles) db.roles = mergeEntityList(db.roles, payload.roles);
      if (payload.settings) db.settings = { ...db.settings, ...payload.settings, updatedAt: new Date().toISOString() };

      return db;
    });
  }

  // Full Database Import / Export
  public async importFullDatabase(importedData: any): Promise<CentralDatabaseSchema> {
    return this.mutate((db) => {
      const sanitized = this.sanitizeAndMigrate(importedData);
      Object.assign(db, sanitized);
      db.revision = (db.revision || 1) + 1;
      db.lastUpdatedAt = new Date().toISOString();
      return db;
    });
  }
}

export const centralDb = new CentralDatabase();
