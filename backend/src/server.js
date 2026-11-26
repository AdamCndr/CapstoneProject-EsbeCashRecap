import { pathToFileURL } from 'node:url';
import Hapi from '@hapi/hapi';
import Jwt from '@hapi/jwt';
import config from './core/config.js';
import { checkDatabaseConnection, pool } from './core/database.js';
import { createLoginRateLimiter } from './core/rateLimiter.js';
import ClientError from './exceptions/ClientError.js';
import AuthService from './services/AuthService.js';
import TransactionService from './services/TransactionService.js';
import RecapService from './services/RecapService.js';
import DashboardService from './services/DashboardService.js';
import UsersService from './services/UsersService.js';
import TokenManager from './tokenize/TokenManager.js';
import AuthValidator from './validator/auth/index.js';
import TransactionsValidator from './validator/transactions/index.js';
import RecapValidator from './validator/recap/index.js';
import UsersValidator from './validator/users/index.js';
import authPlugin from './api/auth/index.js';
import transactionsPlugin from './api/transactions/index.js';
import recapPlugin from './api/recap/index.js';
import dashboardPlugin from './api/dashboard/index.js';
import usersPlugin from './api/users/index.js';

/**
 * Membuat payload error terstandar sesuai spesifikasi API.
 *
 * @param {string} code - Kode error mesin-terbaca.
 * @param {string} message - Pesan error ringkas.
 * @param {Record<string, unknown>} [details] - Detail tambahan error.
 * @returns {{ error: { code: string, message: string, details: Record<string, unknown> } }}
 */
function buildErrorResponse(code, message, details = {}) {
  return {
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * Mengonversi Error / Boom Hapi menjadi HTTP status & payload error terstandar.
 *
 * @param {Error & { isBoom?: boolean, output?: { statusCode?: number, payload?: { error?: string } } }} response
 * @returns {{ statusCode: number, payload: { error: { code: string, message: string, details: Record<string, unknown> } } }}
 */
function formatErrorResponse(response) {
  if (response instanceof ClientError) {
    return {
      statusCode: response.statusCode,
      payload: buildErrorResponse(response.code, response.message, response.details),
    };
  }

  const statusCode = response.output?.statusCode || 500;
  if (statusCode >= 500) {
    console.error('Unhandled server error:', response);
    return {
      statusCode: 500,
      payload: buildErrorResponse('INTERNAL_SERVER_ERROR', 'Terjadi kesalahan pada server', {}),
    };
  }

  const rawErrorCode = response.output?.payload?.error || 'BAD_REQUEST';
  const normalizedCode =
    statusCode === 413
      ? 'FILE_TOO_LARGE'
      : statusCode === 415
        ? 'UNSUPPORTED_MEDIA_TYPE'
        : rawErrorCode.toUpperCase().replace(/\s+/g, '_');

  return {
    statusCode,
    payload: buildErrorResponse(normalizedCode, response.message, {}),
  };
}

/**
 * Membangun instance Hapi server beserta plugin JWT, route auth, CORS, dan error formatter standar.
 *
 * @param {{
 *   authService?: AuthService,
 *   tokenManager?: typeof TokenManager,
 *   authValidator?: typeof AuthValidator,
 *   rateLimiterOptions?: { windowMs?: number, maxAttempts?: number },
 *   corsOrigins?: string[],
 * }} [options]
 * @returns {Promise<import('@hapi/hapi').Server>}
 */
export async function createServer({
  authService = new AuthService(),
  transactionService = new TransactionService(),
  recapService = new RecapService(),
  dashboardService = new DashboardService(),
  usersService = new UsersService(),
  tokenManager = TokenManager,
  authValidator = AuthValidator,
  transactionsValidator = TransactionsValidator,
  recapValidator = RecapValidator,
  usersValidator = UsersValidator,
  rateLimiterOptions = {
    windowMs: config.rateLimit.loginWindowMs,
    maxAttempts: config.rateLimit.loginMaxAttempts,
  },
  corsOrigins = config.server.corsOrigins,
} = {}) {
  const server = Hapi.server({
    port: config.server.port,
    host: config.server.host,
    routes: {
      cors: {
        origin: corsOrigins,
        credentials: true,
        headers: ['Accept', 'Authorization', 'Content-Type', 'If-None-Match'],
        additionalHeaders: ['cache-control', 'x-requested-with'],
      },
    },
  });

  await server.register([{ plugin: Jwt }]);

  server.auth.strategy('esbe_jwt', 'jwt', {
    keys: config.jwt.secret,
    verify: {
      aud: false,
      iss: false,
      sub: false,
      exp: true,
      maxAgeSec: config.jwt.expireMinutes * 60,
    },
    validate: (artifacts) => {
      const { id, username, role } = artifacts.decoded.payload || {};

      if (!id || !username || !role) {
        return { isValid: false };
      }

      return {
        isValid: true,
        credentials: {
          id,
          username,
          role,
        },
      };
    },
  });

  server.auth.default('esbe_jwt');

  const loginRateLimiter = createLoginRateLimiter(rateLimiterOptions);

  await server.register([
    {
      plugin: authPlugin,
      options: {
        service: authService,
        tokenManager,
        validator: authValidator,
        loginRateLimiter: loginRateLimiter.handler,
      },
    },
    {
      plugin: transactionsPlugin,
      options: {
        service: transactionService,
        validator: transactionsValidator,
      },
    },
    {
      plugin: recapPlugin,
      options: {
        service: recapService,
        validator: recapValidator,
      },
    },
    {
      plugin: dashboardPlugin,
      options: {
        service: dashboardService,
        validator: recapValidator,
      },
    },
    {
      plugin: usersPlugin,
      options: {
        service: usersService,
        validator: usersValidator,
      },
    },
  ]);

  server.route({
    method: 'GET',
    path: '/health',
    options: {
      auth: false,
    },
    handler: async (request, h) => {
      try {
        const dbStatus = await checkDatabaseConnection();

        return h
          .response({
            status: 'ok',
            service: 'esbe-cash-recap-backend',
            database: dbStatus.connected ? 'connected' : 'disconnected',
            latencyMs: dbStatus.latencyMs,
            timestamp: new Date().toISOString(),
          })
          .code(200);
      } catch (error) {
        console.error('Health check database error:', error.message);

        return h
          .response(
            buildErrorResponse('DATABASE_UNAVAILABLE', 'Koneksi database gagal', {
              database: 'disconnected',
            }),
          )
          .code(503);
      }
    },
  });

  server.ext('onPreResponse', (request, h) => {
    const { response } = request;

    if (response instanceof Error) {
      const { statusCode, payload } = formatErrorResponse(response);
      return h.response(payload).code(statusCode);
    }

    return h.continue;
  });

  return server;
}

/**
 * Menjalankan Hapi server dan menangani graceful shutdown.
 *
 * @returns {Promise<import('@hapi/hapi').Server>}
 */
async function start() {
  const server = await createServer();
  await server.start();
  console.log(`Server Hapi berjalan di ${server.info.uri}`);

  const shutdown = async () => {
    await server.stop({ timeout: 5000 });
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

const isEntryPoint =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  start().catch((err) => {
    console.error('Gagal memulai server:', err);
    process.exit(1);
  });
}
