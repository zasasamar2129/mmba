import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Export types
export interface JWTHeader {
  alg: 'HS256';
  typ: 'JWT';
}

export interface JWTPayload {
  userId: string;
  iat: number;
  exp: number;
  // Session revocation (Step 3, Option A): the user's tokenVersion at issue
  // time. Verification rejects if it disagrees with the stored user record.
  tokenVersion?: number;
}

export interface TokenData {
  header: JWTHeader;
  payload: JWTPayload;
}

// Get the JWT secret from environment
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'mmba_central_production_secret_key') {
    console.warn('[Auth] JWT_SECRET is using default value. Set a secure JWT_SECRET environment variable.');
  }
  return secret;
}

// Hash a plaintext password using bcrypt (cost 10)
export async function hashPassword(plainPassword: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(plainPassword, saltRounds);
}

// Verify a plaintext password against a bcrypt hash
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

// Check if a password string is already a bcrypt hash
export function isPasswordHashed(password: string): boolean {
  // Bcrypt hash format: $2b$cost$salt_and_hash (60 chars total, starts with $2b$)
  // Also accepts $2a$ and $2y$ variants
  if (!password || typeof password !== 'string') return false;
  return password.startsWith('$2a$') || password.startsWith('$2b$') || password.startsWith('$2y$');
}

// Generate a JWT token for a user. Embed the user's current tokenVersion so a
// later bump (logout / revoke-all / compromised-account reset) invalidates it.
export function signToken(userId: string, tokenVersion?: number): string {
  const secret = getJwtSecret();
  const payload: JWTPayload = {
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    ...(tokenVersion !== undefined ? { tokenVersion } : {}),
  };
  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

// Verify a JWT token and return the payload
export function verifyToken(token: string): TokenData | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JWTPayload;

    return {
      header: { alg: 'HS256', typ: 'JWT' },
      payload: decoded,
    };
  } catch (err) {
    return null;
  }
}

// Generate a fallback token for when JWT is disabled (for testing only)
export function createFallbackToken(userId: string): string {
  // Format: token-<userId>-<timestamp>-<random>
  // This is NOT cryptographically secure, but better than plain userId
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `token-${userId}-${timestamp}-${random}`;
}
