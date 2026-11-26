import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';
import { pool } from '../src/core/database.js';
import TokenManager from '../src/tokenize/TokenManager.js';
import {
  EXPECTED_MANUAL_RECAP,
  MANUAL_60_TRANSACTIONS,
  seed60Transactions,
} from '../database/seedTransactions60.js';

describe('GET /recap & GET /dashboard/summary (SQL SUM GROUP BY vs Hitungan Manual)', () => {
  let server;
  const ownerToken = TokenManager.generateAccessToken({ id: 1, username: 'owner', role: 'owner' });
  const employeeToken = TokenManager.generateAccessToken({ id: 2, username: 'employee', role: 'employee' });

  beforeAll(async () => {
    server = await createServer();
    // Kosongkan tabel transaction untuk menguji kondisi DB kosong terlebih dahulu
    await pool.query('TRUNCATE TABLE transaction RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('GET /dashboard/summary & GET /recap mengembalikan struktur kosong yang valid saat belum ada transaksi', async () => {
    const summaryRes = await server.inject({
      method: 'GET',
      url: '/dashboard/summary?date=2026-11-26',
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(summaryRes.statusCode).toBe(200);
    const summary = summaryRes.result.data;
    expect(summary.date).toBe('2026-11-26');
    expect(summary.total_hari_ini).toEqual({
      pemasukan: 0,
      pengeluaran: 0,
      total: 0,
      transaction_count: 0,
    });
    expect(summary.per_shift).toEqual({
      pagi: { pemasukan: 0, pengeluaran: 0, total: 0, transaction_count: 0 },
      siang: { pemasukan: 0, pengeluaran: 0, total: 0, transaction_count: 0 },
    });
    expect(summary.per_metode).toEqual({
      tunai: { pemasukan: 0, pengeluaran: 0, total: 0, transaction_count: 0 },
      qris: { pemasukan: 0, pengeluaran: 0, total: 0, transaction_count: 0 },
      transfer: { pemasukan: 0, pengeluaran: 0, total: 0, transaction_count: 0 },
    });
    expect(summary.perlu_ditinjau_count).toBe(0);
    expect(summary.ringkasan_7_hari).toHaveLength(7);
    for (const day of summary.ringkasan_7_hari) {
      expect(day.total).toBe(0);
      expect(day.transaction_count).toBe(0);
      expect(typeof day.total).toBe('number');
    }

    const recapRes = await server.inject({
      method: 'GET',
      url: '/recap?date_from=2026-11-20&date_to=2026-11-26&group_by=date,shift,method',
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(recapRes.statusCode).toBe(200);
    expect(recapRes.result.data.groups).toEqual([]);
    expect(recapRes.result.data.grand_total).toBe(0);
    expect(recapRes.result.data.summary.transaction_count).toBe(0);
  });

  describe('Setelah seed 60 transaksi (52 terkonfirmasi, 4 perlu_ditinjau, 4 ditolak)', () => {
    beforeAll(async () => {
      const inserted = await seed60Transactions(pool);
      expect(inserted).toBe(60);
      expect(MANUAL_60_TRANSACTIONS).toHaveLength(60);
    });

    it('menolak akses tanpa token (401) dan role employee (403 FORBIDDEN)', async () => {
      for (const path of ['/recap', '/dashboard/summary']) {
        const unauth = await server.inject({ method: 'GET', url: path });
        expect(unauth.statusCode).toBe(401);

        const forbidden = await server.inject({
          method: 'GET',
          url: path,
          headers: { authorization: `Bearer ${employeeToken}` },
        });
        expect(forbidden.statusCode).toBe(403);
        expect(forbidden.result.error.code).toBe('FORBIDDEN');
      }
    });

    it('menolak parameter tidak valid pada GET /recap dengan 400 VALIDATION_ERROR', async () => {
      const invalidOrder = await server.inject({
        method: 'GET',
        url: '/recap?date_from=2026-11-26&date_to=2026-11-20',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(invalidOrder.statusCode).toBe(400);
      expect(invalidOrder.result.error.code).toBe('VALIDATION_ERROR');

      const invalidGroup = await server.inject({
        method: 'GET',
        url: '/recap?group_by=date,invalid_col',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(invalidGroup.statusCode).toBe(400);
      expect(invalidGroup.result.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /recap?date_from&date_to&group_by=date,shift,method menghasilkan selisih Rp0 terhadap hitungan manual', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/recap?date_from=2026-11-20&date_to=2026-11-26&group_by=date,shift,method',
        headers: { authorization: `Bearer ${ownerToken}` },
      });

      expect(res.statusCode).toBe(200);
      const { groups, grand_total, summary } = res.result.data;

      // Pastikan semua tipe numerik sudah dikonversi dari string pg -> JS Number
      expect(typeof grand_total).toBe('number');
      expect(typeof summary.transaction_count).toBe('number');
      expect(typeof summary.total_pemasukan).toBe('number');
      expect(typeof summary.total_pengeluaran).toBe('number');

      // Selisih Rp 0 terhadap grand_total manual
      expect(grand_total - EXPECTED_MANUAL_RECAP.grandTotal.grand_total).toBe(0);
      expect(summary.total_pemasukan - EXPECTED_MANUAL_RECAP.grandTotal.total_pemasukan).toBe(0);
      expect(summary.total_pengeluaran - EXPECTED_MANUAL_RECAP.grandTotal.total_pengeluaran).toBe(0);
      expect(summary.transaction_count).toBe(EXPECTED_MANUAL_RECAP.confirmedCount);

      // Pastikan 22 kelompok kombinasi (date, shift, method) persis sama (selisih Rp 0 tiap grup)
      expect(groups).toHaveLength(EXPECTED_MANUAL_RECAP.byDateShiftMethod.length);
      expect(groups).toEqual(EXPECTED_MANUAL_RECAP.byDateShiftMethod);
    });

    it('GET /recap per dimensi tunggal (date, shift, method) masing-masing berselisih Rp0', async () => {
      const [byDateRes, byShiftRes, byMethodRes] = await Promise.all([
        server.inject({
          method: 'GET',
          url: '/recap?date_from=2026-11-20&date_to=2026-11-26&group_by=date',
          headers: { authorization: `Bearer ${ownerToken}` },
        }),
        server.inject({
          method: 'GET',
          url: '/recap?date_from=2026-11-20&date_to=2026-11-26&group_by=shift',
          headers: { authorization: `Bearer ${ownerToken}` },
        }),
        server.inject({
          method: 'GET',
          url: '/recap?date_from=2026-11-20&date_to=2026-11-26&group_by=method',
          headers: { authorization: `Bearer ${ownerToken}` },
        }),
      ]);

      expect(byDateRes.result.data.groups).toEqual(EXPECTED_MANUAL_RECAP.byDate);
      expect(byDateRes.result.data.grand_total).toBe(EXPECTED_MANUAL_RECAP.grandTotal.grand_total);

      expect(byShiftRes.result.data.groups).toEqual(EXPECTED_MANUAL_RECAP.byShift);
      expect(byShiftRes.result.data.grand_total).toBe(EXPECTED_MANUAL_RECAP.grandTotal.grand_total);

      expect(byMethodRes.result.data.groups).toEqual(EXPECTED_MANUAL_RECAP.byMethod);
      expect(byMethodRes.result.data.grand_total).toBe(EXPECTED_MANUAL_RECAP.grandTotal.grand_total);
    });

    it('GET /dashboard/summary mengembalikan total hari ini, per shift, per metode, perlu_ditinjau, dan 7 hari terakhir yang akurat (selisih Rp0)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/dashboard/summary?date=2026-11-26',
        headers: { authorization: `Bearer ${ownerToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.result.data;
      const expected = EXPECTED_MANUAL_RECAP.dashboardOn20261126;

      expect(data.date).toBe(expected.date);
      expect(data.total_hari_ini).toEqual(expected.total_hari_ini);
      expect(data.per_shift).toEqual(expected.per_shift);
      expect(data.per_metode).toEqual(expected.per_metode);
      // Hanya 4 transaksi perlu_ditinjau (4 ditolak dan 52 terkonfirmasi tidak terhitung)
      expect(data.perlu_ditinjau_count).toBe(expected.perlu_ditinjau_count);
      expect(typeof data.perlu_ditinjau_count).toBe('number');
      // Ringkasan 7 hari terakhir (2026-11-20 s/d 2026-11-26) cocok persis
      expect(data.ringkasan_7_hari).toEqual(EXPECTED_MANUAL_RECAP.byDate);
    });
  });
});
