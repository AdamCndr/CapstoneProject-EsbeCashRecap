import { pool, query as defaultQuery } from '../core/database.js';
import InvariantError from '../exceptions/InvariantError.js';
import NotFoundError from '../exceptions/NotFoundError.js';
import AuthorizationError from '../exceptions/AuthorizationError.js';

/**
 * Service transaksi — semua operasi CRUD ke tabel `transaction`
 * beserta audit log dalam satu transaksi database (BEGIN/COMMIT/ROLLBACK).
 *
 * BIGINT dari pg dikembalikan sebagai string; service mengonversi ke Number.
 */
class TransactionService {
  /**
   * @param {{ pool?: import('pg').Pool, query?: Function }} [deps]
   */
  constructor({ pool: injectedPool, query } = {}) {
    this._pool = injectedPool || pool;
    this._query = query || defaultQuery;
  }

  /* ================================================================
   * HELPER INTERNAL
   * ================================================================ */

  /**
   * Konversi BIGINT string → Number dan NUMERIC string → Number.
   * Hanya field yang umum dikembalikan dari tabel transaction.
   */
  _normalizeRow(row) {
    if (!row) return row;

    const numeric = [
      'transaction_id', 'work_shift_id', 'shift_type_id',
      'payment_method_id', 'payment_proof_id', 'category_id',
      'created_by', 'confirmed_by', 'audit_id', 'user_id',
    ];

    const copy = { ...row };

    for (const key of numeric) {
      if (copy[key] !== undefined && copy[key] !== null) {
        copy[key] = Number(copy[key]);
      }
    }

    // amount disimpan NUMERIC(15,2) — pg mengembalikan string
    if (copy.amount !== undefined && copy.amount !== null) {
      copy.amount = Number(copy.amount);
    }

    return copy;
  }

  /**
   * Resolve shift_type_id dari nama shift ('pagi' | 'siang').
   */
  async _resolveShiftTypeId(client, shiftName) {
    const result = await client.query(
      'SELECT shift_type_id FROM shift_types WHERE LOWER(shift_name) = LOWER($1) LIMIT 1',
      [shiftName],
    );
    if (result.rowCount === 0) {
      throw new InvariantError(
        `Shift "${shiftName}" tidak ditemukan`,
        'INVALID_SHIFT',
        { fields: [{ field: 'shift', message: `Shift "${shiftName}" tidak valid` }] },
      );
    }
    return result.rows[0].shift_type_id;
  }

  /**
   * Resolve payment_method_id dari method_code ('tunai' | 'qris' | 'transfer').
   */
  async _resolvePaymentMethodId(client, methodCode) {
    const result = await client.query(
      'SELECT payment_method_id FROM payment_methods WHERE LOWER(method_code) = LOWER($1) LIMIT 1',
      [methodCode],
    );
    if (result.rowCount === 0) {
      throw new InvariantError(
        `Metode pembayaran "${methodCode}" tidak ditemukan`,
        'INVALID_PAYMENT_METHOD',
        { fields: [{ field: 'payment_method', message: `Metode "${methodCode}" tidak valid` }] },
      );
    }
    return result.rows[0].payment_method_id;
  }

  /**
   * Resolve category_id dari nama kategori.
   */
  async _resolveCategoryId(client, categoryId) {
    const result = await client.query(
      'SELECT category_id FROM categories WHERE category_id = $1 AND is_active = TRUE LIMIT 1',
      [categoryId],
    );
    if (result.rowCount === 0) {
      throw new InvariantError(
        `Kategori dengan ID ${categoryId} tidak ditemukan atau non-aktif`,
        'INVALID_CATEGORY',
        { fields: [{ field: 'category_id', message: 'Kategori tidak valid' }] },
      );
    }
    return result.rows[0].category_id;
  }

  /**
   * Cek idempotency — transaksi dengan idempotency_key yang sama sudah ada?
   * Kalau sudah ada, kembalikan transaksi yang sudah tersimpan.
   */
  async _checkIdempotency(client, idempotencyKey, userId) {
    if (!idempotencyKey) return null;

    const result = await client.query(
      `SELECT t.*, st.shift_name, pm.method_code AS payment_method
       FROM transaction t
       LEFT JOIN shift_types st ON t.shift_type_id = st.shift_type_id
       LEFT JOIN payment_methods pm ON t.payment_method_id = pm.payment_method_id
       WHERE t.idempotency_key = $1 AND t.created_by = $2
       LIMIT 1`,
      [idempotencyKey, userId],
    );

    if (result.rowCount > 0) {
      return this._normalizeRow(result.rows[0]);
    }
    return null;
  }

