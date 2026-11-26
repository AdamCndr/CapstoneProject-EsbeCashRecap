/**
 * Unit tests for src/services/api.js
 * - axios interceptor menyisipkan token dari localStorage
 * - loginRequest => POST /auth/login
 * - getMeRequest => GET /auth/me
 * - extractTransactionProofRequest => POST /transactions/extract
 * - getStoredToken / setStoredToken
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';
import api, {
  loginRequest,
  getMeRequest,
  checkOwnerOnlyRequest,
  extractTransactionProofRequest,
  getStoredToken,
  setStoredToken,
  TOKEN_STORAGE_KEY,
} from '../services/api.js';

const mock = new AxiosMockAdapter(api);

// ── localStorage stub ───────────────────────────────────────────────────────
let store = {};
beforeEach(() => {
  store = {};
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k) => store[k] ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => { store[k] = v; });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((k) => { delete store[k]; });
});
afterEach(() => {
  mock.reset();
  vi.restoreAllMocks();
});

// ── Token helpers ───────────────────────────────────────────────────────────
describe('getStoredToken / setStoredToken', () => {
  it('mengembalikan null saat storage kosong', () => {
    expect(getStoredToken()).toBeNull();
  });

  it('menyimpan dan membaca token', () => {
    setStoredToken('tok123');
    expect(getStoredToken()).toBe('tok123');
    expect(store[TOKEN_STORAGE_KEY]).toBe('tok123');
  });

  it('menghapus token saat dipanggil dengan null', () => {
    store[TOKEN_STORAGE_KEY] = 'old';
    setStoredToken(null);
    expect(getStoredToken()).toBeNull();
  });
});

// ── axios interceptor ───────────────────────────────────────────────────────
describe('Request interceptor: Authorization header', () => {
  it('menambahkan header Authorization jika token tersedia', async () => {
    store[TOKEN_STORAGE_KEY] = 'Bearer-test-token';
    mock.onGet('/auth/me').reply((config) => {
      return [200, { status: 'success', data: { user: { id: 1, username: 'adam', role: 'owner' } } }];
    });

    await getMeRequest();

    const req = mock.history.get[0];
    expect(req.headers.Authorization).toBe('Bearer Bearer-test-token');
  });

  it('tidak menambahkan header Authorization jika token kosong', async () => {
    mock.onGet('/auth/me').reply((config) => {
      return [200, { status: 'success', data: { user: { id: 1, username: 'adam', role: 'owner' } } }];
    });

    await getMeRequest();

    const req = mock.history.get[0];
    expect(req.headers?.Authorization).toBeUndefined();
  });
});

// ── loginRequest ────────────────────────────────────────────────────────────
describe('loginRequest', () => {
  it('mengirim POST /auth/login dengan username dan password', async () => {
    mock.onPost('/auth/login').reply(200, {
      status: 'success',
      message: 'Login berhasil',
      data: { accessToken: 'jwt-token', user: { id: 1, username: 'adam', role: 'owner' } },
    });

    const res = await loginRequest('adam', 'secret');
    expect(res.data.accessToken).toBe('jwt-token');
    expect(res.data.user.role).toBe('owner');

    const req = mock.history.post[0];
    const body = JSON.parse(req.data);
    expect(body.username).toBe('adam');
    expect(body.password).toBe('secret');
  });

  it('melempar error jika backend mengembalikan 401', async () => {
    mock.onPost('/auth/login').reply(401, { message: 'Kredensial tidak valid' });

    await expect(loginRequest('adam', 'wrong')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });
});

// ── getMeRequest ────────────────────────────────────────────────────────────
describe('getMeRequest', () => {
  it('mengirim GET /auth/me', async () => {
    mock.onGet('/auth/me').reply(200, {
      status: 'success',
      data: { user: { id: 1, username: 'adam', role: 'owner' } },
    });

    const res = await getMeRequest();
    expect(res.data.user.username).toBe('adam');
  });
});

// ── checkOwnerOnlyRequest ───────────────────────────────────────────────────
describe('checkOwnerOnlyRequest', () => {
  it('mengirim GET /auth/owner-only', async () => {
    mock.onGet('/auth/owner-only').reply(200, {
      status: 'success',
      message: 'Akses owner terverifikasi',
      data: { user: { id: 1, username: 'adam', role: 'owner' } },
    });

    const res = await checkOwnerOnlyRequest();
    expect(res.message).toBe('Akses owner terverifikasi');
  });

  it('melempar 403 jika role bukan owner', async () => {
    mock.onGet('/auth/owner-only').reply(403, { message: 'Forbidden' });

    await expect(checkOwnerOnlyRequest()).rejects.toMatchObject({
      response: { status: 403 },
    });
  });
});

// ── extractTransactionProofRequest ─────────────────────────────────────────
describe('extractTransactionProofRequest', () => {
  it('mengirim POST /transactions/extract sebagai multipart/form-data', async () => {
    mock.onPost('/transactions/extract').reply(200, {
      status: 'success',
      message: 'Ekstraksi berhasil',
      data: { is_mock: true },
    });

    const fakeFile = new File(['pixel'], 'bukti.jpg', { type: 'image/jpeg' });
    const res = await extractTransactionProofRequest(fakeFile, { shift: 'pagi', paymentMethod: 'qris' });

    expect(res.message).toBe('Ekstraksi berhasil');
    expect(res.data.is_mock).toBe(true);

    const req = mock.history.post[0];
    // header content-type harus multipart
    expect(req.headers['Content-Type']).toContain('multipart/form-data');
  });

  it('meneruskan shift dan paymentMethod ke FormData', async () => {
    mock.onPost('/transactions/extract').reply(200, { status: 'success', data: {} });

    const fakeFile = new File(['img'], 'nota.png', { type: 'image/png' });
    await extractTransactionProofRequest(fakeFile, { shift: 'siang', paymentMethod: 'transfer' });

    // Axios mock menyimpan FormData di req.data, verifikasi file field ada
    const req = mock.history.post[0];
    expect(req.data).toBeInstanceOf(FormData);
    expect(req.data.get('shift')).toBe('siang');
    expect(req.data.get('payment_method')).toBe('transfer');
    expect(req.data.get('file')).toBeTruthy();
  });
});

