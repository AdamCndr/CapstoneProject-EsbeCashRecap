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
const ITEM_BASE =
  'relative flex flex-none items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap lg:ml-2 lg:min-h-12 lg:justify-start lg:gap-0 lg:py-2 lg:pl-[0.875rem] lg:pr-0';
const ITEM_COLLAPSED = 'lg:w-12';
const ITEM_EXPANDED = 'lg:w-[15.5rem]';

function HLabel({ expanded, children }) {
  return <span className={`${LABEL_BASE} ${expanded ? LABEL_ON : LABEL_OFF}`}>{children}</span>;
}

const BAR = 24; // tinggi garis aksen (px) = h-6

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

const ICON_GLOW = '[filter:drop-shadow(0_0_5px_rgba(255,255,255,0.55))]';

const TIP_IDLE = { key: null, label: '', top: 0, left: 0, show: false, glide: false };

export default function Navbar({
  currentPage,
  onPageChange,
  role = 'Pemilik',
  onLogout,
  visible = true
}) {
  const [tip, setTip] = useState(TIP_IDLE);
  const [expanded, setExpanded] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mounted, setMounted] = useState(false);
  const [ind, setInd] = useState(null); // { y, h, nh, dir }: posisi tombol aktif, tinggi nav, arah gerak
  const [indAnim, setIndAnim] = useState(false); // false saat pengukuran pertama -> tanpa meluncur dari 0
  const btnRefs = useRef({});
  const hideTimer = useRef(null);
  const navRef = useRef(null);
  const [boxPos, setBoxPos] = useState(null); // posisi box aktif (tertinggal dari garis)
  const [boxOn, setBoxOn] = useState(true);
  const firstBox = useRef(true);

  useEffect(() => {
    try {
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

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const open = visible && mounted;
  const visibleNav = ALL_NAV.filter((n) => n.roles.includes(role));
  const activeIdx = visibleNav.findIndex((n) => n.key === currentPage);

  // Ukur tombol aktif -> indikator desktop meluncur antar menu (satu elemen, bukan muncul/hilang).
  useLayoutEffect(() => {
    const measure = () => {
      const el = btnRefs.current[currentPage];
      if (!el || activeIdx < 0) return setInd(null);
      const nh = navRef.current ? navRef.current.offsetHeight : 0;
      setInd((p) =>
        p && p.y === el.offsetTop && p.h === el.offsetHeight && p.nh === nh
          ? p
          : { y: el.offsetTop, h: el.offsetHeight, nh, dir: p && el.offsetTop < p.y ? -1 : 1 }
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [currentPage, role, activeIdx]);

  // Urutan: box mengecil -> (garis berpindah) -> box pindah posisi saat tersembunyi -> tumbuh lagi.
  useEffect(() => {
    if (!ind) return;
    if (firstBox.current) {
      firstBox.current = false;
      setBoxPos({ y: ind.y, h: ind.h });
      return;
    }
    setBoxOn(false);
    let r1;
    let r2;
    const t = setTimeout(() => {
      setBoxPos({ y: ind.y, h: ind.h });
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
  }, [ind?.y, ind?.h]);

  useEffect(() => {
    if (!ind || indAnim) return;
    const id = requestAnimationFrame(() => setIndAnim(true));
    return () => cancelAnimationFrame(id);
  }, [ind, indAnim]);

  // Tooltip: satu elemen yang meluncur antar item. Hide ditunda 80ms supaya
  // pindah item tidak berkedip dan bisa "glide".
  const showTip = (key, label) => (e) => {
    clearTimeout(hideTimer.current);
    const r = e.currentTarget.getBoundingClientRect();
    setTip((p) => ({ key, label, top: r.top + r.height / 2, left: r.right + 12, show: true, glide: p.show }));
  };
  const hideTip = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setTip((p) => ({ ...p, show: false })), 80);
  };
  const hoverProps = (key, label) => ({
    onMouseEnter: showTip(key, label),
    onFocus: showTip(key, label),
    onMouseLeave: hideTip,
    onBlur: hideTip
  });

  const tipOn = open && !expanded && tip.show;
  const item = `${ITEM_BASE} ${expanded ? ITEM_EXPANDED : ITEM_COLLAPSED}`;

  // ── Gerak ──────────────────────────────────────────────────────────────
  // Urutan: 0 = brand, 1..n = menu, n+1 = keluar, n+2 = tombol expand
  const total = visibleNav.length + 3;

  const sidebarMotion = open
    ? {
      transform: 'translateX(0)',
      visibility: 'visible',
      transition: `transform ${SIDEBAR_IN}ms ${CURVE_OUT}, visibility 0s`
    }
    : {
      transform: 'translateX(calc(-100% - 40px))', // -40px supaya bayangan ikut keluar
      visibility: 'hidden',
      transition: `transform ${SIDEBAR_OUT}ms ${CURVE_IN} ${SIDEBAR_DELAY_OUT}ms, visibility 0s linear ${SIDEBAR_OUT + SIDEBAR_DELAY_OUT}ms`
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


  return (
    <div
      className={`shrink-0 lg:relative lg:z-50 lg:-my-6 lg:-ml-6 lg:self-stretch lg:transition-[width] lg:duration-[480ms] ${EASE} motion-reduce:transition-none ${expanded ? 'lg:w-72' : 'lg:w-[5.5rem]'
        }`}
    >
      <div
        className="lg:sticky lg:top-0 lg:z-50 lg:h-screen motion-reduce:!transition-none"
        style={{
          willChange: 'transform',
          pointerEvents: open ? undefined : 'none',
          ...sidebarMotion
        }}
      >
        <aside
          className="relative flex h-full flex-col text-white
            max-lg:rounded-[20px] max-lg:p-5 max-lg:shadow-[0_20px_40px_-12px_rgba(30,58,138,.5)]
            lg:w-full lg:px-3 lg:py-6
            lg:shadow-[8px_0_24px_-4px_rgba(30,64,175,0.35)]
            lg:overflow-y-auto lg:overflow-x-hidden"
          style={{ background: GRADIENT }}
        >
          {/* Brand */}
          <div
            className="flex items-center gap-3 lg:mb-8 lg:gap-0 lg:pl-3 motion-reduce:!transition-none"
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
            className="relative mt-4 flex snap-x gap-1 overflow-x-auto pr-6 [scrollbar-width:none] max-lg:[mask-image:linear-gradient(to_right,black_88%,transparent)] lg:mt-0 lg:snap-none lg:flex-col lg:gap-2 lg:overflow-visible lg:pr-0"
            aria-label="Halaman utama"
          >
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
                  onClick={() => onPageChange(key)}
                  className={`group snap-start ${item} ${FOCUS} motion-reduce:!transition-none active:scale-95 ${isActive
                    ? 'font-semibold text-white max-lg:bg-white/20 max-lg:shadow-[var(--shadow-royal-btn)] max-lg:ring-1 max-lg:ring-white/30'
                    : 'text-white/90 hover:text-white'
                    }`}
                  style={reveal(i + 1, BTN_BASE)}
                  aria-current={isActive ? 'page' : undefined}
                  {...hoverProps(key, label)}
                >
                  <HoverBar active={isActive} />
                  <Icon
                    aria-hidden="true"
                    className={`h-5 w-5 flex-none transition-all duration-300 ${EASE_OUT} ${isActive ? ICON_GLOW : ''}`}
                  />
                  <HLabel expanded={expanded}>{label}</HLabel>
                </button>
              );
            })}

            {/* Keluar (mobile) */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className={`snap-start ${ITEM_BASE} text-[var(--amber-100)] hover:bg-[var(--royal-600)] hover:text-[var(--text-inverse)] lg:hidden ${FOCUS}`}
              >
                <LogOut aria-hidden="true" className="h-5 w-5 flex-none" />
                <span>Keluar</span>
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

      {/* Tooltip collapse: selalu ter-mount, fade + geser tipis, meluncur antar item */}
      <span
        aria-hidden="true"
        className="pointer-events-none fixed z-[60] hidden whitespace-nowrap rounded-[20px] bg-[var(--royal-900)] px-3 py-1.5 text-xs font-medium text-[var(--text-inverse)] shadow-lg motion-reduce:!transition-none lg:block"
        style={{
          top: tip.top,
          left: tip.left,
          opacity: tipOn ? 1 : 0,
          transform: `translate(${tipOn ? 0 : -6}px, -50%)`,
          transition: `${tip.glide ? `top 220ms ${CURVE_OUT}, left 220ms ${CURVE_OUT}, ` : ''}opacity 160ms ease-out, transform 220ms ${CURVE_OUT}`
        }}
      >
        {tip.label}
      </span>
    </div>
  );
}