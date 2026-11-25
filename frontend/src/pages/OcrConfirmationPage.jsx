import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Hash,
  ImageOff,
  Landmark,
  ListChecks,
  Lock,
  Pencil,
  QrCode,
  RotateCcw,
  ScanText,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  X
} from 'lucide-react';
import { formatRupiah } from '../data/mockData';
import { useTiltSurface } from '../hooks/useTiltSurface';
import { useMouseGlow } from '../hooks/useMouseGlow';
import { useSmoothResize } from '../hooks/useSmoothResize';
import {
  field,
  hint,
  label,
  Notice,
  shiftHours,
  todayISO
} from '../lib/ui';

// ── Animasi masuk halaman (sama dengan DashboardPage) ────────────────────────
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const BASE_DELAY = 150;
const STAGGER = 70;
const ENTER_MS = 700;
const SETTLE_MS = BASE_DELAY + 7 * STAGGER + ENTER_MS + 300; // setelah ini style animasi dilepas
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const PAGE_BG = 'var(--surface-app)';

// Notice yang muncul/ganti (error, sukses, duplikat) masuk dengan fade + naik halus
const OCR_CSS = `
@keyframes ocr-pop{from{opacity:0;transform:translateY(-6px) scale(.985)}to{opacity:1;transform:none}}
.ocr-pop{animation:ocr-pop 280ms var(--ease-out)}
@media (prefers-reduced-motion:reduce){.ocr-pop{animation:none}}
`;

// ── Field putih + glow aksen mengikuti kursor saat hover (sama dengan halaman Transaksi) ──
// Glow digambar di wrapper (.glow-pill): ::after = cincin 1px di tepi, ::before = halo tipis di luar.
const GLOW_CSS = `
.glow-pill{position:relative;isolation:isolate;border-radius:var(--pr,.75rem)}
@property --gr{syntax:'<length>';inherits:false;initial-value:150px}
.glow-pill::before,.glow-pill::after{content:'';position:absolute;inset:0;pointer-events:none;border-radius:inherit;opacity:0;transition:opacity 220ms ease}
.glow-pill::before{z-index:-1;background:radial-gradient(90px circle at var(--gx,50%) var(--gy,50%),color-mix(in srgb,var(--royal-500) 55%,transparent),transparent 70%);filter:blur(7px)}
.glow-pill::after{--gr:150px;z-index:2;padding:1px;transition:opacity 220ms ease,padding 300ms ease,--gr 1200ms cubic-bezier(.3,.7,.3,1);background:radial-gradient(var(--gr) circle at var(--gx,50%) var(--gy,50%),var(--royal-500) calc(var(--gr)*.4),color-mix(in srgb,var(--royal-400) 45%,transparent) calc(var(--gr)*.62),transparent calc(var(--gr)*.8));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.glow-pill:hover::before{opacity:.55}
.glow-pill:hover::after{opacity:1}
.glow-pill.glow-press:active::after{opacity:1;--gr:calc(var(--gd,3000px)*2.6)}
.glow-field:focus-within::after,.glow-field:has(button[aria-haspopup][aria-expanded="true"])::after{opacity:1;--gr:calc(var(--gd,3000px)*2.6);padding:2px}
.glow-pill:has(:is(input,textarea,select,button[aria-haspopup]):disabled)::before,.glow-pill:has(:is(input,textarea,select,button[aria-haspopup]):disabled)::after{display:none}
.glow-pill :is(input,textarea,select):not([type=hidden]){display:block;background-color:var(--surface-card)!important;border-radius:var(--pr,.75rem)!important}
.glow-pill :is(input,textarea,select):not([type=hidden]):not(:focus){border:1px solid var(--border-default)!important;box-shadow:none!important}
.glow-pill button[aria-haspopup]{background-color:var(--surface-card)!important;border-radius:var(--pr,.75rem)!important}
.glow-pill button[aria-haspopup]:not([aria-expanded="true"]):not(:focus){border:1px solid var(--border-default)!important;box-shadow:none!important}
.glow-field :is(input,textarea,select):not([type=hidden]):focus,.glow-field button[aria-haspopup][aria-expanded="true"],.glow-field button[aria-haspopup]:focus{border:1px solid transparent!important;box-shadow:none!important;outline:none!important}
@media (hover:none){.glow-pill::before,.glow-pill:not(.glow-press:active):not(.glow-field:focus-within)::after{display:none}}
@media (prefers-reduced-motion:reduce){.glow-pill::before,.glow-pill::after{transition:none}}
`;

