import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';
const useSsl = process.env.DB_SSL === 'true' || Boolean(process.env.DATABASE_URL?.includes('sslmode=require')) || isProduction;

const rawCorsOrigins = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173';
const corsOrigins = rawCorsOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const parsedExpireMinutes = Number.parseInt(process.env.JWT_EXPIRE_MINUTES || '60', 10);
const jwtExpireMinutes = Number.isFinite(parsedExpireMinutes) && parsedExpireMinutes > 0 ? parsedExpireMinutes : 60;

const parsedRateWindowMs = Number.parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '60000', 10);
const parsedRateMax = Number.parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10);
const parsedAiTimeoutMs = Number.parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '30000', 10);

const jwtSecret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_KEY || '';
if (isProduction && !jwtSecret) {
  throw new Error('JWT_SECRET wajib diisi pada environment production.');
}

/**
 * Konfigurasi aplikasi terpusat dari environment variable.
 * Tidak menyimpan nilai rahasia di dalam kode sumber.
 */
const config = {
  server: {
    port: Number.parseInt(process.env.PORT || '5000', 10),
    host: process.env.HOST || (isProduction ? '0.0.0.0' : 'localhost'),
    env: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    corsOrigins,
  },
  db: {
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'capstone_project',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  },
  jwt: {
    secret: jwtSecret || 'dev_jwt_secret_change_in_env',
    expireMinutes: jwtExpireMinutes,
  },
  rateLimit: {
    loginWindowMs: Number.isFinite(parsedRateWindowMs) && parsedRateWindowMs > 0 ? parsedRateWindowMs : 60000,
    loginMaxAttempts: Number.isFinite(parsedRateMax) && parsedRateMax > 0 ? parsedRateMax : 10,
  },
  aiService: {
    url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    timeoutMs: Number.isFinite(parsedAiTimeoutMs) && parsedAiTimeoutMs > 0 ? parsedAiTimeoutMs : 30000,
    apiKey: process.env.AI_SERVICE_API_KEY || '',
    maxRetries: 1,
    retryOnStatuses: [503, 504],
  },
};

export default config;
