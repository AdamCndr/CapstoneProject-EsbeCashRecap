import { useState } from 'react';
import { formatRupiah } from '../data/mockData';

export default function OcrConfirmationPage({ onConfirmTransaction, onCancel }) {
  // Simulasi bukti struk contoh hasil upload yang baru saja di-scan oleh AI OCR
  const [ocrSampleProof] = useState(
    'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=600&auto=format&fit=crop&q=80'
  );

  // Field hasil ekstraksi AI OCR
  const [formData, setFormData] = useState({
    title: 'Pembayaran QRIS Merchant Esbe',
    amount: 145000,
    date: new Date().toISOString().split('T')[0],
    time: '11:35',
    referenceId: 'NMID-992144812',
    paymentMethod: 'qris',
    shift: 'pagi',
    notes: 'Hasil ekstraksi OCR otomatis (Akurasi: 96%)'
  });

  // State simulasi deteksi duplikat (Fitur Penting Project Plan A26-CS191)
  const [isDuplicateDetected, setIsDuplicateDetected] = useState(true);
  const [isManualMode, setIsManualMode] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleConfirm = (e) => {
    e.preventDefault();

    if (!formData.amount || Number(formData.amount) <= 0) {
      alert('Nominal harus diisi dengan benar!');
      return;
    }

    const payload = {
      title: formData.title,
      type: 'pemasukan',
      category: 'QRIS / Non-Tunai',
      amount: Number(formData.amount),
      date: formData.date,
      time: formData.time,
      referenceId: formData.referenceId,
      paymentMethod: formData.paymentMethod,
      shift: formData.shift,
      notes: formData.notes,
      proofUrl: ocrSampleProof,
      isDuplicate: isDuplicateDetected
    };

    onConfirmTransaction(payload);
    setFeedback('Transaksi berhasil dikonfirmasi dan dicatat ke riwayat!');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-xs">
      {/* Header Halaman */}
      <div className="mb-5 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              Layanan AI • Fast-API OCR
            </span>
            <span className="text-xs text-slate-400">Minggu 3 Deliverable</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            Konfirmasi & Koreksi Hasil OCR Bukti Pembayaran
          </h2>
          <p className="text-xs text-slate-500">
            Karyawan dapat memeriksa, mengoreksi nominal/ID transaksi sebelum disimpan ke database.
          </p>
        </div>

        {/* Toggle Mode Manual */}
        <button
          type="button"
          onClick={() => setIsManualMode(!isManualMode)}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline self-start sm:self-auto cursor-pointer"
        >
          {isManualMode ? 'Kembali ke Hasil OCR' : 'Bukti Buram? Input Manual'}
        </button>
      </div>

      {feedback && (
        <div className="mb-5 p-3.5 rounded-lg text-sm bg-emerald-50 border border-emerald-200 text-emerald-800">
          ✓ {feedback}
        </div>
      )}

      {/* PERINGATAN BUKTI DUPLIKAT (Sesuai Rencana Pengujian & Fitur Utama Capstone) */}
      {isDuplicateDetected && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <span className="text-2xl leading-none">⚠️</span>
          <div className="flex-1">
            <div className="font-bold text-amber-950 flex items-center justify-between">
              <span>Peringatan: Terindikasi Bukti Duplikat!</span>
              <button
                type="button"
                onClick={() => setIsDuplicateDetected(false)}
                className="text-xs text-amber-800 underline hover:text-amber-950 cursor-pointer font-semibold"
              >
                Abaikan / Tetap Simpan
              </button>
            </div>
            <p className="mt-1 text-amber-800 leading-relaxed">
              ID Transaksi <strong>{formData.referenceId}</strong> dengan nominal{' '}
              <strong>{formatRupiah(formData.amount)}</strong> terdeteksi pernah diunggah
              sebelumnya pada shift pagi. Pastikan pelanggan tidak mengirim ulang struk yang sama.
            </p>
          </div>
        </div>
      )}

      {/* Tampilan 2 Kolom: Gambar Struk vs Formulir Hasil Bacaan */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Foto Struk Bukti Asli */}
        <div className="md:col-span-5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center">
          <span className="text-xs font-semibold text-slate-700 block mb-2">
            📷 Foto Bukti Struk yang Diunggah
          </span>
          <div className="relative group bg-white border border-slate-200 rounded-lg p-2 overflow-hidden flex justify-center">
            <img
              src={ocrSampleProof}
              alt="Bukti Struk"
              className="max-h-72 object-contain rounded"
            />
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            AI berhasil mengenali QRIS NMID & Nominal
          </span>
        </div>

        {/* Kolom Kanan: Form Hasil Ekstraksi yang Bisa Dikoreksi Karyawan */}
        <form onSubmit={handleConfirm} className="md:col-span-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Shift Kerja */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shift Kerja Operasional <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.shift}
                onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
              >
                <option value="pagi">Shift Pagi (08:00 - 14:00)</option>
                <option value="siang">Shift Siang (14:00 - 21:00)</option>
              </select>
            </div>

            {/* Metode Pembayaran */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Metode Pembayaran <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
              >
                <option value="qris">QRIS Toko</option>
                <option value="transfer">Transfer Bank (BCA/BRI)</option>
                <option value="tunai">Tunai</option>
              </select>
            </div>
          </div>

          {/* Nominal Hasil Bacaan OCR */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nominal Terdeteksi (Rp) <span className="text-rose-500">* (Bisa diedit bila salah)</span>
            </label>
            <input
              type="number"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-indigo-300 rounded-lg text-slate-900 font-bold text-base focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* ID Transaksi / NMID (Kunci Cek Duplikat) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ID Transaksi / Ref No. (Cek Duplikat)
              </label>
              <input
                type="text"
                value={formData.referenceId}
                onChange={(e) => setFormData({ ...formData, referenceId: e.target.value })}
                placeholder="Contoh: NMID-992144812"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Waktu Jam Struk */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jam Transaksi di Struk
              </label>
              <input
                type="text"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                placeholder="11:35"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Keterangan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Keterangan Transaksi
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Tombol Aksi */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs sm:text-sm transition duration-150 cursor-pointer shadow-md flex items-center justify-center gap-1.5"
            >
              <span>✓</span> Konfirmasi & Simpan Transaksi
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer"
              >
                Batal
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

