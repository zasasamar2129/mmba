// ---------------------------------------------------------------------------
// Step 12 FIX B — Legacy migration, reconciliation and idempotency tests
//
// Run: npx tsx test/step12fix-legacy-migration.ts
//
// Builds a deterministic fixture with real records in EVERY migrated entity
// class (users, tenant-owned business data, financial records, nested children,
// attachments, chat, vertical-specific records), runs the migration against a
// scratch database, and asserts:
//
//   • every record lands in the right tenant
//   • parent/child relationships survive (no orphans)
//   • a second run is a no-op (idempotency)
//   • a source record that claims a foreign tenantId aborts the run
//   • the entity inventory covers the whole legacy schema
//
// Uses REAL PostgreSQL throughout — no mocks.
// ---------------------------------------------------------------------------
import { bootstrap, Tally, runId } from './harness';

bootstrap();

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { Pool } from 'pg';
import { ENTITY_PLAN, MigrationError, assertPlanIsImplemented } from '../scripts/migrate-json-to-pg';

const tally = new Tally('step12fix-legacy-migration');
const RUN = runId();
const TENANT_ID = `ten-mig${RUN}`;

// ─── Fixture ─────────────────────────────────────────────────────────────

/**
 * A fixture with the shape the real legacy store has: snake_case keys, string
 * ids, nested child records. Two "businesses" would be ideal, but the legacy
 * store has no tenant field at all (that is the documented Step 12 §35
 * decision), so tenant assignment is asserted through the ownership guard
 * below instead.
 */
