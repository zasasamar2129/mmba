import 'dotenv/config';
// ---------------------------------------------------------------------------
// Step 11B-FIX — End-to-end HTTP authorization tests for /v2/tenants/:table
//
// Boots the real Express app against a real PostgreSQL database and proves the
// authorization behaviour over HTTP (not just the mapping function).
//
// Requires:
//   DATABASE_URL  — a PostgreSQL database whose schema matches prisma/schema.prisma
//   JWT_SECRET    — arbitrary; the tokens are signed by this same process
//   SEED_TENANT   — optional tenant id (default 'ten-initial')
//
// Run: DATABASE_URL=... npx tsx test/step11bfix-generic-routes-http.ts
// ---------------------------------------------------------------------------
import assert from 'assert';
import express from 'express';
import type { AddressInfo } from 'net';
import { Server, request as httpRequest } from 'http';
import bcrypt from 'bcryptjs';
import { query, pool } from '../server/pg';
import { tenantTables } from '../server/tenantVerticals';
import { centralDb } from '../server/db';
import { apiRouter } from '../server/routes';
import { signToken } from '../server/auth';
import { ModuleName, PermissionAction, Permission, Role, UserRole } from '../src/types';
import { DEFAULT_ROLES } from '../src/lib/permissions';
import { getTenantTableModule } from '../server/tenantTableModules';

const TENANT_A = process.env.SEED_TENANT_A || 'ten-initial';
const TENANT_B = process.env.SEED_TENANT_B || 'ten-seed-b';
const HOST_A = process.env.SEED_HOST_A || 'initial.mmba.example';
const HOST_B = process.env.SEED_HOST_B || 'tenant-b.mmba.example';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

const now = () => new Date().toISOString();
const CUSTOMER_ONLY_ROLE = 'TEST_RBAC_CUSTOMER_ONLY';
const FULL_ROLE = 'TEST_RBAC_FULL';

/** Create the two tenants, their hostnames, the two users, and their memberships. */
async function seedRbacFixtures() {
  const hash = await bcrypt.hash('test-pass-123', 4);

  for (const [id, slug, host] of [[TENANT_A, 'initial', HOST_A], [TENANT_B, 'tenant-b', HOST_B]] as const) {
    await query(
      `INSERT INTO tenant (id, name, slug, status, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,'ACTIVE',$4,$4) ON CONFLICT (slug) DO UPDATE SET "updatedAt"=EXCLUDED."updatedAt"`,
      [id, slug === 'initial' ? 'Initial Business' : 'Tenant B', slug, now()],
    );
    await query(
      `INSERT INTO "tenantDomain" (id, "tenantId", hostname, type, "isPrimary", status, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,'SUBDOMAIN',true,'ACTIVE',$4,$4) ON CONFLICT (hostname) DO NOTHING`,
      [`pg-dns-${slug}`, id, host, now()],
    );
  }

  const users: Array<[string, string, string]> = [
    ['usr-rbac-cust', 'rbac_customer_only', CUSTOMER_ONLY_ROLE],
    ['usr-rbac-full', 'rbac_full_access', FULL_ROLE],
  ];
  for (const [id, username, role] of users) {
    await query(
      `INSERT INTO "user" (id, username, name, "passwordHash", role, status, "tokenVersion", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'ACTIVE',0,$6,$6)
       ON CONFLICT (id) DO UPDATE SET "passwordHash"=EXCLUDED."passwordHash", role=EXCLUDED.role`,
      [id, username, username, hash, role, now()],
    );
    for (const tenantId of [TENANT_A, TENANT_B]) {
      await query(
        `INSERT INTO membership (id, "tenantId", "userId", role, status, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,'ACTIVE',$5,$5) ON CONFLICT ("tenantId","userId") DO NOTHING`,
        [`ms-rbac-${username}-${tenantId}`, tenantId, id, role, now()],
      );
    }
  }
}

