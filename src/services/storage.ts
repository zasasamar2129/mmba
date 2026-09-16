import {
  User, UserRole, UserStatus, Customer, Lead, LeadStatus, Call, Interaction, InteractionType, Task, TaskStatus, TaskPriority,
  Contract, Payment, PaymentStatus, Check, SimCard, Repair,
  Attachment, Notification, AuditLog, Role, DateSuggestion, ShareableLink, ModuleName,
  VoiceNote, VoiceNoteCategory, ProblemReport,
  Account, JournalEntry, JournalEntryLine, AccountingPeriod, DocumentShare, DocumentShareStatus,
  RegisteredHolder, ContractInstallment, InstallmentStatus, TrustedBiometricDevice,
  LeadActivity, LeadFollowUpSummary, LeadActivityType,
  Consignment, ConsignmentContact,
  ChatConversation, ChatMessage, ConversationType, ChatMemberRole, MessageStatus, NoteType
} from '../types';
import { DEFAULT_ROLES } from '../lib/permissions';
import { normalizePhoneNumber } from '../lib/numberUtils';
import { gregorianToJalali } from '../lib/dateUtils';
import { api } from './api';
import { idbStorage } from '../lib/idbStorage';

// Initial fallback admin if server is booting
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

export interface SyncStatus {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  serverRevision: number;
  pendingChangesCount: number;
}

type ListenerCallback = (data: any) => void;
const listeners: Set<ListenerCallback> = new Set();

function emitChange(event: { key: string; action: string; payload?: any }) {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch (e) {
      console.error('Storage listener error:', e);
    }
  });
}

export function subscribeToStorage(fn: ListenerCallback): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

class CentralStorageService {
  // In-memory cache synchronized with central backend
  private users: User[] = SEED_USERS;
  private roles: Role[] = DEFAULT_ROLES;
  private customers: Customer[] = [];
  private leads: Lead[] = [];
  private calls: Call[] = [];
  private interactions: Interaction[] = [];
  private voiceNotes: VoiceNote[] = [];
  private tasks: Task[] = [];
  private contracts: Contract[] = [];
  private payments: Payment[] = [];
  private checks: Check[] = [];
  private sims: SimCard[] = [];
  private repairs: Repair[] = [];
  private attachments: Attachment[] = [];
  private accounts: Account[] = [];
  private journalEntries: JournalEntry[] = [];
  private journalEntryLines: JournalEntryLine[] = [];
  private accountingPeriods: AccountingPeriod[] = [];
  private documentShares: DocumentShare[] = [];
  private registeredHolders: RegisteredHolder[] = [];
  private contractInstallments: ContractInstallment[] = [];
  private trustedBiometricDevices: TrustedBiometricDevice[] = [];
  private notifications: Notification[] = [];
  private auditLogs: AuditLog[] = [];
  private dateSuggestions: DateSuggestion[] = [];
  private sharedLinks: ShareableLink[] = [];
  private problemReports: ProblemReport[] = [];
  private consignments: Consignment[] = [];
  private conversations: ChatConversation[] = [];
  private chatMessages: ChatMessage[] = [];
  private settings: any = {};

  // Session & Sync state
  private currentUser: User = SEED_USERS[0];
  private isLoggedInState: boolean = false;
  private isLocked: boolean = false;
  private lockedUserId: string | null = null;
  private autoLockMinutes: number = 15;
  private currentRevision: number = 0;
  private isSyncing: boolean = false;
  private isConnected: boolean = true;
  private lastSyncTime: string | null = null;
  private syncIntervalId: any = null;
  private drafts: Record<string, any> = {};

  constructor() {
    this.loadLocalCache();
    this.startBackgroundSync();
  }

  // Load transient offline cache from browser storage for zero-flicker startup
  private loadLocalCache(): void {
    try {
      const cached = localStorage.getItem('mmba_central_cache_snapshot');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.users) this.users = parsed.users;
        if (parsed.roles) this.roles = parsed.roles;
        if (parsed.customers) this.customers = parsed.customers;
        if (parsed.leads) this.leads = parsed.leads;
        if (parsed.calls) this.calls = parsed.calls;
        if (parsed.interactions) this.interactions = parsed.interactions;
        if (parsed.voiceNotes) this.voiceNotes = parsed.voiceNotes;
        if (parsed.tasks) this.tasks = parsed.tasks;
        if (parsed.contracts) this.contracts = parsed.contracts;
        if (parsed.payments) this.payments = parsed.payments;
        if (parsed.checks) this.checks = parsed.checks;
        if (parsed.sims) this.sims = parsed.sims;
        if (parsed.repairs) this.repairs = parsed.repairs;
        if (parsed.attachments) this.attachments = parsed.attachments;
        if (parsed.accounts) this.accounts = parsed.accounts;
        if (parsed.journalEntries) this.journalEntries = parsed.journalEntries;
        if (parsed.journalEntryLines) this.journalEntryLines = parsed.journalEntryLines;
        if (parsed.accountingPeriods) this.accountingPeriods = parsed.accountingPeriods;
        if (parsed.documentShares) this.documentShares = parsed.documentShares;
        if (parsed.registeredHolders) this.registeredHolders = parsed.registeredHolders;
        if (parsed.contractInstallments) this.contractInstallments = parsed.contractInstallments;
        if (parsed.trustedBiometricDevices) this.trustedBiometricDevices = parsed.trustedBiometricDevices;
        if (parsed.notifications) this.notifications = parsed.notifications;
        if (parsed.auditLogs) this.auditLogs = parsed.auditLogs;
        if (parsed.dateSuggestions) this.dateSuggestions = parsed.dateSuggestions;
        if (parsed.sharedLinks) this.sharedLinks = parsed.sharedLinks;
        if (parsed.problemReports) this.problemReports = parsed.problemReports;
        if (parsed.consignments) this.consignments = parsed.consignments;
        if (parsed.conversations) this.conversations = parsed.conversations;
        if (parsed.chatMessages) this.chatMessages = parsed.chatMessages;
        if (parsed.settings) this.settings = parsed.settings;
        if (parsed.revision) this.currentRevision = parsed.revision;
      }

      // Rehydrate stripped documents & ID cards asynchronously from IndexedDB
      if (this.registeredHolders && this.registeredHolders.length > 0) {
        this.registeredHolders.forEach(async (h) => {
          if (!h.nationalIdImageUrl && h.id) {
            try {
              const cachedImg = await idbStorage.get<string>(`holder_idcard_${h.id}`);
              if (cachedImg) {
                h.nationalIdImageUrl = cachedImg;
              }
            } catch (_) {}
          }
        });
      }

      const storedUser = localStorage.getItem('mmba_active_user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        const matched = this.users.find((user) => user.id === u.id);
        this.currentUser = matched || u;
      }

      // Restore a valid persisted session on reload, while still requiring credentials
      // on a fresh tab that has no persistent login. Guards: stored login flag + a
      // real active user + an auth token (token-<userId>) set at login.
      let sessionActive = false;
      try {
        sessionActive = sessionStorage.getItem('mmba_session_active') === 'true';
      } catch (e) {}
      const storedLogin = localStorage.getItem('mmba_is_logged_in');
      const hasValidStoredUser = !!this.currentUser && !!this.currentUser.id;
      let hasAuthToken = false;
      try {
        hasAuthToken = !!localStorage.getItem('mmba_auth_token');
      } catch (e) {}
      if (sessionActive || (storedLogin === 'true' && hasValidStoredUser && hasAuthToken)) {
        this.isLoggedInState = true;
      } else {
        this.isLoggedInState = false;
        localStorage.removeItem('mmba_is_logged_in');
      }

      const locked = localStorage.getItem('mmba_is_locked');
      if (locked !== null) {
        this.isLocked = JSON.parse(locked);
        this.lockedUserId = localStorage.getItem('mmba_locked_user_id');
      }

