import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  Eye,
  Paperclip,
  Plus,
  Trash2,
  Wallet,
  X
} from 'lucide-react';
import { formatRupiah } from '../data/mockData';
import { useTiltSurface } from '../hooks/useTiltSurface';
import { useMouseGlow } from '../hooks/useMouseGlow';
import { useSmoothResize } from '../hooks/useSmoothResize';
import ColumnFilterSelect from '../components/ui/ColumnFilterSelect';
import EmptyNote from '../components/ui/EmptyNote';
import TxSearch from '../components/ui/TxSearch';
import {
  btnSecondary,
  card,
  ico,
  iconBtn,
  methodIcon,
  methodLabel,
  motion,
  ShiftTag
} from '../lib/ui';

// ── Animasi masuk halaman (sama dengan Dashboard: EASE_OUT + stagger) ─────────
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const BASE_DELAY = 150;
const STAGGER = 70;
const ENTER_MS = 700;
const SETTLE_MS = BASE_DELAY + 6 * STAGGER + ENTER_MS + 300; // setelah ini style animasi dilepas
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Tombol di atas latar hero (sama dengan kontrol hero di Dashboard)
const heroBtn =
  'inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--surface-app)] px-4 text-sm font-semibold text-[var(--text-main)] shadow-[var(--shadow-inset-hero)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-inset-hero-hover)] active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[color:var(--ring-on-dark)] motion-reduce:transition-none';
const heroBtnGhost =
  'inline-flex min-h-11 items-center gap-2 rounded-2xl px-3 text-sm font-medium text-[var(--text-inverse)] outline-none transition-all duration-200 hover:bg-[var(--glass-line)] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[color:var(--ring-on-dark)] motion-reduce:transition-none';

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

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--royal-500)]';
const linkBtn = `cursor-pointer rounded-md px-1 py-0.5 text-[13px] font-medium underline underline-offset-2 ${motion} ${focusRing}`;

const SHIFT_OPTIONS = [
  { value: 'pagi', label: 'Pagi' },
  { value: 'siang', label: 'Siang' }
];
const METHOD_OPTIONS = [
  { value: 'tunai', label: 'Tunai' },
  { value: 'qris', label: 'QRIS' },
  { value: 'transfer', label: 'Transfer' }
];
const TYPE_OPTIONS = [
  { value: 'pemasukan', label: 'Pemasukan' },
  { value: 'pengeluaran', label: 'Pengeluaran' }
];

// Metadata kolom: teks untuk filter, fungsi sort, dan tampilan (sama seperti Dashboard).
const COLUMNS = [
  {
    key: 'waktu',
    label: 'Waktu dan shift',
    text: (t) => t.date || '',
    sort: (t) => `${t.date || ''} ${t.time || ''}`
  },
  { key: 'keterangan', label: 'Keterangan', noSort: true, noFilter: true },
  {
    key: 'metode',
    label: 'Metode',
    text: (t) => methodLabel[t.paymentMethod || 'tunai'] || t.paymentMethod || '',
    sort: (t) => methodLabel[t.paymentMethod || 'tunai'] || t.paymentMethod || ''
  },
  {
    key: 'nominal',
    label: 'Nominal',
    noFilter: true,
    align: 'right',
    sort: (t) => Number(t.amount || 0) * (t.type === 'pengeluaran' ? -1 : 1)
  },
  {
    key: 'bukti',
    label: 'Bukti',
    align: 'center',
    text: (t) => (t.proofUrl ? 'Terlampir' : 'Tanpa nota'),
    sort: (t) => (t.proofUrl ? 'Terlampir' : 'Tanpa nota')
  },
  { key: 'aksi', label: 'Aksi', noSort: true, noFilter: true, align: 'center', ownerOnly: true }
];

const alignClass = (col) =>
  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '';
// Kolom rata kiri hanya diberi jarak kanan (seperti tabel Dashboard); kolom rata kanan/tengah diberi jarak dua sisi.
const padClass = (col) => (col.align ? 'px-3' : 'pr-3');

