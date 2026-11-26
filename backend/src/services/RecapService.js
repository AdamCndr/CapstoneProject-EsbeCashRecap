import { query as defaultQuery } from '../core/database.js';

/**
 * Definisi kolom SELECT, GROUP BY, dan ORDER BY untuk tiap dimensi group_by yang diizinkan.
 * Whitelist statis mencegah SQL injection.
 */
const GROUP_DEFINITIONS = {
  date: {
    select: "TO_CHAR(t.transaction_date, 'YYYY-MM-DD') AS date",
    groupBy: 't.transaction_date',
    orderBy: 't.transaction_date ASC',
  },
  shift: {
    select: "COALESCE(st.shift_name, 'tanpa_shift') AS shift",
    groupBy: 'st.shift_name',
    orderBy: 'st.shift_name ASC',
  },
  method: {
    select: "COALESCE(pm.method_code, 'tanpa_metode') AS method",
    groupBy: 'pm.method_code',
    orderBy: 'pm.method_code ASC',
  },
  category: {
    select: "COALESCE(c.name, 'Tanpa Kategori') AS category",
    groupBy: 'c.name',
    orderBy: 'c.name ASC',
  },
};

/**
 * Service rekapitulasi transaksi berbasis SQL SUM ... GROUP BY.
 * Seluruh agregasi nominal & jumlah transaksi dijalankan di PostgreSQL
 * hanya untuk transaksi berstatus `terkonfirmasi`.
 */
class RecapService {
  /**
   * @param {{ query?: (text: string, params?: Array<unknown>) => Promise<import('pg').QueryResult> }} [deps]
   */
  constructor({ query = defaultQuery } = {}) {
    this._query = query;
  }

  /**
   * Mengonversi tipe BIGINT/NUMERIC string dari driver `pg` menjadi JS `Number`.
   */
  _toNumber(value) {
    if (value === null || value === undefined) return 0;
    return Number(value);
  }

  /**
   * Menghitung rekapitulasi transaksi per grup dan grand_total menggunakan SQL SUM ... GROUP BY.
   *
   * @param {{ dateFrom?: string, dateTo?: string, groupBy: string[] }} params
   */
  async getRecap({ dateFrom, dateTo, groupBy }) {
    const conditions = ["t.transaction_status = 'terkonfirmasi'"];
    const values = [];

    if (dateFrom) {
      values.push(dateFrom);
      conditions.push(`t.transaction_date >= $${values.length}::date`);
    }

    if (dateTo) {
      values.push(dateTo);
      conditions.push(`t.transaction_date <= $${values.length}::date`);
    }

    const whereClause = conditions.join(' AND ');

    const selectCols = groupBy.map((dim) => GROUP_DEFINITIONS[dim].select);
    const groupByCols = groupBy.map((dim) => GROUP_DEFINITIONS[dim].groupBy);
    const orderByCols = groupBy.map((dim) => GROUP_DEFINITIONS[dim].orderBy);

    // 1. Query agregasi per grup di PostgreSQL
    const groupedSql = `
      SELECT
        ${selectCols.join(',\n        ')},
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pemasukan' THEN t.amount ELSE 0 END), 0) AS pemasukan,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pengeluaran' THEN t.amount ELSE 0 END), 0) AS pengeluaran,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pemasukan' THEN t.amount ELSE -t.amount END), 0) AS total,
        COUNT(*) AS transaction_count
      FROM transaction t
      LEFT JOIN shift_types st ON t.shift_type_id = st.shift_type_id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.payment_method_id
      LEFT JOIN categories c ON t.category_id = c.category_id
      WHERE ${whereClause}
      GROUP BY ${groupByCols.join(', ')}
      ORDER BY ${orderByCols.join(', ')}
    `;

    // 2. Query grand_total langsung di PostgreSQL (bukan menjumlahkan hasil grup di JS)
    const grandTotalSql = `
      SELECT
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pemasukan' THEN t.amount ELSE 0 END), 0) AS total_pemasukan,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pengeluaran' THEN t.amount ELSE 0 END), 0) AS total_pengeluaran,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'pemasukan' THEN t.amount ELSE -t.amount END), 0) AS grand_total,
        COUNT(*) AS transaction_count
      FROM transaction t
      WHERE ${whereClause}
    `;

    const [groupedRes, grandTotalRes] = await Promise.all([
      this._query(groupedSql, values),
      this._query(grandTotalSql, values),
    ]);

    const groups = groupedRes.rows.map((row) => {
      const entry = {};
      for (const dim of groupBy) {
        entry[dim] = row[dim];
      }
      entry.pemasukan = this._toNumber(row.pemasukan);
      entry.pengeluaran = this._toNumber(row.pengeluaran);
      entry.total = this._toNumber(row.total);
      entry.transaction_count = this._toNumber(row.transaction_count);
      return entry;
    });

    const gtRow = grandTotalRes.rows[0] || {};
    const grandTotalValue = this._toNumber(gtRow.grand_total);
    const totalPemasukan = this._toNumber(gtRow.total_pemasukan);
    const totalPengeluaran = this._toNumber(gtRow.total_pengeluaran);
    const totalCount = this._toNumber(gtRow.transaction_count);

    return {
      period: {
        date_from: dateFrom || null,
        date_to: dateTo || null,
        group_by: groupBy,
      },
      groups,
      grand_total: grandTotalValue,
      summary: {
        total_pemasukan: totalPemasukan,
        total_pengeluaran: totalPengeluaran,
        grand_total: grandTotalValue,
        transaction_count: totalCount,
      },
    };
  }
}

export default RecapService;
