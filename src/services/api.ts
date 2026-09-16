import {
  User, Customer, Lead, Call, Task, Contract, Payment, Check,
  SimCard, Repair, Attachment, Notification, AuditLog, Role, VoiceNote,
  Interaction, ProblemReport, BackupItem, BackupHealthSummary,
  BackupScheduleSettings, BackupVerificationResult, RestoreExecutionResult,
  Account, JournalEntry, AccountingPeriod, DocumentShare,
  ChatConversation, ChatMessage, MessageAttachment, Broadcast
} from '../types';

const API_BASE = '/api';

class ApiClient {
  private getAuthToken(): string | null {
    try {
      return localStorage.getItem('mmba_auth_token') || null;
    } catch {
      return null;
    }
  }

  public setAuthToken(token: string | null): void {
    try {
      if (token) {
        localStorage.setItem('mmba_auth_token', token);
      } else {
        localStorage.removeItem('mmba_auth_token');
      }
    } catch (e) {
      console.error('Failed to set auth token:', e);
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status} ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData?.message) errorMessage = errorData.message;
      } catch {
        // use default error message
      }
      throw new Error(errorMessage);
    }

    return res.json() as Promise<T>;
  }

  private async requestWithAbort<T>(endpoint: string, options: RequestInit = {}, timeoutMs = 15000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.request<T>(endpoint, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  // Health
  public async getHealth() {
    return this.request<{ status: string; revision: number; lastUpdatedAt: string }>('/health');
  }

  // Auth & Profile
  public async login(usernameOrEmail: string, password: string) {
    return this.request<{ success: boolean; token: string; user: User; serverRevision: number; message?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, password }),
    });
  }

  public async getMe() {
    return this.request<{ user: User | null }>('/auth/me');
  }

  public async updateProfile(data: { userId?: string; username?: string; name?: string; email?: string; mobile?: string; department?: string; avatar?: string }) {
    return this.request<{ success: boolean; user: User; revision: number }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async updatePassword(data: { currentPassword: string; newPassword: string; userId?: string; username?: string }) {
    return this.request<{ success: boolean; user: User; revision: number }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async changePassword(currentPassword: string, newPassword: string, userId?: string) {
    return this.request<{ success: boolean; user: User; revision: number }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword, userId }),
    });
  }

  // Central Database Sync
  public async getSyncAll() {
    return this.request<{
      success: boolean;
      revision: number;
      lastUpdatedAt: string;
      data: {
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
        notifications: Notification[];
        auditLogs: AuditLog[];
        dateSuggestions: any[];
        sharedLinks: any[];
        settings: any;
      };
    }>('/sync/all');
  }

  public async getSyncVersion() {
    return this.request<{ revision: number; lastUpdatedAt: string }>('/sync/version');
  }

  public async pushSync(payload: any) {
    return this.request<{ success: boolean; revision: number; lastUpdatedAt: string }>('/sync/push', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Contact Quick Lookup (Unified Customers vs Leads)
  public async lookupContact(queryOrMobile: string) {
    const q = encodeURIComponent(queryOrMobile.trim());
    return this.request<{
      success: boolean;
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
    }>(`/contacts/lookup?mobile=${q}`);
  }

  // Leads (Sprint 02 Patch 01)
  public async getLeads(params?: { status?: string; query?: string; q?: string }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ success: boolean; leads: Lead[] }>(`/leads${qStr}`);
  }

  public async getLeadById(id: string) {
    return this.request<{ success: boolean; lead: Lead }>(`/leads/${id}`);
  }

  public async saveLead(lead: Partial<Lead> & { mobile: string }) {
    if (lead.id && !lead.id.startsWith('temp-')) {
      return this.request<{ success: boolean; lead: Lead; revision: number }>(`/leads/${lead.id}`, {
        method: 'PUT',
        body: JSON.stringify(lead),
      });
    } else {
      return this.request<{ success: boolean; lead: Lead; revision: number }>('/leads', {
        method: 'POST',
        body: JSON.stringify(lead),
      });
    }
  }

  public async deleteLead(id: string) {
    return this.request<{ success: boolean; revision: number }>(`/leads/${id}`, {
      method: 'DELETE',
    });
  }

  public async convertLead(leadId: string, customerData: Partial<Customer>) {
    return this.request<{ success: boolean; customer: Customer; lead: Lead; revision: number }>(`/leads/${leadId}/convert`, {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
  }

  // Customers
  public async getCustomers() {
    return this.request<{ customers: Customer[] }>('/customers');
  }

  public async saveCustomer(customer: Customer) {
    if (customer.id && !customer.id.startsWith('temp-')) {
      return this.request<{ success: boolean; customer: Customer; revision: number }>(`/customers/${customer.id}`, {
        method: 'PUT',
        body: JSON.stringify(customer),
      });
    } else {
      return this.request<{ success: boolean; customer: Customer; revision: number }>('/customers', {
        method: 'POST',
        body: JSON.stringify(customer),
      });
    }
  }

  public async deleteCustomer(id: string) {
    return this.request<{ success: boolean; revision: number }>(`/customers/${id}`, {
      method: 'DELETE',
    });
  }

  public async bulkDeleteCustomers(ids: string[]) {
    return this.request<{ success: boolean; count: number; revision: number }>('/customers/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  // Calls & Interactions (Call Center Engine)
  public async saveCall(call: Call) {
    return this.request<{ success: boolean; call: Call; revision: number }>('/calls', {
      method: 'POST',
      body: JSON.stringify(call),
    });
  }

  public async deleteCall(id: string) {
    return this.request<{ success: boolean; revision: number }>(`/calls/${id}`, {
      method: 'DELETE',
    });
  }

  public async getInteractions(params?: Record<string, string | number | boolean | undefined>) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return this.request<{
      success: boolean;
      interactions: Interaction[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/interactions${qStr}`);
  }

  public async getInteractionById(id: string) {
    return this.request<{ success: boolean; interaction: Interaction }>(`/interactions/${id}`);
  }

  public async saveInteraction(interaction: Interaction) {
    return this.request<{ success: boolean; interaction: Interaction; revision: number }>('/interactions', {
      method: 'POST',
      body: JSON.stringify(interaction),
    });
  }

  public async patchInteraction(id: string, updates: Partial<Interaction>) {
    return this.request<{ success: boolean; interaction: Interaction; revision: number }>(`/interactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  public async completeInteractionFollowUp(id: string) {
    return this.request<{ success: boolean; interaction: Interaction; revision: number }>(`/interactions/${id}/complete-follow-up`, {
      method: 'POST',
    });
  }

  public async deleteInteraction(id: string) {
    return this.request<{ success: boolean; revision: number }>(`/interactions/${id}`, {
      method: 'DELETE',
    });
  }

  // Voice Notes / Text Notes (Sprint 03 Patch 05)
  public async saveVoiceNote(vn: VoiceNote) {
    return this.request<{ success: boolean; voiceNote: VoiceNote; revision: number }>('/voice-notes', {
      method: 'POST',
      body: JSON.stringify(vn),
    });
  }

  public async updateVoiceNote(id: string, patch: Partial<VoiceNote>) {
    return this.request<{ success: boolean; voiceNote: VoiceNote; revision: number }>(`/voice-notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  }

  public async deleteVoiceNote(id: string) {
    return this.request<{ success: boolean; revision: number }>(`/voice-notes/${id}`, {
      method: 'DELETE',
    });
  }

  // Tasks
  public async saveTask(task: Task) {
    if (task.id && !task.id.startsWith('temp-')) {
      return this.request<{ success: boolean; task: Task; revision: number }>(`/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify(task),
      });
    } else {
      return this.request<{ success: boolean; task: Task; revision: number }>('/tasks', {
        method: 'POST',
        body: JSON.stringify(task),
      });
    }
  }

  public async deleteTask(id: string) {
    return this.request<{ success: boolean; revision: number }>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // Contracts
  public async saveContract(contract: Contract) {
    if (contract.id && !contract.id.startsWith('temp-')) {
      return this.request<{ success: boolean; contract: Contract; revision: number }>(`/contracts/${contract.id}`, {
        method: 'PUT',
        body: JSON.stringify(contract),
      });
    } else {
      return this.request<{ success: boolean; contract: Contract; revision: number }>('/contracts', {
        method: 'POST',
        body: JSON.stringify(contract),
      });
    }
  }

  public async deleteContract(id: string) {
    return this.request<{ success: boolean; revision: number }>(`/contracts/${id}`, {
      method: 'DELETE',
    });
  }

  // Payments & Checks
  public async savePayment(payment: Payment) {
    if (payment.id && !payment.id.startsWith('temp-')) {
      return this.request<{ success: boolean; payment: Payment; revision: number }>(`/payments/${payment.id}`, {
        method: 'PUT',
        body: JSON.stringify(payment),
      });
    } else {
      return this.request<{ success: boolean; payment: Payment; revision: number }>('/payments', {
        method: 'POST',
        body: JSON.stringify(payment),
      });
    }
  }

  public async deletePayment(id: string) {
    return this.request<{ success: boolean; revision: number }>(`/payments/${id}`, {
      method: 'DELETE',
    });
  }

  public async saveCheck(check: Check) {
    if (check.id && !check.id.startsWith('temp-')) {
      return this.request<{ success: boolean; check: Check; revision: number }>(`/checks/${check.id}`, {
        method: 'PUT',
        body: JSON.stringify(check),
      });
    } else {
      return this.request<{ success: boolean; check: Check; revision: number }>('/checks', {
        method: 'POST',
        body: JSON.stringify(check),
      });
    }
  }

  public async deleteCheck(id: string) {
    return this.request<{ success: boolean; revision: number }>(`/checks/${id}`, {
      method: 'DELETE',
    });
  }

  // SIM & Repairs
  public async saveSim(sim: SimCard) {
    if (sim.id && !sim.id.startsWith('temp-')) {
      return this.request<{ success: boolean; sim: SimCard; revision: number }>(`/sims/${sim.id}`, {
        method: 'PUT',
        body: JSON.stringify(sim),
      });
    } else {
      return this.request<{ success: boolean; sim: SimCard; revision: number }>('/sims', {
        method: 'POST',
        body: JSON.stringify(sim),
      });
    }
  }

  public async deleteSim(id: string) {
    return this.request<{ success: boolean; revision: number }>(`/sims/${id}`, {
      method: 'DELETE',
    });
  }

  public async saveRepair(repair: Repair) {
    if (repair.id && !repair.id.startsWith('temp-')) {
      return this.request<{ success: boolean; repair: Repair; revision: number }>(`/repairs/${repair.id}`, {
        method: 'PUT',
        body: JSON.stringify(repair),
      });
    } else {
      return this.request<{ success: boolean; repair: Repair; revision: number }>('/repairs', {
        method: 'POST',
        body: JSON.stringify(repair),
      });
    }
  }

  public async deleteRepair(id: string) {
    return this.request<{ success: boolean; revision: number }>(`/repairs/${id}`, {
      method: 'DELETE',
    });
  }

  // Attachments
  public async saveAttachment(att: Attachment) {
    return this.requestWithAbort<{ success: boolean; attachment: Attachment; revision: number }>('/attachments', {
      method: 'POST',
      body: JSON.stringify(att),
    }, 60000);
  }

  public async updateAttachmentThumbnail(id: string, thumbnailDataUrl: string, uploadStatus?: Attachment['uploadStatus']) {
    return this.requestWithAbort<{ success: boolean; attachment: Attachment; revision: number }>(`/attachments/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ thumbnailDataUrl, uploadStatus }),
    }, 30000);
  }

  public async linkAttachmentCustomer(id: string, customerId?: string, customerName?: string) {
    return this.request<{ success: boolean; attachment: Attachment; revision: number }>(`/attachments/${id}/link-customer`, {
      method: 'POST',
      body: JSON.stringify({ customerId, customerName }),
    });
  }

  public async deleteAttachment(id: string) {
    return this.request<{ success: boolean; revision: number }>(`/attachments/${id}`, {
      method: 'DELETE',
    });
  }

  public async renameAttachment(id: string, displayName: string) {
    return this.request<{ success: boolean; revision: number }>(`/attachments/${id}/rename`, {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    });
  }

  public async saveConsignment(consignment: any) {
    return this.request<{ success: boolean; revision: number }>('/consignments', {
      method: 'POST',
      body: JSON.stringify(consignment),
    });
  }

  // Users & Roles
  public async saveUser(user: User) {
    if (user.id && !user.id.startsWith('temp-')) {
      return this.request<{ success: boolean; user: User; revision: number }>(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify(user),
      });
    } else {
      return this.request<{ success: boolean; user: User; revision: number }>('/users', {
        method: 'POST',
        body: JSON.stringify(user),
      });
    }
  }

  public async deleteUser(id: string) {
    return this.request<{ success: boolean; message?: string; revision: number }>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  public async resetUserPassword(id: string, newPassword: string) {
    return this.request<{ success: boolean; message: string; user: any; revision: number }>(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  public async saveRole(role: Role) {
    return this.request<{ success: boolean; role: Role; revision: number }>(`/roles/${role.id || role.name}`, {
      method: 'PUT',
      body: JSON.stringify(role),
    });
  }

  // Notifications & Audit
  public async saveNotification(n: Notification) {
    return this.request<{ success: boolean; notification: Notification; revision: number }>('/notifications', {
      method: 'POST',
      body: JSON.stringify(n),
    });
  }

  public async snoozeNotification(id: string, minutes = 15) {
    return this.request<{ success: boolean; notification: Notification; revision: number }>(`/notifications/${id}/snooze`, {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    });
  }

  public async markAllNotificationsRead(userId?: string) {
    return this.request<{ success: boolean; revision: number }>('/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  public async logAudit(audit: Partial<AuditLog>) {
    return this.request<{ success: boolean; log: AuditLog; revision: number }>('/audit-logs', {
      method: 'POST',
      body: JSON.stringify(audit),
    });
  }

  // Problem Reports
  public async getProblemReports() {
    return this.request<{ reports: ProblemReport[] }>('/problem-reports');
  }

  public async saveProblemReport(report: Partial<ProblemReport>) {
    return this.request<{ success: boolean; report: ProblemReport; revision: number }>('/problem-reports', {
      method: 'POST',
      body: JSON.stringify(report),
    });
  }

  public async updateProblemReport(report: ProblemReport) {
    return this.request<{ success: boolean; report: ProblemReport; revision: number }>(`/problem-reports/${report.id}`, {
      method: 'PUT',
      body: JSON.stringify(report),
    });
  }

  public async deleteProblemReport(id: string) {
    return this.request<{ success: boolean; revision: number }>(`/problem-reports/${id}`, {
      method: 'DELETE',
    });
  }

  // Settings
  public async updateSettings(settings: any) {
    return this.request<{ success: boolean; settings: any; revision: number }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // ----------------------------------------------------
  // Full System Backup & Restore Engine
  // ----------------------------------------------------
  public async getBackups() {
    return this.request<{ success: boolean; backups: BackupItem[] }>('/backups');
  }

  public async getBackupHealth() {
    return this.request<{ success: boolean; health: BackupHealthSummary }>('/backups/health');
  }

  public async getBackupSchedule() {
    return this.request<{ success: boolean; schedule: BackupScheduleSettings }>('/backups/schedule');
  }

  public async updateBackupSchedule(schedule: Partial<BackupScheduleSettings>) {
    return this.request<{ success: boolean; schedule: BackupScheduleSettings; message: string }>('/backups/schedule', {
      method: 'PUT',
      body: JSON.stringify(schedule),
    });
  }

  public async createFullBackup(notes?: string) {
    return this.request<{ success: boolean; backup: BackupItem; message: string }>('/backups/create', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  public async verifyBackupIntegrity(backupId: string) {
    return this.request<{ success: boolean; verification: BackupVerificationResult }>(`/backups/${backupId}/verify`);
  }

  public async deleteBackup(backupId: string) {
    return this.request<{ success: boolean; message: string }>(`/backups/${backupId}`, {
      method: 'DELETE',
    });
  }

  public async restoreSystemBackup(backupId: string, confirmPhrase: string = 'RESTORE_CONFIRMED') {
    return this.request<{ success: boolean; result: RestoreExecutionResult; message: string }>(`/backups/${backupId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ confirmPhrase }),
    });
  }

  public async uploadBackupPackage(packageData: any) {
    return this.request<{ success: boolean; backup: BackupItem; message: string }>('/backups/upload', {
      method: 'POST',
      body: JSON.stringify(packageData),
    });
  }

  public async importDatabase(data: any) {
    return this.request<{ success: boolean; revision: number; message: string }>('/backup/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Accounting Foundation
  public async getAccounts() {
    return this.request<Account[]>('/accounts');
  }

  public async saveAccount(account: Partial<Account>) {
    return this.request<Account>('/accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    });
  }

  public async deleteAccount(id: string) {
    return this.request<{ success: boolean }>(`/accounts/${id}`, {
      method: 'DELETE',
    });
  }

  public async getJournalEntries() {
    return this.request<JournalEntry[]>('/journal-entries');
  }

  public async getJournalEntry(id: string) {
    return this.request<JournalEntry>(`/journal-entries/${id}`);
  }

  public async saveJournalEntry(entry: Partial<JournalEntry>, lines: any[]) {
    return this.request<JournalEntry>('/journal-entries', {
      method: 'POST',
      body: JSON.stringify({ entry, lines }),
    });
  }

  public async getAccountingPeriods() {
    return this.request<AccountingPeriod[]>('/accounting-periods');
  }

  public async saveAccountingPeriod(period: Partial<AccountingPeriod>) {
    return this.request<AccountingPeriod>('/accounting-periods', {
      method: 'POST',
      body: JSON.stringify(period),
    });
  }

  // Document Sharing
  public async getDocumentShares(params?: { userId?: string; limit?: number; offset?: number; onlyUnread?: boolean; status?: string }) {
    const qs = new URLSearchParams();
    if (params?.userId) qs.set('userId', params.userId);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.onlyUnread) qs.set('onlyUnread', 'true');
    if (params?.status) qs.set('status', params.status);
    const q = qs.toString();
    return this.request<{ success: boolean; shares: DocumentShare[]; total: number; limit: number; offset: number }>(`/document-shares${q ? '?' + q : ''}`);
  }

  public async createDocumentShares(payload: {
    documentId: string;
    recipientUsers: { id: string; name: string }[];
    message?: string;
    customerId?: string;
    customerName?: string;
    documentFileName?: string;
    documentFileSize?: number;
    documentFileType?: string;
  }) {
    return this.request<{ success: boolean; shares: DocumentShare[] }>('/document-shares', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async markDocumentShareRead(id: string) {
    return this.request<{ success: boolean; share: DocumentShare }>(`/document-shares/${id}/read`, {
      method: 'PUT',
    });
  }

  public async archiveDocumentShare(id: string) {
    return this.request<{ success: boolean; share: DocumentShare }>(`/document-shares/${id}/archive`, {
      method: 'PUT',
    });
  }

  // ----------------------------------------------------
  // Internal Chat (Sprint 03 Patch 05)
  // ----------------------------------------------------
  public async getConversations() {
    return this.request<{ success: boolean; conversations: ChatConversation[]; unreadCount: number }>('/conversations');
  }

  public async createConversation(payload: { recipientUserId: string; recipientUserName?: string }) {
    return this.request<{ success: boolean; conversation: ChatConversation }>('/conversations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getChatMessages(conversationId: string, opts?: { before?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (opts?.before) qs.set('before', opts.before);
    if (opts?.limit) qs.set('limit', String(opts.limit));
    const q = qs.toString();
    return this.request<{ success: boolean; messages: ChatMessage[]; total: number }>(`/conversations/${conversationId}/messages${q ? '?' + q : ''}`);
  }

  public async sendChatMessage(conversationId: string, msg: ChatMessage) {
    return this.request<{ success: boolean; message: ChatMessage; revision: number }>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(msg),
    });
  }

  public async markChatConversationRead(conversationId: string) {
    return this.request<{ success: boolean; conversation: ChatConversation; revision: number }>(`/conversations/${conversationId}/read`, {
      method: 'PUT',
    });
  }

  public async archiveChatConversation(conversationId: string) {
    return this.request<{ success: boolean; conversation: ChatConversation; revision: number }>(`/conversations/${conversationId}/archive`, {
      method: 'PUT',
    });
  }

  public async getAdminConversations(params?: { search?: string; type?: string; priority?: string; archived?: boolean }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.type) qs.set('type', params.type);
    if (params?.priority) qs.set('priority', params.priority);
    if (params?.archived !== undefined) qs.set('archived', String(params.archived));
    const q = qs.toString();
    return this.request<{ success: boolean; conversations: (ChatConversation & { message_count: number })[]; count: number }>(`/conversations/admin${q ? '?' + q : ''}`);
  }

  public async createGroupConversation(payload: { title: string; memberIds: string[]; groupImageUrl?: string; priority?: string }) {
    return this.request<{ success: boolean; conversation: ChatConversation }>('/conversations/group', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async addGroupMember(conversationId: string, payload: { userId: string; role?: string }) {
    return this.request<{ success: boolean; conversation: ChatConversation }>(`/conversations/${conversationId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async removeGroupMember(conversationId: string, userId: string) {
    return this.request<{ success: boolean; conversation: ChatConversation }>(`/conversations/${conversationId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  public async updateConversation(conversationId: string, updates: Partial<ChatConversation>) {
    return this.request<{ success: boolean; conversation: ChatConversation }>(`/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  public async setConversationPriority(conversationId: string, priority: string) {
    return this.request<{ success: boolean; conversation: ChatConversation }>(`/conversations/${conversationId}/priority`, {
      method: 'POST',
      body: JSON.stringify({ priority }),
    });
  }

  public async toggleConversationPin(conversationId: string) {
    return this.request<{ success: boolean; conversation: ChatConversation }>(`/conversations/${conversationId}/pin`, {
      method: 'POST',
    });
  }

  public async deleteChatMessage(conversationId: string, messageId: string, reason?: string) {
    return this.request<{ success: boolean; message: ChatMessage }>(`/conversations/${conversationId}/messages/${messageId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  }

  public async editChatMessage(conversationId: string, messageId: string, body: string) {
    return this.request<{ success: boolean; message: ChatMessage }>(`/conversations/${conversationId}/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ body }),
    });
  }

  public async attachDocumentToChatMessage(conversationId: string, messageId: string, documentId: string) {
    return this.request<{ success: boolean; attachment: MessageAttachment }>(`/conversations/${conversationId}/messages/${messageId}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ documentId }),
    });
  }

  public async deleteConversation(conversationId: string) {
    return this.request<{ success: boolean }>(`/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  // Broadcasts
  public async createBroadcast(payload: { title?: string; body: string; targetType?: 'ALL' | 'SELECTED'; recipientUserIds?: string[] }) {
    return this.request<{ success: boolean; broadcast: Broadcast; recipientCount: number }>('/broadcasts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getBroadcasts() {
    return this.request<{ success: boolean; broadcasts: Broadcast[] }>('/broadcasts');
  }

  public async getBroadcast(id: string) {
    return this.request<{ success: boolean; broadcast: Broadcast; recipients: any[] }>(`/broadcasts/${id}`);
  }

  public async markBroadcastRead(id: string) {
    return this.request<{ success: boolean; marked: boolean }>(`/broadcasts/${id}/read`, {
      method: 'POST',
    });
  }

  // ----------------------------------------------------
  // Registered SIM Holders (افراد ثبت‌کننده سیم‌کارت)
  // ----------------------------------------------------
  public async getRegisteredHolders() {
    return this.request<any[]>('/registered-holders');
  }

  public async saveRegisteredHolder(holder: any) {
    return this.request<{ success: boolean; holder: any }>('/registered-holders', {
      method: 'POST',
      body: JSON.stringify(holder),
    });
  }

  public async deleteRegisteredHolder(id: string, reason?: string) {
    return this.request<{ success: boolean; message: string }>(`/registered-holders/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  }

  public async uploadHolderIdCard(id: string, imageDataUrl: string, fileName?: string, fileType?: string, sizeBytes?: number) {
    return this.request<{ success: boolean; holder: any }>(`/registered-holders/${id}/id-card`, {
      method: 'POST',
      body: JSON.stringify({ imageDataUrl, fileName, fileType, sizeBytes }),
    });
  }

  public async getHolderIdCard(id: string) {
    return this.request<{
      success: boolean;
      holderId: string;
      holderName: string;
      nationalId: string;
      fileName: string;
      fileType: string;
      sizeBytes: number;
      dataUrl: string;
    }>(`/registered-holders/${id}/id-card`);
  }

  // ----------------------------------------------------
  // Contract Installments & Payments
  // ----------------------------------------------------
  public async getContractInstallments(contractId?: string) {
    const q = contractId ? `?contractId=${encodeURIComponent(contractId)}` : '';
    return this.request<any[]>(`/contract-installments${q}`);
  }

  public async saveContractInstallment(inst: any) {
    return this.request<{ success: boolean; installment: any }>('/contract-installments', {
      method: 'POST',
      body: JSON.stringify(inst),
    });
  }

  public async recordInstallmentPayment(installmentId: string, payment: any) {
    return this.request<{ success: boolean; installment?: any; payment: any }>(`/contract-installments/${installmentId}/payments`, {
      method: 'POST',
      body: JSON.stringify(payment),
    });
  }

  public async reviewFinancePayment(paymentId: string, status: string, notes: string) {
    return this.request<{ success: boolean; payment: any }>(`/payments/${paymentId}/finance-review`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    });
  }

  // ----------------------------------------------------
  // Biometrics & WebAuthn / Passkeys
  // ----------------------------------------------------
  public async getBiometricDevices(userId?: string) {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.request<any[]>(`/biometrics/devices${q}`);
  }

  public async registerBiometricDevice(device: any) {
    return this.request<{ success: boolean; device: any }>('/biometrics/register', {
      method: 'POST',
      body: JSON.stringify(device),
    });
  }

  public async revokeBiometricDevice(id: string) {
    return this.request<{ success: boolean; message: string }>(`/biometrics/devices/${id}`, {
      method: 'DELETE',
    });
  }

  public async getBiometricChallenge() {
    return this.request<{ challenge: string }>('/auth/biometric-challenge', {
      method: 'POST',
    });
  }

  public async biometricLogin(credentialId: string) {
    return this.request<{ success: boolean; token?: string; user?: any; message: string }>('/auth/biometric-login', {
      method: 'POST',
      body: JSON.stringify({ credentialId }),
    });
  }
}

export const api = new ApiClient();
