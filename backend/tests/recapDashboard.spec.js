import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server.js';
import { pool } from '../src/core/database.js';
import TokenManager from '../src/tokenize/TokenManager.js';
import {
  EXPECTED_MANUAL_RECAP,
  MANUAL_60_TRANSACTIONS,
  seed60Transactions,
} from '../database/seedTransactions60.js';

describe('GET /recap & GET /dashboard/summary (SQL SUM GROUP BY vs Hitungan Manual)', () => {
  let app;
  const ownerToken = TokenManager.generateAccessToken({ id: 1, username: 'owner', role: 'owner' });
  const employeeToken = TokenManager.generateAccessToken({ id: 2, username: 'employee', role: 'employee' });

  beforeAll(async () => {
    app = createApp();
    // Kosongkan tabel transaction untuk menguji kondisi DB kosong terlebih dahulu
    await pool.query('TRUNCATE TABLE transaction RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('GET /dashboard/summary & GET /recap mengembalikan struktur kosong yang valid saat belum ada transaksi', async () => {
    const summaryRes = await request(app)
      .get('/dashboard/summary?date=2026-11-26')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(summaryRes.status).toBe(200);
    const summary = summaryRes.body.data;
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

    const recapRes = await request(app)
      .get('/recap?date_from=2026-11-20&date_to=2026-11-26&group_by=date,shift,method')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(recapRes.status).toBe(200);
    expect(recapRes.body.data.groups).toEqual([]);
    expect(recapRes.body.data.grand_total).toBe(0);
    expect(recapRes.body.data.summary.transaction_count).toBe(0);
  });

  describe('Setelah seed 60 transaksi (52 terkonfirmasi, 4 perlu_ditinjau, 4 ditolak)', () => {
    beforeAll(async () => {
      const inserted = await seed60Transactions(pool);
      expect(inserted).toBe(60);
      expect(MANUAL_60_TRANSACTIONS).toHaveLength(60);
    });

    it('menolak akses tanpa token (401) dan role employee (403 FORBIDDEN)', async () => {
      for (const path of ['/recap', '/dashboard/summary']) {
        const unauth = await request(app).get(path);
        expect(unauth.status).toBe(401);

        const forbidden = await request(app)
          .get(path)
          .set('Authorization', `Bearer ${employeeToken}`);
        expect(forbidden.status).toBe(403);
        expect(forbidden.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('menolak parameter tidak valid pada GET /recap dengan 400 VALIDATION_ERROR', async () => {
      const invalidOrder = await request(app)
        .get('/recap?date_from=2026-11-26&date_to=2026-11-20')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(invalidOrder.status).toBe(400);
      expect(invalidOrder.body.error.code).toBe('VALIDATION_ERROR');

      const invalidGroup = await request(app)
        .get('/recap?group_by=date,invalid_col')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(invalidGroup.status).toBe(400);
      expect(invalidGroup.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /recap?date_from&date_to&group_by=date,shift,method menghasilkan selisih Rp0 terhadap hitungan manual', async () => {
      const res = await request(app)
        .get('/recap?date_from=2026-11-20&date_to=2026-11-26&group_by=date,shift,method')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      const { groups, grand_total, summary } = res.body.data;

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
        request(app)
          .get('/recap?date_from=2026-11-20&date_to=2026-11-26&group_by=date')
          .set('Authorization', `Bearer ${ownerToken}`),
        request(app)
          .get('/recap?date_from=2026-11-20&date_to=2026-11-26&group_by=shift')
          .set('Authorization', `Bearer ${ownerToken}`),
        request(app)
          .get('/recap?date_from=2026-11-20&date_to=2026-11-26&group_by=method')
          .set('Authorization', `Bearer ${ownerToken}`),
      ]);

      expect(byDateRes.body.data.groups).toEqual(EXPECTED_MANUAL_RECAP.byDate);
      expect(byDateRes.body.data.grand_total).toBe(EXPECTED_MANUAL_RECAP.grandTotal.grand_total);

      expect(byShiftRes.body.data.groups).toEqual(EXPECTED_MANUAL_RECAP.byShift);
      expect(byShiftRes.body.data.grand_total).toBe(EXPECTED_MANUAL_RECAP.grandTotal.grand_total);

      expect(byMethodRes.body.data.groups).toEqual(EXPECTED_MANUAL_RECAP.byMethod);
      expect(byMethodRes.body.data.grand_total).toBe(EXPECTED_MANUAL_RECAP.grandTotal.grand_total);
    });

    it('GET /dashboard/summary mengembalikan total hari ini, per shift, per metode, perlu_ditinjau, dan 7 hari terakhir yang akurat (selisih Rp0)', async () => {
      const res = await request(app)
        .get('/dashboard/summary?date=2026-11-26')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
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
