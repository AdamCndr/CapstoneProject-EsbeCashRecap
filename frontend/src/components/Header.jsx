import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, Download, LogOut, Plus, Search, User, Wallet, X } from 'lucide-react';
import { useMouseGlow } from '../hooks/useMouseGlow';

const rp = (n) => 'Rp ' + Math.abs(n || 0).toLocaleString('id-ID');

const FLARE = 24;
// Warna sayap: aksen primer royal blueprint (theme/palette.css).
// Ditulis sebagai class literal di <Wing> ([--wing:...]) supaya terdeteksi Tailwind.
const TUCK = 32; // seberapa dalam sayap terselip di belakang notch tengah

// ── Animasi ─────────────────────────────────────────────────────────────
// Masuk : notch turun dulu, jeda sebentar, lalu sayap keluar dari belakang notch.
// Keluar: sayap masuk kembali ke belakang notch dulu, baru notch naik.
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_IN = 'cubic-bezier(0.55, 0, 1, 0.45)';
const NOTCH_IN = 900;
const NOTCH_OUT = 650;
const WING_IN = 800;
const WING_OUT = 550;
const WING_DELAY_IN = 950; // jeda: sayap baru keluar setelah notch benar-benar mendarat
const NOTCH_DELAY_OUT = 400; // notch menunggu sayap hampir masuk seluruhnya
const BOX_IN = 500; // mode kotak: tidak ada sayap, jadi gerakannya lebih singkat
const BOX_OUT = 350;
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// Titik shift: versi cerah dari --shift-siang / --shift-pagi agar tetap terlihat di sayap biru.
const SHIFTS = {
  siang: { label: 'Siang', time: '14:00–21:00', dot: 'var(--royal-400)' },
  pagi: { label: 'Pagi', time: '06:00–14:00', dot: 'var(--amber-400)' },
};

const WING_RADIUS = 24; // sama dengan rounded-b-[24px] notch
// Shadow sayap: tipis selama sayap bergerak, lalu pelan-pelan naik ke kekuatan default
// setelah sayap selesai keluar.
const WING_SHADOW_START = 0.35; // kekuatan saat sayap bergerak
const WING_SHADOW_END = 1; // kekuatan default setelah sayap diam
// Lebar sayap mengikuti isi: sayap terlebar di satu role menjadi patokan untuk
// kedua sayap role itu (kiri = kanan), jadi tiap role bisa punya lebar berbeda.
// WING_PAD = padding kiri + kanan sayap; batas atas menjaga notch + sayap muat di viewport.
const WING_PAD = 20 + TUCK + 16;
const WING_MAX = 'calc(50vw - 14rem)';

// ── Deteksi background biru di bawah sayap ──────────────────────────────
// Sayap default berwarna royal-700. Kalau elemen di bawahnya warnanya sama/mirip (termasuk
// gradient), sayap ganti putih supaya tidak menyatu. Cek ulang saat scroll, resize, dan berkala (konten bisa berubah).
// Parameter sensitivitas deteksi
const DETECT_LIMIT_ENTER = 100; // jarak warna maksimum agar dianggap "mirip sayap" (sebelumnya 65)
const DETECT_LIMIT_STAY = 125; // lebih longgar saat sudah putih (hysteresis, sebelumnya 90)
const ENTER_RATIO = 0.2; // porsi sampel biru yang memicu sayap putih (sebelumnya > 50%)
const SAMPLE_X = [0.08, 0.3, 0.5, 0.7, 0.92];
const SAMPLE_Y = [0.15, 0.5, 0.85];
const CHECK_INTERVAL = 120; // ms (sebelumnya 400)

let probeCtx = null;
function parseColor(css) {
  if (!css || css === 'transparent' || css === 'rgba(0, 0, 0, 0)') return null;
  if (!probeCtx) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    probeCtx = c.getContext('2d', { willReadFrequently: true });
  }
  probeCtx.clearRect(0, 0, 1, 1);
  probeCtx.fillStyle = '#000';
  probeCtx.fillStyle = css;
  probeCtx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probeCtx.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
}

// Jarak warna (redmean, perkiraan persepsi mata). 0 = identik; < ~65 = "mirip".
function colorDistance(p, q) {
  const rm = (p.r + q.r) / 2;
  const dr = p.r - q.r;
  const dg = p.g - q.g;
  const db = p.b - q.b;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) / 3;
}

// Rata-rata warna opak dari sebuah gradient (computed style selalu berisi rgb()/color()).
function gradientColor(image) {
  if (!image || !image.includes('gradient')) return null;
  const stops = (image.match(/(?:rgba?|hsla?|color|oklab|oklch|lab|lch)\([^)]*\)/g) || [])
    .map(parseColor)
    .filter((c) => c && c.a >= 0.6);
  if (!stops.length) return null;
  const sum = stops.reduce((t, c) => ({ r: t.r + c.r, g: t.g + c.g, b: t.b + c.b }), { r: 0, g: 0, b: 0 });
  return { r: sum.r / stops.length, g: sum.g / stops.length, b: sum.b / stops.length, a: 1 };
}

// Warna background opak pertama di bawah titik (x, y), mengabaikan header itu sendiri.
// Mendukung background-color biasa maupun gradient (mis. kartu hero biru).
function backgroundAt(x, y) {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (el.closest('[data-header-root]')) continue;
    const cs = getComputedStyle(el);
    const g = gradientColor(cs.backgroundImage);
    if (g) return g;
    const c = parseColor(cs.backgroundColor);
    if (c && c.a >= 0.6) return c;
  }
  return null;
}

