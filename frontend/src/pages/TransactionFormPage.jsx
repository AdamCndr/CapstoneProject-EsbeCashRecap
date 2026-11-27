import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  History,
  Paperclip,
  ScanText,
  Sun,
  Sunset,
  Trash2,
  Wallet,
  X
} from 'lucide-react';
import { useTimedMessage } from '../hooks/useTimedMessage';
import { useTiltSurface } from '../hooks/useTiltSurface';
import { useMouseGlow } from '../hooks/useMouseGlow';
import { useSmoothResize } from '../hooks/useSmoothResize';
import { usePageReveal } from '../lib/motion';
import DateField from '../components/ui/DateField';
import {
  field,
  ico,
  iconBtn,
  label,
  methodIcon,
  motion,
  Notice
} from '../lib/ui';

const rp = (n) => 'Rp ' + Math.abs(n || 0).toLocaleString('id-ID');

const todayISO = () => new Date().toLocaleDateString('sv-SE');
const nowHHMM = () =>
  new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const emptyForm = () => ({
  title: '',
  type: 'pemasukan',
  category: 'Jasa Fotokopi',
  paymentMethod: 'tunai',
  shift: 'pagi',
  amount: '',
  date: todayISO(),
  time: nowHHMM(),
  notes: '',
  proofUrl: ''
});

const METHOD_OPTIONS = [
  { id: 'tunai', label: 'Tunai', Icon: methodIcon.tunai },
  { id: 'qris', label: 'QRIS', Icon: methodIcon.qris },
  { id: 'transfer', label: 'Transfer Bank', Icon: methodIcon.transfer }
];

const CATEGORY_OPTIONS = [
  { value: 'Jasa Fotokopi', label: 'Jasa fotokopi dan jilid' },
  { value: 'Percetakan & ATK', label: 'Percetakan dan penjualan ATK' },
  { value: 'Perlengkapan', label: 'Perlengkapan dan bahan baku' },
  { value: 'Maintenance', label: 'Maintenance mesin' },
  { value: 'Lain-lain', label: 'Lain-lain' }
];

const TYPE_OPTIONS = [
  { value: 'pemasukan', label: 'Pemasukan', hint: 'Uang masuk' },
  { value: 'pengeluaran', label: 'Pengeluaran', hint: 'Uang keluar' }
];

// Jam shift sama dengan kontrol shift di Dashboard
const SHIFT_META = {
  pagi: { label: 'Pagi', range: '06:00–14:00', Icon: Sun },
  siang: { label: 'Siang', range: '14:00–22:00', Icon: Sunset }
};

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 100000];


// Animasi hover icon (sama dengan tombol "Simulasi OCR AI"); elemen induk icon harus punya class `group`.
const ICON_HOVER = 'transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none';
const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--royal-500)]';
const tagClass =
  'rounded-lg border border-[var(--border-default)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]';
// Tombol di hero: class identik dengan tombol kalender (DateField) di hero Dashboard.
const heroControl = `group relative flex min-h-12 sm:min-h-14 max-sm:w-full cursor-pointer items-center gap-3 rounded-2xl bg-[var(--surface-app)] px-3.5 sm:px-4 py-1.5 text-sm sm:text-base font-semibold text-[var(--text-main)] shadow-[var(--shadow-inset-hero)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-inset-hero-hover)] active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[color:var(--ring-on-dark)] motion-reduce:transition-none`;
// Kartu kaca di hero: sama persis dengan metrik Dashboard.
const glassCard =
  'rounded-2xl bg-[var(--glass-subtle)] border border-[var(--glass-border)] backdrop-blur-xl shadow-[var(--shadow-glass-card)] p-3 sm:p-4';
const textareaField = `w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[color:var(--royal-400)] focus:bg-[var(--surface-card)] focus:outline-none focus:ring-2 focus:ring-[color:var(--royal-300)] motion-reduce:transition-none ${motion}`;