function trackGlow(e) {
  const el = e.currentTarget;
  // Saat sudah fokus, titik pusat dikunci di titik klik supaya stroke penuh tidak bergeser mengikuti kursor.
  if (el.matches('.glow-field:focus-within')) return;
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

// Field (input/dropdown): stroke penuh selama fokus. press: tombol aksi, stroke penuh hanya selama ditekan.
function GlowField({ radius = '0.75rem', className = '', press = false, children }) {
  return (
    <div
      className={`glow-pill ${press ? 'glow-press' : 'glow-field'} ${className}`}
      style={{ '--pr': radius }}
      onMouseMove={trackGlow}
      onPointerDown={pressGlow}
    >
      {children}
    </div>
  );
}

// Bukti contoh hasil upload yang baru dipindai OCR (mock)
const SAMPLE_PROOF =
  'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=600&auto=format&fit=crop&q=80';

const OCR_ACCURACY = 96;

const OCR_RESULT = {
  title: 'Pembayaran QRIS Merchant Esbe',
  amount: 145000,
  time: '11:35',
  referenceId: 'NMID-992144812',
  paymentMethod: 'qris',
  shift: 'pagi',
  notes: `Hasil ekstraksi OCR otomatis (Akurasi: ${OCR_ACCURACY}%)`
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

const SHIFT_OPTIONS = [
  { value: 'pagi', label: 'Pagi', hint: shiftHours.pagi },
  { value: 'siang', label: 'Siang', hint: shiftHours.siang }
];

const METHOD_OPTIONS = [
  { value: 'qris', label: 'QRIS', icon: QrCode },
  { value: 'transfer', label: 'Transfer bank', icon: Landmark },
  { value: 'tunai', label: 'Tunai', icon: Banknote }
];

// Skala tipografi kartu sama dengan Dashboard
function CardHeader({ title, hint: sub, right }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-[11rem] flex-1">
        <h2 className="text-lg font-semibold leading-snug text-[var(--text-main)]">{title}</h2>
        {sub && <p className="mt-1 text-sm leading-snug text-[var(--text-muted)]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// Switch geser dengan indikator memantul (diadaptasi dari ShiftSwitch Dashboard)
function SegmentedSwitch({ value, onChange, options, ariaLabel, fullWidth = false, disabled = false, minH = 'min-h-14' }) {
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
      // Overshoot dibatasi ~4px agar bounce tidak keluar frame (padding frame = 6px)
      let y1 = prev?.y1 ?? 1.35;
      if (prev && prev.x !== x) {
        const idx = options.findIndex((o) => o.value === value);
        const edge = idx === 0 || idx === options.length - 1;
        const allowed = edge ? Math.min(0.04, 4 / Math.abs(x - prev.x)) : 0.04;
        y1 = Math.min(1.35, 1.2 + (allowed - 0.005) / 0.22);
      }
      return prev && prev.x === x && prev.w === w && prev.y1 === y1 ? prev : { x, w, y1 };
    });
  }, [value, options]);

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

  const curve = `cubic-bezier(0.34, ${(ind?.y1 ?? 1.35).toFixed(3)}, 0.64, 1)`;

  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label={ariaLabel}
      style={{ background: PAGE_BG }}
      className={`relative items-stretch gap-1 rounded-2xl p-1.5 shadow-[var(--shadow-inset-hero)] ${minH} ${fullWidth ? 'flex w-full' : 'inline-flex'
        }`}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1.5 left-0 top-1.5 rounded-xl bg-[var(--royal-600)] shadow-[var(--shadow-indicator)]"
        style={{
          width: ind?.w ?? 0,
          transform: `translateX(${ind?.x ?? 0}px)`,
          opacity: ind ? 1 : 0,
          transition:
            ready && !prefersReducedMotion() ? `transform 420ms ${curve}, width 420ms ${curve}` : 'none'
        }}
      />
      {options.map((o) => {
        const active = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={(el) => {
              btnRefs.current[o.value] = el;
            }}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`group relative z-10 flex flex-col items-center justify-center rounded-xl px-3 py-1.5 leading-tight outline-none transition-[color,background-color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none sm:px-5 ${fullWidth ? 'flex-1' : ''
              } ${active ? 'text-[var(--text-inverse)]' : 'text-[var(--text-main)]'}`}
          >
            <span className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold">
              {Icon && <Icon className={`h-4 w-4 ${ICON_HOVER}`} aria-hidden="true" />}
              {o.label}
            </span>
            {o.hint && (
              <span
                className={`whitespace-nowrap text-[11px] tabular-nums transition-colors duration-200 ${active ? 'text-[color:var(--glass-text-soft)]' : 'text-[var(--text-muted-alt)]'
                  }`}
              >
                {o.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Pill teks di header kartu: style sama dengan tag di halaman Transaksi ("Opsional", "Live preview")
const tagClass =
  'h-fit rounded-lg border border-[var(--border-default)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]';

const SPARKLE_CSS = `
.sparkle-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 22px;
  background: var(--royal-600);
  color: var(--text-inverse);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  border: 2px solid var(--royal-600);
  border-radius: 12px;
  box-shadow: 0 0 0 transparent;
  cursor: pointer;
  outline: none;
  transition: all 0.3s ease-in-out;
}
.sparkle-btn:hover {
  background: transparent;
  color: var(--royal-600);
  box-shadow: 0 0 25px color-mix(in srgb, var(--royal-600) 45%, transparent);
}
.sparkle-btn:active { transform: scale(0.97); }
.sparkle-btn:disabled { cursor: default; }
.sparkle-btn:disabled:active { transform: none; }
.sparkle-btn:disabled .sp { display: none; }
.sparkle-btn[data-locked="true"],
.sparkle-btn[data-locked="true"]:hover {
  background: var(--surface-muted);
  border-color: var(--border-default);
  color: var(--text-muted);
  box-shadow: none;
  cursor: not-allowed;
}
.sparkle-btn[data-saved="true"],
.sparkle-btn[data-saved="true"]:hover {
  background: var(--royal-600);
  color: var(--text-inverse);
  box-shadow: none;
}
.sparkle-btn:focus-visible { box-shadow: 0 0 0 3px var(--royal-300); }
.sparkle-btn .sp {
  position: absolute;
  height: auto;
  opacity: 0;
  filter: drop-shadow(0 0 0 var(--royal-400));
  z-index: -5;
  pointer-events: none;
}
.sparkle-btn .sp svg { display: block; width: 100%; height: auto; }
.sparkle-btn .sp path { fill: var(--royal-400); }
.sparkle-btn:hover .sp { opacity: 1; z-index: 2; filter: drop-shadow(0 0 10px var(--royal-400)); }

.sparkle-btn .sp-1 { top: 20%; left: 20%; width: 25px; transition: all 1s cubic-bezier(0.05, 0.83, 0.43, 0.96); }
.sparkle-btn .sp-2 { top: 45%; left: 45%; width: 15px; transition: all 1s cubic-bezier(0, 0.4, 0, 1.01); }
.sparkle-btn .sp-3 { top: 40%; left: 40%; width: 5px;  transition: all 1s cubic-bezier(0, 0.4, 0, 1.01); }
.sparkle-btn .sp-4 { top: 20%; left: 40%; width: 8px;  transition: all 0.8s cubic-bezier(0, 0.4, 0, 1.01); }
.sparkle-btn .sp-5 { top: 25%; left: 45%; width: 15px; transition: all 0.6s cubic-bezier(0, 0.4, 0, 1.01); }
.sparkle-btn .sp-6 { top: 5%;  left: 50%; width: 5px;  transition: all 0.8s ease; }

.sparkle-btn:hover .sp-1 { top: -80%; left: -30%; }
.sparkle-btn:hover .sp-2 { top: -25%; left: 10%; }
.sparkle-btn:hover .sp-3 { top: 55%;  left: 25%; }
.sparkle-btn:hover .sp-4 { top: 30%;  left: 80%; }
.sparkle-btn:hover .sp-5 { top: 25%;  left: 115%; }
.sparkle-btn:hover .sp-6 { top: 5%;   left: 60%; }

@media (prefers-reduced-motion: reduce) {
  .sparkle-btn, .sparkle-btn .sp { transition: none; }
  .sparkle-btn .sp { display: none; }
}
`;

const STAR_PATH =
  'M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z';

const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

// Tombol simpan dengan efek bintang (sama dengan halaman Transaksi); terkunci sampai nominal valid.
function SparkleSaveButton({ saved, locked, label }) {
  const isLocked = locked && !saved;
  return (
    <button
      type="submit"
      disabled={isLocked || saved}
      data-locked={isLocked}
      data-saved={saved}
      title={isLocked ? 'Isi nominal dulu' : undefined}
      className="group sparkle-btn flex-1"
    >
      <span className="grid place-items-center">
        <span
          className={`col-start-1 row-start-1 inline-flex items-center gap-2 transition-all duration-300 ${EASE} motion-reduce:transition-none ${saved ? '-translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
            }`}
        >
          {isLocked ? <Lock className={`h-4 w-4 ${ICON_HOVER}`} aria-hidden="true" /> : <Check className={`h-4 w-4 ${ICON_HOVER}`} aria-hidden="true" />}
          {label}
        </span>
        <span
          aria-hidden={!saved}
          className={`col-start-1 row-start-1 inline-flex items-center gap-2 transition-all duration-300 ${EASE} motion-reduce:transition-none ${saved ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            }`}
        >
          <CheckCircle2 className={`h-4 w-4 ${ICON_HOVER}`} aria-hidden="true" />
          Tersimpan
        </span>
      </span>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <span key={n} aria-hidden="true" className={`sp sp-${n}`}>
          <svg viewBox="0 0 784.11 815.53">
            <path d={STAR_PATH} />
          </svg>
        </span>
      ))}
    </button>
  );
}

// Animasi hover icon: sama dengan tombol "Simulasi OCR AI" di hero halaman Transaksi.
// Dipasang di icon; elemen induknya harus punya class `group`.
const ICON_HOVER = 'transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none';
const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--royal-500)]';
const nowHHMM = () =>
  new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// ── Popover kustom (portal) dipakai dropdown kategori & pemilih jam ──────────────
// Dirender lewat portal + posisi fixed supaya tidak terpotong overflow kartu dan
// tidak ikut ter-transform oleh animasi reveal. Animasi masuk/keluar: fade + scale dari arah trigger.
const POP_CSS = `
.pop{animation:pop-in 220ms cubic-bezier(.22,1,.36,1) both}
.pop[data-state=closed]{animation:pop-out 150ms ease-in both;pointer-events:none}
@keyframes pop-in{from{opacity:0;transform:translateY(var(--pop-shift,-6px)) scale(.96)}to{opacity:1;transform:none}}
@keyframes pop-out{from{opacity:1;transform:none}to{opacity:0;transform:translateY(var(--pop-shift,-6px)) scale(.97)}}
.tick{display:inline-block;animation:tick 240ms cubic-bezier(.22,1,.36,1) both}
@keyframes tick{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pop,.pop[data-state=closed],.tick{animation:none}}
`;

const POP_GAP = 6;
const popSurface =
  'rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[0_20px_44px_-14px_rgba(15,23,42,0.35)]';
const triggerBase = `group flex h-10 w-full cursor-pointer items-center gap-2.5 border border-[var(--border-default)] px-3 text-left font-medium text-[var(--text-main)] outline-none transition-[border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none text-[15px]`;
const triggerOpen = 'border-[color:var(--royal-400)] ring-2 ring-[color:var(--royal-300)]';

const pad2 = (n) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

// Tetap ter-mount sebentar setelah ditutup supaya animasi keluar sempat diputar.
function usePresence(open, ms = 160) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    const t = setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return open || mounted;
}

