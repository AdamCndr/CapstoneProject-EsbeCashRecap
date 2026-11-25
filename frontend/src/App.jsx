import { useState, useMemo, useEffect, useCallback } from 'react';
import './App.css';
import './components/Scrollbar.css';
import { INITIAL_MOCK_TRANSACTIONS } from './data/mockData';
import Header from './components/Header';
import Navbar from './components/Navbar';
import Scrollbar from './components/Scrollbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransactionFormPage from './pages/TransactionFormPage';
import OcrConfirmationPage from './pages/OcrConfirmationPage';
import UploadProofPage from './pages/UploadProofPage';
import HistoryPage from './pages/HistoryPage';
import UserManagementPage from './pages/UserManagementPage';
import { btnPrimary, card } from './lib/ui';

export default function App() {
  // 1. Autentikasi Pengguna (Tersimpan di localStorage agar tidak kembali ke login saat reload)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('esbe_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // 2. Navigasi Halaman Aktif ('dashboard' | 'form' | 'ocr' | 'upload' | 'history')
  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const savedPage = localStorage.getItem('esbe_current_page');
      if (savedPage) return savedPage;
      const savedUser = localStorage.getItem('esbe_current_user');
      const user = savedUser ? JSON.parse(savedUser) : null;
      return user?.role === 'Pemilik' ? 'dashboard' : 'form';
    } catch {
      return 'form';
    }
  });

  // Simpan session pengguna ke localStorage
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('esbe_current_user', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('esbe_current_user');
      }
    } catch {
      /* abaikan jika storage non-aktif */
    }
  }, [currentUser]);

  // Simpan halaman aktif terakhir ke localStorage
  useEffect(() => {
    try {
      localStorage.setItem('esbe_current_page', currentPage);
    } catch {
      /* abaikan */
    }
  }, [currentPage]);

  // 3. Overlay login+sambutan tetap tampil selama transisi (hanya sesi baru, bukan reload)
  const [showAuth, setShowAuth] = useState(false);
  const [appRevealed, setAppRevealed] = useState(true);

  // 4. State Pencarian Global & Tanggal Aktif Dashboard
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('2026-11-20');

  const handleAuthReveal = useCallback(() => setAppRevealed(true), []);
  const handleAuthDone = useCallback(() => setShowAuth(false), []);

  // 5. State Data Transaksi (Tersimpan di localStorage frontend)
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('esbe_mock_transactions');
    return saved ? JSON.parse(saved) : INITIAL_MOCK_TRANSACTIONS;
  });

  // Handler Login: Karyawan diarahkan langsung ke form, Pemilik ke dashboard
  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    const targetPage = userData.role === 'Pemilik' ? 'dashboard' : 'form';
    setCurrentPage(targetPage);
    // Aplikasi menunggu di belakang overlay sampai cross-fade
    setAppRevealed(false);
    setShowAuth(true);
    try {
      localStorage.setItem('esbe_current_user', JSON.stringify(userData));
      localStorage.setItem('esbe_current_page', targetPage);
    } catch {
      /* abaikan */
    }
  };

  // Handler Logout
  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentPage('form');
    setSearchQuery('');
    try {
      localStorage.removeItem('esbe_current_user');
      localStorage.removeItem('esbe_current_page');
    } catch {
      /* abaikan */
    }
  };

  // Handler Simpan Transaksi Baru
  const handleSaveTransaction = (newTrxData) => {
    const newTrx = {
      id: `TRX-${String(transactions.length + 1).padStart(3, '0')}`,
      shift: currentUser?.shift || newTrxData.shift || 'pagi',
      ...newTrxData
    };
    const updated = [newTrx, ...transactions];
    setTransactions(updated);
    localStorage.setItem('esbe_mock_transactions', JSON.stringify(updated));
  };

  // Handler Update / Lampirkan Bukti
  const handleUpdateProof = (trxId, proofUrl) => {
    const updated = transactions.map((t) =>
      t.id === trxId ? { ...t, proofUrl } : t
    );
    setTransactions(updated);
    localStorage.setItem('esbe_mock_transactions', JSON.stringify(updated));
  };

  // Handler Hapus Transaksi (Hanya Pemilik)
  const handleDeleteTransaction = (id) => {
    if (confirm('Yakin ingin menghapus transaksi ini dari riwayat?')) {
      const updated = transactions.filter((t) => t.id !== id);
      setTransactions(updated);
      localStorage.setItem('esbe_mock_transactions', JSON.stringify(updated));
    }
  };

  // Handler Reset Data Contoh (Hanya Pemilik)
  const handleResetMockData = () => {
    if (confirm('Kembalikan data ke riwayat contoh awal?')) {
      setTransactions(INITIAL_MOCK_TRANSACTIONS);
      localStorage.setItem('esbe_mock_transactions', JSON.stringify(INITIAL_MOCK_TRANSACTIONS));
    }
  };

  // Kalkulasi statistik kas untuk sayap Header Owner (selaras dengan tanggal aktif Dashboard)
  const ownerStats = useMemo(() => {
    const today = new Date().toLocaleDateString('sv-SE');
    const activeList = selectedDate
      ? transactions.filter((t) => t.date === selectedDate)
      : transactions;
    const masuk = activeList.filter((t) => t.type === 'pemasukan').reduce((s, x) => s + Number(x.amount || 0), 0);
    const keluar = activeList.filter((t) => t.type === 'pengeluaran').reduce((s, x) => s + Number(x.amount || 0), 0);
    let dateLabel = 'hari ini';
    if (!selectedDate) {
      dateLabel = 'semua tanggal';
    } else if (selectedDate !== today) {
      try {
        dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      } catch {
        dateLabel = selectedDate;
      }
    }
    return {
      totalBersih: masuk - keluar,
      trxCount: activeList.length,
      dateLabel,
      masuk,
      keluar
    };
  }, [transactions, selectedDate]);

  // Handler Ekspor Rekap Kas CSV untuk Owner
  const handleExportCSV = () => {
    if (!transactions.length) {
      alert('Belum ada transaksi untuk diekspor.');
      return;
    }
    const today = new Date().toLocaleDateString('sv-SE');
    const headers = [
      'ID Transaksi',
      'Tanggal',
      'Waktu',
      'Keterangan',
      'Kategori',
      'Shift',
      'Metode Pembayaran',
      'Jenis Kas',
      'Nominal (Rp)',
      'Catatan',
      'Bukti Nota'
    ];
    const rows = transactions.map((t) => [
      t.id,
      t.date,
      t.time || '-',
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      t.shift,
      t.paymentMethod,
      t.type,
      t.amount,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
      t.proofUrl ? 'Ada Bukti' : 'Tanpa Nota'
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_kas_esbe_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isOwner = currentUser?.role === 'Pemilik';

  return (
    <>
      {currentUser && (
        <div
          className={`app-shell min-h-screen bg-[var(--surface-app)] text-[var(--text-main)] flex flex-col lg:flex-row gap-4 lg:gap-6 p-3 lg:p-6 font-sans ${appRevealed ? 'is-revealed' : ''}`}
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-[var(--royal-900)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[var(--text-inverse)] focus:shadow-[var(--shadow-popover-md)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--amber-400)]"
          >
            Lewati ke konten utama
          </a>

          {/* Auto-hide scrollbar: pasang listener scroll sekali untuk seluruh halaman */}
          <Scrollbar />

          {/* SIDEBAR NAVIGASI (Sticky full vertical on desktop) */}
          <Navbar
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            role={currentUser.role}
            onLogout={handleLogout}
          />

          {/* KOLOM KANAN: TOPBAR & MAIN CONTENT */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* TOPBAR FLOATING DENGAN SEARCH & USER INFO */}
            <Header
              currentUser={currentUser}
              onLogout={handleLogout}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onAddTransaction={() => setCurrentPage('form')}
              ownerStats={ownerStats}
              onExportCSV={handleExportCSV}
              className="-mt-3 mb-4 lg:-mt-6 lg:mb-6"
            />

            {/* MAIN CONTENT AREA */}
            <main id="main-content" tabIndex={-1} className="flex-1 space-y-5 outline-none">

              {/* RENDER HALAMAN SESUAI TAB AKTIF */}
              {currentPage === 'dashboard' && isOwner && (
                <DashboardPage
                  transactions={transactions}
                  currentUser={currentUser}
                  searchQuery={searchQuery}
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  onNavigate={setCurrentPage}
                />
              )}

              {/* Fallback jika Karyawan berada di dashboard */}
              {currentPage === 'dashboard' && !isOwner && (
                <TransactionFormPage
                  currentShift={currentUser?.shift}
                  onSaveTransaction={handleSaveTransaction}
                  onNavigateToHistory={() => setCurrentPage('history')}
                  onNavigateToOcr={() => setCurrentPage('ocr')}
                />
              )}

              {currentPage === 'form' && (
                <TransactionFormPage
                  currentShift={currentUser?.shift}
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
                  userRole={currentUser.role}
                  onDeleteTransaction={handleDeleteTransaction}
                  onResetMockData={handleResetMockData}
                  onNavigateToForm={() => setCurrentPage('form')}
                />
              )}

              {/* HALAMAN MANAJEMEN PENGGUNA (HANYA UNTUK PEMILIK) */}
              {currentPage === 'users' && isOwner && (
                <UserManagementPage currentUser={currentUser} />
              )}

              {/* Proteksi bila non-owner mencoba mengakses via URL/state */}
              {currentPage === 'users' && !isOwner && (
                <div className={`${card} space-y-3 px-6 py-16 text-center`}>
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--cash-out-light)] text-[var(--cash-out)]">
                    <span aria-hidden="true" className="text-lg font-bold">!</span>
                  </div>
                  <h2 className="text-lg font-semibold text-[var(--text-main)]">Akses Ditolak</h2>
                  <p className="mx-auto max-w-md text-sm text-[var(--text-muted)]">
                    Halaman manajemen akun dan pengguna hanya dapat diakses oleh Pemilik Toko (Owner).
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrentPage('form')}
                    className={`${btnPrimary} mx-auto`}
                  >
                    Kembali ke Pencatatan
                  </button>
                </div>
              )}
            </main>
          </div>
        </div>
      )}

      {/* LOGIN + SAMBUTAN: satu komponen, tetap mounted sampai cross-fade selesai.
          Jangan pindahkan posisinya di JSX agar tidak ter-remount. */}
      {(!currentUser || showAuth) && (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onReveal={handleAuthReveal}
          onDone={handleAuthDone}
        />
      )}
    </>
  );
}