import pg from 'pg';
import config from './config.js';

const { Pool } = pg;

/**
 * Pool koneksi PostgreSQL untuk Neon (via DATABASE_URL) atau PostgreSQL lokal.
 *
 * Neon free tier: pakai koneksi pool kecil (max 3) agar tidak kehabisan slot.
 * Neon menggunakan SSL wajib — pastikan DATABASE_URL mengandung ?sslmode=require
 * atau DB_SSL=true di env.
 */
const isNeon = Boolean(
  config.db.connectionString &&
    (config.db.connectionString.includes('neon.tech') ||
      config.db.connectionString.includes('neon.database')),
);

const poolConfig = config.db.connectionString
  ? {
      connectionString: config.db.connectionString,
      ssl: config.db.ssl || { rejectUnauthorized: false },
    }
  : {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      ssl: config.db.ssl,
    };

export const pool = new Pool({
  ...poolConfig,
  // Neon free tier: 3 koneksi simultan; lokal: 10
  max: isNeon ? 3 : 10,
  // Tutup koneksi idle lebih cepat agar slot Neon tidak terblokir
  idleTimeoutMillis: isNeon ? 10000 : 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

/**
 * Mengeksekusi query SQL berparameter pada pool.
 *
 * @param {string} text - Query SQL berparameter.
 * @param {Array<unknown>} [params] - Nilai parameter query.
 * @returns {Promise<import('pg').QueryResult>}
 */
export const query = (text, params = []) => pool.query(text, params);

/**
 * Mengecek kesehatan koneksi database PostgreSQL.
 *
 * @returns {Promise<{ connected: boolean, latencyMs: number, serverTime: string }>}
 */
export async function checkDatabaseConnection() {
  const startedAt = Date.now();
  const result = await pool.query('SELECT NOW() AS server_time');
  const latencyMs = Date.now() - startedAt;

  return {
    connected: true,
    latencyMs,
    serverTime: result.rows[0].server_time,
  };
}

export default pool;
