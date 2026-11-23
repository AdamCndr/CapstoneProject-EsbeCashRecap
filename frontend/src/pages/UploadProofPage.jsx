import { useState } from 'react';
import { ArrowRight, Check, Upload } from 'lucide-react';
import {
  btnGhost,
  btnPrimary,
  card,
  field,
  ico,
  label,
  motion,
  Notice,
  PageHeader
} from '../lib/ui';

export default function UploadProofPage({ transactions, onUpdateProof, onNavigateToHistory }) {
  const [selectedTrxId, setSelectedTrxId] = useState(transactions[0]?.id || '');
  const [proofPreview, setProofPreview] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'File harus berupa gambar (JPG atau PNG)' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProofPreview(reader.result);
      setFeedback({ type: '', message: '' });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProof = (e) => {
    e.preventDefault();
    if (!selectedTrxId) {
      setFeedback({ type: 'error', message: 'Pilih transaksi terlebih dahulu' });
      return;
    }
    if (!proofPreview) {
      setFeedback({ type: 'error', message: 'Pilih file gambar bukti' });
      return;
    }

    onUpdateProof(selectedTrxId, proofPreview);
    setFeedback({ type: 'success', message: `Bukti terlampir pada transaksi ${selectedTrxId}` });
    setProofPreview('');
    setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
  };

  return (
    <div>
      <PageHeader
        title="Unggah bukti"
        description="Lampirkan atau perbarui foto bukti pada transaksi yang sudah tercatat"
        actions={
          onNavigateToHistory && (
            <button type="button" onClick={onNavigateToHistory} className={btnGhost}>
              Lihat riwayat
              <ArrowRight {...ico} />
            </button>
          )
        }
      />

      <div className={`${card} p-6 sm:p-8`}>
        {feedback.message && (
          <Notice kind={feedback.type === 'success' ? 'success' : 'error'} className="mb-6">
            {feedback.message}
          </Notice>
        )}

        {transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-12 text-center text-sm text-neutral-600">
            Belum ada transaksi. Catat transaksi dulu di menu Catat Pendapatan
          </div>
        ) : (
          <form onSubmit={handleSaveProof} className="space-y-6">
            <div>
              <label htmlFor="trx" className={label}>
                Transaksi tujuan
              </label>
              <select
                id="trx"
                value={selectedTrxId}
                onChange={(e) => setSelectedTrxId(e.target.value)}
                className={`${field} cursor-pointer`}
              >
                {transactions.map((trx) => (
                  <option key={trx.id} value={trx.id}>
                    {trx.id} · {trx.title} ({trx.date})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className={label}>Foto bukti pembayaran</p>

              {!proofPreview ? (
                <div>
                  <input
                    type="file"
                    id="uploadProofDirect"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor="uploadProofDirect"
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center hover:border-blue-800 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-800 ${motion}`}
                  >
                    <Upload size={20} strokeWidth={1.5} className="text-neutral-500" aria-hidden="true" />
                    <span className="text-sm font-medium text-neutral-900">Pilih foto nota atau struk</span>
                    <span className="text-xs text-neutral-500">JPG atau PNG</span>
                  </label>
                </div>
              ) : (
                <div className="inline-block max-w-full rounded-xl border border-neutral-900/10 bg-neutral-50 p-2">
                  <img src={proofPreview} alt="Pratinjau bukti" className="max-h-56 rounded-lg bg-white object-contain" />
                  <div className="mt-2 flex items-center justify-between gap-4 px-1 text-xs leading-4">
                    <span className="flex items-center gap-2 text-emerald-700">
                      <Check {...ico} />
                      Foto siap diunggah
                    </span>
                    <button
                      type="button"
                      onClick={() => setProofPreview('')}
                      className="cursor-pointer font-medium text-neutral-600 underline hover:text-neutral-900"
                    >
                      Ganti
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className={`${btnPrimary} w-full`}>
              Simpan lampiran
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
