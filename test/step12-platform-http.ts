import 'dotenv/config';
// ---------------------------------------------------------------------------
// Step 12 — End-to-end HTTP tests for the provisioning / platform-admin /
// tenant-admin surface, plus the cross-tenant attack matrix.
//
// Boots the REAL Express router against a REAL PostgreSQL database, exactly as
// production wires it (routes.ts applies requireAuth + resolveTenantMiddleware
// itself), so the test cannot drift from the deployed behaviour.
//
// Requires DATABASE_URL and JWT_SECRET in the environment.
//
// Run: npx tsx test/step12-platform-http.ts
// ---------------------------------------------------------------------------
import express from 'express';
import type { AddressInfo } from 'net';
import { Server, request as httpRequest } from 'http';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, pool } from '../server/pg';
import { centralDb } from '../server/db';
import { apiRouter } from '../server/routes';
import { signToken } from '../server/auth';
import { ModuleName, PermissionAction, Permission, Role, UserRole } from '../src/types';
import { DEFAULT_ROLES } from '../src/lib/permissions';

const P_DOMAIN = 'mmba.example';
const P_PLATFORM = 's12-platform';
const P_TENANT_ADMIN = 'OWNER';
const P_MEMBER_ROLE = 'READ_ONLY';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

const now = () => new Date().toISOString();
const stamp = Date.now();

const PA_ID = `usr-s12-pa-${stamp}`;
const PA_USERNAME = `s12_platform_${stamp}`;
const TA_ID = `usr-s12-ta-${stamp}`;
const TA_USERNAME = `s12_tenantadmin_${stamp}`;
const MEMBER_ID = `usr-s12-mem-${stamp}`;
const MEMBER_USERNAME = `s12_member_${stamp}`;
const UNAUTHED_TENANT_ADMIN_ID = `usr-s12-ta2-${stamp}`;
const UNAUTHED_TENANT_ADMIN_USERNAME = `s12_ta2_${stamp}`;

const T_SLUG = `s12t${stamp}`;
const T_HOST = `${T_SLUG}.${P_DOMAIN}`;
const T2_SLUG = `s12u${stamp}`;
const T2_HOST = `${T2_SLUG}.${P_DOMAIN}`;

async function upsertTenant(id: string, slug: string, name: string, host: string) {
  await query(
    `INSERT INTO tenant (id, name, slug, status, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,'ACTIVE',$4,$4)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE', "updatedAt" = EXCLUDED."updatedAt"`,
    [id, name, slug, now()],
  );
  await query(
    `INSERT INTO "tenantDomain" (id, "tenantId", hostname, type, "isPrimary", status, "verifiedAt", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,'SUBDOMAIN',true,'ACTIVE',$4,$4,$4)
     ON CONFLICT (hostname) DO NOTHING`,
    [`dom-s12-${slug}`, id, host, now()],
  );
}