      const drafts = localStorage.getItem('mmba_form_drafts');
      if (drafts) {
        this.drafts = JSON.parse(drafts);
      }
    } catch (e) {
      console.warn('Could not load local snapshot cache:', e);
    }
  }

  // Save transient snapshot to local storage safely without hitting 5MB quota
  private saveLocalCacheSnapshot(): void {
    try {
      const snapshot = {
        revision: this.currentRevision,
        users: this.users,
        roles: this.roles,
        customers: this.customers,
        leads: this.leads,
        calls: this.calls,
        interactions: this.interactions,
        voiceNotes: this.voiceNotes,
        tasks: this.tasks,
        contracts: this.contracts,
        payments: this.payments,
        checks: this.checks,
        sims: this.sims,
        repairs: this.repairs,
        attachments: this.attachments,
        accounts: this.accounts,
        journalEntries: this.journalEntries,
        journalEntryLines: this.journalEntryLines,
        accountingPeriods: this.accountingPeriods,
        documentShares: this.documentShares,
        registeredHolders: this.registeredHolders,
        contractInstallments: this.contractInstallments,
        trustedBiometricDevices: this.trustedBiometricDevices,
        notifications: this.notifications,
        auditLogs: this.auditLogs,
        dateSuggestions: this.dateSuggestions,
        sharedLinks: this.sharedLinks,
        problemReports: this.problemReports,
        consignments: this.consignments,
        conversations: this.conversations,
        chatMessages: this.chatMessages,
        settings: this.settings,
      };

      // Asynchronously mirror full snapshot and large assets into IndexedDB (high capacity)
      try {
        idbStorage.set('mmba_full_snapshot', snapshot).catch(() => {});
        for (const h of this.registeredHolders || []) {
          if (h.id && h.nationalIdImageUrl) {
            idbStorage.set(`holder_idcard_${h.id}`, h.nationalIdImageUrl).catch(() => {});
          }
        }
      } catch (_) {}

      // Sanitize attachments for localStorage: strip oversized base64 data to avoid QuotaExceeded
      const safeAttachments = (this.attachments || []).map((att) => {
        if (att.dataUrl && att.dataUrl.length > 25000) {
          const { dataUrl, ...meta } = att;
          return meta as Attachment;
        }
        return att;
      });

      // Sanitize registeredHolders for localStorage: strip bulky nationalIdImageUrl base64
      const safeRegisteredHolders = (this.registeredHolders || []).map((holder) => {
        if (holder.nationalIdImageUrl && holder.nationalIdImageUrl.length > 25000) {
          const { nationalIdImageUrl, ...rest } = holder;
          return rest as RegisteredHolder;
        }
        return holder;
      });

      const safeSnapshot = {
        ...snapshot,
        attachments: safeAttachments,
        registeredHolders: safeRegisteredHolders,
      };

      try {
        localStorage.setItem('mmba_central_cache_snapshot', JSON.stringify(safeSnapshot));
      } catch (quotaErr) {
        // In case of quota pressure, strip all heavy entities and prune old drafts
        const minimalRegisteredHolders = (this.registeredHolders || []).map((h) => {
          const { nationalIdImageUrl, ...rest } = h;
          return rest as RegisteredHolder;
        });
        const minimalSnapshot = {
          ...safeSnapshot,
          attachments: [],
          registeredHolders: minimalRegisteredHolders,
          auditLogs: (this.auditLogs || []).slice(0, 20),
          problemReports: (this.problemReports || []).slice(0, 10),
        };

        try {
          // Clear any dangling legacy draft keys to free up localStorage quota
          Object.keys(localStorage).forEach((k) => {
            if (k.startsWith('draft_cust_') || k.startsWith('temp_')) {
              try { localStorage.removeItem(k); } catch (_) {}
            }
          });
          localStorage.setItem('mmba_central_cache_snapshot', JSON.stringify(minimalSnapshot));
        } catch (_) {
          // Silent fallback - data is already safely stored in IndexedDB and in-memory state
        }
      }

      try {
        localStorage.setItem('mmba_active_user', JSON.stringify(this.currentUser));
        localStorage.setItem('mmba_is_logged_in', JSON.stringify(this.isLoggedInState));
        localStorage.setItem('mmba_is_locked', JSON.stringify(this.isLocked));
        if (this.lockedUserId) {
          localStorage.setItem('mmba_locked_user_id', this.lockedUserId);
        } else {
          localStorage.removeItem('mmba_locked_user_id');
        }
      } catch (_) {}
    } catch (e) {
      // Non-blocking catch to ensure UI never freezes
    }
  }

  // ----------------------------------------------------
  // Background Central Synchronization Engine
  // ----------------------------------------------------
  public startBackgroundSync(): void {
    if (this.syncIntervalId) return;

    // Initial immediate synchronization — only when a session already exists so the
    // constructor-time seed admin doesn't race with a pending login.
    if (this.isLoggedInState) {
      this.syncWithServer(true);
    }

    // Poll version check every 3.5 seconds to detect cross-device changes instantly
    this.syncIntervalId = setInterval(async () => {
      try {
        const ver = await api.getSyncVersion();
        this.isConnected = true;
        if (ver.revision !== this.currentRevision) {
          await this.syncWithServer(false);
        }
      } catch (err) {
        this.isConnected = false;
      }
    }, 3500);
  }

  public async syncWithServer(force = false): Promise<boolean> {
    if (this.isSyncing) return false;
    this.isSyncing = true;
    try {
      const res = await api.getSyncAll();
      if (res.success && res.data) {
        this.currentRevision = res.revision;
        this.lastSyncTime = new Date().toISOString();
        this.isConnected = true;

        this.users = res.data.users || this.users;
        this.roles = res.data.roles || this.roles;
        this.customers = res.data.customers || [];
        this.leads = res.data.leads || [];
        this.calls = res.data.calls || [];
        this.interactions = res.data.interactions || [];
        this.voiceNotes = res.data.voiceNotes || [];
        this.tasks = res.data.tasks || [];
        this.contracts = res.data.contracts || [];
        this.payments = res.data.payments || [];
        this.checks = res.data.checks || [];
        this.sims = res.data.sims || [];
        this.repairs = res.data.repairs || [];
        this.attachments = res.data.attachments || [];
        this.accounts = (res.data as any).accounts || this.accounts;
        this.journalEntries = (res.data as any).journalEntries || this.journalEntries;
        this.journalEntryLines = (res.data as any).journalEntryLines || this.journalEntryLines;
        this.accountingPeriods = (res.data as any).accountingPeriods || this.accountingPeriods;
        this.documentShares = (res.data as any).documentShares || this.documentShares;
        this.registeredHolders = (res.data as any).registeredHolders || this.registeredHolders;
        this.contractInstallments = (res.data as any).contractInstallments || this.contractInstallments;
        this.trustedBiometricDevices = (res.data as any).trustedBiometricDevices || this.trustedBiometricDevices;
        this.notifications = res.data.notifications || [];
        this.auditLogs = res.data.auditLogs || [];
        this.dateSuggestions = res.data.dateSuggestions || [];
        this.sharedLinks = res.data.sharedLinks || [];
        this.problemReports = (res.data as any).problemReports || this.problemReports;
        this.consignments = (res.data as any).consignments || this.consignments;
        this.conversations = (res.data as any).conversations || this.conversations;
        this.chatMessages = (res.data as any).chatMessages || this.chatMessages;
        this.settings = res.data.settings || this.settings;

        // Keep current active user profile in sync if modified on another device
        const updatedSelf = this.users.find(
          (u) =>
            (this.currentUser && u.id === this.currentUser.id) ||
            (this.currentUser && u.username && this.currentUser.username && u.username.toLowerCase() === this.currentUser.username.toLowerCase())
        );
        if (updatedSelf) {
          this.currentUser = updatedSelf;
        } else if (this.users.length > 0 && !this.currentUser) {
          this.currentUser = this.users[0];
        }

        this.saveLocalCacheSnapshot();
        emitChange({ key: 'ALL', action: 'SYNC', payload: { revision: this.currentRevision } });
        if (updatedSelf) {
          emitChange({ key: 'CURRENT_USER', action: 'UPDATE', payload: updatedSelf });
        }
        this.isSyncing = false;
        return true;
      }
    } catch (err) {
      console.warn('[MMBA Central Sync] Offline or server unavailable:', err);
      this.isConnected = false;
    } finally {
      this.isSyncing = false;
    }
    return false;
  }

  public getSyncStatus(): SyncStatus {
    return {
      isConnected: this.isConnected,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      serverRevision: this.currentRevision,
      pendingChangesCount: 0,
    };
  }

  public async forceSync(): Promise<boolean> {
    return this.syncWithServer(true);
  }

  public initializeStorage(): void {
    this.syncWithServer(true);
  }

  // ----------------------------------------------------
  // Authentication & Session Management
  // ----------------------------------------------------
  public getUsers(): User[] {
    return this.users.length > 0 ? this.users : SEED_USERS;
  }

  public getCurrentUser(): User {
    if (!this.currentUser) {
      this.currentUser = this.getUsers()[0];
    }
    return this.currentUser;
  }

  public isLoggedIn(): boolean {
    return this.isLoggedInState;
  }

  public async login(usernameOrEmail: string, passwordAttempt: string): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
      const res = await api.login(usernameOrEmail, passwordAttempt);
      if (res.success && res.user) {
        api.setAuthToken(res.token);
        this.currentUser = res.user;
        this.isLoggedInState = true;
        this.isLocked = false;
        this.lockedUserId = null;
        try {
          sessionStorage.setItem('mmba_session_active', 'true');
        } catch (e) {}
        this.saveLocalCacheSnapshot();

        await this.syncWithServer(true);

        emitChange({ key: 'CURRENT_USER', action: 'LOGIN', payload: res.user });
        emitChange({ key: 'IS_LOGGED_IN', action: 'UPDATE', payload: true });
        return { success: true, user: res.user };
      } else {
        return { success: false, message: res.message || 'نام کاربری یا کلمه عبور اشتباه است.' };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'خطا در برقراری ارتباط با سرور مرکزی' };
    }
  }

  public async verifyUserPassword(userId: string, passwordAttempt: string): Promise<boolean> {
    try {
      const res = await api.login(this.users.find((u) => u.id === userId)?.username || '', passwordAttempt);
      return res.success;
    } catch {
      return false;
    }
  }

  public isSessionLocked(): boolean {
    return this.isLocked;
  }

  public getLockedUser(): User {
    if (this.lockedUserId) {
      const matched = this.users.find((u) => u.id === this.lockedUserId);
      if (matched) return matched;
    }
    return this.getCurrentUser();
  }

  public lockSession(userId?: string): void {
    const targetUser = userId ? (this.users.find((u) => u.id === userId) || this.getCurrentUser()) : this.getCurrentUser();
    this.isLocked = true;
    this.lockedUserId = targetUser.id;
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'IS_LOCKED', action: 'UPDATE', payload: true });
  }

  public async unlockSession(passwordAttempt: string): Promise<{ success: boolean; message?: string; user?: User }> {
    const lockedUser = this.getLockedUser();

    // Verify the password against the server (bcrypt check)
    try {
      const res = await api.login(lockedUser.username || '', passwordAttempt);
      if (!res.success) {
        return { success: false, message: 'رمز عبور وارد شده نادرست است.' };
      }

      // Store the server-issued JWT token
      if (res.token) {
        api.setAuthToken(res.token);
      }

      this.isLocked = false;
      this.lockedUserId = null;
      this.currentUser = lockedUser;
      this.isLoggedInState = true;
      this.saveLocalCacheSnapshot();

      emitChange({ key: 'IS_LOCKED', action: 'UPDATE', payload: false });
      emitChange({ key: 'CURRENT_USER', action: 'UPDATE', payload: lockedUser });
      emitChange({ key: 'IS_LOGGED_IN', action: 'UPDATE', payload: true });

      return { success: true, user: lockedUser };
    } catch {
      return { success: false, message: 'خطا در برقراری ارتباط با سرور' };
    }
  }

  public getAutoLockMinutes(): number {
    return this.autoLockMinutes;
  }

  public setAutoLockMinutes(minutes: number): void {
    this.autoLockMinutes = minutes;
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'AUTO_LOCK_MINUTES', action: 'UPDATE', payload: minutes });
  }

  public logout(): void {
    this.isLoggedInState = false;
    api.setAuthToken(null);
    try {
      sessionStorage.removeItem('mmba_session_active');
    } catch (e) {}
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'IS_LOGGED_IN', action: 'UPDATE', payload: false });
  }

  public setCurrentUser(user: User): void {
    this.currentUser = user;
    this.isLoggedInState = true;
    // The token is now set by the login response — do NOT forge a client-side token here.
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CURRENT_USER', action: 'UPDATE', payload: user });
  }

  public saveUser(user: User): void {
    const normUsername = (user.username || '').trim().toLowerCase();
    const targetId = (user.id || '').trim();

    const idx = this.users.findIndex(
      (u) =>
        (targetId && u.id === targetId) ||
        (normUsername && u.username && u.username.toLowerCase() === normUsername)
    );
    const now = new Date().toISOString();
    let updatedUser: User;

    if (idx >= 0) {
      const existing = this.users[idx];
      const finalId =
        normUsername === 'admin' || existing.username?.toLowerCase() === 'admin'
          ? 'usr-admin'
          : existing.id || targetId || `usr-${Date.now()}`;

      updatedUser = {
        ...existing,
        ...user,
        id: finalId,
        username: normUsername || existing.username,
        updatedAt: now,
      };
      this.users[idx] = updatedUser;
      // Deduplicate any other occurrences
      this.users = this.users.filter(
        (u, i) =>
          i === idx ||
          (u.id !== finalId && u.username?.toLowerCase() !== updatedUser.username?.toLowerCase())
      );
    } else {
      const finalId =
        normUsername === 'admin' || targetId === 'usr-admin'
          ? 'usr-admin'
          : targetId || `usr-${Date.now()}`;
      updatedUser = {
        ...user,
        id: finalId,
        username: normUsername || user.username,
        createdAt: user.createdAt || now,
        updatedAt: now,
      };
      this.users.unshift(updatedUser);
    }

    if (
      this.currentUser.id === updatedUser.id ||
      (normUsername && this.currentUser.username?.toLowerCase() === normUsername)
    ) {
      this.currentUser = updatedUser;
      localStorage.setItem('mmba_active_user', JSON.stringify(updatedUser));
      emitChange({ key: 'CURRENT_USER', action: 'UPDATE', payload: updatedUser });
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'USERS', action: 'SAVE', payload: updatedUser });

    // Central Server Sync
    api.saveUser(updatedUser).catch((err) => console.error('Failed to sync user to server:', err));
  }

  public async deleteUser(id: string): Promise<boolean> {
    this.users = this.users.filter((u) => u.id !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'USERS', action: 'DELETE', payload: id });
    try {
      const res = await api.deleteUser(id);
      return res.success;
    } catch (err) {
      console.error('Failed to delete user on server:', err);
      throw err;
    }
  }

  public async resetUserPassword(id: string, newPassword: string): Promise<any> {
    const res = await api.resetUserPassword(id, newPassword);
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx >= 0 && res.user) {
      this.users[idx] = { ...this.users[idx], ...res.user, password: newPassword };
      this.saveLocalCacheSnapshot();
      emitChange({ key: 'USERS', action: 'SAVE', payload: this.users[idx] });
    }
    return res;
  }

  // ----------------------------------------------------
  // Roles & Permissions
  // ----------------------------------------------------
  public getRoles(): Role[] {
    return this.roles.length > 0 ? this.roles : DEFAULT_ROLES;
  }

  public updateRole(role: Role): void {
    const idx = this.roles.findIndex((r) => r.id === role.id || r.name === role.name);
    if (idx >= 0) {
      this.roles[idx] = role;
    } else {
      this.roles.push(role);
    }
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'ROLES', action: 'UPDATE', payload: role });
    api.saveRole(role).catch((err) => console.error('Failed to sync role to server:', err));
  }

  // ----------------------------------------------------
  // Customers & Contacts
  // ----------------------------------------------------
  public getCustomers(): Customer[] {
    return this.customers;
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.customers.find((c) => c.id === id);
  }

  public findCustomerByPhone(phone: string | undefined | null, excludeCustomerId?: string): Customer | undefined {
    if (!phone || !phone.trim()) return undefined;
    const cleanTarget = normalizePhoneNumber(phone);
    if (!cleanTarget) return undefined;

    return this.customers.find((c) => {
      if (excludeCustomerId && c.id === excludeCustomerId) return false;
      const cMobile = normalizePhoneNumber(c.mobile);
      const cPhone = normalizePhoneNumber(c.phone);
      return cMobile === cleanTarget || (cPhone && cPhone === cleanTarget);
    });
  }

  public saveCustomer(customer: Customer, allowDuplicate = false): Customer {
    if (!allowDuplicate) {
      const duplicateByMobile = customer.mobile ? this.findCustomerByPhone(customer.mobile, customer.id) : undefined;
      const duplicateByPhone = customer.phone ? this.findCustomerByPhone(customer.phone, customer.id) : undefined;
      const existingDuplicate = duplicateByMobile || duplicateByPhone;

      if (existingDuplicate) {
        const errorMsg = `این شماره (${customer.mobile || customer.phone}) از قبل برای مخاطب «${existingDuplicate.name}» ثبت شده است.`;
        const err: any = new Error(errorMsg);
        err.code = 'DUPLICATE_PHONE';
        err.existingCustomer = existingDuplicate;
        err.duplicateNumber = customer.mobile || customer.phone;
        throw err;
      }
    }

    const idx = this.customers.findIndex((c) => c.id === customer.id);
    let updatedCustomer: Customer;
    const now = new Date().toISOString();

    if (idx >= 0) {
      updatedCustomer = { ...this.customers[idx], ...customer, updatedAt: now };
      this.customers[idx] = updatedCustomer;
    } else {
      const codeNumber = 1040 + this.customers.length + 1;
      updatedCustomer = {
        ...customer,
        id: customer.id || `cust-${Date.now()}`,
        code: customer.code || `CUST-${codeNumber}`,
        registrationReason: customer.registrationReason || 'مشتری',
        registrationReasonOther: customer.registrationReasonOther || '',
        jobTitle: customer.jobTitle || '',
        createdAt: customer.createdAt || now,
        updatedAt: now,
      };
      this.customers.unshift(updatedCustomer);
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CUSTOMERS', action: 'SAVE', payload: updatedCustomer });

    // Sync to centralized server DB
    api.saveCustomer(updatedCustomer).catch((err) => console.error('Failed to sync customer to server:', err));
    return updatedCustomer;
  }

  public deleteCustomer(id: string): void {
    this.customers = this.customers.filter((c) => c.id !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CUSTOMERS', action: 'DELETE', payload: id });
    api.deleteCustomer(id).catch((err) => console.error('Failed to delete customer on server:', err));
  }

  public deleteMultipleCustomers(ids: string[]): { deletedCount: number } {
    if (!ids || ids.length === 0) return { deletedCount: 0 };
    const idSet = new Set(ids);
    const initialLen = this.customers.length;
    this.customers = this.customers.filter((c) => !idSet.has(c.id));
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CUSTOMERS', action: 'BULK_DELETE', payload: ids });
    api.bulkDeleteCustomers(ids).catch((err) => console.error('Failed to bulk delete customers on server:', err));
    return { deletedCount: initialLen - this.customers.length };
  }

  // ----------------------------------------------------
  // Leads & Anonymous Contacts (Sprint 02 Patch 01)
  // ----------------------------------------------------
  public getLeads(filter?: { status?: string; query?: string }): Lead[] {
    let list = [...this.leads];
    if (!filter) return list;

    if (filter.status && filter.status !== 'ALL') {
      list = list.filter((l) => l.status === filter.status);
    }
    if (filter.query) {
      const q = filter.query.trim().toLowerCase();
      const qNorm = normalizePhoneNumber(q);
      list = list.filter((l) => {
        const matchName = l.name && l.name.toLowerCase().includes(q);
        const matchCode = l.leadCode && l.leadCode.toLowerCase().includes(q);
        const matchMobile = l.mobile && (l.mobile.includes(q) || (qNorm && normalizePhoneNumber(l.mobile).includes(qNorm)));
        const matchNotes = l.notes && l.notes.toLowerCase().includes(q);
        return matchName || matchCode || matchMobile || matchNotes;
      });
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getLeadById(id: string): Lead | undefined {
    return this.leads.find((l) => l.id === id || l.leadCode === id);
  }

  public findLeadByMobile(mobile: string): Lead | undefined {
    if (!mobile) return undefined;
    const clean = normalizePhoneNumber(mobile);
    if (!clean) return undefined;
    return this.leads.find((l) => normalizePhoneNumber(l.mobile) === clean);
  }

  public async lookupContact(queryOrMobile: string): Promise<{
    contactType: 'CUSTOMER' | 'LEAD' | 'UNKNOWN';
    customer: Customer | null;
    lead: Lead | null;
    mobile?: string;
    stats: {
      interactionCount: number;
      contractCount?: number;
      totalPaid?: number;
      lastContactAt?: string;
      lastOutcome?: string;
    };
  }> {
    const raw = queryOrMobile.trim();
    const clean = normalizePhoneNumber(raw);

    // 1. Check local customer first
    const customer = this.customers.find((c) => {
      const cMob = normalizePhoneNumber(c.mobile);
      const cPh = normalizePhoneNumber(c.phone);
      return (clean && (cMob === clean || cPh === clean)) || c.id === raw || c.code === raw;
    });

    if (customer) {
      const inters = this.interactions.filter((i) => i.customer_id === customer.id || i.customerId === customer.id);
      const contracts = this.contracts.filter((c) => c.customerId === customer.id);
      const payments = this.payments.filter((p) => p.customerId === customer.id);
      const lastInter = inters[0];

      return {
        contactType: 'CUSTOMER',
        customer,
        lead: null,
        stats: {
          interactionCount: inters.length,
          contractCount: contracts.length,
          totalPaid: payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
          lastContactAt: lastInter?.started_at || lastInter?.startedAt || customer.createdAt,
          lastOutcome: lastInter?.outcome,
        },
      };
    }

    // 2. Check local lead
    const lead = this.leads.find((l) => {
      const lMob = normalizePhoneNumber(l.mobile);
      return (clean && lMob === clean) || l.id === raw || l.leadCode === raw;
    });

    if (lead) {
      const inters = this.interactions.filter((i) => i.lead_id === lead.id || i.leadId === lead.id || (i.customerMobile && normalizePhoneNumber(i.customerMobile) === clean));
      const lastInter = inters[0];
      return {
        contactType: 'LEAD',
        customer: null,
        lead,
        stats: {
          interactionCount: inters.length,
          lastContactAt: lead.lastContactAt || lastInter?.started_at || lead.createdAt,
          lastOutcome: lastInter?.outcome,
        },
      };
    }

    // Try server lookup if connected
    try {
      const serverRes = await api.lookupContact(raw);
      if (serverRes.success) {
        return serverRes;
      }
    } catch (e) {
      // offline fallback
    }

    return {
      contactType: 'UNKNOWN',
      customer: null,
      lead: null,
      mobile: clean || raw,
      stats: {
        interactionCount: 0,
      },
    };
  }

  public saveLead(lead: Partial<Lead> & { mobile: string }): Lead {
    const now = new Date().toISOString();
    const cleanMobile = normalizePhoneNumber(lead.mobile) || lead.mobile;
    const existingIdx = this.leads.findIndex(
      (l) => (lead.id && l.id === lead.id) || (lead.leadCode && l.leadCode === lead.leadCode) || (cleanMobile && normalizePhoneNumber(l.mobile) === cleanMobile)
    );

    let savedLead: Lead;
    if (existingIdx >= 0) {
      const oldLead = this.leads[existingIdx];
      savedLead = {
        ...oldLead,
        ...lead,
        mobile: cleanMobile || oldLead.mobile,
        updatedAt: now,
      };
      this.leads[existingIdx] = savedLead;

      // Audit Log for lead modifications
      const changedFields: string[] = [];
      if (lead.name !== undefined && lead.name !== oldLead.name) changedFields.push(`نام: «${oldLead.name || '-'}» -> «${lead.name || '-'}»`);
      if (lead.status !== undefined && lead.status !== oldLead.status) changedFields.push(`وضعیت: «${oldLead.status}» -> «${lead.status}»`);
      if (cleanMobile && cleanMobile !== oldLead.mobile) changedFields.push(`موبایل: «${oldLead.mobile}» -> «${cleanMobile}»`);
      if (lead.notes !== undefined && lead.notes !== oldLead.notes) changedFields.push(`یادداشت ویرایش شد`);
      if (lead.source !== undefined && lead.source !== oldLead.source) changedFields.push(`منبع: «${oldLead.source || '-'}» -> «${lead.source || '-'}»`);

      if (changedFields.length > 0) {
        this.logAudit({
          userId: this.currentUser?.id || 'usr-admin',
          userName: this.currentUser?.name || 'مدیر سیستم',
          userRole: this.currentUser?.role || UserRole.SUPER_ADMIN,
          action: `ویرایش سرنخ ${oldLead.leadCode}`,
          module: ModuleName.CUSTOMERS,
          entityType: 'LEAD',
          entityName: oldLead.name || oldLead.leadCode,
          targetId: oldLead.id,
          targetType: 'Lead',
          details: changedFields.join(' | '),
          oldValue: { name: oldLead.name, status: oldLead.status, mobile: oldLead.mobile, notes: oldLead.notes, source: oldLead.source },
          newValue: { name: savedLead.name, status: savedLead.status, mobile: savedLead.mobile, notes: savedLead.notes, source: savedLead.source },
        });
      }
    } else {
      const count = this.leads.length + 1;
      savedLead = {
        id: lead.id || `lead-${Date.now()}`,
        leadCode: lead.leadCode || `LEAD-${1000 + count}`,
        mobile: cleanMobile,
        name: lead.name || '',
        status: lead.status || LeadStatus.NEW_LEAD,
        source: lead.source || 'تماس ورودی',
        notes: lead.notes || '',
        assignedUserId: lead.assignedUserId,
        assignedUserName: lead.assignedUserName,
        createdAt: lead.createdAt || now,
        updatedAt: now,
        interactionCount: lead.interactionCount || 0,
        activities: [],
      };
      this.leads.unshift(savedLead);

      this.logAudit({
        userId: this.currentUser?.id || 'usr-admin',
        userName: this.currentUser?.name || 'مدیر سیستم',
        userRole: this.currentUser?.role || UserRole.SUPER_ADMIN,
        action: `ثبت سرنخ جدید ${savedLead.leadCode}`,
        module: ModuleName.CUSTOMERS,
        entityType: 'LEAD',
        entityName: savedLead.name || savedLead.leadCode,
        targetId: savedLead.id,
        targetType: 'Lead',
        details: `ثبت سرنخ جدید با شماره ${savedLead.mobile} و نام «${savedLead.name || 'نامشخص'}»`,
        newValue: { leadCode: savedLead.leadCode, mobile: savedLead.mobile, name: savedLead.name, status: savedLead.status },
      });
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'LEADS', action: 'SAVE', payload: savedLead });
    api.saveLead(savedLead).catch((err) => console.error('Failed to sync lead to server:', err));
    return savedLead;
  }

  public addLeadActivity(
    leadId: string,
    activityData: {
      type: LeadActivityType;
      result: string;
      operatorId?: string;
      operatorName?: string;
      appointmentResult?: string;
      newStatus?: LeadStatus | string;
      nextFollowUpDate?: string;
      nextFollowUpJalali?: string;
      metadata?: Record<string, any>;
    }
  ): { activity: LeadActivity; lead: Lead; task?: Task } {
    const lead = this.getLeadById(leadId);
    if (!lead) throw new Error('سرنخ یافت نشد.');

    const now = new Date();
    const nowIso = now.toISOString();
    const jDate = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const jalaliTimestamp = `${jDate.jy}/${String(jDate.jm).padStart(2, '0')}/${String(jDate.jd).padStart(2, '0')} ${hours}:${minutes}`;

    const operatorId = activityData.operatorId || this.currentUser?.id || 'usr-admin';
    const operatorName = activityData.operatorName || this.currentUser?.name || 'اپراتور';

    const previousLastFollowUp = lead.lastFollowUp;

    let createdTask: Task | undefined;
    if (activityData.nextFollowUpDate) {
      createdTask = this.saveTask({
        id: `task-lead-${Date.now()}`,
        title: `پیگیری سرنخ: ${lead.name || lead.leadCode} (${lead.mobile})`,
        description: `پیگیری ثبت شده: ${activityData.result}${activityData.appointmentResult ? ` | نتیجه قرار: ${activityData.appointmentResult}` : ''}`,
        dueDate: activityData.nextFollowUpDate,
        assignedUserId: operatorId,
        assignedUserName: operatorName,
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        tags: ['LEAD', 'FOLLOW_UP'],
        leadId: lead.id,
        leadCode: lead.leadCode,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    const activity: LeadActivity = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      leadId: lead.id,
      type: activityData.type,
      result: activityData.result,
      operatorId,
      operatorName,
      createdAt: nowIso,
      jalaliDate: jalaliTimestamp,
      appointmentResult: activityData.appointmentResult,
      newStatus: activityData.newStatus,
      nextFollowUpDate: activityData.nextFollowUpDate,
      nextFollowUpJalali: activityData.nextFollowUpJalali,
      taskId: createdTask?.id,
      metadata: activityData.metadata,
    };

    const updatedActivities = [activity, ...(lead.activities || [])];
    const followUpSummary: LeadFollowUpSummary = {
      date: nowIso,
      jalaliDate: jalaliTimestamp,
      operatorId,
      operatorName,
      activityType: activityData.type,
      result: activityData.result,
      nextFollowUpDate: activityData.nextFollowUpDate,
      nextFollowUpJalali: activityData.nextFollowUpJalali,
    };

    lead.activities = updatedActivities;
    lead.lastFollowUp = followUpSummary;
    lead.lastContactAt = nowIso;
    lead.interactionCount = (lead.interactionCount || 0) + 1;
    lead.updatedAt = nowIso;

    if (activityData.newStatus) {
      lead.status = activityData.newStatus;
    }

    if (createdTask) {
      lead.nextFollowUpAt = activityData.nextFollowUpDate;
      lead.nextFollowUpTaskId = createdTask.id;
    }

    // Save Lead updates
    const lIdx = this.leads.findIndex((l) => l.id === lead.id);
    if (lIdx >= 0) {
      this.leads[lIdx] = lead;
    }

    // Audit Log for Lead activity
    const activityNameMap: Record<string, string> = {
      CALL: 'تماس تلفنی',
      FOLLOW_UP: 'پیگیری',
      APPOINTMENT: 'قرار ملاقات',
      MEETING_RESULT: 'ثبت نتیجه قرار',
      NOTE: 'یادداشت',
      SMS: 'ارسال پیامک',
      STATUS_CHANGE: 'تغییر وضعیت',
    };

    this.logAudit({
      userId: operatorId,
      userName: operatorName,
      userRole: this.currentUser?.role || UserRole.SALES_AGENT,
      action: `ثبت ${activityNameMap[activityData.type] || activityData.type} برای سرنخ ${lead.leadCode}`,
      module: ModuleName.CUSTOMERS,
      entityType: 'LEAD',
      entityName: lead.name || lead.leadCode,
      targetId: lead.id,
      targetType: 'LeadActivity',
      details: `${activityNameMap[activityData.type] || activityData.type}: ${activityData.result}${activityData.appointmentResult ? ` | نتیجه قرار: ${activityData.appointmentResult}` : ''}${activityData.nextFollowUpJalali ? ` | پیگیری بعدی: ${activityData.nextFollowUpJalali}` : ''}`,
      oldValue: previousLastFollowUp ? `${previousLastFollowUp.operatorName}: ${previousLastFollowUp.result}` : 'بدون پیگیری قبلی',
      newValue: `${operatorName}: ${activityData.result}`,
    });

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'LEADS', action: 'ACTIVITY_ADDED', payload: { lead, activity, task: createdTask } });
    api.saveLead(lead).catch((err) => console.error('Failed to sync lead activity to server:', err));

    return { activity, lead, task: createdTask };
  }

  public getLeadActivities(leadId: string): LeadActivity[] {
    const lead = this.getLeadById(leadId);
    return lead?.activities || [];
  }

  public deleteLead(id: string): void {
    this.leads = this.leads.filter((l) => l.id !== id && l.leadCode !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'LEADS', action: 'DELETE', payload: id });
    api.deleteLead(id).catch((err) => console.error('Failed to delete lead on server:', err));
  }

  public async convertLeadToCustomer(leadId: string, customerData: Partial<Customer>): Promise<{ customer: Customer; lead: Lead }> {
    const lead = this.getLeadById(leadId);
    if (!lead) throw new Error('سرنخ یافت نشد.');

    const res = await api.convertLead(leadId, customerData);
    if (res.success) {
      // update local cache
      const custIdx = this.customers.findIndex((c) => c.id === res.customer.id);
      if (custIdx >= 0) {
        this.customers[custIdx] = res.customer;
      } else {
        this.customers.unshift(res.customer);
      }

      const lIdx = this.leads.findIndex((l) => l.id === res.lead.id);
      if (lIdx >= 0) {
        this.leads[lIdx] = res.lead;
      }

      this.saveLocalCacheSnapshot();
      emitChange({ key: 'CUSTOMERS', action: 'SAVE', payload: res.customer });
      emitChange({ key: 'LEADS', action: 'CONVERT', payload: res.lead });
      return { customer: res.customer, lead: res.lead };
    }
    throw new Error('خطا در تبدیل سرنخ به مشتری');
  }

  // ----------------------------------------------------
  // Interactions (Unified Calls & Touchpoints)
  // ----------------------------------------------------
  public getInteractions(filter?: { customerId?: string; leadId?: string; mobile?: string }): Interaction[] {
    let list = [...this.interactions];
    if (!filter) return list;

    if (filter.customerId) {
      list = list.filter((i) => i.customer_id === filter.customerId || i.customerId === filter.customerId);
    }
    if (filter.leadId) {
      list = list.filter((i) => i.lead_id === filter.leadId || i.leadId === filter.leadId || i.leadCode === filter.leadId);
    }
    if (filter.mobile) {
      const clean = normalizePhoneNumber(filter.mobile);
      list = list.filter((i) => i.customerMobile && normalizePhoneNumber(i.customerMobile) === clean);
    }
    return list.sort((a, b) => new Date(b.started_at || b.startedAt || b.created_at || '').getTime() - new Date(a.started_at || a.startedAt || a.created_at || '').getTime());
  }

  public async saveInteraction(interaction: Partial<Interaction> & { mobile?: string }): Promise<Interaction> {
    const res = await api.saveInteraction(interaction as any);
    if (res.success && res.interaction) {
      const saved = res.interaction;
      const idx = this.interactions.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        this.interactions[idx] = saved;
      } else {
        this.interactions.unshift(saved);
      }

      // Also refresh synced calls & leads
      this.syncWithServer(false);

      this.saveLocalCacheSnapshot();
      emitChange({ key: 'INTERACTIONS', action: 'SAVE', payload: saved });
      emitChange({ key: 'CALLS', action: 'CREATE', payload: saved });
      return saved;
    }
    throw new Error('خطا در ثبت تعامل');
  }

  public deleteInteraction(id: string): void {
    this.interactions = this.interactions.filter((i) => i.id !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'INTERACTIONS', action: 'DELETE', payload: id });
    api.deleteInteraction(id).catch((err) => console.error('Failed to delete interaction on server:', err));
  }

  // ----------------------------------------------------
  // Calls & Voice Notes
  // ----------------------------------------------------
  public getCalls(): Call[] {
    return this.calls;
  }

  public getCallsByCustomerId(customerId: string): Call[] {
    return this.calls.filter((c) => c.customerId === customerId);
  }

  public recordCall(call: Call, createFollowUpTask = false): Call {
    const newCall: Call = {
      ...call,
      id: call.id || `call-${Date.now()}`,
      createdAt: call.createdAt || new Date().toISOString(),
    };

    if (createFollowUpTask && newCall.followUpDueDate) {
      const task = this.saveTask({
        id: `task-fu-${Date.now()}`,
        title: `پیگیری تماس با ${newCall.customerName || 'مشتری'}: ${newCall.subject}`,
        description: `نتیجه تماس قبلی: ${newCall.notes}`,
        customerId: newCall.customerId,
        customerName: newCall.customerName,
        assignedUserId: newCall.userId,
        assignedUserName: newCall.userName,
        creatorUserId: this.getCurrentUser().id,
        creatorUserName: this.getCurrentUser().name,
        priority: TaskPriority.HIGH,
        status: TaskStatus.TODO,
        dueDate: newCall.followUpDueDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      newCall.followUpTaskId = task.id;
    }

    this.calls.unshift(newCall);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CALLS', action: 'CREATE', payload: newCall });

    api.saveCall(newCall).catch((err) => console.error('Failed to sync call to server:', err));
    return newCall;
  }

  public saveCall(call: Call, createFollowUpTask = false): Call {
    return this.recordCall(call, createFollowUpTask);
  }

  public deleteCall(id: string): void {
    this.calls = this.calls.filter((c) => c.id !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CALLS', action: 'DELETE', payload: id });
    api.deleteCall(id).catch((err) => console.error('Failed to delete call on server:', err));
  }

  public getVoiceNotes(): VoiceNote[] {
    return this.voiceNotes;
  }

  public getVoiceNotesByCustomerId(customerId: string): VoiceNote[] {
    return this.voiceNotes.filter((vn) => vn.customerId === customerId || vn.relatedEntityId === customerId);
  }

  public getVoiceNotesByEntity(entityType: string, entityId: string): VoiceNote[] {
    return this.voiceNotes.filter((vn) => vn.relatedEntityType === entityType && vn.relatedEntityId === entityId);
  }

  public saveVoiceNote(voiceNote: Partial<VoiceNote> & { title?: string; audioDataUrl?: string; noteType?: NoteType | string }): VoiceNote {
    const currentUser = this.getCurrentUser();
    let savedNote: VoiceNote;
    const existingIdx = voiceNote.id ? this.voiceNotes.findIndex((n) => n.id === voiceNote.id) : -1;
    const now = new Date().toISOString();
    const noteType = voiceNote.noteType || NoteType.VOICE;

    if (existingIdx >= 0) {
      savedNote = {
        ...this.voiceNotes[existingIdx],
        ...voiceNote,
        noteType: noteType || this.voiceNotes[existingIdx]?.noteType,
        updatedAt: now,
        updatedById: currentUser.id,
        updatedByName: currentUser.name,
        editedAt: now,
      } as VoiceNote;
      this.voiceNotes[existingIdx] = savedNote;
    } else {
      savedNote = {
        id: voiceNote.id || `vn-${Date.now()}`,
        title: voiceNote.title || (noteType === NoteType.TEXT ? 'یادداشت متنی' : 'یادداشت صوتی بدون عنوان'),
        noteType,
        body: noteType === NoteType.TEXT ? voiceNote.body || '' : undefined,
        customerId: voiceNote.customerId,
        customerName: voiceNote.customerName,
        audioDataUrl: noteType === NoteType.TEXT ? undefined : voiceNote.audioDataUrl,
        durationSeconds: noteType === NoteType.TEXT ? 0 : (voiceNote.durationSeconds || 0),
        transcription: voiceNote.transcription || '',
        category: voiceNote.category || VoiceNoteCategory.GENERAL,
        tags: voiceNote.tags || [],
        createdById: voiceNote.createdById || currentUser.id,
        createdByName: voiceNote.createdByName || currentUser.name,
        createdAt: voiceNote.createdAt || now,
        updatedAt: now,
        relatedEntityType: voiceNote.relatedEntityType || (voiceNote.customerId ? 'CUSTOMER' : 'GENERAL'),
        relatedEntityId: voiceNote.relatedEntityId || voiceNote.customerId,
        isPinned: voiceNote.isPinned || false,
      } as VoiceNote;
      this.voiceNotes.unshift(savedNote);
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'VOICE_NOTES', action: 'SAVE', payload: savedNote });

    api.saveVoiceNote(savedNote).catch((err) => console.error('Failed to sync voice note to server:', err));
    return savedNote;
  }

  public deleteVoiceNote(id: string): void {
    this.voiceNotes = this.voiceNotes.filter((vn) => vn.id !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'VOICE_NOTES', action: 'DELETE', payload: id });
    api.deleteVoiceNote(id).catch((err) => console.error('Failed to delete voice note on server:', err));
  }

  // ----------------------------------------------------
  // Tasks
  // ----------------------------------------------------
  public getTasks(): Task[] {
    return this.tasks;
  }

  public getTasksByCustomerId(customerId: string): Task[] {
    return this.tasks.filter((t) => t.customerId === customerId);
  }

  public saveTask(task: Task): Task {
    const idx = this.tasks.findIndex((t) => t.id === task.id);
    let updatedTask: Task;
    const now = new Date().toISOString();

    if (idx >= 0) {
      updatedTask = { ...this.tasks[idx], ...task, updatedAt: now };
      if (task.status === TaskStatus.COMPLETED && !task.completedAt) {
        updatedTask.completedAt = now;
      }
      this.tasks[idx] = updatedTask;
    } else {
      updatedTask = {
        ...task,
        id: task.id || `task-${Date.now()}`,
        createdAt: task.createdAt || now,
        updatedAt: now,
      };
      this.tasks.unshift(updatedTask);
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'TASKS', action: 'SAVE', payload: updatedTask });

    api.saveTask(updatedTask).catch((err) => console.error('Failed to sync task to server:', err));
    return updatedTask;
  }

  public deleteTask(id: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'TASKS', action: 'DELETE', payload: id });
    api.deleteTask(id).catch((err) => console.error('Failed to delete task on server:', err));
  }

  // ----------------------------------------------------
  // Contracts
  // ----------------------------------------------------
  public getContracts(): Contract[] {
    return this.contracts;
  }

  public getContractsByCustomerId(customerId: string): Contract[] {
    return this.contracts.filter((c) => c.customerId === customerId);
  }

  public saveContract(contract: Contract): Contract {
    const idx = this.contracts.findIndex((c) => c.id === contract.id);
    let updatedContract: Contract;
    const now = new Date().toISOString();

    if (idx >= 0) {
      updatedContract = { ...this.contracts[idx], ...contract, updatedAt: now };
      this.contracts[idx] = updatedContract;
    } else {
      const ctrNum = `CTR-${new Date().getFullYear()}-${String(100 + this.contracts.length + 1).padStart(3, '0')}`;
      updatedContract = {
        ...contract,
        id: contract.id || `cntr-${Date.now()}`,
        contractNumber: contract.contractNumber || ctrNum,
        createdAt: contract.createdAt || now,
        updatedAt: now,
      };
      this.contracts.unshift(updatedContract);
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CONTRACTS', action: 'SAVE', payload: updatedContract });

    api.saveContract(updatedContract).catch((err) => console.error('Failed to sync contract to server:', err));
    return updatedContract;
  }

  public deleteContract(id: string): void {
    this.contracts = this.contracts.filter((c) => c.id !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CONTRACTS', action: 'DELETE', payload: id });
    api.deleteContract(id).catch((err) => console.error('Failed to delete contract on server:', err));
  }

  // ----------------------------------------------------
  // Payments & Checks
  // ----------------------------------------------------
  public getPayments(): Payment[] {
    return this.payments;
  }

  public getPaymentsByCustomerId(customerId: string): Payment[] {
    return this.payments.filter((p) => p.customerId === customerId);
  }

  public savePayment(payment: Payment): Payment {
    const idx = this.payments.findIndex((p) => p.id === payment.id);
    let updatedPayment: Payment;
    const now = new Date().toISOString();

    if (idx >= 0) {
      updatedPayment = { ...this.payments[idx], ...payment, updatedAt: now };
      this.payments[idx] = updatedPayment;
    } else {
      const recNum = `REC-${Math.floor(10000 + Math.random() * 90000)}`;
      updatedPayment = {
        ...payment,
        id: payment.id || `pay-${Date.now()}`,
        receiptNumber: payment.receiptNumber || recNum,
        createdAt: payment.createdAt || now,
      };
      this.payments.unshift(updatedPayment);
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'PAYMENTS', action: 'SAVE', payload: updatedPayment });

    api.savePayment(updatedPayment).catch((err) => console.error('Failed to sync payment to server:', err));
    return updatedPayment;
  }

  public verifyPayment(paymentId: string, verifier: User): Payment {
    const payment = this.payments.find((p) => p.id === paymentId);
    if (!payment) throw new Error('پرداخت یافت نشد');
    payment.status = PaymentStatus.VERIFIED;
    payment.verifiedByUserId = verifier.id;
    payment.verifiedByUserName = verifier.name;
    payment.verifiedAt = new Date().toISOString();
    return this.savePayment(payment);
  }

  public finalizePayment(paymentId: string, finalizer: User): Payment {
    const payment = this.payments.find((p) => p.id === paymentId);
    if (!payment) throw new Error('پرداخت یافت نشد');
    payment.status = PaymentStatus.COMPLETED;
    payment.finalizedByUserId = finalizer.id;
    payment.finalizedByUserName = finalizer.name;
    payment.finalizedAt = new Date().toISOString();
    return this.savePayment(payment);
  }

  public deletePayment(id: string): void {
    this.payments = this.payments.filter((p) => p.id !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'PAYMENTS', action: 'DELETE', payload: id });
    api.deletePayment(id).catch((err) => console.error('Failed to delete payment on server:', err));
  }

  public getChecks(): Check[] {
    return this.checks;
  }

  public getChecksByCustomerId(customerId: string): Check[] {
    return this.checks.filter((c) => c.customerId === customerId);
  }

  public saveCheck(check: Check): Check {
    const idx = this.checks.findIndex((c) => c.id === check.id);
    let updatedCheck: Check;
    const now = new Date().toISOString();

    if (idx >= 0) {
      updatedCheck = { ...this.checks[idx], ...check, updatedAt: now };
      this.checks[idx] = updatedCheck;
    } else {
      updatedCheck = {
        ...check,
        id: check.id || `chk-${Date.now()}`,
        createdAt: check.createdAt || now,
        updatedAt: now,
      };
      this.checks.unshift(updatedCheck);
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CHECKS', action: 'SAVE', payload: updatedCheck });

    api.saveCheck(updatedCheck).catch((err) => console.error('Failed to sync check to server:', err));
    return updatedCheck;
  }

  public deleteCheck(id: string): void {
    this.checks = this.checks.filter((c) => c.id !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CHECKS', action: 'DELETE', payload: id });
    api.deleteCheck(id).catch((err) => console.error('Failed to delete check on server:', err));
  }

  // ----------------------------------------------------
  // SIM Cards
  // ----------------------------------------------------
  public getSims(): SimCard[] {
    return this.sims;
  }

  public getSimCards(): SimCard[] {
    return this.sims;
  }

  public findSimById(id: string): SimCard | undefined {
    return this.sims.find((s) => s.id === id);
  }

  public getSimById(id: string): SimCard | undefined {
    return this.sims.find((s) => s.id === id);
  }

  public getSimsByCustomerId(customerId: string): SimCard[] {
    return this.sims.filter((s) => s.customerId === customerId || s.ownerCustomerId === customerId);
  }

  public getSimCardsByCustomerId(customerId: string): SimCard[] {
    return this.getSimsByCustomerId(customerId);
  }

  public saveSim(sim: SimCard): SimCard {
    const idx = this.sims.findIndex((s) => s.id === sim.id);
    let updatedSim: SimCard;
    const now = new Date().toISOString();

    if (idx >= 0) {
      updatedSim = { ...this.sims[idx], ...sim, updatedAt: now };
      this.sims[idx] = updatedSim;
    } else {
      updatedSim = {
        ...sim,
        id: sim.id || `sim-${Date.now()}`,
        createdAt: sim.createdAt || now,
        updatedAt: now,
      };
      this.sims.unshift(updatedSim);
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'SIMS', action: 'SAVE', payload: updatedSim });

    api.saveSim(updatedSim).catch((err) => console.error('Failed to sync SIM to server:', err));
    return updatedSim;
  }

  public saveSimCard(sim: SimCard): SimCard {
    return this.saveSim(sim);
  }

  public deleteSim(id: string): void {
    this.sims = this.sims.filter((s) => s.id !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'SIMS', action: 'DELETE', payload: id });
    api.deleteSim(id).catch((err) => console.error('Failed to delete SIM on server:', err));
  }

  public deleteSimCard(id: string): void {
    this.deleteSim(id);
  }

  // ----------------------------------------------------
  // Repairs
  // ----------------------------------------------------
  public getRepairs(): Repair[] {
    return this.repairs;
  }

  public getRepairTickets(): Repair[] {
    return this.repairs;
  }

  public getRepairsByCustomerId(customerId: string): Repair[] {
    return this.repairs.filter((r) => r.customerId === customerId);
  }

  public getRepairTicketsByCustomerId(customerId: string): Repair[] {
    return this.getRepairsByCustomerId(customerId);
  }

  public saveRepair(repair: Repair): Repair {
    const idx = this.repairs.findIndex((r) => r.id === repair.id);
    let updatedRepair: Repair;
    const now = new Date().toISOString();

    if (idx >= 0) {
      updatedRepair = { ...this.repairs[idx], ...repair, updatedAt: now };
      this.repairs[idx] = updatedRepair;
    } else {
      const trackCode = `REP-${Math.floor(7000 + Math.random() * 2900)}`;
      updatedRepair = {
        ...repair,
        id: repair.id || `rep-${Date.now()}`,
        trackingCode: repair.trackingCode || trackCode,
        createdAt: repair.createdAt || now,
        updatedAt: now,
      };
      this.repairs.unshift(updatedRepair);
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'REPAIRS', action: 'SAVE', payload: updatedRepair });

    api.saveRepair(updatedRepair).catch((err) => console.error('Failed to sync repair to server:', err));
    return updatedRepair;
  }

  public saveRepairTicket(repair: Repair): Repair {
    return this.saveRepair(repair);
  }

  public deleteRepair(id: string): void {
    this.repairs = this.repairs.filter((r) => r.id !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'REPAIRS', action: 'DELETE', payload: id });
    api.deleteRepair(id).catch((err) => console.error('Failed to delete repair on server:', err));
  }

  public deleteRepairTicket(id: string): void {
    this.deleteRepair(id);
  }

  // ----------------------------------------------------
  // Attachments
  // ----------------------------------------------------
  public getAttachments(): Attachment[] {
    return this.attachments;
  }

  public getAttachmentsByEntity(entityType: string, entityId: string): Attachment[] {
    return this.attachments.filter((a) => a.relatedEntityType === entityType && a.relatedEntityId === entityId);
  }

  public getAttachmentsByCustomerId(customerId: string): Attachment[] {
    return this.attachments.filter((a) => a.customerId === customerId || a.relatedEntityId === customerId);
  }

  public saveAttachment(attachment: Attachment): Attachment {
    const idx = this.attachments.findIndex((a) => a.id === attachment.id);
    let updatedAtt: Attachment;
    const now = new Date().toISOString();

    if (idx >= 0) {
      updatedAtt = {
        ...this.attachments[idx],
        ...attachment,
        updatedAt: now,
      };
      if (attachment.customerId === undefined || attachment.customerId === null || attachment.customerId === '') {
        delete updatedAtt.customerId;
        delete updatedAtt.customerName;
      }
      this.attachments[idx] = updatedAtt;
    } else {
      updatedAtt = {
        ...attachment,
        id: attachment.id || `att-${Date.now()}`,
        uploadedAt: attachment.uploadedAt || now,
        createdAt: attachment.createdAt || now,
        updatedAt: now,
      };
      if (updatedAtt.customerId === undefined || updatedAtt.customerId === null || updatedAtt.customerId === '') {
        delete updatedAtt.customerId;
        delete updatedAtt.customerName;
      }
      this.attachments.unshift(updatedAtt);
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'ATTACHMENTS', action: 'SAVE', payload: updatedAtt });

    api.saveAttachment(updatedAtt).catch((err) => console.error('Failed to sync attachment to server:', err));
    return updatedAtt;
  }

  public updateAttachmentThumbnail(id: string, thumbnailDataUrl: string, uploadStatus?: Attachment['uploadStatus']): Attachment | null {
    const idx = this.attachments.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    const updatedAtt: Attachment = {
      ...this.attachments[idx],
      thumbnailDataUrl,
      uploadStatus: uploadStatus || 'PROCESSED',
      updatedAt: new Date().toISOString(),
    };
    this.attachments[idx] = updatedAtt;
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'ATTACHMENTS', action: 'SAVE', payload: updatedAtt });
    api.updateAttachmentThumbnail(id, thumbnailDataUrl, uploadStatus).catch((err) =>
      console.error('Failed to sync attachment thumbnail to server:', err)
    );
    return updatedAtt;
  }

  public updateAttachmentCustomer(id: string, customerId?: string, customerName?: string): Attachment | null {
    const idx = this.attachments.findIndex((a) => a.id === id);
    if (idx < 0) return null;

    const updatedAtt: Attachment = {
      ...this.attachments[idx],
      updatedAt: new Date().toISOString(),
    };

    if (customerId) {
      updatedAtt.customerId = customerId;
      updatedAtt.customerName = customerName || '';
    } else {
      delete updatedAtt.customerId;
      delete updatedAtt.customerName;
    }

    this.attachments[idx] = updatedAtt;
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'ATTACHMENTS', action: 'SAVE', payload: updatedAtt });

    api.linkAttachmentCustomer(id, customerId, customerName).catch((err) =>
      console.error('Failed to update attachment customer on server:', err)
    );
    return updatedAtt;
  }

  public deleteAttachment(id: string): void {
    this.attachments = this.attachments.filter((a) => a.id !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'ATTACHMENTS', action: 'DELETE', payload: id });
    api.deleteAttachment(id).catch((err) => console.error('Failed to delete attachment on server:', err));
  }

  public renameAttachment(id: string, newDisplayName: string, actorUserId?: string, actorUserName?: string): Attachment | null {
    const idx = this.attachments.findIndex((a) => a.id === id);
    if (idx < 0) return null;

    const prev = { ...this.attachments[idx] };
    const updatedAtt: Attachment = {
      ...prev,
      displayName: newDisplayName.trim(),
      fileName: prev.fileName || prev.originalName || newDisplayName.trim(),
      updatedByUserId: actorUserId || this.currentUser.id,
      updatedByUserName: actorUserName || this.currentUser.name,
      updatedAt: new Date().toISOString(),
    };

    this.attachments[idx] = updatedAtt;
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'ATTACHMENTS', action: 'SAVE', payload: updatedAtt });

    api.renameAttachment(id, newDisplayName).catch((err) => console.error('Failed to rename attachment on server:', err));

    // Audit log
    this.logAudit({
      userId: actorUserId || this.currentUser.id,
      userName: actorUserName || this.currentUser.name,
      userRole: this.currentUser.role,
      action: 'RENAME',
      module: 'DOCUMENTS',
      entityType: 'ATTACHMENT',
      entityName: prev.displayName || prev.fileName || prev.originalName || prev.title || 'سند',
      targetId: id,
      details: `تغییر نام نمایشی سند از «${prev.displayName || prev.fileName || ''}» به «${newDisplayName}»`,
      fieldName: 'displayName',
      oldValue: prev.displayName || prev.fileName || '',
      newValue: newDisplayName,
    });

    return updatedAtt;
  }

  public logDocumentAudit(
    attachmentId: string,
    action: string,
    actorUserId?: string,
    actorUserName?: string,
    details?: string
  ): void {
    const att = this.attachments.find((a) => a.id === attachmentId);
    this.logAudit({
      userId: actorUserId || this.currentUser.id,
      userName: actorUserName || this.currentUser.name,
      userRole: this.currentUser.role,
      action,
      module: 'DOCUMENTS',
      entityType: 'ATTACHMENT',
      entityName: att?.displayName || att?.fileName || att?.originalName || 'سند',
      targetId: attachmentId,
      targetType: 'attachment',
      details: details || `عملیات «${action}» روی سند انجام شد`,
    });
  }

  // ----------------------------------------------------
  // Notifications & Audit Logs
  // ----------------------------------------------------
  public getNotifications(): Notification[] {
    return this.notifications;
  }

  public getActiveNotifications(): Notification[] {
    const now = Date.now();
    return this.notifications.filter((n) => {
      if (!n.snoozedUntil) return true;
      const t = new Date(n.snoozedUntil).getTime();
      return isNaN(t) || t <= now;
    });
  }

  public saveNotification(notification: Notification): Notification {
    const idx = this.notifications.findIndex((n) => n.id === notification.id);
    let updated: Notification;
    if (idx >= 0) {
      updated = { ...this.notifications[idx], ...notification };
      this.notifications[idx] = updated;
    } else {
      updated = {
        ...notification,
        id: notification.id || `notif-${Date.now()}`,
        createdAt: notification.createdAt || new Date().toISOString(),
      };
      this.notifications.unshift(updated);
    }
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'NOTIFICATIONS', action: 'SAVE', payload: updated });
    api.saveNotification(updated).catch((err) => console.error('Failed to sync notification to server:', err));
    return updated;
  }

  public snoozeNotification(id: string, minutes = 15): void {
    const target = this.notifications.find((n) => n.id === id);
    if (target) {
      const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      target.snoozedUntil = snoozedUntil;
      target.read = false;
      this.saveLocalCacheSnapshot();
      emitChange({ key: 'NOTIFICATIONS', action: 'UPDATE', payload: target });
      api.snoozeNotification(id, minutes).catch((err) => console.error('Failed to snooze on server:', err));
    }
  }

  public markNotificationAsRead(id: string): void {
    const target = this.notifications.find((n) => n.id === id);
    if (target) {
      target.read = true;
      target.isRead = true;
      target.readAt = new Date().toISOString();
      this.saveLocalCacheSnapshot();
      emitChange({ key: 'NOTIFICATIONS', action: 'UPDATE', payload: target });
    }
  }

  public markAllNotificationsAsRead(): void {
    this.notifications.forEach((n) => {
      n.read = true;
      n.isRead = true;
      n.readAt = new Date().toISOString();
    });
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'NOTIFICATIONS', action: 'UPDATE_ALL' });
    api.markAllNotificationsRead(this.currentUser?.id).catch((err) => console.error('Failed to mark notifications read on server:', err));
  }

  public getAuditLogs(): AuditLog[] {
    return this.auditLogs;
  }

  public getAuditLogsForEntity(entityType: string, targetId: string): AuditLog[] {
    return (this.auditLogs || []).filter(
      (a) => (a.entityType === entityType || a.targetType === entityType) &&
             (a.targetId === targetId || (typeof a.details === 'string' && a.details.includes(targetId)))
    );
  }

  public deleteAuditLog(id: string, user?: User): { success: boolean; message: string } {
    const operator = user || this.currentUser;
    // Normal users and non-super-admins cannot delete Audit Logs
    if (!operator || operator.role !== UserRole.SUPER_ADMIN) {
      console.warn('[Security] Unauthorized attempt to delete audit log by non-super-admin:', operator?.username);
      return {
        success: false,
        message: 'خطای دسترسی: کاربران عادی مجاز به حذف گزارش‌های حسابرسی و لاگ‌های امنیتی سیستم نمی‌باشند. تنها مدیر ارشد کل مجاز است.',
      };
    }

    this.auditLogs = this.auditLogs.filter((l) => l.id !== id);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'AUDIT_LOGS', action: 'DELETE', payload: id });
    return { success: true, message: 'لاگ حسابرسی با موفقیت حذف گردید.' };
  }

  public logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const newLog: AuditLog = {
      ...entry,
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(newLog);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'AUDIT_LOGS', action: 'CREATE', payload: newLog });

    api.logAudit(entry).catch((err) => console.error('Failed to log audit on server:', err));
  }

  // ----------------------------------------------------
  // Drafts & Temporary Forms
  // ----------------------------------------------------
  public saveDraft(formKey: string, draftData: any): void {
    this.drafts[formKey] = {
      data: draftData,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem('mmba_form_drafts', JSON.stringify(this.drafts));
    } catch {}
  }

  public getDraft(formKey: string): any | null {
    return this.drafts[formKey]?.data || null;
  }

  public getDraftMeta(formKey: string): { data: any; updatedAt: string } | null {
    return this.drafts[formKey] || null;
  }

  public hasDraft(formKey: string): boolean {
    return !!this.drafts[formKey]?.data;
  }

  public clearDraft(formKey: string): void {
    delete this.drafts[formKey];
    try {
      localStorage.setItem('mmba_form_drafts', JSON.stringify(this.drafts));
    } catch {}
  }

  // ----------------------------------------------------
  // Date Suggestions & Share Links
  // ----------------------------------------------------
  public getDateSuggestions(customerId?: string): DateSuggestion[] {
    if (customerId) return this.dateSuggestions.filter((d) => d.customerId === customerId);
    return this.dateSuggestions;
  }

  public saveDateSuggestion(suggestion: DateSuggestion): DateSuggestion {
    const newSug: DateSuggestion = {
      ...suggestion,
      id: suggestion.id || `ds-${Date.now()}`,
      createdAt: suggestion.createdAt || new Date().toISOString(),
    };
    this.dateSuggestions.unshift(newSug);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'DATE_SUGGESTIONS', action: 'SAVE', payload: newSug });
    return newSug;
  }

  public createShareLink(data: Omit<ShareableLink, 'id' | 'token' | 'createdAt' | 'accessCount' | 'isRevoked'>): ShareableLink {
    const newLink: ShareableLink = {
      ...data,
      id: `link-${Date.now()}`,
      token: Math.random().toString(36).substring(2, 12) + Date.now().toString(36),
      accessCount: 0,
      isRevoked: false,
      createdAt: new Date().toISOString(),
    };
    this.sharedLinks.unshift(newLink);
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'SHARED_LINKS', action: 'SAVE', payload: newLink });
    return newLink;
  }

  public getShareLinks(customerId?: string): ShareableLink[] {
    if (customerId) return this.sharedLinks.filter((l) => l.customerId === customerId);
    return this.sharedLinks;
  }

  // ----------------------------------------------------
  // Problem Reports Management
  // ----------------------------------------------------
  public getProblemReports(): ProblemReport[] {
    return [...this.problemReports].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getProblemReportsForUser(userId: string): ProblemReport[] {
    return this.getProblemReports().filter((r) => r.userId === userId);
  }

  public async saveProblemReport(report: Partial<ProblemReport>): Promise<ProblemReport> {
    const now = new Date().toISOString();
    const user = this.getCurrentUser();
    const id = report.id || `report-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    const newReport: ProblemReport = {
      id,
      title: report.title || 'گزارش اشکال در سامانه',
      description: report.description || '',
      category: report.category || 'BUG',
      priority: report.priority || 'NORMAL',
      status: report.status || 'PENDING',
      screenshotUrl: report.screenshotUrl,
      url: report.url || window.location.href,
      userAgent: report.userAgent || navigator.userAgent,
      userId: report.userId || user?.id || 'usr-anonymous',
      userName: report.userName || user?.name || 'کاربر سیستم',
      userRole: report.userRole || user?.role || UserRole.SALES,
      userEmail: report.userEmail || user?.email,
      userMobile: report.userMobile || user?.mobile,
      adminNotes: report.adminNotes,
      createdAt: report.createdAt || now,
      updatedAt: now,
      resolvedAt: report.resolvedAt,
      resolvedByUserId: report.resolvedByUserId,
      resolvedByUserName: report.resolvedByUserName,
    };

    const idx = this.problemReports.findIndex((r) => r.id === newReport.id);
    if (idx >= 0) {
      this.problemReports[idx] = newReport;
    } else {
      this.problemReports.unshift(newReport);
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'PROBLEM_REPORTS', action: 'SAVE', payload: newReport });

    // Sync to backend asynchronously
    try {
      if (idx >= 0) {
        await api.updateProblemReport(newReport);
      } else {
        await api.saveProblemReport(newReport);
      }
    } catch (err) {
      console.warn('Direct server sync of problem report delayed:', err);
    }

    return newReport;
  }

  public async updateProblemReportStatus(
    id: string,
    status: string,
    adminNotes?: string,
    adminUser?: User
  ): Promise<ProblemReport | null> {
    const report = this.problemReports.find((r) => r.id === id);
    if (!report) return null;

    const now = new Date().toISOString();
    const updated: ProblemReport = {
      ...report,
      status,
      adminNotes: adminNotes !== undefined ? adminNotes : report.adminNotes,
      updatedAt: now,
      ...(status === 'RESOLVED'
        ? {
            resolvedAt: now,
            resolvedByUserId: adminUser?.id || this.currentUser.id,
            resolvedByUserName: adminUser?.name || this.currentUser.name,
          }
        : {}),
    };

    const idx = this.problemReports.findIndex((r) => r.id === id);
    if (idx >= 0) {
      this.problemReports[idx] = updated;
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'PROBLEM_REPORTS', action: 'UPDATE', payload: updated });

    try {
      await api.updateProblemReport(updated);
    } catch (err) {
      console.warn('Failed to sync updated report status:', err);
    }

    return updated;
  }

  public async deleteProblemReport(id: string): Promise<boolean> {
    const before = this.problemReports.length;
    this.problemReports = this.problemReports.filter((r) => r.id !== id);
    const deleted = this.problemReports.length < before;

    if (deleted) {
      this.saveLocalCacheSnapshot();
      emitChange({ key: 'PROBLEM_REPORTS', action: 'DELETE', payload: { id } });
      try {
        await api.deleteProblemReport(id);
      } catch (err) {
        console.warn('Failed to delete report on server:', err);
      }
    }

    return deleted;
  }

  // ----------------------------------------------------
  // Export & Import Database
  // ----------------------------------------------------
  public exportDatabase(): string {
    const dbDump = {
      exportDate: new Date().toISOString(),
      app: 'MMBA Business Operating System',
      version: '4.0 - Centralized Production DB',
      revision: this.currentRevision,
      users: this.users,
      roles: this.roles,
      customers: this.customers,
      leads: this.leads,
      calls: this.calls,
      interactions: this.interactions,
      voiceNotes: this.voiceNotes,
      tasks: this.tasks,
      contracts: this.contracts,
      contractInstallments: this.contractInstallments,
      payments: this.payments,
      checks: this.checks,
      sims: this.sims,
      repairs: this.repairs,
      registeredHolders: this.registeredHolders,
      attachments: this.attachments,
      accounts: this.accounts,
      journalEntries: this.journalEntries,
      journalEntryLines: this.journalEntryLines,
      accountingPeriods: this.accountingPeriods,
      documentShares: this.documentShares,
      notifications: this.notifications,
      problemReports: this.problemReports,
      consignments: this.consignments,
      conversations: this.conversations,
      chatMessages: this.chatMessages,
      settings: this.settings,
      auditLogs: this.auditLogs,
    };
    return JSON.stringify(dbDump, null, 2);
  }

  public async importDatabase(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);
      const res = await api.importDatabase(data);
      if (res.success) {
        await this.syncWithServer(true);
        emitChange({ key: 'ALL', action: 'RESTORE' });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }

  public exportAllDataJson(): string {
    return this.exportDatabase();
  }

  public importAllDataJson(jsonString: string): boolean {
    this.importDatabase(jsonString);
    return true;
  }

  // ----------------------------------------------------
  // Settings & Gemini Key
  // ----------------------------------------------------
  public getCustomGeminiKey(): string {
    return localStorage.getItem('mmba_custom_gemini_key') || '';
  }

  public setCustomGeminiKey(key: string): void {
    if (key) {
      localStorage.setItem('mmba_custom_gemini_key', key);
    } else {
      localStorage.removeItem('mmba_custom_gemini_key');
    }
  }

  // ----------------------------------------------------
  // Accounting Foundation Operations
  // ----------------------------------------------------
  public getAccounts(): Account[] {
    return [...this.accounts];
  }

  public async saveAccount(account: Partial<Account>): Promise<Account> {
    try {
      const saved = await api.saveAccount(account);
      const idx = this.accounts.findIndex((a) => a.id === saved.id);
      if (idx >= 0) {
        this.accounts[idx] = saved;
      } else {
        this.accounts.push(saved);
      }
      this.saveLocalCacheSnapshot();
      emitChange({ key: 'ACCOUNTS', action: 'SAVE', payload: saved });
      return saved;
    } catch (err: any) {
      console.error('Failed to save account:', err);
      throw err;
    }
  }

  public async deleteAccount(id: string): Promise<boolean> {
    try {
      const res = await api.deleteAccount(id);
      if (res.success) {
        this.accounts = this.accounts.filter((a) => a.id !== id);
        this.saveLocalCacheSnapshot();
        emitChange({ key: 'ACCOUNTS', action: 'DELETE', payload: id });
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Failed to delete account:', err);
      throw err;
    }
  }

  public getJournalEntries(): JournalEntry[] {
    return [...this.journalEntries];
  }

  public findJournalEntryById(id: string): JournalEntry | undefined {
    return this.journalEntries.find((e) => e.id === id || String(e.entry_number) === id);
  }

  public async saveJournalEntry(entry: Partial<JournalEntry>, lines: any[]): Promise<JournalEntry> {
    try {
      const saved = await api.saveJournalEntry(entry, lines);
      const idx = this.journalEntries.findIndex((e) => e.id === saved.id);
      if (idx >= 0) {
        this.journalEntries[idx] = saved;
      } else {
        this.journalEntries.unshift(saved);
      }
      this.saveLocalCacheSnapshot();
      emitChange({ key: 'JOURNAL_ENTRIES', action: 'SAVE', payload: saved });
      return saved;
    } catch (err: any) {
      console.error('Failed to save journal entry:', err);
      throw err;
    }
  }

  public getAccountingPeriods(): AccountingPeriod[] {
    return [...this.accountingPeriods];
  }

  public async saveAccountingPeriod(period: Partial<AccountingPeriod>): Promise<AccountingPeriod> {
    try {
      const saved = await api.saveAccountingPeriod(period);
      const idx = this.accountingPeriods.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        this.accountingPeriods[idx] = saved;
      } else {
        this.accountingPeriods.push(saved);
      }
      this.saveLocalCacheSnapshot();
      emitChange({ key: 'ACCOUNTING_PERIODS', action: 'SAVE', payload: saved });
      return saved;
    } catch (err: any) {
      console.error('Failed to save accounting period:', err);
      throw err;
    }
  }

  // ----------------------------------------------------
  // Document Sharing Operations
  // ----------------------------------------------------
  public getDocumentShares(): DocumentShare[] {
    return [...this.documentShares];
  }

  public getInboxDocumentShares(userId: string): DocumentShare[] {
    return this.documentShares.filter(
      (s) => (s.recipient_user_id === userId || s.recipientUserId === userId) && s.status !== DocumentShareStatus.ARCHIVED
    );
  }

  public getSentDocumentShares(userId: string): DocumentShare[] {
    return this.documentShares.filter(
      (s) => (s.sender_user_id === userId || s.senderUserId === userId) && s.status !== DocumentShareStatus.ARCHIVED
    );
  }

  public async shareDocument(payload: {
    documentId: string;
    recipientUsers: { id: string; name: string }[];
    message?: string;
    customerId?: string;
    customerName?: string;
    documentFileName?: string;
    documentFileSize?: number;
    documentFileType?: string;
  }): Promise<DocumentShare[]> {
    try {
      const res = await api.createDocumentShares(payload);
      if (res.success && res.shares) {
        this.documentShares.unshift(...res.shares);
        this.saveLocalCacheSnapshot();
        emitChange({ key: 'DOCUMENT_SHARES', action: 'CREATE', payload: res.shares });
        return res.shares;
      }
      return [];
    } catch (err: any) {
      console.error('Failed to share document:', err);
      throw err;
    }
  }

  public async markDocumentShareRead(shareId: string): Promise<void> {
    try {
      const res = await api.markDocumentShareRead(shareId);
      if (res.success && res.share) {
        const idx = this.documentShares.findIndex((s) => s.id === shareId);
        if (idx >= 0) {
          this.documentShares[idx] = res.share;
          this.saveLocalCacheSnapshot();
          emitChange({ key: 'DOCUMENT_SHARES', action: 'UPDATE', payload: res.share });
        }
      }
    } catch (err: any) {
      console.error('Failed to mark document share read:', err);
    }
  }

  public async archiveDocumentShare(shareId: string): Promise<void> {
    try {
      const res = await api.archiveDocumentShare(shareId);
      if (res.success && res.share) {
        const idx = this.documentShares.findIndex((s) => s.id === shareId);
        if (idx >= 0) {
          this.documentShares[idx] = res.share;
          this.saveLocalCacheSnapshot();
          emitChange({ key: 'DOCUMENT_SHARES', action: 'UPDATE', payload: res.share });
        }
      }
    } catch (err: any) {
      console.error('Failed to archive document share:', err);
    }
  }

  // ----------------------------------------------------
  // Internal Chat (Sprint 03 Patch 05)
  // ----------------------------------------------------
  public getConversations(): ChatConversation[] {
    return [...this.conversations];
  }

  public getConversationsForUser(userId: string): { conversations: ChatConversation[]; unreadCount: number } {
    const mine = (this.conversations || [])
      .filter((c) => (c.member_ids || []).includes(userId) && !(c.is_archived_by || []).includes(userId))
      .sort((a, b) => new Date((b.last_message_at || b.created_at)).getTime() - new Date((a.last_message_at || a.created_at)).getTime());
    const readonlyMembership = (conv: ChatConversation) => {
      const m = (conv.members || []).find((mb) => mb.user_id === userId);
      return m;
    };
    let unreadCount = 0;
    const enriched = mine.map((c) => {
      const lastReadAt = readonlyMembership(c)?.last_read_at;
      const msgs = this.getChatMessages(c.id);
      const unread = msgs.filter((m) => m.sender_user_id !== userId && (!lastReadAt || new Date(m.created_at) > new Date(lastReadAt))).length;
      unreadCount += unread;
      return { ...c, _unread: unread };
    }) as (ChatConversation & { _unread?: number })[];
    return { conversations: enriched, unreadCount };
  }

  public findDirectConversation(userId: string): ChatConversation | undefined {
    const me = this.currentUser.id;
    return (this.conversations || []).find(
      (c) => c.type === ConversationType.DIRECT && (c.member_ids || []).length === 2 &&
        (c.member_ids || []).includes(me) && (c.member_ids || []).includes(userId)
    );
  }

  public getConversationById(id: string): ChatConversation | undefined {
    return (this.conversations || []).find((c) => c.id === id);
  }

  private getChatMessages(conversationId: string): ChatMessage[] {
    return (this.chatMessages || [])
      .filter((m) => m.conversation_id === conversationId || m.conversationId === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  public getChatMessagesForConversation(conversationId: string): ChatMessage[] {
    return this.getChatMessages(conversationId);
  }

  public async createConversation(recipientUserId: string, recipientUserName?: string): Promise<ChatConversation | null> {
    try {
      const existing = this.findDirectConversation(recipientUserId);
      if (existing) return existing;
      const res = await api.createConversation({ recipientUserId, recipientUserName });
      if (res.success && res.conversation) {
        this.conversations = [res.conversation, ...(this.conversations || [])];
        this.saveLocalCacheSnapshot();
        emitChange({ key: 'CHAT_CONVERSATIONS', action: 'CREATE', payload: res.conversation });
        return res.conversation;
      }
      return null;
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
      return null;
    }
  }

  public async sendChatMessage(conversationId: string, msg: Partial<ChatMessage>): Promise<ChatMessage | null> {
    const me = this.currentUser;
    const optimistic: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversation_id: conversationId,
      conversationId,
      sender_user_id: me.id,
      senderUserId: me.id,
      sender_user_name: me.name,
      senderUserName: me.name,
      status: MessageStatus.SENT,
      read_by_user_ids: [],
      readByUserIds: [],
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      client_message_id: msg.client_message_id || `cmid-${Date.now()}`,
      clientMessageId: msg.client_message_id || `cmid-${Date.now()}`,
      body: msg.body || '',
      body_text: msg.body_text || msg.body || '',
      attachments: msg.attachments || [],
      updated_at: new Date().toISOString(),
    };
    this.chatMessages = [...(this.chatMessages || []), optimistic];
    // bump conversation preview locally
    const convs = this.conversations || [];
    const ci = convs.findIndex((c) => c.id === conversationId);
    if (ci >= 0) {
      convs[ci] = { ...convs[ci], last_message: optimistic.body, lastMessage: optimistic.body, last_message_at: optimistic.created_at, lastMessageAt: optimistic.created_at, last_message_user_id: me.id, lastMessageUserId: me.id, last_message_user_name: me.name, lastMessageUserName: me.name, updated_at: optimistic.created_at };
    }
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CHAT_MESSAGES', action: 'SEND', payload: optimistic });
    emitChange({ key: 'CHAT_CONVERSATIONS', action: 'UPDATE', payload: convs[ci] });

    api.sendChatMessage(conversationId, optimistic).catch((err) => console.error('Failed to sync chat message:', err));
    return optimistic;
  }

  public async markChatConversationRead(conversationId: string): Promise<void> {
    const convs = this.conversations || [];
    const ci = convs.findIndex((c) => c.id === conversationId);
    const me = this.currentUser;
    if (ci < 0) return;
    const members = convs[ci].members || [];
    const mi = members.findIndex((mb) => mb.user_id === me.id);
    if (mi >= 0) {
      members[mi] = { ...members[mi], last_read_at: new Date().toISOString(), lastReadAt: new Date().toISOString() };
    }
    const msgs = this.chatMessages || [];
    let changed = false;
    this.chatMessages = msgs.map((m) => {
      if ((m.conversation_id || m.conversationId) !== conversationId || m.sender_user_id === me.id) return m;
      const readBy = m.read_by_user_ids || [];
      if (readBy.includes(me.id)) return m;
      readBy.push(me.id);
      const allRead = readBy.length >= ((convs[ci].member_ids || []).length - 1);
      changed = true;
      return { ...m, read_by_user_ids: readBy, readByUserIds: readBy, status: allRead ? MessageStatus.READ : m.status, read_at: allRead ? new Date().toISOString() : m.read_at };
    });
    if (changed) emitChange({ key: 'CHAT_MESSAGES', action: 'READ', payload: { conversationId } });
    this.saveLocalCacheSnapshot();
    api.markChatConversationRead(conversationId).catch((err) => console.error('Failed to mark chat read:', err));
  }

  public async archiveChatConversation(conversationId: string): Promise<void> {
    const convs = this.conversations || [];
    const ci = convs.findIndex((c) => c.id === conversationId);
    if (ci < 0) return;
    const me = this.currentUser;
    convs[ci] = {
      ...convs[ci],
      is_archived_by: [...(convs[ci].is_archived_by || []), me.id],
      isArchivedBy: [...(convs[ci].isArchivedBy || []), me.id],
    };
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CHAT_CONVERSATIONS', action: 'UPDATE', payload: convs[ci] });
    api.archiveChatConversation(conversationId).catch((err) => console.error('Failed to archive conversation:', err));
  }

  public async toggleConversationPin(conversationId: string): Promise<ChatConversation | null> {
    const me = this.currentUser;
    const convs = this.conversations || [];
    const ci = convs.findIndex((c) => c.id === conversationId);
    if (ci < 0) return null;
    const pinned = convs[ci].pinned_by_user_ids || convs[ci].pinnedByUserIds || [];
    const isPinned = pinned.includes(me.id);
    const newPinned = isPinned ? pinned.filter((id) => id !== me.id) : [...pinned, me.id];
    convs[ci] = { ...convs[ci], pinned_by_user_ids: newPinned, pinnedByUserIds: newPinned };
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CHAT_CONVERSATIONS', action: 'UPDATE', payload: convs[ci] });
    api.toggleConversationPin(conversationId).catch((err) => console.error('Failed to toggle pin:', err));
    return convs[ci];
  }

  public async setConversationPriority(conversationId: string, priority: string): Promise<ChatConversation | null> {
    const convs = this.conversations || [];
    const ci = convs.findIndex((c) => c.id === conversationId);
    if (ci < 0) return null;
    convs[ci] = { ...convs[ci], priority: priority as any };
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CHAT_CONVERSATIONS', action: 'UPDATE', payload: convs[ci] });
    api.setConversationPriority(conversationId, priority).catch((err) => console.error('Failed to set priority:', err));
    return convs[ci];
  }

  public async createGroupConversation(title: string, memberIds: string[], groupImageUrl?: string, priority?: string): Promise<ChatConversation | null> {
    try {
      const res = await api.createGroupConversation({ title, memberIds, groupImageUrl, priority });
      if (res.success && res.conversation) {
        this.conversations = [res.conversation, ...(this.conversations || [])];
        this.saveLocalCacheSnapshot();
        emitChange({ key: 'CHAT_CONVERSATIONS', action: 'CREATE', payload: res.conversation });
        return res.conversation;
      }
      return null;
    } catch (err: any) { console.error('Failed to create group:', err); return null; }
  }

  public async addGroupMember(conversationId: string, userId: string, role?: string): Promise<ChatConversation | null> {
    try {
      const res = await api.addGroupMember(conversationId, { userId, role });
      if (res.success && res.conversation) {
        const convs = this.conversations || [];
        const idx = convs.findIndex((c) => c.id === conversationId);
        if (idx >= 0) convs[idx] = res.conversation; else convs.unshift(res.conversation);
        this.saveLocalCacheSnapshot();
        emitChange({ key: 'CHAT_CONVERSATIONS', action: 'UPDATE', payload: res.conversation });
        return res.conversation;
      }
      return null;
    } catch (err: any) { console.error('Failed to add member:', err); return null; }
  }

  public async removeGroupMember(conversationId: string, userId: string): Promise<ChatConversation | null> {
    try {
      const res = await api.removeGroupMember(conversationId, userId);
      if (res.success && res.conversation) {
        const convs = this.conversations || [];
        const idx = convs.findIndex((c) => c.id === conversationId);
        if (idx >= 0) convs[idx] = res.conversation;
        this.saveLocalCacheSnapshot();
        emitChange({ key: 'CHAT_CONVERSATIONS', action: 'UPDATE', payload: res.conversation });
        return res.conversation;
      }
      return null;
    } catch (err: any) { console.error('Failed to remove member:', err); return null; }
  }

  public async softDeleteChatMessage(conversationId: string, messageId: string, reason?: string): Promise<boolean> {
    const me = this.currentUser;
    const msgs = this.chatMessages || [];
    const idx = msgs.findIndex((m) => m.id === messageId);
    if (idx >= 0) {
      msgs[idx] = { ...msgs[idx], is_deleted: true, isDeleted: true, deleted_at: new Date().toISOString(), deleted_by_user_id: me.id, deleted_by_user_name: me.name, deletion_reason: reason || 'حذف توسط مدیر', body: 'این پیام توسط مدیر حذف شده است.' };
      this.saveLocalCacheSnapshot();
      emitChange({ key: 'CHAT_MESSAGES', action: 'UPDATE', payload: msgs[idx] });
    }
    try { await api.deleteChatMessage(conversationId, messageId, reason); return true; } catch { return false; }
  }

  public async editChatMessage(conversationId: string, messageId: string, body: string): Promise<boolean> {
    const msgs = this.chatMessages || [];
    const idx = msgs.findIndex((m) => m.id === messageId);
    if (idx >= 0) {
      msgs[idx] = { ...msgs[idx], body, body_text: body, is_edited: true, isEdited: true, edited_at: new Date().toISOString() };
      this.saveLocalCacheSnapshot();
      emitChange({ key: 'CHAT_MESSAGES', action: 'UPDATE', payload: msgs[idx] });
    }
    try { await api.editChatMessage(conversationId, messageId, body); return true; } catch { return false; }
  }

  public async attachDocumentToChatMessage(conversationId: string, messageId: string, documentId: string): Promise<boolean> {
    try {
      const res = await api.attachDocumentToChatMessage(conversationId, messageId, documentId);
      if (res.success) {
        const msgs = this.chatMessages || [];
        const idx = msgs.findIndex((m) => m.id === messageId);
        if (idx >= 0) {
          const existing = msgs[idx].attachments || [];
          msgs[idx] = { ...msgs[idx], attachments: [...existing, { document_id: documentId, documentId }] };
          this.saveLocalCacheSnapshot();
          emitChange({ key: 'CHAT_MESSAGES', action: 'UPDATE', payload: msgs[idx] });
        }
        return true;
      }
      return false;
    } catch (err: any) { console.error('Failed to attach document:', err); return false; }
  }

  public async deleteConversationByAdmin(conversationId: string): Promise<boolean> {
    try {
      this.conversations = (this.conversations || []).filter((c) => c.id !== conversationId);
      this.saveLocalCacheSnapshot();
      emitChange({ key: 'CHAT_CONVERSATIONS', action: 'DELETE', payload: conversationId });
      api.deleteConversation(conversationId).catch(() => {});
      return true;
    } catch { return false; }
  }

  public async getAdminConversations(filters?: { search?: string; type?: string; priority?: string; archived?: boolean }): Promise<any[]> {
    try { const res = await api.getAdminConversations(filters); return res.conversations || []; } catch { return []; }
  }

  // ----------------------------------------------------
  // Registered Holders (افراد ثبت‌کننده سیم‌کارت)
  // ----------------------------------------------------
  public getRegisteredHolders(): RegisteredHolder[] {
    const sims = this.sims || [];
    return (this.registeredHolders || []).map((h) => {
      const activeCount = sims.filter((s) => s.registeredHolderId === h.id && s.status !== 'SUSPENDED').length;
      return {
        ...h,
        activeSimCount: activeCount,
        maxCapacity: 10,
        remainingCapacity: Math.max(0, 10 - activeCount),
        isAtCapacity: activeCount >= 10,
      };
    });
  }

  public findRegisteredHolderById(id: string): RegisteredHolder | undefined {
    return (this.registeredHolders || []).find((h) => h.id === id);
  }

  public async saveRegisteredHolder(holder: Partial<RegisteredHolder>): Promise<RegisteredHolder> {
    try {
      const now = new Date().toISOString();
      const id = holder.id || `hld-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const existingIdx = this.registeredHolders.findIndex((h) => h.id === id);
      
      let savedHolder: RegisteredHolder;
      if (existingIdx >= 0) {
        savedHolder = {
          ...this.registeredHolders[existingIdx],
          ...holder,
          id,
          updatedAt: now,
        };
        this.registeredHolders[existingIdx] = savedHolder;
      } else {
        savedHolder = {
          id,
          fullName: holder.fullName || '',
          nationalId: holder.nationalId || '',
          mobile: holder.mobile || '',
          shebaNumber: holder.shebaNumber,
          notes: holder.notes,
          birthDate: holder.birthDate,
          address: holder.address,
          isActive: holder.isActive ?? true,
          nationalIdImageUrl: holder.nationalIdImageUrl,
          nationalIdImageName: holder.nationalIdImageName,
          nationalIdImageSize: holder.nationalIdImageSize,
          nationalIdImageType: holder.nationalIdImageType,
          nationalIdImageUploadedBy: holder.nationalIdImageUploadedBy,
          nationalIdImageUploadedAt: holder.nationalIdImageUploadedAt,
          createdAt: now,
          updatedAt: now,
        };
        this.registeredHolders.unshift(savedHolder);
      }

      if (savedHolder.nationalIdImageUrl) {
        idbStorage.set(`holder_idcard_${savedHolder.id}`, savedHolder.nationalIdImageUrl).catch(() => {});
      }

      this.saveLocalCacheSnapshot();
      emitChange({ key: 'REGISTERED_HOLDERS', action: 'SAVE', payload: savedHolder });

      // Synchronize with backend API asynchronously
      api.saveRegisteredHolder(savedHolder).then((res) => {
        if (res?.success && res.holder) {
          const idx = this.registeredHolders.findIndex((h) => h.id === res.holder.id);
          if (idx >= 0) {
            this.registeredHolders[idx] = { ...this.registeredHolders[idx], ...res.holder };
            if (res.holder.nationalIdImageUrl) {
              idbStorage.set(`holder_idcard_${res.holder.id}`, res.holder.nationalIdImageUrl).catch(() => {});
            }
            this.saveLocalCacheSnapshot();
          }
        }
      }).catch((err) => {
        console.warn('Backend sync for registered holder deferred:', err);
      });

      return savedHolder;
    } catch (err: any) {
      console.error('Failed to save registered holder:', err);
      throw err;
    }
  }

  public async deleteRegisteredHolder(id: string, reason?: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await api.deleteRegisteredHolder(id, reason);
      if (res.success) {
        this.registeredHolders = this.registeredHolders.filter((h) => h.id !== id);
        idbStorage.delete(`holder_idcard_${id}`).catch(() => {});
        this.saveLocalCacheSnapshot();
        emitChange({ key: 'REGISTERED_HOLDERS', action: 'DELETE', payload: { id } });
      }
      return res;
    } catch (err: any) {
      console.error('Failed to delete registered holder:', err);
      throw err;
    }
  }

  // ----------------------------------------------------
  // Contract Installments & Finance Referral
  // ----------------------------------------------------
  public getContractInstallments(contractId?: string): ContractInstallment[] {
    if (contractId) {
      return this.contractInstallments.filter((i) => i.contractId === contractId);
    }
    return [...this.contractInstallments];
  }

  public findContractInstallmentById(id: string): ContractInstallment | undefined {
    return this.contractInstallments.find((i) => i.id === id);
  }

  public async saveContractInstallment(inst: Partial<ContractInstallment>): Promise<ContractInstallment> {
    try {
      const res = await api.saveContractInstallment(inst);
      if (res.success && res.installment) {
        const saved = res.installment;
        const idx = this.contractInstallments.findIndex((i) => i.id === saved.id);
        if (idx >= 0) {
          this.contractInstallments[idx] = saved;
        } else {
          this.contractInstallments.push(saved);
        }
        this.saveLocalCacheSnapshot();
        emitChange({ key: 'CONTRACT_INSTALLMENTS', action: 'SAVE', payload: saved });
        return saved;
      }
      throw new Error('خطا در ذخیره قسط');
    } catch (err: any) {
      console.error('Failed to save contract installment:', err);
      throw err;
    }
  }

  public async recordInstallmentPayment(
    installmentIdOrPayload: string | { installmentId: string; [key: string]: any },
    paymentData?: any
  ): Promise<any> {
    try {
      const installmentId = typeof installmentIdOrPayload === 'string'
        ? installmentIdOrPayload
        : installmentIdOrPayload.installmentId;
      const data = typeof installmentIdOrPayload === 'string'
        ? (paymentData || {})
        : installmentIdOrPayload;

      const res = await api.recordInstallmentPayment(installmentId, data);
      if (res.success) {
        if (res.payment) {
          const pIdx = this.payments.findIndex((p) => p.id === res.payment.id);
          if (pIdx >= 0) {
            this.payments[pIdx] = res.payment;
          } else {
            this.payments.unshift(res.payment);
          }
        }
        if (res.installment) {
          const iIdx = this.contractInstallments.findIndex((i) => i.id === res.installment.id);
          if (iIdx >= 0) {
            this.contractInstallments[iIdx] = res.installment;
          }
        }
        this.saveLocalCacheSnapshot();
        emitChange({ key: 'PAYMENTS', action: 'SAVE', payload: res.payment });
        emitChange({ key: 'CONTRACT_INSTALLMENTS', action: 'UPDATE', payload: res.installment });
        return res;
      }
      throw new Error('خطا در ثبت واریزی قسط');
    } catch (err: any) {
      console.error('Failed to record installment payment:', err);
      throw err;
    }
  }

  public async reviewFinancePayment(paymentId: string, status: string, notes: string): Promise<any> {
    try {
      const res = await api.reviewFinancePayment(paymentId, status, notes);
      if (res.success && res.payment) {
        const idx = this.payments.findIndex((p) => p.id === paymentId);
        if (idx >= 0) {
          this.payments[idx] = res.payment;
          this.saveLocalCacheSnapshot();
          emitChange({ key: 'PAYMENTS', action: 'UPDATE', payload: res.payment });
        }
        return res.payment;
      }
      throw new Error('خطا در بررسی مدیریت مالی');
    } catch (err: any) {
      console.error('Failed to review finance payment:', err);
      throw err;
    }
  }

  // ----------------------------------------------------
  // Biometric Trusted Devices
  // ----------------------------------------------------
  public getTrustedBiometricDevices(userId?: string): TrustedBiometricDevice[] {
    const targetUserId = userId || this.currentUser?.id;
    if (targetUserId) {
      return this.trustedBiometricDevices.filter((d) => d.userId === targetUserId && !d.isRevoked);
    }
    return this.trustedBiometricDevices.filter((d) => !d.isRevoked);
  }

  public async registerBiometricDevice(device: any): Promise<any> {
    const res = await api.registerBiometricDevice(device);
    if (res.success && res.device) {
      const idx = this.trustedBiometricDevices.findIndex((d) => d.id === res.device.id);
      if (idx >= 0) {
        this.trustedBiometricDevices[idx] = res.device;
      } else {
        this.trustedBiometricDevices.unshift(res.device);
      }
      this.saveLocalCacheSnapshot();
      emitChange({ key: 'BIOMETRICS', action: 'REGISTER', payload: res.device });
      return res.device;
    }
    throw new Error('خطا در ثبت دستگاه بیومتریک');
  }

  public async revokeBiometricDevice(id: string): Promise<boolean> {
    const res = await api.revokeBiometricDevice(id);
    if (res.success) {
      const idx = this.trustedBiometricDevices.findIndex((d) => d.id === id);
      if (idx >= 0) {
        this.trustedBiometricDevices[idx].isRevoked = true;
      }
      this.saveLocalCacheSnapshot();
      emitChange({ key: 'BIOMETRICS', action: 'REVOKE', payload: { id } });
      return true;
    }
    return false;
  }

  // ----------------------------------------------------
  // SIM Lifecycle Domain Transitions
  // ----------------------------------------------------
  public async reserveSimCard(simId: string, reservation: {
    customerId: string;
    customerName: string;
    depositAmount: number;
    notes?: string;
    deadline?: string;
    userId?: string;
    userName?: string;
  }): Promise<SimCard> {
    const sim = this.findSimById(simId);
    if (!sim) throw new Error('سیم‌کارت یافت نشد.');

    const updated: SimCard = {
      ...sim,
      status: 'RESERVED' as any,
      reservationCustomerId: reservation.customerId,
      reservationCustomerName: reservation.customerName,
      depositAmount: reservation.depositAmount,
      reservationNotes: reservation.notes,
      depositDate: new Date().toISOString(),
      reservedAt: new Date().toISOString(),
      reservationExpireAt: reservation.deadline,
      reservedBy: reservation.userName || this.currentUser.name,
      updatedAt: new Date().toISOString(),
    };

    return await this.saveSim(updated);
  }

  public async cancelSimReservation(simId: string, cancellation: {
    refundDeposit?: boolean;
    reason?: string;
  }): Promise<SimCard> {
    const sim = this.findSimById(simId);
    if (!sim) throw new Error('سیم‌کارت یافت نشد.');

    const updated: SimCard = {
      ...sim,
      status: 'AVAILABLE' as any,
      reservationCustomerId: undefined,
      reservationCustomerName: undefined,
      depositAmount: 0,
      cancellationReason: cancellation.reason,
      cancelledAt: new Date().toISOString(),
      cancelledBy: this.currentUser.name,
      reservedAt: undefined,
      reservationExpireAt: undefined,
      reservedBy: undefined,
      updatedAt: new Date().toISOString(),
    };

    return await this.saveSim(updated);
  }

  public async sellSimCard(simId: string, sale: {
    contractId: string;
    contractNumber: string;
    customerId: string;
    customerName: string;
    salePrice: number;
    buyerNationalId?: string;
    buyerMobile?: string;
    deliveryMethod?: string;
  }): Promise<SimCard> {
    const sim = this.findSimById(simId);
    if (!sim) throw new Error('سیم‌کارت یافت نشد.');

    const updated: SimCard = {
      ...sim,
      status: 'SOLD' as any,
      contractId: sale.contractId,
      contractNumber: sale.contractNumber,
      buyerCustomerId: sale.customerId,
      buyerCustomerName: sale.customerName,
      buyerNationalId: sale.buyerNationalId,
      buyerMobile: sale.buyerMobile,
      salePrice: sale.salePrice,
      saleDate: new Date().toISOString(),
      deliveryStatus: 'PENDING',
      deliveryMethod: sale.deliveryMethod || 'OFFICE_PICKUP',
      updatedAt: new Date().toISOString(),
    };

    return await this.saveSim(updated);
  }

  public async mortgageSimCard(simId: string, mortgage: {
    isMortgaged: boolean;
    mortgageeName?: string;
    mortgageAmount?: number;
    mortgageStartDate?: string;
    mortgageEndDate?: string;
    mortgageContractRef?: string;
    mortgageReleaseDate?: string;
    notes?: string;
  }): Promise<SimCard> {
    const sim = this.findSimById(simId);
    if (!sim) throw new Error('سیم‌کارت یافت نشد.');

    const updated: SimCard = {
      ...sim,
      isMortgaged: mortgage.isMortgaged,
      mortgageeName: mortgage.mortgageeName,
      mortgageAmount: mortgage.mortgageAmount,
      mortgageStartDate: mortgage.mortgageStartDate,
      mortgageEndDate: mortgage.mortgageEndDate,
      mortgageContractRef: mortgage.mortgageContractRef,
      mortgageReleaseDate: mortgage.mortgageReleaseDate,
      mortgageNotes: mortgage.notes,
      updatedAt: new Date().toISOString(),
    };

    return await this.saveSim(updated);
  }

  // ----------------------------------------------------
  // Consignments / سیم‌کارت امانی
  // ----------------------------------------------------
  public getConsignments(): Consignment[] {
    return [...this.consignments];
  }

  public getConsignmentsByStatus(status: string): Consignment[] {
    return this.consignments.filter((c) => c.status === status);
  }

  public getConsignmentById(id: string): Consignment | undefined {
    return this.consignments.find((c) => c.id === id);
  }

  public getConsignmentsBySimId(simId: string): Consignment[] {
    return this.consignments.filter((c) => c.simId === simId);
  }

  public saveConsignment(consignmentData: Partial<Consignment> & { ownerCustomerId: string; ownerCustomerName: string }): Consignment {
    const idx = this.consignments.findIndex((c) => c.id === consignmentData.id);
    let updated: Consignment;
    const now = new Date().toISOString();

    if (idx >= 0) {
      updated = {
        ...this.consignments[idx],
        ...consignmentData,
        updatedAt: now,
      } as Consignment;
      this.consignments[idx] = updated;
    } else {
      updated = {
        id: `cons-${Date.now()}`,
        status: 'CONSIGNMENT',
        contactHistory: [],
        ...consignmentData,
        createdAt: now,
        updatedAt: now,
      } as Consignment;
      this.consignments.unshift(updated);
    }

    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CONSIGNMENTS', action: 'SAVE', payload: updated });
    api.saveConsignment(updated).catch((err) => console.error('Failed to sync consignment to server:', err));
    return updated;
  }

  public async sellConsignment(consignmentId: string, sale: {
    soldPrice: number;
    actualCommission: number;
    ownerPayableAmount: number;
    buyerCustomerId: string;
    buyerCustomerName: string;
    settlementStatus?: 'PENDING' | 'PARTIAL' | 'SETTLED';
  }): Promise<Consignment> {
    const cons = this.getConsignmentById(consignmentId);
    if (!cons) throw new Error('سیم‌کارت امانی یافت نشد.');
    const now = new Date().toISOString();

    const updated: Consignment = {
      ...cons,
      status: 'SOLD',
      soldAt: now,
      soldPrice: sale.soldPrice,
      actualCommission: sale.actualCommission,
      ownerPayableAmount: sale.ownerPayableAmount,
      buyerCustomerId: sale.buyerCustomerId,
      buyerCustomerName: sale.buyerCustomerName,
      settlementStatus: sale.settlementStatus || 'PENDING',
      updatedAt: now,
    };

    this.consignments = this.consignments.map((c) => (c.id === consignmentId ? updated : c));
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CONSIGNMENTS', action: 'UPDATE', payload: updated });
    api.saveConsignment(updated).catch((err) => console.error('Failed to sync consignment to server:', err));
    return updated;
  }

  public async returnConsignment(consignmentId: string, reason: string): Promise<Consignment> {
    const cons = this.getConsignmentById(consignmentId);
    if (!cons) throw new Error('سیم‌کارت امانی یافت نشد.');
    const now = new Date().toISOString();

    const updated: Consignment = {
      ...cons,
      status: 'RETURNED',
      returnReason: reason,
      returnedAt: now,
      updatedAt: now,
    };

    this.consignments = this.consignments.map((c) => (c.id === consignmentId ? updated : c));
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CONSIGNMENTS', action: 'UPDATE', payload: updated });
    api.saveConsignment(updated).catch((err) => console.error('Failed to sync consignment to server:', err));
    return updated;
  }

  public async settleConsignment(consignmentId: string): Promise<Consignment> {
    const cons = this.getConsignmentById(consignmentId);
    if (!cons) throw new Error('سیم‌کارت امانی یافت نشد.');
    const now = new Date().toISOString();

    const updated: Consignment = {
      ...cons,
      settlementStatus: 'SETTLED',
      settledAt: now,
      updatedAt: now,
    };

    this.consignments = this.consignments.map((c) => (c.id === consignmentId ? updated : c));
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CONSIGNMENTS', action: 'UPDATE', payload: updated });
    api.saveConsignment(updated).catch((err) => console.error('Failed to sync consignment to server:', err));
    return updated;
  }

  public addConsignmentContact(consignmentId: string, contact: ConsignmentContact): Consignment {
    const cons = this.getConsignmentById(consignmentId);
    if (!cons) throw new Error('سیم‌کارت امانی یافت نشد.');

    const updated: Consignment = {
      ...cons,
      contactHistory: [contact, ...(cons.contactHistory || [])],
      updatedAt: new Date().toISOString(),
    };

    this.consignments = this.consignments.map((c) => (c.id === consignmentId ? updated : c));
    this.saveLocalCacheSnapshot();
    emitChange({ key: 'CONSIGNMENTS', action: 'UPDATE', payload: updated });
    api.saveConsignment(updated).catch((err) => console.error('Failed to sync consignment to server:', err));
    return updated;
  }

  public resetToSampleData(): void {
    this.resetToSeedData();
  }

  public resetToProduction(): void {
    this.resetToSeedData();
  }

  public resetToSeedData(): void {
    this.syncWithServer(true);
    emitChange({ key: 'ALL', action: 'RESET' });
  }
}

export const storage = new CentralStorageService();
