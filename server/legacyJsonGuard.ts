// ---------------------------------------------------------------------------
// Step 12 FIX §17 / §18 — Legacy JSON tenant-path gate
//
// The audit found ~160 tenant-facing routes still reading the single global
// JSON store (centralDb). That store has no tenant column, so every one of
// them is a cross-tenant read. The worst is GET /api/sync/all, which returns
// the entire dataset — every customer, chat message, payment and attachment —
// to any authenticated user.
//
// The spec allows either migrating each path to PostgreSQL or blocking it from
// tenant-facing production access. Migrating 160 routes is a project; leaving
// them live is a data breach. So this gate blocks them.
//
// What the gate does NOT do, and why:
//   • It does not delete any route. The handler stays registered; in
//     development it still runs, so the app is usable and the migration can
//     proceed one domain at a time.
//   • It does not weaken the PostgreSQL path. /v2/tenants/* and /v2/tenant/*
//     are never matched here — they are already tenant-scoped.
//
// The block is environment-gated:
//   production           → blocked (the safe default; this is the spec case)
//   development/test     → allowed, with a startup warning listing the
//                          surface still to be migrated
//   ALLOW_LEGACY_JSON_TENANT_PATHS=1
//                        → allowed in ANY environment. An explicit operator
//                          opt-in for a staged cutover, never a default.
//
// Every block returns 409 with a machine-readable error code, so a client can
// distinguish "this capability is not available on this deployment" from
// "you are not allowed" and from "not found".
// ---------------------------------------------------------------------------
import { Request, Response, NextFunction } from 'express';

/**
 * Tenant-owned API surface that is still backed by the global JSON store.
 *
 * Matched as path PREFIXES against the router-relative path (the part after
 * /api or /api/v1), so `/payments/42/finance-review` matches `/payments`.
 * Keep this list in the same order as the domain table in the Step 12 FIX
 * report; each entry is a migration target, not just a block.
 */
export const LEGACY_TENANT_JSON_PREFIXES: readonly string[] = [
  // Full-store sync. A complete cross-tenant dump/push — the single worst.
  '/sync',
  // Cross-tenant customer/lead/payment search by phone number.
  '/contacts',
  // Business domains, each with a PostgreSQL destination already modelled.
  '/leads',
  '/customers',
  '/calls',
  '/interactions',
  '/voice-notes',
  '/tasks',
  '/contracts',
  '/payments',
  '/checks',
  '/sims',
  '/repairs',
  '/registered-holders',
  '/contract-installments',
  // Binary file content — cross-tenant disclosure of documents and ID images.
  '/attachments',
  // Chat: conversations, messages, membership.
  '/conversations',
  '/broadcasts',
  // Audit trail and per-tenant problem reports.
  '/audit-logs',
  '/problem-reports',
  // Accounting: chart of accounts, journal, fiscal periods.
  '/accounts',
  '/journal-entries',
  '/accounting-periods',
  '/document-shares',
  // Notifications. Classified TENANT-OWNED, not user-scoped, because two of
  // these handlers are cross-tenant as written:
  //   GET  /notifications           returns centralDb.getState().notifications
  //                                  UNFILTERED — every tenant's notifications
  //   POST /notifications/read-all  takes userId from req.body, so one user can
  //                                  mark another tenant's notifications read
  // The devices/ and settings/ sub-paths ARE genuinely user-scoped (they key
  // off the authenticated user), but they share the /notifications prefix, so
  // they are blocked as well. That is the conservative choice: leave a
  // half-migrated notification family reachable and the one unfiltered GET is
  // still a leak. Unblocking them individually is a later, explicit step.
  '/notifications',
];

/**
 * Tracked for the migration inventory, and reachable in development so the
 * client keeps working. Currently empty: every legacy prefix found by the
 * audit turned out to be tenant-visible, so none could be safely carved out as
 * user-only. It is kept as a distinct concept because the next migration step
 * is the one that will populate it.
 */
export const LEGACY_USER_SCOPED_PREFIXES: readonly string[] = [];

const ALL_PREFIXES = [...LEGACY_TENANT_JSON_PREFIXES, ...LEGACY_USER_SCOPED_PREFIXES];

/** Strip the /api or /api/v1 mount so prefixes can be written plainly. */
export function relativeApiPath(req: Request): string {
  const url = (req.originalUrl || req.url || '').split('?')[0];
  return url
    .replace(/^\/api\/v1/, '')
    .replace(/^\/api/, '')
    .replace(/\/+$/, '')
    || '/';
}

/** Whether a path falls in the blocked surface. */
export function isLegacyTenantPath(path: string): boolean {
  const p = path.replace(/\/+$/, '') || '/';
  return ALL_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/'));
}

function gateEnabled(): { blocked: boolean; reason: string } {
  if (process.env.ALLOW_LEGACY_JSON_TENANT_PATHS === '1') {
    return { blocked: false, reason: 'ALLOW_LEGACY_JSON_TENANT_PATHS=1' };
  }
  if (process.env.NODE_ENV === 'production') {
    return { blocked: true, reason: 'NODE_ENV=production' };
  }
  return { blocked: false, reason: `NODE_ENV=${process.env.NODE_ENV || 'unset'}` };
}

/**
 * The gate. Mounted immediately after resolveTenantMiddleware, before any
 * legacy handler can run.
 *
 * Only requests that actually resolve to a tenant are blocked. A request with
 * no tenant context is not a tenant-facing request, so it passes — that keeps
 * the platform and health surfaces reachable while the legacy handlers wind
 * down.
 */
export function legacyJsonTenantGate(req: Request, res: Response, next: NextFunction): void {
  const path = relativeApiPath(req);
  if (!isLegacyTenantPath(path)) return next();

  const { blocked, reason } = gateEnabled();
  if (!blocked) return next();

  const tenant = (req as any).tenantContext;
  if (!tenant) return next(); // not a tenant-facing request

  res.status(409).json({
    success: false,
    error: 'LEGACY_JSON_PATH_DISABLED',
    message:
      'این مسیر هنوز به فروشگاه داده سراسری متصل است و در محیط چندمستاجری در دسترس نیست. ' +
      'از مسیرهای PostgreSQL نسخه ۲ استفاده کنید.',
    detail: {
      path,
      reason,
      // Name the PostgreSQL replacement so the client (and the operator
      // reading a log) knows where the capability went.
      useInstead: '/api/v2/tenants/:table',
      trackedBy: 'MMBA_STEP_12_FIX §17/§18',
    },
  });
}

/** Startup diagnostics: what is still on the JSON store, per environment. */
export function describeLegacySurface(): {
  total: number;
  tenantOwned: number;
  userScoped: number;
  blockedInThisEnv: boolean;
  reason: string;
} {
  const { blocked, reason } = gateEnabled();
  return {
    total: ALL_PREFIXES.length,
    tenantOwned: LEGACY_TENANT_JSON_PREFIXES.length,
    userScoped: LEGACY_USER_SCOPED_PREFIXES.length,
    blockedInThisEnv: blocked,
    reason,
  };
}
