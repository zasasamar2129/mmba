// ---------------------------------------------------------------------------
// Step 12 — Tenant Provisioning Service
//
// Step 12 FIX changes, all of them load-bearing:
//
//  §FIX-C  Concurrency. The old flow did "SELECT slug … if none, INSERT", so
//          N concurrent requests for one slug all passed the precheck and N
//          tenants were created. Now the INSERT is the sole authority: the DB
//          UNIQUE(slug) constraint decides the winner, and every loser is
//          re-read and answered deterministically as `repeated: true`. Nothing
//          ever updates "the tenant with this slug" on the error path — a
//          losing request can no longer mark the winner's tenant FAILED.
//
//  §FIX-D  Domains. A hostname is only auto-verified when the platform owns
//          the parent domain (see hostnamePolicy). A requested custom domain
//          lands as PENDING and is never routable until an explicit
//          verification operation promotes it.
//
//  §FIX-E  Identity. `adminUserId` must be a row in the authoritative
//          PostgreSQL `user` table — a membership can never reference a user
//          that exists only in the legacy JSON store.
//
// All tenant creation flows through here. Route handlers are thin wrappers.
// ---------------------------------------------------------------------------
import crypto from 'crypto';
import { query, execute, pool, Row } from './pg';
import { ModuleName } from '../src/types';
import { classifyHostname, platformSubdomainForSlug, isAutoVerifiableHostname } from './hostnamePolicy';

export enum ProvisioningStatus {
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
  FAILED = 'FAILED',
}

export enum DomainStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  DISABLED = 'DISABLED',
}

export enum DomainType {
  SUBDOMAIN = 'SUBDOMAIN',
  CUSTOM_DOMAIN = 'CUSTOM_DOMAIN',
}

export interface ProvisioningResult {
  tenantId: string;
  slug: string;
  status: ProvisioningStatus;
  membershipId: string;
  adminUserId: string;
  repeated: boolean;
  /** Hostname the tenant was actually given, and whether it can serve traffic. */
  domain: {
    hostname: string;
    type: DomainType;
    status: DomainStatus;
    routable: boolean;
  };
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  adminUserId: string;
  adminRole?: string;
  businessCategoryId?: string;
  planId?: string;
  requestedHostname?: string;
}

/** Thrown when the requested slug is already taken by a live tenant. */
export class SlugConflictError extends Error {
  public readonly code = 'SLUG_CONFLICT';
  constructor(public readonly slug: string, public readonly tenantId: string) {
    super(`SLUG_CONFLICT: ${slug}`);
  }
}

const RESERVED_SLUGS = new Set([
  'www', 'admin', 'api', 'app', 'mail', 'support', 'static', 'assets',
  'platform', 'console', 'dashboard', 'root', '',
]);

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}

export function validateSlug(slug: string): { valid: boolean; reason?: string } {
  if (!slug || slug.length < 2) return { valid: false, reason: 'SLUG_TOO_SHORT' };
  if (slug.length > 63) return { valid: false, reason: 'SLUG_TOO_LONG' };
  if (!SLUG_PATTERN.test(slug)) return { valid: false, reason: 'SLUG_INVALID_CHARS' };
  if (RESERVED_SLUGS.has(slug)) return { valid: false, reason: 'SLUG_RESERVED' };
  return { valid: true };
}

/** Postgres unique-violation. The single source of truth for "already taken". */
function isUniqueViolation(err: any): boolean {
  return err && (err.code === '23505' || err.code === '23514');
}

async function auditInsert(
  actorUserId: string,
  tenantId: string,
  action: string,
  details: string,
  module: ModuleName = ModuleName.SETTINGS,
  targetId?: string,
) {
  await query(
    `INSERT INTO "auditLog" (id, "tenantId", timestamp, "userId", "userName", "userRole", action, module, "entityType", "targetId", result, "createdAt")
     VALUES ($1, $2, NOW(), $3, 'system', 'PLATFORM_ADMIN', $4, $5, $6, $7, 'SUCCESS', NOW())`,
    [crypto.randomUUID(), tenantId, actorUserId, action, module, targetId || '', targetId || ''],
  );
}