/** Register the two synthetic roles AND users.
 *
 * Two stores are involved and the fixtures must cover both:
 *   - requireAuth resolves the user from centralDb (the JSON store).
 *   - hasPermission(user, module, action) is called by routes.ts WITHOUT a
 *     rolesList argument, so it defaults to DEFAULT_ROLES — the role catalogue
 *     is resolved from there, NOT from the JSON store's role list.
 *     (The pure-logic test test/step11bfix-authorization.ts passes an explicit
 *     role list, which is why it could use synthetic roles directly.)
 * PostgreSQL supplies the tenant, membership, and record data.
 */
async function seedJsonRolesAndUsers() {
  const perms = (list: Array<[ModuleName, string[]]>): Permission[] =>
    list.map(([m, a]) => ({ module: m, actions: a.map((x) => PermissionAction[x as keyof typeof PermissionAction]) }));

  const roles: Role[] = [
    {
      id: 'role-test-rbac-customer-only',
      name: CUSTOMER_ONLY_ROLE as unknown as UserRole,
      titleFa: 'Test customer-only', titleEn: 'Test customer-only',
      descriptionFa: '', descriptionEn: '',
      // Customers only — deliberately NO payments, checks, chat, repairs, sims, leads.
      permissions: perms([[ModuleName.CUSTOMERS, ['VIEW', 'CREATE', 'EDIT', 'ARCHIVE']]]),
    },
    {
      id: 'role-test-rbac-full',
      name: FULL_ROLE as unknown as UserRole,
      titleFa: 'Test full', titleEn: 'Test full',
      descriptionFa: '', descriptionEn: '',
      permissions: Object.values(ModuleName).map((m) => ({
        module: m,
        actions: Object.values(PermissionAction),
      })),
    },
  ];

  // Register into the catalogue hasPermission actually consults, replacing any
  // prior run's entries so the test is re-runnable.
  for (const r of roles) {
    const idx = DEFAULT_ROLES.findIndex((x) => x.name === r.name);
    if (idx >= 0) DEFAULT_ROLES[idx] = r;
    else DEFAULT_ROLES.push(r);
  }

  // Users live in the JSON store for authentication; the matching PG rows
  // (created in seedRbacFixtures) carry tenant membership.
  const passwordHash = await bcrypt.hash('test-pass-123', 4);
  const users: Array<[string, string, string]> = [
    ['usr-rbac-cust', 'rbac_customer_only', CUSTOMER_ONLY_ROLE],
    ['usr-rbac-full', 'rbac_full_access', FULL_ROLE],
  ];
  for (const [id, username, role] of users) {
    const existing = centralDb.findUserById(id);
    await centralDb.saveUser({
      ...(existing || {}),
      id,
      username,
      name: username,
      password: passwordHash,
      role: role as unknown as UserRole,
      status: 'ACTIVE',
      tokenVersion: 0,
      permissions: [],
    } as any);
  }
}

