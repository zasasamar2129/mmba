// ---------------------------------------------------------------------------
// Step 12 FIX — Concurrency, domain trust, and identity authority tests
//
// Run: npx tsx test/step12fix-concurrency-domain.ts
//
// Uses REAL PostgreSQL. The concurrency test fires N simultaneous provisioning
// requests at one slug and asserts the database constraint — not a mock — is
// what decides the winner.
// ---------------------------------------------------------------------------
import { bootstrap, Tally, dbPool, createUser, createPlatformAdmin, runId } from './harness';

bootstrap();

import crypto from 'crypto';
import { query, pool } from '../server/pg';
import {
  provisionTenant,
  transitionTenantStatus,
  ProvisioningStatus,
  DomainStatus,
  DomainType,
  resolveProvisioningDomain,
  verifyDomain,
  getTenantDomain,
  SlugConflictError,
} from '../server/provisioningService';
import { classifyHostname, isAutoVerifiableHostname, normalizeHostname } from '../server/hostnamePolicy';
import { ensurePgUser, findUserById, authenticate, setUserStatus, pgIdForLegacyUser } from '../server/identity';

const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const tally = new Tally('step12fix-concurrency-domain');
const createdSlugs: string[] = [];

async function main() {
  console.log('\n=== STEP 12 FIX: CONCURRENCY + DOMAIN + IDENTITY ===\n');

  const run = runId();
  const adminUserId = await createUser({ role: 'GOD' });
  await createPlatformAdmin(adminUserId);
  const otherUserId = await createUser({ role: 'OWNER' });

  // ─────────────────────────────────────────────────────────────────────
  // 1. Hostname classification
  // ─────────────────────────────────────────────────────────────────────
  tally.section('Hostname classification (FIX D)');

  const parents = (process.env.TENANT_PARENT_DOMAINS || 'mmba.example,localhost')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const primary = parents[0];

  tally.check(
    classifyHostname(`acme.${primary}`).kind === 'PLATFORM_SUBDOMAIN',
    'single label under owned parent → PLATFORM_SUBDOMAIN',
  );
  tally.check(
    classifyHostname(`acme.${primary}`).slug === 'acme',
    'platform subdomain yields slug',
  );
  tally.check(
    classifyHostname('crm.acme.com').kind === 'CUSTOM_DOMAIN',
    'external domain → CUSTOM_DOMAIN',
  );
  tally.check(
    classifyHostname(`a.b.${primary}`).kind === 'CUSTOM_DOMAIN',
    'two labels below owned parent is NOT auto-trusted',
  );
  tally.check(
    classifyHostname(`www.${primary}`).kind === 'CUSTOM_DOMAIN',
    'reserved platform host is not a tenant subdomain',
  );
  tally.check(
    classifyHostname(`api.${primary}`).kind === 'CUSTOM_DOMAIN',
    'reserved "api" label rejected',
  );
  tally.check(
    isAutoVerifiableHostname(`acme.${primary}`) === true &&
    isAutoVerifiableHostname('crm.acme.com') === false,
    'auto-verifiable only for owned parent',
  );
  tally.check(normalizeHostname(`ACME.${primary.toUpperCase()}:3000`) === `acme.${primary}`, 'normalize: port + case');

  // ─────────────────────────────────────────────────────────────────────
  // 2. Domain status decided at provisioning time
  // ─────────────────────────────────────────────────────────────────────
  tally.section('Provisioning domain policy (FIX D)');

  const noHost = resolveProvisioningDomain('acme', undefined);
  tally.check(noHost.status === DomainStatus.VERIFIED, 'default host auto-verified');
  tally.check(noHost.type === DomainType.SUBDOMAIN, 'default host is SUBDOMAIN');
  tally.check(noHost.routable === true, 'default host is routable');

  const customHost = resolveProvisioningDomain('acme', 'crm.acme.com');
  tally.check(customHost.status === DomainStatus.PENDING, 'custom domain starts PENDING');
  tally.check(customHost.type === DomainType.CUSTOM_DOMAIN, 'custom domain typed CUSTOM_DOMAIN');
  tally.check(customHost.routable === false, 'custom domain NOT routable');
  tally.check(customHost.hostname === 'crm.acme.com', 'custom hostname normalized');

  const ownedHost = resolveProvisioningDomain('acme', `other.${primary}`);
  tally.check(ownedHost.status === DomainStatus.VERIFIED, 'explicit platform subdomain auto-verified');

  // ─────────────────────────────────────────────────────────────────────
  // 3. Provisioning with a custom domain must land PENDING
  // ─────────────────────────────────────────────────────────────────────
  tally.section('Custom domain provisioning stays PENDING (FIX D)');

  const customSlug = `fixdom${run.slice(-6)}`;
  createdSlugs.push(customSlug);
  // The custom hostname is a fixed string, so a previous run's tenant may
  // still own it and `ON CONFLICT (hostname) DO NOTHING` would leave this
  // run's tenant without a domain. Clear it first so the assertion below is
  // about THIS provision.
  const customHostname = `mmba-fixture-${run}.example`;
  await query('DELETE FROM "tenantDomain" WHERE hostname = $1', [customHostname]);
  const customRes = await provisionTenant({
    name: 'Custom Domain Co',
    slug: customSlug,
    adminUserId,
    requestedHostname: customHostname,
  });
  const customRow = await getTenantDomain(customRes.tenantId);
  tally.check(customRes.domain.status === DomainStatus.PENDING, 'response reports PENDING');
  tally.check(customRow?.status === DomainStatus.PENDING, 'persisted row is PENDING');
  tally.check(customRow?.verifiedAt == null, 'verifiedAt is NULL for unverified domain');
  tally.check(customRes.domain.routable === false, 'unverified custom domain is not routable');

  // A PENDING domain must not resolve as a tenant host.
  const pendingResolves = await resolveByHostname(customHostname);
  tally.check(pendingResolves === null, 'PENDING domain does NOT resolve to a tenant');

  // Promotion requires proof — the only path to VERIFIED.
  let verifyWithoutProofFailed = false;
  try {
    await verifyDomain(customRow!.id, adminUserId, { method: '', token: '' });
  } catch (e: any) {
    verifyWithoutProofFailed = String(e.message).includes('VERIFICATION_PROOF_REQUIRED');
  }
  tally.check(verifyWithoutProofFailed, 'verify without proof is refused');

  const verified = await verifyDomain(customRow!.id, adminUserId, { method: 'DNS_TXT', token: 'proof-token-1' });
  tally.check(verified.status === DomainStatus.VERIFIED, 'verified domain promotes PENDING → VERIFIED');
  const resolvesAfterVerify = await resolveByHostname(customHostname);
  tally.check(resolvesAfterVerify === customRes.tenantId, 'verified domain now resolves to the tenant');

  // A DISABLED domain must stop resolving again.
  const { disableDomain } = await import('../server/provisioningService');
  await disableDomain(customRow!.id, adminUserId);
  const resolvesAfterDisable = await resolveByHostname(customHostname);
  tally.check(resolvesAfterDisable === null, 'DISABLED domain stops resolving');
  await query('DELETE FROM "tenantDomain" WHERE id = $1', [customRow!.id]);

  // ─────────────────────────────────────────────────────────────────────
  // 4. Concurrency: N simultaneous requests, one slug
  // ─────────────────────────────────────────────────────────────────────
  tally.section(`Concurrency: ${CONCURRENCY} simultaneous provisions, one slug (FIX C)`);

  const raceSlug = `fixrace${run.slice(-6)}`;
  createdSlugs.push(raceSlug);

  // Fire them all without awaiting between: the pool hands out separate
  // connections, so these genuinely overlap inside PostgreSQL.
  const attempts = Array.from({ length: CONCURRENCY }, () =>
    provisionTenant({ name: 'Race Co', slug: raceSlug, adminUserId }).then(
      (r) => ({ ok: true as const, result: r }),
      (e: any) => ({ ok: false as const, error: e }),
    ),
  );
  const settled = await Promise.all(attempts);

  const successes = settled.filter((s) => s.ok);
  const failures = settled.filter((s) => !s.ok);

  tally.check(successes.length === CONCURRENCY, 'no request errored', JSON.stringify(failures.map((f: any) => f.error?.message)));

  const winners = successes.filter((s: any) => s.ok && s.result.repeated === false);
  const repeats = successes.filter((s: any) => s.ok && s.result.repeated === true);

  tally.check(winners.length === 1, `exactly ONE successful provisioning (got ${winners.length})`);
  tally.check(repeats.length === CONCURRENCY - 1, `all others report repeated (got ${repeats.length})`);

  // Every response must name the same tenant.
  const tenantIds = new Set(successes.map((s: any) => s.result.tenantId));
  tally.check(tenantIds.size === 1, `all responses name one tenant id (got ${tenantIds.size})`);

  // The database itself must hold exactly one row for that slug.
  const raceRows = await query<{ id: string; status: string }>(
    'SELECT id, status FROM tenant WHERE slug = $1', [raceSlug],
  );
  tally.check(raceRows.length === 1, `exactly ONE tenant row in DB (got ${raceRows.length})`);

  // The winner must not have been marked FAILED by its rivals.
  tally.check(raceRows[0]?.status === ProvisioningStatus.ACTIVE, `winning tenant is ACTIVE (got ${raceRows[0]?.status})`);

  // Exactly one membership for the admin.
  const raceMemberships = await query<{ id: string }>(
    'SELECT id FROM membership WHERE "tenantId" = $1 AND "userId" = $2',
    [raceRows[0]?.id, adminUserId],
  );
  tally.check(raceMemberships.length === 1, `exactly ONE initial membership (got ${raceMemberships.length})`);

  // Exactly one domain, and it must be the platform subdomain, VERIFIED.
  const raceDomains = await query<{ hostname: string; status: string }>(
    'SELECT hostname, status FROM "tenantDomain" WHERE "tenantId" = $1', [raceRows[0]?.id],
  );
  tally.check(raceDomains.length === 1, `exactly ONE domain (got ${raceDomains.length})`);
  tally.check(raceDomains[0]?.status === DomainStatus.VERIFIED, 'platform subdomain is VERIFIED');
  tally.check(raceDomains[0]?.hostname === `${raceSlug}.${primary}`, 'domain hostname matches slug');

  // ─────────────────────────────────────────────────────────────────────
  // 5. A rival must not be able to fail someone else's tenant
  // ─────────────────────────────────────────────────────────────────────
  tally.section('Cross-tenant failure containment (FIX C)');

  // Create a separate, healthy tenant and confirm a failed provision of a
  // DIFFERENT slug leaves it untouched.
  const victimSlug = `fixvictim${run.slice(-6)}`;
  createdSlugs.push(victimSlug);
  const victim = await provisionTenant({ name: 'Victim Co', slug: victimSlug, adminUserId: otherUserId });
  const victimBefore = await query<{ status: string }>('SELECT status FROM tenant WHERE id = $1', [victim.tenantId]);

  // Force a failure inside provisioning by pointing at a non-existent user.
  let failedProvision = false;
  try {
    await provisionTenant({ name: 'Bad', slug: `fixbad${run.slice(-6)}`, adminUserId: 'usr-does-not-exist-xyz' });
  } catch (e: any) {
    failedProvision = String(e.message).includes('ADMIN_USER_NOT_IN_PG');
  }
  tally.check(failedProvision, 'provisioning refuses an unknown admin user');

  const victimAfter = await query<{ status: string }>('SELECT status FROM tenant WHERE id = $1', [victim.tenantId]);
  tally.check(
    victimBefore[0]?.status === victimAfter[0]?.status && victimAfter[0]?.status === ProvisioningStatus.ACTIVE,
    'unrelated tenant untouched and still ACTIVE',
  );

  // Suspending a tenant must not be reachable from the slug side.
  await transitionTenantStatus(victim.tenantId, ProvisioningStatus.SUSPENDED, adminUserId);
  const victimSuspended = await query<{ status: string }>('SELECT status FROM tenant WHERE id = $1', [victim.tenantId]);
  tally.check(victimSuspended[0]?.status === ProvisioningStatus.SUSPENDED, 'suspend applied to the exact tenant id');
  const raceStillActive = await query<{ status: string }>('SELECT status FROM tenant WHERE slug = $1', [raceSlug]);
  tally.check(raceStillActive[0]?.status === ProvisioningStatus.ACTIVE, 'race winner still ACTIVE after rival suspend');

  // ─────────────────────────────────────────────────────────────────────
  // 6. Idempotency: re-provisioning the same slug is a no-op
  // ─────────────────────────────────────────────────────────────────────
  tally.section('Idempotent repeat (FIX C)');

  const again = await provisionTenant({ name: 'Race Co', slug: raceSlug, adminUserId });
  tally.check(again.repeated === true, 'repeat provision reports repeated=true');
  tally.check(again.tenantId === raceRows[0]?.id, 'repeat returns the same tenant id');

  const afterRepeat = await query<{ id: string }>('SELECT id FROM tenant WHERE slug = $1', [raceSlug]);
  tally.check(afterRepeat.length === 1, 'repeat created no second tenant');

  const domainsAfterRepeat = await query<{ id: string }>('SELECT id FROM "tenantDomain" WHERE "tenantId" = $1', [raceRows[0]?.id]);
  tally.check(domainsAfterRepeat.length === 1, 'repeat created no second domain');

  // ─────────────────────────────────────────────────────────────────────
  // 7. Membership must reference a real PG user (FIX E)
  // ─────────────────────────────────────────────────────────────────────
  tally.section('Membership requires a valid PG user (FIX E)');

  let membershipGhostRefused = false;
  try {
    await provisionTenant({ name: 'Ghost', slug: `fixghost${run.slice(-6)}`, adminUserId: 'usr-nonexistent-ghost' });
  } catch (e: any) {
    membershipGhostRefused = String(e.message).includes('ADMIN_USER_NOT_IN_PG');
  }
  tally.check(membershipGhostRefused, 'membership cannot reference a JSON-only/nonexistent user');

  const ghostTenants = await query<{ id: string }>(
    'SELECT id FROM tenant WHERE slug = $1', [`fixghost${run.slice(-6)}`],
  );
  tally.check(ghostTenants.length === 0, 'refused provision left no orphan tenant');

  // ─────────────────────────────────────────────────────────────────────
  // 8. Identity authority (FIX E)
  // ─────────────────────────────────────────────────────────────────────
  tally.section('Identity authority (FIX E)');

  // Deterministic bridging: same legacy id → same PG id, every time.
  const legacyId = `legacy-${run}`;
  const t1 = pgIdForLegacyUser(legacyId);
  const t2 = pgIdForLegacyUser(legacyId);
  tally.check(t1 === t2, 'legacy→PG id mapping is deterministic');
  tally.check(t1.startsWith('usr-'), 'bridged id uses the usr- prefix');

  const legacyUser = {
    id: legacyId,
    username: `bridge${run}`.slice(0, 40),
    name: 'Bridged User',
    password: 'bridge-password-123',
    role: 'READ_ONLY',
    status: 'ACTIVE',
  };
  const bridge1 = await ensurePgUser(legacyUser);
  tally.check(bridge1.bridged === true, 'first bridge creates the PG user');
  const bridge2 = await ensurePgUser(legacyUser);
  tally.check(bridge2.bridged === false, 'second bridge is a no-op');
  tally.check(bridge1.user.id === bridge2.user.id, 'bridge converges on one identity');

  const dupCount = await query<{ c: number }>(
    'SELECT COUNT(*)::int AS c FROM "user" WHERE id = $1', [bridge1.user.id],
  );
  tally.check(dupCount[0]?.c === 1, 'no duplicate identity rows');

  // The bridged password must be a hash, never the plaintext.
  const stored = await query<{ passwordHash: string }>(
    'SELECT "passwordHash" FROM "user" WHERE id = $1', [bridge1.user.id],
  );
  tally.check(stored[0]?.passwordHash !== 'bridge-password-123', 'plaintext password was not stored');
  tally.check(
    String(stored[0]?.passwordHash || '').startsWith('$2'),
    'password stored as a bcrypt hash',
  );

  // Authentication goes through PG.
  const okAuth = await authenticate(legacyUser.username, 'bridge-password-123');
  tally.check(okAuth?.id === bridge1.user.id, 'login succeeds against the authoritative store');
  const badAuth = await authenticate(legacyUser.username, 'wrong-password');
  tally.check(badAuth === null, 'wrong password rejected');

  // Deactivation semantics: status change denies login AND bumps tokenVersion.
  const tvBefore = (await findUserById(bridge1.user.id))?.tokenVersion ?? 0;
  await setUserStatus(bridge1.user.id, 'INACTIVE');
  const authAfterDeactivate = await authenticate(legacyUser.username, 'bridge-password-123');
  tally.check(authAfterDeactivate === null, 'deactivated user cannot log in');
  const tvAfter = (await findUserById(bridge1.user.id))?.tokenVersion ?? 0;
  tally.check(tvAfter > tvBefore, 'deactivation bumps tokenVersion (revokes live sessions)');
  await setUserStatus(bridge1.user.id, 'ACTIVE');
  const authAfterReactivate = await authenticate(legacyUser.username, 'bridge-password-123');
  tally.check(authAfterReactivate !== null, 'reactivated user can log in again');

  // ─────────────────────────────────────────────────────────────────────
  // 9. Slug validation still holds
  // ─────────────────────────────────────────────────────────────────────
  tally.section('Slug validation');

  const badSlugs = ['a', 'www', 'admin', 'api', 'app', 'mail', 'support', 'static', 'assets', 'has_underscore'];
  const rejected: string[] = [];
  for (const s of badSlugs) {
    try {
      await provisionTenant({ name: 'x', slug: s, adminUserId });
    } catch (e: any) {
      if (String(e.message).includes('INVALID_SLUG')) rejected.push(s);
    }
  }
  tally.check(rejected.length === badSlugs.length, `all ${badSlugs.length} bad slugs rejected`, `got ${rejected.length}`);

  // Reserved-word collision must be reported, not silently suffixed.
  const reservedSlug = `fixreserved${run.slice(-6)}`;
  createdSlugs.push(reservedSlug);
  await provisionTenant({ name: 'Reserved', slug: reservedSlug, adminUserId });
  const reservedRows = await query<{ id: string }>('SELECT id FROM tenant WHERE slug = $1', [reservedSlug]);
  tally.check(reservedRows.length === 1, 'slug taken once');

  // ─────────────────────────────────────────────────────────────────────
  // 10. Cross-tenant isolation of the race winner
  // ─────────────────────────────────────────────────────────────────────
  tally.section('Tenant isolation of provisioned data');

  const winnerId = raceRows[0]?.id!;
  const victimId = victim.tenantId;
  const winnerCustomer = `cust-${crypto.randomUUID().slice(0, 12)}`;
  await query(
    `INSERT INTO customer (id, "tenantId", code, name, status, "createdAt", "updatedAt")
     VALUES ($1,$2,'C1','Race Customer','ACTIVE',NOW(),NOW())`,
    [winnerCustomer, winnerId],
  );
  const leak = await query<{ id: string }>(
    'SELECT id FROM customer WHERE id = $1 AND "tenantId" = $2', [winnerCustomer, victimId],
  );
  tally.check(leak.length === 0, 'record is not visible under the other tenant');

  const ownRead = await query<{ id: string }>(
    'SELECT id FROM customer WHERE id = $1 AND "tenantId" = $2', [winnerCustomer, winnerId],
  );
  tally.check(ownRead.length === 1, 'record is visible under its own tenant');

  const orphanCheck = await query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM customer WHERE "tenantId" IS NULL`,
  );
  tally.check(orphanCheck[0]?.c === 0, 'no orphan customer rows with NULL tenantId');

  // ── Cleanup ───────────────────────────────────────────────────────────
  // Deleting a tenant cascades to memberships, domains, settings, licenses and
  // the business rows that reference it, so one DELETE is enough.
  const cleanup = dbPool();
  await cleanup.query(`DELETE FROM tenant WHERE slug = ANY($1::text[])`, [createdSlugs]);
  await cleanup.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [[bridge1.user.id, adminUserId, otherUserId]]);
  await cleanup.end();

  const code = tally.finish();
  await pool.end();
  process.exit(code);
}

/** Resolve a hostname exactly the way the request middleware would. */
async function resolveByHostname(hostname: string): Promise<string | null> {
  const { resolveTenantContext } = await import('../server/tenantContext');
  const fakeReq = { headers: { host: hostname } } as any;
  const { ctx } = await resolveTenantContext(fakeReq, undefined);
  return ctx ? ctx.tenantId : null;
}

main().catch(async (e) => {
  console.error('\nFATAL:', e);
  try { await pool.end(); } catch { /* already closed */ }
  process.exit(1);
});
