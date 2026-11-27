import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/server.js';
import TokenManager from '../src/tokenize/TokenManager.js';
import TransactionService from '../src/services/TransactionService.js';

/**
 * Membuat mock pool PostgreSQL in-memory untuk menguji TransactionService
 * beserta alur BEGIN/COMMIT/ROLLBACK, audit log, BIGINT string -> Number,
 * idempotency key, filter, paginasi, dan akses lintas user.
 */
function createInMemoryPool() {
  const state = {
    nextTrxId: 1,
    nextAuditId: 1,
    transactions: [],
    auditLogs: [],
    shiftTypes: [
      { shift_type_id: '1', shift_name: 'pagi' },
      { shift_type_id: '2', shift_name: 'siang' },
    ],
    paymentMethods: [
      { payment_method_id: '1', method_code: 'tunai' },
      { payment_method_id: '2', method_code: 'qris' },
      { payment_method_id: '3', method_code: 'transfer' },
    ],
    categories: [
      { category_id: '1', name: 'Jasa Fotokopi', is_active: true },
    ],
    users: [
      { user_id: '1', fullname: 'Pemilik Toko Esbe' },
      { user_id: '2', fullname: 'Karyawan Kasir' },
      { user_id: '3', fullname: 'Karyawan Lain' },
    ],
  };

  async function runQuery(sql, params = []) {
    const q = sql.trim().replace(/\s+/g, ' ');

    if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
      return { rowCount: 0, rows: [] };
    }

    if (q.startsWith('SELECT shift_type_id FROM shift_types')) {
      const found = state.shiftTypes.find((s) => s.shift_name.toLowerCase() === String(params[0]).toLowerCase());
      return { rowCount: found ? 1 : 0, rows: found ? [found] : [] };
    }

    if (q.startsWith('SELECT payment_method_id FROM payment_methods')) {
      const found = state.paymentMethods.find((p) => p.method_code.toLowerCase() === String(params[0]).toLowerCase());
      return { rowCount: found ? 1 : 0, rows: found ? [found] : [] };
    }

    if (q.startsWith('SELECT category_id FROM categories')) {
      const found = state.categories.find((c) => Number(c.category_id) === Number(params[0]) && c.is_active);
      return { rowCount: found ? 1 : 0, rows: found ? [found] : [] };
    }

    // Idempotency check
    if (q.includes('WHERE t.idempotency_key = $1 AND t.created_by = $2')) {
      const found = state.transactions.find(
        (t) => t.idempotency_key === params[0] && Number(t.created_by) === Number(params[1]),
      );
      return { rowCount: found ? 1 : 0, rows: found ? [found] : [] };
    }

    // Insert audit log (cek sebelum INSERT INTO transaction karena prefix mirip)
    if (q.startsWith('INSERT INTO transaction_audit_logs')) {
      state.auditLogs.push({
        audit_id: String(state.nextAuditId++),
        transaction_id: String(params[0]),
        user_id: String(params[1]),
        action: params[2],
        old_values: params[3],
        new_values: params[4],
      });
      return { rowCount: 1, rows: [] };
    }

    // Insert transaction (simulasi BIGINT & NUMERIC sebagai string seperti pg)
    if (q.startsWith('INSERT INTO transaction (')) {
      const row = {
        transaction_id: String(state.nextTrxId++),
        shift_type_id: String(params[0]),
        payment_method_id: String(params[1]),
        payment_proof_id: params[2] ? String(params[2]) : null,
        category_id: params[3] ? String(params[3]) : null,
        created_by: String(params[4]),
        confirmed_by: String(params[5]),
        title: params[6],
        transaction_type: params[7],
        amount: String(params[8]),
        transaction_date: params[9],
        transaction_time: params[10],
        transaction_status: params[11],
        notes: params[12],
        external_trx_id: params[13],
        is_duplicate: params[14],
        idempotency_key: params[15],
        shift_name: state.shiftTypes.find((s) => Number(s.shift_type_id) === Number(params[0]))?.shift_name,
        payment_method: state.paymentMethods.find((p) => Number(p.payment_method_id) === Number(params[1]))?.method_code,
        created_at: new Date().toISOString(),
        update_at: new Date().toISOString(),
      };
      state.transactions.push(row);
      return { rowCount: 1, rows: [row] };
    }

    // Select by ID
    if (q.includes('WHERE t.transaction_id = $1')) {
      const found = state.transactions.find((t) => Number(t.transaction_id) === Number(params[0]));
      return { rowCount: found ? 1 : 0, rows: found ? [found] : [] };
    }

    // Count & List
    if (q.startsWith('SELECT COUNT(*) AS total FROM transaction')) {
      let filtered = [...state.transactions];
      if (q.includes('t.created_by = $1')) {
        filtered = filtered.filter((t) => Number(t.created_by) === Number(params[0]));
      }
      return { rowCount: 1, rows: [{ total: String(filtered.length) }] };
    }

    if (q.includes('ORDER BY t.transaction_date DESC')) {
      let filtered = [...state.transactions];
      if (q.includes('t.created_by = $1')) {
        filtered = filtered.filter((t) => Number(t.created_by) === Number(params[0]));
      }
      const limit = Number(params[params.length - 2]);
      const offset = Number(params[params.length - 1]);
      return {
        rowCount: filtered.slice(offset, offset + limit).length,
        rows: filtered.slice(offset, offset + limit),
      };
    }

    // Update
    if (q.startsWith('UPDATE transaction SET')) {
      const trxId = Number(params[params.length - 1]);
      const idx = state.transactions.findIndex((t) => Number(t.transaction_id) === trxId);
      if (idx === -1) return { rowCount: 0, rows: [] };
      const updated = { ...state.transactions[idx], amount: String(params[0]), update_at: new Date().toISOString() };
      state.transactions[idx] = updated;
      return { rowCount: 1, rows: [updated] };
    }

    // Delete
    if (q.startsWith('DELETE FROM transaction WHERE transaction_id = $1')) {
      const trxId = Number(params[0]);
      const idx = state.transactions.findIndex((t) => Number(t.transaction_id) === trxId);
      if (idx === -1) return { rowCount: 0, rows: [] };
      state.transactions.splice(idx, 1);
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  }

  return {
    state,
    pool: {
      connect: async () => ({
        query: runQuery,
        release: () => {},
      }),
    },
    query: runQuery,
  };
}

