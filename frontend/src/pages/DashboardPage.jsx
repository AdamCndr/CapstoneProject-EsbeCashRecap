import { useState, useMemo, useEffect, useLayoutEffect, useRef, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Banknote,
  Landmark,
  Moon,
  Paperclip,
  QrCode,
  Sun,
  Sunset,
  Wallet
} from 'lucide-react';
import { useTiltSurface } from '../hooks/useTiltSurface';
import { useMouseGlow } from '../hooks/useMouseGlow';
import { useSmoothResize } from '../hooks/useSmoothResize';

// ── Animasi masuk halaman (selaras dengan Header: EASE_OUT + stagger) ─────────
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const BASE_DELAY = 150; // hero mulai tepat saat notch Header sedang turun
const STAGGER = 70;
const ENTER_MS = 700;
const SETTLE_MS = BASE_DELAY + 10 * STAGGER + ENTER_MS + 300; // setelah ini style animasi dilepas
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Warna background kontrol hero mengikuti token latar aplikasi.
const PAGE_BG = 'var(--surface-app)';

const rp = (n) => 'Rp ' + Math.abs(n || 0).toLocaleString('id-ID');

// Format ringkas untuk sumbu grafik: 250 rb, 1,2 jt
const rpShort = (n) => {
  const v = Math.abs(n || 0);
  if (v >= 1e6) return `${(v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (v >= 1e3) return `${Math.round(v / 1e3).toLocaleString('id-ID')} rb`;
  return String(v);
};

// Kolom tabel rincian transaksi: teks untuk filter, nilai untuk sorting.
const DETAIL_COLUMNS = [
  {
    key: 'waktu',
    label: 'Waktu',
    text: (t) => `${t.time || ''} ${t.id || ''}`,
    sort: (t) => t.time || '',
  },
  {
    key: 'keterangan',
    label: 'Keterangan',
    text: (t) => `${t.title || ''} ${t.notes || ''} ${t.referenceId || ''}`,
    noSort: true, // keterangan sengaja tidak bisa di-sort/filter
    noFilter: true,
  },
  {
    key: 'kategori',
    label: 'Kategori',
    text: (t) => t.category || (t.type === 'pengeluaran' ? 'Pengeluaran' : 'Umum'),
    sort: (t) => (t.category || (t.type === 'pengeluaran' ? 'Pengeluaran' : 'Umum')).toLowerCase(),
  },
  {
    key: 'shift',
    label: 'Shift',
    text: (t) => t.shift || '',
    sort: (t) => (t.shift || '').toLowerCase(),
  },
  {
    key: 'metode',
    label: 'Metode',
    text: (t) => t.paymentMethod || '',
    sort: (t) => (t.paymentMethod || '').toLowerCase(),
  },
  {
    key: 'bukti',
    label: 'Bukti',
    text: (t) => (t.proofUrl ? 'Terlampir' : 'Tanpa nota'),
    sort: (t) => (t.proofUrl ? 'Terlampir' : 'Tanpa nota'),
  },
  {
    key: 'nominal',
    label: 'Nominal',
    text: (t) => `${t.amount ?? ''}`,
    sort: (t) => Number(t.amount || 0) * (t.type === 'pengeluaran' ? -1 : 1),
  },
];

// Skala tipografi kartu (dipakai seragam):
//   judul 16px semibold · subjudul 13px muted · isi/baris data 14px · label & keterangan 12px
function CardHeader({ title, hint, right }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-5">
      <div className="min-w-[11rem] flex-1">
        <h2 className="text-lg font-semibold leading-snug text-[var(--text-main)]">{title}</h2>
        {hint && <p className="text-sm leading-snug text-[var(--text-muted)] mt-1">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

// ── Popover melayang (portal) — dipakai dropdown tanggal & filter kolom ──────
// Tetap ter-mount saat animasi keluar, jadi buka/tutup mulus (tanpa lompat).
function FloatingPanel({ open, anchorRef, onClose, children, className = '', matchWidth = false, panelId, role, ariaLabel }) {
  const panelRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let r2;
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setShown(true)); });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    setShown(false);
    const t = setTimeout(() => { setMounted(false); setPos(null); }, 200);
    return () => clearTimeout(t);
  }, [open]);

  const place = useCallback(() => {
    const a = anchorRef.current;
    const p = panelRef.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    const w = p.offsetWidth;
    const h = p.offsetHeight;
    const gap = 8;
    const spaceBelow = window.innerHeight - r.bottom - gap;
    const up = spaceBelow < h && r.top > spaceBelow;
    const top = Math.round(up ? Math.max(8, r.top - h - gap) : r.bottom + gap);
    const left = Math.round(Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - w - 8)));
    const minW = Math.round(r.width);
    setPos((o) => (o && o.top === top && o.left === left && o.up === up && o.minW === minW ? o : { top, left, up, minW }));
  }, [anchorRef]);

  useLayoutEffect(() => { if (mounted) place(); });

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); anchorRef.current?.focus(); }
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, onClose, place, anchorRef]);

  if (!mounted) return null;
  const up = !!pos?.up;
  return createPortal(
    <div
      ref={panelRef}
      id={panelId}
      role={role}
      aria-label={ariaLabel}
      className={`fixed z-[1000] ${className}`}
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        minWidth: matchWidth ? Math.max(pos?.minW ?? 0, 168) : undefined,
        opacity: shown && pos ? 1 : 0,
        transform: shown ? 'none' : `translateY(${up ? 8 : -8}px) scale(0.95)`,
        transformOrigin: up ? 'bottom left' : 'top left',
        transition: shown
          ? 'opacity 180ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)'
          : 'opacity 140ms ease, transform 180ms ease-in',
        pointerEvents: shown ? 'auto' : 'none',
        willChange: 'opacity, transform'
      }}
    >
      {children}
    </div>,
    document.body
  );
}

// ── Dropdown tanggal (kalender kustom) ───────────────────────────────────────
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const WEEKDAYS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const parseISO = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
};
const todayISO = () => {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth(), n.getDate());
};

const CAL_CSS = `
@keyframes cal-next{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
@keyframes cal-prev{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:none}}
@keyframes cal-zoom{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
.cal-next{animation:cal-next 260ms var(--ease-out)}
.cal-prev{animation:cal-prev 260ms var(--ease-out)}
.cal-zoom{animation:cal-zoom 220ms var(--ease-out)}
@media (prefers-reduced-motion:reduce){.cal-next,.cal-prev,.cal-zoom{animation:none}}
`;

function DateField({ value, onChange }) {
  const anchorRef = useRef(null);
  const kbdRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('days'); // 'days' | 'months'
  const [dir, setDir] = useState('none');
  const [view, setView] = useState(() => {
    const p = parseISO(value) || parseISO(todayISO());
    return { y: p.y, m: p.m };
  });
  const [focusISO, setFocusISO] = useState(value || todayISO());

  const sel = parseISO(value);
  const today = todayISO();
  const label = sel ? `${pad2(sel.d)}/${pad2(sel.m + 1)}/${sel.y}` : 'Semua tanggal';

  const close = useCallback(() => setOpen(false), []);
  const openPanel = (e) => {
    if (open) { close(); return; }
    const p = parseISO(value) || parseISO(todayISO());
    setView({ y: p.y, m: p.m });
    setFocusISO(value || todayISO());
    setMode('days');
    setDir('none');
    kbdRef.current = e.detail === 0; // dibuka via keyboard → fokus masuk ke kalender
    setOpen(true);
  };

  const shiftMonth = (delta) => {
    setDir(delta > 0 ? 'next' : 'prev');
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const shiftYear = (delta) => {
    setDir(delta > 0 ? 'next' : 'prev');
    setView((v) => ({ ...v, y: v.y + delta }));
  };
  const choose = (iso) => {
    onChange(iso);
    close();
    anchorRef.current?.focus();
  };

  const cells = useMemo(() => {
    const offset = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // minggu mulai Senin
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(view.y, view.m, 1 - offset + i);
      return { iso: toISO(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), out: d.getMonth() !== view.m };
    });
  }, [view]);

  const moveFocus = (days) => {
    const p = parseISO(focusISO);
    const nd = new Date(p.y, p.m, p.d + days);
    setFocusISO(toISO(nd.getFullYear(), nd.getMonth(), nd.getDate()));
    if (nd.getMonth() !== view.m || nd.getFullYear() !== view.y) {
      setDir(days > 0 ? 'next' : 'prev');
      setView({ y: nd.getFullYear(), m: nd.getMonth() });
    }
  };
  const onGridKey = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) { e.preventDefault(); kbdRef.current = true; moveFocus(step); }
  };

  useEffect(() => {
    if (!open || mode !== 'days' || !kbdRef.current) return undefined;
    let r2;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => document.querySelector(`[data-cal-day="${focusISO}"]`)?.focus({ preventScroll: true }));
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [open, mode, focusISO, view]);

  const navBtn = 'flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)]';

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        id="f-date"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Pilih tanggal, ${label}`}
        onClick={openPanel}
        style={{ background: PAGE_BG }}
        className={`group relative flex min-h-14 items-center gap-3 rounded-2xl px-4 py-1.5 shadow-[var(--shadow-inset-hero)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-inset-hero-hover)] active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[color:var(--ring-on-dark)] motion-reduce:transition-none ${open ? 'ring-2 ring-[color:var(--ring-on-dark)]' : ''}`}
      >
        <CalendarDays className="h-5 w-5 shrink-0 text-[var(--royal-600)] transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6" aria-hidden="true" />
        <span className="text-base font-semibold tabular-nums text-[var(--text-main)]">{label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      <FloatingPanel
        open={open}
        anchorRef={anchorRef}
        onClose={close}
        role="dialog"
        ariaLabel="Kalender"
        className="w-[19rem] rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3 shadow-[var(--shadow-popover-lg)]"
      >
        <style>{CAL_CSS}</style>
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => { setDir('zoom'); setMode((m) => (m === 'days' ? 'months' : 'days')); }}
            aria-label="Pilih bulan dan tahun"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-[var(--text-main)] transition-all duration-150 hover:bg-[var(--surface-muted)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)]"
          >
            {mode === 'days' ? `${MONTHS_ID[view.m]} ${view.y}` : view.y}
            <ChevronDown className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-300 ${mode === 'months' ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-0.5">
            <button type="button" aria-label={mode === 'days' ? 'Bulan sebelumnya' : 'Tahun sebelumnya'} onClick={() => (mode === 'days' ? shiftMonth(-1) : shiftYear(-1))} className={navBtn}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label={mode === 'days' ? 'Bulan berikutnya' : 'Tahun berikutnya'} onClick={() => (mode === 'days' ? shiftMonth(1) : shiftYear(1))} className={navBtn}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div key={`${mode}-${view.y}-${view.m}`} className={`cal-${dir}`}>
          {mode === 'days' ? (
            <>
              <div className="mb-1 grid grid-cols-7 place-items-center">
                {WEEKDAYS_ID.map((d) => (
                  <span key={d} className="flex h-8 w-9 items-center justify-center text-[11px] font-medium text-[var(--text-muted)]">{d}</span>
                ))}
              </div>
              <div role="grid" aria-label={`${MONTHS_ID[view.m]} ${view.y}`} onKeyDown={onGridKey} className="grid grid-cols-7 place-items-center gap-y-0.5">
                {cells.map((c) => {
                  const isSel = c.iso === value;
                  const isToday = c.iso === today;
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      data-cal-day={c.iso}
                      tabIndex={c.iso === focusISO ? 0 : -1}
                      aria-pressed={isSel}
                      aria-label={`${c.day} ${MONTHS_ID[parseISO(c.iso).m]} ${parseISO(c.iso).y}`}
                      onClick={() => choose(c.iso)}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm tabular-nums transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-90 motion-reduce:transition-none ${isSel
                          ? 'bg-[var(--royal-600)] font-semibold text-[var(--text-inverse)] shadow-md hover:scale-105'
                          : `${c.out ? 'text-[var(--text-muted-alt)]' : 'text-[var(--text-main)]'} hover:scale-110 hover:bg-[var(--surface-muted)] ${isToday ? 'font-semibold ring-1 ring-inset ring-[color:var(--royal-400)]' : ''}`
                        }`}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {MONTHS_ID.map((name, i) => {
                const isSel = i === view.m;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => { setDir('zoom'); setView((v) => ({ ...v, m: i })); setMode('days'); }}
                    className={`h-11 rounded-xl text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-95 motion-reduce:transition-none ${isSel ? 'bg-[var(--royal-600)] font-semibold text-[var(--text-inverse)] shadow-md' : 'text-[var(--text-main)] hover:scale-105 hover:bg-[var(--surface-muted)]'
                      }`}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-[var(--border-default)] pt-2 text-xs font-medium">
          <button type="button" onClick={() => choose('')} className="rounded-md px-2 py-1 text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)] active:scale-95">Hapus</button>
          <button type="button" onClick={() => choose(todayISO())} className="rounded-md px-2 py-1 text-[var(--text-link)] transition-all duration-150 hover:bg-[var(--surface-muted)] active:scale-95">Hari ini</button>
        </div>
      </FloatingPanel>
    </>
  );
}

// ── Filter shift: indikator geser mulus antar pilihan ────────────────────────
const SHIFT_OPTIONS = [
  ['semua', 'Semua', '06:00–21:00'],
  ['pagi', 'Pagi', '06:00–14:00'],
  ['siang', 'Siang', '14:00–21:00']
];

function ShiftSwitch({ value, onChange }) {
  const wrapRef = useRef(null);
  const btnRefs = useRef({});
  const [ind, setInd] = useState(null);
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const el = btnRefs.current[value];
    if (!el) return;
    const x = el.offsetLeft;
    const w = el.offsetWidth;
    setInd((prev) => {
      // Overshoot dibatasi ~4px (padding frame = 6px) saat menuju tombol di tepi,
      // supaya bounce tidak keluar frame. Menuju tombol tengah: bounce penuh.
      let y1 = prev?.y1 ?? 1.35;
      if (prev && prev.x !== x) {
        const edge = value !== 'pagi';
        const allowed = edge ? Math.min(0.04, 4 / Math.abs(x - prev.x)) : 0.04;
        y1 = Math.min(1.35, 1.2 + (allowed - 0.005) / 0.22);
      }
      return prev && prev.x === x && prev.w === w && prev.y1 === y1 ? prev : { x, w, y1 };
    });
  }, [value]);

  useLayoutEffect(() => {
    measure();
    const r = requestAnimationFrame(() => setReady(true)); // render pertama tanpa animasi
    return () => cancelAnimationFrame(r);
  }, [measure]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !wrapRef.current) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label="Filter shift"
      style={{ background: PAGE_BG }}
      className="relative inline-flex min-h-14 items-stretch gap-1 rounded-2xl p-1.5 shadow-[var(--shadow-inset-hero)]"
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1.5 left-0 top-1.5 rounded-xl bg-[var(--royal-600)] shadow-[var(--shadow-indicator)]"
        style={{
          width: ind?.w ?? 0,
          transform: `translateX(${ind?.x ?? 0}px)`,
          opacity: ind ? 1 : 0,
          transition: ready && !prefersReducedMotion()
            ? `transform 420ms cubic-bezier(0.34, ${(ind?.y1 ?? 1.35).toFixed(3)}, 0.64, 1), width 420ms cubic-bezier(0.34, ${(ind?.y1 ?? 1.35).toFixed(3)}, 0.64, 1)`
            : 'none'
        }}
      />
      {SHIFT_OPTIONS.map(([val, label, hint]) => {
        const active = value === val;
        return (
          <button
            key={val}
            ref={(el) => { btnRefs.current[val] = el; }}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(val)}
            className={`relative z-10 flex flex-col items-center justify-center rounded-xl px-3 py-1.5 leading-tight outline-none transition-[color,background-color,transform] duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] motion-reduce:transition-none sm:px-5 ${active ? 'text-[var(--text-inverse)]' : 'text-[var(--text-main)]'
              }`}
          >
            <span className="text-sm font-semibold">{label}</span>
            <span className={`whitespace-nowrap text-[11px] tabular-nums transition-colors duration-200 ${active ? 'text-[color:var(--glass-text-soft)]' : 'text-[var(--text-muted-alt)]'}`}>{hint}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Searchbar rincian transaksi ──────────────────────────────────────────────
function TxSearch({ value, onChange, label, placeholder }) {
  const id = useId();
  const inputRef = useRef(null);
  return (
    <div className="group relative w-full transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:w-80 sm:focus-within:w-96">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)] transition-all duration-200 group-hover:text-[var(--royal-600)] group-focus-within:scale-110 group-focus-within:text-[var(--royal-600)]"
      />
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="searchbox"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape' && value) { e.preventDefault(); onChange(''); } }}
        className="h-10 w-full rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] pl-10 pr-10 text-sm text-[var(--text-main)] outline-none transition-all duration-200 placeholder:text-[var(--text-muted)] hover:-translate-y-px hover:border-[color:var(--royal-400)] hover:shadow-[var(--shadow-search-hover)] focus:border-[color:var(--royal-400)] focus:shadow-[var(--shadow-search-focus)] focus:ring-2 focus:ring-[color:var(--royal-300)] active:scale-[0.99] motion-reduce:transition-none"
      />
      <button
        type="button"
        aria-label="Hapus pencarian"
        tabIndex={value ? 0 : -1}
        onClick={() => { onChange(''); inputRef.current?.focus(); }}
        className={`absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)] active:scale-90 ${value ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0'
          }`}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Dropdown filter untuk satu kolom tabel rincian transaksi (listbox kustom). */
function ColumnFilterSelect({ label, value, options, onChange }) {
  const id = useId();
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const items = useMemo(() => [{ v: '', t: `Semua ${label}` }, ...options.map((o) => ({ v: o, t: o }))], [label, options]);
  const selIdx = Math.max(0, items.findIndex((i) => i.v === (value || '')));
  const [active, setActive] = useState(selIdx);

  const close = useCallback(() => setOpen(false), []);
  const openMenu = () => { setActive(selIdx); setOpen(true); };
  const pick = (v) => { onChange(v); close(); btnRef.current?.focus(); };

  useEffect(() => {
    if (!open) return undefined;
    let r2;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        const l = listRef.current;
        const el = l?.querySelector(`[data-i="${active}"]`);
        if (!l || !el) return;
        if (el.offsetTop < l.scrollTop) l.scrollTop = el.offsetTop;
        else if (el.offsetTop + el.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = el.offsetTop + el.offsetHeight - l.clientHeight;
      });
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [open, active]);

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openMenu(); }
      return;
    }
    const last = items.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(last, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(items[active].v); }
    else if (e.key === 'Tab') close();
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-label={`Filter ${label}`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex h-8 w-full items-center justify-between gap-1 rounded-lg border bg-[var(--surface-card)] pl-2.5 pr-2 text-left text-xs outline-none transition-all duration-150 hover:border-[color:var(--royal-400)] hover:shadow-sm focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-[0.97] motion-reduce:transition-none ${open ? 'border-[color:var(--royal-400)] ring-2 ring-[color:var(--royal-300)]' : 'border-[var(--border-default)]'
          } ${value ? 'font-medium text-[var(--royal-600)]' : 'text-[var(--text-main)]'}`}
      >
        <span className="truncate">{value || `Semua ${label}`}</span>
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      <FloatingPanel
        open={open}
        anchorRef={btnRef}
        onClose={close}
        matchWidth
        className="max-w-[18rem] rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-1 shadow-[var(--shadow-popover-md)]"
      >
        <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={`Filter ${label}`} className="relative max-h-60 overflow-y-auto">
          {items.map((it, i) => {
            const isSel = it.v === (value || '');
            return (
              <li
                key={it.v || '__all'}
                id={`${id}-${i}`}
                role="option"
                aria-selected={isSel}
                data-i={i}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(it.v)}
                className={`flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs transition-colors duration-100 active:scale-[0.98] ${i === active ? 'bg-[var(--surface-muted)]' : ''
                  } ${isSel ? 'font-semibold text-[var(--royal-600)]' : 'text-[var(--text-main)]'}`}
              >
                <span className="truncate">{it.t}</span>
                <Check aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 transition-all duration-200 ${isSel ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
              </li>
            );
          })}
        </ul>
      </FloatingPanel>
    </div>
  );
}

