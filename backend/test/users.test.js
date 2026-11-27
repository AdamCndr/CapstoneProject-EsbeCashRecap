import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/server.js';
import { pool } from '../src/core/database.js';

describe('Manajemen Akun (/users) & Login Employee yang Didaftarkan Owner', () => {
  after(async () => {
    await pool.query("DELETE FROM users WHERE username LIKE 'test_emp_%'");
    await pool.end();
  });

  it('Owner dapat mendaftarkan employee baru dan employee tersebut langsung bisa login', async () => {
    const app = createApp();
    const newUsername = `test_emp_${Date.now()}`;
    const newPassword = 'kasirBaru123';

    // 1. Login sebagai owner
    const ownerLoginRes = await request(app)
      .post('/auth/login')
      .send({ username: 'owner', password: 'owner123' });
    assert.equal(ownerLoginRes.status, 200);
    const ownerToken = ownerLoginRes.body.data.accessToken;

    // 2. Owner mendaftarkan employee baru lewat POST /users
    const createRes = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        username: newUsername,
        name: 'Rian Karyawan Baru',
        password: newPassword,
        role: 'Karyawan',
      });
    assert.equal(createRes.status, 201);
    const createdUser = createRes.body.data;
    assert.equal(typeof createdUser.id, 'number');
    assert.equal(createdUser.username, newUsername);
    assert.equal(createdUser.name, 'Rian Karyawan Baru');
    assert.equal(createdUser.role, 'employee');
    assert.equal(createdUser.password, undefined);

    // 3. Employee baru langsung bisa login via POST /auth/login
    const empLoginRes = await request(app)
      .post('/auth/login')
      .send({ username: newUsername, password: newPassword });
    assert.equal(empLoginRes.status, 200);
    assert.equal(empLoginRes.body.data.user.username, newUsername);
    assert.equal(empLoginRes.body.data.user.role, 'employee');
    const empToken = empLoginRes.body.data.accessToken;

    // 4. Employee baru bisa cek profil /auth/me dan ditolak mengakses GET /users (403)
    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${empToken}`);
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.user.username, newUsername);

    const forbiddenUsersRes = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${empToken}`);
    assert.equal(forbiddenUsersRes.status, 403);
    assert.equal(forbiddenUsersRes.body.error.code, 'FORBIDDEN');

    // 5. Pendaftaran username duplikat ditolak 400
    const dupRes = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        username: newUsername,
        name: 'Duplikat',
        password: 'password123',
        role: 'employee',
      });
    assert.equal(dupRes.status, 400);
    assert.equal(dupRes.body.error.code, 'USERNAME_ALREADY_EXISTS');

    // 6. Owner menghapus akun employee baru & verifikasi tidak bisa login lagi
    const deleteRes = await request(app)
      .delete(`/users/${createdUser.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(deleteRes.status, 200);

    const afterDeleteLogin = await request(app)
      .post('/auth/login')
      .send({ username: newUsername, password: newPassword });
    assert.equal(afterDeleteLogin.status, 401);
  });
});
