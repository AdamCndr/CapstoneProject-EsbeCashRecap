import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EASE_OUT } from '../../lib/motion';

/** Popover portal: auto-flip, tutup via klik luar/Esc, masuk 260ms / keluar 180ms. */
export default function FloatingPanel({
  open,
  anchorRef,
  onClose,
  children,
  className = '',
  matchWidth = false,
  panelId,
  role,
  ariaLabel
}) {
  const panelRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (open) {
      let r2;
      let r3;
      const r1 = requestAnimationFrame(() => {
        setShown(false);
        setMounted(true);
        r2 = requestAnimationFrame(() => {
          r3 = requestAnimationFrame(() => setShown(true));
        });
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
        cancelAnimationFrame(r3);
      };
    }
    const t = setTimeout(() => {
      setMounted(false);
      setPos(null);
    }, 200);
    return () => clearTimeout(t);
  }, [open]);

  const visible = open && shown;

  const place = useCallback(() => {
    const a = anchorRef.current;
    const p = panelRef.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    const w = p.offsetWidth;
    const h = p.offsetHeight;
    const gap = 8;
    const spaceBelow = window.innerHeight - r.bottom - gap;
    const up = spaceBelow < h && r.top > spaceBelow;
    const top = Math.round(up ? Math.max(8, r.top - h - gap) : r.bottom + gap);
    const left = Math.round(Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - w - 8)));
    const minW = Math.round(r.width);
    setPos((o) => (o && o.top === top && o.left === left && o.up === up && o.minW === minW ? o : { top, left, up, minW }));
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (mounted) place();
  });

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        anchorRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, onClose, place, anchorRef]);

  if (!mounted) return null;
  const up = !!pos?.up;
  return createPortal(
    <div
      ref={panelRef}
      id={panelId}
      role={role}
      aria-label={ariaLabel}
      className={`fixed z-[1000] ${className}`}
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        minWidth: matchWidth ? Math.max(pos?.minW ?? 0, 168) : undefined,
        opacity: visible && pos ? 1 : 0,
        transform: visible ? 'none' : `translateY(${up ? 8 : -8}px) scale(0.95)`,
        transformOrigin: up ? 'bottom left' : 'top left',
        transition: visible
          ? `opacity 180ms ease, transform 260ms ${EASE_OUT}`
          : 'opacity 140ms ease, transform 180ms ease-in',
        pointerEvents: visible ? 'auto' : 'none',
        willChange: 'opacity, transform'
      }}
    >
      {children}
    </div>,
    document.body
  );
}
