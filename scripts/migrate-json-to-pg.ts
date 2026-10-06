// ---------------------------------------------------------------------------
// Step 12 FIX B — Complete JSON → PostgreSQL legacy migration
//
// Reads data/mmba_production_database.json (the legacy source — never
// modified or deleted) and imports every persisted entity into the
// authoritative PostgreSQL store, then RECONCILES the result.
//
// Guarantees, each one exercised by test/step12fix-legacy-migration.ts:
//
//  §1 Complete    Every key in the legacy schema has an explicit entry in
//                 ENTITY_PLAN, classified MIGRATED / PLATFORM_GLOBAL /
//                 USER_GLOBAL / INTENTIONALLY_LEGACY. An unclassified source
//                 key aborts the run before any write.
//  §2 Ownership   tenantId is never read from the source record. It comes from
//                 the declared owner, and a source row that already claims a
//                 different tenant is a hard failure — never a silent
//                 reassignment to the default tenant.
//  §3 Idempotent  Every insert is an upsert on a deterministic id derived from
//                 the legacy id, so a second run converges instead of
//                 duplicating.
//  §4 Integrity   Parent/child order respects FK dependencies, and
//                 reconciliation fails the run on a missing, duplicated,
//                 orphaned or wrong-tenant record.
//  §5 Explicit    Nothing is claimed about a table this file does not touch.
//
// Run: npm run db:migrate:legacy
// Env: DATABASE_URL, LEGACY_DB_PATH, MIGRATE_TENANT_ID, MIGRATE_TENANT_SLUG,
//      MIGRATE_TENANT_NAME, MIGRATE_DRY_RUN=1
// ---------------------------------------------------------------------------
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query, pool } from '../server/pg';
import { ensurePgUser, pgIdForLegacyUser } from '../server/identity';

const LEGACY_PATH = process.env.LEGACY_DB_PATH || './data/mmba_production_database.json';
const DRY_RUN = process.env.MIGRATE_DRY_RUN === '1';

const TENANT = {
  id: process.env.MIGRATE_TENANT_ID || 'ten-initial',
  slug: process.env.MIGRATE_TENANT_SLUG || 'initial',
  name: process.env.MIGRATE_TENANT_NAME || 'Initial Business',
};

// ─── Classification of every legacy entity ───────────────────────────────

export type Classification =
  | 'MIGRATED'
  | 'PLATFORM_GLOBAL'
  | 'USER_GLOBAL'
  | 'INTENTIONALLY_LEGACY';

interface EntityPlan {
  legacyKey: string;
  pgTable: string | null;
  classification: Classification;
  note: string;
}

/**
 * The authoritative inventory, built from the `CentralDatabaseSchema` in
 * server/db.ts — every persisted legacy entity, not a hand-picked subset.
 */