/**
 * Decide the hostname + trust level a new tenant gets (FIX D).
 *
 * - No hostname requested  -> platform subdomain under a parent we own.
 *                             Auto-verified: we control the zone, so we can
 *                             assert control without asking anyone.
 * - Requested hostname that IS a platform subdomain -> same, auto-verified.
 * - Requested hostname that is NOT a platform subdomain -> CUSTOM_DOMAIN,
 *                             status PENDING, verifiedAt NULL, NOT routable.
 *                             The client asking for a name proves nothing
 *                             about who controls that DNS zone.
 */
export function resolveProvisioningDomain(
  slug: string,
  requestedHostname: string | undefined,
): { hostname: string; type: DomainType; status: DomainStatus; routable: boolean } {
  const requested = (requestedHostname || '').trim();
  if (!requested) {
    const hostname = platformSubdomainForSlug(slug);
    return { hostname, type: DomainType.SUBDOMAIN, status: DomainStatus.VERIFIED, routable: true };
  }

  const classified = classifyHostname(requested);
  if (isAutoVerifiableHostname(requested)) {
    return {
      hostname: classified.hostname,
      type: DomainType.SUBDOMAIN,
      status: DomainStatus.VERIFIED,
      routable: true,
    };
  }

  // Custom domain: never VERIFIED here. Only verifyDomain() may do that.
  return {
    hostname: classified.hostname,
    type: DomainType.CUSTOM_DOMAIN,
    status: DomainStatus.PENDING,
    routable: false,
  };
}

/** Read the tenant's primary domain, resolved. */
export async function getTenantDomain(tenantId: string): Promise<Row | null> {
  const rows = await query<Row>(
    `SELECT id, "tenantId", hostname, type, "isPrimary", status, "verifiedAt", "createdAt", "updatedAt"
     FROM "tenantDomain" WHERE "tenantId" = $1 ORDER BY "isPrimary" DESC, "createdAt" ASC LIMIT 1`,
    [tenantId],
  );
  return rows[0] || null;
}

/**
 * Promote a PENDING domain to VERIFIED — the ONLY path to that state.
 *
 * FIX D: `proof` is the output of a real control check (DNS TXT / HTTP
 * challenge), performed by the caller. A client-supplied flag can never reach
 * this function: the route layer ignores any `verified` field in the body.
 * Platform subdomains short-circuit because the platform owns the zone.
 */
export async function verifyDomain(
  domainId: string,
  actorUserId: string,
  proof: { method: string; token: string },
): Promise<Row> {
  const rows = await query<Row>('SELECT * FROM "tenantDomain" WHERE id = $1 LIMIT 1', [domainId]);
  const domain = rows[0];
  if (!domain) throw new Error('DOMAIN_NOT_FOUND');

  // Already verified — idempotent.
  if (domain.status === DomainStatus.VERIFIED) return domain;
  if (domain.status === DomainStatus.DISABLED) {
    throw new Error(`INVALID_TRANSITION: DISABLED → VERIFIED`);
  }
  if (domain.status === DomainStatus.REJECTED) {
    throw new Error(`INVALID_TRANSITION: REJECTED → VERIFIED`);
  }
  if (!proof || !proof.method || !proof.token) {
    throw new Error('VERIFICATION_PROOF_REQUIRED');
  }

  const updated = await query<Row>(
    `UPDATE "tenantDomain" SET status = $1, "verifiedAt" = NOW(), "updatedAt" = NOW()
     WHERE id = $2 AND status = $3 RETURNING *`,
    [DomainStatus.VERIFIED, domainId, DomainStatus.PENDING],
  );
  if (!updated[0]) {
    // Lost a race with a concurrent verify — re-read and accept the winner.
    const current = await query<Row>('SELECT * FROM "tenantDomain" WHERE id = $1 LIMIT 1', [domainId]);
    if (current[0]?.status === DomainStatus.VERIFIED) return current[0];
    throw new Error('VERIFY_CONFLICT');
  }

  await auditInsert(
    actorUserId,
    domain.tenantId,
    'DOMAIN_VERIFIED',
    `Domain ${domain.hostname} verified via ${proof.method}`,
    ModuleName.SETTINGS,
    domainId,
  ).catch(() => {});

  return updated[0];
}

