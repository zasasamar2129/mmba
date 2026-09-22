import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes';
import { notificationScheduler } from './server/notificationScheduler';
import { centralDb } from './server/db';
import { securityHeaders, healthExemptGeneral } from './server/security';
import { assertRequiredEnv } from './server/config';
import {
  loggerMiddleware,
  finalErrorHandler,
  installGracefulShutdown,
  corsMiddleware,
  resolveAllowedOrigins,
  structuredLog,
} from './server/prodHelpers';

dotenv.config();

const ORIGINS = resolveAllowedOrigins();

function validateOptionalSecrets(): string[] {
  // Web Push is active only if both VAPID keys are provided. If exactly one is
  // set that is a configuration error — refuse rather than silently push with
  // a half-keypair. (Step 9 §4 / §25.)
  const errors: string[] = [];
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (Boolean(pub) !== Boolean(priv)) {
    errors.push('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set together (or both unset).');
  }
  return errors;
}

async function startServer() {
  // Validate every required secret before accepting any requests. Refuses to
  // start and names only the missing key — never a value. (Step 3 §5.3)
  const missing = assertRequiredEnv(['JWT_SECRET']);
  if (missing.length > 0) {
    console.error(`[MMBA Server] FATAL: Missing required environment variable(s): ${missing.join(', ')}. Refusing to start.`);
    process.exit(1);
  }

  const optErrors = validateOptionalSecrets();
  if (optErrors.length > 0) {
    console.error(`[MMBA Server] FATAL: ${optErrors.join(' ')}`);
    process.exit(1);
  }

  // Numeric/config validation (Step 9 §4): PORT must be a valid port number.
  const portRaw = process.env.PORT || '3000';
  const PORT = Number(portRaw);
  if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
    console.error(`[MMBA Server] FATAL: Invalid PORT "${process.env.PORT}". Must be an integer 1-65535.`);
    process.exit(1);
  }

  const app = express();

  // Behind a production reverse proxy: honour X-Forwarded-* so req.ip and the
  // rate limiter see the client address, and secure the origin check.
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  // Security headers BEFORE any route middleware (Step 3 §4).
  app.use(securityHeaders);

  // Request correlation (Step 9 §8): every request gets an id, echoed back.
  app.use(loggerMiddleware);

  // CORS — explicit origin allowlist (Step 9 §22). Never a wildcard for the
  // authenticated API. Configure via ALLOWED_ORIGINS.
  app.use(corsMiddleware(ORIGINS));

  // Body parsers with bounded payload limits (Step 9 §14). Attachments and
  // voice notes are uploaded to the JSON store as base64, so JSON needs a
  // generous but bounded cap; per-route limits stay tighter below.
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // General API tier limiter (Step 3 §2B). Applied at app level; /health is
  // exempt so uptime monitors still work (spec §2D).
  app.use(healthExemptGeneral);

  // Mount Centralized MMBA API Router FIRST
  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);

  // Vite middleware for development or Static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err && !res.headersSent) {
          res.status(404).send('Not Found');
        }
      });
    });
  }

  // Terminal error handler (Step 9 §6): stable safe client body + full server
  // log with request id. Must be the LAST middleware.
  app.use(finalErrorHandler);

  // Run one-time password migration before accepting connections
  try {
    const migrated = await centralDb.migratePasswords();
    structuredLog({ level: 'info', event: 'db_migrate', job: 'db', message: `password migration complete: ${migrated} user(s)` });
  } catch (err) {
    structuredLog({ level: 'error', event: 'db_migrate', job: 'db', message: 'password migration failed', error: String(err) });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    structuredLog({ level: 'info', event: 'server_start', job: 'http', message: `listening on 0.0.0.0:${PORT}`, env: process.env.NODE_ENV || 'development' });
    notificationScheduler.start(15000);
  });

  installGracefulShutdown({
    server: httpServer,
    primaries: [
      // Stop background jobs before closing storage; in-flight writes finish
      // first via the write queue.
      async () => notificationScheduler.stop(),
    ],
    follower: async () => {
      // Flush any queued in-memory writes to disk (best-effort).
      try { await centralDb.persist(); } catch (e) { console.error('[MMBA] Final persist failed:', e); }
    },
    timeoutMs: 15000,
  });
}

startServer().catch((err) => {
  console.error('[MMBA Server] Startup error:', err);
  process.exit(1);
});