function Popover({ open, anchorRef, onClose, width, matchWidth = false, role = 'dialog', id, ariaLabel, className = '', children }) {
  const popRef = useRef(null);
  const present = usePresence(open);
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    const a = anchorRef.current;
    const p = popRef.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    const w = matchWidth ? Math.max(r.width, width || 0) : width || r.width;
    const h = p.offsetHeight;
    const below = window.innerHeight - r.bottom - POP_GAP - 8;
    const above = r.top - POP_GAP - 8;
    const flip = h > below && above > below;
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - w - 8));
    const top = flip ? Math.max(8, r.top - POP_GAP - h) : r.bottom + POP_GAP;
    const originX = Math.min(Math.max(r.left + r.width / 2 - left, 16), Math.max(16, w - 16));
    const origin = `${originX}px ${flip ? 'bottom' : 'top'}`;
    setPos((prev) =>
      prev && prev.top === top && prev.left === left && prev.width === w && prev.flip === flip && prev.origin === origin
        ? prev
        : { top, left, width: w, flip, origin }
    );
  }, [anchorRef, matchWidth, width]);

  useLayoutEffect(() => {
    if (!present) {
      setPos(null);
      return;
    }
    if (open) place();
  }, [present, open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose(true);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, onClose, place, anchorRef]);

  if (!present || typeof document === 'undefined') return null;

  const hiddenWidth = matchWidth ? Math.max(anchorRef.current?.offsetWidth || 0, width || 0) : width;
  return createPortal(
    <div
      ref={popRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      data-state={open ? 'open' : 'closed'}
      className={`fixed z-[100] ${pos ? 'pop' : ''} ${className}`}
      style={
        pos
          ? { top: pos.top, left: pos.left, width: pos.width, transformOrigin: pos.origin, '--pop-shift': pos.flip ? '6px' : '-6px' }
          : { top: 0, left: 0, width: hiddenWidth, visibility: 'hidden' }
      }
    >
      {children}
    </div>,
    document.body
  );
}

