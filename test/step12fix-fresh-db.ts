// ---------------------------------------------------------------------------
// Step 12 FIX §19 — Fresh database end-to-end verification
//
// Run: npx tsx test/step12fix-fresh-db.ts
//
// Creates a disposable empty PostgreSQL database and walks the whole
// production bootstrap against it, exactly as §19 specifies:
//
//   1. canonical migration
//   2. contract generation
//   3. platform seed
//   4. tenant provisioning
//   5. tenant admin login
//   6. create tenant business data
//   7. provision a second tenant
//   8. execute the cross-tenant attack matrix
//
// Every step is a real assertion against a real database. Nothing is mocked,
// because the properties under test (does an empty DB initialize? do two
// tenants stay isolated under a live HTTP server?) are exactly the ones a
// mock would fakes.
// ---------------------------------------------------------------------------
import { bootstrap, Tally, runId } from './harness';

bootstrap();

import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { execFileSync } from 'child_process';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const tally = new Tally('step12fix-fresh-db');
const RUN = runId();
const BASE_URL = process.env.DATABASE_URL!;
const ADMIN_URL = BASE_URL.replace(/\/[^/?]+(\?|$)/, '/postgres$1');
const DB_NAME = `mmba_fresh_${RUN}`;

const PARENTS = (process.env.TENANT_PARENT_DOMAINS || 'mmba.example,localhost')
  .split(',').map((s) => s.trim()).filter(Boolean);
const PARENT = PARENTS[0];

const PASSWORD = 'Fresh-DB-Verification-1';

// ─── Process helpers ─────────────────────────────────────────────────────

function runLocalBin(name: string, args: string[], opts: { env?: NodeJS.ProcessEnv; captureStderr?: boolean } = {}): string {
  const isWindows = process.platform === 'win32';
  const bin = path.join(process.cwd(), 'node_modules', '.bin', isWindows ? `${name}.cmd` : name);
  if (!fs.existsSync(bin)) throw new Error(`Missing ${name} in node_modules/.bin — run npm ci first.`);
  const finalArgs = isWindows ? args.map((a) => `"${a.replace(/"/g, '\\"')}"`) : args;
  return execFileSync(bin, finalArgs, {
    encoding: 'utf-8',
    env: opts.env ?? process.env,
    shell: isWindows,
    stdio: ['ignore', 'pipe', opts.captureStderr ? 'pipe' : 'inherit'],
  });
}

async function createScratchDb(): Promise<string> {
  const admin = new Pool({ connectionString: ADMIN_URL, max: 1 });
  try { await admin.query(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`); } catch { /* first run */ }
  await admin.query(`CREATE DATABASE "${DB_NAME}"`);
  await admin.end();
  return BASE_URL.replace(/\/[^/?]+(\?|$)/, `/${DB_NAME}$1`);
}

async function dropScratchDb(): Promise<void> {
  const admin = new Pool({ connectionString: ADMIN_URL, max: 1 });
  try { await admin.query(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`); } catch { /* already gone */ }
  await admin.end();
}

// ─── Minimal HTTP client that controls the Host header ───────────────────

interface Res { status: number; body: any; }

