import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Check, Paperclip, Upload } from 'lucide-react';
import { formatRupiah } from '../data/mockData';
import { useTimedMessage } from '../hooks/useTimedMessage';
import { useTiltSurface } from '../hooks/useTiltSurface';
import { useMouseGlow } from '../hooks/useMouseGlow';
import { useSmoothResize } from '../hooks/useSmoothResize';
import ColumnFilterSelect from '../components/ui/ColumnFilterSelect';
import EmptyNote from '../components/ui/EmptyNote';
import { btnPrimary, ico, label, Notice } from '../lib/ui';
import { extractTransactionProofRequest } from '../services/api';

// ── Animasi masuk halaman (sama dengan Dashboard: EASE_OUT + stagger) ─────────
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const BASE_DELAY = 150;
const STAGGER = 70;
const ENTER_MS = 700;
const SETTLE_MS = BASE_DELAY + 6 * STAGGER + ENTER_MS + 300; // setelah ini style animasi dilepas
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const LIST_LIMIT = 5;

// Tombol pil putih di atas latar hero (sama dengan kontrol hero di Dashboard)
const heroBtn =
  'inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--surface-app)] px-4 text-sm font-semibold text-[var(--text-main)] shadow-[var(--shadow-inset-hero)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-inset-hero-hover)] active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[color:var(--ring-on-dark)] motion-reduce:transition-none';

// Animasi hover icon: sama dengan halaman Transaksi/OCR. Dipasang di icon; elemen induknya harus punya class `group`.
const ICON_HOVER = 'transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none';
const iconCls = (extra = '') => `${ico?.className ?? 'h-4 w-4'} ${extra} ${ICON_HOVER}`;

// ── Pill: glow aksen mengikuti kursor saat hover; saat diklik glow mengembang jadi stroke penuh ──
// Glow digambar di wrapper (.glow-pill): ::after = cincin di tepi (stroke), ::before = halo tipis di luar.
//   field  : stroke penuh selama fokus / dropdown terbuka
//   active : stroke penuh selama state terpilih (menggantikan ring lama)
//   press  : stroke penuh hanya selama ditekan
const GLOW_CSS = `
@property --gr{syntax:'<length>';inherits:false;initial-value:150px}
.glow-pill{position:relative;isolation:isolate;border-radius:var(--pr,.75rem)}
.glow-pill::before,.glow-pill::after{content:'';position:absolute;inset:0;pointer-events:none;border-radius:inherit;opacity:0;transition:opacity 220ms ease}
.glow-pill::before{z-index:-1;background:radial-gradient(90px circle at var(--gx,50%) var(--gy,50%),color-mix(in srgb,var(--royal-500) 55%,transparent),transparent 70%);filter:blur(7px)}
.glow-pill::after{--gr:150px;z-index:2;padding:1px;transition:opacity 220ms ease,padding 300ms ease,--gr 1200ms cubic-bezier(.3,.7,.3,1);background:radial-gradient(var(--gr) circle at var(--gx,50%) var(--gy,50%),var(--royal-500) calc(var(--gr)*.4),color-mix(in srgb,var(--royal-400) 45%,transparent) calc(var(--gr)*.62),transparent calc(var(--gr)*.8));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.glow-pill:hover::before{opacity:.55}
.glow-pill:hover::after{opacity:1}
.glow-pill.glow-press:active::after,.glow-pill.is-active::after{opacity:1;--gr:calc(var(--gd,3000px)*2.6)}
.glow-pill.is-active::after{padding:2px}
.glow-field:focus-within::after,.glow-field:has(:is(button[aria-haspopup],button[aria-expanded],[role="combobox"])[aria-expanded="true"])::after{opacity:1;--gr:calc(var(--gd,3000px)*2.6);padding:2px}
.glow-pill :is(button[aria-haspopup],button[aria-expanded],[role="combobox"]){background-color:var(--surface-card)!important;border-radius:var(--pr,.75rem)!important}
.glow-pill :is(button[aria-haspopup],button[aria-expanded],[role="combobox"]):not([aria-expanded="true"]):not(:focus){border:1px solid var(--border-default)!important;box-shadow:none!important}
.glow-field :is(button[aria-haspopup],button[aria-expanded],[role="combobox"])[aria-expanded="true"],.glow-field :is(button[aria-haspopup],button[aria-expanded],[role="combobox"]):focus{border:1px solid transparent!important;box-shadow:none!important;outline:none!important}
@media (hover:none){.glow-pill::before,.glow-pill:not(.is-active):not(.glow-press:active):not(.glow-field:focus-within)::after{display:none}}
@media (prefers-reduced-motion:reduce){.glow-pill::before,.glow-pill::after{transition:none}}
`;

