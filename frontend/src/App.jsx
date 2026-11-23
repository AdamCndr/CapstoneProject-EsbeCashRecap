import { useState } from 'react';
import { INITIAL_MOCK_TRANSACTIONS, formatRupiah } from './data/mockData';
import Header from './components/Header';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransactionFormPage from './pages/TransactionFormPage';
import OcrConfirmationPage from './pages/OcrConfirmationPage';
import UploadProofPage from './pages/UploadProofPage';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  // 1. Autentikasi Pengguna (Mockup)
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('esbe_mock_user');
    return saved ? JSON.parse(saved) : null;
  });

  // 2. Navigasi Halaman Aktif ('dashboard' | 'form' | 'ocr' | 'upload' | 'history')
  const [currentPage, setCurrentPage] = useState('dashboard');

  // 3. State Data Transaksi (Tersimpan di localStorage frontend)
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('esbe_mock_transactions');
    return saved ? JSON.parse(saved) : INITIAL_MOCK_TRANSACTIONS;
  });

  // Handler Login
  const handleLoginSuccess = (userData) => {
    localStorage.setItem('esbe_mock_user', JSON.stringify(userData));
    setCurrentUser(userData);
    setCurrentPage('dashboard');
  };

  // Handler Logout
  const handleLogout = () => {
    localStorage.removeItem('esbe_mock_user');
    setCurrentUser(null);
  };

  // Handler Simpan Transaksi Baru
  const handleSaveTransaction = (newTrxData) => {
    const newTrx = {
      id: `TRX-${String(transactions.length + 1).padStart(3, '0')}`,
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

  // Handler Hapus Transaksi
  const handleDeleteTransaction = (id) => {
    if (confirm('Yakin ingin menghapus transaksi ini dari riwayat?')) {
      const updated = transactions.filter((t) => t.id !== id);
      setTransactions(updated);
      localStorage.setItem('esbe_mock_transactions', JSON.stringify(updated));
    }
  };

  // Handler Reset Data Contoh
  const handleResetMockData = () => {
    if (confirm('Kembalikan data ke riwayat contoh awal?')) {
      setTransactions(INITIAL_MOCK_TRANSACTIONS);
      localStorage.setItem('esbe_mock_transactions', JSON.stringify(INITIAL_MOCK_TRANSACTIONS));
    }
  };

  // Ringkasan Keuangan Kas Global
  const totalPemasukan = transactions
    .filter((t) => t.type === 'pemasukan')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const totalPengeluaran = transactions
    .filter((t) => t.type === 'pengeluaran')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const saldoKas = totalPemasukan - totalPengeluaran;

  // JIKA BELUM LOGIN: TAMPILKAN HALAMAN LOGIN (pages/LoginPage.jsx)
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // JIKA SUDAH LOGIN: TAMPILKAN LAYOUT DENGAN SEMUA HALAMAN LENGKAP
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* 1. Header Atas (Komponen Terpisah) */}
      <Header currentUser={currentUser} onLogout={handleLogout} />

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full p-4 sm:p-6 flex-1 space-y-6">
        {/* Ringkasan Saldo Global */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Saldo Kas Berjalan
            </span>
            <div className={`text-2xl font-bold mt-1 ${saldoKas >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
              {formatRupiah(saldoKas)}
            </div>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Total Pemasukan Toko
            </span>
            <div className="text-2xl font-bold mt-1 text-emerald-600">
              +{formatRupiah(totalPemasukan)}
            </div>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
              Total Pengeluaran Kas
            </span>
            <div className="text-2xl font-bold mt-1 text-rose-600">
              -{formatRupiah(totalPengeluaran)}
            </div>
          </div>
        </section>

        {/* 2. Navbar Navigasi Menu Tab (Komponen Terpisah) */}
        <Navbar
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          transactionCount={transactions.length}
        />

        {/* RENDER KONTEN HALAMAN SESUAI TAB YANG AKTIF */}
        {currentPage === 'dashboard' && (
          <DashboardPage transactions={transactions} />
        )}

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
      </main>
    </div>
  );
}
