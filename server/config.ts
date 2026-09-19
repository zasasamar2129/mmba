// ---------------------------------------------------------------------------
// Environment validation (Step 3 §5.3).
//
// - Every secret lives in an env var loaded by dotenv in server.ts.
// - assertRequiredEnv() enumerates the required keys and returns the missing
//   ones so startup can refuse with a message that names the key(s) and never
//   prints a value.
// - All secrets are configurable; the JWT_SECRET default fallback in auth.ts
//   (`mmba_central_production_secret_key`) still warns — startup refuses when
//   the required keys are absent from the environment.
// ---------------------------------------------------------------------------

/** Required-for-startup env keys → name used in the error message. */
export const REQUIRED_ENV_KEYS: Record<string, string> = {
  JWT_SECRET: 'JWT_SECRET',
};

/**
 * Returns the list of required env keys that are missing or empty. Call at
 * startup; if non-empty, refuse to start. Never prints values.
 */
export function assertRequiredEnv(keys?: string[]): string[] {
  const required = keys ?? Object.keys(REQUIRED_ENV_KEYS);
  return required.filter((k) => {
    const v = process.env[k];
    return !v || v.trim() === '';
  });
}