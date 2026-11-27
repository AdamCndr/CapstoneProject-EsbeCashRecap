import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import config from './core/config.js';
import { pool, checkDatabaseConnection } from './core/database.js';
import { createLoginRateLimiter } from './core/rateLimiter.js';
import ClientError from './exceptions/ClientError.js';

import { createAuthRouter } from './api/auth/index.js';
import { createTransactionsRouter } from './api/transactions/index.js';
import { createRecapRouter } from './api/recap/index.js';
import { createDashboardRouter } from './api/dashboard/index.js';
import { createUsersRouter } from './api/users/index.js';

/**
 * Membangun payload error terstandar sesuai spesifikasi API Esbe.
 */
function buildErrorPayload(code, message, details = {}) {
  return { error: { code, message, details } };
}

/**
 * Membuat instance Express app beserta semua route dan middleware.
 *
 * @returns {import('express').Application}
 */
export function createApp({
  transactionService,
  rateLimiterOptions,
  corsOrigins = config.server.corsOrigins,
} = {}) {
  const app = express();

  // ── CORS ───────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'If-None-Match', 'Cache-Control', 'X-Requested-With'],
    }),
  );

  // ── Body parsers ───────────────────────────────────────────────────────────
  // JSON & URL-encoded untuk semua endpoint kecuali upload file
  // (multer menangani multipart/form-data di router transactions)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── Health check ───────────────────────────────────────────────────────────
  app.get('/health', async (req, res) => {
    try {
      const dbStatus = await checkDatabaseConnection();
      return res.status(200).json({
        status: 'ok',
        service: 'esbe-cash-recap-backend',
        database: dbStatus.connected ? 'connected' : 'disconnected',
        latencyMs: dbStatus.latencyMs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Health check database error:', error.message);
      return res.status(503).json(
        buildErrorPayload('DATABASE_UNAVAILABLE', 'Koneksi database gagal', {
          database: 'disconnected',
        }),
      );
    }
  });

  // ── Route modules ──────────────────────────────────────────────────────────
  const authRouterOptions = rateLimiterOptions
    ? { loginRateLimiter: createLoginRateLimiter(rateLimiterOptions) }
    : undefined;
  app.use('/auth', createAuthRouter(authRouterOptions));
  app.use('/transactions', createTransactionsRouter(transactionService ? { service: transactionService } : undefined));
  app.use('/recap', createRecapRouter());
  app.use('/dashboard', createDashboardRouter());
  app.use('/users', createUsersRouter());

  // ── 404 handler ────────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json(buildErrorPayload('NOT_FOUND', `Endpoint ${req.method} ${req.path} tidak ditemukan`));
  });

  // ── Global error handler ───────────────────────────────────────────────────
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ClientError) {
      return res.status(err.statusCode).json(buildErrorPayload(err.code, err.message, err.details));
    }

    // Multer file-size error
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json(
        buildErrorPayload('FILE_TOO_LARGE', 'Ukuran file bukti melebihi batas maksimal 5 MB', {
          maxBytes: 5 * 1024 * 1024,
        }),
      );
    }

    // Semua error 500 — log ke server, jangan bocorkan detail ke klien
    console.error('Unhandled server error:', err);
    return res.status(500).json(buildErrorPayload('INTERNAL_SERVER_ERROR', 'Terjadi kesalahan pada server'));
  });

  return app;
}

/**
 * Menjalankan Express server (hanya saat dijalankan langsung via `node src/server.js`).
 */
async function start() {
  const app = createApp();
  const port = config.server.port;
  const host = config.server.host;

  const server = app.listen(port, host, () => {
    console.log(`Server Express berjalan di http://${host}:${port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Jalankan hanya jika file ini adalah entrypoint langsung (bukan diimport Vercel)
const isEntryPoint =
  Boolean(process.argv[1]) &&
  (await import('node:url')).pathToFileURL(process.argv[1]).href === import.meta.url;

if (isEntryPoint) {
  start().catch((err) => {
    console.error('Gagal memulai server:', err);
    process.exit(1);
  });
}