async function seedFixtures() {
  const hash = await bcrypt.hash('s12-pass-123', 4);

  // Tenant A: platform admin is the tenant owner. Tenant B: the platform admin
  // is NOT a member — so any A-scoped read of B must be a genuine leak.
  await upsertTenant(`ten-s12-a-${stamp}`, T_SLUG, 'Step12 Tenant A', T_HOST);
  await upsertTenant(`ten-s12-b-${stamp}`, T2_SLUG, 'Step12 Tenant B', T2_HOST);

  const users: Array<[string, string, UserRole]> = [
    [PA_ID, PA_USERNAME, UserRole.GOD],
    [TA_ID, TA_USERNAME, P_TENANT_ADMIN as UserRole],
    [MEMBER_ID, MEMBER_USERNAME, P_MEMBER_ROLE as UserRole],
    [UNAUTHED_TENANT_ADMIN_ID, UNAUTHED_TENANT_ADMIN_USERNAME, UserRole.GOD],
  ];

  for (const [id, username, role] of users) {
    await query(
      `INSERT INTO "user" (id, username, name, "passwordHash", role, status, "tokenVersion", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'ACTIVE',0,$6,$6)
       ON CONFLICT (id) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", role = EXCLUDED.role`,
      [id, username, username, hash, role, now()],
    );
    // Authentication resolves the user from the JSON store, so register there too.
    const existing = centralDb.findUserById(id);
    await centralDb.saveUser({
      ...(existing || {}),
      id, username, name: username,
      password: hash,
      role,
      status: 'ACTIVE',
      tokenVersion: 0,
      permissions: [],
    } as any);
  }

  // Platform admin row — the authoritative platform-authorization check.
  await query(
    `INSERT INTO "platformAdmin" (id, "userId", "createdAt") VALUES ($1,$2,$3) ON CONFLICT ("userId") DO NOTHING`,
    [`pa-s12-${stamp}`, PA_ID, now()],
  );

  // Tenant A memberships: an admin and an ordinary member.
  for (const [uid, role] of [[TA_ID, P_TENANT_ADMIN], [MEMBER_ID, P_MEMBER_ROLE]] as const) {
    await query(
      `INSERT INTO membership (id, "tenantId", "userId", role, status, "joinedAt", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,'ACTIVE',$5,$5,$5)
       ON CONFLICT ("tenantId","userId") DO NOTHING`,
      [`ms-s12-${uid}-${stamp}`, `ten-s12-a-${stamp}`, uid, role, now()],
    );
  }

  // Tenant B: a DIFFERENT user holds the owner membership, so the platform
  // admin has no membership there and must be refused entirely.
  await query(
    `INSERT INTO membership (id, "tenantId", "userId", role, status, "joinedAt", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,'ACTIVE',$5,$5,$5)
     ON CONFLICT ("tenantId","userId") DO NOTHING`,
    [`ms-s12-b-${stamp}`, `ten-s12-b-${stamp}`, UNAUTHED_TENANT_ADMIN_ID, P_TENANT_ADMIN, now()],
  );
}