function buildFixture(): any {
  const u1 = `usr-a-${RUN}`;
  const u2 = `usr-b-${RUN}`;
  const c1 = `cus-1-${RUN}`;
  const c2 = `cus-2-${RUN}`;
  const contractId = `con-1-${RUN}`;
  const convId = `cnv-1-${RUN}`;

  return {
    version: 1,
    revision: 1,
    lastUpdatedAt: new Date().toISOString(),
    settings: { systemName: 'Fixture', organizationName: 'Fixture Co', currency: 'تومان', autoLockMinutes: 15, requireTwoFactor: false },
    roles: [
      { name: 'OWNER', titleFa: 'مالک', permissions: [{ module: 'CUSTOMERS', actions: ['VIEW'] }] },
      { name: 'READ_ONLY', titleFa: 'مشاهده', permissions: [] },
    ],
    users: [
      { id: u1, username: `owner_${RUN}`, name: 'Owner A', password: 'owner-pass-1', role: 'OWNER', status: 'ACTIVE', tokenVersion: 0 },
      { id: u2, username: `viewer_${RUN}`, name: 'Viewer B', password: 'viewer-pass-1', role: 'READ_ONLY', status: 'ACTIVE', tokenVersion: 0 },
    ],
    customers: [
      { id: c1, code: 'C1', name: 'مشتری یک', phone: '09120000001', status: 'ACTIVE', tags: ['vip'] },
      { id: c2, code: 'C2', name: 'مشتری دو', mobile: '09120000002', status: 'ACTIVE' },
    ],
    leads: [
      { id: `lead-1-${RUN}`, lead_code: 'L1', name: 'سرنخ یک', mobile: '09121111111', status: 'NEW' },
    ],
    calls: [
      { id: `call-1-${RUN}`, customer_id: c1, started_at: '2026-01-01T10:00:00.000Z', duration_seconds: 120, subject: 'تماس اول' },
    ],
    interactions: [
      { id: `int-1-${RUN}`, customer_id: c1, started_at: '2026-01-01T11:00:00.000Z', interaction_type: 'NOTE', subject: 'یادداشت', outcome: 'OK' },
    ],
    voiceNotes: [
      { id: `vn-1-${RUN}`, title: 'یادداشت صوتی', body: 'متن', customer_id: c1, created_by_id: u1, storage_key: 'k1', mime_type: 'audio/webm', file_name: 'a.webm' },
    ],
    tasks: [
      { id: `task-1-${RUN}`, title: 'تماس بعدی', customer_id: c1, priority: 'HIGH', status: 'OPEN' },
    ],
    contracts: [
      { id: contractId, contract_number: 'CT-1', customer_id: c1, title: 'قرارداد فروش', amount: 1000, status: 'DRAFT' },
    ],
    payments: [
      { id: `pay-1-${RUN}`, receipt_number: 'R-1', customer_id: c1, amount: 400, method: 'CASH', status: 'PENDING' },
    ],
    checks: [
      { id: `chk-1-${RUN}`, customer_id: c1, amount: 600, check_number: '12345', bank_name: 'بانک ملت', due_date: '2026-03-01T00:00:00.000Z', status: 'PENDING' },
    ],
    sims: [
      { id: `sim-1-${RUN}`, phone_number: '09120000009', operator: 'MCI', sale_price: 1000, cost_price: 800 },
    ],
    repairs: [
      { id: `rep-1-${RUN}`, tracking_code: 'T1', customer_id: c1, device_type: 'PHONE', brand: 'X', status: 'OPEN', problem_description: 'صفحه خراب' },
    ],
    attachments: [
      { id: `att-1-${RUN}`, customer_id: c1, storage_key: 'key/1', file_name: 'doc.pdf', mime_type: 'application/pdf', size_bytes: 1234 },
    ],
    journalEntries: [
      { id: `je-1-${RUN}`, entry_number: 'JE-1', entry_date: '2026-01-01T00:00:00.000Z', description: 'ثبت تست', status: 'POSTED' },
    ],
    journalEntryLines: [
      { id: `jel-1-${RUN}`, journal_entry_id: `je-1-${RUN}`, account_id: 'acc-101', debit: 1000, credit: 0, description: 'بدهکار' },
      { id: `jel-2-${RUN}`, journal_entry_id: `je-1-${RUN}`, account_id: 'acc-401', debit: 0, credit: 1000, description: 'بستانکار' },
    ],
    conversations: [
      { id: convId, type: 'DIRECT', title: 'گفتگو', created_by_id: u1, status: 'ACTIVE' },
    ],
    chatMessages: [
      { id: `msg-1-${RUN}`, conversation_id: convId, sender_id: u1, content: 'سلام' },
    ],
    registeredHolders: [
      { id: `rh-1-${RUN}`, full_name: 'نام دارنده', national_id: '0012345678', mobile: '09120000010', is_active: true },
    ],
    contractInstallments: [
      { id: `inst-1-${RUN}`, contract_id: contractId, customer_id: c1, installment_number: 1, due_date: '2026-02-01T00:00:00.000Z', total_due: 500, paid_amount: 0 },
    ],
    notifications: [
      { id: `ntf-1-${RUN}`, user_id: u1, title: 'اعلان', message: 'متن', category: 'SYSTEM' },
    ],
    userNotificationDevices: [
      { id: `pd-1-${RUN}`, user_id: u1, endpoint: 'https://push.example/1', device_name: 'Chrome' },
    ],
    notificationDeliveries: [
      { id: `nd-1-${RUN}`, notification_id: `ntf-1-${RUN}`, user_id: u1, channel: 'WEB_PUSH', status: 'SENT' },
    ],
    auditLogs: [
      { id: `aud-1-${RUN}`, timestamp: '2026-01-01T00:00:00.000Z', user_id: u1, user_name: 'Owner A', action: 'LOGIN', module: 'USERS', result: 'SUCCESS' },
      { id: `aud-2-${RUN}`, timestamp: '2026-01-01T00:00:01.000Z', user_id: u1, user_name: 'Owner A', action: 'SYSTEM_EVENT', module: 'SETTINGS' },
    ],
    dateSuggestions: [
      { id: `ds-1-${RUN}`, customer_id: c1, jalali_date: '1404/01/01', activity_type: 'CALL', result: 'DONE' },
    ],
    sharedLinks: [
      { id: `sl-1-${RUN}`, token: `tok-${RUN}`, created_by_id: u1, related_entity_id: c1, related_entity_type: 'CUSTOMER' },
    ],
    problemReports: [
      { id: `pr-1-${RUN}`, title: 'گزارش', description: 'شرح', user_id: u1, category: 'BUG', priority: 'LOW', status: 'OPEN' },
    ],
    documentShares: [
      { id: `dsh-1-${RUN}`, document_id: `att-1-${RUN}`, document_type: 'ATTACHMENT', created_by_id: u1, shared_with: '["u2"]', status: 'ACTIVE' },
    ],
    accounts: [
      { id: 'acc-101', code: '101', name: 'صندوق', account_type: 'ASSET', is_active: true },
      { id: 'acc-401', code: '401', name: 'درآمد', account_type: 'REVENUE', is_active: true },
    ],
    // Intentionally legacy:
    accountingPeriods: [{ id: 'prd-1403', period: '1403', status: 'OPEN' }],
    notificationSettings: { enableNotifications: true },
    trustedBiometricDevices: [],
  };
}

