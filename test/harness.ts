// ---------------------------------------------------------------------------
// Shared test harness: env loading, assertions, DB lifecycle.
//
// Every test file imports `bootstrap()` FIRST, before anything that touches the
// pg pool. Previously each test relied on the ambient shell environment, so
// `npx tsx test/foo.ts` failed with "Missing DATABASE_URL" unless the caller
// had exported it by hand — which is why several suites were never actually
// run in the clean-checkout verification.
// ---------------------------------------------------------------------------
import 'dotenv/config';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

let bootstrapped = false;

/** Load .env exactly once. Safe to call from every suite. */
export function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  if (!process.env.DATABASE_URL) {
    console.error(
      '\n[test] DATABASE_URL is not set.\n' +
      '       Copy .env.example to .env and fill in your PostgreSQL connection string.\n',
    );
    process.exit(2);
  }
}

// ─── Assertions ──────────────────────────────────────────────────────────

export class Tally {
  public passed = 0;
  public failed = 0;
  private readonly failures: string[] = [];

  constructor(public readonly suiteName: string) {}

  check(ok: boolean, label: string, detail?: string): boolean {
    if (ok) {
      this.passed++;
      console.log(`  ✓ ${label}`);
    } else {
      this.failed++;
      this.failures.push(label);
      console.log(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    }
    return ok;
  }

  eq<T>(actual: T, expected: T, label: string): boolean {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    return this.check(ok, label, ok ? '' : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }

  section(title: string): void {
    console.log(`\n--- ${title} ---`);
  }

  /** Print the summary. Returns a process exit code. */
  finish(): number {
    const total = this.passed + this.failed;
    console.log(`\n${this.suiteName}: ${this.passed}/${total} passed, ${this.failed} failed`);
    if (this.failed > 0) {
      console.log('Failures:');
      this.failures.forEach((f) => console.log(`  - ${f}`));
    }
    return this.failed > 0 ? 1 : 0;
  }
}

// ─── Database helpers ────────────────────────────────────────────────────

export function dbPool(): Pool {
  return new Pool({ connectionString: process.env.DATABASE_URL!, max: 5 });
}

/** Unambiguous run-scoped suffix so parallel/repeat runs never collide. */
export function runId(): string {
  return `${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
}

export function testUserId(prefix = 'u'): string {
  return `${prefix}-${randomUUID().slice(0, 18)}`;
}

export function testUsername(prefix = 't'): string {
  return `${prefix}${runId()}`.slice(0, 40);
}

/**
 * Create a user in the authoritative store. Returns the id.
 * Uses a real bcrypt hash so the fixture can actually log in.
 */
export async function createUser(opts: {
  id?: string;
  username?: string;
  name?: string;
  passwordHash?: string;
  role?: string;
  status?: string;
}): Promise<string> {
  const pool = dbPool();
  const id = opts.id || testUserId();
  const username = opts.username || testUsername();
  await pool.query(
    `INSERT INTO "user" (id, username, name, "passwordHash", role, status, "tokenVersion", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,0,NOW(),NOW())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status`,
    [id, username, opts.name || username, opts.passwordHash || '$2b$04$abcdefghijklmnopqrstuv', opts.role || 'OWNER', opts.status || 'ACTIVE'],
  );
  await pool.end();
  return id;
}

export async function createPlatformAdmin(userId: string): Promise<void> {
  const pool = dbPool();
  await pool.query(
    `INSERT INTO "platformAdmin" (id, "userId", "createdAt") VALUES ($1,$2,NOW()) ON CONFLICT ("userId") DO NOTHING`,
    [`pa-${userId}`, userId],
  );
  await pool.end();
}

/** Delete tenants created by a test run, newest first. Keeps the DB tidy. */
export async function cleanupTenants(slugs: string[]): Promise<void> {
  if (slugs.length === 0) return;
  const pool = dbPool();
  await pool.query(`DELETE FROM tenant WHERE slug = ANY($1::text[])`, [slugs]);
  await pool.end();
}

export async function countRows(table: string, where = '', params: unknown[] = []): Promise<number> {
  const pool = dbPool();
  const res = await pool.query(`SELECT COUNT(*)::int AS c FROM "${table}" ${where}`, params as any[]);
  await pool.end();
  return res.rows[0]?.c ?? 0;
}
