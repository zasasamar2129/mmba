// ---------------------------------------------------------------------------
// Step 12 — Generic tenant-scoped repository factory (PostgreSQL via pg)
//
// Produces a repository for any tenant-owned table. Every statement carries a
// tenant predicate. tenantId comes from server-side context, never the client.
// Handles camelCase (quoted) columns, soft delete via deletedAt when the column
// exists, UUID id generation, and explicit updatedAt (no DB default).
// ---------------------------------------------------------------------------
import crypto from 'crypto';
import { query, execute, Row } from './pg';

export interface RepoFilters {
  page?: number;
  pageSize?: number;
  [k: string]: any;
}

export interface TenancyRepository {
  list(tenantId: string, filters?: RepoFilters): Promise<{ rows: Row[]; total: number; page: number; pageSize: number }>;
  getById(tenantId: string, id: string): Promise<Row | null>;
  create(tenantId: string, data: Row): Promise<Row | null>;
  update(tenantId: string, id: string, data: Row): Promise<Row | null>;
  remove(tenantId: string, id: string): Promise<number>;
}

const SERVER_OWNED = new Set(['id', 'tenantId', 'createdAt', 'updatedAt', 'deletedAt']);

export function createTenantRepository(table: string, columns: string[]): TenancyRepository {
  const softDelete = columns.includes('deletedAt');
  const hasCreatedAt = columns.includes('createdAt');
  const hasUpdatedAt = columns.includes('updatedAt');
  const writable = columns.filter((c) => !SERVER_OWNED.has(c));
  const selectCols = columns.map((c) => `"${c}"`).join(', ');

  function normalizeIncoming(data: Row) {
    const out: Row = {};
    for (const k of Object.keys(data || {})) {
      if (!columns.includes(k)) continue; // drop unknown/forged columns incl. client tenantId
      if (k === 'tenantId') continue; // server-derived only
      if (data[k] !== undefined) out[k] = data[k];
    }
    if (out.id !== undefined) delete out.id; // id is server/DB-owned (uuid generated here)
    return out;
  }

  return {
    async list(tenantId, filters = {}) {
      const where: string[] = ['"tenantId" = $1'];
      const params: unknown[] = [tenantId];
      if (softDelete) where.push('"deletedAt" IS NULL');
      for (const k of Object.keys(filters)) {
        const v = filters[k];
        if (v === undefined || v === null) continue;
        if (k === 'page' || k === 'pageSize') continue;
        if (k === 'query' && columns.includes('name')) {
          params.push(v, v);
          const i = params.length - 1;
          where.push(`(LOWER("name") LIKE LOWER($${i}) OR "id" = $${i + 1})`);
        } else if (columns.includes(k)) {
          params.push(v);
          where.push(`"${k}" = $${params.length}`);
        }
      }
      const page = filters.page || 1;
      const pageSize = Math.min(filters.pageSize || 50, 500);
      const whereSql = where.join(' AND ');
      const rows = await query<Row>(`SELECT ${selectCols} FROM "${table}" WHERE ${whereSql} ORDER BY "createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, (page - 1) * pageSize]);
      const [countRow] = await query<Row>(`SELECT COUNT(*) AS total FROM "${table}" WHERE ${whereSql}`, params);
      return { rows, total: Number(countRow?.total || 0), page, pageSize };
    },

    async getById(tenantId, id) {
      const rows = await query<Row>(`SELECT ${selectCols} FROM "${table}" WHERE "tenantId" = $1 AND "id" = $2${softDelete ? ' AND "deletedAt" IS NULL' : ''} LIMIT 1`, [tenantId, id]);
      return rows[0] || null;
    },

    async create(tenantId, data) {
      const clean = normalizeIncoming(data);
      const id = clean.id || crypto.randomUUID();
      const cleanKeys = Object.keys(clean).filter((k) => k !== 'id');
      const cols = ['id', 'tenantId', ...cleanKeys];
      if (hasUpdatedAt && !cols.includes('updatedAt')) cols.push('updatedAt');
      const placeholders = cols.map((_, i) => `$${i + 1}`);
      // values are positional: id (generated), tenantId (server-derived), then clean fields; updatedAt = now
      const values = cols.map((k) => (k === 'id' ? id : k === 'tenantId' ? tenantId : k === 'updatedAt' ? new Date().toISOString() : clean[k]));
      const rows = await query<Row>(`INSERT INTO "${table}" ("${cols.join('", "')}") VALUES (${placeholders.join(', ')}) RETURNING ${selectCols}`, values);
      return rows[0] || null;
    },

    async update(tenantId, id, data) {
      const clean = normalizeIncoming(data);
      delete clean.id;
      const fields = Object.keys(clean).filter((k) => clean[k] !== undefined);
      if (fields.length === 0) return this.getById(tenantId, id);
      const setSql = fields.map((f, i) => `"${f}" = $${i + 3}`).join(', ');
      const updCol = hasUpdatedAt ? `, "updatedAt" = $${fields.length + 3}` : '';
      const params: unknown[] = [tenantId, id, ...fields.map((f) => clean[f])];
      if (hasUpdatedAt) params.push(new Date().toISOString());
      const rows = await query<Row>(`UPDATE "${table}" SET ${setSql}${updCol} WHERE "tenantId" = $1 AND "id" = $2${softDelete ? ' AND "deletedAt" IS NULL' : ''} RETURNING ${selectCols}`, params);
      return rows[0] || null;
    },

    async remove(tenantId, id) {
      if (softDelete) {
        return execute(`UPDATE "${table}" SET "deletedAt" = NOW() WHERE "tenantId" = $1 AND "id" = $2 AND "deletedAt" IS NULL`, [tenantId, id]);
      }
      return execute(`DELETE FROM "${table}" WHERE "tenantId" = $1 AND "id" = $2`, [tenantId, id]);
    },
  };
}