// ─── Scratch database ────────────────────────────────────────────────────

const BASE_URL = process.env.DATABASE_URL!;
const ADMIN_URL = BASE_URL.replace(/\/[^/?]+(\?|$)/, '/postgres$1');
const DB_NAME = `mmba_mig_${RUN}`;

async function createScratchDb(): Promise<string> {
  const admin = new Pool({ connectionString: ADMIN_URL, max: 1 });
  try { await admin.query(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`); } catch { /* first run */ }
  await admin.query(`CREATE DATABASE "${DB_NAME}"`);
  await admin.end();
  const url = BASE_URL.replace(/\/[^/?]+(\?|$)/, `/${DB_NAME}$1`);
  // Fail loudly here rather than after a silent no-op migration.
  const probe = new Pool({ connectionString: url, max: 1 });
  try { await probe.query('SELECT 1'); } finally { await probe.end(); }
  return url;
}

async function dropScratchDb(): Promise<void> {
  const admin = new Pool({ connectionString: ADMIN_URL, max: 1 });
  try { await admin.query(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`); } catch { /* already gone */ }
  await admin.end();
}

/**
 * Run a local CLI from node_modules.
 *
 * Windows needs two accommodations: the binary is a .cmd shim, and a .cmd
 * shim can only be spawned through a shell (EINVAL otherwise). `npx` is not
 * reliably resolvable from a spawned process either, so we address the shim
 * directly.
 */
function runLocalBin(name: string, args: string[], opts: { env?: NodeJS.ProcessEnv; captureStderr?: boolean } = {}): string {
  const isWindows = process.platform === 'win32';
  const bin = path.join(process.cwd(), 'node_modules', '.bin', isWindows ? `${name}.cmd` : name);
  if (!fs.existsSync(bin)) throw new Error(`Missing ${name} in node_modules/.bin — run npm ci first.`);
  // With `shell: true` (required for .cmd shims on Windows) args are
  // concatenated into a command line, so a value containing `?` — which every
  // PostgreSQL URL does — would be parsed as a shell wildcard. Quote them.
  const finalArgs = isWindows ? args.map((a) => `"${a.replace(/"/g, '\\"')}"`) : args;
  return execFileSync(bin, finalArgs, {
    encoding: 'utf-8',
    env: opts.env ?? process.env,
    shell: isWindows,
    // Prisma writes its result envelope to stderr. Inheriting keeps a failed
    // migration diagnosable; capturing is what lets a test assert on it.
    stdio: ['ignore', 'pipe', opts.captureStderr ? 'pipe' : 'inherit'],
  });
}

/** Run the canonical migration against the scratch DB. */
function runCanonicalMigration(url: string): string {
  return runLocalBin('prisma', ['db', 'migrate', '--db', url]);
}