describe('Transactions Endpoints', () => {
  const ownerToken = TokenManager.generateAccessToken({ id: 1, username: 'owner', role: 'owner' });
  const employeeToken = TokenManager.generateAccessToken({ id: 2, username: 'employee', role: 'employee' });
  const otherEmployeeToken = TokenManager.generateAccessToken({ id: 3, username: 'employee2', role: 'employee' });

  it('POST /transactions/cash valid menyimpan transaksi dengan status terkonfirmasi, audit log, dan BIGINT -> Number', async () => {
    const db = createInMemoryPool();
    const service = new TransactionService({ pool: db.pool, query: db.query });
    const app = createApp({ transactionService: service });

    const res = await request(app)
      .post('/transactions/cash')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Fotokopi 50 lembar',
        transaction_type: 'pemasukan',
        amount: 15000,
        shift: 'pagi',
        category_id: 1,
        trx_date: '2026-11-26',
      });

    assert.equal(res.status, 201);
    const { transaction } = res.body.data;
    assert.equal(typeof transaction.transaction_id, 'number');
    assert.equal(typeof transaction.amount, 'number');
    assert.equal(transaction.amount, 15000);
    assert.equal(transaction.transaction_status, 'terkonfirmasi');
    assert.equal(db.state.auditLogs.length, 1);
    assert.equal(db.state.auditLogs[0].action, 'CREATE');
  });

  it('POST /transactions/cash menolak input kosong, huruf, negatif, desimal, external_trx_id, dan status dari klien', async () => {
    const db = createInMemoryPool();
    const service = new TransactionService({ pool: db.pool, query: db.query });
    const app = createApp({ transactionService: service });

    const invalidPayloads = [
      {}, // kosong
      { title: 'Huruf', transaction_type: 'pemasukan', amount: 'abc', shift: 'pagi' }, // huruf
      { title: 'Negatif', transaction_type: 'pemasukan', amount: -5000, shift: 'pagi' }, // negatif
      { title: 'Desimal', transaction_type: 'pemasukan', amount: 1500.5, shift: 'pagi' }, // desimal
      { title: 'External ID', transaction_type: 'pemasukan', amount: 5000, shift: 'pagi', external_trx_id: 'EXT-1' }, // tunai + external_trx_id
      { title: 'Kirim status', transaction_type: 'pemasukan', amount: 5000, shift: 'pagi', status: 'completed' }, // klien kirim status
    ];

    for (const payload of invalidPayloads) {
      const res = await request(app)
        .post('/transactions/cash')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(payload);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(res.body.error.details.fields));
    }

    assert.equal(db.state.transactions.length, 0);
  });

  it('POST /transactions/cash mendukung idempotency_key untuk mencegah double submit', async () => {
    const db = createInMemoryPool();
    const service = new TransactionService({ pool: db.pool, query: db.query });
    const app = createApp({ transactionService: service });

    const payload = {
      title: 'Jilid Spiral',
      transaction_type: 'pemasukan',
      amount: 20000,
      shift: 'siang',
      idempotency_key: 'idem-key-123',
    };

    const first = await request(app)
      .post('/transactions/cash')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(payload);
    assert.equal(first.status, 201);

    const second = await request(app)
      .post('/transactions/cash')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(payload);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.transaction.transaction_id, first.body.data.transaction.transaction_id);
    assert.equal(db.state.transactions.length, 1);
  });

  it('POST /transactions menolak QRIS/transfer tanpa bukti dan tanpa is_manual_input, tetapi mengizinkan dengan is_manual_input=true', async () => {
    const db = createInMemoryPool();
    const service = new TransactionService({ pool: db.pool, query: db.query });
    const app = createApp({ transactionService: service });

    const rejected = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'QRIS Tanpa Bukti',
        transaction_type: 'pemasukan',
        amount: 50000,
        shift: 'pagi',
        payment_method: 'qris',
      });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.error.code, 'VALIDATION_ERROR');

    const accepted = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'QRIS Manual',
        transaction_type: 'pemasukan',
        amount: 50000,
        shift: 'pagi',
        payment_method: 'qris',
        is_manual_input: true,
        external_trx_id: 'NMID-001',
      });
    assert.equal(accepted.status, 201);
    assert.equal(accepted.body.data.transaction.transaction_status, 'terkonfirmasi');
  });

  it('GET /transactions & GET /transactions/:id: karyawan hanya melihat miliknya, akses lintas user ditolak 403, owner melihat semua', async () => {
    const db = createInMemoryPool();
    const service = new TransactionService({ pool: db.pool, query: db.query });
    const app = createApp({ transactionService: service });

    // Buat transaksi oleh employee (id 2)
    const empCreate = await request(app)
      .post('/transactions/cash')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ title: 'Milik Employee 1', transaction_type: 'pemasukan', amount: 10000, shift: 'pagi' });
    const empTrxId = empCreate.body.data.transaction.transaction_id;

    // Buat transaksi oleh owner (id 1)
    await request(app)
      .post('/transactions/cash')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Milik Owner', transaction_type: 'pemasukan', amount: 30000, shift: 'siang' });

    // Employee list hanya 1 miliknya
    const empList = await request(app)
      .get('/transactions')
      .set('Authorization', `Bearer ${employeeToken}`);
    assert.equal(empList.status, 200);
    assert.equal(empList.body.data.transactions.length, 1);

    // Owner list melihat semua (2)
    const ownerList = await request(app)
      .get('/transactions')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(ownerList.status, 200);
    assert.equal(ownerList.body.data.transactions.length, 2);

    // Karyawan lain (id 3) akses transaksi milik id 2 -> 403
    const crossAccess = await request(app)
      .get(`/transactions/${empTrxId}`)
      .set('Authorization', `Bearer ${otherEmployeeToken}`);
    assert.equal(crossAccess.status, 403);
    assert.equal(crossAccess.body.error.code, 'FORBIDDEN');
  });

  it('PATCH & DELETE /transactions/:id: employee ditolak 403, owner berhasil dan mencatat audit log', async () => {
    const db = createInMemoryPool();
    const service = new TransactionService({ pool: db.pool, query: db.query });
    const app = createApp({ transactionService: service });

    const created = await request(app)
      .post('/transactions/cash')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ title: 'Untuk Diedit', transaction_type: 'pemasukan', amount: 12000, shift: 'pagi' });
    const trxId = created.body.data.transaction.transaction_id;

    // Employee PATCH -> 403
    const empPatch = await request(app)
      .patch(`/transactions/${trxId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ amount: 15000 });
    assert.equal(empPatch.status, 403);

    // Owner PATCH -> 200
    const ownerPatch = await request(app)
      .patch(`/transactions/${trxId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: 15000 });
    assert.equal(ownerPatch.status, 200);
    assert.equal(ownerPatch.body.data.transaction.amount, 15000);

    // Employee DELETE -> 403
    const empDelete = await request(app)
      .delete(`/transactions/${trxId}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    assert.equal(empDelete.status, 403);

    // Owner DELETE -> 200
    const ownerDelete = await request(app)
      .delete(`/transactions/${trxId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(ownerDelete.status, 200);
    assert.equal(db.state.auditLogs.map((l) => l.action).join(','), 'CREATE,UPDATE,DELETE');
  });
});
