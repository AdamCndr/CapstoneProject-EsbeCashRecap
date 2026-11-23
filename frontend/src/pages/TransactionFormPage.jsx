import { useState } from 'react';
import { ArrowRight, Camera, Check, ScanText } from 'lucide-react';
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  card,
  field,
  hint,
  ico,
  label,
  methodLabel,
  motion,
  Notice,
  nowHHMM,
  PageHeader,
  shiftHours,
  todayISO
} from '../lib/ui';

const emptyForm = () => ({
  title: '',
  type: 'pemasukan',
  category: 'Jasa Fotokopi',
  paymentMethod: 'tunai', // tunai | qris | transfer
  shift: 'pagi', // pagi | siang
  amount: '',
  date: todayISO(),
  time: nowHHMM(),
  notes: '',
  proofUrl: ''
});

export default function TransactionFormPage({ onSaveTransaction, onNavigateToHistory, onNavigateToOcr }) {
  const [form, setForm] = useState(emptyForm);
  const [proofPreview, setProofPreview] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleProofChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'File harus berupa gambar (JPG atau PNG)' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProofPreview(reader.result);
      setForm((prev) => ({ ...prev, proofUrl: reader.result }));
      setFeedback({ type: '', message: '' });
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
      setFeedback({ type: 'error', message: 'Lengkapi keterangan dan nominal transaksi' });
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

    setForm(emptyForm());
    setProofPreview('');
    setFeedback({
      type: 'success',
      message: `${newTrx.title} (${methodLabel[newTrx.paymentMethod]}, shift ${newTrx.shift}) tersimpan`
    });
    setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
  };

  return (
    <div>
      <PageHeader
        title="Catat pendapatan"
        description="Pendapatan harian per shift dan metode pembayaran"
        actions={
          <>
            {onNavigateToOcr && (
              <button type="button" onClick={onNavigateToOcr} className={btnSecondary}>
                <ScanText {...ico} />
                Simulasi OCR
              </button>
            )}
            {onNavigateToHistory && (
              <button type="button" onClick={onNavigateToHistory} className={btnGhost}>
                Lihat riwayat
                <ArrowRight {...ico} />
              </button>
            )}
          </>
        }
      />

      <div className={`${card} p-6 sm:p-8`}>
        {feedback.message && (
          <Notice kind={feedback.type === 'success' ? 'success' : 'error'} className="mb-6">
            {feedback.message}
          </Notice>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Shift, metode, jenis kas */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-neutral-900/10 bg-neutral-50 p-4 sm:grid-cols-3">
            <div>
              <label htmlFor="shift" className={label}>
                Shift kerja
              </label>
              <select id="shift" value={form.shift} onChange={set('shift')} className={`${field} cursor-pointer`}>
                <option value="pagi">Pagi · {shiftHours.pagi}</option>
                <option value="siang">Siang · {shiftHours.siang}</option>
              </select>
            </div>

            <div>
              <label htmlFor="method" className={label}>
                Metode pembayaran
              </label>
              <select
                id="method"
                value={form.paymentMethod}
                onChange={set('paymentMethod')}
                className={`${field} cursor-pointer`}
              >
                <option value="tunai">Tunai</option>
                <option value="qris">QRIS</option>
                <option value="transfer">Transfer bank</option>
              </select>
            </div>

            <div>
              <label htmlFor="type" className={label}>
                Jenis kas
              </label>
              <select id="type" value={form.type} onChange={set('type')} className={`${field} cursor-pointer`}>
                <option value="pemasukan">Pemasukan</option>
                <option value="pengeluaran">Pengeluaran</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="title" className={label}>
                Keterangan layanan atau barang
              </label>
              <input
                id="title"
                type="text"
                required
                placeholder="Contoh: fotokopi modul 50 lembar"
                value={form.title}
                onChange={set('title')}
                className={field}
              />
            </div>

            <div>
              <label htmlFor="category" className={label}>
                Kategori
              </label>
              <select
                id="category"
                value={form.category}
                onChange={set('category')}
                className={`${field} cursor-pointer`}
              >
                <option value="Jasa Fotokopi">Jasa fotokopi dan jilid</option>
                <option value="Percetakan & ATK">Percetakan dan penjualan ATK</option>
                <option value="Perlengkapan">Perlengkapan dan bahan baku</option>
                <option value="Maintenance">Maintenance mesin</option>
                <option value="Lain-lain">Lain-lain</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="amount" className={label}>
                Nominal (Rp)
              </label>
              <input
                id="amount"
                type="number"
                inputMode="numeric"
                required
                min="1"
                placeholder="25000"
                value={form.amount}
                onChange={set('amount')}
                className={`${field} tabular-nums`}
              />
            </div>

            <div>
              <label htmlFor="date" className={label}>
                Tanggal
              </label>
              <input
                id="date"
                type="date"
                required
                value={form.date}
                onChange={set('date')}
                className={`${field} cursor-pointer`}
              />
            </div>

            <div>
              <label htmlFor="time" className={label}>
                Jam
              </label>
              <input
                id="time"
                type="time"
                value={form.time}
                onChange={set('time')}
                className={`${field} cursor-pointer`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className={label}>
              Catatan <span className="font-normal text-neutral-500">(opsional)</span>
            </label>
            <textarea
              id="notes"
              rows="2"
              placeholder="Nama pemesan, nomor referensi QRIS"
              value={form.notes}
              onChange={set('notes')}
              className={`${field} h-auto py-2`}
            />
          </div>

          {/* Bukti non-tunai */}
          <div className="border-t border-neutral-900/10 pt-6">
            <p className={label}>
              Bukti QRIS atau transfer <span className="font-normal text-neutral-500">(opsional)</span>
            </p>

            {!proofPreview ? (
              <div>
                <input
                  type="file"
                  id="proofUpload"
                  accept="image/*"
                  onChange={handleProofChange}
                  className="peer sr-only"
                />
                <label
                  htmlFor="proofUpload"
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center hover:border-blue-800 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-800 ${motion}`}
                >
                  <Camera size={20} strokeWidth={1.5} className="text-neutral-500" aria-hidden="true" />
                  <span className="text-sm font-medium text-neutral-900">Pilih foto struk atau screenshot</span>
                  <span className="text-xs text-neutral-500">JPG atau PNG, bisa langsung dari kamera ponsel</span>
                </label>
              </div>
            ) : (
              <div className="inline-block max-w-full rounded-xl border border-neutral-900/10 bg-neutral-50 p-2">
                <img src={proofPreview} alt="Pratinjau bukti" className="max-h-48 rounded-lg bg-white object-contain" />
                <div className="mt-2 flex items-center justify-between gap-4 px-1 text-xs leading-4">
                  <span className="flex items-center gap-2 text-emerald-700">
                    <Check {...ico} />
                    Siap disimpan bersama transaksi
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveProof}
                    className="cursor-pointer font-medium text-neutral-600 underline hover:text-neutral-900"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            )}
          </div>

          <button type="submit" className={`${btnPrimary} w-full`}>
            Simpan ke rekap
          </button>
        </form>
      </div>
    </div>
  );
}