// Ukur lebar elemen supaya grafik SVG digambar dalam piksel asli (teks tidak ikut membesar/mengecil)
function useElementWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Waktu sekarang dari jam perangkat (umumnya sudah disinkronkan ke server waktu internet oleh OS).
// State hanya berganti saat menit/tanggal berubah, jadi tidak ada render berlebihan.
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => {
      setNow((prev) => {
        const n = new Date();
        const same =
          n.getMinutes() === prev.getMinutes() &&
          n.getHours() === prev.getHours() &&
          n.getDate() === prev.getDate();
        return same ? prev : n;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// Info waktu hero: tanggal + jam saat ini, mengikuti zona waktu perangkat (mis. WIB)
function LiveClock({ icon: Icon }) {
  const now = useNow(1000);
  const date = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const tz =
    new Intl.DateTimeFormat('id-ID', { timeZoneName: 'short' }).formatToParts(now).find((x) => x.type === 'timeZoneName')?.value || '';
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-[color:var(--glass-text-soft)] tabular-nums">
      <Icon className="w-5 h-5 text-[var(--text-inverse)]" aria-hidden="true" />
      <span>{date}</span>
      <span aria-hidden="true" className="hidden sm:inline text-[color:var(--glass-text-dim)]">·</span>
      <time dateTime={now.toISOString()} className="whitespace-nowrap">
        {time} {tz}
      </time>
    </p>
  );
}

function EmptyNote({ children }) {
  return (
    <div className="py-8 text-center text-sm text-[var(--text-muted)] rounded-xl bg-[var(--surface-muted)]">
      {children}
    </div>
  );
}

function BarRow({ icon: Icon, label, value, pct, color, barStyle, rank, opacity = 1, interactive = false, active = false, dim = false, selected = false, onHover, onClick }) {
  const ip = interactive
    ? {
      role: 'button',
      tabIndex: 0,
      'aria-pressed': selected,
      onClick,
      onMouseEnter: () => onHover?.(true),
      onMouseLeave: () => onHover?.(false),
      onFocus: () => onHover?.(true),
      onBlur: () => onHover?.(false),
      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }
    }
    : {};
  return (
    <div
      {...ip}
      className={`${interactive ? '-mx-2 cursor-pointer rounded-lg px-2 py-1.5 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-[0.99] motion-reduce:transition-none' : ''} ${active || selected ? 'bg-[var(--surface-muted)]' : ''} ${selected ? 'ring-1 ring-[color:var(--royal-300)]' : ''} ${dim ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 min-w-0 text-[var(--text-main)]">
          {rank != null && (
            <span className="grid place-items-center w-5 h-5 shrink-0 rounded-md bg-[var(--surface-muted)] text-[11px] font-semibold text-[var(--text-muted)] tabular-nums">
              {rank}
            </span>
          )}
          {Icon && <Icon className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />}
          <span className="truncate">{label}</span>
        </span>
        <span className="whitespace-nowrap tabular-nums font-medium text-[var(--text-main)]">
          {rp(value)}
          <span className="ml-2 inline-block min-w-[2.25rem] text-right text-xs font-normal text-[var(--text-muted)]">{pct}%</span>
        </span>
      </div>
      <div
        className={`mt-2 h-2 rounded-full bg-[var(--surface-muted)] overflow-hidden transition-transform duration-200 ${active ? 'scale-y-150' : ''}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${pct}%`}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%`, ...barStyle, background: color, opacity }}
        />
      </div>
    </div>
  );
}

