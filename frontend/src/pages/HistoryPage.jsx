import { useEffect, useState } from 'react';
import { Eye, Plus, Search, Trash2, X } from 'lucide-react';
import { formatRupiah } from '../data/mockData';
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  card,
  field,
  ico,
  iconBtn,
  methodLabel,
  PageHeader,
  ShiftTag
} from '../lib/ui';

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
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Tutup modal bukti dengan Escape
  useEffect(() => {
    if (!selectedProofModal) return;
    const onKey = (e) => e.key === 'Escape' && setSelectedProofModal(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedProofModal]);

  const q = searchQuery.trim().toLowerCase();
  const filteredTransactions = transactions.filter((trx) => {
    const matchType = filterType === 'semua' || trx.type === filterType;
    const matchMethod = filterMethod === 'semua' || (trx.paymentMethod || 'tunai') === filterMethod;
    const matchShift = filterShift === 'semua' || trx.shift === filterShift;
    const haystack = [trx.title, trx.category, trx.id, trx.referenceId].filter(Boolean).join(' ').toLowerCase();
    return matchType && matchMethod && matchShift && (!q || haystack.includes(q));
  });

  const select = `${field} cursor-pointer`;

  return (
    <div>
      <PageHeader
        title="Riwayat transaksi"
        description="Kas masuk dan keluar menurut metode pembayaran dan shift"
        actions={
          <>
            {confirmReset ? (
              <>
                <span className="self-center text-sm text-neutral-600">Kembalikan ke data contoh?</span>
                <button
                  type="button"
                  onClick={() => {
                    onResetMockData();
                    setConfirmReset(false);
                  }}
                  className={btnSecondary}
                >
                  Ya, reset
                </button>
                <button type="button" onClick={() => setConfirmReset(false)} className={btnGhost}>
                  Batal
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmReset(true)} className={btnGhost}>
                Reset data contoh
              </button>
            )}
            {onNavigateToForm && (
              <button type="button" onClick={onNavigateToForm} className={btnPrimary}>
                <Plus {...ico} />
                Catat pendapatan
              </button>
            )}
          </>
        }
      />

      <div className={`${card} p-6`}>
        {/* Filter */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search
              {...ico}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-500"
            />
            <input
              type="search"
              aria-label="Cari transaksi"
              placeholder="Cari transaksi atau ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${field} pl-9`}
            />
          </div>

          <select aria-label="Filter shift" value={filterShift} onChange={(e) => setFilterShift(e.target.value)} className={select}>
            <option value="semua">Semua shift</option>
            <option value="pagi">Pagi</option>
            <option value="siang">Siang</option>
          </select>

          <select aria-label="Filter metode" value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} className={select}>
            <option value="semua">Semua metode</option>
            <option value="tunai">Tunai</option>
            <option value="qris">QRIS</option>
            <option value="transfer">Transfer</option>
          </select>

          <select aria-label="Filter jenis kas" value={filterType} onChange={(e) => setFilterType(e.target.value)} className={select}>
            <option value="semua">Semua jenis kas</option>
            <option value="pemasukan">Pemasukan</option>
            <option value="pengeluaran">Pengeluaran</option>
          </select>
        </div>

        <p className="mb-3 text-xs tabular-nums text-neutral-500">
          {filteredTransactions.length} dari {transactions.length} transaksi
        </p>

        {filteredTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-12 text-center text-sm text-neutral-600">
            Tidak ada transaksi yang cocok dengan filter atau kata kunci
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-900/10">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-neutral-50 text-[13px] leading-5 text-neutral-600">
                  <th className="px-4 py-3 font-medium">Waktu dan shift</th>
                  <th className="px-4 py-3 font-medium">Keterangan</th>
                  <th className="px-4 py-3 font-medium">Metode</th>
                  <th className="px-4 py-3 text-right font-medium">Nominal</th>
                  <th className="px-4 py-3 text-center font-medium">Bukti</th>
                  <th className="px-4 py-3 text-center font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900/10">
                {filteredTransactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="tabular-nums text-neutral-900">
                        {trx.date} <span className="text-neutral-500">{trx.time || '-'}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-3">
                        <ShiftTag shift={trx.shift} />
                        <span className="font-mono text-xs text-neutral-500">{trx.id}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-neutral-900">
                        <span>{trx.title}</span>
                        {trx.isDuplicate && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs leading-4 text-amber-900">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-600" aria-hidden="true" />
                            Perlu ditinjau
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs leading-4 text-neutral-500">
                        {trx.category}
                        {trx.referenceId ? (
                          <>
                            {' · Ref '}
                            <span className="font-mono">{trx.referenceId}</span>
                          </>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-neutral-700">
                      {methodLabel[trx.paymentMethod || 'tunai'] || trx.paymentMethod}
                    </td>

                    <td
                      className={`px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums ${trx.type === 'pemasukan' ? 'text-neutral-900' : 'text-red-600'
                        }`}
                    >
                      {trx.type === 'pemasukan' ? '+' : '−'} {formatRupiah(trx.amount)}
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {trx.proofUrl ? (
                        <button
                          type="button"
                          onClick={() => setSelectedProofModal(trx.proofUrl)}
                          className={`${btnSecondary} h-8 px-3`}
                        >
                          <Eye {...ico} />
                          Lihat
                        </button>
                      ) : (
                        <span className="text-neutral-500">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {confirmDeleteId === trx.id ? (
                        <span className="inline-flex items-center gap-2 text-[13px]">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteTransaction(trx.id);
                              setConfirmDeleteId(null);
                            }}
                            className="cursor-pointer font-medium text-red-600 underline"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="cursor-pointer text-neutral-600 underline"
                          >
                            Batal
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(trx.id)}
                          className={iconBtn}
                          aria-label={`Hapus transaksi ${trx.id}`}
                        >
                          <Trash2 {...ico} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal bukti ukuran penuh */}
      {selectedProofModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4"
          onClick={() => setSelectedProofModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Lampiran bukti transaksi"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base leading-6 font-medium text-neutral-900">Bukti transaksi</h3>
              <button
                type="button"
                onClick={() => setSelectedProofModal(null)}
                className={iconBtn}
                aria-label="Tutup"
                autoFocus
              >
                <X {...ico} />
              </button>
            </div>
            <div className="flex justify-center rounded-lg border border-neutral-900/10 bg-neutral-50 p-2">
              <img src={selectedProofModal} alt="Bukti transaksi" className="max-h-[70vh] rounded object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
