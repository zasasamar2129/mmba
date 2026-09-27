// Step 12 — Provisioning + Lifecycle + Slug + Isolation unit+DB tests
// Run: npx tsx test/step12-provisioning.ts
//
// Uses real PostgreSQL via the pg pool. Sets up its own test data.
// -----------------------------------------------------------------------
import { query } from '../server/pg';
import {
  provisionTenant,
  transitionTenantStatus,
  listTenants,
  getTenant,
  listMembers,
  upsertMembership,
  removeMembership,
  ProvisioningStatus,
  validateSlug,
  normalizeSlug,
} from '../server/provisioningService';
import { normalizeHostname } from '../server/tenantContext';
import crypto from 'crypto';

const now = () => new Date().toISOString();
const uid = () => `usr-${crypto.randomUUID().slice(0, 20)}`;

let passed = 0;
let failed = 0;
function t(ok: boolean, label: string) { ok ? passed++ : failed++; console.log(ok ? `  ✓ ${label}` : `  ✗ FAIL: ${label}`); }

async function ensureUser(id: string, username: string) {
  await query(`DELETE FROM "user" WHERE username = $1 AND id <> $2`, [username, id]);
  await query(
    `INSERT INTO "user" (id, username, name, "passwordHash", role, status, "tokenVersion", "createdAt", "updatedAt")
     VALUES ($1,$2,$2,'test-hash','OWNER','ACTIVE',0,$3,$3)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, status = 'ACTIVE'`,
    [id, username, now()],
  );
}

async function ensurePlatformAdmin(userId: string) {
  await query(
    `INSERT INTO "platformAdmin" (id, "userId", "createdAt") VALUES ($1,$2,$3) ON CONFLICT ("userId") DO NOTHING`,
    [`pa-${userId}`, userId, now()],
  );
}

async function ensureBusinessCategory(key: string) {
  await query(
    `INSERT INTO "businessCategory" (id, key, name, "isActive", "sortOrder", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,true,0,$4,$4) ON CONFLICT (key) DO NOTHING`,
    [`bc-${key}`, key, key, now()],
  );
}