/** Withdraw a domain's routing rights without deleting the record. */
export async function disableDomain(domainId: string, actorUserId: string): Promise<Row> {
  const rows = await query<Row>('SELECT * FROM "tenantDomain" WHERE id = $1 LIMIT 1', [domainId]);
  const domain = rows[0];
  if (!domain) throw new Error('DOMAIN_NOT_FOUND');
  const updated = await query<Row>(
    `UPDATE "tenantDomain" SET status = $1, "isPrimary" = false, "updatedAt" = NOW() WHERE id = $2 RETURNING *`,
    [DomainStatus.DISABLED, domainId],
  );
  await auditInsert(
    actorUserId,
    domain.tenantId,
    'DOMAIN_DISABLED',
    `Domain ${domain.hostname} disabled`,
    ModuleName.SETTINGS,
    domainId,
  ).catch(() => {});
  return updated[0];
}

/**
 * Provision a new tenant.
 *
 * Concurrency contract (FIX C): for N simultaneous requests with the same
 * slug, exactly one INSERT wins the UNIQUE(slug) race and returns
 * `repeated: false`. Every loser detects the violation, re-reads the winning
 * tenant, and returns `repeated: true` with the winner's id. No loser mutates
 * the winner's row.
 *
 * Everything the tenant needs (tenant, membership, domain, ACTIVE transition)
 * happens in ONE transaction, so a failure rolls the whole thing back and
 * there is no half-provisioned tenant to clean up.
 */
