import { useEffect, useRef } from 'react';

/** Port React dari composable Vue `useMouseGlow`.
 *  Menulis CSS variable --glow-x / --glow-y / --glow-opacity / --glow-size
 *  ke elemen agar efek radial glow bisa dirender lewat class `.mouse-glow` / `.hero-glow`.
 *  Saat mouse keluar, opacity diturunkan bertahap (bukan langsung 0).
 */
export function useMouseGlow(options = {}) {
  const {
    xVar = '--glow-x',
    yVar = '--glow-y',
    opacityVar = '--glow-opacity',
    sizeVar = '--glow-size',
    size = 80,
    opacity = 0.12,
    fadeDuration = 360,
    enabled = true,
  } = options;

  const ref = useRef(null);
  const rafRef = useRef(null);
  const fadeRafRef = useRef(null);
  const pointRef = useRef({ x: 0, y: 0 });

  const reducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const cancelFade = () => {
    if (fadeRafRef.current === null) return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(fadeRafRef.current);
    fadeRafRef.current = null;
  };

  const cancelPositionFrame = () => {
    if (rafRef.current === null) return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const flush = () => {
    rafRef.current = null;
    const el = ref.current;
    if (!el) return;
    const { x, y } = pointRef.current;
    el.style.setProperty(xVar, `${x}px`);
    el.style.setProperty(yVar, `${y}px`);
  };

  const onMouseMove = (event) => {
    if (!enabled || reducedMotion()) return;
    const el = ref.current ?? event.currentTarget;
    if (!el) return;

    // Kembali masuk saat proses redup berjalan -> batalkan, nyalakan lagi.
    cancelFade();
    cancelPositionFrame();

    const rect = el.getBoundingClientRect();
    pointRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };

    el.style.setProperty(sizeVar, `${size}px`);
    el.style.setProperty(opacityVar, String(opacity));
    el.style.setProperty(xVar, `${pointRef.current.x}px`);
    el.style.setProperty(yVar, `${pointRef.current.y}px`);

    if (typeof requestAnimationFrame === 'function') {
      rafRef.current = requestAnimationFrame(flush);
    } else {
      flush();
    }
  };

  const onMouseLeave = (event) => {
    const el = ref.current ?? event.currentTarget;
    if (!el) return;

    cancelPositionFrame();
    cancelFade();

    const current = Number.parseFloat(el.style.getPropertyValue(opacityVar)) || 0;
    if (!current || reducedMotion() || typeof requestAnimationFrame !== 'function') {
      el.style.setProperty(opacityVar, '0');
      return;
    }

    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const start = now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    const step = (timestamp) => {
      const t = Math.min(1, (timestamp - start) / fadeDuration);
      el.style.setProperty(opacityVar, String(current * (1 - easeOut(t))));
      if (t < 1) {
        fadeRafRef.current = requestAnimationFrame(step);
      } else {
        fadeRafRef.current = null;
        el.style.setProperty(opacityVar, '0');
      }
    };

    fadeRafRef.current = requestAnimationFrame(step);
  };

  useEffect(
    () => () => {
      cancelPositionFrame();
      cancelFade();
    },
    [],
  );

  return { ref, onMouseMove, onMouseLeave };
}
