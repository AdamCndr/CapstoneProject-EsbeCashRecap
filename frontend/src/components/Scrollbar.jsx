import { useEffect, useRef } from 'react';
import './Scrollbar.css';

/**
 * Scrollbar custom (garis) - render SATU KALI di App.jsx: <Scrollbar />
 *
 * Satu garis fixed yang mengikuti elemen yang sedang di-scroll (halaman, tabel,
 * modal, sidebar). Scrollbar native disembunyikan lewat CSS (html[data-custom-scrollbar]).
 *
 * Gerak (selaras dengan garis aktif di Navbar):
 * - Saat scroll, sisi depan garis bergerak lebih cepat daripada sisi belakang,
 *   jadi garis memanjang saat scroll cepat dan memendek saat berhenti.
 * - Hover / drag: garis menebal. Tersembunyi lagi setelah `hideDelay` ms.
 * - Bisa diseret. Dekati tepi kanan area scroll untuk memunculkannya.
 * - Elemen dengan atribut `data-no-scrollbar` (atau anak-anaknya) diabaikan.
 * - Layar sentuh: tidak aktif, scrollbar bawaan OS dipakai.
 *
 * @param {number} hideDelay  Jeda (ms) sebelum garis disembunyikan. Default 1200.
 */

const PAD = 6; // jarak thumb dari ujung track (px)
const MIN_THUMB = 44;
const EDGE = 18; // lebar zona hover di tepi kanan (px)
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

export default function Scrollbar({ hideDelay = 1200 }) {
  const barRef = useRef(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return undefined;
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.scrollingElement || document.documentElement;
    document.documentElement.setAttribute('data-custom-scrollbar', '');

    let current = null; // { el, isRoot }
    let lastTop = 0;
    let dir = 1;
    let dragging = false;
    let hideTimer;
    let raf = 0;

    const metrics = (t) => {
      if (t.isRoot) {
        return {
          top: 0,
          right: document.documentElement.clientWidth,
          clientH: window.innerHeight,
          scrollH: root.scrollHeight,
          scrollTop: window.scrollY
        };
      }
      const r = t.el.getBoundingClientRect();
      return {
        top: r.top + t.el.clientTop,
        right: r.right,
        clientH: t.el.clientHeight,
        scrollH: t.el.scrollHeight,
        scrollTop: t.el.scrollTop
      };
    };

    const geometry = (m) => {
      const trackH = m.clientH - PAD * 2;
      const max = m.scrollH - m.clientH;
      if (max <= 1 || trackH <= 0) return null;
      const h = Math.max(MIN_THUMB, Math.min(trackH, (m.clientH / m.scrollH) * trackH));
      const y = m.top + PAD + (m.scrollTop / max) * (trackH - h);
      return { h, y, max, trackH };
    };

    const place = (t, snap) => {
      const m = metrics(t);
      const g = geometry(m);
      if (!g) return false;

      // Animasi transform translateY + height jauh lebih mulus (60fps GPU-accelerated)
      // dibandingkan transisi simultan top & bottom yang menyebabkan layout jitter
      bar.style.transition = snap || dragging || reduced
        ? 'none'
        : `transform 120ms ${EASE}, height 160ms ${EASE}`;
      bar.style.height = `${g.h}px`;
      bar.style.transform = `translate3d(0, ${g.y}px, 0)`;
      bar.style.right = `${window.innerWidth - m.right}px`;
      return true;
    };

    const hide = () => {
      if (!dragging) delete bar.dataset.visible;
    };

    const show = () => {
      bar.dataset.visible = '';
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function tick() {
        // Tahan selama kursor di atas garis atau sedang diseret
        if (dragging || bar.matches(':hover')) {
          hideTimer = setTimeout(tick, 400);
          return;
        }
        hide();
      }, hideDelay);
    };

    const activate = (t) => {
      const snap = !current || current.el !== t.el;
      current = t;
      if (snap) lastTop = metrics(t).scrollTop;
      if (place(t, snap)) show();
      else hide();
    };

    const resolve = (e) => {
      const t = e.target;
      if (t === document || t === window || t === document.documentElement || t === document.body) {
        return { el: root, isRoot: true };
      }
      let el = t instanceof Element ? t : null;
      if (
        el &&
        (el.closest('[data-no-scrollbar]') ||
          el.closest('[role="listbox"], [role="menu"], [role="dialog"], [data-popover], .popover, [data-floating]'))
      ) {
        return null;
      }
      while (el && el !== document.documentElement && el !== document.body) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
          return { el, isRoot: false };
        }
        el = el.parentElement;
      }
      return { el: root, isRoot: true };
    };

    const onScroll = (e) => {
      if (dragging) {
        if (current) place(current, false);
        return;
      }
      const t = resolve(e);
      if (t) activate(t);
    };

    // Dekati tepi kanan area scroll -> garis muncul (agar bisa diseret tanpa harus scroll dulu)
    const onMove = (e) => {
      if (dragging || raf) return;
      const { clientX: x, clientY: y } = e;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const cands = [];
        if (current && !current.isRoot && current.el.isConnected) cands.push(current);
        cands.push({ el: root, isRoot: true });
        for (const t of cands) {
          const m = metrics(t);
          const inY = t.isRoot || (y >= m.top && y <= m.top + m.clientH);
          if (inY && x <= m.right + 2 && x >= m.right - EDGE) {
            if (geometry(m)) activate(t);
            return;
          }
        }
      });
    };

    const onResize = () => {
      if (current && !place(current, true)) hide();
    };

    const onDown = (e) => {
      if (!current || e.button !== 0) return;
      const m = metrics(current);
      const g = geometry(m);
      if (!g || g.trackH - g.h <= 0) return;
      e.preventDefault();
      dragging = true;
      bar.dataset.dragging = '';
      bar.setPointerCapture(e.pointerId);

      const startY = e.clientY;
      const startTop = m.scrollTop;
      const ratio = g.max / (g.trackH - g.h);
      const target = current;

      const move = (ev) => {
        const next = startTop + (ev.clientY - startY) * ratio;
        if (target.isRoot) window.scrollTo(0, next);
        else target.el.scrollTop = next;
      };
      const up = () => {
        dragging = false;
        delete bar.dataset.dragging;
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        bar.removeEventListener('pointercancel', up);
        show();
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
      bar.addEventListener('pointercancel', up);
    };

    // capture: event scroll tidak bubble dari elemen anak
    const opts = { capture: true, passive: true };
    window.addEventListener('scroll', onScroll, opts);
    window.addEventListener('wheel', onScroll, opts);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    bar.addEventListener('pointerdown', onDown);

    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('wheel', onScroll, { capture: true });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      bar.removeEventListener('pointerdown', onDown);
      clearTimeout(hideTimer);
      cancelAnimationFrame(raf);
      document.documentElement.removeAttribute('data-custom-scrollbar');
    };
  }, [hideDelay]);

  return (
    <div ref={barRef} className="esbe-sb" aria-hidden="true">
      <span className="esbe-sb__line" />
    </div>
  );
}