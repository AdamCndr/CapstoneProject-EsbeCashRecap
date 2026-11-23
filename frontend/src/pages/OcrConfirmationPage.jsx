import { useState } from 'react';
import { formatRupiah } from '../data/mockData';
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  card,
  field,
  hint,
  label,
  Notice,
  PageHeader,
  shiftHours,
  todayISO
} from '../lib/ui';

// Bukti contoh hasil upload yang baru dipindai OCR (mock)
const SAMPLE_PROOF =
  'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=600&auto=format&fit=crop&q=80';

const OCR_RESULT = {
  title: 'Pembayaran QRIS Merchant Esbe',
  amount: 145000,
  time: '11:35',
  referenceId: 'NMID-992144812',
  paymentMethod: 'qris',
  shift: 'pagi',
  notes: 'Hasil ekstraksi OCR otomatis (Akurasi: 96%)'
};

// Bukti buram: kosongkan field hasil baca, karyawan mengisi sendiri
const MANUAL_RESULT = {
  ...OCR_RESULT,
  title: 'Pembayaran non-tunai',
  amount: '',
  time: '',
  referenceId: '',
  notes: 'Diisi manual, bukti tidak terbaca'
};

export default function OcrConfirmationPage({ onConfirmTransaction, onCancel }) {
  const [formData, setFormData] = useState({ ...OCR_RESULT, date: todayISO() });
  const [isManualMode, setIsManualMode] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Simulasi hasil cek duplikat dari backend. Tanpa ID transaksi (mode manual) tidak bisa dicek
  const isDuplicate = !isManualMode;

  const set = (key) => (e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  const toggleManual = () => {
    const next = !isManualMode;
    setIsManualMode(next);
    setError('');
    setFormData((prev) => ({
      ...(next ? MANUAL_RESULT : OCR_RESULT),
      date: prev.date,
      shift: prev.shift,
      paymentMethod: prev.paymentMethod
    }));
  };

  const handleConfirm = (e) => {
    e.preventDefault();

    if (!formData.amount || Number(formData.amount) <= 0) {
      setError('Nominal harus diisi dengan benar');
      return;
    }
    setError('');

    onConfirmTransaction({
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
      proofUrl: SAMPLE_PROOF,
      // Tanda duplikat tetap ikut tersimpan agar pemilik bisa meninjau
      isDuplicate
    });
    setSaved(true);
  };

  const amountNumber = Number(formData.amount);

  return (
    <div>
      <PageHeader
        eyebrow="Hasil baca otomatis (OCR)"
        title="Konfirmasi bukti pembayaran"
        description="Periksa dan koreksi nominal serta ID transaksi sebelum disimpan"
        actions={
          <button type="button" onClick={toggleManual} disabled={saved} className={btnGhost}>
            {isManualMode ? 'Kembali ke hasil OCR' : 'Bukti buram? Isi manual'}
          </button>
        }
      />

      <div className="space-y-4">
        {saved && <Notice kind="success">Transaksi dikonfirmasi dan masuk ke riwayat</Notice>}

        {isDuplicate && (
          <Notice kind="warning">
            <p className="font-medium">Bukti terindikasi duplikat</p>
            <p className="mt-1">
              ID transaksi <span className="font-mono">{formData.referenceId}</span> dengan nominal{' '}
              {formatRupiah(formData.amount)} sudah pernah diunggah. Transaksi tetap bisa disimpan dan akan
              ditandai Perlu ditinjau untuk pemilik
            </p>
          </Notice>
        )}

        <div className={`${card} grid grid-cols-1 gap-8 p-6 sm:p-8 md:grid-cols-12`}>
          {/* Bukti yang diunggah */}
          <div className="md:col-span-5">
            <p className={label}>Bukti yang diunggah</p>
            <div className="flex justify-center rounded-xl border border-neutral-900/10 bg-neutral-50 p-2">
              <img src={SAMPLE_PROOF} alt="Bukti pembayaran" className="max-h-80 rounded-lg object-contain" />
            </div>
            <p className={hint}>Hasil baca otomatis bisa keliru, cocokkan dengan gambar</p>
          </div>

          {/* Form hasil ekstraksi */}
          <form onSubmit={handleConfirm} className="space-y-4 md:col-span-7">
            {error && <Notice kind="error">{error}</Notice>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ocr-shift" className={label}>
                  Shift kerja
                </label>
                <select
                  id="ocr-shift"
                  value={formData.shift}
                  onChange={set('shift')}
                  className={`${field} cursor-pointer`}
                >
                  <option value="pagi">Pagi · {shiftHours.pagi}</option>
                  <option value="siang">Siang · {shiftHours.siang}</option>
                </select>
              </div>

              <div>
                <label htmlFor="ocr-method" className={label}>
                  Metode pembayaran
                </label>
                <select
                  id="ocr-method"
                  value={formData.paymentMethod}
                  onChange={set('paymentMethod')}
                  className={`${field} cursor-pointer`}
                >
                  <option value="qris">QRIS</option>
                  <option value="transfer">Transfer bank</option>
                  <option value="tunai">Tunai</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="ocr-amount" className={label}>
                {isManualMode ? 'Nominal (Rp)' : 'Nominal terbaca (Rp)'}
              </label>
              <input
                id="ocr-amount"
                type="number"
                inputMode="numeric"
                required
                min="1"
                value={formData.amount}
                onChange={set('amount')}
                className={`${field} h-12 text-lg font-medium tabular-nums`}
              />
              <p className={`${hint} tabular-nums`}>
                {amountNumber > 0 ? formatRupiah(amountNumber) : 'Ubah jika hasil baca salah'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ocr-ref" className={label}>
                  ID transaksi
                </label>
                <input
                  id="ocr-ref"
                  type="text"
                  value={formData.referenceId}
                  onChange={set('referenceId')}
                  placeholder="NMID-992144812"
                  className={`${field} font-mono`}
                />
                <p className={hint}>Dipakai untuk cek duplikat</p>
              </div>

              <div>
                <label htmlFor="ocr-time" className={label}>
                  Jam di struk
                </label>
                <input
                  id="ocr-time"
                  type="time"
                  value={formData.time}
                  onChange={set('time')}
                  className={`${field} cursor-pointer tabular-nums`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="ocr-title" className={label}>
                Keterangan
              </label>
              <input id="ocr-title" type="text" value={formData.title} onChange={set('title')} className={field} />
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <button type="submit" disabled={saved} className={`${btnPrimary} flex-1`}>
                {saved ? 'Tersimpan' : isDuplicate ? 'Simpan dengan tanda Perlu ditinjau' : 'Konfirmasi dan simpan'}
              </button>
              {onCancel && (
                <button type="button" onClick={onCancel} className={btnSecondary}>
                  {saved ? 'Selesai' : 'Batal'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
