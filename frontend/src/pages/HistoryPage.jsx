import { useState } from 'react';
import { formatRupiah } from '../data/mockData';

export default function HistoryPage({
  transactions,
  onDeleteTransaction,
  onResetMockData,
  onNavigateToForm
}) {
  const [filterType, setFilterType] = useState('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProofModal, setSelectedProofModal] = useState(null);

  // Filter Riwayat Transaksi
  const filteredTransactions = transactions.filter((trx) => {
    const matchType = filterType === 'semua' || trx.type === filterType;
    const matchSearch =
      trx.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Riwayat Transaksi</h2>
          <p className="text-xs text-slate-500">
            Daftar transaksi kas masuk & keluar yang telah dicatat di toko.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToForm && (
            <button
              onClick={onNavigateToForm}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer shadow-sm"
            >
              + Tambah Transaksi
            </button>
          )}
          <button
            onClick={onResetMockData}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium rounded-lg transition cursor-pointer text-slate-700"
            title="Kembalikan data ke contoh awal"
          >
            Reset Contoh Data
          </button>
        </div>
      </div>

      {/* Filter & Pencarian */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <input
          type="text"
          placeholder="Cari transaksi / ID / kategori..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
        >
          <option value="semua">Semua Transaksi</option>
          <option value="pemasukan">Hanya Pemasukan</option>
          <option value="pengeluaran">Hanya Pengeluaran</option>
        </select>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
          Tidak ada transaksi yang cocok dengan filter atau kata kunci.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 text-xs uppercase bg-slate-50 font-semibold">
                <th className="py-3 px-3">Tanggal / ID</th>
                <th className="py-3 px-3">Keterangan</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3 text-right">Nominal</th>
                <th className="py-3 px-3 text-center">Bukti</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredTransactions.map((trx) => (
                <tr key={trx.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="font-semibold text-slate-900">{trx.date}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{trx.id}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-800">{trx.title}</div>
                    {trx.notes && <div className="text-xs text-slate-500">{trx.notes}</div>}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                      {trx.category || 'Umum'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <span
                      className={`font-bold ${
                        trx.type === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {trx.type === 'pemasukan' ? '+' : '-'} {formatRupiah(trx.amount)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    {trx.proofUrl ? (
                      <button
                        onClick={() => setSelectedProofModal(trx.proofUrl)}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs transition cursor-pointer font-semibold"
                      >
                        🔍 Lihat
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <button
                      onClick={() => onDeleteTransaction(trx.id)}
                      className="px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer text-xs"
                      title="Hapus transaksi"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL LIHAT STRUK UKURAN PENUH */}
      {selectedProofModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-4 relative shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Lampiran Bukti Transaksi</h3>
              <button
                onClick={() => setSelectedProofModal(null)}
                className="text-slate-400 hover:text-slate-700 px-2 py-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex justify-center bg-slate-50 border border-slate-100 rounded-lg p-2 overflow-hidden">
              <img
                src={selectedProofModal}
                alt="Bukti Struk Full"
                className="max-h-[70vh] object-contain rounded"
              />
            </div>
            <div className="mt-3 text-right">
              <button
                onClick={() => setSelectedProofModal(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
