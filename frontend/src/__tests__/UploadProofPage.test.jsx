/**
 * Unit tests untuk UploadProofPage
 * - render komponen
 * - validasi: tanpa transaksi, tanpa file
 * - upload sukses: panggil extractTransactionProofRequest + onUpdateProof
 * - upload gagal: tampilkan error dari backend
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import UploadProofPage from '../pages/UploadProofPage.jsx';
import * as apiModule from '../services/api.js';

// Stub komponen UI berat
vi.mock('../components/ui/ColumnFilterSelect', () => ({
  default: ({ options, value, onChange }) => (
    <select
      data-testid="column-filter-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Pilih transaksi</option>
      {(options || []).map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  ),
}));

vi.mock('../components/ui/EmptyNote', () => ({
  default: ({ message }) => <p data-testid="empty-note">{message}</p>,
}));

vi.mock('../hooks/useMouseGlow', () => ({ useMouseGlow: () => ({ ref: { current: null }, style: {} }) }));
vi.mock('../hooks/useTiltSurface', () => ({ useTiltSurface: () => ({ ref: { current: null }, style: {} }) }));
vi.mock('../hooks/useSmoothResize', () => ({ useSmoothResize: () => {} }));

const MOCK_TRANSACTIONS = [
  { id: 'TRX-001', title: 'Makan siang', date: '2026-11-25', amount: 50000, type: 'pengeluaran', proof: null },
  { id: 'TRX-002', title: 'Pembayaran QRIS', date: '2026-11-25', amount: 150000, type: 'pemasukan', proof: null },
];

function renderUpload(overrides = {}) {
  const defaults = {
    transactions: MOCK_TRANSACTIONS,
    onUpdateProof: vi.fn(),
    onNavigateToHistory: vi.fn(),
    initialTransactionId: 'TRX-001',
  };
  return render(<UploadProofPage {...defaults} {...overrides} />);
}

// Helper: dapatkan form submit (UploadProofPage punya <form onSubmit={handleSaveProof}>)
function getForm() {
  return document.querySelector('form[class*="space-y"]') || document.querySelector('form');
}

describe('UploadProofPage: rendering', () => {
  it('menampilkan teks "Unggah bukti"', () => {
    renderUpload();
    expect(screen.getByText(/unggah bukti/i)).toBeInTheDocument();
  });

  it('menampilkan dropdown pilihan transaksi', () => {
    renderUpload();
    expect(screen.getByTestId('column-filter-select')).toBeInTheDocument();
  });

  it('menampilkan input file tersembunyi', () => {
    renderUpload();
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
  });
});

describe('UploadProofPage: validasi', () => {
  it('menampilkan error jika tidak ada file dipilih saat submit', async () => {
    renderUpload({ initialTransactionId: 'TRX-001' });
    const form = getForm();
    expect(form).not.toBeNull();
    fireEvent.submit(form);
    expect(await screen.findByText(/pilih file/i)).toBeInTheDocument();
  });
});

describe('UploadProofPage: upload berhasil', () => {
  let mockExtract;

  beforeEach(() => {
    mockExtract = vi.spyOn(apiModule, 'extractTransactionProofRequest');
    // FileReader stub — langsung panggil onloadend
    global.FileReader = class {
      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,/9j/fake';
        this.onloadend?.();
      }
    };
  });

  afterEach(() => vi.restoreAllMocks());

  it('memanggil extractTransactionProofRequest lalu onUpdateProof setelah file dipilih', async () => {
    mockExtract.mockResolvedValueOnce({ message: 'Ekstraksi berhasil', data: { is_mock: true } });
    const onUpdateProof = vi.fn();
    renderUpload({ initialTransactionId: 'TRX-001', onUpdateProof });

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['img'], 'bukti.jpg', { type: 'image/jpeg' });
    await userEvent.upload(fileInput, file);

    // Setelah FileReader.onloadend dipanggil, tombol submit muncul
    const form = getForm();
    fireEvent.submit(form);

    await waitFor(() => expect(mockExtract).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(onUpdateProof).toHaveBeenCalledWith('TRX-001', expect.any(String))
    );
    expect(await screen.findByText(/berhasil/i)).toBeInTheDocument();
  });
});

describe('UploadProofPage: error dari backend', () => {
  let mockExtract;

  beforeEach(() => {
    mockExtract = vi.spyOn(apiModule, 'extractTransactionProofRequest');
    global.FileReader = class {
      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,/9j/fake';
        this.onloadend?.();
      }
    };
  });

  afterEach(() => vi.restoreAllMocks());

  it('menampilkan pesan error dari backend saat gagal upload', async () => {
    mockExtract.mockRejectedValueOnce({
      response: { status: 413, data: { message: 'Ukuran file bukti melebihi batas maksimal 5 MB' } },
    });
    const onUpdateProof = vi.fn();
    renderUpload({ initialTransactionId: 'TRX-001', onUpdateProof });

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['img'], 'besar.jpg', { type: 'image/jpeg' });
    await userEvent.upload(fileInput, file);

    const form = getForm();
    fireEvent.submit(form);

    await waitFor(() => expect(mockExtract).toHaveBeenCalledTimes(1));
    expect(onUpdateProof).not.toHaveBeenCalled();
    expect(await screen.findByText(/melebihi batas/i)).toBeInTheDocument();
  });

  it('menampilkan pesan fallback jika tidak ada response (network error)', async () => {
    mockExtract.mockRejectedValueOnce(new Error('Network Error'));
    const onUpdateProof = vi.fn();
    renderUpload({ initialTransactionId: 'TRX-001', onUpdateProof });

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['img'], 'nota.jpg', { type: 'image/jpeg' });
    await userEvent.upload(fileInput, file);

    const form = getForm();
    fireEvent.submit(form);

    await waitFor(() => expect(mockExtract).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/gagal mengunggah/i)).toBeInTheDocument();
  });
});