async function main() {
  console.log('\n=== STEP 12: PROVISIONING + LIFECYCLE + ISOLATION TESTS ===\n');

  const testUserId = uid();
  await ensureUser(testUserId, `testuser_${Date.now()}`);
  await ensurePlatformAdmin(testUserId);
  await ensureBusinessCategory('GENERAL');

  // ── 1. Slug normalization ─────────────────────────────────
  console.log('--- Slug normalization ---');
  t(normalizeSlug('ACME Corp') === 'acme-corp', 'spaces and case normalized');
  t(normalizeSlug('  test-123  ') === 'test-123', 'trim applied');
  t(normalizeSlug('a--b') === 'a-b', 'double dash collapsed');
  t(normalizeSlug('---abc---') === 'abc', 'leading/trailing dashes stripped');
  t(normalizeSlug('Test@123') === 'test-123', 'special char replaced with dash');

  // ── 2. Slug validation ────────────────────────────────────
  console.log('\n--- Slug validation ---');
  t(validateSlug('').valid === false, 'empty slug rejected');
  t(validateSlug('a').valid === false, 'single char rejected');
  t(validateSlug('www').valid === false && validateSlug('www').reason === 'SLUG_RESERVED', 'www reserved');
  t(validateSlug('admin').valid === false, 'admin reserved');
  t(validateSlug('api').valid === false, 'api reserved');
  t(validateSlug('app').valid === false, 'app reserved');
  t(validateSlug('mail').valid === false, 'mail reserved');
  t(validateSlug('support').valid === false, 'support reserved');
  t(validateSlug('static').valid === false, 'static reserved');
  t(validateSlug('assets').valid === false, 'assets reserved');
  t(validateSlug('acme').valid === true, 'acme accepted');
  t(validateSlug('my-business-123').valid === true, 'hyphenated slug accepted');
  t(validateSlug('test_underscore').valid === false, 'underscore rejected');

  // ── 3. Hostname normalization ──────────────────────────────
  console.log('\n--- Hostname normalization ---');
  t(normalizeHostname('Acme.Mmba.Example:3000') === 'acme.mmba.example', 'port stripped, lowercased');
  t(normalizeHostname('www.acme.mmba.example') === 'acme.mmba.example', 'www prefix stripped');
  t(normalizeHostname('acme.mmba.example.') === 'acme.mmba.example', 'trailing dot stripped');
  t(normalizeHostname('') === '', 'empty returns empty');
  t(normalizeHostname(undefined) === '', 'undefined returns empty');

  // ── 4. Provisioning — basic ───────────────────────────────
  console.log('\n--- Provisioning: basic creation ---');
  const slug1 = `test-prov-${Date.now()}`;
  const p1 = await provisionTenant({ name: 'Tenant 1', slug: slug1, adminUserId: testUserId });
  t(p1.tenantId.startsWith('ten-'), 'tenantId starts with ten-');
  t(p1.slug === slug1, 'slug matches');
  t(p1.status === ProvisioningStatus.ACTIVE, 'status is ACTIVE');
  t(p1.repeated === false, 'first create: repeated=false');

  const dbCheck = await query<any>('SELECT id, slug, status FROM tenant WHERE slug = $1', [slug1]);
  t(dbCheck.length === 1, 'exactly one row in DB');
  t(dbCheck[0]?.status === 'ACTIVE', 'DB status ACTIVE');

  // ── 5. Provisioning — idempotency ─────────────────────────
  console.log('\n--- Provisioning: idempotency ---');
  const p1b = await provisionTenant({ name: 'Tenant 1', slug: slug1, adminUserId: testUserId });
  t(p1b.repeated === true, 're-provision: repeated=true');
  t(p1b.tenantId === p1.tenantId, 'same tenantId on retry');
  const dbCheck2 = await query<any>('SELECT COUNT(*)::int AS c FROM tenant WHERE slug = $1', [slug1]);
  t(Number(dbCheck2[0]?.c) === 1, 'still exactly one row');

  // ── 6. Provisioning — multiple tenants ─────────────────────
  console.log('\n--- Provisioning: multiple tenants ---');
  const slug2 = `test-prov-b-${Date.now()}`;
  const p2 = await provisionTenant({ name: 'Tenant 2', slug: slug2, adminUserId: testUserId });
  t(p2.tenantId !== p1.tenantId, 'different tenantId for different slug');
  t(p2.slug === slug2, 'slug B matches');
  const allTenants = await listTenants();
  t(allTenants.length >= 2, 'listTenants returns >= 2');

  // ── 7. Tenant lifecycle ──────────────────────────────────
  console.log('\n--- Tenant lifecycle ---');
  await transitionTenantStatus(p1.tenantId, ProvisioningStatus.SUSPENDED, testUserId);
  t((await getTenant(p1.tenantId))?.status === ProvisioningStatus.SUSPENDED, 'ACTIVE → SUSPENDED');
  await transitionTenantStatus(p1.tenantId, ProvisioningStatus.ACTIVE, testUserId);
  t((await getTenant(p1.tenantId))?.status === ProvisioningStatus.ACTIVE, 'SUSPENDED → ACTIVE');
  await transitionTenantStatus(p1.tenantId, ProvisioningStatus.DEACTIVATED, testUserId);
  t((await getTenant(p1.tenantId))?.status === ProvisioningStatus.DEACTIVATED, 'ACTIVE → DEACTIVATED');
  try {
    await transitionTenantStatus(p1.tenantId, ProvisioningStatus.ACTIVE, testUserId);
    t(false, 'DEACTIVATED→ACTIVE should throw');
  } catch (e: any) {
    t(e.message.includes('INVALID_TRANSITION'), 'invalid transition rejected');
  }
  await transitionTenantStatus(p1.tenantId, ProvisioningStatus.PROVISIONING, testUserId);
  t((await getTenant(p1.tenantId))?.status === ProvisioningStatus.PROVISIONING, 'DEACTIVATED → PROVISIONING');
  await transitionTenantStatus(p1.tenantId, ProvisioningStatus.FAILED, testUserId);
  t((await getTenant(p1.tenantId))?.status === ProvisioningStatus.FAILED, 'PROVISIONING → FAILED');
  await transitionTenantStatus(p1.tenantId, ProvisioningStatus.PROVISIONING, testUserId);
  await transitionTenantStatus(p1.tenantId, ProvisioningStatus.ACTIVE, testUserId);
  t((await getTenant(p1.tenantId))?.status === ProvisioningStatus.ACTIVE, 'PROVISIONING → ACTIVE');

  // ── 8. Membership operations ─────────────────────────────
  console.log('\n--- Membership operations ---');
  const members1 = await listMembers(p1.tenantId);
  t(members1.length >= 1, 'tenant has at least one member');

  const userId2 = uid();
  await ensureUser(userId2, `tenantstaff_${Date.now()}`);
  const added = await upsertMembership(p1.tenantId, { userId: userId2, role: 'READ_ONLY', requestedBy: testUserId });
  t(added.role === 'READ_ONLY', 'add member: role=READ_ONLY');
  t((await listMembers(p1.tenantId)).length === members1.length + 1, 'member count incremented');

  const updated = await upsertMembership(p1.tenantId, { userId: userId2, role: 'SALES', requestedBy: testUserId });
  t(updated.role === 'SALES', 'update role: SALES');

  t(await removeMembership(p1.tenantId, added.id, testUserId) === true, 'remove membership succeeds');

  // Re-add for isolation test
  await upsertMembership(p1.tenantId, { userId: userId2, role: 'READ_ONLY', requestedBy: testUserId });

  // ── 9. Cross-tenant isolation ────────────────────────────
  console.log('\n--- Cross-tenant isolation ---');
  const memA = await query<any>('SELECT COUNT(*)::int AS c FROM membership WHERE "tenantId" = $1', [p1.tenantId]);
  const memB = await query<any>('SELECT COUNT(*)::int AS c FROM membership WHERE "tenantId" = $1', [p2.tenantId]);
  t(Number(memA[0]?.c) >= 2, 'tenant A has its members');
  t(Number(memB[0]?.c) >= 1, 'tenant B has at least its admin');

  const crossCheck = await query<any>(
    'SELECT COUNT(*)::int AS c FROM membership WHERE "tenantId" = $1 AND "userId" = $2',
    [p1.tenantId, testUserId],
  );
  t(Number(crossCheck[0]?.c) === 1, 'no duplicate membership for same user in same tenant');

  // ── 10. TenantDomain isolation ──────────────────────────
  console.log('\n--- TenantDomain records ---');
  const domainsA = await query<any>('SELECT COUNT(*)::int AS c FROM "tenantDomain" WHERE "tenantId" = $1', [p1.tenantId]);
  const domainsB = await query<any>('SELECT COUNT(*)::int AS c FROM "tenantDomain" WHERE "tenantId" = $1', [p2.tenantId]);
  t(Number(domainsA[0]?.c) >= 1, 'tenant A has domain');
  t(Number(domainsB[0]?.c) >= 1, 'tenant B has domain');

  const domainRowsA = await query<any>('SELECT hostname FROM "tenantDomain" WHERE "tenantId" = $1', [p1.tenantId]);
  const domainRowsB = await query<any>('SELECT hostname FROM "tenantDomain" WHERE "tenantId" = $1', [p2.tenantId]);
  t(domainRowsA[0]?.hostname !== domainRowsB[0]?.hostname, 'different hostnames per tenant');

  // ── 11. Audit log tenant scoping ────────────────────────
  console.log('\n--- Audit log tenant scoping ---');
  const auditA = await query<any>('SELECT COUNT(*)::int AS c FROM "auditLog" WHERE "tenantId" = $1', [p1.tenantId]);
  const auditB = await query<any>('SELECT COUNT(*)::int AS c FROM "auditLog" WHERE "tenantId" = $1', [p2.tenantId]);
  t(Number(auditA[0]?.c) >= 1, 'tenant A has audit entries');
  t(Number(auditB[0]?.c) >= 1, 'tenant B has audit entries');

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('TEST ERR:', e.message);
  process.exit(1);
});