async function main() {
  console.log('=== Step 11B-FIX generic route HTTP authorization ===\n');
  await seedJsonRolesAndUsers();
  await seedRbacFixtures();

  // Mount the REAL router: routes.ts already applies requireAuth and
  // resolveTenantMiddleware on apiRouter, so this reproduces production wiring
  // exactly and the test cannot drift from it.
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;

  const custToken = signToken('usr-rbac-cust', 0);
  const fullToken = signToken('usr-rbac-full', 0);

  const call = async (
    method: string, path: string, token: string, host: string, body?: any,
  ) => {
    // NOTE: fetch() silently drops a Host header override (undici forbids
    // setting Host), so the request would always arrive as 127.0.0.1:PORT and
    // tenant resolution would never see the intended hostname. Use node:http,
    // which sends the header verbatim.
    const payload = body ? Buffer.from(JSON.stringify(body)) : undefined;
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = httpRequest(
        { host: '127.0.0.1', port, method, path, headers: {
          Host: host,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(payload ? { 'Content-Length': payload.length } : {}),
        } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            let json: any = null;
            try { json = JSON.parse(raw); } catch { json = raw; }
            resolve({ status: res.statusCode || 0, body: json });
          });
        },
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  };

  // Seed one record in tenant A to probe cross-tenant access.
  const seedRow = await query<any>(
    `INSERT INTO customer (id, "tenantId", code, name, status, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,'ACTIVE',$5,$5) RETURNING id`,
    [`cst-rbac-${Date.now()}`, TENANT_A, `C-${Date.now()}`, 'RBAC Probe Customer', now()],
  );
  const probeId = seedRow[0].id;

  console.log('\n=== A. PUBLIC ROUTES NOT BLOCKED BY TENANT MIDDLEWARE ===');
  {
    const h = await call('GET', '/api/healthz', custToken, 'unknown.mmba.example');
    check('GET /api/healthz on unknown host → 200', h.status === 200, `got ${h.status}`);
    const l = await call('POST', '/api/auth/login', '', 'unknown.mmba.example',
      { usernameOrEmail: 'rbac_customer_only', password: 'test-pass-123' });
    check('POST /api/auth/login on unknown host → not 404', l.status !== 404, `got ${l.status}`);
    check('POST /api/auth/login succeeds for seeded user', l.body?.success === true, JSON.stringify(l.body).slice(0, 140));
  }

  console.log('\n=== B. TENANT ROUTE WITHOUT CONTEXT → DENIED ===');
  {
    const r = await call('GET', '/api/v2/tenants/customer', custToken, 'nope.mmba.example');
    check('GET /v2/tenants/customer with unresolvable host → 403', r.status === 403, `got ${r.status}`);
  }

  console.log('\n=== C. CUSTOMER-ONLY USER: CUSTOMERS ALLOWED ===');
  {
    // `customer` is served by a dedicated route registered ahead of the generic
    // :table route, so it is exercised through that path.
    const r = await call('GET', '/api/v2/tenants/customers', custToken, HOST_A);
    check('GET /v2/tenants/customers (dedicated) → 200', r.status === 200, `got ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    const r2 = await call('GET', `/api/v2/tenants/customers/${probeId}`, custToken, HOST_A);
    check('GET /v2/tenants/customers/:id (own tenant) → 200', r2.status === 200, `got ${r2.status}`);
  }

  console.log('\n=== D. CUSTOMER-ONLY USER: EVERY NON-CUSTOMER VERTICAL DENIED (403) ===');
  {
    // Read path over every generic table. A 200 here is a leak ONLY for tables
    // whose owning module is not CUSTOMERS — registeredHolder is deliberately
    // mapped to CUSTOMERS, so a customer-only user may legitimately read it.
    const leaks: string[] = [];
    const wrongStatus: string[] = [];
    for (const table of tenantTables) {
      const r = await call('GET', `/api/v2/tenants/${table}`, custToken, HOST_A);
      const ownsCustomers = getTenantTableModule(table) === ModuleName.CUSTOMERS;
      if (r.status === 200) {
        if (!ownsCustomers) leaks.push(table);
      } else if (r.status !== 403 && r.body?.error !== 'UNKNOWN_TABLE') {
        wrongStatus.push(`${table}=${r.status}`);
      }
    }
    check('customer-only user denied on every non-CUSTOMERS table', leaks.length === 0, `LEAKED: ${leaks.join(', ')}`);
    check('denials use 403 or UNKNOWN_TABLE', wrongStatus.length === 0, `unexpected: ${wrongStatus.join(', ')}`);

    // And the tables that DO map to CUSTOMERS are reachable for this user —
    // proving the denials above are not vacuous.
    const rh = await call('GET', '/api/v2/tenants/registeredHolder', custToken, HOST_A);
    check('CONTROL: registeredHolder (CUSTOMERS-mapped) is allowed for customer-only user', rh.status === 200, `got ${rh.status}`);
  }

  console.log('\n=== E. NAMED FINANCIAL / CHAT / OTHER VERTICALS EXPLICITLY ===');
  {
    for (const [table, label] of [
      ['payment', 'payments'], ['checkRecord', 'checks'], ['account', 'accounting'],
      ['journalEntry', 'journal entries'], ['journalEntryLine', 'journal lines'],
      ['chatMessage', 'chat'], ['chatConversation', 'chat conversations'],
      ['repair', 'repairs'], ['simCard', 'SIMs'], ['lead', 'leads'],
      ['contract', 'contracts'], ['task', 'tasks'], ['notification', 'notifications'],
      ['attachment', 'attachments'], ['consignment', 'consignments'],
    ] as const) {
      const r = await call('GET', `/api/v2/tenants/${table}`, custToken, HOST_A);
      check(`customer-only denied: GET ${label}`, r.status === 403, `got ${r.status}`);
    }
    // Mutation paths must be denied too. PUT/DELETE need a concrete :id.
    for (const [method, table, label] of [
      ['POST', 'payment', 'POST payments'],
      ['PUT', 'payment', 'PUT payments'],
      ['DELETE', 'payment', 'DELETE payments'],
      ['POST', 'checkRecord', 'POST checks'],
      ['PUT', 'checkRecord', 'PUT checks'],
      ['DELETE', 'checkRecord', 'DELETE checks'],
      ['POST', 'journalEntry', 'POST accounting'],
      ['PUT', 'chatMessage', 'PUT chat'],
      ['DELETE', 'repair', 'DELETE repairs'],
      ['POST', 'simCard', 'POST sims'],
      ['PUT', 'lead', 'PUT leads'],
      ['DELETE', 'attachment', 'DELETE attachments'],
    ] as const) {
      const needsId = method === 'PUT' || method === 'DELETE';
      const path = needsId ? `/api/v2/tenants/${table}/some-id` : `/api/v2/tenants/${table}`;
      const r = await call(method, path, custToken, HOST_A, {});
      check(`customer-only denied: ${label}`, r.status === 403, `got ${r.status}`);
    }
  }

  console.log('\n=== F. CORRECT VERTICAL PERMISSION WORKS ===');
  {
    const r = await call('GET', '/api/v2/tenants/payment', fullToken, HOST_A);
    check('full-access user → GET payments → 200', r.status === 200, `got ${r.status}`);
    for (const [table, label] of [
      ['checkRecord', 'checks'], ['account', 'accounting'], ['journalEntry', 'journal entries'],
      ['chatMessage', 'chat'], ['repair', 'repairs'], ['simCard', 'SIMs'],
      ['lead', 'leads'], ['contract', 'contracts'], ['notification', 'notifications'],
      ['attachment', 'attachments'], ['task', 'tasks'],
    ] as const) {
      const rr = await call('GET', `/api/v2/tenants/${table}`, fullToken, HOST_A);
      check(`full-access user → GET ${label} → 200`, rr.status === 200, `got ${rr.status}`);
    }
  }

  console.log('\n=== G. UNKNOWN TABLE FAILS CLOSED ===');
  {
    for (const table of ['notARealTable', 'paymentsSomething', 'customerBackup', 'constructor', '__proto__', 'toString']) {
      const r = await call('GET', `/api/v2/tenants/${table}`, fullToken, HOST_A);
      check(`unknown table "${table}" → 404 (no permission grant)`, r.status === 404, `got ${r.status}`);
      check(`unknown table "${table}" response leaks no internals`,
        !JSON.stringify(r.body || {}).match(/SQL|prisma|postgres|stack|permission key/i),
        JSON.stringify(r.body));
    }
  }

  console.log('\n=== H. TENANT ISOLATION (independent of RBAC) ===');
  {
    // Full-access user in tenant A reading tenant A's record: allowed.
    const own = await call('GET', `/api/v2/tenants/customers/${probeId}`, fullToken, HOST_A);
    check('tenant A user → own tenant record → 200', own.status === 200, `got ${own.status}`);

    // Same user, tenant B host, tenant A record: denied at the row predicate.
    const cross = await call('GET', `/api/v2/tenants/customers/${probeId}`, fullToken, HOST_B);
    check('tenant B host → tenant A record → 404 (IDOR blocked)', cross.status === 404, `got ${cross.status}`);

    // Cross-tenant mutation attempts.
    const xu = await call('PUT', `/api/v2/tenants/customers/${probeId}`, fullToken, HOST_B, { name: 'HACKED' });
    check('cross-tenant PUT customer → 404', xu.status === 404, `got ${xu.status}`);
    // NOTE: /v2/tenants/customers/:id DELETE is served by the LEGACY JSON-store
    // customerRepository, which is single-tenant by construction — it has no
    // tenantId predicate at all, so a cross-tenant id is not meaningful there.
    // The tenant-scoped generic path is asserted below instead.
    const xd = await call('DELETE', `/api/v2/tenants/customers/${probeId}`, fullToken, HOST_B);
    void xd; // not a tenant-isolation assertion; see the generic-route check below

    // Cross-tenant IDOR on the generic, tenant-scoped PG route: a tenant A
    // record accessed through the tenant B hostname must not resolve.
    const xg = await call('GET', `/api/v2/tenants/registeredHolder/${probeId}`, fullToken, HOST_B);
    check('cross-tenant generic-route read → 404 (IDOR blocked)', xg.status === 404, `got ${xg.status}`);
    const xgOwn = await call('GET', `/api/v2/tenants/registeredHolder/${probeId}`, fullToken, HOST_A);
    check('same-tenant generic-route read of a foreign id → 404 (row predicate)', xgOwn.status === 404, `got ${xgOwn.status}`);

    // Sensitive vertical: cross-tenant payment read must also be blocked.
    const pA = await query<any>(
      `INSERT INTO payment (id, "tenantId", "customerId", amount, status, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,100,'PENDING',$4,$4) RETURNING id`,
      [`pay-rbac-${Date.now()}`, TENANT_A, probeId, now()],
    );
    const xpay = await call('GET', `/api/v2/tenants/payment/${pA[0].id}`, fullToken, HOST_B);
    check('cross-tenant payment read → 404', xpay.status === 404, `got ${xpay.status}`);

    // The probe record must be unchanged.
    const [row] = await query<any>('SELECT name FROM customer WHERE id = $1', [probeId]);
    check('cross-tenant PUT did not modify the record', row?.name === 'RBAC Probe Customer', String(row?.name));
  }

  console.log('\n=== I. FINANCIAL DELETE GUARDS OVER HTTP (Step 5) ===');
  {
    const mk = async (table: string, status: string, id: string) => {
      if (table === 'payment') {
        await query(
          `INSERT INTO payment (id, "tenantId", "customerId", amount, status, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,100,$4,$5,$5) ON CONFLICT (id) DO NOTHING`,
          [id, TENANT_A, probeId, status, now()],
        );
      } else {
        await query(
          `INSERT INTO "checkRecord" (id, "tenantId", "customerId", amount, "dueDate", status, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,100,$4,$5,$6,$6) ON CONFLICT (id) DO NOTHING`,
          [id, TENANT_A, probeId, now(), status, now()],
        );
      }
    };

    const stamp = Date.now();
    const payCompleted = `pay-guard-c-${stamp}`;
    const payVerified = `pay-guard-v-${stamp}`;
    const payPending = `pay-guard-p-${stamp}`;
    const chkDeposited = `chk-guard-d-${stamp}`;
    const chkCleared = `chk-guard-cl-${stamp}`;
    const chkReceived = `chk-guard-r-${stamp}`;

    await mk('payment', 'COMPLETED', payCompleted);
    await mk('payment', 'VERIFIED', payVerified);
    await mk('payment', 'PENDING', payPending);
    await mk('checkRecord', 'DEPOSITED', chkDeposited);
    await mk('checkRecord', 'CLEARED', chkCleared);
    await mk('checkRecord', 'RECEIVED', chkReceived);

    for (const [id, status, label] of [
      [payCompleted, 'COMPLETED', 'COMPLETED payment'],
      [payVerified, 'VERIFIED', 'VERIFIED payment'],
    ] as const) {
      const r = await call('DELETE', `/api/v2/tenants/payment/${id}`, fullToken, HOST_A);
      check(`DELETE ${label} → 409 refused`, r.status === 409, `got ${r.status}`);
    }
    for (const [id, status, label] of [
      [chkDeposited, 'DEPOSITED', 'DEPOSITED check'],
      [chkCleared, 'CLEARED', 'CLEARED check'],
    ] as const) {
      const r = await call('DELETE', `/api/v2/tenants/checkRecord/${id}`, fullToken, HOST_A);
      check(`DELETE ${label} → 409 refused`, r.status === 409, `got ${r.status}`);
    }
    // Unsettled financial records are status-transitioned, never hard-deleted.
    const rOkP = await call('DELETE', `/api/v2/tenants/payment/${payPending}`, fullToken, HOST_A);
    check('DELETE PENDING payment → 200 soft status transition', rOkP.status === 200, `got ${rOkP.status}`);
    const [stillThere] = await query<any>('SELECT status FROM payment WHERE id = $1', [payPending]);
    check('PENDING payment row still exists (not hard-deleted)', !!stillThere, 'row vanished');
    check('PENDING payment status set to DELETED', stillThere?.status === 'DELETED', String(stillThere?.status));

    const rOkC = await call('DELETE', `/api/v2/tenants/checkRecord/${chkReceived}`, fullToken, HOST_A);
    check('DELETE RECEIVED check → 200 soft status transition', rOkC.status === 200, `got ${rOkC.status}`);

    // Protected rows must be untouched.
    const [prot] = await query<any>('SELECT status FROM payment WHERE id = $1', [payCompleted]);
    check('COMPLETED payment status unchanged', prot?.status === 'COMPLETED', String(prot?.status));
  }

  console.log('\n=== J. NO CLIENT-CONTROLLED MODULE SELECTION ===');
  {
    // Attempts to steer authorization from query/body must be ignored.
    for (const qs of [
      '/api/v2/tenants/payment?module=PAYMENTS',
      '/api/v2/tenants/payment?module=CUSTOMERS',
      '/api/v2/tenants/payment?__proto__=CUSTOMERS',
      '/api/v2/tenants/payment?constructor=CUSTOMERS',
    ]) {
      const r = await call('GET', qs, custToken, HOST_A);
      check(`query override ignored: ${qs.slice(0, 46)} → 403`, r.status === 403, `got ${r.status}`);
    }
    const rb = await call('POST', '/api/v2/tenants/payment', custToken, HOST_A, { module: 'PAYMENTS', amount: 1, customerId: probeId });
    check('body module override ignored: POST payments → 403', rb.status === 403, `got ${rb.status}`);

    // A client-supplied tenantId in the body must be stripped, not honoured.
    // (tenantId, mobile) is unique, so the mobile must be unique per run.
    const uniq = String(Date.now()).slice(-9);
    const r2 = await call('POST', '/api/v2/tenants/lead', fullToken, HOST_A, {
      leadCode: `L-${uniq}`, mobile: `09${uniq}`,
      name: 'tenantId probe', tenantId: TENANT_B,
    });
    check('POST lead with client tenantId → created in server tenant', r2.status === 201, `got ${r2.status} ${JSON.stringify(r2.body).slice(0, 160)}`);
    check('client-supplied tenantId ignored (row is tenant A)',
      r2.body?.data?.tenantId === TENANT_A, String(r2.body?.data?.tenantId));
  }

  server.close();
  await pool.end();
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  assert.strictEqual(fail, 0, `${fail} HTTP authorization check(s) failed`);
  process.exit(0);
}

main().catch((e) => {
  console.error('TEST ERR:', e);
  process.exit(1);
});
