import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  History,
  LayoutDashboard,
  LogOut,
  Paperclip,
  PenLine,
  ScanText,
  UserCog
} from 'lucide-react';

const GRADIENT = 'var(--grad-hero)'; // Sidebar royal blueprint (theme/palette.css)
const STORAGE_KEY = 'esbe.navExpanded';
// Tablet horizontal: sidebar selalu mulai collapse (expand = overlay), dan tidak menimpa preferensi desktop.
const TABLET_LANDSCAPE = '(min-width: 1024px) and (max-width: 1279px)';
const readStoredExpanded = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--royal-300)] motion-reduce:transform-none';

// ── Kurva ──────────────────────────────────────────────────────────────────
const CURVE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'; // expo-out: cepat lalu mendarat halus
const CURVE_IN = 'cubic-bezier(0.55, 0, 1, 0.45)'; // dipercepat: untuk keluar
const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]';
const EASE_OUT = 'ease-[cubic-bezier(0.22,1,0.36,1)]'; // tanpa overshoot

// ── Expand / collapse ──────────────────────────────────────────────────────
// Catatan: 480ms di sini harus sama dengan `duration-[480ms]` pada class di bawah.
const TOGGLE_MS = 480;
const TOGGLE_CURVE = 'cubic-bezier(0.32, 0.72, 0, 1)';

// Label: buka -> teks muncul setelah ruang mulai terbentuk; tutup -> teks hilang duluan.
const LABEL_BASE = `lg:min-w-0 lg:flex-1 lg:overflow-hidden lg:whitespace-nowrap lg:text-left lg:pl-3 lg:transition-[opacity,transform] ${EASE} motion-reduce:transition-none`;
const LABEL_ON = 'lg:translate-x-0 lg:opacity-100 lg:delay-[140ms] lg:duration-[340ms]';
const LABEL_OFF = 'lg:-translate-x-2 lg:opacity-0 lg:delay-0 lg:duration-[120ms]';

// ── Masuk/keluar ───────────────────────────────────────────────────────────
// Masuk : sidebar meluncur, isinya mulai muncul SAAT sidebar masih mendarat (overlap),
//         berurutan dengan blur -> tajam.
// Keluar: isi menarik diri (urutan terbalik), sidebar menyusul meluncur keluar.
const SIDEBAR_IN = 700;
const SIDEBAR_OUT = 500;
const ITEMS_DELAY_IN = 380;
const REVEAL_IN = 600;
const STAGGER_IN = 60;
const REVEAL_OUT = 300;
const STAGGER_OUT = 35;
const SIDEBAR_DELAY_OUT = 250;

// Perpindahan menu aktif: (1) box mengecil jadi garis, (2) garis memanjang ke tujuan,
// (3) box tumbuh lagi dari garis di tujuan.
const BOX_OUT = 160;
const BOX_IN = 360;
const LINE_LEAD = 260;
const LINE_TRAIL = 280;
const LINE_LAG = 80;
const BOX_SWAP = BOX_OUT + LINE_LAG + LINE_TRAIL; // saat garis tiba

// Transisi bawaan tombol (inline `transition` menimpa class transition Tailwind, jadi ditulis ulang).
const BTN_BASE = `background-color 250ms ${CURVE_OUT}, color 250ms ${CURVE_OUT}, scale 250ms ${CURVE_OUT}, transform 250ms ${CURVE_OUT}, width ${TOGGLE_MS}ms ${TOGGLE_CURVE}`;

const ALL_NAV = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, roles: ['Pemilik'] },
  { key: 'form', label: 'Catat pendapatan', Icon: PenLine, roles: ['Karyawan', 'Pemilik'] },
  { key: 'ocr', label: 'Konfirmasi OCR', Icon: ScanText, roles: ['Karyawan', 'Pemilik'] },
  { key: 'upload', label: 'Unggah bukti', Icon: Paperclip, roles: ['Karyawan', 'Pemilik'] },
  { key: 'history', label: 'Riwayat', Icon: History, roles: ['Karyawan', 'Pemilik'] },
  { key: 'users', label: 'Manajemen akun', Icon: UserCog, roles: ['Pemilik'] }
];

// Desktop: semua dimensi tetap kecuali LEBAR -> tidak ada loncatan layout saat toggle.
// Mobile & tablet vertical (< lg): bottom bar hanya ikon (tanpa label), item sama lebar.
const ITEM_BASE =
  'relative flex flex-none items-center justify-center rounded-xl text-sm font-medium whitespace-nowrap max-lg:flex-1 max-lg:px-1 max-lg:py-2.5 lg:ml-2 lg:min-h-12 lg:justify-start lg:gap-0 lg:px-3 lg:py-2 lg:pl-[0.875rem] lg:pr-0';
const ITEM_COLLAPSED = 'lg:w-12';
const ITEM_EXPANDED = 'lg:w-[15.5rem]';

// Bottom bar (< lg) hanya ikon: label tetap ada untuk pembaca layar (sr-only).
function HLabel({ expanded, children }) {
  return (
    <span className={`${LABEL_BASE} ${expanded ? LABEL_ON : LABEL_OFF} max-lg:sr-only`}>{children}</span>
  );
}

