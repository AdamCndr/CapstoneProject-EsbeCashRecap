import bcrypt from 'bcrypt';
import { query as defaultQuery } from '../core/database.js';
import AuthenticationError from '../exceptions/AuthenticationError.js';
import AuthorizationError from '../exceptions/AuthorizationError.js';

/**
 * Service autentikasi pengguna berbasis PostgreSQL dan bcrypt.
 */
class AuthService {
  /**
   * @param {{ query?: (text: string, params?: Array<unknown>) => Promise<import('pg').QueryResult> }} [deps]
   */
  constructor({ query = defaultQuery } = {}) {
    this._query = query;
  }

  /**
   * Memverifikasi kredensial login (username dan password).
   * Menggunakan pesan error generik 401 untuk username/password salah agar tidak membocorkan informasi akun,
   * dan 403 apabila akun valid namun berstatus non-aktif.
   *
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{ id: number, username: string, role: string }>}
   */
  async verifyUserCredential(username, password) {
    const result = await this._query(
      `SELECT u.user_id, u.username, u.password, u.is_active, r.role_name
       FROM users u
       INNER JOIN roles r ON u.role_id = r.role_id
       WHERE u.username = $1
       LIMIT 1`,
      [username],
    );

    if (result.rowCount === 0) {
      throw new AuthenticationError('Username atau password salah', 'INVALID_CREDENTIALS');
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AuthenticationError('Username atau password salah', 'INVALID_CREDENTIALS');
    }

    if (!user.is_active) {
      throw new AuthorizationError(
        'Akun Anda sedang non-aktif. Silakan hubungi pemilik toko.',
        'ACCOUNT_INACTIVE',
      );
    }

    return {
      id: user.user_id,
      username: user.username,
      role: user.role_name,
    };
  }
}

export default AuthService;