// ── Pemilih jam ──
function centerItem(list, v, behavior) {
  const el = list?.querySelector(`[data-v="${v}"]`);
  if (!el) return;
  list.scrollTo({ top: el.offsetTop - (list.clientHeight - el.offsetHeight) / 2, behavior });
}

function TimeColumn({ label, values, value, onPick, listRef }) {
  const onKeyDown = (e) => {
    const i = values.indexOf(value);
    let n;
    if (e.key === 'ArrowDown') n = Math.min(values.length - 1, i + 1);
    else if (e.key === 'ArrowUp') n = Math.max(0, i - 1);
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = values.length - 1;
    else return;
    e.preventDefault();
    onPick(values[n]);
    requestAnimationFrame(() =>
      listRef.current?.querySelector(`[data-v="${values[n]}"]`)?.focus({ preventScroll: true })
    );
  };

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-center text-sm text-[var(--text-muted)]">{label}</p>
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="relative h-52 overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,#000_22%,#000_78%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="space-y-0.5 px-1" style={{ paddingBlock: 84 }}>
          {values.map((v) => {
            const sel = v === value;
            return (
              <button
                key={v}
                type="button"
                role="option"
                aria-selected={sel}
                data-v={v}
                tabIndex={sel ? 0 : -1}
                onClick={() => onPick(v)}
                className={`flex h-10 w-full items-center justify-center rounded-xl text-[15px] tabular-nums outline-none transition-[background-color,color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-95 motion-reduce:transition-none ${sel
                    ? 'bg-[var(--royal-600)] font-semibold text-[var(--text-inverse)]'
                    : 'text-[var(--text-main)] hover:bg-[var(--surface-muted)]'
                  }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimePanel({ value, onChange, onDone }) {
  const [hh, mm] = /^\d{2}:\d{2}$/.test(value || '') ? value.split(':') : ['00', '00'];
  const hourRef = useRef(null);
  const minRef = useRef(null);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    const behavior = mounted.current && !prefersReducedMotion() ? 'smooth' : 'auto';
    centerItem(hourRef.current, hh, behavior);
    centerItem(minRef.current, mm, behavior);
    mounted.current = true;
  }, [hh, mm]);

  // Fokus ke jam terpilih setelah popover terlihat (supaya keyboard langsung bisa dipakai)
  useEffect(() => {
    const r = requestAnimationFrame(() =>
      hourRef.current?.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true })
    );
    return () => cancelAnimationFrame(r);
  }, []);

  return (
    <div className="p-4">
      <div className="flex items-baseline justify-center gap-1 pb-3 text-4xl font-semibold tracking-tight text-[var(--text-main)] tabular-nums">
        <span key={`h${hh}`} className="tick">{hh}</span>
        <span className="text-[var(--text-muted-alt)]">:</span>
        <span key={`m${mm}`} className="tick">{mm}</span>
        <span className="ml-2 text-sm font-medium tracking-normal text-[var(--text-muted)]">WIB</span>
      </div>

      <div className="flex gap-2">
        <TimeColumn label="Jam" values={HOURS} value={hh} onPick={(v) => onChange(`${v}:${mm}`)} listRef={hourRef} />
        <TimeColumn label="Menit" values={MINUTES} value={mm} onPick={(v) => onChange(`${hh}:${v}`)} listRef={minRef} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--border-default)] pt-3">
        <button
          type="button"
          onClick={() => onChange(nowHHMM())}
          className={`group inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-[var(--royal-600)] transition-all duration-200 hover:bg-[var(--royal-50)] active:scale-95 motion-reduce:transition-none ${focusRing}`}
        >
          <Clock className={`h-4 w-4 ${ICON_HOVER}`} aria-hidden="true" />
          Sekarang
        </button>
        <button
          type="button"
          onClick={onDone}
          className={`rounded-xl bg-[var(--royal-600)] px-5 py-2 text-sm font-semibold text-[var(--text-inverse)] transition-all duration-200 hover:bg-[var(--royal-700)] active:scale-95 motion-reduce:transition-none ${focusRing}`}
        >
          Selesai
        </button>
      </div>
    </div>
  );
}

function TimeField({ id, value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const trigRef = useRef(null);
  const close = useCallback((refocus) => {
    setOpen(false);
    if (refocus) trigRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={trigRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-label="Jam di struk"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${triggerBase} ${open ? triggerOpen : ''}`}
      >
        <Clock className={`h-4 w-4 shrink-0 text-[var(--royal-600)] ${ICON_HOVER}`} aria-hidden="true" />
        <span className="flex-1 tabular-nums">{value || '--:--'}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-300 ${EASE} motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <Popover
        open={open}
        anchorRef={trigRef}
        onClose={close}
        width={288}
        role="dialog"
        id={`${id}-panel`}
        ariaLabel="Pilih jam"
        className={popSurface}
      >
        <TimePanel value={value} onChange={onChange} onDone={() => close(true)} />
      </Popover>
    </>
  );
}

const glassCard =
  'rounded-2xl bg-[var(--glass-subtle)] border border-[var(--glass-border)] backdrop-blur-xl shadow-[var(--shadow-glass-card)] p-4';

export default function OcrConfirmationPage({ onConfirmTransaction, onCancel }) {
  const [formData, setFormData] = useState({ ...OCR_RESULT, date: todayISO() });
  const [isManualMode, setIsManualMode] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [imgState, setImgState] = useState('loading'); // 'loading' | 'ok' | 'error'

  // Animasi masuk: dua frame agar keadaan tersembunyi sempat ter-paint sebelum transisi
  const [ready, setReady] = useState(prefersReducedMotion);
  const [settled, setSettled] = useState(prefersReducedMotion);

  // Aksen hover pada kartu metrik hero (mulai setelah animasi masuk selesai)
  const tiltAmount = useTiltSurface({ enabled: settled });
  const tiltStatus = useTiltSurface({ enabled: settled });
  const tiltFill = useTiltSurface({ enabled: settled });
  const heroGlow = useMouseGlow({ size: 420, opacity: 0.12 });
  useSmoothResize(tiltStatus.ref);
  useSmoothResize(tiltFill.ref);

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
  // Bar tumbuh dari 0 (transisi tetap aktif agar perubahan nilai juga mulus)
  const grow = (pct, i) => ({
    width: `${ready ? pct : 0}%`,
    transition: `width 900ms ${EASE_OUT} ${settled ? 0 : BASE_DELAY + i * STAGGER + 350}ms`
  });

  // Simulasi hasil cek duplikat dari backend. Tanpa ID transaksi (mode manual) tidak bisa dicek
  const isDuplicate = !isManualMode;

  const set = (key) => (e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }));
  const setDirect = (key) => (value) => setFormData((prev) => ({ ...prev, [key]: value }));

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
  const hasAmount = amountNumber > 0;

  // Kelengkapan kolom utama (ikut berubah saat karyawan mengetik)
  const filled = [hasAmount, !!formData.referenceId.trim(), !!formData.time, !!formData.title.trim()];
  const filledCount = filled.filter(Boolean).length;
  const pctFilled = Math.round((filledCount / filled.length) * 100);
  const missing = filled.length - filledCount;

  const accuracy = isManualMode ? 0 : OCR_ACCURACY;

  return (
    <div className="space-y-5">
      <style>{OCR_CSS + GLOW_CSS + SPARKLE_CSS + POP_CSS}</style>

      {/* HERO */}
      <section
        ref={heroGlow.ref}
        onMouseMove={heroGlow.onMouseMove}
        onMouseLeave={heroGlow.onMouseLeave}
        className="relative overflow-hidden rounded-[22px] p-5 text-[var(--text-inverse)] shadow-[var(--shadow-royal-hero)] lg:p-6"
        style={{ background: 'var(--grad-hero)', ...reveal(0) }}
        aria-label="Ringkasan hasil baca bukti pembayaran"
      >
        <div className="pointer-events-none absolute -left-32 -bottom-48 h-80 w-80 rounded-full bg-[var(--glass-soft)]" />
        <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 rounded-[22px]" />

        <div className="relative grid gap-6 lg:grid-cols-[1fr_28rem] lg:items-stretch xl:grid-cols-[1fr_32rem]">
          {/* Kiri: judul + kontrol */}
          <div className="relative z-10 flex flex-col gap-6">
            <div style={reveal(1, 10)}>
              <p className="group flex flex-wrap items-center gap-x-2 gap-y-1 text-base tabular-nums text-[color:var(--glass-text-soft)]">
                <ScanText className={`h-5 w-5 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                <span>Hasil baca otomatis (OCR)</span>
                <span aria-hidden="true" className="hidden text-[color:var(--glass-text-dim)] sm:inline">
                  ·
                </span>
                <span className="whitespace-nowrap">{isManualMode ? 'Diisi manual' : `Akurasi ${OCR_ACCURACY}%`}</span>
              </p>
            </div>

            <div className="flex flex-1 flex-col justify-center gap-3" style={reveal(1, 10)}>
              <h1 className="space-y-2.5 break-words font-semibold leading-[1.15] tracking-tight">
                <span className="block text-2xl font-medium text-[color:var(--glass-text-soft)] sm:text-3xl lg:text-4xl xl:text-5xl">
                  Konfirmasi
                </span>
                <span className="block text-3xl sm:text-4xl lg:text-5xl xl:text-6xl">bukti pembayaran</span>
              </h1>
              <p className="text-base text-[color:var(--glass-text-soft)]">
                Periksa dan koreksi nominal serta ID transaksi sebelum disimpan
              </p>
            </div>

            <div className="mt-auto flex flex-wrap items-end gap-3" style={reveal(1, 10)}>
              <SegmentedSwitch
                value={formData.shift}
                onChange={setDirect('shift')}
                options={SHIFT_OPTIONS}
                ariaLabel="Shift kerja"
                disabled={saved}
              />
              <button
                type="button"
                onClick={toggleManual}
                disabled={saved}
                className="group relative inline-flex min-h-14 cursor-pointer items-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-subtle)] px-4 text-sm font-semibold text-[var(--text-inverse)] backdrop-blur-xl outline-none transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--glass-line)] hover:shadow-[var(--shadow-inset-hero-hover)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring-on-dark)] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none motion-reduce:transition-none"
              >
                {/* Dua label ditumpuk: ganti mode = cross-fade, lebar tombol tidak melompat */}
                <span className="relative grid">
                  <span
                    aria-hidden={isManualMode}
                    className={`col-start-1 row-start-1 inline-flex items-center gap-2 whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${isManualMode ? '-translate-y-2 opacity-0' : 'translate-y-0 opacity-100'}`}
                  >
                    <Pencil className={`h-4 w-4 ${ICON_HOVER}`} aria-hidden="true" />
                    Bukti buram? Isi manual
                  </span>
                  <span
                    aria-hidden={!isManualMode}
                    className={`col-start-1 row-start-1 inline-flex items-center gap-2 whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${isManualMode ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
                  >
                    <RotateCcw className={`h-4 w-4 ${ICON_HOVER}`} aria-hidden="true" />
                    Kembali ke hasil OCR
                  </span>
                </span>
              </button>
            </div>
          </div>

          {/* Kanan: ringkasan (kartu kaca) */}
          <div className="relative">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -top-16 -right-14 h-56 w-56 rounded-full bg-[var(--glass-line)]" />
              <div className="absolute -bottom-20 left-6 h-52 w-52 rounded-full bg-[var(--glass-soft)]" />
            </div>
            <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Nominal dominan */}
              <div
                ref={tiltAmount.ref}
                onMouseMove={tiltAmount.onMouseMove}
                onMouseLeave={tiltAmount.onMouseLeave}
                className={`group sm:col-span-2 ${glassCard}`}
                style={reveal(2, 12)}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                    <Wallet className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                    {isManualMode ? 'Nominal' : 'Nominal terbaca'}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--glass-line)] px-2.5 py-1 text-xs font-medium tabular-nums">
                    {isManualMode ? (
                      <Pencil className={`h-3.5 w-3.5 ${ICON_HOVER}`} aria-hidden="true" />
                    ) : (
                      <ScanText className={`h-3.5 w-3.5 ${ICON_HOVER}`} aria-hidden="true" />
                    )}
                    {isManualMode ? 'Diisi manual' : `Akurasi ${OCR_ACCURACY}%`}
                  </span>
                </div>
                <p className="mt-2 break-words text-2xl font-semibold tabular-nums tracking-tight lg:text-3xl">
                  {hasAmount ? formatRupiah(amountNumber) : 'Rp —'}
                </p>

                <p className="mt-3 text-right text-xs text-[color:var(--glass-text-soft)]">
                  {isManualMode ? 'Tidak ada hasil baca' : `Keyakinan hasil baca ${accuracy}%`}
                </p>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--glass-line)]"
                  role="progressbar"
                  aria-valuenow={accuracy}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Keyakinan hasil baca ${accuracy} persen`}
                >
                  <div className="h-full rounded-full bg-[var(--text-inverse)]" style={grow(accuracy, 2)} />
                </div>
                <div className="mt-2.5 flex justify-between gap-3 text-xs tabular-nums text-[color:var(--glass-text-soft)]">
                  <span className="flex min-w-0 items-center gap-1">
                    <Hash className={`h-3.5 w-3.5 shrink-0 ${ICON_HOVER}`} aria-hidden="true" />
                    <span className="truncate font-mono">{formData.referenceId || 'Belum ada ID'}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className={`h-3.5 w-3.5 ${ICON_HOVER}`} aria-hidden="true" />
                    {formData.time ? `${formData.time} WIB` : '--:--'}
                  </span>
                </div>
              </div>

              {/* Status duplikat */}
              <div
                ref={tiltStatus.ref}
                onMouseMove={tiltStatus.onMouseMove}
                onMouseLeave={tiltStatus.onMouseLeave}
                className={`group flex flex-col ${glassCard}`}
                style={reveal(3, 12)}
              >
                <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                  {isDuplicate ? (
                    <ShieldAlert className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                  ) : (
                    <ShieldCheck className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                  )}
                  Status bukti
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{isDuplicate ? 'Duplikat' : 'Belum dicek'}</p>
                <div className="mt-auto pt-3">
                  <p
                    className={`flex items-center gap-1.5 text-xs ${isDuplicate ? 'font-medium text-[var(--text-inverse)]' : 'text-[color:var(--glass-text-soft)]'
                      }`}
                  >
                    {isDuplicate && (
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--amber-400)]" aria-hidden="true" />
                    )}
                    {isDuplicate ? 'Ditandai Perlu ditinjau' : 'Tanpa ID, tidak bisa dicek'}
                  </p>
                </div>
              </div>

              {/* Kelengkapan kolom */}
              <div
                ref={tiltFill.ref}
                onMouseMove={tiltFill.onMouseMove}
                onMouseLeave={tiltFill.onMouseLeave}
                className={`group flex flex-col ${glassCard}`}
                style={reveal(4, 12)}
              >
                <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                  <ListChecks className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                  Kolom terisi
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                  {filledCount}
                  <span className="text-base text-[color:var(--glass-text-soft)]">/{filled.length}</span>
                </p>
                <div className="mt-auto pt-3">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-line)]"
                    role="progressbar"
                    aria-valuenow={pctFilled}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Kelengkapan kolom ${pctFilled} persen`}
                  >
                    <div className="h-full rounded-full bg-[var(--text-inverse)]" style={grow(pctFilled, 4)} />
                  </div>
                  <p
                    className={`mt-1.5 flex items-center gap-1.5 text-xs ${missing ? 'font-medium text-[var(--text-inverse)]' : 'text-[color:var(--glass-text-soft)]'
                      }`}
                  >
                    {missing > 0 && (
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--amber-400)]" aria-hidden="true" />
                    )}
                    {missing ? `${missing} kolom belum diisi` : 'Semua kolom terisi'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NOTICE */}
      {(saved || isDuplicate) && (
        <div className="space-y-3" style={reveal(5)}>
          {saved && (
            <div className="ocr-pop">
              <Notice kind="success">Transaksi dikonfirmasi dan masuk ke riwayat</Notice>
            </div>
          )}
          {isDuplicate && (
            <div key={`dup-${isManualMode}`} className="ocr-pop">
              <Notice kind="warning">
                <p className="font-medium">Bukti terindikasi duplikat</p>
                <p className="mt-1">
                  ID transaksi <span className="font-mono">{formData.referenceId}</span> dengan nominal{' '}
                  {formatRupiah(formData.amount)} sudah pernah diunggah. Transaksi tetap bisa disimpan dan akan
                  ditandai Perlu ditinjau untuk pemilik
                </p>
              </Notice>
            </div>
          )}
        </div>
      )}

      {/* BUKTI + FORM */}
      <section className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        {/* Bukti yang diunggah */}
        <div className="card flex flex-col" style={reveal(6)}>
          <CardHeader
            title="Bukti yang diunggah"
            hint="Hasil baca otomatis bisa keliru, cocokkan dengan gambar"
            right={<span className={tagClass}>{isManualMode ? 'Isi manual' : 'Hasil OCR'}</span>}
          />
          <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-2">
            {imgState === 'error' ? (
              <div className="group grid place-items-center gap-2 py-16 text-center">
                <ImageOff className={`h-6 w-6 text-[var(--text-muted)] ${ICON_HOVER}`} aria-hidden="true" />
                <p className="text-sm font-medium text-[var(--text-main)]">Gambar bukti tidak bisa dimuat</p>
                <p className="text-xs text-[var(--text-muted)]">Nominal tetap bisa diisi dari struk asli</p>
              </div>
            ) : (
              <>
                {imgState === 'loading' && (
                  <div aria-hidden="true" className="absolute inset-2 animate-pulse rounded-lg bg-[var(--border-default)] opacity-50" />
                )}
                <img
                  src={SAMPLE_PROOF}
                  alt="Bukti pembayaran"
                  onLoad={() => setImgState('ok')}
                  onError={() => setImgState('error')}
                  className={`max-h-80 rounded-lg bg-[var(--surface-card)] object-contain transition-[opacity,transform] duration-500 hover:scale-[1.03] motion-reduce:transition-none ${imgState === 'ok' ? 'opacity-100' : 'opacity-0'
                    }`}
                />
              </>
            )}
          </div>
        </div>

        {/* Form hasil ekstraksi */}
        <div className="card" style={reveal(7)}>
          <CardHeader
            title="Detail transaksi"
            hint="Koreksi bila ada yang tidak cocok dengan bukti"
            right={
              <span className={`${tagClass} tabular-nums`}>
                {filledCount}/{filled.length} terisi
              </span>
            }
          />

          <form onSubmit={handleConfirm} className="space-y-4">
            {error && (
              <div className="ocr-pop">
                <Notice kind="error">{error}</Notice>
              </div>
            )}

            <div>
              <p id="ocr-method-label" className={label}>
                Metode pembayaran
              </p>
              <SegmentedSwitch
                value={formData.paymentMethod}
                onChange={setDirect('paymentMethod')}
                options={METHOD_OPTIONS}
                ariaLabel="Metode pembayaran"
                minH="min-h-12"
                fullWidth
                disabled={saved}
              />
            </div>

            <div>
              <label htmlFor="ocr-amount" className={label}>
                {isManualMode ? 'Nominal (Rp)' : 'Nominal terbaca (Rp)'}
              </label>
              <GlowField>
                <input
                  id="ocr-amount"
                  type="number"
                  inputMode="numeric"
                  required
                  min="1"
                  value={formData.amount}
                  onChange={set('amount')}
                  disabled={saved}
                  aria-describedby="ocr-amount-hint"
                  className={`${field} h-12 text-lg font-medium tabular-nums`}
                />
              </GlowField>
              <p id="ocr-amount-hint" className={`${hint} tabular-nums`}>
                {hasAmount ? formatRupiah(amountNumber) : 'Ubah jika hasil baca salah'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ocr-ref" className={label}>
                  ID transaksi
                </label>
                <GlowField>
                  <input
                    id="ocr-ref"
                    type="text"
                    value={formData.referenceId}
                    onChange={set('referenceId')}
                    disabled={saved}
                    placeholder="NMID-992144812"
                    className={`${field} font-mono`}
                  />
                </GlowField>
                <p className={hint}>Dipakai untuk cek duplikat</p>
              </div>

              <div>
                <label htmlFor="ocr-time" className={label}>
                  Jam di struk
                </label>
                <GlowField>
                  <TimeField id="ocr-time" value={formData.time} onChange={setDirect('time')} disabled={saved} />
                </GlowField>
              </div>
            </div>

            <div>
              <label htmlFor="ocr-title" className={label}>
                Keterangan
              </label>
              <GlowField>
                <input
                  id="ocr-title"
                  type="text"
                  value={formData.title}
                  onChange={set('title')}
                  disabled={saved}
                  className={field}
                />
              </GlowField>
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <SparkleSaveButton
                saved={saved}
                locked={!hasAmount}
                label={isDuplicate ? 'Simpan dengan tanda Perlu ditinjau' : 'Konfirmasi dan simpan'}
              />
              {onCancel && (
                <GlowField press className="sm:shrink-0">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="group inline-flex h-full min-h-11 w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-[var(--border-default)] bg-[var(--surface-card)] px-[22px] py-2.5 text-sm font-semibold text-[var(--text-main)] outline-none transition-[color,transform] duration-200 hover:text-[var(--royal-600)] focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-95 motion-reduce:transition-none"
                  >
                    {saved ? (
                      <>
                        Selesai
                        <ArrowRight className={`h-4 w-4 ${ICON_HOVER}`} aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        <X className={`h-4 w-4 ${ICON_HOVER}`} aria-hidden="true" />
                        Batal
                      </>
                    )}
                  </button>
                </GlowField>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}