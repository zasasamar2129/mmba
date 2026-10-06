// ---------------------------------------------------------------------------
// Step 12 FIX E — Authoritative identity
//
// Before this module, authentication read `centralDb` (the legacy JSON store)
// while tenant/membership authorization read PostgreSQL. Two stores, two
// answers: a user deactivated in one was still live in the other, and a
// membership could point at a user that only existed in JSON.
//
// The rule now:
//
//   PostgreSQL is authoritative for users and every authentication-relevant
//   field: id, username, email, mobile, passwordHash, status, tokenVersion.
//
//   The JSON store is NOT consulted for authentication. It survives only as
//   (a) a migration source, and (b) a display/profile overlay for fields the
//   PG schema does not carry (per-user `permissions`, legacy avatars).
//
// The bridge is deterministic, not opportunistic: `ensurePgUser` derives a
// stable PG id from the legacy id, so the same legacy user always maps to the
// same PG user. There are no duplicate identities, and no membership can
// reference a user that does not exist in PG.
// ---------------------------------------------------------------------------
import crypto from 'crypto';
import { query, Row } from './pg';
import { hashPassword, isPasswordHashed, verifyPassword } from './auth';

export type IdentityStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface PgUser {
  id: string;
  username: string;
  name: string;
  email: string | null;
  mobile: string | null;
  role: string;
  department: string | null;
  status: IdentityStatus;
  avatar: string | null;
  tokenVersion: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface LoginIdentity {
  user: PgUser;
  /** Legacy JSON id, when this user is bridged from the JSON store. */
  legacyId: string | null;
  /** True when the row was created by this call rather than already present. */
  bridged: boolean;
}

/**
 * Deterministic PG id for a legacy user.
 *
 * Stable across runs and across machines: the same legacy id always yields the
 * same PG id, so a re-run of the migration cannot fork a user in two. The
 * `usr-` prefix matches the legacy id shape so the bridge is recognizable in
 * logs and in the DB.
 */
export function pgIdForLegacyUser(legacyId: string): string {
  if (legacyId.startsWith('usr-')) return legacyId;
  return `usr-${crypto.createHash('sha256').update(`user:${legacyId}`).digest('hex').slice(0, 24)}`;
}

/** Strip the password before a user object crosses a response boundary. */
function toPgUser(row: Row): PgUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email ?? null,
    mobile: row.mobile ?? null,
    role: row.role,
    department: row.department ?? null,
    status: row.status as IdentityStatus,
    avatar: row.avatar ?? null,
    tokenVersion: Number(row.tokenVersion || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt ?? null,
  };
}

const USER_COLUMNS = `id, username, name, email, mobile, role, department, status, avatar, "tokenVersion", "createdAt", "updatedAt", "lastLoginAt"`;

/** Look up a user by id in the authoritative store. */
export async function findUserById(userId: string): Promise<PgUser | null> {
  const rows = await query<Row>(`SELECT ${USER_COLUMNS} FROM "user" WHERE id = $1 LIMIT 1`, [userId]);
  return rows[0] ? toPgUser(rows[0]) : null;
}

/** Look up a user by username, email or mobile. */
export async function findUserByCredential(credential: string): Promise<PgUser | null> {
  const rows = await query<Row>(
    `SELECT ${USER_COLUMNS} FROM "user"
      WHERE username = $1 OR email = $1 OR mobile = $1
      LIMIT 1`,
    [credential],
  );
  return rows[0] ? toPgUser(rows[0]) : null;
}

/** Whether a user exists in PG. Used to refuse JSON-only identities. */
export async function pgUserExists(userId: string): Promise<boolean> {
  const rows = await query<{ id: string }>('SELECT id FROM "user" WHERE id = $1 LIMIT 1', [userId]);
  return rows.length > 0;
}

/** Whether the user holds a platform-admin row. The sole platform authority. */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const rows = await query<{ id: string }>('SELECT id FROM "platformAdmin" WHERE "userId" = $1 LIMIT 1', [userId]);
  return rows.length > 0;
}

/**
 * Ensure a legacy JSON user has a corresponding PostgreSQL row, and return it.
 *
 * This is the ONLY sanctioned way to bring a JSON-era identity into PG, and it
 * is called from the migration script and from the auth fallback path — never
 * from a request that could pass an arbitrary user id to invent an account.
 *
 * Idempotent: re-running converges on the same row. The password is hashed on
 * the way in if the legacy store still holds plaintext, because PG has no
 * business storing one.
 */