const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]';
const amountField = `h-12 sm:h-14 w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] pr-4 pl-14 text-xl sm:text-2xl font-semibold tabular-nums text-[var(--text-main)] placeholder:text-[var(--text-muted-alt)] focus:border-[color:var(--royal-400)] focus:bg-[var(--surface-card)] focus:outline-none focus:ring-2 focus:ring-[color:var(--royal-300)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none`;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Saklar jenis kas: tampilan & animasi identik dengan filter shift di hero Dashboard
// (bingkai inset, penanda biru yang bergeser dengan efek pegas).
function TypeSwitch({ value, onChange, options, ariaLabel }) {
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
      let y1 = prev?.y1 ?? 1.35;
      if (prev && prev.x !== x) {
        const edge = value !== options[0].value;
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

  const spring = `cubic-bezier(0.34, ${(ind?.y1 ?? 1.35).toFixed(3)}, 0.64, 1)`;

  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label={ariaLabel}
      className="relative flex min-h-12 sm:min-h-14 w-full items-stretch gap-1 rounded-2xl bg-[var(--surface-app)] p-1.5 shadow-[var(--shadow-inset-hero)]"
    >
      <span
        aria-hidden="true"
        className="absolute top-1.5 bottom-1.5 left-0 rounded-xl bg-[var(--royal-600)] shadow-[var(--shadow-indicator)]"
        style={{
          width: ind?.w ?? 0,
          transform: `translateX(${ind?.x ?? 0}px)`,
          opacity: ind ? 1 : 0,
          transition:
            ready && !prefersReducedMotion()
              ? `transform 420ms ${spring}, width 420ms ${spring}`
              : 'none'
        }}
      />
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              btnRefs.current[opt.value] = el;
            }}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`relative z-10 flex flex-1 flex-col items-center justify-center rounded-xl px-3 py-1.5 leading-tight outline-none transition-[color,background-color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-95 motion-reduce:transition-none sm:px-5 ${active ? 'text-[var(--text-inverse)]' : 'text-[var(--text-main)]'
              }`}
          >
            <span className="text-xs sm:text-sm font-semibold">{opt.label}</span>
            <span
              className={`text-[11px] whitespace-nowrap tabular-nums transition-colors duration-200 ${active ? 'text-[color:var(--glass-text-soft)]' : 'text-[var(--text-muted-alt)]'
                }`}
            >
              {opt.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Pill: putih + stroke tipis abu-abu saat diam; glow aksen mengikuti kursor saat hover ──
// Glow digambar di wrapper (.glow-pill): ::after = cincin 1px di tepi (stroke), ::before = halo tipis di luar.
// Kontrol di dalamnya (input/textarea/trigger DateField & select) disamakan lewat override CSS,
// jadi komponen UI bersama tidak perlu diubah.
const GLOW_CSS = `
.glow-pill{position:relative;isolation:isolate;border-radius:var(--pr,.75rem)}
@property --gr{syntax:'<length>';inherits:false;initial-value:150px}
.glow-pill::before,.glow-pill::after{content:'';position:absolute;inset:0;pointer-events:none;border-radius:inherit;opacity:0;transition:opacity 220ms ease}
.glow-pill::before{z-index:-1;background:radial-gradient(90px circle at var(--gx,50%) var(--gy,50%),color-mix(in srgb,var(--royal-500) 55%,transparent),transparent 70%);filter:blur(7px)}
.glow-pill::after{--gr:150px;z-index:2;padding:1px;transition:opacity 220ms ease,padding 300ms ease,--gr 1200ms cubic-bezier(.3,.7,.3,1);background:radial-gradient(var(--gr) circle at var(--gx,50%) var(--gy,50%),var(--royal-500) calc(var(--gr)*.4),color-mix(in srgb,var(--royal-400) 45%,transparent) calc(var(--gr)*.62),transparent calc(var(--gr)*.8));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.glow-pill:hover::before{opacity:.55}
.glow-pill:hover::after{opacity:1}
.glow-pill.glow-press:active::after,.glow-pill.is-active::after{opacity:1;--gr:calc(var(--gd,3000px)*2.6)}
.glow-pill.is-active::after{padding:2px}
.glow-field:focus-within::after,.glow-field:has(button[aria-haspopup][aria-expanded="true"])::after{opacity:1;--gr:calc(var(--gd,3000px)*2.6);padding:2px}
.glow-field :is(input,textarea,select):not([type=hidden]):focus,.glow-field button[aria-haspopup][aria-expanded="true"],.glow-field button[aria-haspopup]:focus{border:1px solid transparent!important;box-shadow:none!important;outline:none!important}
.glow-pill :is(input,textarea,select):not([type=hidden]){display:block}
@media (max-width:639px){.glow-pill :is(input,textarea):not([type=hidden]):not(#amount){font-size:13px}}
@supports (-webkit-touch-callout:none){@media (max-width:639px){.glow-pill :is(input,textarea):not([type=hidden]):not(#amount){font-size:16px}}}
.glow-pill :is(input,textarea,select):not([type=hidden]),.glow-pill button[aria-haspopup]{background-color:var(--surface-card)!important;border-radius:var(--pr,.75rem)!important}
.glow-pill :is(input,textarea,select):not([type=hidden]):not(:focus),.glow-pill button[aria-haspopup]:not([aria-expanded="true"]):not(:focus){border:1px solid var(--border-default)!important;box-shadow:none!important}
.glow-pill button[aria-haspopup]:hover:not(:active){transform:none!important;translate:none!important}
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

// Klik: simpan titik klik + jarak ke sudut terjauh, supaya glow mengembang sampai menutup SELURUH keliling pill (full stroke).
function pressGlow(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  el.style.setProperty('--gx', `${x}px`);
  el.style.setProperty('--gy', `${y}px`);
  el.style.setProperty('--gd', `${Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y))}px`);
}

// Pembungkus pill mandiri (dipakai chip). Field memakai mekanisme yang sama.
// active  : state terpilih → glow dari titik klik mengembang jadi stroke penuh (menggantikan border/ring lama).
// press   : tanpa state tetap (chip aksi) → stroke penuh hanya selama ditekan.
function GlowPill({ radius = '0.75rem', className = '', active = false, press = false, children }) {
  return (
    <div
      className={`glow-pill ${active ? 'is-active' : ''} ${press ? 'glow-press' : ''} ${className}`}
      style={{ '--pr': radius }}
      onMouseMove={trackGlow}
      onPointerDown={pressGlow}
    >
      {children}
    </div>
  );
}

// Pembungkus field: label ikut berwarna saat field fokus; error muncul dengan transisi tinggi halus.
function Field({ htmlFor, text, required, optional, right, error, errorText, errorId, children, className = '', radius = '0.75rem' }) {
  return (
    <div className={`group/field ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className={`${label} mb-0 transition-colors duration-200 group-focus-within/field:text-[var(--royal-600)] motion-reduce:transition-none`}
        >
          {text}
          {required && <span className="text-[var(--cash-out)]"> *</span>}
          {optional && <span className="font-normal text-[var(--text-muted)]"> (opsional)</span>}
        </label>
        {right}
      </div>
      <div
        style={{ '--pr': radius }}
        onMouseMove={trackGlow}
        onPointerDown={pressGlow}
        className={`glow-pill glow-field transition-shadow duration-300 motion-reduce:transition-none ${error ? 'ring-2 ring-[color:var(--cash-out)]' : 'ring-0 ring-transparent'
          }`}
      >
        {children}
      </div>
      {errorText && (
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ${EASE} motion-reduce:transition-none ${error ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
        >
          <div className="overflow-hidden">
            <p id={errorId} role="alert" className="pt-1.5 text-xs font-medium text-[var(--cash-out)]">
              {errorText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

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
// Ukuran teks dropdown & opsi — ubah di satu tempat ini
const SELECT_TEXT = 'text-[13px] sm:text-[15px]';
const triggerBase = `group flex h-10 w-full cursor-pointer items-center gap-2.5 border border-[var(--border-default)] px-3 text-left font-medium text-[var(--text-main)] outline-none transition-[border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] motion-reduce:transition-none ${SELECT_TEXT}`;
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

// ── Dropdown kategori ──
function CategorySelect({ id, value, options, onChange, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const trigRef = useRef(null);
  const selIdx = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selIdx];

  const close = useCallback((refocus) => {
    setOpen(false);
    if (refocus) trigRef.current?.focus();
  }, []);
  const openMenu = () => {
    setActive(selIdx);
    setOpen(true);
  };
  const choose = (opt) => {
    onChange(opt.value);
    close(true);
  };

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'ArrowDown') setActive((i) => Math.min(options.length - 1, i + 1));
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(options.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') choose(options[active]);
    else if (e.key === 'Tab') {
      close(false);
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <>
      <button
        ref={trigRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`${triggerBase} ${open ? triggerOpen : ''}`}
      >
        <span className="min-w-0 flex-1 truncate">{current?.label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-300 ${EASE} motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <Popover
        open={open}
        anchorRef={trigRef}
        onClose={close}
        width={240}
        matchWidth
        role="listbox"
        id={`${id}-list`}
        ariaLabel={ariaLabel}
        className={`${popSurface} p-1.5`}
      >
        {options.map((opt, i) => {
          const sel = opt.value === value;
          return (
            <div
              key={opt.value}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={sel}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(opt)}
              className={`group flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 motion-reduce:transition-none ${SELECT_TEXT} ${sel
                ? 'bg-[var(--royal-50)] font-semibold text-[var(--royal-700)]'
                : i === active
                  ? 'bg-[var(--surface-muted)] text-[var(--text-main)]'
                  : 'text-[var(--text-main)]'
                }`}
            >
              <span className="min-w-0 truncate">{opt.label}</span>
              {sel && <Check className={`h-4 w-4 shrink-0 text-[var(--royal-600)] ${ICON_HOVER}`} strokeWidth={2.5} aria-hidden="true" />}
            </div>
          );
        })}
      </Popover>
    </>
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
                className={`flex h-10 w-full items-center justify-center rounded-xl text-[13px] sm:text-[15px] tabular-nums outline-none transition-[background-color,color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-95 motion-reduce:transition-none ${sel
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
      <div className="flex items-baseline justify-center gap-1 pb-3 text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--text-main)] tabular-nums">
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

function TimeField({ id, value, onChange }) {
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
        aria-label="Jam transaksi"
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
.sparkle-btn:disabled,
.sparkle-btn:disabled:hover {
  background: var(--surface-muted);
  border-color: var(--border-default);
  color: var(--text-muted);
  box-shadow: none;
  cursor: not-allowed;
}
.sparkle-btn:disabled:active { transform: none; }
.sparkle-btn:disabled .sp { display: none; }
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

// Tombol simpan dengan efek bintang: bintang meledak keluar saat hover.
function SparkleSaveButton({ saved, block = false }) {
  return (
    <>
      <style>{SPARKLE_CSS}</style>
      <button
        type="submit"
        form="transaction-form"
        className={`group sparkle-btn shrink-0${block ? ' w-full' : ''}`}
      >
        <span className="grid place-items-center">
          <span
            className={`col-start-1 row-start-1 inline-flex items-center gap-2 transition-all duration-300 ${EASE} motion-reduce:transition-none ${saved ? '-translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
              }`}
          >
            <Check {...ico} className={`${ico?.className ?? 'h-4 w-4'} ${ICON_HOVER}`} />
            Simpan transaksi
          </span>
          <span
            aria-hidden={!saved}
            className={`col-start-1 row-start-1 inline-flex items-center gap-2 transition-all duration-300 ${EASE} motion-reduce:transition-none ${saved ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
              }`}
          >
            <CheckCircle2 {...ico} className={`${ico?.className ?? 'h-4 w-4'} ${ICON_HOVER}`} />
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
    </>
  );
}

// Header kartu: sama dengan CardHeader di Dashboard (judul 18px semibold, subjudul 14px muted).
function CardHeader({ title, hint: hintText, right }) {
  return (
    <div className="mb-4 sm:mb-5 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-[11rem] flex-1">
        <h2 className="text-base sm:text-lg leading-snug font-semibold text-[var(--text-main)]">{title}</h2>
        {hintText && <p className="mt-1 text-xs sm:text-sm leading-snug text-[var(--text-muted)]">{hintText}</p>}
      </div>
      {right}
    </div>
  );
}

export default function TransactionFormPage({
  currentShift = 'pagi',
  onSaveTransaction,
  onNavigateToHistory,
  onNavigateToOcr
}) {
  const [form, setForm] = useState(() => ({
    ...emptyForm(),
    shift: currentShift
  }));
  const [proofPreview, setProofPreview] = useState('');
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const {
    message: feedback,
    showMessage: showFeedback,
    clearMessage: clearFeedback
  } = useTimedMessage({ type: '', message: '' }, 5000);
  const { reveal } = usePageReveal();

  // Efek hero yang sama dengan Dashboard: glow mengikuti mouse + aksen tilt pada kartu kaca.
  // Kartu kaca tidak punya transform reveal sendiri (hero yang di-reveal), jadi tilt aman aktif langsung.
  const heroGlow = useMouseGlow({ size: 420, opacity: 0.12 });
  const tiltAmount = useTiltSurface({ enabled: true });
  const tiltShift = useTiltSurface({ enabled: true });
  const tiltNota = useTiltSurface({ enabled: true });
  useSmoothResize(tiltShift.ref);
  useSmoothResize(tiltNota.ref);

  const set = (key) => (e) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  };

  // Status "Tersimpan" pada tombol hilang sendiri setelah sebentar
  useEffect(() => {
    if (!saved) return undefined;
    const t = setTimeout(() => setSaved(false), 2200);
    return () => clearTimeout(t);
  }, [saved]);
  const setValue = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleProofChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showFeedback({ type: 'error', message: 'File harus berupa gambar (JPG atau PNG)' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProofPreview(reader.result);
      setForm((prev) => ({ ...prev, proofUrl: reader.result }));
      clearFeedback();
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProof = () => {
    setProofPreview('');
    setForm((prev) => ({ ...prev, proofUrl: '' }));
  };

  const handleAddQuickAmount = (val) => {
    const current = Number(form.amount) || 0;
    setForm((prev) => ({ ...prev, amount: String(current + val) }));
    setErrors((prev) => (prev.amount ? { ...prev, amount: false } : prev));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const titleBad = !form.title.trim();
    const amountBad = !form.amount || Number(form.amount) <= 0;
    if (titleBad || amountBad) {
      setErrors({ title: titleBad, amount: amountBad });
      showFeedback({ type: 'error', message: 'Lengkapi keterangan dan nominal transaksi dengan benar' });
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

    setForm({
      ...emptyForm(),
      shift: form.shift
    });
    setProofPreview('');
    setErrors({});
    setSaved(true);
    showFeedback({
      type: 'success',
      message: `Transaksi "${newTrx.title}" (${rp(newTrx.amount)}) berhasil disimpan ke rekap!`
    });
  };

  const isExpense = form.type === 'pengeluaran';
  const activeMethod = METHOD_OPTIONS.find((m) => m.id === form.paymentMethod) || METHOD_OPTIONS[0];
  const ActiveMethodIcon = activeMethod.Icon;
  const shiftMeta = SHIFT_META[form.shift] || SHIFT_META.pagi;
  const ShiftIcon = shiftMeta.Icon;
  const TypeIcon = isExpense ? ArrowUpRight : ArrowDownLeft;

  // Kelengkapan kolom wajib (keterangan + nominal) — progress bar seperti metrik Dashboard
  const requiredDone = (form.title.trim() ? 1 : 0) + (Number(form.amount) > 0 ? 1 : 0);
  const requiredPct = (requiredDone / 2) * 100;
  const needsProof = form.paymentMethod !== 'tunai' && !proofPreview;

  return (
    <div className="space-y-3 sm:space-y-5">
      <style>{GLOW_CSS + POP_CSS}</style>

      {/* HERO SECTION */}
      <section
        ref={heroGlow.ref}
        onMouseMove={heroGlow.onMouseMove}
        onMouseLeave={heroGlow.onMouseLeave}
        className="relative overflow-hidden rounded-[22px] p-4 sm:p-5 text-[var(--text-inverse)] shadow-[var(--shadow-royal-hero)] lg:p-6"
        style={{ background: 'var(--grad-hero)', ...reveal(0) }}
        aria-label="Catat transaksi baru"
      >
        {/* Aksen: cincin konsentris (garis tipis) di pojok kanan atas */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-44 -right-36 h-[32rem] w-[32rem] rounded-full border border-[var(--glass-line)]"
        >
          <div className="absolute inset-12 rounded-full border border-[var(--glass-line)]" />
          <div className="absolute inset-24 rounded-full border border-[var(--glass-line)]" />
          <div className="absolute inset-36 rounded-full border border-[var(--glass-line)]" />
        </div>
        <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 rounded-[22px]" />

        <div className="relative grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_42rem] xl:items-stretch">
          {/* Kiri: judul halaman + pintasan */}
          <div className="relative z-10 flex min-w-0 flex-col gap-4 sm:gap-6">
            <div className="flex flex-1 flex-col justify-center">
              <h1 className="text-2xl leading-[1.15] font-semibold tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
                Catat Transaksi
              </h1>
            </div>

            <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              {onNavigateToOcr && (
                <button type="button" onClick={onNavigateToOcr} className={heroControl}>
                  <ScanText className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-[var(--royal-600)] ${ICON_HOVER}`} aria-hidden="true" />
                  Simulasi OCR AI
                </button>
              )}
              {onNavigateToHistory && (
                <button type="button" onClick={onNavigateToHistory} className={heroControl}>
                  <History className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-[var(--royal-600)] ${ICON_HOVER}`} aria-hidden="true" />
                  Lihat riwayat
                  <ArrowRight className={`h-4 w-4 shrink-0 text-[var(--text-muted)] ${ICON_HOVER}`} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Kanan: tiga kartu kaca dalam satu baris */}
          <div className="relative grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Nominal */}
            <div
              ref={tiltAmount.ref}
              onMouseMove={tiltAmount.onMouseMove}
              onMouseLeave={tiltAmount.onMouseLeave}
              className={`group ${glassCard} col-span-2 flex flex-col sm:col-span-1`}
            >
              <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                <Wallet className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                Nominal input
              </p>
              <p className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight break-words tabular-nums">
                {form.amount ? rp(form.amount) : 'Rp 0'}
              </p>
              <div className="mt-auto pt-3">
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-line)]"
                  role="progressbar"
                  aria-valuenow={requiredPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Kolom wajib terisi ${requiredDone} dari 2`}
                >
                  <div
                    className="h-full rounded-full bg-[var(--text-inverse)] transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: `${requiredPct}%` }}
                  />
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-xs text-[color:var(--glass-text-soft)]">
                  <TypeIcon className={`h-3.5 w-3.5 ${ICON_HOVER}`} aria-hidden="true" />
                  {isExpense ? 'Pengeluaran kas' : 'Pemasukan kas'} · {requiredDone}/2 wajib
                </p>
              </div>
            </div>

            {/* Shift */}
            <div
              ref={tiltShift.ref}
              onMouseMove={tiltShift.onMouseMove}
              onMouseLeave={tiltShift.onMouseLeave}
              className={`group ${glassCard} flex flex-col`}
            >
              <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                <ShiftIcon className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                Shift kerja
              </p>
              <p className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight">{shiftMeta.label}</p>
              <p className="mt-auto pt-3 text-xs text-[color:var(--glass-text-soft)] tabular-nums">
                {shiftMeta.range} WIB
              </p>
            </div>

            {/* Bukti nota */}
            <div
              ref={tiltNota.ref}
              onMouseMove={tiltNota.onMouseMove}
              onMouseLeave={tiltNota.onMouseLeave}
              className={`group ${glassCard} flex flex-col`}
            >
              <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                <Paperclip className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                Bukti nota
              </p>
              <p className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight">
                {proofPreview ? 'Terlampir' : 'Belum ada'}
              </p>
              <p
                className={`mt-auto flex items-center gap-1.5 pt-3 text-xs ${needsProof ? 'font-medium text-[var(--text-inverse)]' : 'text-[color:var(--glass-text-soft)]'
                  }`}
              >
                {needsProof && (
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--amber-400)]" aria-hidden="true" />
                )}
                {proofPreview
                  ? 'Struk siap disimpan'
                  : needsProof
                    ? 'Non-tunai sebaiknya ada nota'
                    : 'Opsional untuk tunai'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEEDBACK NOTIFICATION */}
      {feedback.message && (
        <Notice kind={feedback.type === 'success' ? 'success' : 'error'}>
          <span className="min-w-0 flex-1 font-medium">{feedback.message}</span>
          <button
            type="button"
            onClick={clearFeedback}
            className={`group ${iconBtn}`}
            aria-label="Tutup notifikasi"
          >
            <X {...ico} className={`${ico?.className ?? 'h-4 w-4'} ${ICON_HOVER}`} />
          </button>
        </Notice>
      )}

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        {/* KOLOM KIRI: FORMULIR INPUT TRANSAKSI */}
        <section className="card" style={reveal(1)}>
          <CardHeader
            title="Formulir transaksi"
            hint="Pastikan nominal dan metode pembayaran sesuai bukti transaksi fisik atau digital."
            right={<div className="hidden sm:block"><SparkleSaveButton saved={saved} /></div>}
          />

          <form id="transaction-form" onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
            {/* JENIS KAS */}
            <div>
              <p className={label}>Jenis kas</p>
              <TypeSwitch
                ariaLabel="Jenis kas"
                value={form.type}
                options={TYPE_OPTIONS}
                onChange={(value) => setValue('type', value)}
              />
            </div>

            {/* METODE PEMBAYARAN */}
            <div className="border-t border-[var(--border-default)] pt-4 sm:pt-5">
              <p className={label}>Metode pembayaran</p>
              <fieldset className="grid grid-cols-3 gap-2 sm:gap-3">
                <legend className="sr-only">Metode pembayaran</legend>
                {METHOD_OPTIONS.map((m) => {
                  const active = form.paymentMethod === m.id;
                  const Icon = m.Icon;
                  return (
                    <GlowPill
                      key={m.id}
                      radius="0.75rem"
                      active={active}
                      className={`h-full transition-transform duration-300 ${EASE} hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none`}
                    >
                      <label
                        className={`group/m relative flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 sm:gap-2.5 rounded-xl border p-2.5 sm:p-3.5 text-center text-xs transition-all duration-300 ${EASE} motion-reduce:transition-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--royal-300)] ${active
                          ? 'border-transparent bg-[var(--royal-50)] font-semibold text-[var(--royal-700)]'
                          : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-muted)]'
                          }`}
                      >
                        <input
                          type="radio"
                          name="transaction-method"
                          value={m.id}
                          checked={active}
                          onChange={() => setValue('paymentMethod', m.id)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--royal-600)] text-[var(--text-inverse)] transition-all duration-300 ${EASE} motion-reduce:transition-none ${active ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                            }`}
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        <span
                          className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl transition-all duration-300 ${EASE} motion-reduce:transition-none ${active
                            ? 'bg-[var(--royal-600)] text-[var(--text-inverse)]'
                            : 'bg-[var(--surface-muted)] text-[var(--royal-600)] group-hover/m:scale-105'
                            }`}
                        >
                          <Icon className="h-5 w-5 transition-transform duration-200 group-hover/m:scale-110 group-hover/m:-rotate-6 motion-reduce:transition-none" aria-hidden="true" />
                        </span>
                        {m.label}
                      </label>
                    </GlowPill>
                  );
                })}
              </fieldset>
            </div>

            {/* DETAIL TRANSAKSI */}
            <div className="space-y-4 border-t border-[var(--border-default)] pt-4 sm:pt-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  htmlFor="title"
                  text="Keterangan transaksi"
                  required
                  error={errors.title}
                  errorText="Isi keterangan transaksi"
                  errorId="title-error"
                >
                  <input
                    id="title"
                    type="text"
                    placeholder="Contoh: fotokopi modul 50 lembar"
                    value={form.title}
                    onChange={set('title')}
                    aria-invalid={!!errors.title}
                    aria-describedby={errors.title ? 'title-error' : undefined}
                    className={field}
                  />
                </Field>

                <Field htmlFor="category" text="Kategori">
                  <CategorySelect
                    id="category"
                    ariaLabel="Kategori transaksi"
                    value={form.category}
                    options={CATEGORY_OPTIONS}
                    onChange={(value) => setValue('category', value)}
                  />
                </Field>
              </div>

              <Field
                htmlFor="amount"
                text="Nominal transaksi"
                radius="1rem"
                required
                error={errors.amount}
                errorText="Masukkan nominal lebih dari Rp 0"
                errorId="amount-error"
                right={
                  <span
                    className={`text-xs font-semibold text-[var(--royal-600)] tabular-nums transition-opacity duration-300 motion-reduce:transition-none ${Number(form.amount) > 0 ? 'opacity-100' : 'opacity-0'
                      }`}
                    aria-hidden={!(Number(form.amount) > 0)}
                  >
                    {rp(form.amount)}
                  </span>
                }
              >
                <div className="relative">
                  <span className="absolute top-1/2 left-3 -translate-y-1/2 rounded-lg bg-[var(--surface-card)] px-2 py-1 text-sm font-semibold text-[var(--text-muted)] shadow-[var(--shadow-royal-card)]">
                    Rp
                  </span>
                  <input
                    id="amount"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    placeholder="0"
                    value={form.amount}
                    onChange={set('amount')}
                    aria-invalid={!!errors.amount}
                    aria-describedby={errors.amount ? 'amount-error' : undefined}
                    className={amountField}
                  />
                </div>
              </Field>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-[var(--text-muted)]">Tambah cepat:</span>
                {QUICK_AMOUNTS.map((amt) => (
                  <GlowPill
                    key={amt}
                    radius="0.5rem"
                    press
                    className="inline-flex transition-transform duration-200 active:scale-90 motion-reduce:transition-none"
                  >
                    <button
                      type="button"
                      onClick={() => handleAddQuickAmount(amt)}
                      className={`rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-2.5 py-1.5 sm:py-1 text-xs font-medium text-[var(--text-main)] ${focusRing}`}
                    >
                      +{amt >= 1000 ? `${amt / 1000}k` : amt}
                    </button>
                  </GlowPill>
                ))}
                <GlowPill
                  radius="0.5rem"
                  press
                  className={`ml-auto inline-flex transition-all duration-300 ${EASE} active:scale-90 motion-reduce:transition-none ${Number(form.amount) > 0 ? 'scale-100 opacity-100' : 'pointer-events-none scale-90 opacity-0'
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => setValue('amount', '')}
                    tabIndex={Number(form.amount) > 0 ? 0 : -1}
                    aria-hidden={!(Number(form.amount) > 0)}
                    className={`rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-2.5 py-1.5 sm:py-1 text-xs font-medium text-[var(--cash-out)] ${focusRing}`}
                  >
                    Reset
                  </button>
                </GlowPill>
              </div>
            </div>

            {/* WAKTU & CATATAN */}
            <div className="space-y-4 border-t border-[var(--border-default)] pt-4 sm:pt-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field htmlFor="date" text="Tanggal">
                  <DateField
                    id="date"
                    ariaLabel="Tanggal transaksi"
                    value={form.date}
                    onChange={(value) => setValue('date', value)}
                    allowClear={false}
                  />
                </Field>

                <Field
                  htmlFor="time"
                  text="Jam (WIB)"
                  right={
                    <button
                      type="button"
                      onClick={() => setValue('time', nowHHMM())}
                      className={`group -my-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-[var(--royal-600)] transition-all duration-200 hover:bg-[var(--royal-50)] active:scale-95 motion-reduce:transition-none ${focusRing}`}
                    >
                      <Clock className={`h-3 w-3 ${ICON_HOVER}`} aria-hidden="true" />
                      Sekarang
                    </button>
                  }
                >
                  <TimeField id="time" value={form.time} onChange={(value) => setValue('time', value)} />
                </Field>
              </div>

              <Field htmlFor="notes" text="Catatan" optional>
                <textarea
                  id="notes"
                  rows="2"
                  placeholder="Nama pemesan, no referensi transaksi QRIS, atau rincian tambahan..."
                  value={form.notes}
                  onChange={set('notes')}
                  className={textareaField}
                />
              </Field>
            </div>
            {/* Mobile: tombol simpan di akhir form (yang di header kartu disembunyikan) */}
            <div className="sm:hidden">
              <SparkleSaveButton saved={saved} block />
            </div>
          </form>
        </section>

        {/* KOLOM KANAN: BUKTI & PRATINJAU STRUK */}
        <div className="min-w-0 space-y-3 sm:space-y-5">
          <section className="card" style={reveal(2)}>
            <CardHeader
              title="Bukti transaksi"
              hint="Foto nota fisik atau screenshot transfer/QRIS"
              right={<span className={tagClass}>Opsional</span>}
            />

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
                  className="group flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-[var(--border-default)] bg-[var(--surface-muted)] p-5 sm:p-6 text-center transition-colors hover:border-[color:var(--royal-500)] peer-focus-visible:border-[color:var(--royal-400)] peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--royal-300)] motion-reduce:transition-none"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-card)] text-[var(--royal-600)] shadow-[var(--shadow-royal-card)]">
                    <Camera className={`h-6 w-6 ${ICON_HOVER}`} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[13px] sm:text-sm font-semibold text-[var(--text-main)]">
                      Pilih foto bukti atau seret ke sini
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                      Mendukung format JPG atau PNG
                    </span>
                  </span>
                </label>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-3">
                <div className="flex max-h-56 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)]">
                  <img
                    src={proofPreview}
                    alt="Pratinjau bukti"
                    className="max-h-56 w-auto object-contain"
                  />
                </div>
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="group flex items-center gap-1.5 font-medium text-[var(--cash-in)]">
                    <CheckCircle2 className={`h-4 w-4 ${ICON_HOVER}`} aria-hidden="true" />
                    Bukti siap disimpan
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveProof}
                    className={`group flex cursor-pointer items-center gap-1 font-medium text-[var(--cash-out)] hover:underline ${focusRing}`}
                  >
                    <Trash2 className={`h-3.5 w-3.5 ${ICON_HOVER}`} aria-hidden="true" />
                    Hapus
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="card flex flex-col justify-between" style={reveal(3)}>
            <div>
              <CardHeader
                title="Ringkasan struk"
                hint="Pratinjau data sebelum disimpan"
                right={<span className={tagClass}>Live preview</span>}
              />

              <div className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-3.5 sm:p-4">
                <div className="border-b border-dashed border-[var(--border-strong)] pb-3 text-center">
                  <p className="text-xs font-semibold text-[var(--royal-700)]">
                    Fotocopy Esbe Lampu Merah
                  </p>
                  <div className="mt-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${isExpense
                        ? 'bg-[var(--cash-out-light)] text-[var(--cash-out)]'
                        : 'bg-[var(--cash-in-light)] text-[var(--cash-in)]'
                        }`}
                    >
                      {isExpense ? 'Pengeluaran kas' : 'Pemasukan kas'}
                    </span>
                  </div>
                  <p className="mt-2 text-xl sm:text-2xl font-semibold text-[var(--text-main)] tabular-nums">
                    {form.amount ? rp(form.amount) : 'Rp 0'}
                  </p>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Keterangan</span>
                    <span className="min-w-0 break-words text-right font-medium text-[var(--text-main)]">
                      {form.title.trim() || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">Kategori</span>
                    <span className="font-medium text-[var(--text-main)]">{form.category}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">Metode</span>
                    <span className="group flex items-center gap-1 font-medium text-[var(--text-main)]">
                      <ActiveMethodIcon className={`h-3.5 w-3.5 text-[var(--royal-600)] ${ICON_HOVER}`} aria-hidden="true" />
                      {activeMethod.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">Shift</span>
                    <span className="flex items-center gap-1.5 font-medium text-[var(--text-main)]">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${form.shift === 'siang' ? 'bg-[var(--shift-siang)]' : 'bg-[var(--shift-pagi)]'
                          }`}
                      />
                      {shiftMeta.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">Waktu</span>
                    <span className="font-medium text-[var(--text-main)] tabular-nums">
                      {form.date} · {form.time} WIB
                    </span>
                  </div>
                  {form.notes && (
                    <div className="flex items-start justify-between gap-2 border-t border-[var(--border-default)] pt-2">
                      <span className="text-[var(--text-muted)]">Catatan</span>
                      <span className="min-w-0 break-words text-right font-medium text-[var(--text-main)] italic">
                        {form.notes}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
              Transaksi otomatis tersinkronisasi ke penyimpanan lokal karyawan.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}