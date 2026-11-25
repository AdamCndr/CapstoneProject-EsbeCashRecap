import { useEffect, useRef } from 'react';

/** Port React dari composable Vue `useTiltSurface`.
 *  Hanya tilt 3D—glow tidak ikut ditulis supaya kartu tetap bersih.
 */
export function useTiltSurface(options = {}) {
  const {
    perspective = 820,
    rotate = 4.5,
    scale = 1.015,
    resetDuration = 320,
    resetTiming = 'cubic-bezier(0.23, 1, 0.32, 1)',
    enabled = true,
  } = options;

  const ref = useRef(null);
  const rafRef = useRef(null);
  const leaveTimerRef = useRef(null);
  const pointRef = useRef({ clientX: 0, clientY: 0 });

  const reducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const clearLeaveTimer = () => {
    if (leaveTimerRef.current === null) return;
    clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = null;
  };

  const clearTransformTransition = (el) => {
    el.style.transitionProperty = '';
    el.style.transitionDuration = '';
    el.style.transitionTimingFunction = '';
    el.style.willChange = '';
  };

  const onMouseMove = (event) => {
    if (!enabled || reducedMotion()) return;
    const el = ref.current ?? event.currentTarget;
    if (!el) return;

    clearLeaveTimer();

    // Saat mengikuti mouse, transisi dimatikan supaya tidak ada lag.
    el.style.transitionProperty = 'transform';
    el.style.transitionDuration = '0ms';
    el.style.transitionTimingFunction = 'linear';
    el.style.willChange = 'transform';

    pointRef.current = { clientX: event.clientX, clientY: event.clientY };

    if (rafRef.current !== null) return;

    const flush = () => {
      rafRef.current = null;
      const node = ref.current;
      if (!node) return;
      const box = node.getBoundingClientRect();
      const { clientX, clientY } = pointRef.current;

      const dx = (clientX - (box.left + box.width / 2)) / (box.width / 2);
      const dy = (clientY - (box.top + box.height / 2)) / (box.height / 2);

      node.style.transform =
        `perspective(${perspective}px) rotateX(${(-dy * rotate).toFixed(2)}deg) ` +
        `rotateY(${(dx * rotate).toFixed(2)}deg) scale(${scale})`;
    };

    if (typeof requestAnimationFrame === 'function') {
      rafRef.current = requestAnimationFrame(flush);
    } else {
      flush();
    }
  };

  const onMouseLeave = () => {
    if (rafRef.current !== null) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    clearLeaveTimer();

    const el = ref.current;
    if (!el) return;

    el.style.transitionProperty = 'transform';
    el.style.transitionDuration = `${resetDuration}ms`;
    el.style.transitionTimingFunction = resetTiming;
    el.style.transform = '';

    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null;
      if (ref.current) clearTransformTransition(ref.current);
    }, resetDuration + 20);
  };

  useEffect(
    () => () => {
      if (rafRef.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      clearLeaveTimer();
      if (ref.current) clearTransformTransition(ref.current);
    },
    [],
  );

  return { ref, onMouseMove, onMouseLeave };
}