/** Run the legacy migration as a child process, so a failure is a real exit code. */
function runLegacyMigration(url: string, fixturePath: string, env: Record<string, string> = {}): { code: number; out: string } {
  // Capture BOTH streams: the migration prints its failure explanation to
  // stderr, so reading only stdout would miss the very message a test asserts
  // on. stdio is 'pipe' here (not 'inherit') precisely so that happens.
  try {
    const out = runLocalBin('tsx', ['scripts/migrate-json-to-pg.ts'], {
      env: { ...process.env, DATABASE_URL: url, LEGACY_DB_PATH: fixturePath, MIGRATE_TENANT_ID: TENANT_ID, MIGRATE_TENANT_SLUG: 'mig', ...env },
      captureStderr: true,
    });
    return { code: 0, out };
  } catch (e: any) {
    return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n=== STEP 12 FIX B: LEGACY MIGRATION + RECONCILIATION ===\n');
  console.log(`Scratch database: ${DB_NAME}\n`);

  // ── 0. Inventory completeness ──────────────────────────────────────────
  tally.section('Entity inventory');
  const fixture = buildFixture();
  const fixtureKeys = Object.keys(fixture).filter((k) => !['version', 'revision', 'lastUpdatedAt'].includes(k));
  const planned = new Set(ENTITY_PLAN.map((e) => e.legacyKey));
  const unplanned = fixtureKeys.filter((k) => !planned.has(k));
  tally.check(unplanned.length === 0, `every fixture key is classified (${unplanned.length} missing)`, unplanned.join(', '));

  let planOk = true;
  try { assertPlanIsImplemented(); } catch (e: any) { planOk = false; }
  tally.check(planOk, 'every MIGRATED classification has a real importer');

  const intentionallyLegacy = ENTITY_PLAN.filter((e) => e.classification === 'INTENTIONALLY_LEGACY');
  tally.check(
    intentionallyLegacy.every((e) => e.note.length > 30),
    `all ${intentionallyLegacy.length} INTENTIONALLY_LEGACY entries carry a documented reason`,
  );

  // ── 1. Fresh database ──────────────────────────────────────────────────
  tally.section('Fresh database + canonical migration');
  const url = await createScratchDb();
  // Held outside the try so the finally can close it before the DROP: a
  // DROP DATABASE WITH (FORCE) against a database we still hold open kills
  // our own connections, and the resulting 57P01 drowns the real error.
  let pool: Pool | null = null;
  try {
    // (migrated below, after the pool exists)

    pool = new Pool({ connectionString: url, max: 3 });
    const db = pool;
    runCanonicalMigration(url);
    const tables = await db.query(
      "SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema = 'public'",
    );
    tally.check((tables.rows[0]?.c ?? 0) >= 46, `empty DB → ${tables.rows[0]?.c} tables created`);

    // ── 2. Migration run 1 ───────────────────────────────────────────────
    tally.section('Migration run 1');
    const fixturePath = path.join(os.tmpdir(), `mmba-fixture-${RUN}.json`);
    fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));
    try {
      const r1 = runLegacyMigration(url, fixturePath);
      tally.check(r1.code === 0, 'migration exits 0', r1.out.slice(-400));
      tally.check(r1.out.includes('RECONCILIATION PASS'), 'run 1 reconciliation passes');
      tally.check(r1.out.includes('0 unclassified'), 'run 1 reports 0 unclassified entities');
    } finally {
      fs.unlinkSync(fixturePath);
    }

    // ── 3. Every record landed in the right tenant ────────────────────────
    tally.section('Tenant ownership of every imported record');

    const TENANT_TABLES = [
      'customer', 'lead', 'interaction', 'voiceNote', 'task', 'contract', 'payment', 'checkRecord',
      'simCard', 'repair', 'attachment', 'chatConversation', 'chatMessage', 'registeredHolder',
      'contractInstallment', 'documentShare', 'notification', 'notificationDelivery', 'auditLog',
      'dateSuggestion', 'shareableLink', 'problemReport', 'pushDevice', 'account',
      'journalEntry', 'journalEntryLine', 'tenantSettings',
    ];
    for (const table of TENANT_TABLES) {
      const r = await db.query(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "tenantId" = $1)::int AS owned
           FROM "${table}"`,
        [TENANT_ID],
      );
      const row = (r.rows && r.rows[0]) || { total: 0, owned: 0 };
      // Every row in the table must belong to our tenant: this DB was created
      // fresh for this run, so there is nothing else it could belong to.
      tally.check(
        row.total > 0 && row.total === row.owned,
        `${table}: ${row.owned}/${row.total} rows in ${TENANT_ID}`,
        `total=${row.total} owned=${row.owned}`,
      );
    }

    // ── 4. Specific records, not just counts ─────────────────────────────
    tally.section('Specific records landed correctly');

    const cust = await db.query('SELECT id, name, code FROM customer WHERE "tenantId" = $1 ORDER BY id', [TENANT_ID]);
    tally.check(cust.rows.length === 2, `2 customers imported (got ${cust.rows.length})`);
    tally.check(
      cust.rows.every((c) => c.name.startsWith('مشتری')),
      'customer names preserved',
    );

    const calls = await db.query(
      `SELECT id, "interactionType" FROM interaction WHERE "tenantId" = $1 ORDER BY id`, [TENANT_ID],
    );
    tally.check(calls.rows.length === 2, `calls + interactions merged (got ${calls.rows.length})`);
    tally.check(
      calls.rows.some((c) => c.interactionType === 'CALL'),
      'legacy call mapped to interactionType=CALL',
    );
    tally.check(
      calls.rows.some((c) => c.interactionType === 'NOTE'),
      'legacy interaction kept its own type',
    );

    const msgs = await db.query('SELECT "conversationId" FROM "chatMessage" WHERE "tenantId" = $1', [TENANT_ID]);
    tally.check(msgs.rows[0]?.conversationId === fixture.conversations[0].id, 'chat message points at its conversation');

    const lines = await db.query('SELECT "journalEntryId", debit, credit FROM "journalEntryLine" WHERE "tenantId" = $1 ORDER BY id', [TENANT_ID]);
    tally.check(lines.rows.length === 2, `2 journal lines imported (got ${lines.rows.length})`);
    tally.check(
      lines.rows.every((l) => l.journalEntryId === fixture.journalEntries[0].id),
      'every journal line points at its header',
    );
    const debitSum = lines.rows.reduce((s, l) => s + Number(l.debit || 0), 0);
    const creditSum = lines.rows.reduce((s, l) => s + Number(l.credit || 0), 0);
    tally.check(debitSum === creditSum, `journal entry balances (D=${debitSum} C=${creditSum})`);

    // ── 5. No orphans ────────────────────────────────────────────────────
    tally.section('Referential integrity');
    // Each child declares its own FK column: `membership.userId` and
    // `chatMessage.senderId` both point at `user`, and the column names differ.
    const orphanChecks: Array<{ child: string; fk: string; parent: string }> = [
      { child: 'journalEntryLine', fk: 'journalEntryId', parent: 'journalEntry' },
      { child: 'chatMessage', fk: 'conversationId', parent: 'chatConversation' },
      { child: 'contractInstallment', fk: 'contractId', parent: 'contract' },
      { child: 'notificationDelivery', fk: 'notificationId', parent: 'notification' },
    ];
    for (const { child, fk, parent } of orphanChecks) {
      const r = await db.query(
        `SELECT COUNT(*)::int AS c FROM "${child}" ch
          WHERE ch."tenantId" = $1
            AND NOT EXISTS (SELECT 1 FROM "${parent}" p WHERE p.id = ch."${fk}")`,
        [TENANT_ID],
      );
      const count = r.rows[0]?.c ?? -1;
      tally.check(count === 0, `no orphaned ${child} → ${parent}.${fk}`, `count=${count}`);
    }

    // Membership references a user globally (membership has no tenantId of its
    // own in this check — it is joined to its tenant instead).
    const danglingMembership = await db.query(
      `SELECT COUNT(*)::int AS c FROM membership m
        WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = m."userId")`,
    );
    tally.check(
      danglingMembership.rows[0]?.c === 0,
      'no membership references a missing user',
      `count=${danglingMembership.rows[0]?.c}`,
    );

    // ── 6. Identity bridging ─────────────────────────────────────────────
    tally.section('Identity bridging');
    const users = await db.query('SELECT id, username FROM "user" ORDER BY id');
    tally.check(users.rows.length === 2, `2 users bridged (got ${users.rows.length})`);
    const pw = await db.query('SELECT "passwordHash" FROM "user" ORDER BY id LIMIT 1');
    tally.check(
      String(pw.rows[0]?.passwordHash || '').startsWith('$2'),
      'legacy plaintext password was hashed on the way in',
    );

    // ── 7. Idempotency: run 2 and run 3 ───────────────────────────────────
    tally.section('Idempotency (repeat runs)');
    const snapshot = async (): Promise<Record<string, number>> => {
      const out: Record<string, number> = {};
      for (const t of [...TENANT_TABLES, 'user', 'membership', 'role', 'tenant']) {
        const r = await db.query(`SELECT COUNT(*)::int AS c FROM "${t}"`);
        out[t] = r.rows[0]?.c ?? -1;
      }
      return out;
    };
    const before = await snapshot();

    const fixturePath2 = path.join(os.tmpdir(), `mmba-fixture2-${RUN}.json`);
    fs.writeFileSync(fixturePath2, JSON.stringify(fixture, null, 2));
    try {
      const r2 = runLegacyMigration(url, fixturePath2);
      tally.check(r2.code === 0, 'run 2 exits 0', r2.out.slice(-300));
      const after = await snapshot();
      const changed = Object.keys(before).filter((k) => before[k] !== after[k]);
      tally.check(changed.length === 0, `run 2 changed nothing (${changed.length} tables differ)`, changed.map((k) => `${k}: ${before[k]}→${after[k]}`).join(', '));

      const r3 = runLegacyMigration(url, fixturePath2);
      tally.check(r3.code === 0, 'run 3 exits 0');
      const after3 = await snapshot();
      const changed3 = Object.keys(after).filter((k) => after[k] !== after3[k]);
      tally.check(changed3.length === 0, `run 3 changed nothing (${changed3.length} tables differ)`);
      tally.check(r3.out.includes('RECONCILIATION PASS'), 'run 3 reconciliation passes');
    } finally {
      fs.unlinkSync(fixturePath2);
    }

    // ── 8. Ownership guard: a foreign tenantId must abort the run ─────────
    tally.section('Ownership guard (§5: no silent default tenant)');
    const hostile = buildFixture();
    hostile.customers[0].tenantId = 'ten-somebody-else';
    const hostilePath = path.join(os.tmpdir(), `mmba-hostile-${RUN}.json`);
    fs.writeFileSync(hostilePath, JSON.stringify(hostile, null, 2));
    try {
      const rh = runLegacyMigration(url, hostilePath);
      tally.check(rh.code !== 0, 'migration aborts on a foreign tenantId');
      tally.check(
        rh.out.includes('Refusing to reassign ownership silently'),
        'failure explains why',
        rh.out.slice(-200),
      );
    } finally {
      fs.unlinkSync(hostilePath);
    }

    // ── 9. Unmigratable record must abort, not be dropped ────────────────
    tally.section('Missing required field aborts the run');
    const broken = buildFixture();
    delete broken.customers[0].name; // customer.name is NOT NULL
    const brokenPath = path.join(os.tmpdir(), `mmba-broken-${RUN}.json`);
    fs.writeFileSync(brokenPath, JSON.stringify(broken, null, 2));
    try {
      const rb = runLegacyMigration(url, brokenPath);
      tally.check(rb.code !== 0, 'migration aborts when a required field is missing');
      tally.check(rb.out.includes('could not be migrated'), 'failure names the entity');
    } finally {
      fs.unlinkSync(brokenPath);
    }

    await db.end();
    pool = null;
  } finally {
    if (pool) await pool.end().catch(() => {});
    await dropScratchDb();
  }

  const code = tally.finish();
  process.exit(code);
}

main().catch(async (e) => {
  console.error('\nFATAL:', e);
  await dropScratchDb().catch(() => {});
  process.exit(1);
});