  /**
   * Tulis audit log untuk aksi tertentu.
   */
  async _writeAuditLog(client, { transactionId, userId, action, oldValues, newValues }) {
    await client.query(
      `INSERT INTO transaction_audit_logs
         (transaction_id, user_id, action, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        transactionId,
        userId,
        action,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
      ],
    );
  }

  /* ================================================================
   * CREATE — POST /transactions/cash & POST /transactions
   * ================================================================ */

  /**
   * Membuat transaksi baru (tunai atau konfirmasi QRIS/transfer/manual).
   *
   * @param {{
   *   title: string,
   *   transaction_type: string,
   *   amount: number,
   *   shift: string,
   *   payment_method: string,
   *   category_id?: number,
   *   transaction_date?: string,
   *   transaction_time?: string,
   *   notes?: string,
   *   external_trx_id?: string,
   *   payment_proof_id?: number,
   *   is_manual_input?: boolean,
   *   is_duplicate?: boolean,
   *   idempotency_key?: string,
   * }} payload
   * @param {{ id: number, role: string }} user
   * @returns {Promise<Object>}
   */
  async createTransaction(payload, user) {
    const client = await this._pool.connect();

    try {
      await client.query('BEGIN');

      // Idempotency check
      const existing = await this._checkIdempotency(client, payload.idempotency_key, user.id);
      if (existing) {
        await client.query('COMMIT');
        return { transaction: existing, isIdempotent: true };
      }

      // Resolve FK IDs
      const shiftTypeId = await this._resolveShiftTypeId(client, payload.shift);
      const paymentMethodId = await this._resolvePaymentMethodId(client, payload.payment_method);
      const categoryId = payload.category_id
        ? await this._resolveCategoryId(client, payload.category_id)
        : null;

      const trxDate = payload.transaction_date || payload.trx_date || new Date().toISOString().slice(0, 10);
      const trxTime = payload.transaction_time || new Date().toTimeString().slice(0, 8);
      const trxStatus = 'terkonfirmasi';

      const insertResult = await client.query(
        `INSERT INTO transaction
           (shift_type_id, payment_method_id, payment_proof_id, category_id,
            created_by, confirmed_by,
            title, transaction_type, amount,
            transaction_date, transaction_time, transaction_status,
            notes, external_trx_id, is_duplicate, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [
          shiftTypeId,
          paymentMethodId,
          payload.payment_proof_id || null,
          categoryId,
          user.id,
          user.id, // confirmed_by = pembuat saat konfirmasi langsung
          payload.title,
          payload.transaction_type,
          payload.amount,
          trxDate,
          trxTime,
          trxStatus,
          payload.notes || null,
          payload.external_trx_id || null,
          payload.is_duplicate || false,
          payload.idempotency_key || null,
        ],
      );

      const transaction = this._normalizeRow(insertResult.rows[0]);

      // Audit log — aksi CREATE
      await this._writeAuditLog(client, {
        transactionId: transaction.transaction_id,
        userId: user.id,
        action: 'CREATE',
        oldValues: null,
        newValues: {
          title: transaction.title,
          amount: transaction.amount,
          transaction_type: transaction.transaction_type,
          payment_method: payload.payment_method,
          shift: payload.shift,
          transaction_status: trxStatus,
        },
      });

      await client.query('COMMIT');

      // Tambahkan nama shift & payment_method ke response
      transaction.shift_name = payload.shift;
      transaction.payment_method = payload.payment_method;

      return { transaction, isIdempotent: false };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /* ================================================================
   * READ — GET /transactions (list) & GET /transactions/{id}
   * ================================================================ */

  /**
   * Mengambil daftar transaksi dengan filter, paginasi, dan pembatasan akses per role.
   *
   * @param {{
   *   date_from?: string,
   *   date_to?: string,
   *   shift?: string,
   *   payment_method?: string,
   *   status?: string,
   *   transaction_type?: string,
   *   search?: string,
   *   page?: number,
   *   limit?: number,
   * }} filters
   * @param {{ id: number, role: string }} user
   */
  async getTransactions(filters, user) {
    const {
      date_from, date_to, shift, payment_method, status,
      transaction_type, search,
      page = 1, limit = 20,
    } = filters;

    const conditions = [];
    const values = [];
    let paramIdx = 0;

    // Karyawan hanya lihat miliknya
    const isEmployee = ['employee', 'operator'].includes(user.role?.toLowerCase());
    if (isEmployee) {
      paramIdx += 1;
      conditions.push(`t.created_by = $${paramIdx}`);
      values.push(user.id);
    }

    if (date_from) {
      paramIdx += 1;
      conditions.push(`t.transaction_date >= $${paramIdx}`);
      values.push(date_from);
    }
    if (date_to) {
      paramIdx += 1;
      conditions.push(`t.transaction_date <= $${paramIdx}`);
      values.push(date_to);
    }
    if (shift) {
      paramIdx += 1;
      conditions.push(`LOWER(st.shift_name) = LOWER($${paramIdx})`);
      values.push(shift);
    }
    if (payment_method) {
      paramIdx += 1;
      conditions.push(`LOWER(pm.method_code) = LOWER($${paramIdx})`);
      values.push(payment_method);
    }
    if (status) {
      paramIdx += 1;
      conditions.push(`t.transaction_status = $${paramIdx}`);
      values.push(status);
    }
    if (transaction_type) {
      paramIdx += 1;
      conditions.push(`t.transaction_type = $${paramIdx}`);
      values.push(transaction_type);
    }
    if (search) {
      paramIdx += 1;
      conditions.push(`(t.title ILIKE $${paramIdx} OR t.notes ILIKE $${paramIdx})`);
      values.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countSql = `
      SELECT COUNT(*) AS total
      FROM transaction t
      LEFT JOIN shift_types st ON t.shift_type_id = st.shift_type_id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.payment_method_id
      ${whereClause}
    `;
    const countResult = await this._query(countSql, values);
    const total = Number(countResult.rows[0].total);

    // Paginated data
    const offset = (page - 1) * limit;
    paramIdx += 1;
    const limitParam = paramIdx;
    paramIdx += 1;
    const offsetParam = paramIdx;

    const dataSql = `
      SELECT
        t.transaction_id, t.title, t.transaction_type, t.amount,
        t.transaction_date, t.transaction_time, t.transaction_status,
        t.notes, t.is_duplicate, t.created_at, t.update_at,
        t.created_by, t.confirmed_by, t.payment_proof_id,
        t.category_id, t.idempotency_key,
        st.shift_name,
        pm.method_code AS payment_method,
        c.name AS category_name,
        u.fullname AS created_by_name
      FROM transaction t
      LEFT JOIN shift_types st ON t.shift_type_id = st.shift_type_id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.payment_method_id
      LEFT JOIN categories c ON t.category_id = c.category_id
      LEFT JOIN users u ON t.created_by = u.user_id
      ${whereClause}
      ORDER BY t.transaction_date DESC, t.transaction_time DESC, t.transaction_id DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const dataResult = await this._query(dataSql, [...values, limit, offset]);

    const transactions = dataResult.rows.map((row) => this._normalizeRow(row));
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    };
  }

  /**
   * Mengambil satu transaksi berdasarkan ID, dengan pengecekan akses.
   */
  async getTransactionById(transactionId, user) {
    const result = await this._query(
      `SELECT
         t.*, st.shift_name, pm.method_code AS payment_method,
         c.name AS category_name, u.fullname AS created_by_name
       FROM transaction t
       LEFT JOIN shift_types st ON t.shift_type_id = st.shift_type_id
       LEFT JOIN payment_methods pm ON t.payment_method_id = pm.payment_method_id
       LEFT JOIN categories c ON t.category_id = c.category_id
       LEFT JOIN users u ON t.created_by = u.user_id
       WHERE t.transaction_id = $1
       LIMIT 1`,
      [transactionId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError(
        `Transaksi dengan ID ${transactionId} tidak ditemukan`,
        'TRANSACTION_NOT_FOUND',
      );
    }

    const transaction = this._normalizeRow(result.rows[0]);

    // Karyawan hanya boleh lihat miliknya
    const isEmployee = ['employee', 'operator'].includes(user.role?.toLowerCase());
    if (isEmployee && transaction.created_by !== user.id) {
      throw new AuthorizationError(
        'Anda tidak memiliki akses ke transaksi ini',
        'FORBIDDEN',
      );
    }

    return transaction;
  }

  /* ================================================================
   * UPDATE — PATCH /transactions/{id}  (owner only)
   * ================================================================ */

  /**
   * Mengupdate sebagian field transaksi (owner only).
   * Menyimpan old_values dan new_values ke audit log.
   */
  async updateTransaction(transactionId, payload, user) {
    const client = await this._pool.connect();

    try {
      await client.query('BEGIN');

      // Ambil data lama (lock row)
      const oldResult = await client.query(
        `SELECT t.*, st.shift_name, pm.method_code AS payment_method
         FROM transaction t
         LEFT JOIN shift_types st ON t.shift_type_id = st.shift_type_id
         LEFT JOIN payment_methods pm ON t.payment_method_id = pm.payment_method_id
         WHERE t.transaction_id = $1
         FOR UPDATE`,
        [transactionId],
      );

      if (oldResult.rowCount === 0) {
        await client.query('ROLLBACK');
        throw new NotFoundError(
          `Transaksi dengan ID ${transactionId} tidak ditemukan`,
          'TRANSACTION_NOT_FOUND',
        );
      }

      const oldRow = this._normalizeRow(oldResult.rows[0]);

      // Bangun SET clause secara dinamis
      const setClauses = [];
      const setValues = [];
      let pIdx = 0;

      const oldValues = {};
      const newValues = {};

      // Field yang boleh diupdate
      const updatableFields = {
        title: 'title',
        amount: 'amount',
        transaction_type: 'transaction_type',
        transaction_date: 'transaction_date',
        transaction_time: 'transaction_time',
        transaction_status: 'transaction_status',
        notes: 'notes',
        is_duplicate: 'is_duplicate',
      };

      for (const [payloadKey, dbCol] of Object.entries(updatableFields)) {
        if (payload[payloadKey] !== undefined) {
          pIdx += 1;
          setClauses.push(`${dbCol} = $${pIdx}`);
          setValues.push(payload[payloadKey]);
          oldValues[payloadKey] = oldRow[dbCol];
          newValues[payloadKey] = payload[payloadKey];
        }
      }

      // Resolve shift jika diupdate
      if (payload.shift !== undefined) {
        const shiftTypeId = await this._resolveShiftTypeId(client, payload.shift);
        pIdx += 1;
        setClauses.push(`shift_type_id = $${pIdx}`);
        setValues.push(shiftTypeId);
        oldValues.shift = oldRow.shift_name;
        newValues.shift = payload.shift;
      }

      // Resolve payment_method jika diupdate
      if (payload.payment_method !== undefined) {
        const methodId = await this._resolvePaymentMethodId(client, payload.payment_method);
        pIdx += 1;
        setClauses.push(`payment_method_id = $${pIdx}`);
        setValues.push(methodId);
        oldValues.payment_method = oldRow.payment_method;
        newValues.payment_method = payload.payment_method;
      }

      // Resolve category_id jika diupdate
      if (payload.category_id !== undefined) {
        if (payload.category_id !== null) {
          await this._resolveCategoryId(client, payload.category_id);
        }
        pIdx += 1;
        setClauses.push(`category_id = $${pIdx}`);
        setValues.push(payload.category_id);
        oldValues.category_id = oldRow.category_id;
        newValues.category_id = payload.category_id;
      }

      if (setClauses.length === 0) {
        await client.query('COMMIT');
        return oldRow;
      }

      // update_at
      pIdx += 1;
      setClauses.push(`update_at = $${pIdx}`);
      setValues.push(new Date());

      pIdx += 1;
      setValues.push(transactionId);

      const updateSql = `
        UPDATE transaction
        SET ${setClauses.join(', ')}
        WHERE transaction_id = $${pIdx}
        RETURNING *
      `;

      const updateResult = await client.query(updateSql, setValues);
      const updated = this._normalizeRow(updateResult.rows[0]);

      // Audit log — aksi UPDATE
      await this._writeAuditLog(client, {
        transactionId,
        userId: user.id,
        action: 'UPDATE',
        oldValues,
        newValues,
      });

      await client.query('COMMIT');

      // Tambahkan join info
      if (payload.shift) {
        updated.shift_name = payload.shift;
      } else {
        updated.shift_name = oldRow.shift_name;
      }
      if (payload.payment_method) {
        updated.payment_method = payload.payment_method;
      } else {
        updated.payment_method = oldRow.payment_method;
      }

      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /* ================================================================
   * DELETE — DELETE /transactions/{id}  (owner only)
   * ================================================================ */

  /**
   * Menghapus transaksi (soft-action: tulis audit log sebelum delete).
   */
  async deleteTransaction(transactionId, user) {
    const client = await this._pool.connect();

    try {
      await client.query('BEGIN');

      const oldResult = await client.query(
        `SELECT t.*, st.shift_name, pm.method_code AS payment_method
         FROM transaction t
         LEFT JOIN shift_types st ON t.shift_type_id = st.shift_type_id
         LEFT JOIN payment_methods pm ON t.payment_method_id = pm.payment_method_id
         WHERE t.transaction_id = $1
         FOR UPDATE`,
        [transactionId],
      );

      if (oldResult.rowCount === 0) {
        await client.query('ROLLBACK');
        throw new NotFoundError(
          `Transaksi dengan ID ${transactionId} tidak ditemukan`,
          'TRANSACTION_NOT_FOUND',
        );
      }

      const oldRow = this._normalizeRow(oldResult.rows[0]);

      // Audit log dulu sebelum delete (karena ON DELETE CASCADE di audit_logs)
      // Kita simpan snapshot di old_values
      await this._writeAuditLog(client, {
        transactionId,
        userId: user.id,
        action: 'DELETE',
        oldValues: {
          title: oldRow.title,
          amount: oldRow.amount,
          transaction_type: oldRow.transaction_type,
          payment_method: oldRow.payment_method,
          shift: oldRow.shift_name,
          transaction_status: oldRow.transaction_status,
          transaction_date: oldRow.transaction_date,
        },
        newValues: null,
      });

      await client.query('DELETE FROM transaction WHERE transaction_id = $1', [transactionId]);

      await client.query('COMMIT');

      return oldRow;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export default TransactionService;