const BAR = 24; // tinggi garis aksen (px) = h-6

// Gundukan nama halaman (bottom bar): digambar SEBAGAI BAGIAN dari bentuk bar (satu path, satu gradient),
// bukan elemen terpisah, jadi tidak ada garis sambungan.
const BUMP_H = 16; // tinggi gundukan di atas bar (px)
const BUMP_PAD = 10; // padding kiri/kanan teks (px)
const BUMP_SW = 18; // lebar lereng gundukan (px): kurva S halus dari bar naik ke puncak
const SHELL_R = 16; // radius sudut bar = rounded-2xl
const BUMP_HOLD = 1800; // gundukan tampil berapa ms setelah pindah halaman
const BUMP_OPEN_MS = 480; // durasi gundukan tumbuh
const BUMP_CLOSE_MS = 340; // durasi gundukan menciut
const BUMP_TEXT_DROP = 3; // geser teks ke bawah (px); makin besar makin turun
const SHELL_SHADOW = 'drop-shadow(0 10px 14px rgba(30,58,138,0.40))';

// Path bar + gundukan di tengah atas. W/H = ukuran total (H sudah termasuk BUMP_H), bw = lebar datar puncak,
// k (0..1) = seberapa "tumbuh" gundukannya. Lerengnya satu kurva bezier S (garis singgung horizontal di dasar
// DAN di puncak), jadi tidak ada sudut sama sekali dari bar ke gundukan. Struktur path selalu sama,
// jadi bisa dianimasikan mulus dari bar rata (k=0) sampai gundukan penuh (k=1).
const n2 = (v) => +v.toFixed(2);
function buildShell(W, H, bw, k = 1) {
  const y0 = BUMP_H;
  const R = SHELL_R;
  if (W <= 0 || H <= BUMP_H) return `M0 0H${Math.max(W, 0)}V${Math.max(H, 0)}H0Z`;
  const kk = Math.min(Math.max(k, 0), 1);
  const top = y0 - BUMP_H * kk;
  const w = bw * (0.5 + 0.5 * kk); // puncak ikut melebar saat tumbuh
  const sw = BUMP_SW;
  const m = sw / 2;
  const cx = W / 2;
  const l = cx - w / 2;
  const r = cx + w / 2;
  const xb = l - sw;
  const xe = r + sw;
  return (
    `M0 ${y0 + R}A${R} ${R} 0 0 1 ${R} ${y0}` +
    `L${n2(xb)} ${y0}C${n2(xb + m)} ${y0} ${n2(l - m)} ${n2(top)} ${n2(l)} ${n2(top)}` + // lereng kiri (S)
    `L${n2(r)} ${n2(top)}C${n2(r + m)} ${n2(top)} ${n2(xe - m)} ${y0} ${n2(xe)} ${y0}` + // lereng kanan (S)
    `L${W - R} ${y0}A${R} ${R} 0 0 1 ${W} ${y0 + R}L${W} ${H - R}A${R} ${R} 0 0 1 ${W - R} ${H}L${R} ${H}A${R} ${R} 0 0 1 0 ${H - R}Z`
  );
}

