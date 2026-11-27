import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import config from '../src/core/config.js';
import { pool } from '../src/core/database.js';
import { createApp } from '../src/server.js';
import TokenManager from '../src/tokenize/TokenManager.js';

describe('Authentication & Authorization API', () => {
  after(async () => {
    await pool.end();
  });

  it('POST /auth/login berhasil untuk owner dan mengembalikan accessToken + user (id, username, role)', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/auth/login')
      .send({
        username: 'owner',
        password: 'owner123',
      });

    assert.equal(response.status, 200);
    const { body } = response;
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
    const app = createApp();

    const response = await request(app)
      .post('/auth/login')
      .send({
        username: '',
        password: '',
      });

    assert.equal(response.status, 400);
    const { body } = response;
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.match(body.error.message, /Username tidak boleh kosong/);
    assert.match(body.error.message, /Password tidak boleh kosong/);
    assert.ok(Array.isArray(body.error.details.fields));
    assert.equal(body.error.details.fields.length, 2);
  });

  it('POST /auth/login mengembalikan 401 dengan pesan generik saat username atau password salah', async () => {
    const app = createApp();

    const wrongUserRes = await request(app)
      .post('/auth/login')
      .send({
        username: 'tidak_ada',
        password: 'owner123',
      });

    const wrongPassRes = await request(app)
      .post('/auth/login')
      .send({
        username: 'owner',
        password: 'salah_password',
      });

    assert.equal(wrongUserRes.status, 401);
    assert.equal(wrongPassRes.status, 401);
    assert.deepEqual(wrongUserRes.body, wrongPassRes.body);
    assert.equal(wrongUserRes.body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(wrongUserRes.body.error.message, 'Username atau password salah');
  });

  it('POST /auth/login mengembalikan 403 saat akun berstatus non-aktif', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/auth/login')
      .send({
        username: 'nonaktif',
        password: 'nonaktif123',
      });

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'ACCOUNT_INACTIVE');
    assert.match(response.body.error.message, /non-aktif/i);
  });

  it('GET /auth/me mengembalikan data user dari token valid dan 401 jika tanpa/salah token', async () => {
    const app = createApp();

    const noTokenRes = await request(app).get('/auth/me');
    assert.equal(noTokenRes.status, 401);
    assert.equal(noTokenRes.body.error.code, 'UNAUTHORIZED');
    assert.ok('details' in noTokenRes.body.error);

    const expiredToken = jwt.sign(
      { id: 1, username: 'owner', role: 'owner', exp: Math.floor(Date.now() / 1000) - 10 },
      config.jwt.secret,
    );
    const expiredRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    assert.equal(expiredRes.status, 401);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ username: 'employee', password: 'employee123' });
    const { accessToken, user } = loginRes.body.data;

    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(meRes.status, 200);
    assert.deepEqual(meRes.body.data.user, user);
  });

  it('requireRole("owner") mengizinkan owner (200) dan menolak employee (403)', async () => {
    const app = createApp();

    const ownerLogin = await request(app)
      .post('/auth/login')
      .send({ username: 'owner', password: 'owner123' });
    const employeeLogin = await request(app)
      .post('/auth/login')
      .send({ username: 'employee', password: 'employee123' });

    const ownerAccess = await request(app)
      .get('/auth/owner-only')
      .set('Authorization', `Bearer ${ownerLogin.body.data.accessToken}`);
    assert.equal(ownerAccess.status, 200);
    assert.equal(ownerAccess.body.data.user.role, 'owner');

    const employeeAccess = await request(app)
      .get('/auth/owner-only')
      .set('Authorization', `Bearer ${employeeLogin.body.data.accessToken}`);
    assert.equal(employeeAccess.status, 403);
    assert.equal(employeeAccess.body.error.code, 'FORBIDDEN');
    assert.deepEqual(employeeAccess.body.error.details, {
      requiredRoles: ['owner'],
      currentRole: 'employee',
    });
  });

  it('Rate limit POST /auth/login mengembalikan 429 ketika batas percobaan terlampaui', async () => {
    const app = createApp({
      rateLimiterOptions: { windowMs: 60000, maxAttempts: 2 },
    });

    const sendAttempt = () =>
      request(app)
        .post('/auth/login')
        .set('x-forwarded-for', '203.0.113.10')
        .send({ username: 'owner', password: 'salah' });

    const res1 = await sendAttempt();
    const res2 = await sendAttempt();
    const res3 = await sendAttempt();

    assert.equal(res1.status, 401);
    assert.equal(res2.status, 401);
    assert.equal(res3.status, 429);
    assert.equal(res3.body.error.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(res3.body.error.details.retryAfterSeconds >= 1);
  });

  it('CORS membatasi origin sesuai CORS_ORIGINS', async () => {
    const app = createApp({
      corsOrigins: ['http://localhost:5173'],
    });

    const allowedRes = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');
    assert.equal(allowedRes.headers['access-control-allow-origin'], 'http://localhost:5173');

    const blockedRes = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example.com');
    assert.equal(blockedRes.headers['access-control-allow-origin'], undefined);
  });
});
