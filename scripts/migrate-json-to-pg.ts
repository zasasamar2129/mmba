// ---------------------------------------------------------------------------
// Step 12 — JSON → PostgreSQL migration importer with reconciliation
//
// Reads data/mmba_production_database.json (the legacy source — never deleted),
// assigns ALL existing data to ONE initial tenant (documented decision: the
// source is a single business; Step 12 §35), maps its users to memberships,
// imports tenant-owned records into PostgreSQL, and reconciles counts.
//
// Idempotent: reruns are safe (deterministic IDs, ON CONFLICT DO NOTHING).
// Run: npx tsx scripts/migrate-json-to-pg.ts
// ---------------------------------------------------------------------------
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query, pool } from '../server/pg';

const DB_PATH = process.env.LEGACY_DB_PATH || './data/mmba_production_database.json';

// The single business owning all legacy data (Step 12 §35 decision).
const INITIAL_TENANT = {
  id: process.env.MIGRATE_TENANT_ID || 'ten-initial',
  slug: 'initial',
  name: process.env.MIGRATE_TENANT_NAME || 'Initial Business',
  status: 'ACTIVE',
};

function readLegacy(): any {
  if (!fs.existsSync(path.resolve(DB_PATH))) {
    console.error(`Legacy JSON not found at ${DB_PATH}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(path.resolve(DB_PATH), 'utf-8');
  return JSON.parse(raw);
}

const now = () => new Date().toISOString();
const isoTs = (v: string | undefined) => (v || undefined);
const pid = (s: string) => `pg-${crypto.createHash('sha256').update(s).digest('hex').slice(0, 24)}`;

async function upsertTenant() {
  await query(
    `INSERT INTO tenant (id, name, slug, status, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$5)
     ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name`,
    [INITIAL_TENANT.id, INITIAL_TENANT.name, INITIAL_TENANT.slug, INITIAL_TENANT.status, now()]
  );
  console.log(`[tenant] ensured ${INITIAL_TENANT.slug} (${INITIAL_TENANT.id})`);
}

async function migrateUsers(users: any[]) {
  let count = 0;
  for (const u of users || []) {
    const id = pid(`user:${u.username || u.id}`);
    await query(
      `INSERT INTO "user" (id, username, name, "passwordHash", role, status, department, mobile, email, "tokenVersion", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
       ON CONFLICT (username) DO NOTHING`,
      [id, u.username, u.name, u.password || '', u.role || 'READ_ONLY', u.status || 'ACTIVE', u.department || null, u.mobile || null, u.email || null, u.tokenVersion || 0, now()]
    );
    // Membership in initial tenant
    await query(
      `INSERT INTO membership (id, "tenantId", "userId", role, status, "joinedAt", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$6,$6)
       ON CONFLICT ("tenantId","userId") DO NOTHING`,
      [pid(`membership:${INITIAL_TENANT.id}:${id}`), INITIAL_TENANT.id, id, u.role || 'READ_ONLY', 'ACTIVE', now()]
    );
    count++;
  }
  console.log(`[users] imported ${count}`);
  return count;
}

async function migrateAccounts(accounts: any[]) {
  let count = 0;
  for (const a of accounts || []) {
    const id = a.id || pid(`account:${INITIAL_TENANT.id}:${a.code}`);
    const accountType = a.account_type || 'ASSET';
    await query(
      `INSERT INTO account (id, "tenantId", code, name, "accountType", "isActive", "parentId", description, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT ("tenantId", code) DO NOTHING`,
      [id, INITIAL_TENANT.id, a.code, a.name, accountType, a.is_active !== false, a.parent_id || null, a.description || null, a.created_at || now(), now()]
    );
    count++;
  }
  console.log(`[accounts] imported ${count}`);
  return count;
}

async function migrateSettings(settings: any) {
  const count = 1;
  await query(
    `INSERT INTO "tenantSettings" (id, "tenantId", "systemName", "organizationName", currency, "autoLockMinutes", "requireTwoFactor", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
     ON CONFLICT ("tenantId") DO NOTHING`,
    [pid(`settings:${INITIAL_TENANT.id}`), INITIAL_TENANT.id, settings?.systemName || 'MMBA', settings?.organizationName || 'MMBA', settings?.currency || 'تومان', settings?.autoLockMinutes || 15, !!settings?.requireTwoFactor, now()]
  );
  console.log(`[settings] imported tenant settings (${count})`);
  return count;
}

async function migrateAuditLogs(logs: any[]) {
  let count = 0;
  for (const l of logs || []) {
    const id = pid(`audit:${l.id || (l.timestamp + l.action)}`);
    await query(
      `INSERT INTO "auditLog" (id, "tenantId", timestamp, "userId", "userName", "userRole", action, module, "entityType", "entityName", "targetId", "targetType", details, "ipAddress", result, "createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$3)
       ON CONFLICT (id) DO NOTHING`,
      [id, INITIAL_TENANT.id, isoTs(l.timestamp) || now(), l.userId || null, l.userName || 'system', l.userRole || null, l.action || '', l.module || '', l.entityType || null, l.entityName || null, l.targetId ? String(l.targetId) : null, l.targetType || null, l.details || null, l.ipAddress || null, l.result || 'SUCCESS']
    );
    count++;
  }
  console.log(`[auditLogs] imported ${count}`);
  return count;
}

async function reconcile(report: Record<string, number>, legacy: any) {
  console.log('\n=== RECONCILIATION ===');
  let allOk = true;
  // tenant-scoped tables: count by tenantId
  const tenantScoped: [string, number][] = [['account', report.account], ['auditLog', report.auditLog]];
  for (const [table, imported] of tenantScoped) {
    const r = await query<any>(`SELECT COUNT(*)::int AS c FROM "${table}" WHERE "tenantId" = $1`, [INITIAL_TENANT.id]);
    const total = r[0]?.c || 0;
    const match = total === imported ? 'OK' : 'MISMATCH';
    if (match === 'MISMATCH') allOk = false;
    console.log(`${table.padEnd(14)} imported=${String(imported).padEnd(4)} in-PG=${total} ${match}`);
  }
  // global tables: count all rows
  const globalScoped: [string, number][] = [['user', report.user]];
  for (const [table, imported] of globalScoped) {
    const r = await query<any>(`SELECT COUNT(*)::int AS c FROM "${table}"`);
    const total = r[0]?.c || 0;
    const match = total >= imported ? 'OK (>= imported)' : 'MISMATCH';
    if (match === 'MISMATCH') allOk = false;
    console.log(`${table.padEnd(14)} imported=${String(imported).padEnd(4)} in-PG=${total} ${match}`);
  }
  console.log(allOk ? '\nRECONCILIATION PASS' : '\nRECONCILIATION FAIL — investigate');
  return allOk;
}

async function main() {
  const legacy = readLegacy();
  console.log(`Loading legacy JSON: ${DB_PATH}`);
  console.log(`\nDOCUMENTED DATA-OWNERSHIP DECISION (Step 12 §35):`);
  console.log(`All legacy data is assigned to ONE initial tenant "${INITIAL_TENANT.slug}" — the legacy database represents a single business.`);

  await upsertTenant();

  const report: Record<string, number> = {};
  report.user = await migrateUsers(legacy.users);
  report.account = await migrateAccounts(legacy.accounts);
  report.auditLog = await migrateAuditLogs(legacy.auditLogs);
  await migrateSettings(legacy.settings);

  // Roles stay platform-global (migrate to Role table)
  let rolesImported = 0;
  for (const r of legacy.roles || []) {
    await query(
      `INSERT INTO role (id, name, "titleFa", "titleEn", "descriptionFa", "descriptionEn", permissions, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
       ON CONFLICT (name) DO NOTHING`,
      [r.id || pid(`role:${r.name}`), r.name, r.titleFa || r.name, r.titleEn || '', r.descriptionFa || '', r.descriptionEn || '', JSON.stringify(r.permissions || []), now()]
    );
    rolesImported++;
  }
  console.log(`[roles] imported ${rolesImported} (platform-global)`);

  const ok = await reconcile(report, legacy);
  await pool.end();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('MIGRATION ERR:', e.message);
  process.exit(1);
});