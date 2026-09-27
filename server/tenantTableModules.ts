// ---------------------------------------------------------------------------
// Step 11B-FIX — Server-owned table → Module authorization map
//
// THE single source of truth for which application module owns a generic
// tenant table. Replaces the previous behaviour where every /v2/tenants/:table
// route authorized with ModuleName.CUSTOMERS regardless of the table.
//
// Security properties (do not weaken):
//   - No permissive fallback. An unknown table resolves to null and the route
//     rejects it. It NEVER resolves to CUSTOMERS or any other default.
//   - Server-owned. The table name comes from the URL path only; the client
//     cannot select a module via query, body, or header.
//   - Deterministic. Same input → same module, one function, no per-route
//     duplication.
// ---------------------------------------------------------------------------
import { ModuleName } from '../src/types';

/**
 * Generic tenant table → owning module.
 *
 * Notes on the non-obvious entries:
 *   - account / journalEntry / journalEntryLine (accounting): there is no
 *     ACCOUNTING module in ModuleName. The accounting role (ACCOUNTING_ADMIN)
 *     is granted PAYMENTS + CHECKS, and those are the financial modules, so the
 *     ledger maps to PAYMENTS. A customer-only user is denied. If a dedicated
 *     ACCOUNTING module is ever added, these three are the entries to move.
 *   - documentShare / attachment / voiceNote: owned by DOCUMENTS / DOCUMENTS /
 *     NOTES respectively, matching the existing dedicated-route modules.
 *   - dateSuggestion / leadActivity: lead-domain activity records, so LEADS.
 *   - problemReport: INBOX is the existing module for user-submitted issues.
 *   - auditLog: AUDIT_LOGS. Note this map grants *read* of tenant-scoped audit
 *     rows to anyone with AUDIT_LOGS:VIEW; the row-level tenant predicate is
 *     enforced separately by the repository.
 */
export const TENANT_TABLE_MODULES: Readonly<Record<string, ModuleName>> = Object.freeze({
  // --- CRM core ---
  customer: ModuleName.CUSTOMERS,
  lead: ModuleName.LEADS,
  leadActivity: ModuleName.LEADS,
  interaction: ModuleName.CALLS,
  dateSuggestion: ModuleName.LEADS,

  // --- Work management ---
  task: ModuleName.TASKS,

  // --- Contracts & installments ---
  contract: ModuleName.CONTRACTS,
  contractInstallment: ModuleName.CONTRACTS,

  // --- Financial ---
  payment: ModuleName.PAYMENTS,
  checkRecord: ModuleName.CHECKS,
  account: ModuleName.PAYMENTS,
  journalEntry: ModuleName.PAYMENTS,
  journalEntryLine: ModuleName.PAYMENTS,

  // --- Inventory & service ---
  simCard: ModuleName.SIM_INVENTORY,
  repair: ModuleName.REPAIRS,
  consignment: ModuleName.CONSIGNMENTS,

  // --- Documents ---
  attachment: ModuleName.DOCUMENTS,
  documentShare: ModuleName.DOCUMENTS,
  voiceNote: ModuleName.NOTES,

  // --- Chat ---
  chatConversation: ModuleName.CHAT,
  chatMessage: ModuleName.CHAT,
  chatParticipant: ModuleName.CHAT,
  messageReaction: ModuleName.CHAT,
  chatMessageReadReceipt: ModuleName.CHAT,
  broadcast: ModuleName.CHAT_BROADCAST,
  broadcastRecipient: ModuleName.CHAT_BROADCAST,

  // --- Notifications ---
  notification: ModuleName.INBOX,
  notificationDelivery: ModuleName.INBOX,

  // --- Platform-adjacent tenant data ---
  registeredHolder: ModuleName.CUSTOMERS,
  shareableLink: ModuleName.DOCUMENTS,
  problemReport: ModuleName.INBOX,
  auditLog: ModuleName.AUDIT_LOGS,
});

/**
 * Resolve the owning module for a generic tenant table.
 * Returns null for unknown/unsupported tables — callers MUST reject.
 * Never falls back to a default module.
 */
export function getTenantTableModule(table: string): ModuleName | null {
  if (!table) return null;
  // Exact key match only. A prototype-chain hit ("constructor", "__proto__")
  // must not resolve to a module, so Object.hasOwn is required here rather
  // than a plain property access.
  if (!Object.prototype.hasOwnProperty.call(TENANT_TABLE_MODULES, table)) return null;
  return TENANT_TABLE_MODULES[table];
}

/** Tables whose delete is a soft-delete with an appended-only audit trail. */
export const APPEND_ONLY_TABLES: ReadonlySet<string> = Object.freeze(new Set(['auditLog']));

/**
 * Financial tables carry Step 5 business rules that must survive the generic
 * endpoint. Their DELETE is a status transition, never a physical/soft removal,
 * and it is refused outright for a settled record.
 */
export const FINANCIAL_TABLES: ReadonlySet<string> = Object.freeze(new Set(['payment', 'checkRecord']));

/** Payment statuses that Step 5 forbids deleting (see server/db.ts deletePayment). */
export const PROTECTED_PAYMENT_STATUSES: ReadonlySet<string> = Object.freeze(new Set(['COMPLETED', 'VERIFIED']));

/** Check statuses that Step 5 forbids deleting (see server/db.ts deleteCheck). */
export const PROTECTED_CHECK_STATUSES: ReadonlySet<string> = Object.freeze(new Set(['DEPOSITED', 'CLEARED']));

/** Returns the protected-status set for a financial table, or null if not financial. */
export function protectedStatusesFor(table: string): ReadonlySet<string> | null {
  if (table === 'payment') return PROTECTED_PAYMENT_STATUSES;
  if (table === 'checkRecord') return PROTECTED_CHECK_STATUSES;
  return null;
}
