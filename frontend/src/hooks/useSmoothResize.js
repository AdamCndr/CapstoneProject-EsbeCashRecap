import { useEffect, useRef } from 'react';

/** Animasi perubahan ukuran kartu secara mulus (FLIP via Web Animations API).
 *  Dipakai saat teks di dalam kartu berubah dan tinggi/lebar kartu ikut berubah.
 *  TargetRef bisa berasal dari hook lain (mis. useTiltSurface) — tidak perlu ref baru.
 */
export function useSmoothResize(targetRef, options = {}) {
  const { duration = 300, easing = 'cubic-bezier(0.22, 1, 0.36, 1)' } = options;
  const prevRef = useRef(null);
  const animRef = useRef(null);
  const lockRef = useRef(false);

  useEffect(() => {
    const el = targetRef?.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;

    const reducedMotion = () =>
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const restore = () => {
      if (animRef.current) {
        animRef.current = null;
      }
      lockRef.current = false;
      el.style.overflow = '';
      const rect = el.getBoundingClientRect();
      prevRef.current = { w: rect.width, h: rect.height };
    };

    const observer = new ResizeObserver(() => {
      // Hindari loop: animasi kita sendiri juga memicu ResizeObserver.
      if (lockRef.current) return;

      const rect = el.getBoundingClientRect();
      const prev = prevRef.current;
      prevRef.current = { w: rect.width, h: rect.height };
      if (!prev) return;
      if (Math.abs(rect.width - prev.w) < 1 && Math.abs(rect.height - prev.h) < 1) return;
      if (reducedMotion() || typeof el.animate !== 'function') return;

      animRef.current?.cancel();
      const overflow = el.style.overflow;
      el.style.overflow = 'hidden';
      lockRef.current = true;

      const animation = el.animate(
        [
          { width: `${prev.w}px`, height: `${prev.h}px` },
          { width: `${rect.width}px`, height: `${rect.height}px` },
        ],
        { duration, easing },
      );
      animRef.current = animation;
      animation.finished.then(restore).catch(restore);
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      animRef.current?.cancel();
      animRef.current = null;
      lockRef.current = false;
      el.style.overflow = '';
    };
  }, [targetRef, duration, easing]);
}