function trackGlow(e) {
  const el = e.currentTarget;
  // Saat sudah aktif/fokus, titik pusat dikunci di titik klik supaya stroke penuh tidak bergeser mengikuti kursor.
  if (el.matches('.glow-field:focus-within, .is-active')) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--gx', `${e.clientX - r.left}px`);
  el.style.setProperty('--gy', `${e.clientY - r.top}px`);
}

// Klik: simpan titik klik + jarak ke sudut terjauh, supaya glow mengembang sampai menutup SELURUH keliling (full stroke).
function pressGlow(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  el.style.setProperty('--gx', `${x}px`);
  el.style.setProperty('--gy', `${y}px`);
  el.style.setProperty('--gd', `${Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y))}px`);
}

function GlowPill({ radius = '0.75rem', className = '', field = false, active = false, press = false, children }) {
  return (
    <div
      className={`glow-pill ${field ? 'glow-field' : ''} ${active ? 'is-active' : ''} ${press ? 'glow-press' : ''} ${className}`}
      style={{ '--pr': radius }}
      onMouseMove={trackGlow}
      onPointerDown={pressGlow}
    >
      {children}
    </div>
  );
}

// Skala tipografi kartu (seragam dengan Dashboard):
//   judul 18px semibold · subjudul 14px muted
function CardHeader({ title, hint, right }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-[11rem] flex-1">
        <h2 className="text-lg font-semibold leading-snug text-[var(--text-main)]">{title}</h2>
        {hint && <p className="mt-1 text-sm leading-snug text-[var(--text-muted)]">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export default function UploadProofPage({ transactions, onUpdateProof, onNavigateToHistory, initialTransactionId }) {
  const [selectedId, setSelectedId] = useState(initialTransactionId || transactions[0]?.id || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [proofPreview, setProofPreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [previewShown, setPreviewShown] = useState(false);
  const [dragging, setDragging] = useState(false);
  const {
    message: feedback,
    showMessage: showFeedback,
    clearMessage: clearFeedback
  } = useTimedMessage({ type: '', message: '' }, 4000);

  // Animasi masuk: dua frame agar keadaan tersembunyi sempat ter-paint sebelum transisi
  const [ready, setReady] = useState(prefersReducedMotion);
  const [settled, setSettled] = useState(prefersReducedMotion);

  // Tilt kartu kaca baru aktif setelah animasi masuk selesai (agar tidak bentrok dengan reveal)
  const tiltNota = useTiltSurface({ enabled: settled });
  const tiltTrx = useTiltSurface({ enabled: settled });
  const heroGlow = useMouseGlow({ size: 420, opacity: 0.12 });
  useSmoothResize(tiltNota.ref);
  useSmoothResize(tiltTrx.ref);

  useEffect(() => {
    if (settled) return undefined;
    let id2;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setReady(true));
    });
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fade + naik halus. Setelah selesai, style dilepas agar transisi/hover CSS asli kembali berlaku.
  const reveal = (i, y = 18) => {
    if (settled) return undefined;
    const d = BASE_DELAY + i * STAGGER;
    return {
      opacity: ready ? 1 : 0,
      transform: ready ? 'none' : `translateY(${y}px)`,
      transition: `opacity 650ms ease-out ${d}ms, transform ${ENTER_MS}ms ${EASE_OUT} ${d}ms`,
      willChange: 'opacity, transform'
    };
  };
  // Bar tumbuh dari 0 (transisi lebar tetap aktif agar perubahan data juga mulus)
  const grow = (pct, i, nonZero = pct > 0) => ({
    width: `${ready ? Math.max(pct, nonZero ? 2 : 0) : 0}%`,
    transition: `width 900ms ${EASE_OUT} ${settled ? 0 : BASE_DELAY + i * STAGGER + 350}ms`
  });

  // Dashboard membuka halaman ini dengan transaksi tertentu (tombol klip di "Perlu dicek").
  useEffect(() => {
    if (initialTransactionId) setSelectedId(initialTransactionId);
  }, [initialTransactionId]);

  // Pratinjau muncul dengan fade + naik halus
  useEffect(() => {
    if (!proofPreview) {
      setPreviewShown(false);
      return undefined;
    }
    let id2;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setPreviewShown(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [proofPreview]);

  // Kalau transaksi terpilih hilang (mis. dihapus), jatuh ke transaksi pertama.
  const selectedTrxId = transactions.some((t) => t.id === selectedId) ? selectedId : transactions[0]?.id || '';
  const selectedTrx = transactions.find((t) => t.id === selectedTrxId);

  const stats = useMemo(() => {
    const total = transactions.length;
    const missing = transactions.filter((t) => !t.proofUrl);
    const withProof = total - missing.length;
    const keluarCount = transactions.filter((t) => t.type === 'pengeluaran').length;
    return {
      total,
      missing,
      withProof,
      masukCount: total - keluarCount,
      keluarCount,
      pctNota: total ? Math.round((withProof / total) * 100) : 0,
      pctMasuk: total ? Math.round(((total - keluarCount) / total) * 100) : 0
    };
  }, [transactions]);

  const processFile = (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showFeedback({ type: 'error', message: 'File harus berupa gambar (JPG atau PNG)' });
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofPreview(reader.result);
      clearFeedback();
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files?.[0]);
  };

  const handleSaveProof = async (e) => {
    e.preventDefault();
    if (isUploading) return;
    if (!selectedTrxId) {
      showFeedback({ type: 'error', message: 'Pilih transaksi terlebih dahulu' });
      return;
    }
    if (!proofPreview || !selectedFile) {
      showFeedback({ type: 'error', message: 'Pilih file gambar bukti' });
      return;
    }

    setIsUploading(true);
    try {
      const res = await extractTransactionProofRequest(selectedFile);
      onUpdateProof(selectedTrxId, proofPreview);
      const extractMsg = res?.message ? ` — ${res.message}` : '';
      showFeedback({ type: 'success', message: `Bukti terlampir pada transaksi ${selectedTrxId}${extractMsg}` });
      setProofPreview('');
      setSelectedFile(null);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal mengunggah dan mengekstrak bukti transaksi';
      showFeedback({ type: 'error', message: msg });
    } finally {
      setIsUploading(false);
    }
  };

  const trxOptions = transactions.map((trx) => ({
    value: trx.id,
    label: `${trx.id} · ${trx.title} (${trx.date})`
  }));

  const noMotion = prefersReducedMotion();

  return (
    <div className="space-y-5">
      <style>{GLOW_CSS}</style>
      {/* HERO */}
      <section
        ref={heroGlow.ref}
        onMouseMove={heroGlow.onMouseMove}
        onMouseLeave={heroGlow.onMouseLeave}
        className="relative overflow-hidden rounded-[22px] p-5 text-[var(--text-inverse)] shadow-[var(--shadow-royal-hero)] lg:p-6"
        style={{ background: 'var(--grad-hero)', ...reveal(0) }}
        aria-label="Unggah bukti"
      >
        <div className="pointer-events-none absolute -bottom-48 -left-32 h-80 w-80 rounded-full bg-[var(--glass-soft)]" />
        {/* Glow latar mengikuti mouse; CSS variable diwariskan dari <section>. */}
        <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 rounded-[22px]" />

        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-stretch">
          <div className="relative z-10 flex flex-col gap-6">
            <div style={reveal(1, 10)}>
              <h1 className="break-words text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl xl:text-5xl">
                Unggah bukti
              </h1>
              <p className="mt-3 max-w-md text-sm leading-snug text-[color:var(--glass-text-soft)]">
                Lampirkan atau perbarui foto bukti pada transaksi yang sudah tercatat
              </p>
            </div>

            {onNavigateToHistory && (
              <div className="mt-auto flex flex-wrap items-center gap-3" style={reveal(1, 10)}>
                <button type="button" onClick={onNavigateToHistory} className={heroBtn}>
                  Lihat riwayat
                  <ArrowRight {...ico} />
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -right-14 -top-16 h-56 w-56 rounded-full bg-[var(--glass-line)]" />
              <div className="absolute -bottom-20 left-6 h-52 w-52 rounded-full bg-[var(--glass-soft)]" />
            </div>
            <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[24rem]">
              <div
                ref={tiltNota.ref}
                onMouseMove={tiltNota.onMouseMove}
                onMouseLeave={tiltNota.onMouseLeave}
                className="group flex flex-col rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-subtle)] p-4 shadow-[var(--shadow-glass-card)] backdrop-blur-xl"
                style={reveal(2, 12)}
              >
                <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                  <Paperclip className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                  Bukti nota
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                  {stats.withProof}
                  <span className="text-base text-[color:var(--glass-text-soft)]">/{stats.total}</span>
                </p>
                <div className="mt-auto pt-3">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-line)]"
                    role="progressbar"
                    aria-valuenow={stats.pctNota}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Kelengkapan bukti nota ${stats.pctNota}%`}
                  >
                    <div className="h-full rounded-full bg-[var(--text-inverse)]" style={grow(stats.pctNota, 2)} />
                  </div>
                  <p
                    className={`mt-1.5 flex items-center gap-1.5 text-xs ${stats.missing.length ? 'font-medium text-[var(--text-inverse)]' : 'text-[color:var(--glass-text-soft)]'
                      }`}
                  >
                    {stats.missing.length > 0 && (
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--amber-400)]" aria-hidden="true" />
                    )}
                    {stats.missing.length ? `${stats.missing.length} transaksi belum ada nota` : 'Semua nota lengkap'}
                  </p>
                </div>
              </div>

              <div
                ref={tiltTrx.ref}
                onMouseMove={tiltTrx.onMouseMove}
                onMouseLeave={tiltTrx.onMouseLeave}
                className="group flex flex-col rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-subtle)] p-4 shadow-[var(--shadow-glass-card)] backdrop-blur-xl"
                style={reveal(3, 12)}
              >
                <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                  <ArrowLeftRight className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                  Transaksi
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{stats.total}</p>
                <div className="mt-auto pt-3">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-line)]"
                    role="progressbar"
                    aria-valuenow={stats.pctMasuk}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Proporsi transaksi masuk ${stats.pctMasuk}%`}
                  >
                    <div className="h-full rounded-full bg-[var(--text-inverse)]" style={grow(stats.pctMasuk, 3)} />
                  </div>
                  <p className="mt-1.5 text-xs text-[color:var(--glass-text-soft)]">
                    {stats.masukCount} masuk · {stats.keluarCount} keluar
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {transactions.length === 0 ? (
        <section className="card" style={reveal(4)}>
          <CardHeader title="Lampirkan bukti" hint="Pilih transaksi, lalu unggah foto nota atau struk" />
          <EmptyNote>Belum ada transaksi. Catat transaksi dulu di menu Catat Pendapatan</EmptyNote>
        </section>
      ) : (
        <section className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          {/* FORM */}
          <div className="card" style={reveal(4)}>
            <CardHeader
              title="Lampirkan bukti"
              hint="Pilih transaksi, lalu unggah foto nota atau struk"
              right={
                selectedTrx ? (
                  <span className="tag h-fit">{selectedTrx.proofUrl ? 'Sudah ada bukti' : 'Belum ada bukti'}</span>
                ) : null
              }
            />

            {feedback.message && (
              <Notice kind={feedback.type === 'success' ? 'success' : 'error'} className="mb-5">
                {feedback.message}
              </Notice>
            )}

            <form onSubmit={handleSaveProof} className="space-y-5">
              <div>
                <label htmlFor="trx" className={label}>
                  Transaksi tujuan
                </label>
                <GlowPill field>
                  <ColumnFilterSelect
                    id="trx"
                    ariaLabel="Pilih transaksi tujuan"
                    label="Transaksi tujuan"
                    value={selectedTrxId}
                    options={trxOptions}
                    onChange={setSelectedId}
                    allowEmpty={false}
                    size="md"
                  />
                </GlowPill>
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
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                      className={`group flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center transition-all duration-200 ease-[var(--ease-out)] hover:border-[color:var(--royal-400)] hover:bg-[var(--surface-hover)] peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--royal-300)] active:scale-[0.99] motion-reduce:transition-none ${dragging
                          ? 'scale-[1.01] border-[color:var(--royal-400)] bg-[var(--surface-hover)]'
                          : 'border-[var(--border-default)] bg-[var(--surface-muted)]'
                        }`}
                    >
                      <span
                        className={`grid h-10 w-10 place-items-center rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:text-[var(--royal-600)] motion-reduce:transition-none ${dragging ? '-translate-y-1 text-[var(--royal-600)]' : 'text-[var(--text-muted)]'
                          }`}
                      >
                        <Upload
                          size={20}
                          strokeWidth={1.5}
                          className={`${ICON_HOVER} ${dragging ? 'scale-110 -rotate-6' : ''}`}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="text-sm font-medium text-[var(--text-main)]">
                        {dragging ? 'Lepas foto di sini' : 'Pilih foto nota atau struk'}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">atau seret ke sini · JPG atau PNG</span>
                    </label>
                  </div>
                ) : (
                  <div
                    className="group inline-block max-w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-2"
                    style={{
                      opacity: previewShown ? 1 : 0,
                      transform: previewShown ? 'none' : 'translateY(8px) scale(0.97)',
                      transition: noMotion ? 'none' : `opacity 180ms ease, transform 260ms ${EASE_OUT}`
                    }}
                  >
                    <img
                      src={proofPreview}
                      alt="Pratinjau bukti"
                      className="max-h-56 rounded-lg bg-[var(--surface-card)] object-contain"
                    />
                    <div className="mt-2 flex items-center justify-between gap-4 px-1 text-xs leading-4">
                      <span className="flex items-center gap-2 text-[var(--cash-in)]">
                        <Check {...ico} className={iconCls()} />
                        Foto siap diunggah
                      </span>
                      <button
                        type="button"
                        onClick={() => setProofPreview('')}
                        className="rounded-md font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-link)] active:scale-95 focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] motion-reduce:transition-none"
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
          </div>

          {/* PERLU DICEK */}
          <div className="card flex flex-col" style={reveal(5)}>
            <CardHeader
              title="Perlu dicek"
              hint="Transaksi tanpa bukti nota"
              right={stats.missing.length > 0 ? <span className="tag h-fit">{stats.missing.length} transaksi</span> : null}
            />
            {stats.missing.length === 0 ? (
              <div className="grid flex-1 place-items-center py-8 text-center">
                <div className="group">
                  <Paperclip className={`mx-auto h-6 w-6 text-[var(--cash-in)] ${ICON_HOVER}`} aria-hidden="true" />
                  <p className="mt-2 text-sm font-medium text-[var(--text-main)]">Semua transaksi punya nota</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">Tidak ada yang perlu dicek.</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {stats.missing.slice(0, LIST_LIMIT).map((t) => {
                  const active = t.id === selectedTrxId;
                  return (
                    <li key={t.id}>
                      <GlowPill radius="0.5rem" active={active} className="-mx-2 w-[calc(100%+1rem)]">
                      <button
                        type="button"
                        aria-pressed={active}
                        aria-label={`Pilih ${t.title} untuk diunggah buktinya`}
                        onClick={() => setSelectedId(t.id)}
                        className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left outline-none transition-all duration-200 hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-[0.99] motion-reduce:transition-none ${active ? 'bg-[var(--surface-muted)]' : ''
                          }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--text-main)]">{t.title}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {t.time || '-'} WIB · {t.id}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums ${t.type === 'pengeluaran' ? 'text-[var(--cash-out)]' : 'text-[var(--text-main)]'
                            }`}
                        >
                          {t.type === 'pengeluaran' ? '−' : '+'} {formatRupiah(t.amount)}
                        </span>
                      </button>
                      </GlowPill>
                    </li>
                  );
                })}
                {stats.missing.length > LIST_LIMIT && (
                  <li className="pt-2.5 text-xs text-[var(--text-muted)]">
                    +{stats.missing.length - LIST_LIMIT} transaksi lainnya, pilih lewat daftar transaksi tujuan
                  </li>
                )}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}