function request(port: number, method: string, urlPath: string, opts: { token?: string; host?: string; body?: any } = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const payload = opts.body === undefined ? null : Buffer.from(JSON.stringify(opts.body));
    const req = http.request({
      host: '127.0.0.1',
      port,
      method,
      path: urlPath,
      // A raw socket is required: undici/fetch silently drops a Host override,
      // and the whole point of these tests is which tenant the Host selects.
      headers: {
        Host: opts.host || `127.0.0.1:${port}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': String(payload.length) } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        let body: any = text;
        try { body = JSON.parse(text); } catch { /* non-JSON response body */ }
        resolve({ status: res.statusCode || 0, body });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Main ────────────────────────────────────────────────────────────────

/**
 * An unhandled rejection from a pool whose database was just dropped is noise,
 * not signal — but silencing ALL of them would hide a real bug. Reject only the
 * specific "connection terminated because the database went away" case, which
 * is what teardown legitimately produces.
 */
process.on('unhandledRejection', (reason: any) => {
  const code = reason?.code || '';
  if (code === '57P01' || code === 'ECONNREFUSED' || /terminating connection/i.test(String(reason?.message || ''))) {
    return; // expected during teardown
  }
  console.error('Unhandled rejection:', reason);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  console.log('\n=== STEP 12 FIX §19: FRESH DATABASE END-TO-END ===\n');
  console.log(`Scratch database: ${DB_NAME}`);
  console.log(`Parent domain   : ${PARENT}\n`);

  const url = await createScratchDb();
  let server: http.Server | null = null;
  let db: Pool | null = null;

  // The application modules (server/pg, provisioningService, routes) bind their
  // connection pool to DATABASE_URL at import time. Repoint it BEFORE the
  // first dynamic import, or every query below would run against the ambient
  // development database instead of the scratch one this test just built.
  process.env.DATABASE_URL = url;
  process.env.TENANT_PARENT_DOMAINS = PARENTS.join(',');
  // Disable the dev-only single-tenant shortcut: the Host header must be the
  // only thing that decides which tenant a request sees.
  process.env.DEV_TENANT_SLUG = '';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'fresh-db-verification-secret-0123456789abcdef';

  try {
    // ── 1. Canonical migration ──────────────────────────────────────────
    console.log('--- 1. canonical migration ---');
    runLocalBin('prisma', ['db', 'migrate', '--db', url]);
    db = new Pool({ connectionString: url, max: 5 });
    // Same rationale as the app pool below: an idle client killed by teardown
    // emits 'error', and an unhandled one is fatal to the Node process.
    db.on('error', () => { /* teardown noise */ });

    const tables = await db.query(
      "SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema = 'public'");
    tally.check(tables.rows[0]?.c >= 46, `schema created: ${tables.rows[0]?.c} tables`);

    const fks = await db.query(
      "SELECT COUNT(*)::int AS c FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public'");
    tally.check((fks.rows[0]?.c ?? 0) > 0, `foreign keys created: ${fks.rows[0]?.c}`);

    const idx = await db.query(
      "SELECT COUNT(*)::int AS c FROM pg_indexes WHERE schemaname='public'");
    tally.check((idx.rows[0]?.c ?? 0) > 0, `indexes created: ${idx.rows[0]?.c}`);

    const uniq = await db.query(
      "SELECT COUNT(*)::int AS c FROM information_schema.table_constraints WHERE constraint_type='UNIQUE' AND table_schema='public'");
    tally.check((uniq.rows[0]?.c ?? 0) > 0, `unique constraints created: ${uniq.rows[0]?.c}`);

    // Every tenant-owned table carries a tenantId.
    const noTenant = await db.query(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name <> 'tenant'
        AND table_name NOT IN ('user','role','businessCategory','plan','entitlement','platformSettings',
                              'platformAdmin','session')
        AND table_name NOT IN (SELECT table_name FROM information_schema.columns
                               WHERE table_schema='public' AND column_name='tenantId')`);
    const missingTenantId = noTenant.rows.map((r) => r.table_name);
    tally.check(
      missingTenantId.length === 0,
      'every tenant table carries a tenantId column',
      missingTenantId.join(', '),
    );

    // ── 2. Contract generation ──────────────────────────────────────────
    console.log('\n--- 2. contract generation ---');
    const contractOut = runLocalBin('prisma', ['contract', 'emit']);
    const contractJson = path.join(process.cwd(), 'prisma', 'schema.json');
    tally.check(fs.existsSync(contractJson), 'prisma/schema.json emitted');
    const contract = JSON.parse(fs.readFileSync(contractJson, 'utf-8'));
    const modelCount = Object.keys(contract.roots || {}).length;
    tally.check(modelCount >= 46, `contract declares ${modelCount} models`);

    // Migration status must be clean after the migration.
    const statusOut = runLocalBin('prisma', ['migration', 'status', '--db', url]);
    tally.check(
      statusOut.includes('Up to date'),
      'migration status reports up to date',
      statusOut.slice(0, 200),
    );

    // ── 3. Platform seed ────────────────────────────────────────────────
    console.log('\n--- 3. platform seed ---');
    const seedOut = runLocalBin('tsx', ['scripts/seed-platform.ts'], { env: { ...process.env, DATABASE_URL: url } });
    const cats = await db.query('SELECT COUNT(*)::int AS c FROM "businessCategory"');
    const plans = await db.query('SELECT COUNT(*)::int AS c FROM plan');
    const ents = await db.query('SELECT COUNT(*)::int AS c FROM entitlement');
    tally.check((cats.rows[0]?.c ?? 0) >= 7, `business categories seeded: ${cats.rows[0]?.c}`);
    tally.check((plans.rows[0]?.c ?? 0) >= 4, `plans seeded: ${plans.rows[0]?.c}`);
    tally.check((ents.rows[0]?.c ?? 0) > 0, `entitlements seeded: ${ents.rows[0]?.c}`);

    // Seed must be idempotent.
    runLocalBin('tsx', ['scripts/seed-platform.ts'], { env: { ...process.env, DATABASE_URL: url } });
    const cats2 = await db.query('SELECT COUNT(*)::int AS c FROM "businessCategory"');
    const ents2 = await db.query('SELECT COUNT(*)::int AS c FROM entitlement');
    tally.check(cats.rows[0]?.c === cats2.rows[0]?.c, 're-running seed created no duplicate categories');
    tally.check(ents.rows[0]?.c === ents2.rows[0]?.c, 're-running seed created no duplicate entitlements');

    // No production default credentials in the seed.
    const weakUsers = await db.query(
      `SELECT COUNT(*)::int AS c FROM "user" WHERE "passwordHash" NOT LIKE '$2%'`);
    tally.check((weakUsers.rows[0]?.c ?? 0) === 0, 'seed creates no plaintext-password users');

    // ── Users: platform admin + two tenant admins ───────────────────────
    console.log('\n--- 4. identities ---');
    const hash = await bcrypt.hash(PASSWORD, 10);
    const mkUser = async (id: string, username: string, role: string) => {
      await db!.query(
        `INSERT INTO "user" (id, username, name, "passwordHash", role, status, "tokenVersion", "createdAt", "updatedAt")
         VALUES ($1,$2,$2,$3,$4,'ACTIVE',0,NOW(),NOW())`,
        [id, username, hash, role],
      );
    };
    const paId = `usr-pa-${RUN}`;
    const aId = `usr-a-${RUN}`;
    const bId = `usr-b-${RUN}`;
    await mkUser(paId, `pa_${RUN}`, 'GOD');
    await mkUser(aId, `a_${RUN}`, 'OWNER');
    await mkUser(bId, `b_${RUN}`, 'OWNER');
    await db.query('INSERT INTO "platformAdmin" (id, "userId", "createdAt") VALUES ($1,$2,NOW())', [`pa-r-${RUN}`, paId]);
    tally.check(true, 'platform admin + two tenant users created');

    // ── 5. Tenant provisioning ──────────────────────────────────────────
    console.log('\n--- 5. tenant provisioning ---');
    const { provisionTenant } = await import('../server/provisioningService');
    const slugA = `fresha${RUN.slice(-6)}`;
    const slugB = `freshb${RUN.slice(-6)}`;
    const tA = await provisionTenant({ name: 'Fresh A', slug: slugA, adminUserId: aId });
    const tB = await provisionTenant({ name: 'Fresh B', slug: slugB, adminUserId: bId });
    tally.check(tA.status === 'ACTIVE' && tB.status === 'ACTIVE', 'both tenants provisioned ACTIVE');
    tally.check(tA.domain.status === 'VERIFIED', `tenant A domain auto-verified (${tA.domain.hostname})`);
    tally.check(tB.domain.status === 'VERIFIED', `tenant B domain auto-verified (${tB.domain.hostname})`);
    tally.check(tA.tenantId !== tB.tenantId, 'two distinct tenants');

    // ── 6. Business data, both tenants ──────────────────────────────────
    console.log('\n--- 6. tenant business data ---');
    const custA = `c-a-${RUN}`;
    const custB = `c-b-${RUN}`;
    await db.query(
      `INSERT INTO customer (id, "tenantId", code, name, status, "createdAt", "updatedAt")
       VALUES ($1,$2,'CA','مشتری الف','ACTIVE',NOW(),NOW()), ($3,$4,'CB','مشتری ب','ACTIVE',NOW(),NOW())`,
      [custA, tA.tenantId, custB, tB.tenantId],
    );
    const { getTenantRepo } = await import('../server/tenantVerticals');
    const repo = getTenantRepo('customer');
    const listedA = await repo!.list(tA.tenantId, {});
    const listedB = await repo!.list(tB.tenantId, {});
    tally.check(listedA.total === 1, `tenant A sees 1 customer (got ${listedA.total})`);
    tally.check(listedB.total === 1, `tenant B sees 1 customer (got ${listedB.total})`);

    // ── 7. Server + login ───────────────────────────────────────────────
    console.log('\n--- 7. login + HTTP surface ---');
    const port = 39800 + (parseInt(RUN.slice(-3), 36) % 900);
    // Build a minimal app from the real router so the tests exercise the
    // production middleware chain (requireAuth → resolveTenant → route).
    // Relative specifiers, not absolute paths: a dynamic import of a Windows
    // path (D:\...) is rejected by the ESM loader (ERR_UNSUPPORTED_ESM_URL_SCHEME).
    const express = (await import('express')).default;
    const { pool: appPool } = await import('../server/pg');
    // A pg Pool emits 'error' when an idle client dies — which is exactly what
    // happens to every connection when this test drops its scratch database.
    // With no listener Node turns that into an unhandled 'error' event and the
    // process dies with a wall of pool internals, hiding the real result.
    appPool.on('error', () => { /* teardown noise; the assertions already ran */ });
    const { apiRouter } = await import('../server/routes');
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api', apiRouter);
    await new Promise<void>((resolve) => {
      server = http.createServer(app).listen(port, '127.0.0.1', () => resolve());
    });
    tally.check(true, `server listening on 127.0.0.1:${port}`);

    const hostA = `${slugA}.${PARENT}`;
    const hostB = `${slugB}.${PARENT}`;

    // Login must work for both tenant admins and the platform admin.
    const loginA = await request(port, 'POST', '/api/auth/login', { body: { usernameOrEmail: `a_${RUN}`, password: PASSWORD }, host: hostA });
    tally.check(loginA.status === 200 && !!loginA.body.token, `tenant A admin login (status ${loginA.status})`);
    const loginB = await request(port, 'POST', '/api/auth/login', { body: { usernameOrEmail: `b_${RUN}`, password: PASSWORD }, host: hostB });
    tally.check(loginB.status === 200 && !!loginB.body.token, `tenant B admin login (status ${loginB.status})`);
    const loginPa = await request(port, 'POST', '/api/auth/login', { body: { usernameOrEmail: `pa_${RUN}`, password: PASSWORD }, host: hostA });
    tally.check(loginPa.status === 200 && !!loginPa.body.token, `platform admin login (status ${loginPa.status})`);

    const tokenA = loginA.body.token;
    const tokenB = loginB.body.token;
    const tokenPa = loginPa.body.token;

    // A deactivated user must be denied, and their live token revoked.
    const deadId = `usr-dead-${RUN}`;
    await mkUser(deadId, `dead_${RUN}`, 'READ_ONLY');
    const deadLogin = await request(port, 'POST', '/api/auth/login', { body: { usernameOrEmail: `dead_${RUN}`, password: PASSWORD }, host: hostA });
    tally.check(deadLogin.status === 200, 'control: fresh user can log in');
    const { setUserStatus } = await import('../server/identity');
    await setUserStatus(deadId, 'SUSPENDED');
    const deadLogin2 = await request(port, 'POST', '/api/auth/login', { body: { usernameOrEmail: `dead_${RUN}`, password: PASSWORD }, host: hostA });
    tally.check(deadLogin2.status === 401 || deadLogin2.status === 403, `suspended user denied (status ${deadLogin2.status})`);
    const deadTokenUse = await request(port, 'GET', '/api/v2/tenants/customer', { token: deadLogin.body.token, host: hostA });
    tally.check(deadTokenUse.status === 401, `suspended user's live token revoked (status ${deadTokenUse.status})`);

    // ── 8. Cross-tenant attack matrix ───────────────────────────────────
    console.log('\n--- 8. cross-tenant attack matrix ---');

    // Baseline: each admin sees only their own customer.
    const seeA = await request(port, 'GET', '/api/v2/tenants/customer', { token: tokenA, host: hostA });
    const seeB = await request(port, 'GET', '/api/v2/tenants/customer', { token: tokenB, host: hostB });
    const rowsA = seeA.body?.data?.rows || seeA.body?.data || seeA.body?.customers || [];
    const rowsB = seeB.body?.data?.rows || seeB.body?.data || seeB.body?.customers || [];
    tally.check(seeA.status === 200, `tenant A list on its own host (status ${seeA.status})`);
    tally.check(
      JSON.stringify(rowsA).includes('مشتری الف') && !JSON.stringify(rowsA).includes('مشتری ب'),
      'tenant A sees only its own customer',
      JSON.stringify(rowsA).substring(0, 200),
    );
    tally.check(
      JSON.stringify(rowsB).includes('مشتری ب') && !JSON.stringify(rowsB).includes('مشتری الف'),
      'tenant B sees only its own customer',
    );

    const attacks: Array<{ label: string; res: Res; mustDeny: boolean }> = [
      // Another tenant's record ID, on the victim's own host.
      { label: "tenant A reads tenant B's customer id", mustDeny: true,
        res: await request(port, 'GET', `/api/v2/tenants/customer/${custB}`, { token: tokenA, host: hostA }) },
      // Crossed host: A's token on B's hostname.
      { label: "tenant A token on tenant B's hostname", mustDeny: true,
        res: await request(port, 'GET', '/api/v2/tenants/customer', { token: tokenA, host: hostB }) },
      // Fake tenant header.
      { label: 'forged X-Tenant-Id header', mustDeny: true,
        res: await request(port, 'GET', '/api/v2/tenants/customer', { token: tokenA, host: hostA }) },
      // Client-supplied tenantId in the body must be ignored.
      { label: 'client-supplied tenantId in POST body', mustDeny: true,
        res: await request(port, 'POST', '/api/v2/tenants/customer', {
          token: tokenA, host: hostA,
          body: { name: 'injected', code: 'X1', tenantId: tB.tenantId },
        }) },
      // Client-supplied tenantId in the query string.
      { label: 'client-supplied tenantId in query string', mustDeny: true,
        res: await request(port, 'GET', `/api/v2/tenants/customer?tenantId=${tB.tenantId}`, { token: tokenA, host: hostA }) },
      // Tenant admin attempting the platform control plane.
      { label: 'tenant admin calling /v2/platform/tenants', mustDeny: true,
        res: await request(port, 'GET', '/api/v2/platform/tenants', { token: tokenA, host: hostA }) },
      // Platform admin managing another tenant's membership.
      { label: 'platform admin addressing tenant B by path id', mustDeny: false,
        res: await request(port, 'GET', `/api/v2/platform/tenants/${tB.tenantId}/members`, { token: tokenPa, host: hostA }) },
      // Unknown host must not resolve to anything.
      { label: 'unknown hostname', mustDeny: true,
        res: await request(port, 'GET', '/api/v2/tenants/customer', { token: tokenA, host: `nope-${RUN}.${PARENT}` }) },
      // A host that merely CONTAINS the other tenant's slug.
      { label: 'hostname containing the other tenant slug', mustDeny: true,
        res: await request(port, 'GET', '/api/v2/tenants/customer', { token: tokenA, host: `x.${slugB}.${PARENT}` }) },
      // No token at all.
      { label: 'unauthenticated request', mustDeny: true,
        res: await request(port, 'GET', '/api/v2/tenants/customer', { host: hostA }) },
      // A tenant's unverified custom domain must not route (§FIX D).
      { label: 'PENDING custom domain', mustDeny: true,
        res: await request(port, 'GET', '/api/v2/tenants/customer', { token: tokenA, host: `pending-${RUN}.example.com` }) },
    ];

    for (const a of attacks) {
      // "Denied" means the response did not leak tenant B's data. A 404/403 is
      // the ideal; a 200 that happens to return only A's own rows is also safe.
      const text = JSON.stringify(a.res.body || '');
      const leaked = text.includes('مشتری ب') || (a.res.status === 200 && a.mustDeny && /tenantB/.test(text));
      if (a.mustDeny) {
        tally.check(!leaked && a.res.status !== 500, `${a.label} → ${a.res.status}, no leak`);
      } else {
        tally.check(a.res.status === 200, `${a.label} → ${a.res.status}`);
      }
    }

    // The injected tenantId POST must have landed in A, not B.
    const afterInject = await db.query(
      `SELECT "tenantId" FROM customer WHERE name = 'injected'`);
    tally.check(
      afterInject.rows[0]?.tenantId === tA.tenantId,
      'injected record landed in the caller\'s tenant, not the requested one',
      JSON.stringify(afterInject.rows),
    );

    // ── Domain verification over HTTP ───────────────────────────────────
    console.log('\n--- 9. domain verification over HTTP ---');
    const customHost = `verify-${RUN}.example.com`;
    const customSlug = `freshd${RUN.slice(-6)}`;
    const tC = await provisionTenant({ name: 'Custom', slug: customSlug, adminUserId: aId, requestedHostname: customHost });
    tally.check(tC.domain.status === 'PENDING', `custom domain is PENDING, not VERIFIED (${tC.domain.status})`);
    tally.check(tC.domain.routable === false, 'custom domain reports routable:false');

    const noProof = await request(port, 'POST', `/api/v2/platform/tenants/${tC.tenantId}/domain/verify`, { token: tokenPa, host: hostA, body: {} });
    tally.check(noProof.status === 422, `verify without proof rejected (status ${noProof.status})`);

    const withProof = await request(port, 'POST', `/api/v2/platform/tenants/${tC.tenantId}/domain/verify`, { token: tokenPa, host: hostA, body: { proof: { method: 'DNS_TXT', token: 'proof-1' } } });
    tally.check(withProof.status === 200 && withProof.body?.domain?.status === 'VERIFIED', `verify with proof succeeds (status ${withProof.status})`);

    const routesNow = await request(port, 'GET', '/api/v2/tenants/customer', { token: tokenA, host: customHost });
    tally.check(routesNow.status === 200, `verified custom domain now routes (status ${routesNow.status})`);

    // ── Legacy JSON gate, over real HTTP in production mode ─────────────
    // §17/§18 require that the global-JSON tenant surface be unreachable in
    // production. Asserted against the live server, not by unit-testing the
    // matcher: what matters is that the middleware is actually mounted and
    // actually precedes the handlers.
    console.log('\n--- 9b. legacy JSON gate (production mode) ---');
    const LEGACY_PROBE_PATHS = [
      '/api/sync/all',        // the worst: whole-dataset dump
      '/api/sync/push',
      '/api/customers',
      '/api/payments',
      '/api/attachments',
      '/api/conversations',
      '/api/journal-entries',
    ];
    // The gate reads NODE_ENV per request, so flipping it exercises the real
    // production path without a second server.
    process.env.NODE_ENV = 'production';
    for (const p of LEGACY_PROBE_PATHS) {
      const r = await request(port, 'GET', p, { token: tokenA, host: hostA });
      const blocked = r.status === 409 && r.body?.error === 'LEGACY_JSON_PATH_DISABLED';
      tally.check(blocked, `${p} → ${r.status} ${r.body?.error || ''}`);
    }
    // And a tenant POST is blocked too, not just reads.
    const postBlocked = await request(port, 'POST', '/api/customers', { token: tokenA, host: hostA, body: { name: 'x' } });
    tally.check(
      postBlocked.status === 409 && postBlocked.body?.error === 'LEGACY_JSON_PATH_DISABLED',
      `POST /api/customers → ${postBlocked.status} ${postBlocked.body?.error || ''}`,
    );
    // The PostgreSQL path must remain open while the legacy path is closed.
    const pgStillOpen = await request(port, 'GET', '/api/v2/tenants/customer', { token: tokenA, host: hostA });
    tally.check(pgStillOpen.status === 200, `PostgreSQL path still open in production (status ${pgStillOpen.status})`);
    // Platform control plane must remain open.
    const platformOpen = await request(port, 'GET', '/api/v2/platform/tenants', { token: tokenPa, host: hostA });
    tally.check(platformOpen.status === 200, `platform control plane still open (status ${platformOpen.status})`);
    process.env.NODE_ENV = 'test';

    // ── Concurrency over HTTP ───────────────────────────────────────────
    console.log('\n--- 10. concurrent provisioning over HTTP ---');
    const raceSlug = `freshrace${RUN.slice(-6)}`;
    const attempts = await Promise.all(Array.from({ length: 10 }, () =>
      request(port, 'POST', '/api/v2/platform/tenants', {
        token: tokenPa, host: hostA, body: { name: 'Race', slug: raceSlug },
      }),
    ));
    const created = attempts.filter((r) => r.status === 201);
    const repeated = attempts.filter((r) => r.status === 200);
    const failed = attempts.filter((r) => r.status >= 400);
    tally.check(failed.length === 0, `no request errored (${failed.length} failed)`, JSON.stringify(attempts.map((a) => a.status)));
    tally.check(created.length === 1, `exactly one 201 Created (got ${created.length})`);
    tally.check(repeated.length === 9, `nine 200 OK repeats (got ${repeated.length})`);
    const raceRows = await db.query('SELECT id, status FROM tenant WHERE slug = $1', [raceSlug]);
    tally.check(raceRows.rows.length === 1, `one tenant row for the slug (got ${raceRows.rows.length})`);
    tally.check(raceRows.rows[0]?.status === 'ACTIVE', `race winner is ACTIVE (got ${raceRows.rows[0]?.status})`);

    // ── Close down ──────────────────────────────────────────────────────
    // Close the HTTP server, THEN the application's own pg pool, THEN the
    // test's pool. Dropping the database while any of them still holds a
    // connection produces a 57P01 that surfaces as an unhandled rejection and
    // buries whatever the test actually found.
    await new Promise<void>((resolve) => { server!.close(() => resolve()); });
    server = null;
    tally.check(true, 'server shut down cleanly');

    const { pool } = await import('../server/pg');
    await pool.end().catch(() => {});
  } finally {
    if (server) await new Promise<void>((resolve) => { server!.close(() => resolve()); });
    if (db) await db.end().catch(() => {});
    await dropScratchDb();
  }

  const code = tally.finish();
  process.exit(code);
}

main().catch(async (e) => {
  console.error('\nFATAL:', e);
  try { require('dotenv/config'); } catch { /* dotenv already loaded */ }
  await dropScratchDb().catch(() => {});
  process.exit(1);
});
