import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Jwt from '@hapi/jwt';
import config from '../src/core/config.js';
import { pool } from '../src/core/database.js';
import { createServer } from '../src/server.js';
import TokenManager from '../src/tokenize/TokenManager.js';

describe('Authentication & Authorization API', () => {
  after(async () => {
    await pool.end();
  });

  it('POST /auth/login berhasil untuk owner dan mengembalikan accessToken + user (id, username, role)', async () => {
    const server = await createServer();

    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        username: 'owner',
        password: 'owner123',
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.result;
    assert.equal(body.status, 'success');
    assert.ok(body.data.accessToken);
    assert.equal(typeof body.data.user.id, 'number');
    assert.equal(body.data.user.username, 'owner');
    assert.equal(body.data.user.role, 'owner');
    assert.equal(body.data.user.password, undefined);

    const decoded = TokenManager.verifyAccessToken(body.data.accessToken);
    assert.equal(decoded.id, body.data.user.id);
    assert.equal(decoded.username, 'owner');
    assert.equal(decoded.role, 'owner');
    assert.equal(decoded.exp - decoded.iat, config.jwt.expireMinutes * 60);
  });

  it('POST /auth/login mengembalikan 400 dengan pesan Joi jelas saat username/password kosong', async () => {
    const server = await createServer();

    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        username: '',
        password: '',
      },
    });

    assert.equal(response.statusCode, 400);
    const body = response.result;
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.match(body.error.message, /Username tidak boleh kosong/);
    assert.match(body.error.message, /Password tidak boleh kosong/);
    assert.ok(Array.isArray(body.error.details.fields));
    assert.equal(body.error.details.fields.length, 2);
  });

  it('POST /auth/login mengembalikan 401 dengan pesan generik saat username atau password salah', async () => {
    const server = await createServer();

    const wrongUserRes = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        username: 'tidak_ada',
        password: 'owner123',
      },
    });

    const wrongPassRes = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        username: 'owner',
        password: 'salah_password',
      },
    });

    assert.equal(wrongUserRes.statusCode, 401);
    assert.equal(wrongPassRes.statusCode, 401);
    assert.deepEqual(wrongUserRes.result, wrongPassRes.result);
    assert.equal(wrongUserRes.result.error.code, 'INVALID_CREDENTIALS');
    assert.equal(wrongUserRes.result.error.message, 'Username atau password salah');
  });

  it('POST /auth/login mengembalikan 403 saat akun berstatus non-aktif', async () => {
    const server = await createServer();

    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        username: 'nonaktif',
        password: 'nonaktif123',
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.result.error.code, 'ACCOUNT_INACTIVE');
    assert.match(response.result.error.message, /non-aktif/i);
  });

  it('GET /auth/me mengembalikan data user dari token valid dan 401 jika tanpa/salah token', async () => {
    const server = await createServer();

    const noTokenRes = await server.inject({
      method: 'GET',
      url: '/auth/me',
    });
    assert.equal(noTokenRes.statusCode, 401);
    assert.equal(noTokenRes.result.error.code, 'UNAUTHORIZED');
    assert.ok('details' in noTokenRes.result.error);

    const expiredToken = Jwt.token.generate(
      { id: 1, username: 'owner', role: 'owner', exp: Math.floor(Date.now() / 1000) - 10 },
      config.jwt.secret,
    );
    const expiredRes = await server.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    });
    assert.equal(expiredRes.statusCode, 401);

    const loginRes = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'employee', password: 'employee123' },
    });
    const { accessToken, user } = loginRes.result.data;

    const meRes = await server.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    assert.equal(meRes.statusCode, 200);
    assert.deepEqual(meRes.result.data.user, user);
  });

  it('requireRole("owner") mengizinkan owner (200) dan menolak employee (403)', async () => {
    const server = await createServer();

    const ownerLogin = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'owner', password: 'owner123' },
    });
    const employeeLogin = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'employee', password: 'employee123' },
    });

    const ownerAccess = await server.inject({
      method: 'GET',
      url: '/auth/owner-only',
      headers: { authorization: `Bearer ${ownerLogin.result.data.accessToken}` },
    });
    assert.equal(ownerAccess.statusCode, 200);
    assert.equal(ownerAccess.result.data.user.role, 'owner');

    const employeeAccess = await server.inject({
      method: 'GET',
      url: '/auth/owner-only',
      headers: { authorization: `Bearer ${employeeLogin.result.data.accessToken}` },
    });
    assert.equal(employeeAccess.statusCode, 403);
    assert.equal(employeeAccess.result.error.code, 'FORBIDDEN');
    assert.deepEqual(employeeAccess.result.error.details, {
      requiredRoles: ['owner'],
      currentRole: 'employee',
    });
  });

  it('Rate limit POST /auth/login mengembalikan 429 ketika batas percobaan terlampaui', async () => {
    const server = await createServer({
      rateLimiterOptions: { windowMs: 60000, maxAttempts: 2 },
    });

    const req = {
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'owner', password: 'salah' },
      headers: { 'x-forwarded-for': '203.0.113.10' },
    };

    const res1 = await server.inject(req);
    const res2 = await server.inject(req);
    const res3 = await server.inject(req);

    assert.equal(res1.statusCode, 401);
    assert.equal(res2.statusCode, 401);
    assert.equal(res3.statusCode, 429);
    assert.equal(res3.result.error.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(res3.result.error.details.retryAfterSeconds >= 1);
  });

  it('CORS membatasi origin sesuai CORS_ORIGINS', async () => {
    const server = await createServer({
      corsOrigins: ['http://localhost:5173'],
    });

    const allowedRes = await server.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:5173' },
    });
    assert.equal(allowedRes.headers['access-control-allow-origin'], 'http://localhost:5173');

    const blockedRes = await server.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example.com' },
    });
    assert.equal(blockedRes.headers['access-control-allow-origin'], undefined);
  });
});
