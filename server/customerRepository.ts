// ---------------------------------------------------------------------------
// Step 12 — Tenant-scoped repository (PostgreSQL via pg)
//
// Every method REQUIRES tenantId. No global findById. Every SQL statement has a
// tenant predicate. tenantId comes from server-side context (tenantContext.ts),
// never from the client body/query/header.
// ---------------------------------------------------------------------------
import { query, execute, Row } from './pg';
import crypto from 'crypto';

export interface CustomerFilters {
  id?: string;
  code?: string;
  mobile?: string;
  phone?: string;
  name?: string;
  status?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}

const COLUMNS = [
  'id', 'tenantId', 'code', 'name', 'phone', 'mobile', 'nationalId', 'nationalCode',
  'email', 'company', 'companyName', 'type', 'source', 'city', 'address', 'category',
  'leadStage', 'status', 'tags', 'notes', 'creditLimit', 'assignedUserId',
  'assignedUserName', 'leadId', 'leadCode', 'registrationReason',
  'registrationReasonOther', 'jobTitle', 'createdAt', 'updatedAt', 'deletedAt',
];

export const customerRepository = {
  /** tenant-scoped list with optional text search/pagination */
  async list(tenantId: string, filters: CustomerFilters = {}) {
    const where: string[] = [`"tenantId" = $1`, '"deletedAt" IS NULL'];
    const params: unknown[] = [tenantId];
    if (filters.id) { params.push(filters.id); where.push(`"id" = $${params.length}`); }
    if (filters.code) { params.push(filters.code); where.push(`"code" = $${params.length}`); }
    if (filters.mobile) { params.push(filters.mobile); where.push(`"mobile" = $${params.length}`); }
    if (filters.phone) { params.push(filters.phone); where.push(`"phone" = $${params.length}`); }
    if (filters.status) { params.push(filters.status); where.push(`"status" = $${params.length}`); }
    if (filters.query) {
      params.push(filters.query, filters.query, filters.query);
      const i = params.length - 2;
      where.push(`(LOWER("name") LIKE LOWER($${i}) OR "mobile" LIKE $${i + 1} OR "code" LIKE $${i + 2})`);
    }
    const page = filters.page || 1;
    const pageSize = Math.min(filters.pageSize || 50, 500);
    const whereSql = where.join(' AND ');
    const rows = await query<Row>(`SELECT ${COLUMNS.map((c) => `"${c}"`).join(', ')} FROM customer WHERE ${whereSql} ORDER BY "createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, (page - 1) * pageSize]);
    const [countRow] = await query<Row>(`SELECT COUNT(*) AS total FROM customer WHERE ${whereSql}`, params);
    return { rows, total: Number(countRow?.total || 0), page, pageSize };
  },

  /** tenant-scoped getById — NOT global. */
  async getById(tenantId: string, id: string) {
    const rows = await query<Row>(`SELECT ${COLUMNS.map((c) => `"${c}"`).join(', ')} FROM customer WHERE "tenantId" = $1 AND "id" = $2 AND "deletedAt" IS NULL LIMIT 1`, [tenantId, id]);
    return rows[0] || null;
  },

  /** tenant-scoped create — ignores any client-supplied tenantId. */
  async create(tenantId: string, data: Row = {}) {
    const { tenantId: _t, id: _id, deletedAt, ...rest } = data;
    const fields = Object.keys(rest).filter((k) => COLUMNS.includes(k) && rest[k] !== undefined);
    // id has no DB default (Prisma client applies uuid(); raw pg must supply). Same for updatedAt.
    const newId = _id || crypto.randomUUID();
    const cols = ['id', 'tenantId', ...fields, 'updatedAt'];
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const values = [newId, tenantId, ...fields.map((k) => rest[k]), new Date().toISOString()];
    const rows = await query<Row>(
      `INSERT INTO customer ("${cols.join('", "')}") VALUES (${placeholders.join(', ')}) RETURNING ${COLUMNS.map((c) => `"${c}"`).join(', ')}`,
      values
    );
    return rows[0] || null;
  },

  /** tenant-scoped update — UPDATE guards the tenant boundary. */
  async update(tenantId: string, id: string, data: Row = {}) {
    const { tenantId: _t, id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...rest } = data;
    const fields = Object.keys(rest).filter((k) => COLUMNS.includes(k) && rest[k] !== undefined);
    if (fields.length === 0) return this.getById(tenantId, id);
    const setSql = fields.map((f, i) => `"${f}" = $${i + 3}`).join(', ');
    const params = [tenantId, id, ...fields.map((f) => rest[f])];
    const rows = await query<Row>(
      `UPDATE customer SET ${setSql}, "updatedAt" = $${params.length + 1} WHERE "tenantId" = $1 AND "id" = $2 AND "deletedAt" IS NULL RETURNING ${COLUMNS.map((c) => `"${c}"`).join(', ')}`,
      [...params, new Date().toISOString()]
    );
    return rows[0] || null;
  },

  /** tenant-scoped soft delete. */
  async remove(tenantId: string, id: string) {
    return execute(`UPDATE customer SET "deletedAt" = NOW() WHERE "tenantId" = $1 AND "id" = $2 AND "deletedAt" IS NULL`, [tenantId, id]);
  },
};