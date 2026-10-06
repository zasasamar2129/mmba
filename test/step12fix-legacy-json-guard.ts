// ---------------------------------------------------------------------------
// Step 12 FIX §17/§18 — Legacy JSON tenant-path gate tests
//
// Run: npx tsx test/step12fix-legacy-json-guard.ts
//
// The audit found ~160 tenant-facing routes still reading the single global
// JSON store, and GET /api/sync/all returning the entire dataset to any
// authenticated user. This suite proves the gate closes that surface in
// production and does not close the PostgreSQL path.
//
// Two environments are exercised in one process by flipping NODE_ENV, because
// the gate reads it per request — the same code path, two configurations.
// ---------------------------------------------------------------------------
import { bootstrap, Tally } from './harness';

bootstrap();

import {
  isLegacyTenantPath,
  relativeApiPath,
  describeLegacySurface,
  LEGACY_TENANT_JSON_PREFIXES,
  LEGACY_USER_SCOPED_PREFIXES,
} from '../server/legacyJsonGuard';

const tally = new Tally('step12fix-legacy-json-guard');

// ─── Path classification ─────────────────────────────────────────────────

tally.section('Path classification (§17 inventory)');

const MUST_BLOCK = [
  '/sync/all',
  '/sync/push',
  '/sync/version',
  '/contacts/lookup',
  '/leads',
  '/leads/abc123',
  '/customers',
  '/customers/abc123',
  '/calls',
  '/interactions',
  '/voice-notes',
  '/voice-notes/abc/audio',
  '/tasks',
  '/contracts',
  '/contracts/abc',
  '/payments',
  '/payments/abc/finance-review',
  '/checks',
  '/sims',
  '/repairs',
  '/registered-holders',
  '/registered-holders/abc/id-card',
  '/contract-installments',
  '/attachments',
  '/attachments/abc/content',
  '/attachments/abc/preview',
  '/conversations',
  '/conversations/abc/messages',
  '/conversations/abc/messages/msg1/attachments',
  '/broadcasts',
  '/audit-logs',
  '/problem-reports',
  '/accounts',
  '/journal-entries',
  '/accounting-periods',
  '/document-shares',
  // Notifications are tenant-owned, not user-scoped: GET /notifications
  // returns the whole unfiltered collection and read-all takes a client-supplied
  // userId. Blocking the whole prefix is the conservative choice.
  '/notifications',
  '/notifications/read-all',
  '/notifications/devices',
];

const mustBlockResults = MUST_BLOCK.filter((p) => isLegacyTenantPath(p));
tally.check(
  mustBlockResults.length === MUST_BLOCK.length,
  `all ${MUST_BLOCK.length} legacy JSON paths are classified (${MUST_BLOCK.length - mustBlockResults.length} missed)`,
  MUST_BLOCK.filter((p) => !isLegacyTenantPath(p)).join(', '),
);

// The PostgreSQL path and every other surface must stay open.
const MUST_ALLOW = [
  '/v2/tenants/customer',
  '/v2/tenants/customer/abc',
  '/v2/tenants/payment',
  '/v2/tenant/members',
  '/v2/platform/tenants',
  '/v2/platform/tenants/abc/domain',
  '/auth/login',
  '/auth/me',
  '/health',
  '/healthz',
  '/readyz',
  '/users',
  '/roles',
  '/settings',
  '/backups',
  '/biometrics/devices',
];

const wronglyBlocked = MUST_ALLOW.filter((p) => isLegacyTenantPath(p));
tally.check(
  wronglyBlocked.length === 0,
  `no legitimate path is classified as legacy (${wronglyBlocked.length} false positives)`,
  wronglyBlocked.join(', '),
);

// Prefix matching must not over-match: /customer and /customersearch are not
// the same resource.
tally.check(!isLegacyTenantPath('/customer'), 'singular /customer is not matched by /customers');
tally.check(!isLegacyTenantPath('/paymentsx'), '/paymentsx is not matched by /payments');
tally.check(!isLegacyTenantPath('/lead'), '/lead is not matched by /leads');

// ─── Mount-point stripping ───────────────────────────────────────────────

tally.section('Mount-point stripping');

const fakeReq = (url: string) => ({ originalUrl: url, url } as any);
tally.check(relativeApiPath(fakeReq('/api/sync/all')) === '/sync/all', 'strips /api');
tally.check(relativeApiPath(fakeReq('/api/v1/sync/all')) === '/sync/all', 'strips /api/v1');
tally.check(relativeApiPath(fakeReq('/api/v1/sync/all?x=1')) === '/sync/all', 'strips query string');
tally.check(relativeApiPath(fakeReq('/api/v2/tenants/customer')) === '/v2/tenants/customer', 'leaves /v2 paths intact');
tally.check(isLegacyTenantPath(relativeApiPath(fakeReq('/api/v1/sync/all?x=1'))), 'mounted /sync/all still classified as legacy');

// ─── Environment gating ──────────────────────────────────────────────────

tally.section('Environment gating');

const ORIGINAL_ENV = process.env.NODE_ENV;
const ORIGINAL_ALLOW = process.env.ALLOW_LEGACY_JSON_TENANT_PATHS;

function gateWouldBlock(): boolean {
  return describeLegacySurface().blockedInThisEnv;
}

delete process.env.ALLOW_LEGACY_JSON_TENANT_PATHS;
process.env.NODE_ENV = 'production';
tally.check(gateWouldBlock(), 'production blocks the legacy tenant surface');

process.env.NODE_ENV = 'development';
tally.check(!gateWouldBlock(), 'development leaves it open for the migration work');

process.env.NODE_ENV = 'production';
process.env.ALLOW_LEGACY_JSON_TENANT_PATHS = '1';
tally.check(!gateWouldBlock(), 'explicit operator opt-in overrides the production default');

delete process.env.ALLOW_LEGACY_JSON_TENANT_PATHS;
process.env.NODE_ENV = ORIGINAL_ENV ?? 'development';
if (ORIGINAL_ALLOW !== undefined) process.env.ALLOW_LEGACY_JSON_TENANT_PATHS = ORIGINAL_ALLOW;

// ─── Inventory completeness ──────────────────────────────────────────────

tally.section('Inventory completeness');

const surface = describeLegacySurface();
tally.check(
  surface.tenantOwned === LEGACY_TENANT_JSON_PREFIXES.length,
  `${surface.tenantOwned} tenant-owned prefixes recorded`,
);
tally.check(surface.total === surface.tenantOwned + surface.userScoped, 'tenant-owned + user-scoped = total');
tally.check(surface.tenantOwned >= 20, 'inventory is non-trivial (a real audit happened)');
tally.check(
  LEGACY_USER_SCOPED_PREFIXES.length === 0,
  'no prefix is claimed user-only unless it is genuinely filtered to the caller',
);

// Every prefix must be a real, normalised path segment.
const malformed = LEGACY_TENANT_JSON_PREFIXES.filter(
  (p) => !p.startsWith('/') || p.endsWith('/') || p.includes('//') || p.includes('*'),
);
tally.check(malformed.length === 0, 'every prefix is a clean literal path', malformed.join(', '));

process.exit(tally.finish());