async function main() {
  console.log('=== Step 12: platform admin + tenant admin + cross-tenant HTTP ===\n');
  await seedFixtures();

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  const server: Server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const port = (server.address() as AddressInfo).port;

  // node:http, not fetch — undici drops a Host override, so the hostname that
  // drives tenant resolution would never arrive.
  const call = (method: string, path: string, token: string | null, host: string, body?: any, extraHeaders?: Record<string, string>) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : undefined;
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = httpRequest(
        { host: '127.0.0.1', port, method, path, headers: {
          Host: host,
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'Content-Length': payload.length } : {}),
          ...(extraHeaders || {}),
        } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            try { resolve({ status: res.statusCode || 0, body: raw ? JSON.parse(raw) : null }); }
            catch { resolve({ status: res.statusCode || 0, body: raw }); }
          });
        },
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  };

  const paTok = signToken(PA_ID, 0);
  const taTok = signToken(TA_ID, 0);
  const memTok = signToken(MEMBER_ID, 0);
  const otherTaTok = signToken(UNAUTHED_TENANT_ADMIN_ID, 0);
  const TENANT_A = `ten-s12-a-${stamp}`;
  const TENANT_B = `ten-s12-b-${stamp}`;

  // ── Platform admin lifecycle ──────────────────────────────────────
  console.log('--- Platform admin: list tenants ---');
  {
    const r = await call('GET', '/api/v2/platform/tenants', paTok, T_HOST);
    check('platform admin can list tenants', r.status === 200 && Array.isArray(r.body?.tenants), `status=${r.status}`);
  }

  console.log('\n--- Platform admin: retrieve tenant ---');
  {
    const r = await call('GET', `/api/v2/platform/tenants/${TENANT_A}`, paTok, T_HOST);
    check('platform admin can retrieve tenant', r.status === 200 && r.body?.tenant?.id === TENANT_A, `status=${r.status}`);
  }

  // ── Platform routes refuse a tenant admin ─────────────────────────
  console.log('\n--- Platform routes reject tenant admins ---');
  {
    const r = await call('GET', '/api/v2/platform/tenants', taTok, T_HOST);
    check('tenant admin denied on platform list', r.status === 403, `status=${r.status}`);

    const r2 = await call('GET', '/api/v2/platform/tenants', otherTaTok, T2_HOST);
    check('other tenant owner denied on platform list', r2.status === 403, `status=${r2.status}`);
  }
  {
    const r = await call('GET', '/api/v2/platform/tenants', null, T_HOST);
    check('unauthenticated denied on platform list', r.status === 401, `status=${r.status}`);
  }
  {
    const r = await call('POST', '/api/v2/platform/tenants', taTok, T_HOST, { name: 'x', slug: 'x-s12' });
    check('tenant admin denied on platform create', r.status === 403, `status=${r.status}`);
  }
  {
    // GOD role in the JSON store but NO PlatformAdmin row — proves the check is
    // the PlatformAdmin record, not the role string.
    const r = await call('POST', `/api/v2/platform/tenants/${TENANT_B}/suspend`, otherTaTok, T2_HOST);
    check('GOD role without PlatformAdmin row is still denied', r.status === 403, `status=${r.status}`);
  }

  // ── Provisioning over HTTP ────────────────────────────────────────
  console.log('\n--- Platform admin: provisioning ---');
  {
    const r = await call('POST', '/api/v2/platform/tenants', paTok, T_HOST, {
      name: 'S12 HTTP Provisioned', slug: `s12http${stamp}`, adminUserId: PA_ID,
    });
    check('platform admin can provision tenant', r.status === 201 && !!r.body?.tenant?.id, `status=${r.status} ${JSON.stringify(r.body).slice(0, 140)}`);
  }
  {
    const r = await call('POST', '/api/v2/platform/tenants', paTok, T_HOST, { name: 'Bad', slug: 'www' });
    check('reserved slug rejected (422)', r.status === 422 && r.body?.error === 'INVALID_SLUG', `status=${r.status}`);
  }
  {
    const r = await call('POST', '/api/v2/platform/tenants', paTok, T_HOST, { name: 'Missing slug' });
    check('missing slug rejected (400)', r.status === 400, `status=${r.status}`);
  }

  // ── Provisioning retry (§36.5) ────────────────────────────────────
  console.log('\n--- Provisioning retry: no duplicates ---');
  {
    const retrySlug = `s12retry${stamp}`;
    const a = await call('POST', '/api/v2/platform/tenants', paTok, T_HOST, { name: 'Retry Co', slug: retrySlug, adminUserId: PA_ID });
    const b = await call('POST', '/api/v2/platform/tenants', paTok, T_HOST, { name: 'Retry Co', slug: retrySlug, adminUserId: PA_ID });
    check('first provision creates', a.status === 201, `status=${a.status}`);
    // Step 12 FIX: a repeat is a 200 OK, not a second 201 — nothing was
    // created, so claiming "created" would be a lie. `repeated: true` is the
    // explicit marker.
    check('second provision is idempotent', b.status === 200 && b.body?.repeated === true, `status=${b.status} repeated=${b.body?.repeated}`);
    check('same tenantId across retries', a.body?.tenant?.id === b.body?.tenant?.id);

    const rows = await query<{ c: number }>('SELECT COUNT(*)::int AS c FROM tenant WHERE slug = $1', [retrySlug]);
    check('exactly one tenant row after retry', rows[0].c === 1, `count=${rows[0].c}`);

    const mem = await query<{ c: number }>(
      'SELECT COUNT(*)::int AS c FROM membership WHERE "tenantId" = $1 AND "userId" = $2', [a.body?.tenant?.id, PA_ID],
    );
    check('no duplicate membership after retry', mem[0].c === 1, `count=${mem[0].c}`);
  }

  // ── Lifecycle transitions over HTTP ───────────────────────────────
  console.log('\n--- Platform admin: lifecycle ---');
  {
    const s = await call('POST', `/api/v2/platform/tenants/${TENANT_B}/suspend`, paTok, T_HOST);
    check('platform admin can suspend', s.status === 200 && s.body?.status === 'SUSPENDED', `status=${s.status}`);

    // A suspended tenant must not resolve for its own member.
    const read = await call('GET', '/api/v2/tenants/customer', otherTaTok, T2_HOST);
    check('suspended tenant denies tenant-scoped read', read.status >= 400, `status=${read.status}`);

    const a = await call('POST', `/api/v2/platform/tenants/${TENANT_B}/activate`, paTok, T_HOST);
    check('platform admin can re-activate', a.status === 200 && a.body?.status === 'ACTIVE', `status=${a.status}`);

    const d = await call('POST', `/api/v2/platform/tenants/${TENANT_B}/deactivate`, paTok, T_HOST);
    check('platform admin can deactivate', d.status === 200 && d.body?.status === 'DEACTIVATED', `status=${d.status}`);

    const bad = await call('POST', `/api/v2/platform/tenants/${TENANT_B}/activate`, paTok, T_HOST);
    check('invalid transition rejected (409)', bad.status === 409, `status=${bad.status}`);

    // Restore for the remaining isolation tests.
    await query('UPDATE tenant SET status = $1 WHERE id = $2', ['ACTIVE', TENANT_B]);
  }

  // ── Membership administration ─────────────────────────────────────
  console.log('\n--- Tenant admin: membership ---');
  {
    const r = await call('GET', '/api/v2/tenant/members', taTok, T_HOST);
    check('tenant admin can list members', r.status === 200 && Array.isArray(r.body?.members), `status=${r.status}`);
  }
  {
    const r = await call('GET', '/api/v2/tenant/members', memTok, T_HOST);
    check('ordinary member can read roster', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await call('POST', '/api/v2/tenant/members', memTok, T_HOST, { userId: PA_ID, role: 'READ_ONLY' });
    check('ordinary member cannot add members', r.status === 403, `status=${r.status}`);
  }
  {
    const r = await call('POST', '/api/v2/tenant/members', taTok, T_HOST, { userId: PA_ID, role: 'OWNER' });
    check('tenant admin cannot grant owner role (escalation blocked)', r.status === 403 && r.body?.error === 'ROLE_ESCALATION', `status=${r.status}`);
  }
  {
    const newUser = `usr-s12-inv-${stamp}`;
    const username = `s12_inv_${stamp}`;
    const hash = await bcrypt.hash('s12-pass-123', 4);
    await query(
      `INSERT INTO "user" (id, username, name, "passwordHash", role, status, "tokenVersion", "createdAt", "updatedAt")
       VALUES ($1,$2,$2,$3,$4,'ACTIVE',0,$5,$5) ON CONFLICT (id) DO NOTHING`,
      [newUser, username, hash, P_MEMBER_ROLE, now()],
    );
    const r = await call('POST', '/api/v2/tenant/members', taTok, T_HOST, { userId: newUser, role: 'SALES' });
    check('tenant admin can add a member', r.status === 201, `status=${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);

    const r2 = await call('PUT', `/api/v2/tenant/members/${newUser}`, taTok, T_HOST, { role: 'SUPERVISOR' });
    check('tenant admin can change role', r2.status === 200, `status=${r2.status}`);

    const r3 = await call('DELETE', `/api/v2/tenant/members/${newUser}`, taTok, T_HOST);
    check('tenant admin can remove member', r3.status === 200, `status=${r3.status}`);
  }
  {
    const r = await call('GET', '/api/v2/tenant/members', taTok, T2_HOST);
    check('tenant admin on foreign host gets no context (404)', r.status === 404, `status=${r.status}`);
  }
  {
    // Cross-tenant: the admin of A addressing a membership that lives in B.
    const r = await call('DELETE', `/api/v2/tenant/members/${UNAUTHED_TENANT_ADMIN_ID}`, taTok, T_HOST);
    check('cross-tenant membership delete refused (404)', r.status === 404, `status=${r.status}`);
  }

  // ── Cross-tenant attack matrix ────────────────────────────────────
  console.log('\n--- Cross-tenant attack matrix (authenticated as tenant A) ---');
  let recordB = '';
  {
    // Seed a record in tenant B, owned by B's user only.
    const r = await pool.query(
      `INSERT INTO customer (id, "tenantId", code, name, mobile, status, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,$6) RETURNING id`,
      [`cus-s12-b-${stamp}`, TENANT_B, `B-${stamp}`, 'Tenant B Secret', `09${String(stamp).slice(-8)}`, now()],
    );
    recordB = r.rows[0].id;
  }
  {
    const r = await call('GET', `/api/v2/tenants/customer/${recordB}`, taTok, T_HOST);
    check('direct ID read of B record from A denied', r.status === 404, `status=${r.status}`);

    const r2 = await call('GET', `/api/v2/tenants/customer?tenantId=${TENANT_B}`, taTok, T_HOST);
    const leaked = Array.isArray(r2.body?.data) && r2.body.data.some((x: any) => x.id === recordB);
    check('query-string tenantId cannot select B', !leaked, `status=${r2.status}`);

    const r3 = await call('POST', '/api/v2/tenants/customer', taTok, T_HOST, { tenantId: TENANT_B, code: `X${stamp}`, name: 'Injected' });
    const createdTenant = r3.body?.data?.tenantId;
    check('body tenantId is ignored (record lands in A)', createdTenant === TENANT_A, `status=${r3.status} landed=${createdTenant} body=${JSON.stringify(r3.body).slice(0, 160)}`);

    const r4 = await call('GET', `/api/v2/tenants/customer/${recordB}`, taTok, T_HOST, undefined, { 'X-Tenant-ID': TENANT_B });
    check('X-Tenant-ID header cannot select B', r4.status === 404, `status=${r4.status}`);

    const r5 = await call('PUT', `/api/v2/tenants/customer/${recordB}`, taTok, T_HOST, { name: 'Hacked' });
    check('cross-tenant update denied', r5.status === 404, `status=${r5.status}`);

    const r6 = await call('DELETE', `/api/v2/tenants/customer/${recordB}`, taTok, T_HOST);
    check('cross-tenant delete denied', r6.status === 404, `status=${r6.status}`);

    const r7 = await call('GET', '/api/v2/tenants/customer', taTok, T2_HOST);
    check('A user on B hostname gets no tenant context', r7.status === 403 || r7.status === 404, `status=${r7.status}`);
  }

  // ── Step 11B protections must survive ─────────────────────────────
  console.log('\n--- Step 11B generic-route protections (regression) ---');
  {
    const r = await call('GET', '/api/v2/tenants/constructor', taTok, T_HOST);
    check('prototype key rejected (404)', r.status === 404 && r.body?.error === 'UNKNOWN_TABLE', `status=${r.status}`);

    const r2 = await call('GET', '/api/v2/tenants/no_such_table', taTok, T_HOST);
    check('unknown table rejected (404)', r2.status === 404 && r2.body?.error === 'UNKNOWN_TABLE', `status=${r2.status}`);

    const r3 = await call('GET', '/api/v2/tenants/payment', memTok, T_HOST);
    check('read-only member CAN view payments (VIEW granted)', r3.status === 200, `status=${r3.status}`);
  }

  // ── Financial deletion guards (§19) ────────────────────────────────
  // These are TENANT-scoped operations, so the caller must hold a membership in
  // tenant A — the platform admin deliberately does NOT. Use the tenant admin.
  console.log('\n--- Financial deletion guards ---');
  {
    const paid = await pool.query(
      `INSERT INTO payment (id, "tenantId", "customerId", amount, status, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,100,'VERIFIED',$4,$4) RETURNING id`,
      [`pay-s12-${stamp}`, TENANT_A, `cus-s12-a-${stamp}`, now()],
    );
    const r = await call('DELETE', `/api/v2/tenants/payment/${paid.rows[0].id}`, taTok, T_HOST);
    check('VERIFIED payment cannot be deleted (409)', r.status === 409 && r.body?.error === 'FINANCIAL_RECORD_PROTECTED', `status=${r.status}`);

    const chk = await pool.query(
      `INSERT INTO "checkRecord" (id, "tenantId", "customerId", amount, "dueDate", status, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,100,NOW(),'CLEARED',$4,$4) RETURNING id`,
      [`chk-s12-${stamp}`, TENANT_A, `cus-s12-a-${stamp}`, now()],
    );
    const r2 = await call('DELETE', `/api/v2/tenants/checkRecord/${chk.rows[0].id}`, taTok, T_HOST);
    check('CLEARED check cannot be deleted (409)', r2.status === 409 && r2.body?.error === 'FINANCIAL_RECORD_PROTECTED', `status=${r2.status}`);

    // And a non-platform user without a membership is refused at resolution.
    const r3 = await call('DELETE', `/api/v2/tenants/payment/${paid.rows[0].id}`, paTok, T_HOST);
    check('non-member cannot reach tenant-scoped delete', r3.status === 403 || r3.status === 404, `status=${r3.status}`);
  }

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===\n`);
  server.close();
  await pool.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('TEST ERR:', e);
  process.exit(1);
});
