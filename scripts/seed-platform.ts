// ---------------------------------------------------------------------------
// Step 11B — Platform seed (idempotent)
//
// Seeds the platform-level records the schema declares but no code path creates
// yet: BusinessCategory, Plan, Entitlement, plus the Tenant -> Plan / License /
// TenantDomain linkage for the initial tenant. Safe to re-run (ON CONFLICT
// DO NOTHING on every natural key).
//
// Run: npx tsx scripts/seed-platform.ts
// Env: DATABASE_URL (required), MIGRATE_TENANT_ID (default 'ten-initial')
// ---------------------------------------------------------------------------
import crypto from 'crypto';
import { query, pool } from '../server/pg';

const pid = (s: string) => 'pg-' + crypto.createHash('sha256').update(s).digest('hex').slice(0, 24);
const now = () => new Date().toISOString();

const TENANT_ID = process.env.MIGRATE_TENANT_ID || 'ten-initial';

const BUSINESS_CATEGORIES = [
  { key: 'GENERAL', name: 'عمومی', sortOrder: 0 },
  { key: 'RETAIL', name: 'فروشگاه', sortOrder: 1 },
  { key: 'RESTAURANT', name: 'رستوران', sortOrder: 2 },
  { key: 'SALON', name: 'سالن آرایشی', sortOrder: 3 },
  { key: 'SERVICE', name: 'خدماتی', sortOrder: 4 },
  { key: 'WHOLESALE', name: 'عمده‌فروشی', sortOrder: 5 },
  { key: 'OTHER', name: 'سایر', sortOrder: 6 },
];

const PLANS = [
  { key: 'FREE', name: 'Free', sortOrder: 0 },
  { key: 'PRO', name: 'Pro', sortOrder: 1 },
  { key: 'GROWTH', name: 'Growth', sortOrder: 2 },
  { key: 'ENTERPRISE', name: 'Enterprise', sortOrder: 3 },
];

// Plan capability matrix. FREE is deliberately read-mostly so the
// Plan -> Entitlement relationship is observable rather than uniform.
const ENTITLEMENTS: Record<string, string[][]> = {
  FREE: [['CUSTOMERS', 'VIEW'], ['LEADS', 'VIEW'], ['TASKS', 'VIEW'], ['CALLS', 'VIEW']],
  PRO: [
    ['CUSTOMERS', 'VIEW'], ['CUSTOMERS', 'CREATE'], ['CUSTOMERS', 'EDIT'],
    ['LEADS', 'VIEW'], ['LEADS', 'CREATE'], ['LEADS', 'EDIT'],
    ['CALLS', 'VIEW'], ['CALLS', 'CREATE'],
    ['TASKS', 'VIEW'], ['TASKS', 'CREATE'], ['TASKS', 'EDIT'],
    ['DOCUMENTS', 'VIEW'], ['DOCUMENTS', 'CREATE'],
    ['NOTES', 'VIEW'], ['NOTES', 'CREATE'],
  ],
  GROWTH: [
    ['CUSTOMERS', 'VIEW'], ['CUSTOMERS', 'CREATE'], ['CUSTOMERS', 'EDIT'], ['CUSTOMERS', 'ARCHIVE'],
    ['LEADS', 'VIEW'], ['LEADS', 'CREATE'], ['LEADS', 'EDIT'], ['LEADS', 'ARCHIVE'],
    ['CALLS', 'VIEW'], ['CALLS', 'CREATE'], ['CALLS', 'EDIT'],
    ['TASKS', 'VIEW'], ['TASKS', 'CREATE'], ['TASKS', 'EDIT'],
    ['CONTRACTS', 'VIEW'], ['CONTRACTS', 'CREATE'],
    ['PAYMENTS', 'VIEW'], ['PAYMENTS', 'CREATE'],
    ['CHECKS', 'VIEW'], ['CHECKS', 'CREATE'],
    ['REPORTS', 'VIEW'], ['DOCUMENTS', 'VIEW'], ['DOCUMENTS', 'CREATE'],
    ['NOTES', 'VIEW'], ['NOTES', 'CREATE'], ['CHAT', 'VIEW'], ['CHAT', 'CREATE'],
  ],
  ENTERPRISE: [
    ['CUSTOMERS', 'VIEW'], ['CUSTOMERS', 'CREATE'], ['CUSTOMERS', 'EDIT'], ['CUSTOMERS', 'ARCHIVE'], ['CUSTOMERS', 'EXPORT'],
    ['LEADS', 'VIEW'], ['LEADS', 'CREATE'], ['LEADS', 'EDIT'], ['LEADS', 'ARCHIVE'], ['LEADS', 'EXPORT'],
    ['CALLS', 'VIEW'], ['CALLS', 'CREATE'], ['CALLS', 'EDIT'], ['CALLS', 'ARCHIVE'],
    ['TASKS', 'VIEW'], ['TASKS', 'CREATE'], ['TASKS', 'EDIT'], ['TASKS', 'ARCHIVE'],
    ['CONTRACTS', 'VIEW'], ['CONTRACTS', 'CREATE'], ['CONTRACTS', 'EDIT'], ['CONTRACTS', 'FINALIZE'],
    ['PAYMENTS', 'VIEW'], ['PAYMENTS', 'CREATE'], ['PAYMENTS', 'EDIT'], ['PAYMENTS', 'VERIFY'], ['PAYMENTS', 'FINALIZE'],
    ['CHECKS', 'VIEW'], ['CHECKS', 'CREATE'], ['CHECKS', 'EDIT'], ['CHECKS', 'FINALIZE'],
    ['REPAIRS', 'VIEW'], ['REPAIRS', 'CREATE'], ['REPAIRS', 'EDIT'],
    ['SIM_INVENTORY', 'VIEW'], ['SIM_INVENTORY', 'CREATE'], ['SIM_INVENTORY', 'EDIT'],
    ['REPORTS', 'VIEW'], ['REPORTS', 'EXPORT'],
    ['USERS', 'VIEW'], ['USERS', 'EDIT'],
    ['AUDIT_LOGS', 'VIEW'], ['SETTINGS', 'VIEW'], ['SETTINGS', 'EDIT'],
    ['DOCUMENTS', 'VIEW'], ['DOCUMENTS', 'CREATE'], ['DOCUMENTS', 'ARCHIVE'],
    ['NOTES', 'VIEW'], ['NOTES', 'CREATE'], ['NOTES', 'EDIT'],
    ['CHAT', 'VIEW'], ['CHAT', 'CREATE'], ['CHAT', 'ARCHIVE'],
  ],
};