export async function provisionTenant(req: CreateTenantRequest): Promise<ProvisioningResult> {
  const { name, slug: rawSlug, adminUserId, adminRole = 'OWNER', businessCategoryId, planId, requestedHostname } = req;
  const validation = validateSlug(rawSlug);
  if (!validation.valid) {
    throw new Error(`INVALID_SLUG: ${validation.reason}`);
  }

  // FIX-C: the slug is used verbatim. No pre-check, no random suffix — a
  // suffix would let two racers both "succeed" with different tenants, which
  // is exactly the bug. The normalized slug is what we ask the DB for; the DB
  // decides who gets it.
  const slug = normalizeSlug(rawSlug);
  if (!validateSlug(slug).valid) {
    throw new Error(`INVALID_SLUG: ${validateSlug(slug).reason}`);
  }

  // FIX-E: refuse to build a membership for a user the authoritative store
  // does not have. A membership pointing at a JSON-only user would be a
  // dangling identity the moment anything reads from PostgreSQL.
  const adminRow = await query<{ id: string; status: string }>(
    'SELECT id, status FROM "user" WHERE id = $1 LIMIT 1',
    [adminUserId],
  );
  if (!adminRow[0]) {
    throw new Error('ADMIN_USER_NOT_IN_PG');
  }

  const domainSpec = resolveProvisioningDomain(slug, requestedHostname);
  const now = new Date().toISOString();

  const client = await pool.connect();
  let tenantId = '';
  // Tracks whether a transaction is open, so the catch block never issues a
  // ROLLBACK against a connection that has already been rolled back (which
  // PostgreSQL reports as 25P01 and would mask the real error).
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;

    // The INSERT is the authority. No prior SELECT, no check-then-act gap.
    // A FAILED/DEACTIVATED tenant holding this slug is re-provisioned in
    // place (guarded by id, so we only ever touch our own row).
    tenantId = `ten-${crypto.randomUUID().slice(0, 24)}`;
    try {
      await client.query(
        `INSERT INTO tenant (id, name, slug, status, "businessCategoryId", "planId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [tenantId, name, slug, ProvisioningStatus.PROVISIONING, businessCategoryId || null, planId || null, now],
      );
    } catch (insertErr: any) {
      if (!isUniqueViolation(insertErr)) throw insertErr;

      // Postgres aborts the whole transaction on a constraint violation — the
      // connection is now poisoned and every further statement on it fails
      // with 25P02. So: ROLLBACK first, re-acquire the winner's state on a
      // fresh transaction, and only then decide. Reading the winner before
      // rolling back is the bug this replaces.
      await client.query('ROLLBACK').catch(() => {});
      inTransaction = false;

      const winner = await query<{ id: string; status: string }>(
        'SELECT id, status FROM tenant WHERE slug = $1 LIMIT 1',
        [slug],
      );
      const won = winner[0];
      if (!won) {
        // The conflicting row vanished between the failed insert and this read
        // (the winner rolled back). Surface it as a conflict rather than
        // silently picking a different tenant.
        throw new SlugConflictError(slug, '');
      }
      if (won.status === ProvisioningStatus.FAILED || won.status === ProvisioningStatus.DEACTIVATED) {
        // Retryable: the slot exists but the tenant is dead. Try once more as
        // a fresh attempt against the same slug.
        return provisionTenantOnExistingRow(slug, {
          name, slug, adminUserId, adminRole, businessCategoryId, planId,
          domainSpec, existingTenantId: won.id,
        });
      }
      // ACTIVE / PROVISIONING / SUSPENDED: someone owns this slug. Report
      // their tenant, do not touch it.
      return describeExistingTenant(won.id, slug, adminUserId);
    }

    // Membership — one per (tenant, user); the unique constraint enforces it.
    const membershipId = `mem-${crypto.randomUUID().slice(0, 24)}`;
    await client.query(
      `INSERT INTO membership (id, "tenantId", "userId", role, status, "joinedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $5, $5)
       ON CONFLICT ("tenantId", "userId") DO UPDATE
         SET role = EXCLUDED.role, status = 'ACTIVE', "updatedAt" = EXCLUDED."updatedAt"`,
      [membershipId, tenantId, adminUserId, adminRole, now],
    );

    // Domain — created with the trust level resolveProvisioningDomain decided.
    // verifiedAt is set ONLY for an auto-verifiable platform subdomain.
    const verifiedAt = domainSpec.status === DomainStatus.VERIFIED ? now : null;
    await client.query(
      `INSERT INTO "tenantDomain" (id, "tenantId", hostname, type, "isPrimary", status, "verifiedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, true, $5, $6, $7, $7)
       ON CONFLICT (hostname) DO NOTHING`,
      [`dom-${crypto.randomUUID().slice(0, 16)}`, tenantId, domainSpec.hostname, domainSpec.type, domainSpec.status, verifiedAt, now],
    );

    // Transition to ACTIVE, scoped to the id we just inserted.
    await client.query(
      `UPDATE tenant SET status = $1, "updatedAt" = $2 WHERE id = $3 AND status = $4`,
      [ProvisioningStatus.ACTIVE, now, tenantId, ProvisioningStatus.PROVISIONING],
    );

    await client.query('COMMIT');
    inTransaction = false;

    await auditInsert(adminUserId, tenantId, 'TENANT_CREATED', `Tenant ${name} (${slug}) created`, ModuleName.SETTINGS, tenantId)
      .catch((e: any) => console.error('[provisioning] audit TENANT_CREATED failed:', e.message));
    await auditInsert(adminUserId, tenantId, 'PROVISIONING_COMPLETED', `Tenant ${slug} is now ACTIVE`, ModuleName.SETTINGS, tenantId)
      .catch((e: any) => console.error('[provisioning] audit PROVISIONING_COMPLETED failed:', e.message));

    return {
      tenantId,
      slug,
      status: ProvisioningStatus.ACTIVE,
      membershipId,
      adminUserId,
      repeated: false,
      domain: domainSpec,
    };
  } catch (err: any) {
    // Roll back our own work only. We never touch another request's tenant:
    // the ROLLBACK already undid the insert, and there is deliberately NO
    // "UPDATE tenant SET status='FAILED' WHERE slug=…" here — that statement
    // was the race that let a loser mark the winner's tenant FAILED.
    if (inTransaction) {
      await client.query('ROLLBACK').catch(() => {});
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Re-provision a FAILED/DEACTIVATED tenant that already holds the slug.
 * Every statement is guarded by the tenant id, so this can only ever modify
 * that one row.
 */
async function provisionTenantOnExistingRow(
  slug: string,
  args: {
    name: string;
    slug: string;
    adminUserId: string;
    adminRole: string;
    businessCategoryId?: string;
    planId?: string;
    domainSpec: { hostname: string; type: DomainType; status: DomainStatus; routable: boolean };
    existingTenantId: string;
  },
): Promise<ProvisioningResult> {
  const { name, adminUserId, adminRole, businessCategoryId, planId, domainSpec, existingTenantId } = args;
  const now = new Date().toISOString();
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;

    // Claim the dead row for THIS attempt. The `status IN (FAILED, DEACTIVATED)`
    // predicate makes this a compare-and-swap: if two retries race, exactly one
    // flips the row out of FAILED and the other's UPDATE affects 0 rows.
    const claimed = await client.query(
      `UPDATE tenant
          SET status = $1, name = COALESCE($2, name),
              "businessCategoryId" = $3, "planId" = $4, "updatedAt" = $5
        WHERE id = $6 AND status IN ('FAILED', 'DEACTIVATED')
        RETURNING id`,
      [ProvisioningStatus.PROVISIONING, name, businessCategoryId || null, planId || null, now, existingTenantId],
    );
    if (!claimed.rows[0]) {
      await client.query('ROLLBACK').catch(() => {});
      inTransaction = false;
      // Someone else re-provisioned it first — report their result.
      return describeExistingTenant(existingTenantId, slug, adminUserId);
    }

    const membershipId = `mem-${crypto.randomUUID().slice(0, 24)}`;
    await client.query(
      `INSERT INTO membership (id, "tenantId", "userId", role, status, "joinedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $5, $5)
       ON CONFLICT ("tenantId", "userId") DO UPDATE
         SET role = EXCLUDED.role, status = 'ACTIVE', "updatedAt" = EXCLUDED."updatedAt"`,
      [membershipId, existingTenantId, adminUserId, adminRole, now],
    );

    const verifiedAt = domainSpec.status === DomainStatus.VERIFIED ? now : null;
    await client.query(
      `INSERT INTO "tenantDomain" (id, "tenantId", hostname, type, "isPrimary", status, "verifiedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       ON CONFLICT (hostname) DO NOTHING`,
      [`dom-${crypto.randomUUID().slice(0, 16)}`, existingTenantId, domainSpec.hostname, domainSpec.type, domainSpec.status, verifiedAt, now],
    );

    await client.query(
      `UPDATE tenant SET status = $1, "updatedAt" = $2 WHERE id = $3 AND status = $4`,
      [ProvisioningStatus.ACTIVE, now, existingTenantId, ProvisioningStatus.PROVISIONING],
    );

    await client.query('COMMIT');
    inTransaction = false;

    await auditInsert(adminUserId, existingTenantId, 'TENANT_REPROVISIONED', `Tenant ${name} (${slug}) re-provisioned`, ModuleName.SETTINGS, existingTenantId)
      .catch(() => {});

    return {
      tenantId: existingTenantId,
      slug,
      status: ProvisioningStatus.ACTIVE,
      membershipId,
      adminUserId,
      repeated: false,
      domain: domainSpec,
    };
  } catch (err: any) {
    if (inTransaction) {
      await client.query('ROLLBACK').catch(() => {});
    }
    // Now — and only now — is it safe to mark FAILED, because this attempt
    // owns the row exclusively (the compare-and-swap above either claimed it
    // or we returned early). Scoped by id, never by slug.
    if (existingTenantId) {
      await query(
        `UPDATE tenant SET status = $1, "updatedAt" = $2 WHERE id = $3 AND status = $4`,
        [ProvisioningStatus.FAILED, new Date().toISOString(), existingTenantId, ProvisioningStatus.PROVISIONING],
      ).catch(() => {});
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Build the response for a slug owned by someone else. Read-only: this is the
 * losing request's answer, so it must not modify the winning tenant.
 */
async function describeExistingTenant(
  tenantId: string,
  slug: string,
  adminUserId: string,
): Promise<ProvisioningResult> {
  const [tenant, domain, membership] = await Promise.all([
    query<{ id: string; status: string }>('SELECT id, status FROM tenant WHERE id = $1 LIMIT 1', [tenantId]),
    getTenantDomain(tenantId),
    query<{ id: string }>(
      `SELECT id FROM membership WHERE "tenantId" = $1 AND "userId" = $2 AND status = 'ACTIVE' LIMIT 1`,
      [tenantId, adminUserId],
    ),
  ]);
  const status = (tenant[0]?.status || ProvisioningStatus.ACTIVE) as ProvisioningStatus;
  return {
    tenantId,
    slug,
    status,
    membershipId: membership[0]?.id || '',
    adminUserId,
    repeated: true,
    domain: {
      hostname: String(domain?.hostname || ''),
      type: (domain?.type === DomainType.CUSTOM_DOMAIN ? DomainType.CUSTOM_DOMAIN : DomainType.SUBDOMAIN) as DomainType,
      status: String(domain?.status || DomainStatus.PENDING) as DomainStatus,
      routable: String(domain?.status || '').toUpperCase() === 'VERIFIED'
        || String(domain?.status || '').toUpperCase() === 'ACTIVE',
    },
  };
}

/**
 * Allowed status transitions. DEACTIVATED and FAILED both accept
 * PROVISIONING as a recovery path so a failed or retired tenant can be
 * re-provisioned without hand-editing the row; every other edge is explicit.
 * Note DEACTIVATED -> ACTIVE is deliberately NOT allowed: recovery has to go
 * back through PROVISIONING so the mandatory records are re-verified.
 */
const VALID_TRANSITIONS: Record<string, ProvisioningStatus[]> = {
  [ProvisioningStatus.PROVISIONING]: [ProvisioningStatus.ACTIVE, ProvisioningStatus.FAILED],
  [ProvisioningStatus.ACTIVE]: [ProvisioningStatus.SUSPENDED, ProvisioningStatus.DEACTIVATED],
  [ProvisioningStatus.SUSPENDED]: [ProvisioningStatus.ACTIVE, ProvisioningStatus.DEACTIVATED],
  [ProvisioningStatus.DEACTIVATED]: [ProvisioningStatus.PROVISIONING],
  [ProvisioningStatus.FAILED]: [ProvisioningStatus.PROVISIONING],
};

/** Transition a tenant's provisioning status. Enforces valid transitions. */
export async function transitionTenantStatus(
  tenantId: string,
  newStatus: ProvisioningStatus,
  actorUserId: string,
): Promise<ProvisioningStatus> {
  const rows = await query<{ id: string; status: string }>('SELECT id, status FROM tenant WHERE id = $1 LIMIT 1', [tenantId]);
  if (!rows[0]) throw new Error('TENANT_NOT_FOUND');

  const current = rows[0].status;
  const allowed = VALID_TRANSITIONS[current] || [];
  if (!allowed.includes(newStatus as ProvisioningStatus)) {
    throw new Error(`INVALID_TRANSITION: ${current} → ${newStatus}`);
  }

  // Compare-and-swap on the status we just read. Without the predicate, two
  // concurrent transitions from the same state could both "win" and the last
  // writer would silently skip the state-machine check the other one passed.
  const applied = await execute(
    `UPDATE tenant SET status = $1, "updatedAt" = NOW() WHERE id = $2 AND status = $3`,
    [newStatus, tenantId, current],
  );
  if (applied === 0) {
    const now = await query<{ status: string }>('SELECT status FROM tenant WHERE id = $1 LIMIT 1', [tenantId]);
    throw new Error(`TRANSITION_CONFLICT: ${current} → ${newStatus} (now ${now[0]?.status})`);
  }

  const actionMap: Record<string, string> = {
    [ProvisioningStatus.ACTIVE]: 'TENANT_ACTIVATED',
    [ProvisioningStatus.SUSPENDED]: 'TENANT_SUSPENDED',
    [ProvisioningStatus.DEACTIVATED]: 'TENANT_DEACTIVATED',
    [ProvisioningStatus.FAILED]: 'PROVISIONING_FAILED',
  };

  await auditInsert(
    actorUserId,
    tenantId,
    actionMap[newStatus] || 'STATUS_CHANGE',
    `Tenant ${tenantId} status: ${current} → ${newStatus}`,
    ModuleName.SETTINGS,
    tenantId,
  ).catch(() => {});

  return newStatus as ProvisioningStatus;
}

/** List all tenants (platform admin). */
export async function listTenants(): Promise<Row[]> {
  return query<Row>(
    `SELECT id, name, slug, status, "businessCategoryId", "planId", "createdAt", "updatedAt"
     FROM tenant ORDER BY "createdAt" DESC`,
  );
}

/** Get a single tenant (platform admin). */
export async function getTenant(tenantId: string): Promise<Row | null> {
  const rows = await query<Row>(
    `SELECT id, name, slug, status, "businessCategoryId", "planId", "createdAt", "updatedAt"
     FROM tenant WHERE id = $1 LIMIT 1`,
    [tenantId],
  );
  return rows[0] || null;
}

/** List members of a tenant. Tenant-scoped. */
export async function listMembers(tenantId: string): Promise<Row[]> {
  return query<Row>(
    `SELECT m.id, m."tenantId", m."userId", u.name, u.username, u.email, m.role, m.status, m."joinedAt", m."updatedAt"
     FROM membership m JOIN "user" u ON u.id = m."userId"
     WHERE m."tenantId" = $1 ORDER BY m."joinedAt" DESC`,
    [tenantId],
  );
}

/**
 * Add or update membership (platform admin / tenant admin for own tenant).
 *
 * FIX E: the target user MUST exist in the authoritative PostgreSQL `user`
 * table. The FK would catch a bad insert, but a raw 500 tells the caller
 * nothing — we check first and throw a named error the routes map to 404. We
 * never auto-create a PG user from JSON data here: identity bridging is the
 * bridge module's job, not a side effect of adding a member.
 */
export async function upsertMembership(
  tenantId: string,
  data: { userId: string; role: string; status?: string; requestedBy: string },
): Promise<Row> {
  const now = () => new Date().toISOString();
  const status = data.status || 'ACTIVE';

  const user = await query<{ id: string }>('SELECT id FROM "user" WHERE id = $1 LIMIT 1', [data.userId]);
  if (!user[0]) throw new Error('USER_NOT_IN_PG');

  const tenant = await query<{ id: string }>('SELECT id FROM tenant WHERE id = $1 LIMIT 1', [tenantId]);
  if (!tenant[0]) throw new Error('TENANT_NOT_FOUND');

  const existing = await query<{ id: string }>(
    `SELECT id FROM membership WHERE "tenantId" = $1 AND "userId" = $2`,
    [tenantId, data.userId],
  );

  if (existing[0]) {
    await query(
      `UPDATE membership SET role = $1, status = $2, "updatedAt" = $3 WHERE id = $4`,
      [data.role, status, now(), existing[0].id],
    );
    await auditInsert(data.requestedBy, tenantId, 'MEMBERSHIP_UPDATED', `User ${data.userId} role→${data.role}`, ModuleName.SETTINGS, existing[0].id).catch(() => {});
    return (await query<Row>(`SELECT * FROM membership WHERE id = $1`, [existing[0].id]))[0];
  }

  const id = `mem-${crypto.randomUUID().slice(0, 24)}`;
  try {
    await query(
      `INSERT INTO membership (id, "tenantId", "userId", role, status, "joinedAt", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$6,$6)
       ON CONFLICT ("tenantId", "userId") DO UPDATE
         SET role = EXCLUDED.role, status = EXCLUDED.status, "updatedAt" = EXCLUDED."updatedAt"`,
      [id, tenantId, data.userId, data.role, status, now()],
    );
  } catch (err: any) {
    // Two concurrent adds of the same (tenant, user): the unique constraint
    // picks one. The loser re-reads and returns the same membership rather
    // than surfacing a 500 for what is a no-op.
    if (isUniqueViolation(err)) {
      const existingNow = await query<Row>(
        `SELECT * FROM membership WHERE "tenantId" = $1 AND "userId" = $2 LIMIT 1`,
        [tenantId, data.userId],
      );
      if (existingNow[0]) return existingNow[0];
    }
    throw err;
  }
  await auditInsert(data.requestedBy, tenantId, 'MEMBERSHIP_CREATED', `User ${data.userId} added as ${data.role}`, ModuleName.SETTINGS, id).catch(() => {});
  return (await query<Row>(`SELECT * FROM membership WHERE id = $1`, [id]))[0];
}

/** Remove (deactivate) a membership. Returns false if not found. */
export async function removeMembership(tenantId: string, membershipId: string, requestedBy: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM membership WHERE id = $1 AND "tenantId" = $2 AND status != 'REMOVED'`,
    [membershipId, tenantId],
  );
  if (!rows[0]) return false;

  await query(
    `UPDATE membership SET status = 'REMOVED', "removedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
    [membershipId],
  );
  await auditInsert(requestedBy, tenantId, 'MEMBERSHIP_REMOVED', `Membership ${membershipId} removed`, ModuleName.SETTINGS, membershipId).catch(() => {});
  return true;
}