export async function ensurePgUser(legacy: {
  id: string;
  username: string;
  name: string;
  password?: string;
  email?: string | null;
  mobile?: string | null;
  role?: string;
  department?: string | null;
  status?: string;
  avatar?: string | null;
  tokenVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
}): Promise<LoginIdentity> {
  const id = pgIdForLegacyUser(legacy.id);

  const existing = await query<Row>(`SELECT ${USER_COLUMNS} FROM "user" WHERE id = $1 LIMIT 1`, [id]);
  if (existing[0]) {
    // Do not clobber a password that has already been rotated in PG. A legacy
    // re-run must never reset a credential the user has since changed.
    return { user: toPgUser(existing[0]), legacyId: legacy.id, bridged: false };
  }

  const passwordHash = isPasswordHashed(legacy.password || '')
    ? (legacy.password as string)
    : await hashPassword(legacy.password || 'unusable-placeholder');

  const now = new Date().toISOString();
  const inserted = await query<Row>(
    `INSERT INTO "user" (id, username, name, email, mobile, role, department, status, avatar, "passwordHash", "tokenVersion", "createdAt", "updatedAt", "lastLoginAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (id) DO NOTHING
     RETURNING ${USER_COLUMNS}`,
    [
      id, legacy.username, legacy.name, legacy.email || null, legacy.mobile || null,
      legacy.role || 'READ_ONLY', legacy.department || null,
      (legacy.status || 'ACTIVE') as IdentityStatus, legacy.avatar || null,
      passwordHash, legacy.tokenVersion || 0,
      legacy.createdAt || now, legacy.updatedAt || now, legacy.lastLoginAt || null,
    ],
  );

  if (inserted[0]) {
    return { user: toPgUser(inserted[0]), legacyId: legacy.id, bridged: true };
  }
  // Lost a concurrent bridge — re-read and report the winner.
  const raced = await query<Row>(`SELECT ${USER_COLUMNS} FROM "user" WHERE id = $1 LIMIT 1`, [id]);
  if (!raced[0]) throw new Error('IDENTITY_BRIDGE_FAILED');
  return { user: toPgUser(raced[0]), legacyId: legacy.id, bridged: false };
}

/**
 * Authenticate against the authoritative store.
 *
 * Returns null on every failure path — unknown user, wrong password, or a
 * non-ACTIVE account — so the caller cannot accidentally distinguish "no such
 * user" from "bad password" in a response body.
 */
export async function authenticate(credential: string, password: string): Promise<PgUser | null> {
  const user = await findUserByCredential(credential);
  if (!user) return null;
  // Deactivation semantics: a non-ACTIVE user cannot authenticate at all. This
  // is checked here AND again on every request in getAuthUser, so flipping the
  // status revokes live sessions immediately rather than at token expiry.
  if (user.status !== 'ACTIVE') return null;

  const rows = await query<Row>('SELECT "passwordHash" FROM "user" WHERE id = $1 LIMIT 1', [user.id]);
  const stored = String(rows[0]?.passwordHash || '');
  if (!stored) return null;

  const valid = await verifyPassword(password, stored);
  return valid ? user : null;
}

/** Record a successful login against the authoritative store. */
export async function recordLogin(userId: string): Promise<void> {
  await query(
    `UPDATE "user" SET "lastLoginAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
    [userId],
  );
}

/**
 * Bump tokenVersion, invalidating every outstanding JWT for this user.
 * The Step 9 revocation mechanism, driven from the authoritative store.
 */
export async function revokeSessions(userId: string): Promise<number> {
  const rows = await query<Row>(
    `UPDATE "user" SET "tokenVersion" = "tokenVersion" + 1, "updatedAt" = NOW()
      WHERE id = $1 RETURNING "tokenVersion"`,
    [userId],
  );
  return rows.length > 0 ? 1 : 0;
}

/** Change a user's status. Deactivation revokes their live sessions. */
export async function setUserStatus(userId: string, status: IdentityStatus): Promise<PgUser | null> {
  const rows = await query<Row>(
    `UPDATE "user" SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING ${USER_COLUMNS}`,
    [status, userId],
  );
  if (rows[0] && status !== 'ACTIVE') {
    // Step 9 §revocation: a suspended/deactivated account must not keep using
    // a token minted while it was active.
    await revokeSessions(userId);
  }
  return rows[0] ? toPgUser(rows[0]) : null;
}

/** Update the stored password. Hashes a plaintext value. */
export async function setPassword(userId: string, newPassword: string): Promise<boolean> {
  const hash = isPasswordHashed(newPassword) ? newPassword : await hashPassword(newPassword);
  const rows = await query<Row>(
    `UPDATE "user" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING id`,
    [hash, userId],
  );
  return rows.length > 0;
}
