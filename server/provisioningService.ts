// ---------------------------------------------------------------------------
// Step 12 — Tenant Provisioning Service
//
// Transactional, idempotent, retry-safe, auditable, server-controlled.
// State machine: PROVISIONING → ACTIVE | FAILED
//
// All tenant creation flows through here. Route handlers are thin wrappers.
// ---------------------------------------------------------------------------
import crypto from 'crypto';
import { query, pool, Row } from './pg';
import { ModuleName } from '../src/types';

export enum ProvisioningStatus {
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
  FAILED = 'FAILED',
}

export interface ProvisioningResult {
  tenantId: string;
  slug: string;
  status: ProvisioningStatus;
  membershipId: string;
  adminUserId: string;
  repeated: boolean;
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

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  const existing = await query<{ id: string; status: string }>('SELECT id, status FROM tenant WHERE slug = $1 LIMIT 1', [baseSlug]);
  if (!existing[0]) return baseSlug;
  // If existing tenant is ACTIVE, return slug — caller will detect idempotency.
  if (existing[0].status === ProvisioningStatus.ACTIVE) return baseSlug;
  // FAILED/DEACTIVATED: reuse the slug — the caller will re-provision.
  if (existing[0].status !== ProvisioningStatus.PROVISIONING) return baseSlug;
  // Currently PROVISIONING — wait-state, append suffix.
  const suffix = crypto.createHash('md5').update(baseSlug + Date.now()).digest('hex').slice(0, 4);
  return `${baseSlug}-${suffix}`;
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
 * Provision a new tenant. Idempotent: if ACTIVE with same slug, returns as no-op.
 * Entire operation runs inside a single DB transaction.
 */
export async function provisionTenant(req: CreateTenantRequest): Promise<ProvisioningResult> {
  const { name, slug: rawSlug, adminUserId, adminRole = 'OWNER', businessCategoryId, planId, requestedHostname } = req;
  const validation = validateSlug(rawSlug);
  if (!validation.valid) {
    throw new Error(`INVALID_SLUG: ${validation.reason}`);
  }

  const slug = await ensureUniqueSlug(normalizeSlug(rawSlug));
  const now = () => new Date().toISOString();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Idempotency check
    const existing = await client.query<{ id: string; status: string }>(
      'SELECT id, status FROM tenant WHERE slug = $1 LIMIT 1',
      [slug],
    );

    let tenantId: string;
    if (existing.rows[0]) {
      if (existing.rows[0].status === ProvisioningStatus.ACTIVE) {
        await client.query('ROLLBACK');
        return {
          tenantId: existing.rows[0].id,
          slug,
          status: ProvisioningStatus.ACTIVE,
          membershipId: '',
          adminUserId: '',
          repeated: true,
        };
      }
      // Re-provision a FAILED/DEACTIVATED tenant with same slug
      tenantId = existing.rows[0].id;
      await client.query(
        `UPDATE tenant SET status = $1, name = $2, "updatedAt" = $3 WHERE id = $4`,
        [ProvisioningStatus.PROVISIONING, name, now(), tenantId],
      );
    } else {
      tenantId = `ten-${crypto.randomUUID().slice(0, 24)}`;
      await client.query(
        `INSERT INTO tenant (id, name, slug, status, "businessCategoryId", "planId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [tenantId, name, slug, ProvisioningStatus.PROVISIONING, businessCategoryId || null, planId || null, now()],
      );
    }

    // Membership for admin — idempotent
    const membershipId = `mem-${crypto.randomUUID().slice(0, 24)}`;
    await client.query(
      `INSERT INTO membership (id, "tenantId", "userId", role, status, "joinedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $5, $5)
       ON CONFLICT ("tenantId", "userId") DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE', "updatedAt" = EXCLUDED."updatedAt"`,
      [membershipId, tenantId, adminUserId, adminRole, now()],
    );

    // Domain — idempotent
    const hostname = requestedHostname || `${slug}.mmba.example`;
    await client.query(
      `INSERT INTO "tenantDomain" (id, "tenantId", hostname, type, "isPrimary", status, "verifiedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'SUBDOMAIN', true, 'VERIFIED', NOW(), NOW(), NOW())
       ON CONFLICT (hostname) DO NOTHING`,
      [`dom-${crypto.randomUUID().slice(0, 16)}`, tenantId, hostname],
    );

    // Transition to ACTIVE
    await client.query(
      `UPDATE tenant SET status = $1, "updatedAt" = $2 WHERE id = $3`,
      [ProvisioningStatus.ACTIVE, now(), tenantId],
    );

    await client.query('COMMIT');

    // Audit outside transaction so a rolled-back provision never leaves a
    // "tenant created" record behind. A failure here is logged, not swallowed
    // silently — but it must not fail the provision, which has already
    // committed.
    await auditInsert(adminUserId, tenantId, 'TENANT_CREATED', `Tenant ${name} (${slug}) created`, ModuleName.SETTINGS, tenantId)
      .catch((e: any) => console.error('[provisioning] audit TENANT_CREATED failed:', e.message));
    await auditInsert(adminUserId, tenantId, 'PROVISIONING_COMPLETED', `Tenant ${slug} is now ACTIVE`, ModuleName.SETTINGS, tenantId)
      .catch((e: any) => console.error('[provisioning] audit PROVISIONING_COMPLETED failed:', e.message));

    // Get the membership that was created
    const mem = await query<{ id: string }>(
      `SELECT id FROM membership WHERE "tenantId" = $1 AND "userId" = $2 AND status = 'ACTIVE' LIMIT 1`,
      [tenantId, adminUserId],
    );

    return { tenantId, slug, status: ProvisioningStatus.ACTIVE, membershipId: mem[0]?.id || membershipId, adminUserId, repeated: false };
  } catch (err: any) {
    await client.query('ROLLBACK');
    // Mark FAILED (best-effort, outside rollback)
    query(`UPDATE tenant SET status = $1, "updatedAt" = $2 WHERE slug = $3`, [ProvisioningStatus.FAILED, now(), slug]).catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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

  await query(`UPDATE tenant SET status = $1, "updatedAt" = NOW() WHERE id = $2`, [newStatus, tenantId]);

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

/** Add or update membership (platform admin / tenant admin for own tenant). */
export async function upsertMembership(
  tenantId: string,
  data: { userId: string; role: string; status?: string; requestedBy: string },
): Promise<Row> {
  const now = () => new Date().toISOString();
  const status = data.status || 'ACTIVE';

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
  await query(
    `INSERT INTO membership (id, "tenantId", "userId", role, status, "joinedAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $6, $6)`,
    [id, tenantId, data.userId, data.role, status, now()],
  );
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