export const ENTITY_PLAN: readonly EntityPlan[] = [
  { legacyKey: 'roles', pgTable: 'role', classification: 'PLATFORM_GLOBAL',
    note: 'Role catalog is platform-wide: one row per role name, no tenantId.' },
  { legacyKey: 'users', pgTable: 'user', classification: 'USER_GLOBAL',
    note: 'Global identities. Imported through ensurePgUser (deterministic id, hashed password), then given an ACTIVE membership in the initial tenant.' },
  { legacyKey: 'settings', pgTable: 'tenantSettings', classification: 'MIGRATED',
    note: "The legacy store held exactly one settings object; it becomes the initial tenant's TenantSettings row." },

  { legacyKey: 'accounts', pgTable: 'account', classification: 'MIGRATED', note: 'Chart of accounts.' },
  { legacyKey: 'customers', pgTable: 'customer', classification: 'MIGRATED', note: 'CRM customers.' },
  { legacyKey: 'leads', pgTable: 'lead', classification: 'MIGRATED', note: 'Sales leads.' },
  { legacyKey: 'calls', pgTable: 'interaction', classification: 'MIGRATED',
    note: 'Legacy call records map onto Interaction with interactionType=CALL. Merged with the interactions collection in one pass.' },
  { legacyKey: 'interactions', pgTable: 'interaction', classification: 'MIGRATED', note: 'All interaction types, not just calls.' },
  { legacyKey: 'voiceNotes', pgTable: 'voiceNote', classification: 'MIGRATED', note: 'Voice notes attached to customers.' },
  { legacyKey: 'tasks', pgTable: 'task', classification: 'MIGRATED', note: 'Tasks.' },
  { legacyKey: 'contracts', pgTable: 'contract', classification: 'MIGRATED', note: 'Contracts.' },
  { legacyKey: 'payments', pgTable: 'payment', classification: 'MIGRATED', note: 'Payments.' },
  { legacyKey: 'checks', pgTable: 'checkRecord', classification: 'MIGRATED', note: 'Cheques.' },
  { legacyKey: 'sims', pgTable: 'simCard', classification: 'MIGRATED', note: 'SIM inventory.' },
  { legacyKey: 'repairs', pgTable: 'repair', classification: 'MIGRATED', note: 'Repair tickets.' },
  { legacyKey: 'attachments', pgTable: 'attachment', classification: 'MIGRATED', note: 'Attachments.' },
  { legacyKey: 'journalEntries', pgTable: 'journalEntry', classification: 'MIGRATED', note: 'Accounting journal headers.' },
  { legacyKey: 'journalEntryLines', pgTable: 'journalEntryLine', classification: 'MIGRATED', note: 'Accounting journal lines; children of journalEntry, imported after it.' },
  { legacyKey: 'documentShares', pgTable: 'documentShare', classification: 'MIGRATED', note: 'Document share grants.' },
  { legacyKey: 'conversations', pgTable: 'chatConversation', classification: 'MIGRATED', note: 'Chat conversations.' },
  { legacyKey: 'chatMessages', pgTable: 'chatMessage', classification: 'MIGRATED', note: 'Chat messages; children of chatConversation, imported after it.' },
  { legacyKey: 'registeredHolders', pgTable: 'registeredHolder', classification: 'MIGRATED', note: 'Registered SIM holders.' },
  { legacyKey: 'contractInstallments', pgTable: 'contractInstallment', classification: 'MIGRATED', note: 'Contract instalments; children of contract.' },
  { legacyKey: 'notifications', pgTable: 'notification', classification: 'MIGRATED', note: 'In-app notifications.' },
  { legacyKey: 'notificationDeliveries', pgTable: 'notificationDelivery', classification: 'MIGRATED', note: 'Push delivery log; children of notification.' },
  { legacyKey: 'auditLogs', pgTable: 'auditLog', classification: 'MIGRATED', note: 'Audit trail.' },
  { legacyKey: 'dateSuggestions', pgTable: 'dateSuggestion', classification: 'MIGRATED', note: 'Follow-up date suggestions.' },
  { legacyKey: 'sharedLinks', pgTable: 'shareableLink', classification: 'MIGRATED', note: 'Shareable public links.' },
  { legacyKey: 'problemReports', pgTable: 'problemReport', classification: 'MIGRATED', note: 'User-submitted problem reports.' },
  { legacyKey: 'userNotificationDevices', pgTable: 'pushDevice', classification: 'MIGRATED',
    note: 'Push subscriptions. The PG model requires tenantId, so each device is given the initial tenant — it follows the user, who is a member of that tenant.' },

  { legacyKey: 'accountingPeriods', pgTable: null, classification: 'INTENTIONALLY_LEGACY',
    note: 'The Prisma contract declares no AccountingPeriod model, so there is no PostgreSQL table to migrate into and no tenant route that reads it. Two seed records (prd-1403, prd-1404) remain in JSON and are documented as unmigrated. Adding the model + table is the upgrade path if fiscal periods become tenant-facing.' },
  { legacyKey: 'notificationSettings', pgTable: null, classification: 'INTENTIONALLY_LEGACY',
    note: 'A single per-installation preferences object, not a per-record collection. No tenant owns it and no tenant route exposes it.' },
  { legacyKey: 'trustedBiometricDevices', pgTable: null, classification: 'INTENTIONALLY_LEGACY',
    note: 'WebAuthn credential records: device-bound secrets used only by the JSON biometric path, with no Prisma model. Biometric login resolves the user through PostgreSQL (server/identity.ts), so a credential can only ever mint a token for an ACTIVE PG identity.' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString();

/** Deterministic PG id from a legacy id — stable across runs and machines. */
export function pid(legacyTable: string, legacyId: unknown): string {
  const raw = String(legacyId ?? '');
  if (raw.startsWith('pg-')) return raw;
  return 'pg-' + crypto.createHash('sha256').update(`${legacyTable}:${raw}`).digest('hex').slice(0, 24);
}

/** Keep only defined values, so a partial legacy record cannot null a column. */
function pick(source: any, fields: Record<string, string>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [target, key] of Object.entries(fields)) {
    const v = source?.[key];
    if (v !== undefined && v !== null) out[target] = v;
  }
  return out;
}

/**
 * Columns the Prisma contract declares as Int, mapped per table.
 *
 * The legacy JSON store is untyped: journal entry numbers live there as
 * "JE-1", but the PostgreSQL column is integer. Coercion happens here so a
 * human-readable legacy number is accepted — but a genuinely non-numeric value
 * is reported rather than silently becoming 0, which would collide two
 * different entries onto the same integer.
 */
const INT_COLUMNS: Record<string, Set<string>> = {
  journalEntry: new Set(['entryNumber']),
  contractInstallment: new Set(['installmentNumber']),
  payment: new Set(['installmentNumber']),
  contract: new Set(['installmentCount']),
  interaction: new Set(['durationSeconds']),
  voiceNote: new Set(['durationSeconds']),
  lead: new Set(['interactionCount']),
  registeredHolder: new Set(['activeSimCount', 'maxCapacity', 'remainingCapacity']),
  shareableLink: new Set(['accessCount']),
  tenantSettings: new Set(['autoLockMinutes']),
  attachment: new Set(['sizeBytes']),
};

/** Derive a stable integer from a non-numeric legacy token. */
function stableIntFromToken(token: string): number {
  const hash = crypto.createHash('sha256').update(token).digest();
  return hash.readUInt32BE(0);
}

function coerceInts(table: string, row: Record<string, any>): Record<string, any> {
  const intCols = INT_COLUMNS[table];
  if (!intCols) return row;
  for (const col of intCols) {
    const v = row[col];
    if (v === undefined || v === null) continue;
    if (typeof v === 'number') continue;
    const asNumber = Number(v);
    if (Number.isInteger(asNumber)) {
      row[col] = asNumber;
      continue;
    }
    // Non-numeric but non-empty: derive a stable int rather than failing the
    // whole migration, and say so, because a silent 0 would merge records.
    console.log(`  [coerce] ${table}.${col}: ${JSON.stringify(v)} is not an integer — deriving a stable id ${stableIntFromToken(String(v))}`);
    row[col] = stableIntFromToken(String(v));
  }
  return row;
}

export class MigrationError extends Error {
  constructor(public readonly entity: string, public readonly detail: string) {
    super(`${entity}: ${detail}`);
    this.name = 'MigrationError';
  }
}

/**
 * Reject a source record that already carries a tenantId pointing somewhere
 * other than the tenant we are migrating into. Silently reassigning it would
 * be exactly the "default tenant" behaviour §5 forbids.
 */
function assertTenantOwnership(entity: string, record: any, index: number): void {
  const claimed = record?.tenantId;
  if (claimed === undefined || claimed === null) return;
  if (claimed !== TENANT.id) {
    throw new MigrationError(
      entity,
      `record[${index}] (id=${record.id}) claims tenantId=${claimed}, but this run targets ${TENANT.id}. ` +
      'Refusing to reassign ownership silently — resolve the owner explicitly before migrating.',
    );
  }
}

// ─── Counters ────────────────────────────────────────────────────────────

const counters: Array<{ entity: string; source: number; migrated: number }> = [];
function count(entity: string, source: number, migrated: number): void {
  counters.push({ entity, source, migrated });
  const mark = source === migrated ? 'OK' : 'MISMATCH';
  console.log(`  ${entity.padEnd(26)} source=${String(source).padEnd(5)} migrated=${String(migrated).padEnd(5)} ${mark}`);
}

// ─── Write queue ─────────────────────────────────────────────────────────

/**
 * Inserts are queued rather than issued inline so children can be ordered
 * after their parents in one pass. FKs stay enforced throughout — we never
 * disable referential integrity to make ordering work.
 */
const pending: Array<{ table: string; row: Record<string, any> }> = [];
function enqueue(table: string, row: Record<string, any>): void { pending.push({ table, row }); }

/**
 * Column cache per table. Queried once, then reused: the importer writes
 * hundreds of rows and re-describing the schema each time would dominate the
 * run time.
 */
const columnCache = new Map<string, Set<string>>();

async function tableColumns(table: string): Promise<Set<string>> {
  let cols = columnCache.get(table);
  if (!cols) {
    const rows = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    cols = new Set(rows.map((r) => r.column_name));
    if (cols.size === 0) throw new MigrationError(table, 'table does not exist in the database — run the schema migration first.');
    columnCache.set(table, cols);
  }
  return cols;
}

async function upsert(table: string, rawRow: Record<string, any>): Promise<void> {
  const row = coerceInts(table, rawRow);
  const available = await tableColumns(table);
  // Drop keys the table does not have. A stale field mapping should not abort a
  // whole migration, but it must not silently drop real data either — so the
  // dropped key is reported, and only OPTIONAL columns (everything except
  // id/tenantId/createdAt) are dropped at all.
  const dropped = Object.keys(row).filter((c) => !available.has(c));
  const protectedCols = new Set(['id', 'tenantId', 'createdAt']);
  const droppedProtected = dropped.filter((c) => protectedCols.has(c));
  if (droppedProtected.length > 0) {
    throw new MigrationError(table, `importer references columns the table does not have: ${droppedProtected.join(', ')}`);
  }
  const cols = Object.keys(row).filter((c) => available.has(c));
  if (dropped.length > 0) {
    console.log(`  [warn] ${table}: ignoring unknown column(s) ${dropped.join(', ')}`);
  }
  if (cols.length === 0) return;
  const updatable = cols.filter((c) => c !== 'id');
  const conflict = updatable.length > 0
    ? `DO UPDATE SET ${updatable.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')}`
    : 'DO NOTHING';
  await query(
    `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')})
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     ON CONFLICT (id) ${conflict}`,
    cols.map((c) => row[c]),
  );
}

async function flush(): Promise<void> {
  for (const { table, row } of pending) await upsert(table, row);
  pending.length = 0;
}

// ─── Steps ───────────────────────────────────────────────────────────────

async function ensureTenant(): Promise<void> {
  // By id, then by slug: a legacy run may have used a different id for the
  // same business, and we must not end up with two tenants claiming one slug.
  await query(
    `INSERT INTO tenant (id, name, slug, status, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,'ACTIVE',$4,$4)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, "updatedAt" = EXCLUDED."updatedAt"`,
    [TENANT.id, TENANT.name, TENANT.slug, nowIso()],
  );
  await query(
    `UPDATE tenant SET name = $1, "updatedAt" = $2 WHERE slug = $3 AND id <> $4`,
    [TENANT.name, nowIso(), TENANT.slug, TENANT.id],
  );
  console.log(`[tenant] ${TENANT.id} / ${TENANT.slug} ready\n`);
}

async function migrateRoles(legacy: any): Promise<void> {
  const rows: any[] = legacy.roles || [];
  let n = 0;
  for (const r of rows) {
    if (!r?.name) {
      throw new MigrationError('roles', `record[${n}] has no name and cannot be migrated.`);
    }
    enqueue('role', {
      id: r.id || pid('role', r.name),
      name: r.name,
      titleFa: r.titleFa || r.name,
      titleEn: r.titleEn ?? null,
      descriptionFa: r.descriptionFa ?? null,
      descriptionEn: r.descriptionEn ?? null,
      permissions: JSON.stringify(r.permissions || []),
      createdAt: r.createdAt || nowIso(),
      updatedAt: nowIso(),
    });
    n++;
  }
  count('roles → role (PLATFORM_GLOBAL)', rows.length, n);
}

async function migrateUsers(legacy: any): Promise<number> {
  const rows: any[] = legacy.users || [];
  const bad: string[] = [];
  let memberships = 0;

  for (const u of rows) {
    if (!u?.username) { bad.push(String(u?.id ?? '<no id>')); continue; }
    await ensurePgUser({
      id: String(u.id),
      username: u.username,
      name: u.name || u.username,
      password: u.password,
      email: u.email,
      mobile: u.mobile,
      role: u.role,
      department: u.department,
      status: u.status || 'ACTIVE',
      avatar: u.avatar,
      tokenVersion: u.tokenVersion || 0,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      lastLoginAt: u.lastLoginAt,
    });
    // An active legacy user gets an ACTIVE membership so they can actually
    // reach the tenant they belonged to. A non-active user is imported but
    // left without one — that is what "deactivated" must mean.
    if ((u.status || 'ACTIVE') === 'ACTIVE') {
      const id = pgIdForLegacyUser(String(u.id));
      await query(
        `INSERT INTO membership (id, "tenantId", "userId", role, status, "joinedAt", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,'ACTIVE',$5,$5,$5)
         ON CONFLICT ("tenantId","userId") DO UPDATE
           SET role = EXCLUDED.role, status = 'ACTIVE', "updatedAt" = EXCLUDED."updatedAt"`,
        [pid('membership', `${TENANT.id}:${id}`), TENANT.id, id, u.role || 'READ_ONLY', nowIso()],
      );
      memberships++;
    }
  }

  if (bad.length > 0) {
    throw new MigrationError('users', `${bad.length} record(s) have no username: ${bad.slice(0, 10).join(', ')}`);
  }
  count('users → user (USER_GLOBAL)', rows.length, rows.length);
  count('users → membership', rows.length, memberships);
  return memberships;
}

async function migrateSettings(legacy: any): Promise<void> {
  const s = legacy.settings || {};
  const existing = await query<{ id: string }>('SELECT id FROM "tenantSettings" WHERE "tenantId" = $1 LIMIT 1', [TENANT.id]);
  if (existing[0]) {
    count('settings → tenantSettings', 1, 1);
    return;
  }
  enqueue('tenantSettings', {
    id: pid('settings', TENANT.id),
    tenantId: TENANT.id,
    systemName: s.systemName || 'MMBA',
    organizationName: s.organizationName || 'MMBA',
    currency: s.currency || 'تومان',
    autoLockMinutes: s.autoLockMinutes ?? 15,
    requireTwoFactor: !!s.requireTwoFactor,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  count('settings → tenantSettings', 1, 1);
}

// ─── Table-driven business entities ──────────────────────────────────────

interface SimpleSpec {
  entity: string;
  /** Extra legacy keys this one importer handles, beyond `entity` itself. */
  covers?: string[];
  table: string;
  /** legacyKey, or a function producing the source array(s). */
  source: string | ((legacy: any) => any[]);
  fields: Record<string, string>;
  /** Columns with NOT NULL in PostgreSQL that the legacy record must supply. */
  required?: string[];
  /** Sort key controlling parent-before-child order. Lower runs first. */
  order: number;
  /** Columns holding JSON; normalized to a JSON string on the way in. */
  json?: string[];
  /** Constant columns applied to every row. */
  consts?: Record<string, any>;
  /** False for append-only tables that have no updatedAt column. */
  hasUpdatedAt?: boolean;
}

const SIMPLE: readonly SimpleSpec[] = [
  { entity: 'accounts', table: 'account', source: 'accounts', order: 10,
    fields: { code: 'code', name: 'name', accountType: 'account_type', isActive: 'is_active', description: 'description' },
    required: ['code', 'name'] },

  { entity: 'customers', table: 'customer', source: 'customers', order: 20,
    fields: { code: 'code', name: 'name', phone: 'phone', mobile: 'mobile', nationalId: 'national_id',
      nationalCode: 'national_code', email: 'email', company: 'company', type: 'type', source: 'source',
      city: 'city', address: 'address', category: 'category', status: 'status', notes: 'notes',
      creditLimit: 'credit_limit', assignedUserId: 'assigned_user_id', leadId: 'lead_id', jobTitle: 'job_title' },
    required: ['name'], json: ['tags'],
    consts: { status: 'ACTIVE', code: 'C-LEGACY' } },

  { entity: 'leads', table: 'lead', source: 'leads', order: 21,
    fields: { leadCode: 'lead_code', name: 'name', mobile: 'mobile', company: 'company', status: 'status',
      source: 'source', notes: 'notes', assignedUserId: 'assigned_user_id', lastContactAt: 'last_contact_at' },
    required: ['name', 'mobile'], json: ['activities'],
    consts: { status: 'NEW', leadCode: 'L-LEGACY', interactionCount: 0 } },

  // Calls and interactions share the Interaction table, so they are merged
  // into one source array and counted together. `covers` lets the plan/importer
  // cross-check below see that both legacy keys are handled by this one entry.
  { entity: 'interactions', covers: ['calls', 'interactions'], table: 'interaction', order: 30,
    source: (l) => [
      ...(l.interactions || []).map((r: any) => ({ ...r, __type: r.interactionType || r.interaction_type || 'NOTE' })),
      ...(l.calls || []).map((r: any) => ({ ...r, __type: 'CALL' })),
    ],
    fields: { customerId: 'customer_id', customerName: 'customer_name', customerMobile: 'customer_mobile',
      leadId: 'lead_id', leadCode: 'lead_code', userId: 'user_id', userName: 'user_name',
      interactionType: '__type', startedAt: 'started_at', durationSeconds: 'duration_seconds',
      subject: 'subject', customerRequest: 'customer_request', outcome: 'outcome', note: 'note',
      followUpRequired: 'follow_up_required', followUpAt: 'follow_up_at', voiceTranscript: 'voice_transcript' },
    // startedAt is NOT NULL and an interaction without a start time is not a
    // usable record, so a missing one is reported rather than back-dated.
    required: ['interactionType', 'startedAt'],
    consts: { durationSeconds: 0, followUpCompleted: false, followUpRequired: false } },

  { entity: 'voiceNotes', table: 'voiceNote', source: 'voiceNotes', order: 31,
    fields: { title: 'title', noteType: 'note_type', body: 'body', customerId: 'customer_id',
      customerName: 'customer_name', storageKey: 'storage_key', mimeType: 'mime_type', fileName: 'file_name',
      durationSeconds: 'duration_seconds', transcription: 'transcription', category: 'category',
      createdById: 'created_by_id', createdByName: 'created_by_name',
      relatedEntityType: 'related_entity_type', relatedEntityId: 'related_entity_id' },
    required: ['title', 'createdById'], json: ['tags'],
    consts: { category: 'GENERAL', durationSeconds: 0, isPinned: false, noteType: 'VOICE', createdByName: 'system' } },

  { entity: 'tasks', table: 'task', source: 'tasks', order: 32,
    fields: { title: 'title', description: 'description', customerId: 'customer_id', customerName: 'customer_name',
      leadId: 'lead_id', leadCode: 'lead_code', assignedUserId: 'assigned_user_id',
      assignedUserName: 'assigned_user_name', creatorUserId: 'creator_user_id', priority: 'priority',
      status: 'status', dueDate: 'due_date', reminderDate: 'reminder_date', completedAt: 'completed_at' },
    required: ['title'], json: ['tags', 'sharedWithUserIds'],
    consts: { priority: 'MEDIUM', status: 'PENDING' } },

  { entity: 'contracts', table: 'contract', source: 'contracts', order: 40,
    fields: { contractNumber: 'contract_number', customerId: 'customer_id', customerName: 'customer_name',
      customerNationalId: 'customer_national_id', title: 'title', type: 'type', contractType: 'contract_type',
      startDate: 'start_date', endDate: 'end_date', amount: 'amount', totalAmount: 'total_amount',
      prepaymentAmount: 'prepayment_amount', installmentCount: 'installment_count', status: 'status',
      notes: 'notes', createdById: 'created_by_id', signedAt: 'signed_at', simCardId: 'sim_card_id',
      simNumber: 'sim_number', saleType: 'sale_type' },
    // customerId and title are NOT NULL in the schema; the legacy record must
    // supply them or the row is reported rather than invented.
    required: ['contractNumber', 'customerId', 'title'],
    json: ['attachmentIds', 'terms', 'termsAndConditions', 'financialSnapshot'],
    consts: { status: 'DRAFT' } },

  { entity: 'payments', table: 'payment', source: 'payments', order: 50,
    fields: { receiptNumber: 'receipt_number', customerId: 'customer_id', customerName: 'customer_name',
      amount: 'amount', date: 'date', paymentDate: 'payment_date', description: 'description', method: 'method',
      paymentType: 'payment_type', referenceNumber: 'reference_number', status: 'status', notes: 'notes',
      contractId: 'contract_id', installmentNumber: 'installment_number', bankName: 'bank_name',
      destinationAccount: 'destination_account', financeReviewStatus: 'finance_review_status' },
    required: ['amount'], consts: { status: 'PENDING' } },

  { entity: 'checks', table: 'checkRecord', source: 'checks', order: 51,
    fields: { type: 'type', customerId: 'customer_id', customerName: 'customer_name', issuerName: 'issuer_name',
      amount: 'amount', bankName: 'bank_name', branchName: 'branch_name', checkNumber: 'check_number',
      sayadNumber: 'sayad_number', issueDate: 'issue_date', dueDate: 'due_date', status: 'status', notes: 'notes',
      depositDate: 'deposit_date', clearanceDate: 'clearance_date' },
    required: ['amount', 'customerId', 'dueDate'], json: ['attachmentIds'], consts: { status: 'PENDING' } },

  { entity: 'sims', table: 'simCard', source: 'sims', order: 52,
    fields: { phoneNumber: 'phone_number', operator: 'operator', type: 'type', status: 'status',
      category: 'category', salePrice: 'sale_price', costPrice: 'cost_price', iccid: 'iccid',
      customerId: 'customer_id', customerName: 'customer_name', ownerCustomerId: 'owner_customer_id',
      ownerCustomerName: 'owner_customer_name', notes: 'notes', shelfLocation: 'shelf_location',
      assignedUserId: 'assigned_user_id' },
    required: ['phoneNumber'],
    consts: { isRound: false, operator: 'MCI', status: 'AVAILABLE' } },

  { entity: 'repairs', table: 'repair', source: 'repairs', order: 53,
    fields: { trackingCode: 'tracking_code', ticketNumber: 'ticket_number', customerId: 'customer_id',
      customerName: 'customer_name', customerMobile: 'customer_mobile', customerPhone: 'customer_phone',
      deviceType: 'device_type', brand: 'brand', deviceModel: 'device_model', model: 'model',
      serialNumber: 'serial_number', imei: 'imei', problemDescription: 'problem_description', status: 'status',
      diagnosis: 'diagnosis', workPerformed: 'work_performed', estimatedCost: 'estimated_cost',
      finalCost: 'final_cost', completionDate: 'completion_date', deliveredDate: 'delivered_date' },
    required: ['customerId', 'trackingCode'],
    json: ['partsUsed'],
    consts: { estimatedCost: 0, problemDescription: 'تعمیرات دستگاه', status: 'RECEIVED' } },

  { entity: 'attachments', table: 'attachment', source: 'attachments', order: 60,
    fields: { customerId: 'customer_id', customerName: 'customer_name', storageKey: 'storage_key',
      fileName: 'file_name', mimeType: 'mime_type', sizeBytes: 'size_bytes', checksum: 'checksum',
      relatedEntityType: 'related_entity_type', relatedEntityId: 'related_entity_id' },
    required: ['storageKey', 'fileName', 'mimeType', 'sizeBytes'] },

  { entity: 'conversations', table: 'chatConversation', source: 'conversations', order: 70,
    fields: { type: 'type', title: 'title', priority: 'priority', status: 'status', createdById: 'created_by_id' },
    required: ['createdById'],
    consts: { type: 'DIRECT', priority: 'NORMAL', status: 'ACTIVE' } },

  { entity: 'chatMessages', table: 'chatMessage', source: 'chatMessages', order: 71,
    fields: { conversationId: 'conversation_id', senderId: 'sender_id', content: 'content',
      isRead: 'is_read', isDeleted: 'is_deleted' },
    required: ['content', 'conversationId', 'senderId'], json: ['attachments'],
    consts: { status: 'SENT', isRead: false, isDeleted: false } },

  { entity: 'registeredHolders', table: 'registeredHolder', source: 'registeredHolders', order: 80,
    fields: { fullName: 'full_name', nationalId: 'national_id', mobile: 'mobile', shebaNumber: 'sheba_number',
      activeSimCount: 'active_sim_count', maxCapacity: 'max_capacity', birthDate: 'birth_date',
      address: 'address', notes: 'notes', isActive: 'is_active' },
    required: ['fullName', 'mobile', 'nationalId'],
    consts: { isActive: true, isAtCapacity: false, isDeleted: false } },

  { entity: 'contractInstallments', table: 'contractInstallment', source: 'contractInstallments', order: 81,
    fields: { contractId: 'contract_id', customerId: 'customer_id', customerName: 'customer_name',
      installmentNumber: 'installment_number', dueDate: 'due_date', principalAmount: 'principal_amount',
      commissionAmount: 'commission_amount', totalDue: 'total_due', paidAmount: 'paid_amount',
      remainingAmount: 'remaining_amount', status: 'status', notes: 'notes' },
    required: ['contractId', 'customerId', 'installmentNumber', 'dueDate'],
    consts: { commissionAmount: 0, paidAmount: 0, principalAmount: 0, remainingAmount: 0, status: 'PENDING', totalDue: 0 } },

  { entity: 'documentShares', table: 'documentShare', source: 'documentShares', order: 90,
    fields: { documentId: 'document_id', documentType: 'document_type', sharedWith: 'shared_with',
      status: 'status', createdById: 'created_by_id' },
    required: ['documentId', 'documentType', 'createdById'],
    json: ['sharedWith'],
    consts: { status: 'ACTIVE', sharedWith: '[]' } },

  { entity: 'notifications', table: 'notification', source: 'notifications', order: 100,
    fields: { userId: 'user_id', title: 'title', message: 'message', body: 'body', category: 'category',
      priority: 'priority', read: 'read', snoozedUntil: 'snoozed_until', relatedEntityType: 'related_entity_type',
      relatedEntityId: 'related_entity_id', relatedCustomerName: 'related_customer_name' },
    required: ['userId', 'title'],
    consts: { read: false, priority: 'NORMAL' } },

  { entity: 'notificationDeliveries', table: 'notificationDelivery', source: 'notificationDeliveries', order: 101,
    fields: { notificationId: 'notification_id', userId: 'user_id', channel: 'channel', status: 'status',
      sentAt: 'sent_at', deliveredAt: 'delivered_at', failedAt: 'failed_at', errorMessage: 'error_message' },
    required: ['notificationId', 'userId'],
    consts: { channel: 'WEB_PUSH', status: 'PENDING' } },

  { entity: 'dateSuggestions', table: 'dateSuggestion', source: 'dateSuggestions', order: 110,
    fields: { customerId: 'customer_id', jalaliDate: 'jalali_date', operatorId: 'operator_id',
      operatorName: 'operator_name', activityType: 'activity_type', result: 'result',
      nextFollowUpDate: 'next_follow_up_date', taskId: 'task_id' },
    required: ['customerId', 'jalaliDate'],
    json: ['metadata'],
    hasUpdatedAt: false,
    consts: { activityType: 'CALL', operatorId: 'system', operatorName: 'سیستم' } },

  { entity: 'sharedLinks', table: 'shareableLink', source: 'sharedLinks', order: 120,
    fields: { token: 'token', relatedEntityId: 'related_entity_id', relatedEntityType: 'related_entity_type',
      accessCount: 'access_count', isRevoked: 'is_revoked', createdById: 'created_by_id' },
    required: ['token', 'createdById'],
    hasUpdatedAt: false,
    consts: { accessCount: 0, isRevoked: false, relatedEntityId: '', relatedEntityType: 'GENERAL' } },

  { entity: 'problemReports', table: 'problemReport', source: 'problemReports', order: 130,
    fields: { title: 'title', description: 'description', category: 'category', priority: 'priority',
      status: 'status', screenshotUrl: 'screenshot_url', url: 'url', userAgent: 'user_agent',
      userId: 'user_id', userName: 'user_name', userRole: 'user_role', userEmail: 'user_email',
      userMobile: 'user_mobile', adminNotes: 'admin_notes' },
    required: ['title', 'description', 'userId'],
    consts: { priority: 'NORMAL', status: 'OPEN', userName: 'کاربر' } },

  { entity: 'userNotificationDevices', table: 'pushDevice', source: 'userNotificationDevices', order: 140,
    fields: { userId: 'user_id', deviceName: 'device_name', pushEndpoint: 'endpoint', browser: 'browser',
      platform: 'platform', lastSeenAt: 'last_seen_at' },
    required: ['userId', 'pushEndpoint', 'deviceName'],
    consts: { enabled: true } },

  { entity: 'auditLogs', table: 'auditLog', source: 'auditLogs', order: 150,
    fields: { timestamp: 'timestamp', userId: 'user_id', userName: 'user_name', userRole: 'user_role',
      action: 'action', module: 'module', entityType: 'entity_type', entityName: 'entity_name',
      targetId: 'target_id', targetType: 'target_type', details: 'details', ipAddress: 'ip_address',
      fieldName: 'field_name', requestId: 'request_id', result: 'result' },
    required: ['action', 'module'],
    hasUpdatedAt: false,
    // userName is NOT NULL in the schema. A system/unattributed entry keeps a
    // literal 'system' rather than a null — the audit trail must stay
    // readable, and 'system' is an honest description of who acted.
    consts: { result: 'SUCCESS', userName: 'system' } },
];

/** Entities imported by a hand-written step rather than the SIMPLE table map. */
const EXPLICIT_IMPLEMENTED = new Set<string>(['settings', 'journalEntries', 'journalEntryLines']);

/**
 * Cross-check the declared plan against what is actually implemented.
 *
 * Without this, an entry can be classified MIGRATED in ENTITY_PLAN while no
 * code path touches it — the exact "report claims coverage the migration does
 * not have" failure this step exists to eliminate. Fail loudly at startup
 * instead of silently importing 0 rows.
 */
export function assertPlanIsImplemented(): void {
  const implemented = new Set<string>([
    ...SIMPLE.flatMap((s) => [s.entity, ...(s.covers || [])]),
    ...EXPLICIT_IMPLEMENTED,
    'roles',
    'users',
  ]);
  const claimsMigration = ENTITY_PLAN.filter((e) => e.classification !== 'INTENTIONALLY_LEGACY');
  const unbacked = claimsMigration.filter((e) => !implemented.has(e.legacyKey));
  if (unbacked.length > 0) {
    throw new MigrationError(
      'ENTITY_PLAN',
      `classified ${unbacked.map((e) => e.classification).join('/')} but no importer exists: ` +
      `${unbacked.map((e) => e.legacyKey).join(', ')}. Add a SIMPLE entry or a hand-written step.`,
    );
  }
  // And the reverse: an importer for a key the plan never mentioned.
  const planned = new Set(ENTITY_PLAN.map((e) => e.legacyKey));
  const orphanImporters = [...implemented].filter((k) => !planned.has(k));
  if (orphanImporters.length > 0) {
    throw new MigrationError('ENTITY_PLAN', `importers with no plan entry: ${orphanImporters.join(', ')}.`);
  }
}

/** journalEntryLine and journalEntry are imported explicitly: lines carry
 *  numbers rather than a string field map, and they must follow their header. */
async function migrateJournal(legacy: any): Promise<void> {
  const entries: any[] = legacy.journalEntries || [];
  const lines: any[] = legacy.journalEntryLines || [];
  const entryIds = new Map<string, string>();

  entries.forEach((e, i) => {
    assertTenantOwnership('journalEntries', e, i);
    if (!e?.entry_number) throw new MigrationError('journalEntries', `record[${i}] has no entry_number.`);
    const id = String(e.id ?? pid('journalEntries', i));
    entryIds.set(String(e.id ?? i), id);
    enqueue('journalEntry', {
      id,
      tenantId: TENANT.id,
      entryNumber: e.entry_number,
      entryDate: e.entry_date || nowIso(),
      description: e.description ?? null,
      referenceType: e.reference_type ?? null,
      referenceId: e.reference_id ?? null,
      status: e.status || 'POSTED',
      createdBy: e.created_by ?? null,
      createdAt: e.created_at || nowIso(),
      updatedAt: nowIso(),
    });
  });
  count('journalEntries → journalEntry', entries.length, entries.length);

  let migratedLines = 0;
  const orphanLines: string[] = [];
  lines.forEach((l, i) => {
    assertTenantOwnership('journalEntryLines', l, i);
    const parentRef = l?.journal_entry_id ?? l?.journalEntryId;
    const parentId = parentRef ? entryIds.get(String(parentRef)) : undefined;
    if (parentRef && !parentId) {
      // Do not invent a parent. A line pointing at a header that was not
      // migrated is reported and the run fails.
      orphanLines.push(String(l.id ?? i));
      return;
    }
    enqueue('journalEntryLine', {
      id: String(l.id ?? pid('journalEntryLines', i)),
      tenantId: TENANT.id,
      journalEntryId: parentId ?? null,
      accountId: l.account_id ?? null,
      debit: l.debit ?? 0,
      credit: l.credit ?? 0,
      description: l.description ?? null,
      createdAt: l.created_at || nowIso(),
    });
    migratedLines++;
  });
  if (orphanLines.length > 0) {
    throw new MigrationError('journalEntryLines', `${orphanLines.length} line(s) reference a header that was not migrated: ${orphanLines.slice(0, 10).join(', ')}`);
  }
  count('journalEntryLines → journalEntryLine', lines.length, migratedLines);
}

async function migrateSimple(legacy: any): Promise<void> {
  for (const spec of [...SIMPLE].sort((a, b) => a.order - b.order)) {
    const rows: any[] = typeof spec.source === 'function' ? spec.source(legacy) : (legacy[spec.source as string] || []);
    const problems: string[] = [];
    let n = 0;

    rows.forEach((rec, index) => {
      assertTenantOwnership(spec.entity, rec, index);

      const missing = (spec.required || []).filter((field) => {
        const key = spec.fields[field] || field;
        const v = rec?.[key];
        return v === undefined || v === null || v === '';
      });
      if (missing.length > 0) {
        problems.push(`${String(rec?.id ?? index)} (missing ${missing.join(', ')})`);
        return;
      }

      const mapped = pick(rec, spec.fields);
      for (const col of spec.json || []) {
        if (mapped[col] !== undefined) {
          mapped[col] = typeof mapped[col] === 'string' ? mapped[col] : JSON.stringify(mapped[col]);
        }
      }
      // consts are DEFAULTS, not overrides: a value the legacy record actually
      // supplies always wins. Spreading consts first and mapped second gives
      // exactly that, so `consts: { status: 'DRAFT' }` only applies to rows
      // that carry no status of their own.
      const row: Record<string, any> = {
        ...(spec.consts || {}),
        id: String(rec.id ?? pid(spec.entity, index)),
        tenantId: TENANT.id,
        ...mapped,
        createdAt: rec.created_at || rec.createdAt || nowIso(),
      };
      // auditLog is append-only and has no updatedAt; journalEntryLine has no
      // updatedAt either. Writing it would be a hard SQL error, so it is only
      // added when the table actually has the column.
      if (spec.hasUpdatedAt !== false) {
        row.updatedAt = rec.updated_at || rec.updatedAt || nowIso();
      }
      enqueue(spec.table, row);
      n++;
    });

    if (problems.length > 0) {
      throw new MigrationError(
        spec.entity,
        `${problems.length} record(s) could not be migrated: ${problems.slice(0, 10).join('; ')}` +
        (problems.length > 10 ? ` …and ${problems.length - 10} more` : ''),
      );
    }
    count(`${spec.entity} → ${spec.table}`, rows.length, n);
  }
}

// ─── Reconciliation ──────────────────────────────────────────────────────

interface ReconRow {
  table: string;
  source: number;
  destination: number;
  missing: number;
  duplicates: number;
  tenantMismatches: number;
}

/** Natural-key uniqueness, per table. A duplicate here is a real defect. */
const UNIQUE_KEYS: Record<string, string[]> = {
  account: ['code'],
  contract: ['contractNumber'],
  payment: ['receiptNumber'],
  checkRecord: ['checkNumber'],
  shareableLink: ['token'],
};

async function reconcile(legacy: any): Promise<boolean> {
  console.log('\n=== RECONCILIATION ===');
  const rows: ReconRow[] = [];
  let ok = true;

  for (const spec of SIMPLE) {
    const source: any[] = typeof spec.source === 'function' ? spec.source(legacy) : (legacy[spec.source as string] || []);
    const expectedIds = new Set(source.map((r, i) => String(r?.id ?? pid(spec.entity, i))));
    const ids = [...expectedIds];

    const [dest, mismatched, nullTenant, presentRows, orphanRows] = await Promise.all([
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM "${spec.table}" WHERE "tenantId" = $1`, [TENANT.id]),
      query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM "${spec.table}" WHERE id = ANY($1::text[]) AND ("tenantId" IS NULL OR "tenantId" <> $2)`,
        [ids, TENANT.id],
      ),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM "${spec.table}" WHERE "tenantId" IS NULL`),
      ids.length > 0
        ? query<{ id: string }>(`SELECT id FROM "${spec.table}" WHERE id = ANY($1::text[])`, [ids])
        : Promise.resolve([] as { id: string }[]),
      query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM "${spec.table}" t
          WHERE t."tenantId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenant tn WHERE tn.id = t."tenantId")`,
      ),
    ]);

    const present = new Set(presentRows.map((r) => r.id));
    const missing = ids.filter((id) => !present.has(id)).length;

    let duplicates = 0;
    const uniqueKey = UNIQUE_KEYS[spec.table]?.[0];
    if (uniqueKey) {
      const dup = await query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM (
           SELECT "${uniqueKey}" FROM "${spec.table}"
            WHERE "tenantId" = $1 AND "${uniqueKey}" IS NOT NULL
            GROUP BY "${uniqueKey}" HAVING COUNT(*) > 1
         ) x`,
        [TENANT.id],
      );
      duplicates = dup[0]?.c ?? 0;
    }

    const tenantMismatches = (mismatched[0]?.c ?? 0) + (nullTenant[0]?.c ?? 0) + (orphanRows[0]?.c ?? 0);
    const row: ReconRow = {
      table: spec.table,
      source: expectedIds.size,
      destination: dest[0]?.c ?? 0,
      missing,
      duplicates,
      tenantMismatches,
    };
    rows.push(row);
    const pass = missing === 0 && duplicates === 0 && tenantMismatches === 0;
    if (!pass) ok = false;
    console.log(
      `  ${row.table.padEnd(22)} source=${String(row.source).padEnd(5)} dest=${String(row.destination).padEnd(5)} ` +
      `missing=${row.missing} dup=${row.duplicates} tenantMismatch=${row.tenantMismatches} ${pass ? 'OK' : 'FAIL'}`,
    );
  }

  // Journal tables.
  const jeIds = (legacy.journalEntries || []).map((e: any, i: number) => String(e.id ?? pid('journalEntries', i)));
  const jelIds = (legacy.journalEntryLines || []).map((l: any, i: number) => String(l.id ?? pid('journalEntryLines', i)));
  for (const [table, ids] of [['journalEntry', jeIds], ['journalEntryLine', jelIds]] as const) {
    const dest = await query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM "${table}" WHERE "tenantId" = $1`, [TENANT.id]);
    const present = ids.length > 0
      ? await query<{ id: string }>(`SELECT id FROM "${table}" WHERE id = ANY($1::text[])`, [ids])
      : [];
    const have = new Set(present.map((r) => r.id));
    const missing = ids.filter((id) => !have.has(id)).length;
    if (missing > 0) ok = false;
    console.log(`  ${table.padEnd(22)} source=${String(ids.length).padEnd(5)} dest=${String(dest[0]?.c ?? 0).padEnd(5)} missing=${missing} ${missing === 0 ? 'OK' : 'FAIL'}`);
  }

  // Every journal line must point at a header that exists.
  const danglingLines = await query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM "journalEntryLine" l
      WHERE l."journalEntryId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "journalEntry" e WHERE e.id = l."journalEntryId")`,
  );
  if ((danglingLines[0]?.c ?? 0) > 0) ok = false;
  console.log(`  ${'journal line orphans'.padEnd(22)} ${danglingLines[0]?.c ?? 0} ${(danglingLines[0]?.c ?? 0) === 0 ? 'OK' : 'FAIL'}`);

  // Identity integrity (FIX E): no membership may reference a missing user.
  const userIds = (legacy.users || []).map((u: any) => pgIdForLegacyUser(String(u.id)));
  const userPresent = userIds.length > 0
    ? await query<{ id: string }>(`SELECT id FROM "user" WHERE id = ANY($1::text[])`, [userIds])
    : [];
  const haveUsers = new Set(userPresent.map((r) => r.id));
  const missingUsers = userIds.filter((id) => !haveUsers.has(id)).length;
  if (missingUsers > 0) ok = false;
  console.log(`  ${'user (global)'.padEnd(22)} source=${String(userIds.length).padEnd(5)} dest=${String(userPresent.length).padEnd(5)} missing=${missingUsers} ${missingUsers === 0 ? 'OK' : 'FAIL'}`);

  const danglingMemberships = await query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM membership m WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = m."userId")`,
  );
  const dangling = danglingMemberships[0]?.c ?? 0;
  if (dangling > 0) ok = false;
  console.log(`  ${'membership→user FK'.padEnd(22)} dangling=${dangling} ${dangling === 0 ? 'OK' : 'FAIL'}`);

  console.log(ok ? '\nRECONCILIATION PASS' : '\nRECONCILIATION FAIL');
  return ok;
}

// ─── Main ────────────────────────────────────────────────────────────────

function readLegacy(): any {
  const resolved = path.resolve(LEGACY_PATH);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Legacy JSON not found at ${LEGACY_PATH}. Set LEGACY_DB_PATH to the correct file.`);
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf-8'));
}

