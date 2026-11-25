import { useEffect, useState } from 'react';

// Pola animasi Dashboard, dipakai ulang oleh halaman lain (Fase 1 dilewati sesuai keputusan).
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const BASE_DELAY = 150;
export const STAGGER = 70;
export const ENTER_MS = 700;
export const SETTLE_MS = BASE_DELAY + 10 * STAGGER + ENTER_MS + 300;

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Fade + naik. Style dilepas setelah selesai agar hover/transisi CSS asli kembali berlaku. */
export const reveal = (ready, settled) => (i, y = 18) => {
  if (settled) return undefined;
  const d = BASE_DELAY + i * STAGGER;
  return {
    opacity: ready ? 1 : 0,
    transform: ready ? 'none' : `translateY(${y}px)`,
    transition: `opacity 650ms ease-out ${d}ms, transform ${ENTER_MS}ms ${EASE_OUT} ${d}ms`,
    willChange: 'opacity, transform'
  };
};

/** Bar tumbuh dari 0; transisi lebar tetap aktif saat filter berubah. */
export const grow = (ready, settled) => (pct, i, nonZero = pct > 0) => ({
  width: `${ready ? Math.max(pct, nonZero ? 2 : 0) : 0}%`,
  transition: `width 900ms ${EASE_OUT} ${settled ? 0 : BASE_DELAY + i * STAGGER + 350}ms`
});

export function usePageReveal() {
  const reduced = prefersReducedMotion();
  const [ready, setReady] = useState(reduced);
  const [settled, setSettled] = useState(reduced);

  useEffect(() => {
    if (settled) return undefined;
    let id2;
    let id3;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setReady(true));
      id3 = setTimeout(() => setSettled(true), SETTLE_MS);
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
      clearTimeout(id3);
    };
  }, [settled]);

  return { ready, settled, reveal: reveal(ready, settled), grow: grow(ready, settled) };
}
