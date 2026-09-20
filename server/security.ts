import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Centralized security middleware (Step 3, Batch 1).
// - Security HTTP headers (hand-rolled; Helmet adds nothing this app needs).
// - In-memory sliding-window rate limiter with three tiers.
//
// Note on storage: counters live in a module-level Map. Single-process,
// single-instance deployment assumption (matches the JSON file store in db.ts).
// It does not survive restarts and does not work across processes — a shared
// store (Redis etc.) is FUTURE work once the deployment grows. See
// MMBA_STEP_3_SECURITY_PERIMETER.md §2E.
// ---------------------------------------------------------------------------

// ------------------------- Security headers --------------------------------

// CSP derived from the app's actual origins (inspection §4.1):
// - fonts.googleapis.com / fonts.gstatic.com — @font-face in index.html
// - connect-src 'self' — API is same-origin (/api, /api/v1)
// - img-src blob: data: — attachments previews / AVif data-URLs
// - no inline script/style in index.html; Tailwind v4 is compiled, no runtime
//   'unsafe-inline' needed for styles. 'unsafe-inline' kept on style-src only
//   as a fallback if injected styles appear in React; revisit if console shows
//   violations.
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Production keeps a strict CSP. In development Vite injects an inline
  // react-refresh preamble script and opens an HMR websocket — `script-src
  // 'self'` would block both and render a blank page, so dev relaxes only
  // those two sources. Localhost-only, never shipped.
  const isProd = process.env.NODE_ENV === 'production';
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    isProd ? "script-src 'self'" : "script-src 'self' 'unsafe-inline'",
    // Google Fonts CSS is loaded from fonts.googleapis.com (index.html link) —
    // must be allowed in style-src or the stylesheet is blocked and fonts
    // silently fall back to system typefaces.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
    "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    isProd
      ? "connect-src 'self' https://api.whatsapp.com blob:"
      : "connect-src 'self' https://api.whatsapp.com blob: ws: http://localhost:*",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self'",
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  // Camera/microphone are used by the voice-note recorder on the client, so
  // don't deny camera+microphone globally — the recording page would break.
  // Deny the remaining rarely-needed capabilities.
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), gyroscope=(), magnetometer=(), payment=(), usb=(), accelerometer=()'
  );
  // HSTS deliberately NOT set: no TLS termination point is visible in the
  // repository (no nginx/caddy/docker config). Enable at the deployment layer
  // after confirming HTTPS. See §4.2.
  next();
}

// ------------------------- Rate limiter -----------------------------------

interface LimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Optional second key, e.g. account identifier — whichever trips first wins. */
  keyGenerator?: (req: Request) => string | null;
  /** Optional body field holding an account identifier to also count (login username). */
  accountBodyField?: string;
  /** Optional message for the 429 body. */
  message?: string;
}

// <tierKey>#<windowId>#<bucketKey> -> entry
const buckets = new Map<string, LimitEntry>();

// Periodic sweep of expired buckets so memory does not grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}, 60 * 1000).unref();

function makeLimiter(opts: RateLimitOptions) {
  const defaultKey = (req: Request) => req.ip || 'unknown';
  const keyGen = opts.keyGenerator || defaultKey;
  const msg = opts.message || 'درخواست بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.';

  return (req: Request, res: Response, next: NextFunction) => {
    const primary = keyGen(req);
    const windowId = Math.floor(Date.now() / opts.windowMs);
    // Per-IP counter always present.
    const ipKey = `${opts.windowMs}#${windowId}#ip:${primary}`;
    let over = tooMany(ipKey, opts.max, opts.windowMs);
    let acctKey: string | undefined;

    // Optional second counter from a body field (login username). Whichever
    // trips first wins. body-parser has already run by the time this middleware
    // executes, so req.body is populated.
    if (!over && opts.accountBodyField) {
      const secondary = (req.body || {})[opts.accountBodyField];
      if (secondary) {
        acctKey = `${opts.windowMs}#${windowId}#acct:${String(secondary).toLowerCase().trim()}`;
        over = tooMany(acctKey, opts.max, opts.windowMs);
      }
    }

    if (over) {
      const retryAfter = Math.ceil((over.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfter)));
      return res.status(429).json({ success: false, message: msg });
    }

    // On success, reset the per-account counter so legitimate logins never
    // build up (spec §2A: "Success should reset the per-account counter").
    if (acctKey) {
      res.on('finish', () => {
        if (res.statusCode < 400) buckets.delete(acctKey);
      });
    }

    next();
  };
}

function tooMany(key: string, max: number, windowMs: number): { resetAt: number } | null {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  entry.count += 1;
  if (entry.count > max) {
    return { resetAt: entry.resetAt };
  }
  return null;
}

// ------------------------- Tiers ------------------------------------------

// 2A. Authentication tier — strict: 10 attempts / 5 min per IP AND per account.
// Applied to every auth route (login, biometric-login, password change).
export const authLimiter = makeLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'تلاش‌های ورود بیش از حد مجاز است. لطفاً ۵ دقیقه بعد دوباره تلاش کنید.',
});

// Login-specific: also counts per account identifier (usernameOrEmail field)
// with reset-on-success, per spec §2A.
export const loginLimiter = makeLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  accountBodyField: 'usernameOrEmail',
  message: 'تلاش‌های ورود بیش از حد مجاز است. لطفاً ۵ دقیقه بعد دوباره تلاش کنید.',
});

// 2B. General API tier — moderate: 600 requests / 15 min per IP.
// Conservative for a JSON-file store that serializes writes.
export const generalLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.',
});
// The health endpoint must stay reachable by uptime monitors (spec §2D), so
// exempt it from the general tier explicitly.
export const healthExemptGeneral = (req: Request, res: Response, next: NextFunction) => {
  const p = req.originalUrl?.split('?')[0] || req.path;
  if (p.endsWith('/health')) return next();
  generalLimiter(req, res, next);
};

// 2C. Sensitive-operation tier — strict, short window: 30 requests / 10 min.
export const sensitiveLimiter = makeLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'عملیات حساس بیش از حد مجاز انجام شده است. لطفاً ۱۰ دقیقه بعد تلاش کنید.',
});