// Donut komposisi (segmen tumbuh saat `ready`). Segmen aktif disorot, angka tengah mengikuti.
function DonutChart({ rows, total, ready, delay = 0, label = 'Total', size = 144, stroke = 18, activeKey = null, onHover, onSelect }) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const visible = rows.filter((x) => x.val > 0);
  const gap = visible.length > 1 ? 3 : 0;
  const activeRow = activeKey ? visible.find((x) => x.key === activeKey) : null;
  let acc = 0;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90 overflow-visible" role="img" aria-label={`${label}: ${rp(total)}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-muted)" strokeWidth={stroke} />
        {visible.map((x, i) => {
          const len = (x.val / total) * C;
          const seg = Math.max(len - gap, 0.5);
          const offset = -acc;
          acc += len;
          const isActive = activeKey === x.key;
          return (
            <circle
              key={x.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={x.color}
              strokeWidth={isActive ? stroke + 4 : stroke}
              strokeDasharray={`${ready ? seg : 0} ${C}`}
              strokeDashoffset={offset}
              opacity={activeKey && !isActive ? 0.3 : 1}
              onMouseEnter={onHover ? () => onHover(x.key) : undefined}
              onMouseLeave={onHover ? () => onHover(null) : undefined}
              onClick={onSelect ? () => onSelect(x.key) : undefined}
              style={{
                cursor: onSelect ? 'pointer' : undefined,
                transition: `stroke-dasharray 900ms ${EASE_OUT} ${delay + i * 120}ms, opacity 200ms ease, stroke-width 200ms ease`
              }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center pointer-events-none">
        <span className="text-xs text-[var(--text-muted)]">{activeRow ? activeRow.label : label}</span>
        <span className="text-xl font-semibold tabular-nums text-[var(--text-main)] leading-tight">{rpShort(activeRow ? activeRow.val : total)}</span>
      </div>
    </div>
  );
}

// Smooth Bezier Curve generator
const sm = (p) => {
  if (!p || p.length === 0) return '';
  return p.reduce((d, [x, y], i) => {
    if (!i) return `M${x},${y}`;
    const [x0, y0] = p[i - 1];
    const c = (x0 + x) / 2;
    return d + `C${c},${y0} ${c},${y} ${x},${y}`;
  }, '');
};

const SHIFT_COLORS = {
  pagi: 'var(--amber-500)',  // --shift-pagi
  siang: 'var(--royal-600)' // --shift-siang
};

const METHOD_ICONS = {
  tunai: Banknote,
  qris: QrCode,
  transfer: Landmark
};

export default function DashboardPage({
  transactions = [],
  currentUser,
  searchQuery = '',
  selectedDate: controlledDate,
  onDateChange,
  onNavigate
}) {
  const [uncontrolledDate, setUncontrolledDate] = useState('2026-11-20');
  const selectedDate = controlledDate !== undefined ? controlledDate : uncontrolledDate;
  const setSelectedDate = onDateChange || setUncontrolledDate;
  const [selectedShift, setSelectedShift] = useState('semua'); // 'semua' | 'pagi' | 'siang'
  const [localSearch, setLocalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState({}); // filter per kolom tabel rincian
  const tableRef = useRef(null);
  const flashTimer = useRef(null);
  const [flashId, setFlashId] = useState(null); // baris tabel yang disorot sebentar
  const [hoverMethod, setHoverMethod] = useState(null);
  const [hoverKat, setHoverKat] = useState(null);
  const [hoverBar, setHoverBar] = useState(null);
  const [sort, setSort] = useState({ key: null, dir: 'asc' }); // sorting tabel rincian
  const [hoverIdx, setHoverIdx] = useState(null); // titik aktif di grafik arus kas
  const [tableOpen, setTableOpen] = useState(false); // ekspansi tabel data arus kas
  const [chartRef, chartW] = useElementWidth();

  // Animasi masuk: dua frame agar keadaan tersembunyi sempat ter-paint sebelum transisi
  const [ready, setReady] = useState(prefersReducedMotion);
  const [settled, setSettled] = useState(prefersReducedMotion);

  // Aksen hover tipis pada kartu metrik hero. Dimulai setelah animasi masuk selesai
  // agar transform reveal tidak bertabrakan dengan transform tilt.
  const tiltNet = useTiltSurface({ enabled: settled });
  const tiltTrx = useTiltSurface({ enabled: settled });
  const tiltNota = useTiltSurface({ enabled: settled });

  // Glow latar hero: jauh lebih lebar daripada glow kartu.
  const heroGlow = useMouseGlow({ size: 420, opacity: 0.12 });

  // Dua kartu bawah ikut berubah tinggi saat isinya berubah (mis. jumlah nota).
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
  const chartDelay = settled ? 0 : BASE_DELAY + 5 * STAGGER + 250;
  const drawStyle = (extra = 0) => ({
    strokeDashoffset: ready ? 0 : 1,
    transition: `stroke-dashoffset 1200ms ${EASE_OUT} ${chartDelay + extra}ms`
  });

  const activeSearch = (searchQuery || localSearch).toLowerCase().trim();

  // Sapaan dinamis berdasarkan jam perangkat (diperbarui otomatis tiap pergantian jam)
  const nowHour = useNow(30000).getHours();
  const { greeting, greetIcon: GreetIcon } = useMemo(() => {
    const h = nowHour;
    if (h >= 4 && h < 11) return { greeting: 'Selamat pagi', greetIcon: Sun };
    if (h >= 11 && h < 15) return { greeting: 'Selamat siang', greetIcon: Sun };
    if (h >= 15 && h < 18) return { greeting: 'Selamat sore', greetIcon: Sunset };
    return { greeting: 'Selamat malam', greetIcon: Moon };
  }, [nowHour]);

  // Nama lengkap pengguna (sesuaikan nama field dengan objek user di aplikasi lu)
  const fullName = currentUser?.fullName || currentUser?.full_name || currentUser?.name || 'Pak Bambang';

  // Transaksi pada tanggal terpilih
  const onDate = useMemo(() => {
    return transactions.filter((t) => !selectedDate || t.date === selectedDate);
  }, [transactions, selectedDate]);

  // Transaksi terfilter shift
  const filtered = useMemo(() => {
    return onDate.filter((t) => selectedShift === 'semua' || t.shift === selectedShift);
  }, [onDate, selectedShift]);

  // Transaksi terfilter pencarian untuk tabel
  const tableData = useMemo(() => {
    if (!activeSearch) return filtered;
    return filtered.filter((t) => {
      const matchText = `${t.id} ${t.title} ${t.category} ${t.paymentMethod} ${t.shift} ${t.notes || ''}`.toLowerCase();
      return matchText.includes(activeSearch);
    });
  }, [filtered, activeSearch]);

  // Opsi dropdown diambil dari data yang sedang tampil (sebelum filter kolom diterapkan)
  const columnOptions = useMemo(() => {
    const options = {};
    DETAIL_COLUMNS.forEach((col) => {
      if (col.noFilter) return;
      options[col.key] = [...new Set(tableData.map((t) => String(col.text(t) ?? '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' }));
    });
    return options;
  }, [tableData]);

  // Buang pilihan dropdown yang sudah tidak ada lagi setelah tanggal/pencarian berubah
  useEffect(() => {
    setColumnFilters((prev) => {
      const next = {};
      let changed = false;
      Object.entries(prev).forEach(([key, value]) => {
        if (value && columnOptions[key]?.includes(value)) next[key] = value;
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [columnOptions]);

  // Transaksi setelah filter dropdown per kolom dan sorting (tanpa mengubah data asli)
  const detailData = useMemo(() => {
    const queries = Object.entries(columnFilters)
      .map(([key, value]) => [key, String(value || '').trim()])
      .filter(([, value]) => value);

    let rows = queries.length
      ? tableData.filter((t) =>
        queries.every(([key, query]) => {
          const col = DETAIL_COLUMNS.find((c) => c.key === key);
          return col && !col.noFilter && String(col.text(t) ?? '').trim() === query;
        }),
      )
      : tableData;

    if (!sort.key) return rows;
    const col = DETAIL_COLUMNS.find((c) => c.key === sort.key);
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
  }, [tableData, columnFilters, sort]);

  const goToTable = () =>
    tableRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });

  // Klik elemen kartu → filter kolom tabel (klik lagi = lepas filter)
  const toggleFilter = (key, target) => {
    const want = String(target).toLowerCase();
    const match = (columnOptions[key] || []).find((o) => o.toLowerCase() === want);
    if (!match) return;
    const already = columnFilters[key] === match;
    setColumnFilters((prev) => ({ ...prev, [key]: already ? '' : match }));
    if (!already) goToTable();
  };

  const katFilterValue = (name) =>
    name === 'Lainnya' && !(columnOptions.kategori || []).some((o) => o.toLowerCase() === 'lainnya') ? 'Pengeluaran' : name;

  const reviewNota = (id) => {
    setLocalSearch('');
    setColumnFilters({ bukti: 'Tanpa nota' });
    setFlashId(id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 2400);
    goToTable();
  };

  const activeChips = Object.entries(columnFilters).filter(([, v]) => v);

  const toggleSort = (key) => {
    const col = DETAIL_COLUMNS.find((c) => c.key === key);
    if (!col || col.noSort) return;
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  };

  // Kalkulasi Keuangan
  const masuk = useMemo(() => filtered.filter((t) => t.type === 'pemasukan'), [filtered]);
  const keluar = useMemo(() => filtered.filter((t) => t.type === 'pengeluaran'), [filtered]);

  const totalMasuk = useMemo(() => masuk.reduce((s, x) => s + Number(x.amount || 0), 0), [masuk]);
  const totalKeluar = useMemo(() => keluar.reduce((s, x) => s + Number(x.amount || 0), 0), [keluar]);
  const totalBersih = totalMasuk - totalKeluar;

  // Breakdown Metode Pembayaran
  const tunaiVal = useMemo(
    () => masuk.filter((x) => (x.paymentMethod || '').toLowerCase() === 'tunai').reduce((s, x) => s + Number(x.amount || 0), 0),
    [masuk]
  );
  const qrisVal = useMemo(
    () => masuk.filter((x) => (x.paymentMethod || '').toLowerCase() === 'qris').reduce((s, x) => s + Number(x.amount || 0), 0),
    [masuk]
  );
  const transferVal = useMemo(
    () => masuk.filter((x) => (x.paymentMethod || '').toLowerCase() === 'transfer').reduce((s, x) => s + Number(x.amount || 0), 0),
    [masuk]
  );

  const pctTunai = totalMasuk > 0 ? Math.round((tunaiVal / totalMasuk) * 100) : 0;
  const pctNonTunai = totalMasuk > 0 ? 100 - pctTunai : 0;

  // Kelengkapan Bukti Nota
  const bkCount = filtered.filter((x) => !!x.proofUrl).length;
  const nbCount = filtered.length - bkCount;
  const pctNota = filtered.length > 0 ? Math.round((bkCount / filtered.length) * 100) : 0;
  const pctKeluar = totalMasuk > 0 ? Math.min(100, Math.round((totalKeluar / totalMasuk) * 100)) : 0;
  const pctMasukCount = filtered.length > 0 ? Math.round((masuk.length / filtered.length) * 100) : 0;

  // Pembanding kas bersih vs hari sebelumnya (shift filter ikut berlaku)
  const prevBersih = useMemo(() => {
    if (!selectedDate) return null;
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    const ds = d.toLocaleDateString('en-CA');
    const list = transactions.filter(
      (t) => t.date === ds && (selectedShift === 'semua' || t.shift === selectedShift)
    );
    if (list.length === 0) return null;
    return list.reduce(
      (s, t) => s + (t.type === 'pemasukan' ? 1 : t.type === 'pengeluaran' ? -1 : 0) * Number(t.amount || 0),
      0
    );
  }, [transactions, selectedDate, selectedShift]);
  const delta = prevBersih === null ? null : totalBersih - prevBersih;
  const deltaPct = delta === null || !prevBersih ? null : Math.round((Math.abs(delta) / Math.abs(prevBersih)) * 100);

  // Rekap Shift (Pagi & Siang)
  const shiftPagiMasuk = onDate.filter((t) => t.shift === 'pagi' && t.type === 'pemasukan').reduce((s, x) => s + Number(x.amount || 0), 0);
  const shiftPagiKeluar = onDate.filter((t) => t.shift === 'pagi' && t.type === 'pengeluaran').reduce((s, x) => s + Number(x.amount || 0), 0);
  const shiftSiangMasuk = onDate.filter((t) => t.shift === 'siang' && t.type === 'pemasukan').reduce((s, x) => s + Number(x.amount || 0), 0);
  const shiftSiangKeluar = onDate.filter((t) => t.shift === 'siang' && t.type === 'pengeluaran').reduce((s, x) => s + Number(x.amount || 0), 0);

  // Pemasukan per metode
  const methodRows = [
    { key: 'tunai', label: 'Tunai', icon: Banknote, val: tunaiVal, color: 'var(--amber-500)' },
    { key: 'qris', label: 'QRIS', icon: QrCode, val: qrisVal, color: 'var(--royal-600)' },
    { key: 'transfer', label: 'Transfer', icon: Landmark, val: transferVal, color: 'var(--chart-transfer)' }
  ].map((m) => ({ ...m, pct: totalMasuk > 0 ? Math.round((m.val / totalMasuk) * 100) : 0 }));

  // Pengeluaran per kategori (5 teratas, sisanya digabung)
  const kategoriRows = useMemo(() => {
    const map = {};
    keluar.forEach((t) => {
      const k = t.category || 'Lainnya';
      map[k] = (map[k] || 0) + Number(t.amount || 0);
    });
    const sorted = Object.entries(map)
      .map(([name, val]) => ({ name, val }))
      .sort((a, b) => b.val - a.val);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((s, x) => s + x.val, 0);
    if (rest > 0) top.push({ name: 'Kategori lainnya', val: rest });
    return top.map((x) => ({ ...x, pct: totalKeluar > 0 ? Math.round((x.val / totalKeluar) * 100) : 0 }));
  }, [keluar, totalKeluar]);

  // Perbandingan shift
  const shiftRows = [
    { key: 'pagi', label: 'Pagi', range: '06:00–14:00', masuk: shiftPagiMasuk, keluar: shiftPagiKeluar, color: SHIFT_COLORS.pagi },
    { key: 'siang', label: 'Siang', range: '14:00–21:00', masuk: shiftSiangMasuk, keluar: shiftSiangKeluar, color: SHIFT_COLORS.siang }
  ];
  const maxShiftVal = Math.max(shiftPagiMasuk, shiftPagiKeluar, shiftSiangMasuk, shiftSiangKeluar, 1);

  // Transaksi tanpa nota, nominal terbesar dulu
  const tanpaNota = filtered
    .filter((t) => !t.proofUrl)
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));

  // Cumulative Line Chart Data
  const lineChartData = useMemo(() => {
    const list = [...filtered].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    if (list.length === 0) return null;

    let incAcc = 0;
    let expAcc = 0;
    const ptsInc = [];
    const ptsExp = [];
    const timeLabels = [];

    // Dimensi piksel asli (bukan viewBox yang diskalakan) → ukuran teks selalu 12px
    const W = chartW || 640;
    const H = W < 480 ? 220 : 252;
    const x0 = 52;
    const x1 = W - 14;
    const y0 = 14;
    const y1 = H - 30;

    const toMins = (tm) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec((tm || '').trim());
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
    const minsList = list.map((t) => toMins(t.time));
    const hasAllMins = minsList.every((m) => m !== null);
    const minMin = hasAllMins ? Math.min(...minsList) : 0;
    const maxMin = hasAllMins ? Math.max(...minsList) : 0;
    const timeSpan = maxMin - minMin;

    list.forEach((t, i) => {
      if (t.type === 'pemasukan') incAcc += Number(t.amount || 0);
      if (t.type === 'pengeluaran') expAcc += Number(t.amount || 0);

      let x;
      if (list.length === 1) {
        x = (x0 + x1) / 2;
      } else if (hasAllMins && timeSpan > 0) {
        x = x0 + ((minsList[i] - minMin) / timeSpan) * (x1 - x0);
      } else {
        x = x0 + (i / (list.length - 1)) * (x1 - x0);
      }
      ptsInc.push({ x, v: incAcc, item: t });
      ptsExp.push({ x, v: expAcc, item: t });
      timeLabels.push({ x, time: t.time || `T${i + 1}` });
    });

    const maxVal = Math.max(incAcc, expAcc, 800000);
    const scaleMax = Math.ceil(maxVal / 200000) * 200; // in thousands K

    const mapY = (v) => y1 - (v / (scaleMax * 1000)) * (y1 - y0);

    const pi = ptsInc.map((p) => [p.x, mapY(p.v)]);
    const pe = ptsExp.map((p) => [p.x, mapY(p.v)]);

    // Satu objek per transaksi, dipakai untuk titik, crosshair, dan tooltip
    const pts = ptsInc.map((p, i) => ({
      x: p.x,
      yi: pi[i][1],
      ye: pe[i][1],
      inc: p.v,
      exp: ptsExp[i].v,
      item: p.item
    }));

    // Area di bawah kurva (ditutup ke garis dasar)
    const area = (arr) =>
      arr.length > 1 ? `${sm(arr)}L${arr[arr.length - 1][0]},${y1}L${arr[0][0]},${y1}Z` : '';

    // Label waktu dijarangkan supaya tidak bertabrakan
    const n = timeLabels.length;
    const maxLabels = Math.max(2, Math.floor((x1 - x0) / 64));
    const step = Math.max(1, Math.ceil(n / maxLabels));
    const lastShown = Math.floor((n - 1) / step) * step;
    const showLast = n - 1 - lastShown >= step / 2;
    const xLabels = timeLabels.filter((_, i) => i % step === 0 || (i === n - 1 && showLast));

    return {
      scaleMax,
      pi,
      pe,
      pts,
      areaInc: area(pi),
      areaExp: area(pe),
      xLabels,
      mapY,
      W,
      H,
      x0,
      x1,
      y0,
      y1
    };
  }, [filtered, chartW]);

  return (
    <div className="space-y-5">
      {/* HERO SECTION */}
      <section
        ref={heroGlow.ref}
        onMouseMove={heroGlow.onMouseMove}
        onMouseLeave={heroGlow.onMouseLeave}
        className="relative overflow-hidden rounded-[22px] p-5 lg:p-6 text-[var(--text-inverse)] shadow-[var(--shadow-royal-hero)]"
        style={{ background: 'var(--grad-hero)', ...reveal(0) }}
        aria-label="Sapaan dan ringkasan hari ini"
      >
        <div className="absolute -left-32 -bottom-48 h-80 w-80 rounded-full bg-[var(--glass-soft)] pointer-events-none" />
        {/* Glow latar mengikuti mouse; CSS variable diwariskan dari <section>. */}
        <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 rounded-[22px]" />

        <div className="relative grid gap-6 lg:grid-cols-[1fr_28rem] xl:grid-cols-[1fr_32rem] lg:items-stretch">
          {/* Kiri: sapaan + kontrol filter */}
          <div className="relative z-10 flex flex-col gap-6">
            <div style={reveal(1, 10)}>
              <LiveClock icon={GreetIcon} />
            </div>

            <div className="flex flex-1 flex-col justify-center" style={reveal(1, 10)}>
              <h1 className="space-y-2.5 font-semibold tracking-tight leading-[1.15] break-words">
                <span className="block text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-medium text-[color:var(--glass-text-soft)]">{greeting}</span>
                <span className="block text-3xl sm:text-4xl lg:text-5xl xl:text-6xl">{fullName}</span>
              </h1>
            </div>

            <div className="mt-auto flex flex-wrap items-end gap-3" style={reveal(1, 10)}>
              <DateField value={selectedDate} onChange={setSelectedDate} />
              <ShiftSwitch value={selectedShift} onChange={setSelectedShift} />
            </div>
          </div>

          {/* Kanan: ringkasan (kartu kaca) */}
          <div className="relative">
            {/* Aksen bulat di belakang kartu (putih transparan, selaras dengan aksen lama) */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -top-16 -right-14 h-56 w-56 rounded-full bg-[var(--glass-line)]" />
              <div className="absolute -bottom-20 left-6 h-52 w-52 rounded-full bg-[var(--glass-soft)]" />
            </div>
            {/* Metrik: kas bersih dominan, sisanya pendukung */}
            <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                ref={tiltNet.ref}
                onMouseMove={tiltNet.onMouseMove}
                onMouseLeave={tiltNet.onMouseLeave}
                className="sm:col-span-2 rounded-2xl bg-[var(--glass-subtle)] border border-[var(--glass-border)] backdrop-blur-xl shadow-[var(--shadow-glass-card)] p-4"
                style={reveal(2, 12)}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                    <Wallet className="w-4 h-4 text-[var(--text-inverse)]" aria-hidden="true" />
                    Kas bersih
                  </p>
                  {delta !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--glass-line)] px-2.5 py-1 text-xs font-medium tabular-nums">
                      {delta > 0 && <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />}
                      {delta < 0 && <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />}
                      {delta === 0
                        ? 'Sama dengan hari sebelumnya'
                        : `${delta > 0 ? '+' : '−'}${rp(delta)}${deltaPct !== null ? ` (${deltaPct}%)` : ''} vs hari sebelumnya`}
                    </span>
                  )}
                </div>
                <p className="text-2xl lg:text-3xl font-semibold tracking-tight tabular-nums mt-2 break-words">
                  {totalBersih < 0 ? '−' : ''}
                  {rp(totalBersih)}
                </p>

                <p className="mt-3 text-xs text-[color:var(--glass-text-soft)] text-right">
                  Keluar {pctKeluar}% dari pemasukan
                </p>
                <div
                  className="mt-1.5 h-1.5 rounded-full bg-[var(--glass-line)] overflow-hidden"
                  role="progressbar"
                  aria-valuenow={pctKeluar}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Pengeluaran ${pctKeluar} persen dari pemasukan`}
                >
                  <div className="h-full rounded-full bg-[var(--text-inverse)]" style={grow(pctKeluar, 2)} />
                </div>
                <div className="flex justify-between gap-3 mt-2.5 text-xs text-[color:var(--glass-text-soft)] tabular-nums">
                  <span className="flex items-center gap-1">
                    <ArrowDownLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    Masuk {rp(totalMasuk)}
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    Keluar {rp(totalKeluar)}
                  </span>
                </div>
              </div>

              <div
                ref={tiltTrx.ref}
                onMouseMove={tiltTrx.onMouseMove}
                onMouseLeave={tiltTrx.onMouseLeave}
                className="rounded-2xl bg-[var(--glass-subtle)] border border-[var(--glass-border)] backdrop-blur-xl shadow-[var(--shadow-glass-card)] p-4 flex flex-col"
                style={reveal(3, 12)}
              >
                <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                  <ArrowLeftRight className="w-4 h-4 text-[var(--text-inverse)]" aria-hidden="true" />
                  Transaksi
                </p>
                <p className="text-2xl font-semibold tracking-tight tabular-nums mt-2">{filtered.length}</p>
                <div className="mt-auto pt-3">
                  <div
                    className="h-1.5 rounded-full bg-[var(--glass-line)] overflow-hidden"
                    role="progressbar"
                    aria-valuenow={pctMasukCount}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Proporsi transaksi masuk ${pctMasukCount}%`}
                  >
                    <div className="h-full rounded-full bg-[var(--text-inverse)]" style={grow(pctMasukCount, 3)} />
                  </div>
                  <p className="text-xs text-[color:var(--glass-text-soft)] mt-1.5">
                    {masuk.length} masuk · {keluar.length} keluar
                  </p>
                </div>
              </div>

              <div
                ref={tiltNota.ref}
                onMouseMove={tiltNota.onMouseMove}
                onMouseLeave={tiltNota.onMouseLeave}
                className="rounded-2xl bg-[var(--glass-subtle)] border border-[var(--glass-border)] backdrop-blur-xl shadow-[var(--shadow-glass-card)] p-4 flex flex-col"
                style={reveal(4, 12)}
              >
                <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                  <Paperclip className="w-4 h-4 text-[var(--text-inverse)]" aria-hidden="true" />
                  Bukti nota
                </p>
                <p className="text-2xl font-semibold tracking-tight tabular-nums mt-2">
                  {bkCount}
                  <span className="text-base text-[color:var(--glass-text-soft)]">/{filtered.length}</span>
                </p>
                <div className="mt-auto pt-3">
                  <div
                    className="h-1.5 rounded-full bg-[var(--glass-line)] overflow-hidden"
                    role="progressbar"
                    aria-valuenow={pctNota}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Kelengkapan bukti nota ${pctNota}%`}
                  >
                    <div className="h-full rounded-full bg-[var(--text-inverse)]" style={grow(pctNota, 4)} />
                  </div>
                  <p className={`flex items-center gap-1.5 text-xs mt-1.5 ${nbCount ? 'font-medium text-[var(--text-inverse)]' : 'text-[color:var(--glass-text-soft)]'}`}>
                    {nbCount > 0 && <span className="inline-block w-2 h-2 rounded-full bg-[var(--amber-400)] shrink-0" aria-hidden="true" />}
                    {nbCount ? `${nbCount} transaksi belum ada nota` : 'Semua nota lengkap'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROW A: ARUS KAS + PERLU DICEK */}
      <section className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="card" style={reveal(5)}>
          <CardHeader
            title="Arus kas"
            hint="Akumulasi pemasukan dan pengeluaran sepanjang hari"
            right={
              <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-[13px] text-[var(--text-muted)] tabular-nums">
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <i className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--royal-600)]" />
                  Masuk <b className="font-semibold text-[var(--text-main)]">{rp(totalMasuk)}</b>
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <i className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--cash-out)]" />
                  Keluar <b className="font-semibold text-[var(--text-main)]">{rp(totalKeluar)}</b>
                </span>
              </div>
            }
          />
          {/* SVG Line Chart: digambar dalam piksel asli sesuai lebar card */}
          <figure ref={chartRef} className="w-full">
            <figcaption className="sr-only">
              Grafik akumulasi pemasukan ({rp(totalMasuk)}) dan pengeluaran ({rp(totalKeluar)}) sepanjang hari.
            </figcaption>
            {lineChartData ? (() => {
              const { pts, W, H, x0, x1, y0, y1, mapY, scaleMax, xLabels } = lineChartData;
              const ai = hoverIdx !== null ? Math.min(hoverIdx, pts.length - 1) : null;
              const a = ai !== null ? pts[ai] : null;
              const showDots = pts.length <= 24;
              const tipW = 196;
              const tipH = 72;
              const onLeftHalf = a ? a.x < (x0 + x1) / 2 : true;
              const tipX = a ? (onLeftHalf ? Math.min(a.x + 14, W - tipW) : Math.max(a.x - 14 - tipW, 0)) : 0;
              const tipY = a ? Math.min(Math.max((a.yi + a.ye) / 2 - tipH / 2, y0), y1 - tipH) : 0;
              const rawTitle = a?.item?.title || a?.item?.id || '';
              const tipTitle = rawTitle.length > 20 ? `${rawTitle.slice(0, 19)}…` : rawTitle;
              const fade = (extra) => ({ opacity: ready ? 1 : 0, transition: `opacity 600ms ease-out ${chartDelay + extra}ms` });

              return (
                <>
                  <svg
                    width={W}
                    height={H}
                    viewBox={`0 0 ${W} ${H}`}
                    className="block max-w-full"
                    role="img"
                    aria-label="Pemasukan dan pengeluaran kumulatif per transaksi"
                    onPointerLeave={() => setHoverIdx(null)}
                  >
                    <defs>
                      <linearGradient id="cf-in" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" style={{ stopColor: 'var(--royal-600)', stopOpacity: 0.22 }} />
                        <stop offset="100%" style={{ stopColor: 'var(--royal-600)', stopOpacity: 0 }} />
                      </linearGradient>
                      <linearGradient id="cf-out" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" style={{ stopColor: 'var(--cash-out)', stopOpacity: 0.16 }} />
                        <stop offset="100%" style={{ stopColor: 'var(--cash-out)', stopOpacity: 0 }} />
                      </linearGradient>
                    </defs>

                    {/* Gridlines (putus-putus) & label sumbu Y */}
                    {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                      const v = Math.round(scaleMax * f) * 1000;
                      const yPos = mapY(v);
                      return (
                        <g key={i}>
                          <line
                            x1={x0}
                            x2={x1}
                            y1={yPos}
                            y2={yPos}
                            stroke="var(--border-subtle)"
                            strokeDasharray={f === 0 ? undefined : '3 5'}
                          />
                          <text x={x0 - 12} y={yPos + 4} fontSize="12" fill="var(--text-muted)" textAnchor="end">
                            {v === 0 ? '0' : rpShort(v)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Label waktu sumbu X */}
                    {xLabels.map((lbl, i) => (
                      <text key={i} x={lbl.x} y={y1 + 22} fontSize="12" fill="var(--text-muted)" textAnchor="middle">
                        {lbl.time}
                      </text>
                    ))}

                    {/* Area gradient di bawah kurva */}
                    <path d={lineChartData.areaExp} fill="url(#cf-out)" style={fade(500)} />
                    <path d={lineChartData.areaInc} fill="url(#cf-in)" style={fade(350)} />

                    {/* Crosshair titik aktif (hanya saat hover/fokus) */}
                    {a && (
                      <line
                        x1={a.x}
                        x2={a.x}
                        y1={y0}
                        y2={y1}
                        stroke="var(--text-muted)"
                        strokeOpacity="0.4"
                        strokeDasharray="3 4"
                      />
                    )}

                    {/* Kurva pemasukan & pengeluaran */}
                    <path
                      d={sm(lineChartData.pe)}
                      pathLength="1"
                      strokeDasharray="1"
                      style={drawStyle(150)}
                      fill="none"
                      stroke="var(--cash-out)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={sm(lineChartData.pi)}
                      pathLength="1"
                      strokeDasharray="1"
                      style={drawStyle(0)}
                      fill="none"
                      stroke="var(--royal-600)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Titik tiap transaksi (aksesibel via keyboard) */}
                    <g style={fade(900)}>
                      {pts.map((p, i) => {
                        const on = i === ai;
                        if (!on && !showDots) return null;
                        return (
                          <g
                            key={i}
                            tabIndex={0}
                            role="button"
                            aria-label={`${p.item?.time || '-'} WIB, ${p.item?.title || p.item?.id}: Masuk ${rp(p.inc)}, Keluar ${rp(p.exp)}`}
                            className="cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--royal-600)]"
                            onFocus={() => setHoverIdx(i)}
                            onBlur={() => setHoverIdx(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowRight') {
                                e.preventDefault();
                                setHoverIdx(Math.min(i + 1, pts.length - 1));
                              } else if (e.key === 'ArrowLeft') {
                                e.preventDefault();
                                setHoverIdx(Math.max(i - 1, 0));
                              } else if (e.key === 'Escape') {
                                setHoverIdx(null);
                              }
                            }}
                          >
                            <circle cx={p.x} cy={p.ye} r={on ? 5.5 : 3.5} fill={on ? 'var(--surface-card)' : 'var(--cash-out)'} stroke="var(--cash-out)" strokeWidth={on ? 2.5 : 0} />
                            <circle cx={p.x} cy={p.yi} r={on ? 5.5 : 3.5} fill={on ? 'var(--surface-card)' : 'var(--royal-600)'} stroke="var(--royal-600)" strokeWidth={on ? 2.5 : 0} />
                          </g>
                        );
                      })}
                    </g>

                    {/* Tooltip (muncul saat hover atau fokus keyboard) */}
                    {a && (
                      <g
                        style={{
                          transform: `translate(${tipX}px, ${tipY}px)`,
                          transition: 'transform 160ms ease-out',
                          pointerEvents: 'none'
                        }}
                      >
                        <rect width={tipW} height={tipH} rx="12" fill="var(--surface-card)" stroke="var(--border-default)" style={{ filter: 'var(--shadow-tooltip)' }} />
                        <text x="14" y="22" fontSize="12" fill="var(--text-muted-alt)">
                          {a.item?.time || ''} · {tipTitle}
                        </text>
                        <circle cx="17" cy="42" r="3.5" fill="var(--royal-600)" />
                        <text x="28" y="46" fontSize="12" fill="var(--text-muted)">Masuk</text>
                        <text x={tipW - 14} y="46" fontSize="13" fontWeight="600" fill="var(--text-main)" textAnchor="end">{rp(a.inc)}</text>
                        <circle cx="17" cy="60" r="3.5" fill="var(--cash-out)" />
                        <text x="28" y="64" fontSize="12" fill="var(--text-muted)">Keluar</text>
                        <text x={tipW - 14} y="64" fontSize="13" fontWeight="600" fill="var(--text-main)" textAnchor="end">{rp(a.exp)}</text>
                      </g>
                    )}

                    {/* Area hover: satu kolom transparan per transaksi */}
                    {pts.map((p, i) => {
                      const left = i === 0 ? x0 : (pts[i - 1].x + p.x) / 2;
                      const right = i === pts.length - 1 ? x1 : (p.x + pts[i + 1].x) / 2;
                      return (
                        <rect
                          key={i}
                          x={left}
                          y={y0}
                          width={Math.max(right - left, 1)}
                          height={y1 - y0}
                          fill="transparent"
                          onPointerEnter={() => setHoverIdx(i)}
                          onPointerDown={() => setHoverIdx(i)}
                        />
                      );
                    })}
                  </svg>
                  <div className="mt-3 text-xs text-[var(--text-muted)]">
                    <button
                      type="button"
                      onClick={() => setTableOpen((open) => !open)}
                      aria-expanded={tableOpen}
                      aria-controls="arus-kas-table"
                      className="inline-flex cursor-pointer select-none items-center gap-1.5 font-medium text-[var(--text-link)] hover:underline"
                    >
                      {tableOpen ? 'Sembunyikan data tabel arus kas' : 'Lihat data tabel arus kas'}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-300 ease-out motion-reduce:transition-none ${tableOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                    <div
                      id="arus-kas-table"
                      className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${tableOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                    >
                      <div
                        className={`min-h-0 overflow-hidden transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${tableOpen ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
                          }`}
                      >
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <caption className="sr-only">Tabel data akumulasi arus kas</caption>
                            <thead>
                              <tr className="border-b border-[var(--border-default)] text-[var(--text-muted-alt)]">
                                <th scope="col" className="py-1.5 pr-3 font-medium">Waktu</th>
                                <th scope="col" className="py-1.5 pr-3 font-medium">Keterangan</th>
                                <th scope="col" className="py-1.5 pr-3 font-medium text-right">Akumulasi Masuk</th>
                                <th scope="col" className="py-1.5 font-medium text-right">Akumulasi Keluar</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pts.map((p, i) => (
                                <tr key={i} className="border-b border-[var(--border-subtle)]">
                                  <td className="py-1.5 pr-3 tabular-nums">{p.item?.time || '-'} WIB</td>
                                  <td className="py-1.5 pr-3 text-[var(--text-main)]">{p.item?.title || p.item?.id}</td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--text-main)]">{rp(p.inc)}</td>
                                  <td className="py-1.5 text-right tabular-nums text-[var(--cash-out)]">{rp(p.exp)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })() : (
              <div className="py-16 text-center text-sm text-[var(--text-muted)]">
                Tidak ada data arus kas untuk tanggal ini
              </div>
            )}
          </figure>
        </div>

        <div className="card flex flex-col" style={reveal(6)}>
          <CardHeader
            title="Perlu dicek"
            hint="Transaksi tanpa bukti nota"
            right={nbCount > 0 ? <span className="tag h-fit">{nbCount} transaksi</span> : null}
          />
          {nbCount === 0 ? (
            <div className="flex-1 grid place-items-center text-center py-8">
              <div>
                <Paperclip className="w-6 h-6 mx-auto text-[var(--cash-in)]" />
                <p className="text-sm font-medium text-[var(--text-main)] mt-2">Semua transaksi punya nota</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Tidak ada yang perlu dicek.</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between gap-4">
              <ul className="divide-y divide-[var(--border-subtle)]">
                {tanpaNota.slice(0, 4).map((t) => (
                  <li
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Lihat ${t.title} di tabel rincian`}
                    onClick={() => reviewNota(t.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reviewNota(t.id); } }}
                    className="-mx-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2.5 outline-none transition-all duration-200 hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-[0.99] motion-reduce:transition-none"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-main)] truncate">{t.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {t.time || '-'} WIB · {t.id}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`text-sm font-semibold tabular-nums whitespace-nowrap ${t.type === 'pengeluaran' ? 'text-[var(--cash-out)]' : 'text-[var(--text-main)]'
                          }`}
                      >
                        {t.type === 'pengeluaran' ? '−' : '+'} {rp(t.amount)}
                      </span>
                      {onNavigate && (
                        <button
                          type="button"
                          aria-label={`Unggah bukti untuk ${t.id}`}
                          title="Unggah bukti"
                          onClick={(e) => { e.stopPropagation(); onNavigate('upload', { transactionId: t.id }); }}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-card)] hover:text-[var(--royal-600)] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)]"
                        >
                          <Paperclip className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                {tanpaNota.length > 4 && (
                  <li className="pt-2.5 text-xs text-[var(--text-muted)]">
                    +{tanpaNota.length - 4} transaksi lainnya, lihat di rincian di bawah
                  </li>
                )}
              </ul>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('upload')}
                  className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--text-link)] transition-colors hover:bg-[var(--royal-50)]"
                >
                  <Paperclip className="w-4 h-4" aria-hidden="true" />
                  Unggah bukti nota
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ROW B: PEMASUKAN PER METODE, PENGELUARAN PER KATEGORI, PERBANDINGAN SHIFT */}
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <div className="card flex flex-col" style={reveal(7)}>
          <CardHeader
            title="Pemasukan per metode"
            hint="Uang masuk lewat apa"
            right={totalMasuk > 0 ? <span className="tag h-fit">Non-tunai {pctNonTunai}%</span> : null}
          />
          {totalMasuk === 0 ? (
            <EmptyNote>Belum ada pemasukan.</EmptyNote>
          ) : (
            <div className="flex-1 flex flex-col justify-between gap-5">
              <DonutChart
                rows={methodRows}
                total={totalMasuk}
                ready={ready}
                delay={chartDelay}
                label="Total masuk"
                activeKey={hoverMethod ?? (methodRows.find((m) => m.key === (columnFilters.metode || '').toLowerCase())?.key || null)}
                onHover={setHoverMethod}
                onSelect={(key) => toggleFilter('metode', key)}
              />
              <ul className="-mx-2 space-y-1">
                {methodRows.map((m) => (
                  <li key={m.key}>
                    <button
                      type="button"
                      aria-pressed={(columnFilters.metode || '').toLowerCase() === m.key}
                      onClick={() => toggleFilter('metode', m.key)}
                      onMouseEnter={() => setHoverMethod(m.key)}
                      onMouseLeave={() => setHoverMethod(null)}
                      onFocus={() => setHoverMethod(m.key)}
                      onBlur={() => setHoverMethod(null)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-[0.98] motion-reduce:transition-none ${hoverMethod === m.key || (columnFilters.metode || '').toLowerCase() === m.key ? 'bg-[var(--surface-muted)]' : ''
                        } ${(columnFilters.metode || '').toLowerCase() === m.key ? 'ring-1 ring-[color:var(--royal-300)]' : ''}`}
                    >
                      <span className="flex items-center gap-2 min-w-0 text-[var(--text-main)]">
                        <i className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                        <m.icon className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
                        <span className="truncate">{m.label}</span>
                      </span>
                      <span className="whitespace-nowrap tabular-nums font-medium text-[var(--text-main)]">
                        {rp(m.val)}
                        <span className="ml-2 inline-block min-w-[2.25rem] text-right text-xs font-normal text-[var(--text-muted)]">{m.pct}%</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card flex flex-col" style={reveal(8)}>
          <CardHeader title="Pengeluaran per kategori" hint="Uang keluar untuk apa" />
          {totalKeluar === 0 ? (
            <EmptyNote>Belum ada pengeluaran.</EmptyNote>
          ) : (
            <div className="flex-1 flex flex-col gap-1">
              {kategoriRows.map((k, i) => {
                const canFilter = k.name !== 'Kategori lainnya';
                const fv = katFilterValue(k.name);
                const isSel = canFilter && (columnFilters.kategori || '').toLowerCase() === fv.toLowerCase();
                return (
                  <BarRow
                    key={k.name}
                    interactive={canFilter}
                    selected={isSel}
                    active={hoverKat === k.name}
                    dim={hoverKat !== null && hoverKat !== k.name}
                    onHover={(on) => setHoverKat(on ? k.name : null)}
                    onClick={() => toggleFilter('kategori', fv)}
                    rank={i + 1}
                    label={k.name}
                    value={k.val}
                    pct={k.pct}
                    color="var(--cash-out)"
                    opacity={Math.max(1 - i * 0.14, 0.45)}
                    barStyle={grow(k.pct, 8, k.val > 0)}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="card flex flex-col md:col-span-2 xl:col-span-1" style={reveal(9)}>
          <CardHeader title="Perbandingan shift" hint="Pagi vs siang pada tanggal ini" />
          <div className="flex-1 flex flex-col justify-between gap-5">
            {shiftRows.map((s, si) => {
              const bersih = s.masuk - s.keluar;
              return (
                <div key={s.key} className={si > 0 ? 'pt-5 border-t border-[var(--border-subtle)]' : ''}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={selectedShift === s.key}
                    aria-label={`Filter dashboard ke shift ${s.label}`}
                    onClick={() => setSelectedShift(selectedShift === s.key ? 'semua' : s.key)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedShift(selectedShift === s.key ? 'semua' : s.key); } }}
                    className={`-mx-3 cursor-pointer rounded-xl px-3 py-2.5 outline-none transition-all duration-200 hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-[0.99] motion-reduce:transition-none ${selectedShift === s.key ? 'bg-[var(--surface-muted)] ring-1 ring-[color:var(--royal-300)]' : ''
                      } ${selectedShift !== 'semua' && selectedShift !== s.key ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm text-[var(--text-main)]">
                        <i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                        <b className="font-semibold">{s.label}</b>
                        <span className="text-xs text-[var(--text-muted)]">{s.range}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-xs text-[var(--text-muted)] leading-none mb-1">Kas bersih</span>
                        <span className={`text-sm font-semibold tabular-nums ${bersih < 0 ? 'text-[var(--cash-out)]' : 'text-[var(--cash-in)]'}`}>
                          {bersih < 0 ? '−' : ''}
                          {rp(bersih)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {[
                        { k: 'Masuk', v: s.masuk, c: 'var(--royal-600)' },
                        { k: 'Keluar', v: s.keluar, c: 'var(--cash-out)' }
                      ].map((b) => {
                        const ratioPct = Math.round((b.v / maxShiftVal) * 100);
                        return (
                          <div
                            key={b.k}
                            onMouseEnter={() => setHoverBar(`${s.key}-${b.k}`)}
                            onMouseLeave={() => setHoverBar(null)}
                            className="flex items-center gap-3 text-xs text-[var(--text-muted)]"
                          >
                            <span className="w-12 shrink-0">{b.k}</span>
                            <div
                              className={`flex-1 h-2 rounded-full bg-[var(--surface-muted)] overflow-hidden transition-transform duration-200 ${hoverBar === `${s.key}-${b.k}` ? 'scale-y-150' : ''}`}
                              role="progressbar"
                              aria-valuenow={ratioPct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`Shift ${s.label} ${b.k}: ${rp(b.v)}`}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{ ...grow(ratioPct, 9, b.v > 0), background: b.c }}
                              />
                            </div>
                            <span className={`w-24 text-right tabular-nums text-[var(--text-main)] transition-all duration-200 ${hoverBar === `${s.key}-${b.k}` ? 'font-semibold' : ''}`}>{rp(b.v)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TRANSACTIONS SECTION */}
      <section ref={tableRef} className="card scroll-mt-4" style={reveal(10)}>
        <CardHeader
          title="Rincian transaksi"
          hint={`${selectedDate ? `${selectedDate} · ` : ''}${detailData.length} transaksi tercatat`}
          right={
            <TxSearch
              value={localSearch}
              onChange={setLocalSearch}
              label="Cari transaksi"
              placeholder="Cari transaksi, kategori, metode..."
            />
          }
        />

        {activeChips.length > 0 && (
          <div className="-mt-2 mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter aktif">
            {activeChips.map(([key, val]) => (
              <button
                key={key}
                type="button"
                onClick={() => setColumnFilters((prev) => ({ ...prev, [key]: '' }))}
                aria-label={`Hapus filter ${key}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--royal-300)] bg-[var(--surface-muted)] py-1 pl-3 pr-2 text-xs font-medium text-[var(--royal-600)] transition-all duration-150 hover:bg-[var(--surface-hover)] active:scale-95"
              >
                <span className="font-normal text-[var(--text-muted)]">{DETAIL_COLUMNS.find((c) => c.key === key)?.label}:</span>
                {val}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setColumnFilters({})}
              className="rounded-md px-2 py-1 text-xs font-medium text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)] active:scale-95"
            >
              Reset semua
            </button>
          </div>
        )}

        {detailData.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--text-muted)] rounded-2xl bg-[var(--surface-muted)] border border-dashed border-[var(--border-default)]">
            Belum ada transaksi pada tanggal dan filter yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[900px]">
              <caption className="sr-only">Rincian transaksi pada tanggal dan filter terpilih</caption>
              <thead>
                <tr className="text-xs text-[var(--text-muted)]">
                  {DETAIL_COLUMNS.map((col) => {
                    if (col.noSort) {
                      return (
                        <th key={col.key} scope="col" className="py-2.5 font-normal">
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
                        className={`py-2.5 font-normal ${col.key === 'nominal' ? 'text-right' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          aria-label={`Urutkan berdasarkan ${col.label}`}
                          className={`-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] ${col.key === 'nominal' ? 'flex-row-reverse' : ''
                            }`}
                        >
                          {col.label}
                          <SortIcon
                            aria-hidden="true"
                            className={`h-3 w-3 ${active ? 'text-[var(--royal-600)]' : 'opacity-50'}`}
                          />
                        </button>
                      </th>
                    );
                  })}
                </tr>
                <tr className="text-xs">
                  {DETAIL_COLUMNS.map((col) => (
                    <th key={col.key} scope="col" className="pb-2 pr-3 font-normal">
                      {col.noFilter ? null : (
                        <ColumnFilterSelect
                          label={col.label}
                          value={columnFilters[col.key] || ''}
                          options={columnOptions[col.key] || []}
                          onChange={(value) =>
                            setColumnFilters((prev) => ({ ...prev, [col.key]: value }))
                          }
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody id="rows">
                {detailData.map((x) => {
                  const isExp = x.type === 'pengeluaran';
                  const MethodIcon = METHOD_ICONS[x.paymentMethod?.toLowerCase()] || Banknote;
                  const shiftColor = SHIFT_COLORS[x.shift?.toLowerCase()] || 'var(--royal-600)';

                  return (
                    <tr
                      key={x.id}
                      className="grid-l hover:bg-[var(--royal-50)] transition-colors duration-700"
                      style={flashId === x.id ? { background: 'color-mix(in srgb, var(--amber-500) 20%, transparent)' } : undefined}
                    >
                      <td className="py-3 whitespace-nowrap">
                        <div className={`font-medium ${isExp ? 'text-[var(--cash-out)]' : 'text-[var(--text-main)]'}`}>
                          {x.time || '-'} WIB
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">{x.id}</div>
                      </td>
                      <td className="pr-3">
                        <div className="font-medium text-[var(--text-main)]">{x.title}</div>
                        <div className={`text-xs ${isExp ? 'text-[var(--cash-out)]' : 'text-[var(--text-muted)]'}`}>
                          {x.notes || x.referenceId || '-'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs ${isExp
                            ? 'bg-[var(--cash-out-light)] text-[var(--amber-700)]'
                            : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
                            }`}
                        >
                          {x.category || (isExp ? 'Pengeluaran' : 'Umum')}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-xs text-[var(--text-main)] capitalize">
                        <i
                          className="inline-block w-2 h-2 rounded-full mr-1.5"
                          style={{ background: shiftColor }}
                        />
                        {x.shift}
                      </td>
                      <td className="whitespace-nowrap text-xs text-[var(--text-main)] capitalize">
                        <MethodIcon className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-[var(--royal-600)]" />
                        {x.paymentMethod}
                      </td>
                      <td className={`whitespace-nowrap text-xs ${x.proofUrl ? 'text-[var(--cash-in)]' : 'text-[var(--text-muted)]'}`}>
                        {x.proofUrl ? 'Terlampir' : 'Tanpa nota'}
                      </td>
                      <td
                        className={`text-right font-semibold whitespace-nowrap tabular-nums ${isExp ? 'text-[var(--cash-out)]' : 'text-[var(--text-main)]'
                          }`}
                      >
                        {isExp ? '−' : '+'} {rp(x.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}