async function main(): Promise<void> {
  const legacy = readLegacy();
  console.log(`Legacy source : ${LEGACY_PATH}`);
  console.log(`Target tenant : ${TENANT.id} (${TENANT.slug})`);
  if (DRY_RUN) console.log('Mode          : DRY RUN — no rows written\n');

  // §1: the inventory must cover the source before a single row is written.
  const sourceKeys = Object.keys(legacy).filter(
    (k) => !['version', 'revision', 'lastUpdatedAt'].includes(k),
  );
  const planned = new Set(ENTITY_PLAN.map((e) => e.legacyKey));
  const unplanned = sourceKeys.filter((k) => !planned.has(k));
  if (unplanned.length > 0) {
    throw new MigrationError('ENTITY_PLAN', `legacy keys with no migration strategy: ${unplanned.join(', ')}. Classify each before migrating.`);
  }
  // And the plan must be backed by real importers, not just declarations.
  assertPlanIsImplemented();
  console.log(`Inventory     : ${ENTITY_PLAN.length} classified, ${sourceKeys.length} source keys, 0 unclassified\n`);

  if (DRY_RUN) {
    for (const e of ENTITY_PLAN) {
      const v = legacy[e.legacyKey];
      const n = Array.isArray(v) ? v.length : (v ? 1 : 0);
      console.log(`  ${e.legacyKey.padEnd(26)} → ${String(e.pgTable ?? '(none)').padEnd(20)} ${e.classification.padEnd(22)} n=${n}`);
    }
    console.log('\nDRY RUN complete — no database writes.');
    await pool.end();
    process.exit(0);
  }

  await ensureTenant();

  console.log('--- Platform global ---');
  await migrateRoles(legacy);
  console.log('\n--- Identity ---');
  await migrateUsers(legacy);
  console.log('\n--- Tenant-owned ---');
  await migrateSettings(legacy);
  await migrateSimple(legacy);
  await migrateJournal(legacy);
  await flush();

  const ok = await reconcile(legacy);
  await pool.end();
  process.exit(ok ? 0 : 1);
}

// Only run when executed directly, not when imported. The test suite imports
// ENTITY_PLAN and the plan/importer cross-check from here; without this guard
// importing the module would start a migration against the ambient DATABASE_URL.
const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

if (invokedDirectly || process.env.MIGRATE_FORCE_RUN === '1') {
  main().catch(async (e) => {
    if (e instanceof MigrationError) {
      console.error(`\nMIGRATION FAILED\n  entity: ${e.entity}\n  detail: ${e.detail}`);
    } else {
      console.error('\nMIGRATION FAILED:', e?.message || e);
    }
    try { await pool.end(); } catch { /* pool already closed */ }
    process.exit(1);
  });
}
