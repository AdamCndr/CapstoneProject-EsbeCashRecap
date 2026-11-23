import { useState } from 'react';
import { formatRupiah } from '../data/mockData';

export default function HistoryPage({
  transactions,
  onDeleteTransaction,
  onResetMockData,
  onNavigateToForm
}) {
  const [filterType, setFilterType] = useState('semua');
  const [filterMethod, setFilterMethod] = useState('semua');
  const [filterShift, setFilterShift] = useState('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProofModal, setSelectedProofModal] = useState(null);

  // Filter Riwayat Transaksi
  const filteredTransactions = transactions.filter((trx) => {
    const matchType = filterType === 'semua' || trx.type === filterType;
    const matchMethod = filterMethod === 'semua' || trx.paymentMethod === filterMethod;
    const matchShift = filterShift === 'semua' || trx.shift === filterShift;
    const matchSearch =
      trx.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (trx.referenceId && trx.referenceId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchType && matchMethod && matchShift && matchSearch;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Riwayat Transaksi</h2>
          <p className="text-xs text-slate-500">
            Daftar kas masuk & keluar lengkap dengan metode pembayaran dan shift kerja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToForm && (
            <button
              onClick={onNavigateToForm}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer shadow-xs"
            >
              + Catat Pendapatan
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

      {/* Filter Toolbar Multi-Kriteria (Sesuai Kebutuhan Pemilik & Karyawan) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mb-4">
        <input
          type="text"
          placeholder="Cari transaksi / Ref ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:ring-2 focus:ring-indigo-500"
        />

        <select
          value={filterShift}
          onChange={(e) => setFilterShift(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="semua">Semua Shift</option>
          <option value="pagi">☀️ Shift Pagi</option>
          <option value="siang">⛅ Shift Siang</option>
        </select>

        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="semua">Semua Metode</option>
          <option value="tunai">💵 Tunai</option>
          <option value="qris">📱 QRIS</option>
          <option value="transfer">🏦 Transfer Bank</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="semua">Semua Jenis Kas</option>
          <option value="pemasukan">📥 Pemasukan Saja</option>
          <option value="pengeluaran">📤 Pengeluaran Saja</option>
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
                <th className="py-3 px-3">Waktu / Shift</th>
                <th className="py-3 px-3">Keterangan</th>
                <th className="py-3 px-3">Metode</th>
                <th className="py-3 px-3 text-right">Nominal</th>
                <th className="py-3 px-3 text-center">Bukti</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredTransactions.map((trx) => (
                <tr key={trx.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="font-semibold text-slate-900">
                      {trx.date} <span className="text-slate-500 text-xs font-normal">({trx.time || '-'})</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          trx.shift === 'pagi'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {trx.shift === 'pagi' ? 'Pagi' : 'Siang'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{trx.id}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-800 flex items-center gap-2">
                      <span>{trx.title}</span>
                      {trx.isDuplicate && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                          ⚠️ Terindikasi Duplikat
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {trx.category} {trx.referenceId && `• Ref: ${trx.referenceId}`}
                    </div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-100 border border-slate-200 text-slate-700 font-bold uppercase">
                      {trx.paymentMethod || 'Tunai'}
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
