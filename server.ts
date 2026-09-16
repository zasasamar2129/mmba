import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes';
import { notificationScheduler } from './server/notificationScheduler';
import { centralDb } from './server/db';
import { getJwtSecret } from './server/auth';

dotenv.config();

async function startServer() {
  // Validate JWT_SECRET is set before accepting any requests
  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    console.error('[MMBA Server] FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
    process.exit(1);
  }

  const app = express();
  const PORT = 3000;

  // Body parsers with generous payload limits for receipts/attachments/voice
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Basic CORS & Security Headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

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
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Run one-time password migration before accepting connections
  try {
    const migrated = await centralDb.migratePasswords();
    console.log(`[MMBA Server] Password migration complete: ${migrated} user(s) migrated.`);
  } catch (err) {
    console.error('[MMBA Server] Password migration failed:', err);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MMBA Server] Centralized Production Engine running on http://0.0.0.0:${PORT}`);
    notificationScheduler.start(15000);
  });
}

startServer().catch((err) => {
  console.error('[MMBA Server] Startup error:', err);
});