// Garis hover: tumbuh dari tengah saat hover. Setelah diklik, garis ini TIDAK langsung hilang:
// ia bertahan (delay 500ms) sampai garis aktif yang memanjang dari menu lama tiba.
// Ukuran, posisi, dan warnanya identik dengan garis aktif, jadi tampak menyambung.
function HoverBar({ active }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute left-1 top-1/2 hidden w-1 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)] transition-[height,opacity] motion-reduce:!transition-none lg:block ${EASE_OUT} ${active
        ? 'h-6 opacity-0 delay-[500ms] duration-150 group-hover:opacity-100 group-hover:delay-0'
        : 'h-0 opacity-0 duration-300 group-hover:h-6 group-hover:opacity-100 group-focus-visible:h-6 group-focus-visible:opacity-100'
        }`}
    />
  );
}

// ── Tooltip nama halaman (sidebar collapse, lg+) ───────────────────────────
// Panel putih kecil yang melayang di sisi kanan sidebar (warna sama dengan chip "E" dan tombol expand),
// jadi selalu terbaca, baik di atas kartu biru maupun latar terang. Satu elemen yang meluncur antar item.
//  - Mouse / keyboard : muncul saat hover / fokus keyboard.
//  - Semua input: setiap pindah halaman atau saat menu yang sedang aktif ditekan lagi, tooltip muncul
//    sebentar (layar sentuh tanpa hover) atau berdenyut kecil (bila sudah tampil karena hover).
const TIP_GAP = 18; // jarak panel dari sisi sidebar (px); cukup untuk melewati tombol expand yang menonjol 12px
const TIP_HOLD = 1800; // lama tooltip bertahan setelah pindah halaman / menu aktif ditekan (ms)
const TIP_SHADOW = '0 10px 28px -8px rgba(15,30,90,0.40), 0 2px 6px rgba(15,30,90,0.10)';
const SIDEBAR_SHADOW = '8px 0 24px -4px rgba(30,64,175,0.35)'; // bayangan sidebar (sama seperti aslinya)
const TIP_LG = '(min-width: 1024px)'; // sidebar vertikal (tablet horizontal ke atas)

const ICON_GLOW = '[filter:drop-shadow(0_0_5px_rgba(255,255,255,0.55))]';

const TIP_IDLE = { key: null, label: '', top: 0, show: false, glide: false, pulse: 0 };

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Navbar({
  currentPage,
  onPageChange,
  role = 'Pemilik',
  onLogout,
  visible = true,
  // Di mobile, "Keluar" sudah ada di dropdown akun Header ("Ganti akun / Keluar").
  // Set true kalau tetap mau tombol Keluar di bottom bar.
  showLogoutOnMobile = false
}) {
  const [tip, setTip] = useState(TIP_IDLE);
  const [expanded, setExpanded] = useState(() => {
    try {
      if (typeof window === 'undefined') return false;
      // Tablet horizontal (1024px–1279px): state awal selalu collapse
      if (window.innerWidth >= 1024 && window.innerWidth < 1280) return false;
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mounted, setMounted] = useState(false);
  const [ind, setInd] = useState(null); // { y, h, nh, dir }: posisi tombol aktif, tinggi nav, arah gerak
  const [indAnim, setIndAnim] = useState(false); // false saat pengukuran pertama -> tanpa meluncur dari 0
  const btnRefs = useRef({});
  const hideTimer = useRef(null);
  const pinTimer = useRef(null);
  const hoverRef = useRef(false); // true selama mouse / fokus keyboard sedang di atas sebuah item
  const sideRef = useRef(null);
  const tipBodyRef = useRef(null);
  const navRef = useRef(null);
  const [boxPos, setBoxPos] = useState(null); // posisi box aktif (tertinggal dari garis)
  const [boxOn, setBoxOn] = useState(true);
  const firstBox = useRef(true);
  const asideRef = useRef(null);
  const bumpTextRef = useRef(null);
  const [asideSize, setAsideSize] = useState({ w: 0, h: 0 }); // ukuran bar (bottom bar) untuk menggambar path
  const [textW, setTextW] = useState(0); // lebar teks nama halaman

  // Sinkron saat lebar layar berubah (resize / rotate tablet):
  //  - masuk rentang 1024–1279px -> paksa collapse, supaya tidak muncul overlay + backdrop mendadak
  //  - keluar dari rentang itu   -> kembalikan preferensi tersimpan
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(TABLET_LANDSCAPE);
    const sync = () => setExpanded(mq.matches ? false : readStoredExpanded());
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    try {
      // Di rentang tablet horizontal state selalu mulai collapse; jangan timpa preferensi desktop.
      if (window.matchMedia(TABLET_LANDSCAPE).matches) return;
      window.localStorage.setItem(STORAGE_KEY, expanded ? '1' : '0');
    } catch {
      /* storage tidak tersedia, abaikan */
    }
  }, [expanded]);

  // Dua frame: pastikan keadaan "tersembunyi" ter-paint sebelum transisi masuk
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

  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
      clearTimeout(pinTimer.current);
    },
    []
  );

  const open = visible && mounted;
  const visibleNav = ALL_NAV.filter((n) => n.roles.includes(role));
  const activeIdx = visibleNav.findIndex((n) => n.key === currentPage);

  // Ukur tombol aktif -> indikator meluncur antar menu (sidebar: vertikal, bottom bar: horizontal).
  useLayoutEffect(() => {
    const measure = () => {
      const as = asideRef.current;
      if (as) {
        const aw = as.offsetWidth;
        const ah = as.offsetHeight;
        setAsideSize((p) => (p.w === aw && p.h === ah ? p : { w: aw, h: ah }));
      }
      const el = btnRefs.current[currentPage];
      if (!el || activeIdx < 0) return setInd(null);
      const nh = navRef.current ? navRef.current.offsetHeight : 0;
      const nw = navRef.current ? navRef.current.offsetWidth : 0;
      const vertical = window.matchMedia('(min-width: 1024px)').matches; // sidebar = vertikal, bottom bar = horizontal
      const { offsetTop: y, offsetHeight: h, offsetLeft: x, offsetWidth: w } = el;
      setInd((p) =>
        p && p.y === y && p.h === h && p.x === x && p.w === w && p.nh === nh && p.nw === nw
          ? p
          : {
            y, h, x, w, nh, nw,
            dir: p && (vertical ? y < p.y : x < p.x) ? -1 : 1
          }
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [currentPage, role, activeIdx, showLogoutOnMobile]);

  // Urutan: box mengecil -> (garis berpindah) -> box pindah posisi saat tersembunyi -> tumbuh lagi.
  useEffect(() => {
    if (!ind) return;
    if (firstBox.current) {
      firstBox.current = false;
      setBoxPos({ x: ind.x, y: ind.y, w: ind.w, h: ind.h });
      return;
    }
    setBoxOn(false);
    let r1;
    let r2;
    const t = setTimeout(() => {
      setBoxPos({ x: ind.x, y: ind.y, w: ind.w, h: ind.h });
      r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setBoxOn(true));
      });
    }, BOX_SWAP);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ind?.y, ind?.h, ind?.x, ind?.w]);

  useEffect(() => {
    if (!ind || indAnim) return;
    const id = requestAnimationFrame(() => setIndAnim(true));
    return () => cancelAnimationFrame(id);
  }, [ind, indAnim]);

  // ── Gundukan nama halaman: muncul HANYA saat pindah halaman ─────────────
  // Gundukan tumbuh dari bar (path yang sama dianimasikan lewat rAF), teks muncul menyusul,
  // tahan BUMP_HOLD ms, lalu menciut kembali jadi bar rata.
  const bumpLabel = visibleNav[activeIdx]?.label ?? '';
  const hasInd = !!ind;
  const bumpW = bumpLabel && textW ? textW + BUMP_PAD * 2 : 0;
  const [bumpOn, setBumpOn] = useState(false);
  const bumpTimer = useRef(null);
  const prevPage = useRef(null);
  const shellRef = useRef(null);
  const sizeRef = useRef(asideSize);
  sizeRef.current = asideSize;
  const anim = useRef({ k: 0, w: 0, raf: 0 });

  const paintShell = () => {
    const el = shellRef.current;
    if (!el) return;
    const { w, h } = sizeRef.current;
    el.style.clipPath = `path('${buildShell(w, h + BUMP_H, anim.current.w, anim.current.k)}')`;
  };

  const animateShell = (toK, toW) => {
    const a = anim.current;
    cancelAnimationFrame(a.raf);
    if (prefersReducedMotion()) {
      a.k = toK;
      a.w = toW;
      paintShell();
      return;
    }
    if (a.k < 0.01) a.w = toW; // gundukan belum kelihatan: lebar langsung ke tujuan, tanpa melebar
    const fromK = a.k;
    const fromW = a.w;
    const opening = toK > fromK;
    const dur = opening ? BUMP_OPEN_MS : BUMP_CLOSE_MS;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const eOut = 1 - Math.pow(1 - t, 4); // mendarat halus
      const eInOut = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const ek = opening ? eOut : eInOut;
      a.k = fromK + (toK - fromK) * ek;
      a.w = fromW + (toW - fromW) * eOut;
      paintShell();
      if (t < 1) a.raf = requestAnimationFrame(step);
    };
    a.raf = requestAnimationFrame(step);
  };

  // Tampilkan gundukan (dipanggil saat pindah halaman ATAU saat menu aktif ditekan lagi).
  // Dipanggil berulang: timer di-reset, gundukan tetap terbuka.
  const triggerBump = () => {
    if (!bumpLabel) return;
    setBumpOn(true);
    clearTimeout(bumpTimer.current);
    bumpTimer.current = setTimeout(() => setBumpOn(false), BUMP_HOLD);
  };

  // Ukur teks -> lebar gundukan mengikuti panjang teks; pindah halaman -> picu gundukan.
  useLayoutEffect(() => {
    setTextW(bumpTextRef.current ? bumpTextRef.current.offsetWidth : 0);
    if (prevPage.current !== null && prevPage.current !== currentPage) triggerBump();
    prevPage.current = currentPage;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bumpLabel, hasInd, currentPage]);

  useLayoutEffect(() => {
    animateShell(bumpOn ? 1 : 0, bumpW);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bumpOn, bumpW]);

  useLayoutEffect(() => {
    paintShell();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asideSize]);

  useEffect(
    () => () => {
      clearTimeout(bumpTimer.current);
      cancelAnimationFrame(anim.current.raf);
    },
    []
  );

  // ── Tooltip: satu elemen yang meluncur antar item ───────────────────────
  // Posisi vertikal dihitung relatif terhadap wadah sidebar. Hide ditunda 80ms supaya
  // pindah item tidak berkedip dan bisa "glide".
  const tipTop = (el) => {
    const r = el.getBoundingClientRect();
    const base = sideRef.current ? sideRef.current.getBoundingClientRect().top : 0;
    return r.top + r.height / 2 - base;
  };

  const showTip = (key, label) => (e) => {
    clearTimeout(hideTimer.current);
    clearTimeout(pinTimer.current);
    hoverRef.current = true;
    const top = tipTop(e.currentTarget);
    setTip((p) => ({ key, label, top, show: true, glide: p.show, pulse: p.pulse }));
  };
  const hideTip = () => {
    hoverRef.current = false;
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setTip((p) => ({ ...p, show: false })), 80);
  };
  // Sentuhan tidak dianggap hover: tooltip untuk layar sentuh diatur oleh pinTip di bawah.
  const hoverProps = (key, label) => ({
    onPointerEnter: (e) => {
      if (e.pointerType !== 'touch') showTip(key, label)(e);
    },
    onPointerLeave: (e) => {
      if (e.pointerType !== 'touch') hideTip();
    },
    onFocus: (e) => {
      if (e.currentTarget.matches(':focus-visible')) showTip(key, label)(e);
    },
    onBlur: () => {
      if (hoverRef.current) hideTip();
    }
  });

  // Tampilkan tooltip sebentar untuk menu `key` (pindah halaman / menu aktif ditekan lagi).
  // Berlaku di semua jenis input (sentuh, mouse, stylus) selama sidebar vertikal (lg+) dan collapse.
  // Kalau tooltip untuk menu itu sudah tampil (mis. karena hover), panelnya berdenyut sebagai umpan balik.
  const pinTip = (key) => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (!open || expanded) return;
    if (!window.matchMedia(TIP_LG).matches) return;
    const el = btnRefs.current[key];
    const label = visibleNav.find((n) => n.key === key)?.label;
    if (!el || !label) return;
    clearTimeout(hideTimer.current);
    clearTimeout(pinTimer.current);
    const top = tipTop(el);
    // Denyut hanya bila tooltip untuk menu yang sama sedang tampil (= menu aktif ditekan lagi).
    setTip((p) => ({
      key,
      label,
      top,
      show: true,
      glide: p.show,
      pulse: p.show && p.key === key ? p.pulse + 1 : p.pulse
    }));
    if (!prefersReducedMotion()) {
      const icon = el.querySelector('svg');
      if (icon && icon.animate) {
        icon.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: 0.4 }, { transform: 'scale(1)' }],
          { duration: 440, easing: CURVE_OUT }
        );
      }
    }
    pinTimer.current = setTimeout(() => {
      if (!hoverRef.current) setTip((p) => ({ ...p, show: false }));
    }, TIP_HOLD);
  };

  // Pindah halaman -> tooltip nama halaman tujuan muncul sebentar (perangkat sentuh / tablet horizontal).
  const tipPrevPage = useRef(null);
  useEffect(() => {
    if (tipPrevPage.current !== null && tipPrevPage.current !== currentPage) pinTip(currentPage);
    tipPrevPage.current = currentPage;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Denyut kecil saat menu yang sama ditekan berulang: panel maju 4px lalu kembali.
  useEffect(() => {
    const el = tipBodyRef.current;
    if (!tip.pulse || !el || !el.animate || prefersReducedMotion()) return;
    el.animate(
      [
        { transform: 'translateX(0) scale(1)' },
        { transform: 'translateX(4px) scale(1.04)', offset: 0.4 },
        { transform: 'translateX(0) scale(1)' }
      ],
      { duration: 420, easing: CURVE_OUT }
    );
  }, [tip.pulse]);

  const tipOn = open && !expanded && tip.show;
  const item = `${ITEM_BASE} ${expanded ? ITEM_EXPANDED : ITEM_COLLAPSED}`;

  // ── Gerak ──────────────────────────────────────────────────────────────
  // Urutan: 0 = brand, 1..n = menu, n+1 = keluar, n+2 = tombol expand
  const total = visibleNav.length + 3;

  // Transisi `width` ikut ditulis di sini karena inline `transition` menimpa class
  // `lg:transition-[width]`. Di tablet (lg..xl) sidebar `fixed`, jadi lebarnya harus dianimasikan
  // sendiri. Di xl lebarnya mengikuti wrapper (yang sudah beranimasi), jadi durasinya 0ms
  // lewat variabel --nav-w-tr supaya tidak animasi dobel.
  const WIDTH_TR = `width var(--nav-w-tr, 0ms) ${TOGGLE_CURVE}`;
  const sidebarMotion = open
    ? {
      transform: 'translateX(0)',
      visibility: 'visible',
      transition: `transform ${SIDEBAR_IN}ms ${CURVE_OUT}, visibility 0s, ${WIDTH_TR}`
    }
    : {
      transform: 'translateX(calc(-100% - 40px))', // -40px supaya bayangan ikut keluar
      visibility: 'hidden',
      transition: `transform ${SIDEBAR_OUT}ms ${CURVE_IN} ${SIDEBAR_DELAY_OUT}ms, visibility 0s linear ${SIDEBAR_OUT + SIDEBAR_DELAY_OUT}ms, ${WIDTH_TR}`
    };

  // Properti `translate` (bukan `transform`) agar tidak bentrok dengan utilitas Tailwind.
  const reveal = (order, base = '') => {
    const tail = base ? `, ${base}` : '';
    if (open) {
      const d = ITEMS_DELAY_IN + order * STAGGER_IN;
      return {
        opacity: 1,
        translate: '0 0',
        filter: 'blur(0px)',
        transition: `translate ${REVEAL_IN}ms ${CURVE_OUT} ${d}ms, opacity 400ms ease-out ${d}ms, filter 450ms ease-out ${d}ms${tail}`
      };
    }
    const d = (total - 1 - order) * STAGGER_OUT;
    return {
      opacity: 0,
      translate: '-16px 0',
      filter: 'blur(4px)',
      transition: `translate ${REVEAL_OUT}ms ${CURVE_IN} ${d}ms, opacity 220ms ease-in ${d}ms, filter 220ms ease-in ${d}ms${tail}`
    };
  };

  // Garis aktif memanjang: sisi depan (arah gerak) berangkat dulu, sisi belakang menyusul -> terlihat "menyambung".
  const barBase = !indAnim || !ind
    ? ''
    : ind.dir > 0
      ? `bottom ${LINE_LEAD}ms ${CURVE_OUT} ${BOX_OUT}ms, top ${LINE_TRAIL}ms ${CURVE_OUT} ${BOX_OUT + LINE_LAG}ms`
      : `top ${LINE_LEAD}ms ${CURVE_OUT} ${BOX_OUT}ms, bottom ${LINE_TRAIL}ms ${CURVE_OUT} ${BOX_OUT + LINE_LAG}ms`;
  const barTop = ind ? ind.y + (ind.h - BAR) / 2 : 0;
  const barBottom = ind ? ind.nh - (barTop + BAR) : 0;

  // Bottom bar: garis pendek horizontal di dasar item aktif. Gerakannya sama persis dengan sidebar
  // (sisi depan berangkat dulu, sisi belakang menyusul), hanya sumbunya X bukan Y.
  const LINE_H = 4; // tebal garis (px) = w-1
  const LINE_GAP = 4; // jarak garis dari dasar item (px)
  const barBaseX = !indAnim || !ind
    ? ''
    : ind.dir > 0
      ? `right ${LINE_LEAD}ms ${CURVE_OUT} ${BOX_OUT}ms, left ${LINE_TRAIL}ms ${CURVE_OUT} ${BOX_OUT + LINE_LAG}ms`
      : `left ${LINE_LEAD}ms ${CURVE_OUT} ${BOX_OUT}ms, right ${LINE_TRAIL}ms ${CURVE_OUT} ${BOX_OUT + LINE_LAG}ms`;
  const barLeft = ind ? ind.x + (ind.w - BAR) / 2 : 0;
  const barRight = ind ? ind.nw - (barLeft + BAR) : 0;
  const barTopX = ind ? ind.y + ind.h - LINE_H - LINE_GAP : 0;
  const BOX_PROPS = ['left', 'width', 'top', 'height', 'margin-left', 'margin-top'];
  const boxTransitionX = boxOn
    ? `${BOX_PROPS.map((p) => `${p} ${BOX_IN}ms ${CURVE_OUT}`).join(', ')}, opacity 160ms ease-out`
    : `${BOX_PROPS.map((p) => `${p} ${BOX_OUT}ms ${CURVE_IN}`).join(', ')}, opacity 120ms ease-in ${BOX_OUT - 120}ms`;


  return (
    <div
      className={`shrink-0 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:px-3 max-lg:pb-[max(0.5rem,env(safe-area-inset-bottom))] max-lg:pt-1 max-lg:pointer-events-none lg:relative lg:z-50 lg:-my-6 lg:-ml-6 lg:self-stretch lg:transition-[width] lg:duration-[480ms] ${EASE} motion-reduce:transition-none lg:w-[5.5rem] ${expanded ? 'xl:w-72' : 'xl:w-[5.5rem]'
        }`}
    >
      {/* Backdrop blur untuk tablet horizontal (lg..xl) saat sidebar di-expand.
          Selalu ter-mount supaya muncul/hilangnya fade, sama halusnya dengan animasi lebar sidebar. */}
      <div
        aria-hidden="true"
        onClick={() => setExpanded(false)}
        className={`fixed inset-0 z-40 hidden bg-slate-900/25 backdrop-blur-sm transition-opacity duration-[480ms] ${EASE} motion-reduce:transition-none lg:block xl:hidden ${open && expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
      />

      <div
        ref={sideRef}
        className={`pointer-events-auto [--nav-w-tr:480ms] xl:[--nav-w-tr:0ms] max-lg:mx-auto max-lg:max-w-[26rem] lg:fixed lg:left-0 lg:top-0 lg:z-50 lg:h-screen xl:sticky xl:w-full motion-reduce:!transition-none ${expanded ? 'lg:w-72' : 'lg:w-[5.5rem]'}`}
        style={{
          willChange: 'transform',
          pointerEvents: open ? undefined : 'none',
          ...sidebarMotion
        }}
      >
        {/* Latar sidebar (lg+): satu gradient + satu bayangan. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden lg:block"
          style={{ background: GRADIENT, boxShadow: SIDEBAR_SHADOW }}
        />

        {/* Tooltip nama halaman (lg+, sidebar collapse). Tiga lapis:
            luar  = posisi vertikal (meluncur antar item),
            tengah = muncul/hilang (fade + geser),
            dalam = panel itu sendiri (denyut saat menu aktif ditekan lagi). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-full top-0 z-20 hidden lg:block motion-reduce:!transition-none"
          style={{
            transform: `translateY(${tip.top}px)`,
            transition: tip.glide ? `transform 260ms ${CURVE_OUT}` : 'none'
          }}
        >
          <div
            className="motion-reduce:!transition-none"
            style={{
              transform: `translateY(-50%) translateX(${tipOn ? 0 : -8}px)`,
              opacity: tipOn ? 1 : 0,
              transition: tipOn
                ? `opacity 200ms ease-out, transform 280ms ${CURVE_OUT}`
                : `opacity 120ms ease-in, transform 160ms ${CURVE_IN}`
            }}
          >
            <div
              ref={tipBodyRef}
              className="relative whitespace-nowrap rounded-lg border border-[color:var(--royal-100,#dbe4ff)] bg-[var(--surface-card)] px-3.5 py-2.5 text-[13px] font-semibold leading-none text-[var(--royal-700)]"
              style={{ marginLeft: TIP_GAP, boxShadow: TIP_SHADOW, transformOrigin: 'left center' }}
            >
              {/* panah kecil menghadap sidebar */}
              <span
                className="absolute -left-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-b border-l border-[color:var(--royal-100,#dbe4ff)] bg-[var(--surface-card)]"
                style={{ borderBottomLeftRadius: 2 }}
              />
              {tip.label}
            </div>
          </div>
        </div>

        <aside
          ref={asideRef}
          className="relative flex h-full flex-col text-white
            max-lg:rounded-2xl max-lg:px-2 max-lg:py-1.5
            lg:w-full lg:px-3 lg:py-6
            lg:overflow-y-auto lg:overflow-x-hidden"
        >
          {/* Latar bottom bar (< lg): bar + gundukan = SATU bentuk, satu gradient, satu bayangan di tepi luar */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 lg:hidden"
            style={{ top: -BUMP_H, filter: SHELL_SHADOW }}
          >
            <div ref={shellRef} className="h-full w-full" style={{ background: GRADIENT }} />
          </div>

          {/* Brand */}
          <div
            className="hidden items-center gap-3 lg:mb-8 lg:flex lg:gap-0 lg:pl-3 motion-reduce:!transition-none"
            style={reveal(0)}
          >
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[20px] bg-[var(--surface-card)] text-lg font-bold text-[var(--royal-700)] shadow-sm transition-all duration-500 ${EASE_OUT} hover:scale-105 hover:shadow-[0_0_0_5px_rgba(255,255,255,0.18),0_10px_24px_-6px_rgba(0,0,0,0.45)] active:scale-95 motion-reduce:transform-none`}>
              E
            </div>

            <div className={`leading-tight ${LABEL_BASE} ${expanded ? LABEL_ON : LABEL_OFF}`}>
              <div className="text-base font-semibold">Esbe Cash Recap</div>
              <div className="text-xs text-white/85">Fotocopy Esbe Lampu Merah</div>
            </div>
          </div>

          {/* Menu */}
          <nav
            ref={navRef}
            className="relative flex items-center justify-around gap-1 lg:mt-0 lg:flex-col lg:items-stretch lg:justify-start lg:gap-2 lg:overflow-visible"
            aria-label="Halaman utama"
          >
            {/* Box aktif (bottom bar): mengecil ke garis di dasar item -> garis berpindah -> tumbuh lagi */}
            {ind && boxPos && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 motion-reduce:!transition-none lg:hidden"
                style={{
                  width: boxPos.w,
                  height: boxPos.h,
                  transform: `translate(${boxPos.x}px, ${boxPos.y}px)`,
                  ...reveal(activeIdx + 1)
                }}
              >
                <span
                  className="absolute rounded-xl shadow-[var(--shadow-royal-btn),0_0_20px_rgba(255,255,255,0.12)] ring-1 ring-white/30 motion-reduce:!transition-none"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0.10))',
                    left: boxOn ? 0 : '50%',
                    marginLeft: boxOn ? 0 : -BAR / 2,
                    width: boxOn ? '100%' : BAR,
                    top: boxOn ? 0 : '100%',
                    marginTop: boxOn ? 0 : -(LINE_H + LINE_GAP),
                    height: boxOn ? '100%' : LINE_H,
                    opacity: boxOn ? 1 : 0,
                    transition: boxTransitionX
                  }}
                />
              </span>
            )}

            {/* Garis aktif (bottom bar): memanjang horizontal dari menu lama ke menu baru */}
            {ind && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute h-1 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)] motion-reduce:!transition-none lg:hidden"
                style={{ left: barLeft, right: barRight, top: barTopX, ...reveal(activeIdx + 1, barBaseX) }}
              />
            )}

            {/* Teks nama halaman (bottom bar): muncul di dalam gundukan hanya saat pindah halaman, di tengah navbar */}
            {ind && (
              <span
                ref={bumpTextRef}
                aria-hidden="true"
                className="pointer-events-none absolute flex items-center whitespace-nowrap text-[11px] font-semibold leading-none text-white motion-reduce:!transition-none lg:hidden"
                style={{
                  left: '50%',
                  height: BUMP_H,
                  bottom: `calc(100% + ${6 - BUMP_TEXT_DROP}px)`, // 6px = padding atas aside (dasar teks pas di tepi atas bar), dikurangi BUMP_TEXT_DROP
                  transform: 'translateX(-50%)',
                  ...reveal(activeIdx + 1)
                }}
              >
                <span
                  className="block motion-reduce:!transition-none"
                  style={{
                    opacity: bumpOn ? 1 : 0,
                    transform: `translateY(${bumpOn ? 0 : 4}px)`,
                    transition: bumpOn
                      ? `opacity 220ms ease-out 120ms, transform 320ms ${CURVE_OUT} 120ms`
                      : `opacity 100ms ease-in, transform 200ms ${CURVE_IN}`
                  }}
                >
                  {bumpLabel}
                </span>
              </span>
            )}

            {/* Box aktif (desktop): mengecil ke garis -> garis berpindah -> tumbuh lagi dari garis di tujuan */}
            {ind && boxPos && (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute left-0 top-0 hidden motion-reduce:!transition-none lg:ml-2 lg:block ${expanded ? ITEM_EXPANDED : ITEM_COLLAPSED}`}
                style={{
                  height: boxPos.h,
                  transform: `translateY(${boxPos.y}px)`,
                  ...reveal(activeIdx + 1, `width ${TOGGLE_MS}ms ${TOGGLE_CURVE}`)
                }}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-xl shadow-[var(--shadow-royal-btn),0_0_20px_rgba(255,255,255,0.12)] ring-1 ring-white/30 motion-reduce:!transition-none"
                  style={{
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.34), rgba(255,255,255,0.10))',
                    width: boxOn ? '100%' : 4,
                    marginLeft: boxOn ? 0 : 4, // 4px = posisi garis (left-3) relatif ke box (ml-2)
                    opacity: boxOn ? 1 : 0,
                    transition: boxOn
                      ? `width ${BOX_IN}ms ${CURVE_OUT}, margin-left ${BOX_IN}ms ${CURVE_OUT}, opacity 160ms ease-out`
                      : `width ${BOX_OUT}ms ${CURVE_IN}, margin-left ${BOX_OUT}ms ${CURVE_IN}, opacity 120ms ease-in ${BOX_OUT - 120}ms`
                  }}
                />
              </span>
            )}

            {/* Garis aktif (desktop): memanjang dari menu lama ke menu baru */}
            {ind && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute hidden w-1 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)] motion-reduce:!transition-none lg:left-3 lg:block"
                style={{ top: barTop, bottom: barBottom, ...reveal(activeIdx + 1, barBase) }}
              />
            )}

            {visibleNav.map(({ key, label, Icon }, i) => {
              const isActive = currentPage === key;
              return (
                <button
                  key={key}
                  ref={(el) => {
                    btnRefs.current[key] = el;
                  }}
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      triggerBump(); // menu aktif ditekan lagi -> tampilkan nama halaman (bottom bar)
                      pinTip(key); // ...dan tooltip + denyut di sidebar (tablet horizontal / sentuh)
                    }
                    onPageChange(key);
                  }}
                  className={`group snap-start ${item} ${FOCUS} motion-reduce:!transition-none active:scale-95 ${isActive
                    ? 'font-semibold text-white'
                    : 'text-white/90 hover:text-white'
                    }`}
                  style={reveal(i + 1, BTN_BASE)}
                  aria-current={isActive ? 'page' : undefined}
                  {...hoverProps(key, label)}
                >
                  <HoverBar active={isActive} />
                  <Icon
                    aria-hidden="true"
                    className={`h-[18px] w-[18px] lg:h-5 lg:w-5 flex-none transition-all duration-300 ${EASE_OUT} ${isActive ? ICON_GLOW : ''}`}
                  />
                  <HLabel expanded={expanded}>{label}</HLabel>
                </button>
              );
            })}

            {/* Keluar (mobile) */}
            {onLogout && showLogoutOnMobile && (
              <button
                type="button"
                onClick={onLogout}
                className={`snap-start ${ITEM_BASE} text-[var(--amber-100)] hover:bg-[var(--royal-600)] hover:text-[var(--text-inverse)] lg:hidden ${FOCUS}`}
              >
                <LogOut aria-hidden="true" className="h-[18px] w-[18px] flex-none" />
                <span className="sr-only">Keluar</span>
              </button>
            )}
          </nav>

          {/* Keluar (desktop) */}
          {onLogout && (
            <div className="mt-auto hidden flex-col pt-6 lg:flex">
              <button
                type="button"
                onClick={onLogout}
                className={`group ${item} text-white/90 hover:text-white ${FOCUS} motion-reduce:!transition-none active:scale-95`}
                style={reveal(visibleNav.length + 1, BTN_BASE)}
                {...hoverProps('logout', 'Keluar')}
              >
                <HoverBar active={false} />
                <LogOut
                  aria-hidden="true"
                  className={`h-5 w-5 flex-none transition-all duration-300 ${EASE_OUT}`}
                />
                <HLabel expanded={expanded}>Keluar</HLabel>
              </button>
            </div>
          )}
        </aside>

        {/* Tombol expand/collapse: satu ChevronLeft yang berputar 180deg */}
        <div className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 translate-x-1/2 lg:block">
          <button
            type="button"
            onClick={() => {
              clearTimeout(hideTimer.current);
              clearTimeout(pinTimer.current);
              hoverRef.current = false;
              setTip((p) => ({ ...p, show: false }));
              setExpanded((p) => !p);
            }}
            aria-expanded={expanded}
            aria-label={expanded ? 'Ciutkan sidebar' : 'Perluas sidebar'}
            className={`relative grid min-h-12 w-6 place-items-center rounded-[20px] bg-[var(--surface-card)] text-[var(--royal-700)] shadow-[var(--shadow-royal-card)] hover:bg-[var(--royal-50)] hover:shadow-[0_0_0_4px_rgba(255,255,255,0.28)] active:scale-90 motion-reduce:!transition-none after:content-[''] after:absolute after:-inset-x-2.5 after:-inset-y-1 ${FOCUS}`}
            style={reveal(visibleNav.length + 2, `${BTN_BASE}, box-shadow 300ms ${CURVE_OUT}`)}
          >
            <ChevronLeft
              className={`h-4 w-4 transition-transform duration-[480ms] ${EASE_OUT} motion-reduce:transition-none ${expanded ? 'rotate-0' : 'rotate-180'}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </div>
  );
}