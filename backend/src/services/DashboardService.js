import { query as defaultQuery } from '../core/database.js';

/**
 * Mengambil tanggal hari ini dalam zona waktu WIB (Asia/Jakarta) berformat YYYY-MM-DD.
 */
function getTodayWibDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Service ringkasan dashboard pemilik berbasis SQL SUM ... GROUP BY.
 * Menghitung hanya status = 'terkonfirmasi' (kecuali counter perlu_ditinjau).
 */
class DashboardService {
  /**
   * @param {{ query?: (text: string, params?: Array<unknown>) => Promise<import('pg').QueryResult> }} [deps]
   */
  constructor({ query = defaultQuery } = {}) {
    this._query = query;
  }

  _toNumber(value) {
    if (value === null || value === undefined) return 0;
    return Number(value);
  }

  /**
   * Mengembalikan ringkasan dashboard untuk tanggal tertentu (default hari ini WIB).
   * Jika belum ada transaksi, tetap mengembalikan struktur kosong yang valid (nilai 0).
   *
   * @param {{ date?: string }} [params]
   */
  async getDashboardSummary({ date } = {}) {
    const targetDate = date || getTodayWibDateString();

    // 1. Total hari ini (SQL SUM)
    const todaySql = `
      SELECT
        COALESCE(SUM(CASE WHEN transaction_type = 'pemasukan' THEN amount ELSE 0 END), 0) AS pemasukan,
        COALESCE(SUM(CASE WHEN transaction_type = 'pengeluaran' THEN amount ELSE 0 END), 0) AS pengeluaran,
        COALESCE(SUM(CASE WHEN transaction_type = 'pemasukan' THEN amount ELSE -amount END), 0) AS total,
        COUNT(*) AS transaction_count
      FROM transaction
      WHERE transaction_status = 'terkonfirmasi'
        AND transaction_date = $1::date
    `;

    // 2. Per shift hari ini (LEFT JOIN shift_types + SQL SUM GROUP BY)
    const perShiftSql = `
      SELECT
        LOWER(st.shift_name) AS shift,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pemasukan' THEN t.amount ELSE 0 END), 0) AS pemasukan,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pengeluaran' THEN t.amount ELSE 0 END), 0) AS pengeluaran,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pemasukan' THEN t.amount ELSE -t.amount END), 0) AS total,
        COUNT(t.transaction_id) AS transaction_count
      FROM shift_types st
      LEFT JOIN transaction t
        ON t.shift_type_id = st.shift_type_id
        AND t.transaction_status = 'terkonfirmasi'
        AND t.transaction_date = $1::date
      GROUP BY st.shift_type_id, st.shift_name
      ORDER BY st.shift_type_id ASC
    `;

    // 3. Per metode hari ini (LEFT JOIN payment_methods + SQL SUM GROUP BY)
    const perMethodSql = `
      SELECT
        LOWER(pm.method_code) AS method,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pemasukan' THEN t.amount ELSE 0 END), 0) AS pemasukan,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pengeluaran' THEN t.amount ELSE 0 END), 0) AS pengeluaran,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pemasukan' THEN t.amount ELSE -t.amount END), 0) AS total,
        COUNT(t.transaction_id) AS transaction_count
      FROM payment_methods pm
      LEFT JOIN transaction t
        ON t.payment_method_id = pm.payment_method_id
        AND t.transaction_status = 'terkonfirmasi'
        AND t.transaction_date = $1::date
      GROUP BY pm.payment_method_id, pm.method_code
      ORDER BY pm.payment_method_id ASC
    `;

    // 4. Jumlah transaksi berstatus perlu_ditinjau (seluruh tanggal agar tidak terlewat owner)
    const pendingReviewSql = `
      SELECT COUNT(*) AS perlu_ditinjau_count
      FROM transaction
      WHERE transaction_status = 'perlu_ditinjau'
    `;

    // 5. Ringkasan 7 hari terakhir (termasuk hari tanpa transaksi via generate_series)
    const last7DaysSql = `
      SELECT
        TO_CHAR(d.day::date, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pemasukan' THEN t.amount ELSE 0 END), 0) AS pemasukan,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pengeluaran' THEN t.amount ELSE 0 END), 0) AS pengeluaran,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pemasukan' THEN t.amount ELSE -t.amount END), 0) AS total,
        COUNT(t.transaction_id) AS transaction_count
      FROM generate_series(
        $1::date - INTERVAL '6 days',
        $1::date,
        INTERVAL '1 day'
      ) AS d(day)
      LEFT JOIN transaction t
        ON t.transaction_date = d.day::date
        AND t.transaction_status = 'terkonfirmasi'
      GROUP BY d.day
      ORDER BY d.day ASC
    `;

    const [todayRes, shiftRes, methodRes, pendingRes, last7Res] = await Promise.all([
      this._query(todaySql, [targetDate]),
      this._query(perShiftSql, [targetDate]),
      this._query(perMethodSql, [targetDate]),
      this._query(pendingReviewSql),
      this._query(last7DaysSql, [targetDate]),
    ]);

    const todayRow = todayRes.rows[0] || {};
    const totalHariIni = {
      pemasukan: this._toNumber(todayRow.pemasukan),
      pengeluaran: this._toNumber(todayRow.pengeluaran),
      total: this._toNumber(todayRow.total),
      transaction_count: this._toNumber(todayRow.transaction_count),
    };

    // Struktur default valid walau master tabel/data kosong
    const perShift = {
      pagi: { pemasukan: 0, pengeluaran: 0, total: 0, transaction_count: 0 },
      siang: { pemasukan: 0, pengeluaran: 0, total: 0, transaction_count: 0 },
    };
    for (const row of shiftRes.rows) {
      perShift[row.shift] = {
        pemasukan: this._toNumber(row.pemasukan),
        pengeluaran: this._toNumber(row.pengeluaran),
        total: this._toNumber(row.total),
        transaction_count: this._toNumber(row.transaction_count),
      };
    }

    const perMetode = {
      tunai: { pemasukan: 0, pengeluaran: 0, total: 0, transaction_count: 0 },
      qris: { pemasukan: 0, pengeluaran: 0, total: 0, transaction_count: 0 },
      transfer: { pemasukan: 0, pengeluaran: 0, total: 0, transaction_count: 0 },
    };
    for (const row of methodRes.rows) {
      perMetode[row.method] = {
        pemasukan: this._toNumber(row.pemasukan),
        pengeluaran: this._toNumber(row.pengeluaran),
        total: this._toNumber(row.total),
        transaction_count: this._toNumber(row.transaction_count),
      };
    }

    const perluDitinjauCount = this._toNumber(pendingRes.rows[0]?.perlu_ditinjau_count);

    const ringkasan7Hari = last7Res.rows.map((row) => ({
      date: row.date,
      pemasukan: this._toNumber(row.pemasukan),
      pengeluaran: this._toNumber(row.pengeluaran),
      total: this._toNumber(row.total),
      transaction_count: this._toNumber(row.transaction_count),
    }));

    return {
      date: targetDate,
      total_hari_ini: totalHariIni,
      per_shift: perShift,
      per_metode: perMetode,
      perlu_ditinjau_count: perluDitinjauCount,
      ringkasan_7_hari: ringkasan7Hari,
    };
  }
}

export default DashboardService;
