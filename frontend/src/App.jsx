import { useState } from 'react';
import { History, LayoutDashboard, LogOut, Paperclip, PenLine, ScanText } from 'lucide-react';
import { INITIAL_MOCK_TRANSACTIONS, formatRupiah } from './data/mockData';
import { btnGhost, card, ico, motion, Notice } from './lib/ui';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransactionFormPage from './pages/TransactionFormPage';
import OcrConfirmationPage from './pages/OcrConfirmationPage';
import UploadProofPage from './pages/UploadProofPage';
import HistoryPage from './pages/HistoryPage';

const KEY_USER = 'esbe_mock_user';
const KEY_TRX = 'esbe_mock_transactions';

// localStorage bisa kosong, rusak, atau penuh (bukti disimpan sebagai base64)
const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

// ID berikutnya = angka terbesar + 1. Memakai panjang list menghasilkan ID kembar setelah ada yang dihapus
const nextId = (list) => {
  const max = list.reduce((m, t) => {
    const n = parseInt(String(t.id).replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `TRX-${String(max + 1).padStart(3, '0')}`;
};

const NAV = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { key: 'form', label: 'Catat pendapatan', Icon: PenLine },
  { key: 'ocr', label: 'Konfirmasi OCR', Icon: ScanText },
  { key: 'upload', label: 'Unggah bukti', Icon: Paperclip },
  { key: 'history', label: 'Riwayat', Icon: History }
];

// Formulir tidak dibiarkan melebar selebar tabel
const PAGE_WIDTH = {
  dashboard: '',
  history: '',
  form: 'max-w-3xl',
  upload: 'max-w-3xl',
  ocr: 'max-w-5xl'
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => readJSON(KEY_USER, null));
  const [currentPage, setCurrentPage] = useState('dashboard'); // 'dashboard' | 'form' | 'ocr' | 'upload' | 'history'
  const [transactions, setTransactions] = useState(() => readJSON(KEY_TRX, INITIAL_MOCK_TRANSACTIONS));
  const [storageFull, setStorageFull] = useState(false);

  const persist = (updated) => {
    setTransactions(updated);
    setStorageFull(!writeJSON(KEY_TRX, updated));
  };

  const handleLoginSuccess = (userData) => {
    writeJSON(KEY_USER, userData);
    setCurrentUser(userData);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem(KEY_USER);
    setCurrentUser(null);
  };

  const handleSaveTransaction = (newTrxData) => {
    persist([{ id: nextId(transactions), ...newTrxData }, ...transactions]);
  };

  const handleUpdateProof = (trxId, proofUrl) => {
    persist(transactions.map((t) => (t.id === trxId ? { ...t, proofUrl } : t)));
  };

  // Konfirmasi hapus dan reset sudah ditangani HistoryPage, jangan dobel dengan confirm()
  const handleDeleteTransaction = (id) => {
    persist(transactions.filter((t) => t.id !== id));
  };

  const handleResetMockData = () => {
    persist(INITIAL_MOCK_TRANSACTIONS);
  };

  // Ringkasan kas keseluruhan
  const pemasukan = transactions.filter((t) => t.type === 'pemasukan');
  const pengeluaran = transactions.filter((t) => t.type === 'pengeluaran');
  const sum = (list) => list.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const totalPemasukan = sum(pemasukan);
  const totalPengeluaran = sum(pengeluaran);
  const saldoKas = totalPemasukan - totalPengeluaran;

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 font-sans text-neutral-900">
      <header className="sticky top-0 z-20 border-b border-neutral-900/10 bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-6 sm:px-8">
          <div>
            <h1 className="text-lg leading-6 font-medium">Esbe Cash Recap</h1>
            <p className="text-xs leading-4 text-neutral-500">Fotocopy Esbe Lampu Merah</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-[13px] leading-5 text-neutral-600 sm:inline">
              {currentUser.name} · {currentUser.role}
            </span>
            <button type="button" onClick={handleLogout} className={btnGhost}>
              <LogOut {...ico} />
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-6 py-6 sm:px-8">
        {storageFull && (
          <Notice kind="warning">
            Penyimpanan browser penuh, perubahan terakhir tidak tersimpan permanen. Hapus transaksi dengan bukti
            foto yang tidak diperlukan
          </Notice>
        )}

        {/* Ringkasan kas keseluruhan */}
        <section aria-label="Ringkasan kas keseluruhan" className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div className={`${card} p-5`}>
            <p className="text-[13px] leading-5 text-neutral-600">Saldo kas</p>
            <p
              className={`mt-2 text-[28px] leading-8 font-medium tabular-nums ${saldoKas >= 0 ? 'text-neutral-900' : 'text-red-600'
                }`}
            >
              {formatRupiah(saldoKas)}
            </p>
            <p className="mt-1 text-xs leading-4 text-neutral-500">Semua tanggal dan shift</p>
          </div>

          <div className={`${card} p-5`}>
            <p className="text-[13px] leading-5 text-neutral-600">Total pemasukan</p>
            <p className="mt-2 text-[28px] leading-8 font-medium tabular-nums text-neutral-900">
              {formatRupiah(totalPemasukan)}
            </p>
            <p className="mt-1 text-xs leading-4 text-neutral-500">{pemasukan.length} transaksi</p>
          </div>

          <div className={`${card} p-5`}>
            <p className="text-[13px] leading-5 text-neutral-600">Total pengeluaran</p>
            <p className="mt-2 text-[28px] leading-8 font-medium tabular-nums text-red-600">
              {formatRupiah(totalPengeluaran)}
            </p>
            <p className="mt-1 text-xs leading-4 text-neutral-500">{pengeluaran.length} transaksi</p>
          </div>
        </section>

        {/* Navigasi halaman */}
        <nav aria-label="Halaman utama" className="flex gap-2 overflow-x-auto border-b border-neutral-900/10">
          {NAV.map(({ key, label, Icon }) => {
            const active = currentPage === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCurrentPage(key)}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px inline-flex h-10 cursor-pointer items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-800 ${motion} ${active
                    ? 'border-blue-800 text-neutral-900'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900'
                  }`}
              >
                <Icon {...ico} />
                {label}
                {key === 'history' && (
                  <span className="font-mono text-xs font-normal tabular-nums text-neutral-500">
                    {transactions.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className={PAGE_WIDTH[currentPage]}>
          {currentPage === 'dashboard' && <DashboardPage transactions={transactions} />}

          {currentPage === 'form' && (
            <TransactionFormPage
              onSaveTransaction={handleSaveTransaction}
              onNavigateToHistory={() => setCurrentPage('history')}
              onNavigateToOcr={() => setCurrentPage('ocr')}
            />
          )}

          {currentPage === 'ocr' && (
            <OcrConfirmationPage
              onConfirmTransaction={(data) => {
                handleSaveTransaction(data);
                setCurrentPage('history');
              }}
              onCancel={() => setCurrentPage('form')}
            />
          )}

          {currentPage === 'upload' && (
            <UploadProofPage
              transactions={transactions}
              onUpdateProof={handleUpdateProof}
              onNavigateToHistory={() => setCurrentPage('history')}
            />
          )}

          {currentPage === 'history' && (
            <HistoryPage
              transactions={transactions}
              onDeleteTransaction={handleDeleteTransaction}
              onResetMockData={handleResetMockData}
              onNavigateToForm={() => setCurrentPage('form')}
            />
          )}
        </div>
      </main>
    </div>
  );
}
