import pg from 'pg';
import config from './config.js';

const { Pool } = pg;

/**
 * Pool koneksi PostgreSQL menggunakan `pg`.
 * Mendukung `DATABASE_URL` (Neon/Render) maupun konfigurasi host terpisah (lokal).
 */
const poolConfig = config.db.connectionString
  ? {
      connectionString: config.db.connectionString,
      ssl: config.db.ssl,
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
  max: 10,
  idleTimeoutMillis: 30000,
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
