import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { pool } from '../src/core/database.js';

describe('Manajemen Akun (/users) & Login Employee yang Didaftarkan Owner', () => {
  after(async () => {
    await pool.query("DELETE FROM users WHERE username LIKE 'test_emp_%'");
    await pool.end();
  });

  it('Owner dapat mendaftarkan employee baru dan employee tersebut langsung bisa login', async () => {
    const server = await createServer();
    const newUsername = `test_emp_${Date.now()}`;
    const newPassword = 'kasirBaru123';

    // 1. Login sebagai owner
    const ownerLoginRes = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'owner', password: 'owner123' },
    });
    assert.equal(ownerLoginRes.statusCode, 200);
    const ownerToken = ownerLoginRes.result.data.accessToken;

    // 2. Owner mendaftarkan employee baru lewat POST /users
    const createRes = await server.inject({
      method: 'POST',
      url: '/users',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        username: newUsername,
        name: 'Rian Karyawan Baru',
        password: newPassword,
        role: 'Karyawan',
      },
    });
    assert.equal(createRes.statusCode, 201);
    const createdUser = createRes.result.data;
    assert.equal(typeof createdUser.id, 'number');
    assert.equal(createdUser.username, newUsername);
    assert.equal(createdUser.name, 'Rian Karyawan Baru');
    assert.equal(createdUser.role, 'employee');
    assert.equal(createdUser.password, undefined);

    // 3. Employee baru langsung bisa login via POST /auth/login
    const empLoginRes = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: newUsername, password: newPassword },
    });
    assert.equal(empLoginRes.statusCode, 200);
    assert.equal(empLoginRes.result.data.user.username, newUsername);
    assert.equal(empLoginRes.result.data.user.role, 'employee');
    const empToken = empLoginRes.result.data.accessToken;

    // 4. Employee baru bisa cek profil /auth/me dan ditolak mengakses GET /users (403)
    const meRes = await server.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${empToken}` },
    });
    assert.equal(meRes.statusCode, 200);
    assert.equal(meRes.result.data.user.username, newUsername);

    const forbiddenUsersRes = await server.inject({
      method: 'GET',
      url: '/users',
      headers: { authorization: `Bearer ${empToken}` },
    });
    assert.equal(forbiddenUsersRes.statusCode, 403);
    assert.equal(forbiddenUsersRes.result.error.code, 'FORBIDDEN');

    // 5. Pendaftaran username duplikat ditolak 400
    const dupRes = await server.inject({
      method: 'POST',
      url: '/users',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        username: newUsername,
        name: 'Duplikat',
        password: 'password123',
        role: 'employee',
      },
    });
    assert.equal(dupRes.statusCode, 400);
    assert.equal(dupRes.result.error.code, 'USERNAME_ALREADY_EXISTS');

    // 6. Owner menghapus akun employee baru & verifikasi tidak bisa login lagi
    const deleteRes = await server.inject({
      method: 'DELETE',
      url: `/users/${createdUser.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(deleteRes.statusCode, 200);

    const afterDeleteLogin = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: newUsername, password: newPassword },
    });
    assert.equal(afterDeleteLogin.statusCode, 401);
  });
});
