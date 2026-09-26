// ---------------------------------------------------------------------------
// Step 12 — PostgreSQL connection pool (thin pg driver over the Prisma contract)
//
// Prisma remains the schema + migration source of truth (prisma/schema.prisma,
// migrations/, contract). At runtime, tenant-scoped repositories query
// PostgreSQL through this pool with EXPLICIT tenant predicates. The Prisma 8
// ORM client API is still maturing; the pg tag keeps query semantics explicit
// and tenant scoping impossible to forget (see repositories).
// ---------------------------------------------------------------------------
import { Pool } from 'pg';
import { assertRequiredEnv } from './config';

function getDatabaseUrl(): string {
  // Require DATABASE_URL in production; no silent fallback to hardcoded credentials.
  const url = process.env.DATABASE_URL;
  if (!url) {
    const missing = assertRequiredEnv(['DATABASE_URL']);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}. Set DATABASE_URL in .env or environment.`);
    }
    // Only reached in development if assertRequiredEnv is not enforced there
    throw new Error('DATABASE_URL is required. Configure it in .env or environment variables.');
  }
  return url;
}

export const pool = new Pool({
  connectionString: getDatabaseUrl(),
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
});

/** Execute a parameterized query. Values are placeholders $1..$n (never interpolated). */
export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params as any[]);
  return res.rows as T[];
}

/** Execute and return affected row count (UPDATE/DELETE). */
export async function execute(text: string, params: unknown[] = []): Promise<number> {
  const res = await pool.query(text, params as any[]);
  return Number(res.rowCount) || 0;
}

// Normalize column names (pg returns snake_case from quoted camelCase columns)
export type Row = Record<string, any>;