export default function HistoryPage({
  transactions,
  userRole = 'Pemilik',
  onDeleteTransaction,
  onResetMockData,
  onNavigateToForm
}) {
  const [filterType, setFilterType] = useState('semua');
  const [filterMethod, setFilterMethod] = useState('semua');
  const [filterShift, setFilterShift] = useState('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProofModal, setSelectedProofModal] = useState(null);
  const [modalShown, setModalShown] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [columnFilters, setColumnFilters] = useState({});
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const closeTimer = useRef(null);
  const dialogTitleId = useId();

  // Animasi masuk: dua frame agar keadaan tersembunyi sempat ter-paint sebelum transisi
  const [ready, setReady] = useState(prefersReducedMotion);
  const [settled, setSettled] = useState(prefersReducedMotion);

  // Tilt kartu kaca baru aktif setelah animasi masuk selesai (agar tidak bentrok dengan reveal)
  const tiltNet = useTiltSurface({ enabled: settled });
  const tiltTrx = useTiltSurface({ enabled: settled });
  const tiltNota = useTiltSurface({ enabled: settled });
  const heroGlow = useMouseGlow({ size: 420, opacity: 0.12 });
  useSmoothResize(tiltNet.ref);
  useSmoothResize(tiltTrx.ref);
  useSmoothResize(tiltNota.ref);

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
  // Bar tumbuh dari 0 (transisi lebar tetap aktif agar perubahan filter juga mulus)
  const grow = (pct, i, nonZero = pct > 0) => ({
    width: `${ready ? Math.max(pct, nonZero ? 2 : 0) : 0}%`,
    transition: `width 900ms ${EASE_OUT} ${settled ? 0 : BASE_DELAY + i * STAGGER + 350}ms`
  });

  const q = searchQuery.trim().toLowerCase();
  const baseFiltered = useMemo(
    () =>
      transactions.filter((trx) => {
        const matchType = filterType === 'semua' || trx.type === filterType;
        const matchMethod = filterMethod === 'semua' || (trx.paymentMethod || 'tunai') === filterMethod;
        const matchShift = filterShift === 'semua' || trx.shift === filterShift;
        const haystack = [trx.title, trx.category, trx.id, trx.referenceId]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return matchType && matchMethod && matchShift && (!q || haystack.includes(q));
      }),
    [transactions, filterType, filterMethod, filterShift, q]
  );

  const visibleColumns = useMemo(
    () => COLUMNS.filter((col) => !col.ownerOnly || userRole === 'Pemilik'),
    [userRole]
  );

  // Opsi tiap kolom diambil dari data setelah filter cepat, sebelum filter kolom diterapkan.
  const columnOptions = useMemo(() => {
    const options = {};
    visibleColumns.forEach((col) => {
      if (col.noFilter || typeof col.text !== 'function') return;
      options[col.key] = [
        ...new Set(baseFiltered.map((t) => String(col.text(t) ?? '').trim()).filter(Boolean))
      ].sort((a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' }));
    });
    return options;
  }, [baseFiltered, visibleColumns]);

  const filteredTransactions = useMemo(() => {
    const queries = Object.entries(columnFilters)
      .map(([key, value]) => [key, String(value || '').trim()])
      .filter(([, value]) => value);

    let rows = queries.length
      ? baseFiltered.filter((t) =>
        queries.every(([key, value]) => visibleColumns.find((col) => col.key === key)?.text(t) === value)
      )
      : baseFiltered;

    if (!sort.key) return rows;
    const col = visibleColumns.find((c) => c.key === sort.key);
    if (!col || col.noSort || typeof col.sort !== 'function') return rows;

    return [...rows].sort((a, b) => {
      const av = col.sort(a);
      const bv = col.sort(b);
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'id', { sensitivity: 'base' });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [baseFiltered, columnFilters, sort, visibleColumns]);

  // Ringkasan hero mengikuti hasil filter, jadi angka dan bar ikut bergerak saat filter diubah.
  const stats = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    let masukCount = 0;
    let withProof = 0;
    filteredTransactions.forEach((t) => {
      const amt = Number(t.amount || 0);
      if (t.type === 'pengeluaran') keluar += amt;
      else {
        masuk += amt;
        masukCount += 1;
      }
      if (t.proofUrl) withProof += 1;
    });
    const count = filteredTransactions.length;
    return {
      masuk,
      keluar,
      net: masuk - keluar,
      count,
      masukCount,
      keluarCount: count - masukCount,
      withProof,
      missing: count - withProof,
      pctKeluar: masuk > 0 ? Math.min(100, Math.round((keluar / masuk) * 100)) : 0,
      pctShown: transactions.length ? Math.round((count / transactions.length) * 100) : 0,
      pctNota: count ? Math.round((withProof / count) * 100) : 0
    };
  }, [filteredTransactions, transactions.length]);

  const toggleSort = (key) => {
    const col = COLUMNS.find((c) => c.key === key);
    if (!col || col.noSort || typeof col.sort !== 'function') return;
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  const clearColumnFilter = (key) =>
    setColumnFilters((prev) => ({ ...prev, [key]: '' }));

  // Modal bukti: buka/tutup dengan fade + scale (tetap ter-mount selama animasi keluar).
  const openProof = (src) => {
    clearTimeout(closeTimer.current);
    setSelectedProofModal(src);
  };

  const closeProof = useCallback(() => {
    setModalShown(false);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setSelectedProofModal(null), prefersReducedMotion() ? 0 : 200);
  }, []);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!selectedProofModal) {
      setModalShown(false);
      return undefined;
    }
    let id2;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setModalShown(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [selectedProofModal]);

  // Modal bukti: Escape, fokus terjebak di dialog, dan fokus dikembalikan setelah tutup.
  useEffect(() => {
    if (!selectedProofModal) return undefined;
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeProof();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [selectedProofModal, closeProof]);

  const activeChips = Object.entries(columnFilters).filter(([, value]) => value);

  const filterText = (key) => COLUMNS.find((col) => col.key === key)?.label || key;

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
        aria-label="Riwayat transaksi"
      >
        <div className="pointer-events-none absolute -bottom-48 -left-32 h-80 w-80 rounded-full bg-[var(--glass-soft)]" />
        {/* Glow latar mengikuti mouse; CSS variable diwariskan dari <section>. */}
        <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 rounded-[22px]" />

        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-stretch">
          <div className="relative z-10 flex flex-col gap-6">
            <div style={reveal(1, 10)}>
              <h1 className="break-words text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl xl:text-5xl">
                Riwayat transaksi
              </h1>
              <p className="mt-3 max-w-md text-sm leading-snug text-[color:var(--glass-text-soft)]">
                Kas masuk dan keluar menurut metode pembayaran dan shift
              </p>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-3" style={reveal(1, 10)}>
              {onNavigateToForm && (
                <button type="button" onClick={onNavigateToForm} className={heroBtn}>
                  <Plus {...ico} />
                  Catat pendapatan
                </button>
              )}
              {userRole === 'Pemilik' &&
                (confirmReset ? (
                  <>
                    <span className="text-sm text-[color:var(--glass-text-soft)]">Kembalikan ke data contoh?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onResetMockData();
                        setConfirmReset(false);
                      }}
                      className={heroBtn}
                    >
                      Ya, reset
                    </button>
                    <button type="button" onClick={() => setConfirmReset(false)} className={heroBtnGhost}>
                      Batal
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmReset(true)} className={heroBtnGhost}>
                    Reset data contoh
                  </button>
                ))}
            </div>
          </div>

          <div className="relative">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -right-14 -top-16 h-56 w-56 rounded-full bg-[var(--glass-line)]" />
              <div className="absolute -bottom-20 left-6 h-52 w-52 rounded-full bg-[var(--glass-soft)]" />
            </div>
            <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[34rem] xl:w-[40rem]">
              {/* Ringkasan mengikuti hasil filter, jadi angka dan bar ikut bergerak saat filter diubah */}
              <div
                ref={tiltNet.ref}
                onMouseMove={tiltNet.onMouseMove}
                onMouseLeave={tiltNet.onMouseLeave}
                className="group flex flex-col rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-subtle)] p-4 shadow-[var(--shadow-glass-card)] backdrop-blur-xl"
                style={reveal(2, 12)}
              >
                <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                  <Wallet className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                  Kas bersih
                </p>
                <p className="mt-2 break-words text-2xl font-semibold tracking-tight tabular-nums">
                  {stats.net < 0 ? '−' : ''}
                  {formatRupiah(Math.abs(stats.net))}
                </p>
                <div className="mt-auto pt-3">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-line)]"
                    role="progressbar"
                    aria-valuenow={stats.pctKeluar}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Pengeluaran ${stats.pctKeluar} persen dari pemasukan`}
                  >
                    <div className="h-full rounded-full bg-[var(--text-inverse)]" style={grow(stats.pctKeluar, 2)} />
                  </div>
                  <p className="mt-1.5 text-xs text-[color:var(--glass-text-soft)]">
                    {stats.masuk > 0 ? `Keluar ${stats.pctKeluar}% dari pemasukan` : 'Belum ada pemasukan'}
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
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                  {stats.count}
                  <span className="text-base text-[color:var(--glass-text-soft)]">/{transactions.length}</span>
                </p>
                <div className="mt-auto pt-3">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-line)]"
                    role="progressbar"
                    aria-valuenow={stats.pctShown}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Menampilkan ${stats.pctShown} persen dari seluruh transaksi`}
                  >
                    <div className="h-full rounded-full bg-[var(--text-inverse)]" style={grow(stats.pctShown, 3)} />
                  </div>
                  <p className="mt-1.5 text-xs text-[color:var(--glass-text-soft)]">
                    {stats.masukCount} masuk · {stats.keluarCount} keluar
                  </p>
                </div>
              </div>

              <div
                ref={tiltNota.ref}
                onMouseMove={tiltNota.onMouseMove}
                onMouseLeave={tiltNota.onMouseLeave}
                className="group flex flex-col rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-subtle)] p-4 shadow-[var(--shadow-glass-card)] backdrop-blur-xl"
                style={reveal(4, 12)}
              >
                <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                  <Paperclip className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                  Bukti nota
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                  {stats.withProof}
                  <span className="text-base text-[color:var(--glass-text-soft)]">/{stats.count}</span>
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
                    <div className="h-full rounded-full bg-[var(--text-inverse)]" style={grow(stats.pctNota, 4)} />
                  </div>
                  <p
                    className={`mt-1.5 flex items-center gap-1.5 text-xs ${stats.missing ? 'font-medium text-[var(--text-inverse)]' : 'text-[color:var(--glass-text-soft)]'
                      }`}
                  >
                    {stats.missing > 0 && (
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--amber-400)]" aria-hidden="true" />
                    )}
                    {stats.missing ? `${stats.missing} transaksi belum ada nota` : 'Semua nota lengkap'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={reveal(5)}>
        <CardHeader
          title="Daftar transaksi"
          hint={`${filteredTransactions.length} dari ${transactions.length} transaksi`}
          right={
            <TxSearch
              value={searchQuery}
              onChange={setSearchQuery}
              label="Cari transaksi"
              placeholder="Cari transaksi atau ID"
            />
          }
        />

        {/* Filter cepat */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <GlowPill field>
            <ColumnFilterSelect
            label="shift"
            ariaLabel="Filter shift"
            value={filterShift === 'semua' ? '' : filterShift}
            options={SHIFT_OPTIONS}
            onChange={(value) => setFilterShift(value || 'semua')}
            size="md"
          />
          </GlowPill>
          <GlowPill field>
            <ColumnFilterSelect
            label="metode"
            ariaLabel="Filter metode"
            value={filterMethod === 'semua' ? '' : filterMethod}
            options={METHOD_OPTIONS}
            onChange={(value) => setFilterMethod(value || 'semua')}
            size="md"
          />
          </GlowPill>
          <GlowPill field>
            <ColumnFilterSelect
            label="jenis kas"
            ariaLabel="Filter jenis kas"
            value={filterType === 'semua' ? '' : filterType}
            options={TYPE_OPTIONS}
            onChange={(value) => setFilterType(value || 'semua')}
            size="md"
          />
          </GlowPill>
        </div>

        {activeChips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter kolom aktif">
            {activeChips.map(([key, value]) => (
              <GlowPill key={key} radius="9999px" press className="inline-flex">
              <button
                type="button"
                onClick={() => clearColumnFilter(key)}
                aria-label={`Hapus filter ${filterText(key)}`}
                className="group inline-flex items-center gap-1.5 rounded-full border border-[color:var(--royal-300)] bg-[var(--surface-muted)] py-1 pl-3 pr-2 text-xs font-medium text-[var(--royal-600)] transition-all duration-150 hover:bg-[var(--surface-hover)] active:scale-95 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--royal-500)]"
              >
                <span className="font-normal text-[var(--text-muted)]">{filterText(key)}:</span>
                {value}
                <X className={`h-3 w-3 ${ICON_HOVER}`} aria-hidden="true" />
              </button>
              </GlowPill>
            ))}
            <button
              type="button"
              onClick={() => setColumnFilters({})}
              className={`rounded-md px-2 py-1 text-xs font-medium text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)] active:scale-95 motion-reduce:transition-none ${focusRing}`}
            >
              Reset semua
            </button>
          </div>
        )}

        <div className="mt-4">
          {filteredTransactions.length === 0 ? (
            <EmptyNote>Tidak ada transaksi yang cocok dengan filter atau kata kunci</EmptyNote>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <caption className="sr-only">Riwayat transaksi sesuai filter dan urutan terpilih</caption>
                <thead>
                  <tr className="text-xs text-[var(--text-muted)]">
                    {visibleColumns.map((col) => {
                      if (col.noSort) {
                        return (
                          <th key={col.key} scope="col" className={`py-2.5 font-normal ${padClass(col)} ${alignClass(col)}`}>
                            {col.label}
                          </th>
                        );
                      }
                      const active = sort.key === col.key;
                      const SortIcon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                      return (
                        <th
                          key={col.key}
                          scope="col"
                          aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                          className={`py-2.5 font-normal ${padClass(col)} ${alignClass(col)}`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(col.key)}
                            aria-label={`Urutkan berdasarkan ${col.label}`}
                            className={`group -mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] motion-reduce:transition-none ${col.align === 'right' ? 'flex-row-reverse' : ''
                              }`}
                          >
                            {col.label}
                            <SortIcon
                              aria-hidden="true"
                              className={`h-3 w-3 ${ICON_HOVER} ${active ? 'text-[var(--royal-600)]' : 'opacity-50'}`}
                            />
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                  <tr className="text-xs">
                    {visibleColumns.map((col) => (
                      <th key={col.key} scope="col" className={`pb-2 font-normal ${padClass(col)} ${alignClass(col)}`}>
                        {col.noFilter ? null : (
                          <GlowPill field radius="0.5rem">
                            <ColumnFilterSelect
                              label={col.label.toLowerCase()}
                              value={columnFilters[col.key] || ''}
                              options={columnOptions[col.key] || []}
                              onChange={(value) =>
                                setColumnFilters((prev) => ({ ...prev, [col.key]: value }))
                              }
                            />
                          </GlowPill>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((trx) => {
                    const isExp = trx.type === 'pengeluaran';
                    const MethodIcon = methodIcon[trx.paymentMethod || 'tunai'] || methodIcon.tunai;
                    return (
                      <tr
                        key={trx.id}
                        className="group grid-l transition-colors duration-700 hover:bg-[var(--royal-50)] motion-reduce:transition-none"
                      >
                        <td className="whitespace-nowrap py-3 pr-3">
                          <div className="font-medium tabular-nums text-[var(--text-main)]">
                            {trx.date} <span className="font-normal text-[var(--text-muted)]">{trx.time || '-'}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-3">
                            <ShiftTag shift={trx.shift} />
                            <span className="font-mono text-xs text-[var(--text-muted)]">{trx.id}</span>
                          </div>
                        </td>

                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2 font-medium text-[var(--text-main)]">
                            <span>{trx.title}</span>
                            {trx.isDuplicate && (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--amber-100)] bg-[var(--amber-50)] px-1.5 py-0.5 text-xs font-normal leading-4 text-[var(--amber-700)]">
                                <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber-600)]" aria-hidden="true" />
                                Perlu ditinjau
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs leading-4 text-[var(--text-muted)]">
                            {trx.category}
                            {trx.referenceId ? (
                              <>
                                {' · Ref '}
                                <span className="font-mono">{trx.referenceId}</span>
                              </>
                            ) : null}
                          </div>
                        </td>

                        <td className="whitespace-nowrap py-3 pr-3 text-xs text-[var(--text-main)]">
                          <MethodIcon
                            {...ico}
                            className={`mr-1 -mt-0.5 inline-block h-3.5 w-3.5 align-middle text-[var(--royal-600)] ${ICON_HOVER}`}
                          />
                          {methodLabel[trx.paymentMethod || 'tunai'] || trx.paymentMethod}
                        </td>

                        <td
                          className={`whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums ${isExp ? 'text-[var(--cash-out)]' : 'text-[var(--text-main)]'
                            }`}
                        >
                          {isExp ? '−' : '+'} {formatRupiah(trx.amount)}
                        </td>

                        <td className="whitespace-nowrap px-3 py-3 text-center">
                          {trx.proofUrl ? (
                            <GlowPill press className="inline-flex">
                              <button
                                type="button"
                                onClick={() => openProof(trx.proofUrl)}
                                className={`${btnSecondary} group h-8 px-3`}
                              >
                                <Eye {...ico} className={iconCls()} />
                                Lihat
                              </button>
                            </GlowPill>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">Tanpa nota</span>
                          )}
                        </td>

                        {userRole === 'Pemilik' && (
                          <td className="whitespace-nowrap px-3 py-3 text-center">
                            {confirmDeleteId === trx.id ? (
                              <span className="inline-flex items-center gap-2 text-[13px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteTransaction(trx.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className={`${linkBtn} text-[var(--cash-out)] hover:bg-[var(--cash-out-light)]`}
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className={`${linkBtn} text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)]`}
                                >
                                  Batal
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(trx.id)}
                                className={`${iconBtn} group`}
                                aria-label={`Hapus transaksi ${trx.id}`}
                              >
                                <Trash2 {...ico} className={iconCls()} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Modal bukti ukuran penuh */}
      {selectedProofModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] p-4"
            style={{
              opacity: modalShown ? 1 : 0,
              transition: noMotion ? 'none' : 'opacity 180ms ease'
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeProof();
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              className={`${card} w-full max-w-lg p-4 shadow-[var(--shadow-popover-lg)]`}
              style={{
                transform: modalShown ? 'none' : 'translateY(8px) scale(0.95)',
                transition: noMotion ? 'none' : `transform 260ms ${EASE_OUT}`
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 id={dialogTitleId} className="text-base font-medium leading-6 text-[var(--text-main)]">
                  Bukti transaksi
                </h3>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={closeProof}
                  className={`${iconBtn} group`}
                  aria-label="Tutup"
                >
                  <X {...ico} className={iconCls()} />
                </button>
              </div>
              <div className="flex justify-center rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-2">
                <img
                  src={selectedProofModal}
                  alt="Bukti transaksi"
                  className="max-h-[70vh] rounded-lg bg-[var(--surface-card)] object-contain"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}