import { query } from './pg';

export interface License {
  id: string;
  tenantId: string;
  planId: string;
  status: string; // PENDING | TRIAL | ACTIVE | GRACE | SUSPENDED | EXPIRED | REVOKED | CANCELLED
  issuedAt: string;
  startsAt: string;
  expiresAt: string | null;
  graceStartedAt: string | null;
  suspendedAt: string | null;
  revokedAt: string | null;
  cancelledAt: string | null;
  reason: string | null;
}

export interface Entitlement {
  id: string;
  planId: string;
  module: string;
  action: string;
  limitType: string; // FEATURE | NUMERIC | QUOTA | MODULE_ACCESS
  limitValue: number | null;
  isEnabled: boolean;
}

export const LicensingService = {
  async getTenantLicense(tenantId: string): Promise<License | null> {
    const rows = await query<License>(
      `SELECT * FROM license WHERE "tenantId" = $1`,
      [tenantId]
    );
    return rows[0] || null;
  },

  async getEffectiveLicense(tenantId: string, now: Date = new Date()): Promise<License | null> {
    const license = await this.getTenantLicense(tenantId);
    if (!license) return null;

    // Check expiration
    if (license.expiresAt) {
      const expires = new Date(license.expiresAt);
      if (expires < now) {
        // If it's active or trial, but expired, consider it expired
        if (['ACTIVE', 'TRIAL', 'GRACE'].includes(license.status)) {
          // Note: We might want to update the DB status asynchronously or return a virtual expired license.
          // The instructions say: "When a trial expires, server-side authorization must reflect the expired state even if no background job has run."
          return {
            ...license,
            status: 'EXPIRED'
          };
        }
      }
    }

    return license;
  },

  async getTenantEntitlements(tenantId: string): Promise<Entitlement[]> {
    const license = await this.getEffectiveLicense(tenantId);
    if (!license || ['EXPIRED', 'REVOKED', 'SUSPENDED', 'CANCELLED'].includes(license.status)) {
      // Restricted access
      return [];
    }

    const rows = await query<Entitlement>(
      `SELECT e.* FROM entitlement e
       JOIN license l ON l."planId" = e."planId"
       WHERE l."tenantId" = $1 AND e."isEnabled" = true`,
      [tenantId]
    );
    return rows;
  },

  async hasEntitlement(tenantId: string, module: string, action: string = 'VIEW'): Promise<boolean> {
    const license = await this.getEffectiveLicense(tenantId);
    if (!license || ['EXPIRED', 'REVOKED', 'SUSPENDED', 'CANCELLED'].includes(license.status)) {
      return false;
    }

    const rows = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM entitlement e
       JOIN license l ON l."planId" = e."planId"
       WHERE l."tenantId" = $1 AND e.module = $2 AND e.action = $3 AND e."isEnabled" = true`,
      [tenantId, module, action]
    );

    return parseInt(rows[0]?.count || '0', 10) > 0;
  },

  async getEntitlementValue(tenantId: string, module: string, action: string): Promise<number | null> {
    const license = await this.getEffectiveLicense(tenantId);
    if (!license || ['EXPIRED', 'REVOKED', 'SUSPENDED', 'CANCELLED'].includes(license.status)) {
      return null;
    }

    const rows = await query<Entitlement>(
      `SELECT e.* FROM entitlement e
       JOIN license l ON l."planId" = e."planId"
       WHERE l."tenantId" = $1 AND e.module = $2 AND e.action = $3 AND e."isEnabled" = true`,
      [tenantId, module, action]
    );

    return rows[0]?.limitValue ?? null;
  },

  async requireEntitlement(tenantId: string, module: string, action: string = 'VIEW'): Promise<void> {
    const allowed = await this.hasEntitlement(tenantId, module, action);
    if (!allowed) {
      throw new Error(`Forbidden: Tenant lacks entitlement for ${module}:${action}`);
    }
  },

  async requireQuota(tenantId: string, module: string, action: string, requestedAmount: number): Promise<void> {
    const limit = await this.getEntitlementValue(tenantId, module, action);
    if (limit === null) {
      // No limit defined, assume allowed or disallowed depending on policy. Let's assume allowed if no limit, or denied.
      // Usually, if a quota is not set, it might be unlimited or restricted. Let's say if limit is null, it's unlimited.
      return;
    }

    // Check current usage. This depends on the module. For simplicity, we can check a generic count or specific table count.
    // The prompt mentions quotas like max_users, max_customers, etc.
    let currentCount = 0;
    if (module === 'CUSTOMERS') {
      const res = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM customer WHERE "tenantId" = $1 AND "deletedAt" IS NULL`,
        [tenantId]
      );
      currentCount = parseInt(res[0]?.count || '0', 10);
    } else if (module === 'USERS' || module === 'MEMBERS') {
      const res = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM membership WHERE "tenantId" = $1 AND status = 'ACTIVE'`,
        [tenantId]
      );
      currentCount = parseInt(res[0]?.count || '0', 10);
    }

    if (currentCount + requestedAmount > limit) {
      throw new Error(`Quota exceeded for ${module}:${action}. Limit: ${limit}, Current: ${currentCount}, Requested: ${requestedAmount}`);
    }
  }
};

export const LicenseStateService = {
  validTransitions: {
    'PENDING': ['TRIAL', 'ACTIVE', 'CANCELLED'],
    'TRIAL': ['ACTIVE', 'EXPIRED', 'CANCELLED'],
    'ACTIVE': ['GRACE', 'SUSPENDED', 'CANCELLED', 'REVOKED'],
    'GRACE': ['ACTIVE', 'SUSPENDED', 'REVOKED'],
    'SUSPENDED': ['ACTIVE', 'REVOKED'],
    'EXPIRED': ['ACTIVE', 'TRIAL'],
    'REVOKED': [],
    'CANCELLED': ['ACTIVE']
  },

  canTransition(fromState: string, toState: string): boolean {
    const allowed = this.validTransitions[fromState];
    return allowed ? allowed.includes(toState) : false;
  },

  async transition(tenantId: string, newStatus: string, reason?: string, actorId?: string): Promise<License> {
    const current = await LicensingService.getTenantLicense(tenantId);
    if (!current) {
      if (newStatus === 'TRIAL' || newStatus === 'ACTIVE' || newStatus === 'PENDING') {
        // Creating a new license
        // Needs a default plan if not exists, but let's assume planId is handled elsewhere
        throw new Error('No existing license to transition from. Use creation flow.');
      }
      throw new Error('License not found');
    }

    if (!this.canTransition(current.status, newStatus)) {
      throw new Error(`Invalid license state transition from ${current.status} to ${newStatus}`);
    }

    const now = new Date().toISOString();
    let extraFields = '';
    const params: any[] = [newStatus, now, tenantId];

    if (newStatus === 'SUSPENDED') {
      extraFields = ', "suspendedAt" = $2, "reason" = $4';
      params.push(reason || null);
    } else if (newStatus === 'REVOKED') {
      extraFields = ', "revokedAt" = $2, "reason" = $4';
      params.push(reason || null);
    } else if (newStatus === 'CANCELLED') {
      extraFields = ', "cancelledAt" = $2, "reason" = $4';
      params.push(reason || null);
    } else if (newStatus === 'GRACE') {
      extraFields = ', "graceStartedAt" = $2';
    }

    const queryStr = `
      UPDATE license
      SET status = $1, "updatedAt" = $2 ${extraFields}
      WHERE "tenantId" = $3
      RETURNING *
    `;

    const rows = await query<License>(queryStr, params);

    // Audit log
    await query(
      `INSERT INTO "auditLog" (id, "tenantId", timestamp, "userId", "userName", action, module, "targetId", "targetType", details, result)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'SUCCESS')`,
      [
        tenantId,
        now,
        actorId || null,
        actorId ? 'Admin' : 'System',
        `LICENSE_${newStatus}`,
        'LICENSING',
        current.id,
        'License',
        `Transitioned from ${current.status} to ${newStatus}. Reason: ${reason || 'None'}`
      ]
    );

    return rows[0];
  }
};
