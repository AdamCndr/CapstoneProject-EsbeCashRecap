import { useState } from 'react';

export default function UploadProofPage({ transactions, onUpdateProof, onNavigateToHistory }) {
  const [selectedTrxId, setSelectedTrxId] = useState(transactions[0]?.id || '');
  const [proofPreview, setProofPreview] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file gambar (JPG, PNG, JPEG)');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProofPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProof = (e) => {
    e.preventDefault();
    if (!selectedTrxId) {
      setFeedback({ type: 'error', message: 'Pilih transaksi terlebih dahulu!' });
      return;
    }
    if (!proofPreview) {
      setFeedback({ type: 'error', message: 'Silakan pilih file gambar bukti struk!' });
      return;
    }

    onUpdateProof(selectedTrxId, proofPreview);
    setFeedback({
      type: 'success',
      message: `Bukti berhasil dilampirkan ke transaksi ${selectedTrxId}!`
    });
    setProofPreview('');

    setTimeout(() => {
      setFeedback({ type: '', message: '' });
    }, 4000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Unggah Bukti Transaksi</h2>
          <p className="text-xs text-slate-500">
            Halaman khusus untuk melampirkan atau memperbarui foto bukti struk/nota transaksi.
          </p>
        </div>
        {onNavigateToHistory && (
          <button
            type="button"
            onClick={onNavigateToHistory}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline self-start sm:self-auto cursor-pointer"
          >
            Lihat Riwayat &rarr;
          </button>
        )}
      </div>

      {feedback.message && (
        <div
          className={`mb-5 p-3.5 rounded-lg text-sm border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="py-10 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
          Belum ada data transaksi. Silakan input transaksi terlebih dahulu di menu Formulir.
        </div>
      ) : (
        <form onSubmit={handleSaveProof} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Pilih Transaksi Tujuan <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedTrxId}
              onChange={(e) => setSelectedTrxId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            >
              {transactions.map((trx) => (
                <option key={trx.id} value={trx.id}>
                  [{trx.id}] {trx.title} - ({trx.date})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              File Foto Bukti Pembayaran <span className="text-rose-500">*</span>
            </label>

            {!proofPreview ? (
              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-6 text-center bg-slate-50 transition">
                <input
                  type="file"
                  id="uploadProofDirect"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="uploadProofDirect"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                >
                  <span className="text-3xl">📤</span>
                  <span className="text-sm font-semibold text-indigo-600 hover:underline">
                    Klik di sini untuk memilih foto nota / struk
                  </span>
                  <span className="text-xs text-slate-500">JPG, PNG, JPEG</span>
                </label>
              </div>
            ) : (
              <div className="relative inline-block border border-slate-200 rounded-xl p-2 bg-slate-50 shadow-sm">
                <img
                  src={proofPreview}
                  alt="Pratinjau"
                  className="max-h-56 rounded-lg object-contain bg-white"
                />
                <button
                  type="button"
                  onClick={() => setProofPreview('')}
                  className="absolute top-3 right-3 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-md shadow cursor-pointer"
                >
                  ✕ Ganti
                </button>
                <p className="text-[11px] text-emerald-600 mt-1.5 text-center font-medium">
                  ✓ Foto siap diunggah
                </p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition duration-150 cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <span>📎</span> Simpan Lampiran Bukti
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
