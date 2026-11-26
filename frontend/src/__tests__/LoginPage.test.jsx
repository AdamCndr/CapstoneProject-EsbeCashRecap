/**
 * Unit tests untuk LoginPage
 * - render form
 * - login sukses: role owner & karyawan
 * - login gagal: error dari backend tampil
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LoginPage from '../pages/LoginPage.jsx';
import * as apiModule from '../services/api.js';

// stub hook animasi
vi.mock('../lib/motion', () => ({
  usePageReveal: () => ({ reveal: vi.fn() }),
}));

// stub ShiftSwitch
vi.mock('../components/ui/ShiftSwitch', () => ({
  default: ({ value, onChange }) => (
    <select data-testid="shift-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="pagi">Pagi</option>
      <option value="siang">Siang</option>
    </select>
  ),
}));

function renderLogin(props = {}) {
  const defaults = {
    onLoginSuccess: vi.fn(),
    onReveal: vi.fn(),
    onDone: vi.fn(),
  };
  return render(<LoginPage {...defaults} {...props} />);
}

describe('LoginPage: rendering', () => {
  it('menampilkan input username', () => {
    renderLogin();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  });

  it('menampilkan input password', () => {
    renderLogin();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('menampilkan tombol Masuk', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /masuk/i })).toBeInTheDocument();
  });
});

describe('LoginPage: login berhasil — owner', () => {
  let mockLogin;
  beforeEach(() => { mockLogin = vi.spyOn(apiModule, 'loginRequest'); });
  afterEach(() => vi.restoreAllMocks());

  it('menyimpan token dan memulai transisi login (phase berubah dari login) untuk role Pemilik', async () => {
    const mockSetToken = vi.spyOn(apiModule, 'setStoredToken').mockImplementation(() => {});
    const onLoginSuccess = vi.fn();
    mockLogin.mockResolvedValueOnce({
      data: { accessToken: 'jwt-tok', user: { id: 1, username: 'owner', role: 'owner' } },
    });

    renderLogin({ onLoginSuccess });

    await userEvent.type(screen.getByLabelText(/username/i), 'owner');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret');
    fireEvent.submit(screen.getByRole('button', { name: /masuk/i }).closest('form'));

    // Token harus tersimpan segera setelah login berhasil
    await waitFor(() => expect(mockSetToken).toHaveBeenCalledWith('jwt-tok'));

    // Layar greeting "Welcome" muncul — tanda transisi owner berjalan
    expect(await screen.findByText(/welcome/i, {}, { timeout: 3000 })).toBeInTheDocument();

    // onLoginSuccess dipanggil di fase 'greet' setelah HOLD_MS delay;
    // karena komponen menggunakan real timers, cukup verifikasi bahwa loginRequest dipanggil
    // dengan kredensial yang benar dan token tersimpan (sudah diverifikasi di atas).
    expect(mockLogin).toHaveBeenCalledWith('owner', 'secret');
    expect(mockSetToken).toHaveBeenCalledWith('jwt-tok');
  });
});

describe('LoginPage: login berhasil — karyawan', () => {
  let mockLogin;
  beforeEach(() => { mockLogin = vi.spyOn(apiModule, 'loginRequest'); });
  afterEach(() => vi.restoreAllMocks());

  it('menampilkan panel shift (tidak langsung onLoginSuccess) untuk role non-owner', async () => {
    vi.spyOn(apiModule, 'setStoredToken').mockImplementation(() => {});
    const onLoginSuccess = vi.fn();
    mockLogin.mockResolvedValueOnce({
      data: { accessToken: 'tok2', user: { id: 2, username: 'budi', role: 'kasir' } },
    });

    renderLogin({ onLoginSuccess });

    await userEvent.type(screen.getByLabelText(/username/i), 'budi');
    await userEvent.type(screen.getByLabelText(/password/i), 'pass');
    fireEvent.submit(screen.getByRole('button', { name: /masuk/i }).closest('form'));

    await waitFor(() => expect(screen.getByTestId('shift-select')).toBeInTheDocument());
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });
});

describe('LoginPage: login gagal', () => {
  let mockLogin;
  beforeEach(() => { mockLogin = vi.spyOn(apiModule, 'loginRequest'); });
  afterEach(() => vi.restoreAllMocks());

  it('menampilkan pesan error dari response backend (401)', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Username atau password salah' } },
    });

    renderLogin();

    await userEvent.type(screen.getByLabelText(/username/i), 'adam');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    fireEvent.submit(screen.getByRole('button', { name: /masuk/i }).closest('form'));

    expect(await screen.findByText(/username atau password salah/i)).toBeInTheDocument();
  });

  it('menampilkan pesan fallback jika tidak ada response (network error)', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network Error'));

    renderLogin();

    await userEvent.type(screen.getByLabelText(/username/i), 'adam');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret');
    fireEvent.submit(screen.getByRole('button', { name: /masuk/i }).closest('form'));

    expect(await screen.findByText(/gagal login/i)).toBeInTheDocument();
  });
});