// The initial tenant is served on this hostname in local development.
const TENANT_HOSTNAME = process.env.MIGRATE_TENANT_HOSTNAME || 'initial.mmba.example';
const TENANT_PLAN = process.env.MIGRATE_TENANT_PLAN || 'PRO';

async function seedBusinessCategories() {
  for (const c of BUSINESS_CATEGORIES) {
    await query(
      `INSERT INTO "businessCategory" (id, key, name, description, "isActive", "sortOrder", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT (key) DO NOTHING`,
      [pid('bc:' + c.key), c.key, c.name, c.key, true, c.sortOrder, now()],
    );
  }
  return BUSINESS_CATEGORIES.length;
}

async function seedPlans() {
  for (const p of PLANS) {
    await query(
      `INSERT INTO plan (id, key, name, description, "isActive", "sortOrder", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT (key) DO NOTHING`,
      [pid('plan:' + p.key), p.key, p.name, p.key, true, p.sortOrder, now()],
    );
  }
  return PLANS.length;
}

async function seedEntitlements() {
  let total = 0;
  for (const p of PLANS) {
    const rows = await query<{ id: string }>('SELECT id FROM plan WHERE key = $1', [p.key]);
    if (!rows[0]) continue;
    const planId = rows[0].id;
    for (const [module, action] of ENTITLEMENTS[p.key]) {
      await query(
        `INSERT INTO entitlement (id, "planId", module, action, "limitType", "isEnabled", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT ("planId", module, action) DO NOTHING`,
        [pid('ent:' + planId + ':' + module + ':' + action), planId, module, action, 'FEATURE', true, now()],
      );
      total++;
    }
  }
  return total;
}

/** Attach the initial tenant to a plan + license + hostname. Requires the tenant row to exist. */
async function linkTenantToPlan() {
  const tenants = await query<{ id: string; slug: string }>('SELECT id, slug FROM tenant WHERE id = $1', [TENANT_ID]);
  if (!tenants[0]) {
    console.log(`[link] tenant ${TENANT_ID} not present — run scripts/migrate-json-to-pg.ts first`);
    return;
  }
  const planRows = await query<{ id: string }>('SELECT id FROM plan WHERE key = $1', [TENANT_PLAN]);
  if (!planRows[0]) {
    console.log(`[link] plan ${TENANT_PLAN} not found`);
    return;
  }
  const planId = planRows[0].id;

  await query('UPDATE tenant SET "planId" = $1, "updatedAt" = $2 WHERE id = $3', [planId, now(), TENANT_ID]);

  await query(
    `INSERT INTO license (id, "tenantId", "planId", status, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$5) ON CONFLICT ("tenantId") DO NOTHING`,
    [pid('license:' + TENANT_ID), TENANT_ID, planId, 'ACTIVE', now()],
  );

  await query(
    `INSERT INTO "tenantDomain" (id, "tenantId", hostname, type, "isPrimary", status, "verifiedAt", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$7) ON CONFLICT (hostname) DO NOTHING`,
    [pid('domain:' + TENANT_ID), TENANT_ID, TENANT_HOSTNAME, 'SUBDOMAIN', true, 'ACTIVE', now(), now()],
  );
  console.log(`[link] tenant ${TENANT_ID} → plan ${TENANT_PLAN}, license ACTIVE, hostname ${TENANT_HOSTNAME}`);
}

async function main() {
  const cats = await seedBusinessCategories();
  const plans = await seedPlans();
  const ents = await seedEntitlements();
  await linkTenantToPlan();

  const [t, p, e, l, d] = await Promise.all([
    query<{ slug: string; status: string }>('SELECT slug, status FROM tenant ORDER BY slug'),
    query<{ key: string }>('SELECT key FROM plan ORDER BY "sortOrder"'),
    query<{ c: string }>('SELECT COUNT(*)::text AS c FROM entitlement'),
    query<{ "tenantId": string; status: string }>('SELECT "tenantId", status FROM license'),
    query<{ hostname: string; type: string; status: string }>('SELECT hostname, type, status FROM "tenantDomain"'),
  ]);

  console.log('\n=== PLATFORM SEED ===');
  console.log(`businessCategory : ${cats}`);
  console.log(`plan             : ${plans} (${p.map((r) => r.key).join(', ')})`);
  console.log(`entitlement      : ${ents} inserted, ${e[0]?.c} in DB`);
  console.log(`tenants          : ${t.map((r) => `${r.slug}/${r.status}`).join(', ')}`);
  console.log(`license          : ${l.map((r) => `${r.tenantId}=${r.status}`).join(', ') || '(none)'}`);
  console.log(`tenantDomain     : ${d.map((r) => `${r.hostname}(${r.type}/${r.status})`).join(', ') || '(none)'}`);

  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error('SEED ERR:', e.message);
  process.exit(1);
});
