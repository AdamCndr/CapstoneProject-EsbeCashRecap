import bcrypt from 'bcrypt';
import { query as defaultQuery } from '../core/database.js';
import InvariantError from '../exceptions/InvariantError.js';
import NotFoundError from '../exceptions/NotFoundError.js';

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Menormalkan label role dari frontend ('Pemilik'/'Karyawan') maupun backend ('owner'/'employee')
 * menjadi nama role standar di database ('owner' | 'employee').
 */
function normalizeRoleName(roleInput) {
  const normalized = String(roleInput || 'employee').trim().toLowerCase();
  if (normalized === 'owner' || normalized === 'pemilik' || normalized === 'admin') {
    return 'owner';
  }
  return 'employee';
}

/**
 * Service manajemen akun pengguna (Owner mendaftarkan/mengelola akun employee & owner).
 */
class UsersService {
  /**
   * @param {{ query?: (text: string, params?: Array<unknown>) => Promise<import('pg').QueryResult> }} [deps]
   */
  constructor({ query = defaultQuery } = {}) {
    this._query = query;
  }

  _normalizeUserRow(row) {
    if (!row) return null;
    const createdAt =
      row.create_at instanceof Date
        ? row.create_at.toISOString().slice(0, 10)
        : row.create_at
          ? String(row.create_at).slice(0, 10)
          : null;

    return {
      id: Number(row.user_id),
      username: row.username,
      fullname: row.fullname,
      name: row.fullname,
      role: row.role_name,
      is_active: Boolean(row.is_active),
      isAbsolute: row.username === 'owner',
      createdAt,
    };
  }

  async getAllUsers() {
    const result = await this._query(
      `SELECT u.user_id, u.username, u.fullname, u.is_active, u.create_at, r.role_name
       FROM users u
       INNER JOIN roles r ON u.role_id = r.role_id
       ORDER BY u.user_id ASC`,
    );

    return result.rows.map((row) => this._normalizeUserRow(row));
  }

  async createUser({ username, name, fullname, password, role }) {
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanFullname = String(fullname || name || '').trim();
    const targetRole = normalizeRoleName(role);

    const existingRes = await this._query(
      'SELECT user_id FROM users WHERE LOWER(username) = $1 LIMIT 1',
      [cleanUsername],
    );
    if (existingRes.rowCount > 0) {
      throw new InvariantError(
        `Username '${cleanUsername}' sudah digunakan. Silakan gunakan username lain.`,
        'USERNAME_ALREADY_EXISTS',
        { fields: [{ field: 'username', message: 'Username sudah terdaftar' }] },
      );
    }

    const roleRes = await this._query(
      'SELECT role_id, role_name FROM roles WHERE LOWER(role_name) = $1 LIMIT 1',
      [targetRole],
    );
    if (roleRes.rowCount === 0) {
      throw new InvariantError(`Role '${targetRole}' tidak ditemukan di master roles`, 'INVALID_ROLE');
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const insertRes = await this._query(
      `INSERT INTO users (role_id, fullname, username, password, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING user_id, username, fullname, is_active, create_at`,
      [roleRes.rows[0].role_id, cleanFullname, cleanUsername, hashedPassword],
    );

    return this._normalizeUserRow({
      ...insertRes.rows[0],
      role_name: roleRes.rows[0].role_name,
    });
  }

  async updateUser(userId, payload) {
    const existingRes = await this._query(
      `SELECT u.user_id, u.username, u.fullname, u.is_active, u.create_at, r.role_name
       FROM users u
       INNER JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1
       LIMIT 1`,
      [userId],
    );

    if (existingRes.rowCount === 0) {
      throw new NotFoundError(`Pengguna dengan ID ${userId} tidak ditemukan`, 'USER_NOT_FOUND');
    }

    const current = existingRes.rows[0];
    const updates = [];
    const values = [];

    const nextFullname = payload.fullname ?? payload.name;
    if (nextFullname !== undefined) {
      values.push(String(nextFullname).trim());
      updates.push(`fullname = $${values.length}`);
    }

    if (payload.role !== undefined) {
      const nextRole = normalizeRoleName(payload.role);
      if (current.username === 'owner' && nextRole !== 'owner') {
        throw new InvariantError(
          'Role akun pemilik utama (owner) tidak boleh diubah',
          'ABSOLUTE_OWNER_PROTECTED',
        );
      }
      const roleRes = await this._query(
        'SELECT role_id FROM roles WHERE LOWER(role_name) = $1 LIMIT 1',
        [nextRole],
      );
      if (roleRes.rowCount === 0) {
        throw new InvariantError(`Role '${nextRole}' tidak valid`, 'INVALID_ROLE');
      }
      values.push(roleRes.rows[0].role_id);
      updates.push(`role_id = $${values.length}`);
    }

    if (payload.is_active !== undefined) {
      if (current.username === 'owner' && payload.is_active === false) {
        throw new InvariantError(
          'Akun pemilik utama (owner) tidak boleh dinonaktifkan',
          'ABSOLUTE_OWNER_PROTECTED',
        );
      }
      values.push(payload.is_active);
      updates.push(`is_active = $${values.length}`);
    }

    if (payload.password !== undefined) {
      const hashedPassword = await bcrypt.hash(payload.password, BCRYPT_SALT_ROUNDS);
      values.push(hashedPassword);
      updates.push(`password = $${values.length}`);
    }

    values.push(new Date());
    updates.push(`update_at = $${values.length}`);

    values.push(userId);
    await this._query(
      `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${values.length}`,
      values,
    );

    const refreshed = await this._query(
      `SELECT u.user_id, u.username, u.fullname, u.is_active, u.create_at, r.role_name
       FROM users u
       INNER JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1
       LIMIT 1`,
      [userId],
    );

    return this._normalizeUserRow(refreshed.rows[0]);
  }

  async deleteUser(userId, requester) {
    const existingRes = await this._query(
      'SELECT user_id, username FROM users WHERE user_id = $1 LIMIT 1',
      [userId],
    );

    if (existingRes.rowCount === 0) {
      throw new NotFoundError(`Pengguna dengan ID ${userId} tidak ditemukan`, 'USER_NOT_FOUND');
    }

    const target = existingRes.rows[0];
    if (target.username === 'owner') {
      throw new InvariantError(
        'Akun Pemilik utama (owner) tidak dapat dihapus',
        'ABSOLUTE_OWNER_PROTECTED',
      );
    }

    if (Number(requester?.id) === Number(userId)) {
      throw new InvariantError(
        'Anda tidak dapat menghapus akun yang sedang digunakan untuk login',
        'SELF_DELETE_FORBIDDEN',
      );
    }

    await this._query('DELETE FROM users WHERE user_id = $1', [userId]);
    return { id: Number(userId), username: target.username };
  }
}

export default UsersService;
