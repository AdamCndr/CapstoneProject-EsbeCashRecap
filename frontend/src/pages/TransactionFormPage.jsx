import { useState } from 'react';

export default function TransactionFormPage({ onSaveTransaction, onNavigateToHistory, onNavigateToOcr }) {
  const [form, setForm] = useState({
    title: '',
    type: 'pemasukan',
    category: 'Jasa Fotokopi',
    paymentMethod: 'tunai', // tunai | qris | transfer
    shift: 'pagi', // pagi | siang
    amount: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':'),
    notes: '',
    proofUrl: ''
  });

  const [proofPreview, setProofPreview] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Handler Upload Foto Bukti Struk/Nota
  const handleProofChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file bertipe gambar (JPG, PNG, JPEG).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProofPreview(reader.result);
      setForm((prev) => ({ ...prev, proofUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProof = () => {
    setProofPreview('');
    setForm((prev) => ({ ...prev, proofUrl: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.title.trim() || !form.amount || Number(form.amount) <= 0) {
      setFeedback({ type: 'error', message: 'Mohon lengkapi keterangan dan nominal transaksi.' });
      return;
    }

    const newTrx = {
      title: form.title,
      type: form.type,
      category: form.category,
      paymentMethod: form.paymentMethod,
      shift: form.shift,
      amount: Number(form.amount),
      date: form.date,
      time: form.time,
      notes: form.notes,
      proofUrl: form.proofUrl
    };

    onSaveTransaction(newTrx);

    // Reset Form
    setForm({
      title: '',
      type: 'pemasukan',
      category: 'Jasa Fotokopi',
      paymentMethod: 'tunai',
      shift: 'pagi',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':'),
      notes: '',
      proofUrl: ''
    });
    setProofPreview('');

    setFeedback({
      type: 'success',
      message: `Transaksi "${newTrx.title}" (${newTrx.paymentMethod.toUpperCase()} - Shift ${newTrx.shift}) berhasil dicatat!`
    });

    setTimeout(() => {
      setFeedback({ type: '', message: '' });
    }, 4000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Catat Pendapatan & Transaksi</h2>
          <p className="text-xs text-slate-500">
            Pencatatan pendapatan harian UMKM Esbe per shift (Pagi/Siang) & metode pembayaran.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onNavigateToOcr && (
            <button
              type="button"
              onClick={onNavigateToOcr}
              className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold cursor-pointer"
            >
              ⚡ Coba Simulasi OCR
            </button>
          )}
          {onNavigateToHistory && (
            <button
              type="button"
              onClick={onNavigateToHistory}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline cursor-pointer"
            >
              Lihat Riwayat &rarr;
            </button>
          )}
        </div>
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Baris 1: Shift Kerja & Metode Pembayaran (Sesuai Use Case Esbe) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
          {/* Shift Kerja */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Shift Kerja <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.shift}
              onChange={(e) => setForm({ ...form, shift: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-bold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="pagi">☀️ Shift Pagi (08:00 - 14:00)</option>
              <option value="siang">⛅ Shift Siang (14:00 - 21:00)</option>
            </select>
          </div>

          {/* Metode Pembayaran */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Metode Pembayaran <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-bold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="tunai">💵 Tunai (Cash Fisik)</option>
              <option value="qris">📱 QRIS Merchant Esbe</option>
              <option value="transfer">🏦 Transfer Bank</option>
            </select>
          </div>

          {/* Jenis Kas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Jenis Arus Kas <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-bold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="pemasukan">📥 Pemasukan (Pendapatan)</option>
              <option value="pengeluaran">📤 Pengeluaran (Beli Kertas/Tinta/dll)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Judul Transaksi */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Keterangan Layanan / Barang <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Misal: Fotokopi Modul 50 Lembar / Print Warna"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Kategori Layanan
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="Jasa Fotokopi">Jasa Fotokopi & Jilid</option>
              <option value="Percetakan & ATK">Percetakan & Penjualan ATK</option>
              <option value="Perlengkapan">Perlengkapan / Bahan Baku</option>
              <option value="Maintenance">Maintenance Mesin</option>
              <option value="Lain-lain">Lain-lain</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Nominal */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nominal Rupiah (Rp) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              required
              min="1"
              placeholder="Contoh: 25000"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Tanggal */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tanggal Transaksi <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* Jam / Waktu */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Jam Transaksi
            </label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Catatan */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Catatan Tambahan (Opsional)
          </label>
          <textarea
            rows="2"
            placeholder="Catatan nama pemesan, nomor referensi QRIS, dll."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:ring-2 focus:ring-indigo-500"
          ></textarea>
        </div>

        {/* BAGIAN UNGGAH BUKTI TRANSAKSI (Terutama untuk QRIS/Transfer) */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            📎 Unggah Foto Struk / Bukti Non-Tunai (QRIS / Transfer)
          </label>

          {!proofPreview ? (
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-5 text-center bg-slate-50 transition">
              <input
                type="file"
                id="proofUpload"
                accept="image/*"
                onChange={handleProofChange}
                className="hidden"
              />
              <label
                htmlFor="proofUpload"
                className="cursor-pointer flex flex-col items-center justify-center space-y-1"
              >
                <span className="text-3xl">📷</span>
                <span className="text-sm font-semibold text-indigo-600 hover:underline">
                  Pilih foto struk / screenshot QRIS
                </span>
                <span className="text-[11px] text-slate-500">
                  Didukung: JPG, PNG, JPEG (Bisa langsung dari kamera HP)
                </span>
              </label>
            </div>
          ) : (
            <div className="relative inline-block border border-slate-200 rounded-xl p-2 bg-slate-50 shadow-sm">
              <img
                src={proofPreview}
                alt="Pratinjau Bukti"
                className="max-h-48 rounded-lg object-contain bg-white"
              />
              <button
                type="button"
                onClick={handleRemoveProof}
                className="absolute top-3 right-3 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-md shadow cursor-pointer"
              >
                ✕ Hapus
              </button>
              <p className="text-[11px] text-emerald-600 mt-1.5 text-center font-medium">
                ✓ Bukti siap disimpan bersama transaksi
              </p>
            </div>
          )}
        </div>

        {/* Tombol Simpan */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition duration-150 cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            <span>💾</span> Simpan Pendapatan ke Rekap
          </button>
        </div>
      </form>
    </div>
  );
}