function useBlueBehind(ref, active, left) {
  const [onBlue, setOnBlue] = useState(false);
  const onRef = useRef(false);

  useEffect(() => {
    if (!active) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    let raf = 0;

    const check = () => {
      raf = 0;
      const parent = el.offsetParent;
      if (!parent || !el.offsetWidth) return; // sayap disembunyikan (< lg)
      const wing = parseColor(getComputedStyle(el).getPropertyValue('--royal-700').trim());
      if (!wing) return;
      // Lebih sensitif: ambang jarak warna dilonggarkan (menangkap biru yang lebih terang/gelap/transparan)
      const limit = onRef.current ? DETECT_LIMIT_STAY : DETECT_LIMIT_ENTER;
      // Posisi akhir sayap (offsetLeft/Top tidak terpengaruh transform animasi)
      const pr = parent.getBoundingClientRect();
      const top = pr.top + el.offsetTop;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const x0 = pr.left + el.offsetLeft + (left ? 0 : TUCK);
      const vw = w - TUCK; // bagian yang terlihat (tidak tertutup notch)

      // Grid sampel 5 kolom x 3 baris (sebelumnya hanya 3 titik di tengah)
      let valid = 0;
      let blue = 0;
      SAMPLE_Y.forEach((fy) => {
        const y = top + h * fy;
        SAMPLE_X.forEach((fx) => {
          const x = x0 + vw * fx;
          if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return;
          const c = backgroundAt(x, y);
          valid += 1;
          if (c && colorDistance(c, wing) < limit) blue += 1;
        });
      });
      if (valid) {
        // Masuk mode putih jika >= 20% sampel biru; tetap putih selama masih ada 1 sampel biru
        const next = onRef.current ? blue > 0 : blue / valid >= ENTER_RATIO;
        if (next !== onRef.current) {
          onRef.current = next;
          setOnBlue(next);
        }
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };

    schedule();
    const first = setTimeout(schedule, WING_DELAY_IN); // tepat saat sayap mulai muncul
    const iv = setInterval(schedule, CHECK_INTERVAL);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [ref, active, left]);

  return onBlue;
}

// Lengkung cekung (flare) notch tengah, digambar SVG supaya tepinya anti-alias.
function Flare({ side, color, className = '' }) {
  const left = side === 'left';
  const d = left
    ? `M0 0 H${FLARE + 0.5} V${FLARE} H${FLARE} A${FLARE} ${FLARE} 0 0 0 0 0 Z`
    : `M${FLARE} 0 H-0.5 V${FLARE} H0 A${FLARE} ${FLARE} 0 0 1 ${FLARE} 0 Z`;
  return (
    <svg
      aria-hidden="true"
      width={FLARE}
      height={FLARE}
      viewBox={`0 0 ${FLARE} ${FLARE}`}
      className={className}
      style={{ overflow: 'visible' }}
    >
      <path d={d} style={{ fill: color }} />
    </svg>
  );
}

// Bentuk sayap = SATU path (flare luar + bodi + sudut bawah membulat).
// Ukuran bodi diukur dari elemen sayap.
function WingShape({ left, w, h, onBlue, shadow }) {
  if (!w || !h) return null;
  const F = FLARE;
  const R = Math.min(WING_RADIUS, h / 2, w / 2);
  const d =
    `M${-F} 0 H${w} V${h - R} A${R} ${R} 0 0 1 ${w - R} ${h} H${R} ` +
    `A${R} ${R} 0 0 1 0 ${h - R} V${F} A${F} ${F} 0 0 0 ${-F} 0 Z`;
  return (
    <svg
      aria-hidden="true"
      width={w + F}
      height={h}
      viewBox={`${-F} 0 ${w + F} ${h}`}
      className="pointer-events-none absolute top-0"
      style={{
        overflow: 'visible',
        [left ? 'left' : 'right']: -F,
        transform: left ? undefined : 'scaleX(-1)', // sayap kanan = cermin sayap kiri
      }}
    >
      {/* Lapisan shadow: path yang sama di bawah bodi. drop-shadow mengikuti bentuk melengkung,
          dan opacity lapisan ini yang mengatur kekuatan shadow. Baru muncul (fade) setelah
          sayap selesai keluar, dan mati seketika saat sayap mulai masuk. */}
      <path
        d={d}
        style={{
          fill: 'var(--wing)',
          filter: onBlue ? 'var(--shadow-header-light)' : 'var(--shadow-header-dark)',
          opacity: shadow === 2 ? WING_SHADOW_END : shadow === 1 ? WING_SHADOW_START : 0,
          transition: `opacity ${shadow === 2 ? 700 : shadow === 1 ? 300 : 150}ms ${EASE_OUT}, filter 300ms ${EASE_OUT}`,
        }}
      />
      <path d={d} style={{ fill: 'var(--wing)', transition: `fill 300ms ${EASE_OUT}` }} />
    </svg>
  );
}

/** Sayap ungu di kiri/kanan notch. Hanya tampil di layar lebar (lg+). */
function Wing({ side, open, width, onMeasure, interactive = false, onClick, label, children }) {
  const left = side === 'left';
  const Tag = interactive ? 'button' : 'div';
  const ref = useRef(null);
  const measureRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Laporkan lebar alami isi sayap (tanpa dipengaruhi lebar akhir) ke Header
  useEffect(() => {
    const el = measureRef.current;
    if (!el || !onMeasure) return undefined;
    const report = () => onMeasure(side, el.offsetWidth ? Math.ceil(el.offsetWidth) + WING_PAD : 0);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => {
      ro.disconnect();
      onMeasure(side, 0);
    };
  }, [side, onMeasure]);

  // Ukur kotak sayap (tidak terpengaruh transform animasi) untuk menggambar bentuknya
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const onBlue = useBlueBehind(ref, open, left);

  // Tahap shadow: 0 = mati (sayap tertutup), 1 = tipis (selama sayap bergerak), 2 = default
  // (setelah sayap diam). Mati lagi saat sayap masuk kembali.
  const [shadowStage, setShadowStage] = useState(0);
  useEffect(() => {
    if (!open) {
      setShadowStage(0);
      return undefined;
    }
    if (prefersReducedMotion()) {
      setShadowStage(2);
      return undefined;
    }
    setShadowStage(1);
    const t = setTimeout(() => setShadowStage(2), WING_DELAY_IN + WING_IN);
    return () => clearTimeout(t);
  }, [open]);
  const props = interactive
    ? { type: 'button', onClick, 'aria-label': label, disabled: !open }
    : {};

  // Tertutup: sayap bergeser penuh ke belakang notch tengah + memudar.
  const tucked = left ? `translateX(calc(100% - ${TUCK}px))` : `translateX(calc(-100% + ${TUCK}px))`;

  const motion = open
    ? {
      transform: 'translateX(0)',
      opacity: 1,
      transition: `transform ${WING_IN}ms ${EASE_OUT} ${WING_DELAY_IN}ms, opacity 450ms ease-out ${WING_DELAY_IN}ms, width 300ms ease-out`,
    }
    : {
      transform: tucked,
      opacity: 0,
      transition: `transform ${WING_OUT}ms ${EASE_IN}, opacity 350ms ease-in, width 300ms ease-out`,
    };

  return (
    <Tag
      {...props}
      ref={ref}
      className={`group absolute bottom-1 top-0 z-[1] hidden items-center whitespace-nowrap text-left lg:flex border-0 bg-transparent motion-reduce:!transition-none ${left ? 'right-full' : 'left-full'
        } ${onBlue
          ? '[--wing:var(--surface-card)] [--wing-fg:var(--royal-700)] [--wing-sub:color-mix(in_srgb,var(--royal-700)_75%,transparent)] [--wing-chip:rgba(29,78,216,0.12)]'
          : '[--wing:var(--royal-700)] [--wing-fg:#fff] [--wing-sub:var(--royal-100)] [--wing-chip:rgba(255,255,255,0.2)]'
        } ${interactive ? `cursor-pointer ${onBlue ? 'hover:[--wing:var(--surface-hover)]' : 'hover:[--wing:var(--royal-800)]'} ${FOCUS}` : ''}`}
      style={{
        width: width ? `min(${width}px, ${WING_MAX})` : undefined,
        [left ? 'marginRight' : 'marginLeft']: -TUCK,
        [left ? 'paddingLeft' : 'paddingRight']: 20,
        [left ? 'paddingRight' : 'paddingLeft']: TUCK + 16,
        pointerEvents: open ? undefined : 'none',
        willChange: 'transform, opacity',
        ...motion,
      }}
    >
      {/* Pengukur tak terlihat: lebar alami isi sayap */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className={`pointer-events-none invisible absolute top-0 flex h-0 w-max items-center gap-3 overflow-hidden whitespace-nowrap ${left ? 'left-0' : 'right-0'}`}
      >
        {children}
      </span>
      <WingShape left={left} w={size.w} h={size.h} onBlue={onBlue} shadow={shadowStage} />
      <span className="relative flex w-full min-w-0 items-center justify-between gap-3">{children}</span>
    </Tag>
  );
}

/** Chip aksi di ujung sayap: glow tipis mengikuti mouse, tanpa mengubah bentuk sayap. */
function GlowChip({ children }) {
  const glow = useMouseGlow({ size: 48, opacity: 0.18 });
  return (
    <span
      ref={glow.ref}
      onMouseMove={glow.onMouseMove}
      onMouseLeave={glow.onMouseLeave}
      className="mouse-glow grid h-8 w-8 place-items-center rounded-full bg-[var(--wing-chip)] text-[color:var(--wing-fg)] transition-[transform,background-color,color] duration-300 group-hover:scale-110 group-active:scale-95"
    >
      {children}
    </span>
  );
}

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--royal-300)]';

// ── Animasi kontrol header ──────────────────────────────────────────────
// Idle   : lonceng berayun singkat tiap 8 dtk (hanya jika ada notifikasi belum dibaca),
//          cincin lencana berdenyut searah dengan ayunan.
// Aksi   : hover/klik pada tombol, search expand/collapse, dropdown buka/tutup + stagger item.
// Semua animasi dimatikan oleh prefers-reduced-motion.
const MENU_OUT = 180; // ms, harus >= durasi hdr-menu-out
const HEADER_CSS = `
.hdr-bell { transform-origin: 50% 10%; }
.hdr-bell[data-unread="true"] { animation: hdr-bell-idle 8s ease-in-out 2s infinite; }
.hdr-notif:hover .hdr-bell,
.hdr-notif:focus-visible .hdr-bell { animation: hdr-bell-swing 800ms ease-in-out; }
@keyframes hdr-bell-idle {
  0%, 16%, 100% { transform: rotate(0deg); }
  2% { transform: rotate(13deg); }
  5% { transform: rotate(-11deg); }
  8% { transform: rotate(7deg); }
  11% { transform: rotate(-4deg); }
  14% { transform: rotate(2deg); }
}
@keyframes hdr-bell-swing {
  0%, 100% { transform: rotate(0deg); }
  18% { transform: rotate(14deg); }
  36% { transform: rotate(-12deg); }
  54% { transform: rotate(8deg); }
  72% { transform: rotate(-4deg); }
}

.hdr-ring { opacity: 0; animation: hdr-ring 8s ease-out 2s infinite; }
@keyframes hdr-ring {
  0% { transform: scale(1); opacity: 0; }
  2% { transform: scale(1); opacity: 0.5; }
  14% { transform: scale(2.1); opacity: 0; }
  100% { transform: scale(2.1); opacity: 0; }
}
.hdr-pop { animation: hdr-pop 380ms cubic-bezier(0.22, 1, 0.36, 1) backwards; }
@keyframes hdr-pop {
  0% { transform: scale(0.4); opacity: 0; }
  60% { transform: scale(1.18); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.hdr-swap { animation: hdr-swap 240ms cubic-bezier(0.22, 1, 0.36, 1) backwards; }
@keyframes hdr-swap {
  from { opacity: 0; transform: scale(0.97); }
}
.hdr-fade { animation: hdr-fade 180ms ease-out backwards; }
@keyframes hdr-fade {
  from { opacity: 0; }
}

.hdr-menu { transform-origin: top right; }
.hdr-menu[data-state="open"] { animation: hdr-menu-in 240ms cubic-bezier(0.22, 1, 0.36, 1) backwards; }
.hdr-menu[data-state="closed"] {
  animation: hdr-menu-out ${MENU_OUT - 20}ms cubic-bezier(0.55, 0, 1, 0.45) forwards;
  pointer-events: none;
}
.hdr-menu[data-state="open"] .hdr-menu-item {
  animation: hdr-item-in 280ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(70ms + var(--i, 0) * 45ms);
}
@keyframes hdr-menu-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.96); }
}
@keyframes hdr-menu-out {
  to { opacity: 0; transform: translateY(-6px) scale(0.97); }
}
@keyframes hdr-item-in {
  from { opacity: 0; transform: translateY(-4px); }
}

/* Mode kotak: bar turun dulu, lalu isinya menyusul dari sisi masing-masing (stagger lewat --d) */
.hdr-box-item { animation: hdr-box-in 520ms cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0ms) backwards; }
@keyframes hdr-box-in {
  from { opacity: 0; transform: translateX(var(--dx, 0px)); }
}

@media (prefers-reduced-motion: reduce) {
  [data-header-root] *,
  [data-header-root] *::before,
  [data-header-root] *::after {
    animation: none !important;
  }
}
`;

const TONES = {
  dark: {
    shell: 'var(--royal-900)',
    shadow: 'var(--shadow-header-dark)',
    field:
      'bg-[var(--royal-900)] text-[var(--text-inverse)] placeholder:text-white/50 ring-1 ring-inset ring-white/15 hover:ring-[color:var(--royal-300)] focus:bg-[var(--royal-900)]',
    notif:
      'bg-[var(--royal-900)] text-[var(--text-inverse)] ring-1 ring-inset ring-white/15 hover:ring-[color:var(--royal-300)]',
    accent: 'hover:text-[color:var(--royal-100)]',
    fieldRing: 'focus:ring-2 focus:ring-white/30',
    fieldIcon: 'text-white/60',
    kbd: 'bg-white/10 text-white/60',
    button: 'bg-white/10 text-[var(--text-inverse)] hover:bg-white/20',
    avatarRing: 'ring-white/35',
    name: 'text-[var(--text-inverse)]',
    role: 'text-[var(--royal-100)]',
    divider: 'bg-white/15',
    menu: 'bg-[var(--royal-900)] border-white/10 shadow-[0_20px_44px_-14px_rgba(2,6,23,0.65)]',
    menuHead: 'border-white/10',
    logout:
      'text-[var(--cash-out-light)] hover:bg-white/10 focus-visible:bg-white/10',
    scheme: 'dark',
    barBorder: 'border-white/10',
    menuItem: 'text-[var(--text-inverse)] hover:bg-white/10 focus-visible:bg-white/10',
    menuItemOn: 'bg-white/10',
    thumb: 'bg-[var(--royal-900)] text-[var(--royal-100)] ring-1 ring-white/15',
    check: 'text-[var(--royal-100)]',
    chip: 'bg-white/10 text-[var(--royal-100)]',
    negative: 'text-[var(--cash-out-light)]',
  },
  light: {
    shell: 'var(--surface-card)',
    shadow: 'var(--shadow-header-light)',
    field:
      'bg-[var(--surface-card)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] ring-1 ring-inset ring-[color:var(--border-default)] hover:ring-[color:var(--royal-400)] focus:bg-[var(--surface-card)]',
    notif:
      'bg-[var(--surface-card)] text-[var(--text-main)] ring-1 ring-inset ring-[color:var(--border-default)] hover:ring-[color:var(--royal-400)]',
    accent: 'hover:text-[color:var(--royal-700)]',
    fieldRing: 'focus:ring-2 focus:ring-[color:var(--royal-300)]',
    fieldIcon: 'text-[var(--text-muted)]',
    kbd: 'bg-[var(--surface-muted)] text-[var(--text-muted-alt)]',
    button: 'bg-[var(--surface-muted)] text-[var(--text-main)] hover:bg-[var(--surface-hover)]',
    avatarRing: 'ring-[color:var(--royal-300)]',
    name: 'text-[var(--text-main)]',
    role: 'text-[var(--text-muted)]',
    divider: 'bg-[var(--border-subtle)]',
    menu: 'bg-[var(--surface-card)] border-[var(--border-default)] shadow-[0_20px_44px_-16px_rgba(29,78,216,0.3),0_4px_12px_-4px_rgba(15,23,42,0.12)]',
    menuHead: 'border-[var(--border-default)]',
    logout:
      'text-[var(--cash-out)] hover:bg-[var(--cash-out-light)] focus-visible:bg-[var(--cash-out-light)]',
    scheme: 'light',
    barBorder: 'border-[var(--border-default)]',
    menuItem:
      'text-[var(--text-main)] hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)]',
    menuItemOn: 'bg-[var(--surface-muted)]',
    thumb: 'bg-[var(--surface-card)] text-[var(--royal-700)] ring-1 ring-[color:var(--border-default)]',
    check: 'text-[var(--royal-700)]',
    chip: 'bg-[rgba(29,78,216,0.1)] text-[var(--royal-700)]',
    negative: 'text-[var(--cash-out)]',
  },
};

const getInitials = (name) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

// ── Pilihan desain header (dropdown akun) ───────────────────────────────
const STYLE_KEY = 'header-style';
const HEADER_STYLES = [
  { id: 'notch', label: 'Notch', hint: 'Menggantung di tengah' },
  { id: 'box', label: 'Kotak biasa', hint: 'Bar penuh di atas' },
];
const MENU_ITEMS = '[role="menuitem"],[role="menuitemradio"]';

function readStoredStyle() {
  try {
    const v = window.localStorage.getItem(STYLE_KEY);
    return v === 'notch' || v === 'box' ? v : null;
  } catch {
    return null;
  }
}

/** Miniatur layar kecil yang menunjukkan bentuk header. */
function StyleThumb({ variant }) {
  return (
    <svg aria-hidden="true" width="28" height="20" viewBox="0 0 28 20" fill="none">
      <rect x="0.5" y="0.5" width="27" height="19" rx="3.5" stroke="currentColor" strokeOpacity="0.35" />
      {variant === 'notch' ? (
        <path d="M6 1Q10 1 10 5V7Q10 10 13 10H15Q18 10 18 7V5Q18 1 22 1Z" fill="currentColor" />
      ) : (
        <path d="M1 3.5A2.5 2.5 0 0 1 3.5 1H24.5A2.5 2.5 0 0 1 27 3.5V8H1Z" fill="currentColor" />
      )}
      <rect x="6" y="14" width="16" height="2" rx="1" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

/**
 * Header "notch": menggantung dari tepi atas layar dengan lengkung cekung
 * di kedua sisi atas. Search bar collapse (ikon + "Cari") dan expand saat diklik.
 *
 * Prop `visible` (default true) mengontrol animasi masuk/keluar. Saat mount,
 * header otomatis animasi masuk.
 *
 * Desain header bisa dipilih dari dropdown akun:
 *   - 'notch' : menggantung + sayap kiri/kanan (default)
 *   - 'box'   : bar persegi penuh lebar layar; info kas & aksi pindah ke dalam bar
 * Saat ganti gaya, gaya lama keluar dulu (sayap terselip, notch naik / bar naik),
 * lalu gaya baru masuk dengan animasinya sendiri.
 * Pilihan disimpan di localStorage. Untuk mengontrol dari luar, pakai
 * `headerStyle` + `onHeaderStyleChange`.
 */
export default function Header({
  currentUser,
  onLogout,
  searchQuery = '',
  setSearchQuery,
  tone: toneName = 'light',
  unreadCount = 0,
  onNotificationsClick,
  onAddTransaction,
  ownerStats,
  onExportCSV,
  headerStyle: headerStyleProp,
  defaultHeaderStyle = 'notch',
  onHeaderStyleChange,
  visible = true,
  className = '',
}) {
  const tone = TONES[toneName] || TONES.dark;

  const [expanded, setExpanded] = useState(false);
  const [styleState, setStyleState] = useState(() => readStoredStyle() ?? defaultHeaderStyle);
  // Gaya tujuan (pilihan pengguna) vs gaya yang sedang digambar. Saat berganti, gaya lama
  // keluar dulu dengan animasinya sendiri, baru gaya baru masuk — tanpa potongan kasar.
  const variant = (headerStyleProp ?? styleState) === 'box' ? 'box' : 'notch';
  const [rendered, setRendered] = useState(variant);
  const [swapping, setSwapping] = useState(false);
  const refocusRef = useRef(false);
  const isNotch = rendered !== 'box';
  const [showMenu, setShowMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Dropdown tetap terpasang selama animasi tutup berjalan
  const [menuVisible, setMenuVisible] = useState(false);
  // Lebar alami tiap sayap; kedua sayap memakai yang terbesar
  const [wingNat, setWingNat] = useState({ left: 0, right: 0 });
  const reportWing = useCallback(
    (side, w) => setWingNat((p) => (p[side] === w ? p : { ...p, [side]: w })),
    [],
  );
  const wingW = Math.max(wingNat.left, wingNat.right);

  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const inputRef = useRef(null);
  const searchBtnRef = useRef(null);

  const hasName = Boolean(currentUser?.name?.trim());
  const userName = hasName ? currentUser.name.trim() : 'Pengguna';
  const userRole = currentUser?.role || '';

  // Dua frame: pastikan keadaan "tersembunyi" sempat ter-paint sebelum transisi masuk
  useEffect(() => {
    let id2;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, []);

  const open = visible && mounted && !swapping;

  useEffect(() => {
    if (variant === rendered) {
      setSwapping(false);
      return undefined;
    }
    if (prefersReducedMotion()) {
      setRendered(variant);
      return undefined;
    }
    setSwapping(true);
    // Tunggu animasi keluar gaya lama selesai
    const exitMs = rendered === 'box' ? BOX_OUT : NOTCH_OUT + NOTCH_DELAY_OUT;
    const t = setTimeout(() => {
      setRendered(variant);
      setSwapping(false);
    }, exitMs + 30);
    return () => clearTimeout(t);
  }, [variant, rendered]);

  // Setelah gaya baru masuk, kembalikan fokus keyboard ke tombol akun
  useEffect(() => {
    if (swapping || !refocusRef.current) return undefined;
    refocusRef.current = false;
    const id = requestAnimationFrame(() => menuButtonRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [swapping]);

  // Sayap baru keluar setelah notch aktif; saat pindah dari mode kotak ke notch,
  // sayap mulai dari posisi terselip lalu keluar lagi (animasi yang sama seperti saat masuk).
  const [wingsOn, setWingsOn] = useState(isNotch);
  useEffect(() => {
    if (!isNotch) {
      setWingsOn(false);
      return undefined;
    }
    let id2;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setWingsOn(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [isNotch]);
  const wingsOpen = open && wingsOn;

  // Tutup dropdown & search saat header disembunyikan
  useEffect(() => {
    if (!open) setShowMenu(false);
  }, [open]);

  // Tutup dropdown saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!showMenu) return undefined;
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showMenu]);

  // Dropdown: tetap terpasang sampai animasi tutup selesai, lalu dilepas
  useEffect(() => {
    if (showMenu) {
      setMenuVisible(true);
      return undefined;
    }
    const t = setTimeout(() => setMenuVisible(false), MENU_OUT);
    return () => clearTimeout(t);
  }, [showMenu]);

  // Dropdown: fokus ke item pertama saat dibuka
  useEffect(() => {
    if (!showMenu) return undefined;
    const id = requestAnimationFrame(() => {
      menuRef.current?.querySelector(MENU_ITEMS)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [showMenu]);

  // Pintasan keyboard: "/" atau Ctrl/⌘ + K membuka pencarian
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      const t = e.target;
      const typing =
        t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      const isCtrlK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const isSlash = e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (!isCtrlK && !isSlash) return;
      e.preventDefault();
      setExpanded(true);
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Navigasi keyboard di dalam dropdown
  const onMenuKeyDown = (e) => {
    const items = Array.from(e.currentTarget.querySelectorAll(MENU_ITEMS));
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = items[(i + 1) % items.length];
    else if (e.key === 'ArrowUp') next = items[(i - 1 + items.length) % items.length];
    else if (e.key === 'Home') next = items[0];
    else if (e.key === 'End') next = items[items.length - 1];
    else if (e.key === 'Tab') {
      setShowMenu(false);
      return;
    }
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  // Fokuskan input setelah search expand
  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const collapse = (refocus) => {
    setExpanded(false);
    if (refocus) requestAnimationFrame(() => searchBtnRef.current?.focus());
  };

  const isOwner = currentUser?.role === 'Pemilik';
  const showWings = Boolean(currentUser);
  const shift = SHIFTS[currentUser?.shift] || SHIFTS.pagi;

  const chooseStyle = (next) => {
    setStyleState(next);
    try {
      window.localStorage.setItem(STYLE_KEY, next);
    } catch {
      /* storage tidak tersedia: pilihan berlaku untuk sesi ini saja */
    }
    onHeaderStyleChange?.(next);
    setShowMenu(false);
    if (next !== variant) refocusRef.current = true;
    else menuButtonRef.current?.focus();
  };

  // Isi info kas & aksi utama: dipakai bersama oleh sayap (notch) dan bar (kotak)
  const kasNegative = ownerStats?.totalBersih < 0;
  const kasValue = `${kasNegative ? '−' : ''}${ownerStats?.totalBersih ? rp(ownerStats.totalBersih) : 'Rp 0'}`;
  const kasLabel = `Kas Bersih: ${kasValue}`;
  const subLabel = isOwner
    ? `${ownerStats?.trxCount || 0} transaksi · ${ownerStats?.dateLabel || 'hari ini'}`
    : `Shift ${shift.label} · ${shift.time}`;
  const action = isOwner
    ? {
      label: 'Ekspor Rekap CSV',
      aria: 'Ekspor Rekap Kas CSV',
      onClick: onExportCSV,
      Icon: Download,
      iconAnim: 'group-hover:translate-y-0.5',
    }
    : onAddTransaction
      ? {
        label: 'Catat transaksi baru',
        aria: 'Catat transaksi baru',
        onClick: onAddTransaction,
        Icon: Plus,
        iconAnim: 'group-hover:rotate-90',
      }
      : null;

  const hiddenTransform = 'translateY(calc(-100% - 16px))';
  const headerMotion = open
    ? {
      transform: 'translateY(0)',
      visibility: 'visible',
      transition: `transform ${isNotch ? NOTCH_IN : BOX_IN}ms ${EASE_OUT}, visibility 0s`,
    }
    : isNotch
      ? {
        transform: hiddenTransform,
        visibility: 'hidden',
        // visibility baru berubah setelah gerakan keluar selesai
        transition: `transform ${NOTCH_OUT}ms ${EASE_IN} ${NOTCH_DELAY_OUT}ms, visibility 0s linear ${NOTCH_OUT + NOTCH_DELAY_OUT
          }ms`,
      }
      : {
        transform: hiddenTransform,
        visibility: 'hidden',
        transition: `transform ${BOX_OUT}ms ${EASE_IN}, visibility 0s linear ${BOX_OUT}ms`,
      };

  return (
    <div
      data-header-root
      data-variant={isNotch ? 'notch' : 'box'}
      className={`${isNotch ? 'pointer-events-none flex justify-center' : ''} sticky top-0 z-40 w-full ${className}`}
    >
      <style>{HEADER_CSS}</style>
      <header
        className={`pointer-events-auto relative motion-reduce:!transition-none ${isNotch ? 'max-w-[calc(100vw-3.5rem)]' : 'w-full'
          }`}
        style={{ willChange: 'transform', ...headerMotion }}
      >
        {/* Sayap — hanya mode notch (di DOM lebih dulu supaya tergambar di bawah notch tengah) */}
        {isNotch && showWings && (
          <Wing side="left" open={wingsOpen} width={wingW} onMeasure={reportWing}>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-[color:var(--wing-fg)] transition-colors duration-300">
                {kasLabel}
              </span>
              <span className="block truncate text-xs text-[color:var(--wing-sub)] transition-colors duration-300">
                {subLabel}
              </span>
            </span>
          </Wing>
        )}

        {isNotch && showWings && action && (
          <Wing
            side="right"
            open={wingsOpen}
            width={wingW}
            onMeasure={reportWing}
            interactive
            onClick={action.onClick}
            label={action.aria}
          >
            <span className="text-sm font-semibold text-[color:var(--wing-fg)] transition-colors duration-300">{action.label}</span>
            <GlowChip>
              <action.Icon className={`h-4 w-4 transition-transform duration-300 ${action.iconAnim}`} />
            </GlowChip>
          </Wing>
        )}

        {/* Lapisan bentuk: notch (lengkung + flare) atau bar kotak (garis bawah tipis) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2]" style={{ filter: tone.shadow }}>
          <div
            className={`absolute inset-0 ${isNotch ? 'rounded-b-[24px]' : `rounded-b-[20px] border border-t-0 ${tone.barBorder}`}`}
            style={{ background: tone.shell }}
          />
          {isNotch && (
            <>
              <Flare side="left" color={tone.shell} className="absolute right-full top-0" />
              <Flare side="right" color={tone.shell} className="absolute left-full top-0" />
            </>
          )}
        </div>

        {/* Isi */}
        <div className={`relative z-[3] ${isNotch ? 'px-3 pb-3 pt-2.5 sm:px-4' : 'px-3 py-3 sm:px-6'}`}>
          <div className={`flex items-center gap-2 sm:gap-3 ${isNotch ? 'justify-center' : 'justify-end'}`}>
            {/* Mode kotak: info kas di kiri bar, aksi utama di sisi kanan */}
            {!isNotch && showWings && (
              <div
                className="hdr-box-item mr-auto hidden min-w-0 items-center gap-3 md:flex"
                style={{ '--dx': '-14px', '--d': '220ms' }}
              >
                <span aria-hidden="true" className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.chip}`}>
                  <Wallet className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className={`block text-xs ${tone.role}`}>Kas bersih</span>
                  <span
                    className={`block max-w-[16rem] truncate text-[15px] font-semibold tabular-nums ${kasNegative ? tone.negative : tone.name}`}
                  >
                    {kasValue}
                  </span>
                </span>
                <span aria-hidden="true" className={`hidden h-7 w-px shrink-0 lg:block ${tone.divider}`} />
                <span className={`hidden max-w-[16rem] truncate text-xs lg:block ${tone.role}`}>{subLabel}</span>
              </div>
            )}
            {!isNotch && showWings && action && (
              <div className="hdr-box-item shrink-0" style={{ '--dx': '14px', '--d': '300ms' }}>
                <button
                  type="button"
                  onClick={action.onClick}
                  aria-label={action.aria}
                  className={`group inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--royal-700)] text-sm font-semibold text-[var(--text-inverse)] ring-1 ring-inset ring-white/15 transition-[transform,filter] duration-200 hover:brightness-110 active:scale-[0.97] md:w-auto md:px-4 ${FOCUS}`}
                >
                  <action.Icon className={`h-4 w-4 transition-transform duration-300 ${action.iconAnim}`} />
                  <span className="hidden md:inline">{action.label}</span>
                </button>
              </div>
            )}

            {/* Pencarian: collapse -> expand */}
            <div
              className={`transition-[width] duration-300 ease-out motion-reduce:transition-none ${expanded ? 'w-44 sm:w-72 lg:w-80' : 'w-[5.5rem] sm:w-[7.25rem]'
                }`}
            >
              {expanded ? (
                <div className="hdr-swap relative">
                  <label htmlFor="header-search" className="sr-only">
                    Cari transaksi
                  </label>
                  <Search
                    className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${tone.fieldIcon}`}
                  />
                  <input
                    id="header-search"
                    ref={inputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery?.(e.target.value)}
                    onBlur={() => !searchQuery && collapse(false)}
                    onKeyDown={(e) => e.key === 'Escape' && collapse(true)}
                    placeholder="Cari transaksi, kategori, metode..."
                    style={{ colorScheme: tone.scheme }}
                    className={`h-10 w-full rounded-full border-0 pl-11 text-sm outline-none transition-[background-color,box-shadow] duration-200 [&::-webkit-search-cancel-button]:appearance-none ${searchQuery ? 'pr-11' : 'pr-4 sm:pr-14'
                      } ${tone.field} ${tone.fieldRing}`}
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      aria-label="Hapus pencarian"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSearchQuery?.('');
                        inputRef.current?.focus();
                      }}
                      className={`hdr-fade absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full transition-colors duration-200 ${tone.button} ${FOCUS}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <kbd
                      aria-hidden="true"
                      className={`hdr-fade pointer-events-none absolute right-3 top-1/2 hidden h-5 -translate-y-1/2 items-center rounded-md px-1.5 font-sans text-[11px] font-medium sm:inline-flex ${tone.kbd}`}
                    >
                      Esc
                    </kbd>
                  )}
                </div>
              ) : (
                <button
                  ref={searchBtnRef}
                  type="button"
                  onClick={() => setExpanded(true)}
                  aria-label="Cari transaksi"
                  aria-keyshortcuts="/ Control+K Meta+K"
                  className={`hdr-swap group flex min-h-10 w-full items-center justify-center gap-2 rounded-full py-1.5 text-sm transition-[transform,box-shadow,color] duration-200 hover:scale-[1.05] active:scale-[0.97] ${tone.field} ${tone.accent} ${FOCUS}`}
                >
                  <Search
                    className={`h-4 w-4 transition-[transform,color] duration-300 group-hover:scale-110 group-hover:text-current ${tone.fieldIcon}`}
                  />
                  <span>Cari</span>
                  <kbd
                    aria-hidden="true"
                    className={`hidden h-5 items-center rounded-md px-1.5 font-sans text-[11px] font-medium sm:inline-flex ${tone.kbd}`}
                  >
                    /
                  </kbd>
                </button>
              )}
            </div>

            {/* Notifikasi */}
            <button
              type="button"
              onClick={onNotificationsClick}
              aria-label={
                unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'
              }
              className={`hdr-notif group relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition-[transform,box-shadow,color] duration-200 hover:scale-110 active:scale-95 ${tone.notif} ${tone.accent} ${FOCUS}`}
            >
              <span className="hdr-bell grid place-items-center" data-unread={unreadCount > 0}>
                <Bell className="h-[18px] w-[18px]" />
              </span>
              {unreadCount > 0 && (
                <span
                  key={unreadCount}
                  aria-hidden="true"
                  className="hdr-pop absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px]"
                >
                  <span className="hdr-ring absolute inset-0 rounded-full bg-[var(--amber-500)]" />
                  <span
                    className="relative flex h-full min-w-[18px] items-center justify-center rounded-full border-2 bg-[var(--amber-500)] px-1 text-[10px] font-semibold leading-none text-slate-900"
                    style={{ borderColor: tone.shell }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </span>
              )}
            </button>

            <span aria-hidden="true" className={`h-7 w-px shrink-0 ${tone.divider}`} />

            {/* Profil */}
            <div className="relative" ref={menuRef}>
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setShowMenu((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={showMenu}
                aria-controls="header-account-menu"
                aria-label={`Menu akun ${userName}`}
                className={`group flex items-center gap-3 rounded-full ${FOCUS}`}
              >
                <span className="hidden text-right leading-tight sm:block">
                  <span className={`block max-w-[10rem] truncate text-sm font-medium ${tone.name}`}>
                    {userName}
                  </span>
                  {userRole && <span className={`block text-xs ${tone.role}`}>{userRole}</span>}
                </span>
                <span
                  className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--royal-700)] text-sm font-semibold text-[var(--text-inverse)] transition-[box-shadow,transform] duration-300 group-active:scale-95 ${showMenu ? 'ring-2' : 'ring-0 group-hover:ring-2'
                    } ${tone.avatarRing}`}
                >
                  {hasName ? getInitials(userName) : <User className="h-4 w-4" />}
                </span>
              </button>

              {(showMenu || menuVisible) && (
                <div
                  id="header-account-menu"
                  role="menu"
                  aria-label="Menu akun"
                  data-state={showMenu ? 'open' : 'closed'}
                  onKeyDown={onMenuKeyDown}
                  className={`hdr-menu absolute right-0 top-full z-50 w-64 rounded-[20px] border p-1.5 ${isNotch ? 'mt-4' : 'mt-3'} ${tone.menu}`}
                >
                  <div
                    role="none"
                    className={`hdr-menu-item flex items-center gap-3 border-b px-2.5 pb-3 pt-2.5 ${tone.menuHead}`}
                    style={{ '--i': 0 }}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--royal-700)] text-xs font-semibold text-[var(--text-inverse)]">
                      {hasName ? getInitials(userName) : <User className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className={`block truncate text-sm font-medium ${tone.name}`}>{userName}</span>
                      {userRole && <span className={`mt-0.5 block text-xs ${tone.role}`}>{userRole}</span>}
                    </span>
                  </div>
                  <div
                    role="group"
                    aria-labelledby="header-style-label"
                    className="hdr-menu-item px-0.5 pb-0.5 pt-2.5"
                    style={{ '--i': 1 }}
                  >
                    <span id="header-style-label" className={`block px-2.5 pb-1.5 text-xs ${tone.role}`}>
                      Tampilan header
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {HEADER_STYLES.map((opt) => {
                        const active = variant === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            onClick={() => chooseStyle(opt.id)}
                            className={`flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-left text-sm transition-colors duration-200 focus-visible:outline-none ${tone.menuItem} ${active ? tone.menuItemOn : ''}`}
                          >
                            <span className={`grid h-8 w-11 shrink-0 place-items-center rounded-lg ${tone.thumb}`}>
                              <StyleThumb variant={opt.id} />
                            </span>
                            <span className="min-w-0 flex-1 leading-tight">
                              <span className="block font-medium">{opt.label}</span>
                              <span className={`mt-0.5 block truncate text-xs ${tone.role}`}>{opt.hint}</span>
                            </span>
                            {active && <Check aria-hidden="true" className={`h-4 w-4 shrink-0 ${tone.check}`} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {onLogout && <div role="separator" className={`mx-2.5 my-1.5 h-px ${tone.divider}`} />}
                  {onLogout && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowMenu(false);
                        onLogout();
                      }}
                      style={{ '--i': 2 }}
                      className={`hdr-menu-item group flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-sm transition-colors duration-200 focus-visible:outline-none ${tone.logout}`}
                    >
                      <LogOut className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                      <span>Ganti akun / Keluar</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}