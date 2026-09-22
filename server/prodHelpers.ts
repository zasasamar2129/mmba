import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Production hardening helpers (Step 9, Batch 1 — runtime safety).
//
// - requestId middleware: attaches a correlation id to every request, honours a
//   sanitized inbound X-Request-Id when one is sent by a trusted reverse proxy,
//   returns it in the response header, and makes it available to handlers.
// - structuredLog(): one-line JSON-ish operational log with a stable shape.
// - finalErrorHandler(): terminal Express error handler. Safe client body
//   (no stack/paths/secrets), full detail server-side, always an errorCode.
// ---------------------------------------------------------------------------

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

interface LogEntry {
  timestamp?: string;
  level: 'info' | 'warn' | 'error';
  service?: string;
  requestId?: string;
  event: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  job?: string;
  actor?: string;
  errorCode?: string;
  [k: string]: unknown;
}

const SERVICE = 'mmba';

// Inbound X-Request-Id is honoured ONLY when it looks like a sane token; strip
// everything that is not unreserved header characters so it can never be used
// for header/CRLF injection or log forgery with control characters.
function sanitizeInboundId(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  if (v.length === 0 || v.length > 128) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(v)) return null;
  return v;
}

/** Inbound request scrambling for the structured log route string. */
function safeRoutePath(req: Request): string {
  const base = (req.originalUrl || req.url || '/').split('?')[0];
  return base.length > 200 ? `${base.slice(0, 197)}...` : base;
}

export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const inbound = sanitizeInboundId(req.headers['x-request-id']);
  const requestId = inbound || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Attach a diagnostic origin for server-side logs (the inbound id is echoed
  // verbatim so a trace through a proxy keeps a single id).
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      structuredLog({
        level: res.statusCode >= 500 ? 'error' : 'warn',
        event: 'http_request',
        requestId,
        route: safeRoutePath(req),
        method: req.method,
        status: res.statusCode,
      });
    }
  });
  next();
}

/** One-line operational log. Timestamp + level + service + event always. */
export function structuredLog(entry: LogEntry) {
  const line = {
    timestamp: entry.timestamp || new Date().toISOString(),
    level: entry.level || 'info',
    service: entry.service || SERVICE,
    ...entry,
  };
  // Serialize with the object keys in insertion order; values already include
  // only safe primitives (never secrets — callers must not pass them).
  const out = JSON.stringify(line);
  if (entry.level === 'error') {
    console.error(out);
  } else if (entry.level === 'warn') {
    console.warn(out);
  } else {
    console.log(out);
  }
}

/** Read the id attached by loggerMiddleware (falls back to a fresh one). */
export function getRequestId(req: Request): string {
  return (req as Request & { requestId?: string }).requestId || crypto.randomUUID();
}

/**
 * SAFE_CLIENT_MESSAGE: a stable, generic body for responses whose upstream
 * error may leak internals. The real detail is kept in the server log, never
 * sent to the client. Contextual route handlers still send their own (safer)
 * messages; this is the last-line of defence when an unknown error escapes.
 */
export function finalErrorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = Number(err?.status || err?.statusCode) || 500;
  const requestId = getRequestId(req);

  // 413 handled explicitly so proxy/client get the standard payload limit code.
  if (status === 413 || err?.type === 'entity.too.large') {
    structuredLog({ level: 'warn', event: 'payload_limit', requestId, route: safeRoutePath(req), method: req.method, status: 413, errorCode: 'PAYLOAD_TOO_LARGE', message: err?.message });
    if (!res.headersSent) {
      res.status(413).json({ success: false, error: 'PAYLOAD_TOO_LARGE', message: 'درخواست بیش از حد مجاز است.', requestId });
    }
    return;
  }

  structuredLog({
    level: 'error',
    event: 'unhandled_error',
    requestId,
    route: safeRoutePath(req),
    method: req.method,
    status,
    errorCode: 'UNHANDLED',
    message: err?.message || 'Unhandled error',
    stack: err?.stack,
  });

  if (res.headersSent) {
    console.error(`[MMBA] Request ${requestId} errored after headers sent; connection terminated.`);
    return res.destroy();
  }

  res.status(status).json({
    success: false,
    error: status >= 500 ? 'INTERNAL' : 'ERROR',
    message: status >= 500 ? 'خطای داخلی سرور رخ داد. لطفاً دوباره تلاش کنید.' : 'خطای درخواست.',
    requestId,
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown (Step 9 §10).
// ---------------------------------------------------------------------------

export interface ShutdownHooks {
  server?: any;
  primaries?: (() => void | Promise<void>)[];
  follower?: () => void | Promise<void>;
  timeoutMs?: number;
}

let shutdownInitiated = false;

export function installGracefulShutdown({ server, primaries = [], follower, timeoutMs = 15000 }: ShutdownHooks) {
  const handlers: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  const run = async (signal: NodeJS.Signals) => {
    if (shutdownInitiated) return;
    shutdownInitiated = true;
    structuredLog({ level: 'warn', event: 'shutdown', job: String(signal), message: 'shutdown initiated' });

    // 1. Stop accepting new connections (http server present).
    if (server) {
      try { await new Promise<void>((resolve) => server.close(() => resolve())); } catch { /* already closed */ }
    }

    // 2. Bound the whole sequence.
    const timeout = setTimeout(() => {
      structuredLog({ level: 'error', event: 'shutdown_timeout', job: String(signal), message: 'grace period elapsed; forcing exit' });
      process.exit(1);
    }, timeoutMs);
    timeout.unref();

    // 3. Primaries (critical writes) first, then background jobs.
    for (const fn of primaries) {
      try { await fn(); } catch (e) { console.error('[MMBA] Shutdown primary hook error:', e); }
    }
    if (follower) {
      try { await follower(); } catch (e) { console.error('[MMBA] Shutdown follower hook error:', e); }
    }

    clearTimeout(timeout);
    structuredLog({ level: 'info', event: 'shutdown_complete', job: String(signal) });
    process.exit(0);
  };

  handlers.forEach((sig) => process.once(sig, () => run(sig)));
}

// ---------------------------------------------------------------------------
// CORS — environment-aware origin allowlist (Step 9 §22).
// ---------------------------------------------------------------------------

const DEFAULT_DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'];

export function corsMiddleware(origin: string[], credentials = true) {
  const allowed = new Set(origin);
  return (req: Request, res: Response, next: NextFunction) => {
    const requestOrigin = req.headers.origin;
    if (requestOrigin && allowed.has(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
    if (credentials) res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
}

export function resolveAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (process.env.NODE_ENV === 'production') {
    // In production, refuse to guess: allow the documented panel origins plus
    // the APP_URL if set. Operators must pin origins explicitly.
    const extra = process.env.APP_URL ? [process.env.APP_URL.replace(/\/$/, '')] : [];
    return [...extra, 'https://panel.mobilemeisam.ir', 'https://panel.johannapage.website'];
  }
  return DEFAULT_DEV_ORIGINS;
}