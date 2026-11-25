import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import FloatingPanel from './FloatingPanel';

/** Listbox kustom pengganti <select> (dipakai Dashboard untuk filter kolom). */
export default function ColumnFilterSelect({
  label,
  value,
  options,
  onChange,
  id,
  ariaLabel,
  allowEmpty = true,
  size = 'sm',
  className = ''
}) {
  const generatedId = useId();
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const normalized = useMemo(
    () => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options]
  );
  const items = useMemo(
    () => [
      ...(allowEmpty ? [{ value: '', label: `Semua ${label}` }] : []),
      ...normalized
    ],
    [allowEmpty, label, normalized]
  );
  const selIdx = Math.max(0, items.findIndex((i) => i.value === (value || '')));
  const [active, setActive] = useState(selIdx);

  const close = useCallback(() => setOpen(false), []);
  const openMenu = () => {
    setActive(selIdx);
    setOpen(true);
  };
  const pick = (v) => {
    onChange(v);
    close();
    btnRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    let r2;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        const l = listRef.current;
        const el = l?.querySelector(`[data-i="${active}"]`);
        if (!l || !el) return;
        if (el.offsetTop < l.scrollTop) l.scrollTop = el.offsetTop;
        else if (el.offsetTop + el.offsetHeight > l.scrollTop + l.clientHeight) {
          l.scrollTop = el.offsetTop + el.offsetHeight - l.clientHeight;
        }
      });
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [open, active]);

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    const last = items.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(last, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(last);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(items[active].value);
    } else if (e.key === 'Tab') close();
  };

  const sizeClass = size === 'md' ? 'h-10 rounded-xl pl-3 pr-2.5 text-sm' : 'h-8 rounded-lg pl-2.5 pr-2 text-xs';

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${generatedId}-list`}
        aria-activedescendant={open ? `${generatedId}-${active}` : undefined}
        aria-label={ariaLabel || `Filter ${label}`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-1 border bg-[var(--surface-card)] text-left outline-none transition-all duration-150 hover:border-[color:var(--royal-400)] hover:shadow-sm focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-[0.97] motion-reduce:transition-none ${sizeClass} ${
          open ? 'border-[color:var(--royal-400)] ring-2 ring-[color:var(--royal-300)]' : 'border-[var(--border-default)]'
        } ${value ? 'font-medium text-[var(--royal-600)]' : 'text-[var(--text-main)]'}`}
      >
        <span className="truncate">{value ? normalized.find((o) => o.value === value)?.label || value : `Semua ${label}`}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform duration-300 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <FloatingPanel
        open={open}
        anchorRef={btnRef}
        onClose={close}
        matchWidth
        className="max-w-[18rem] rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-1 shadow-[var(--shadow-popover-md)]"
      >
        <ul
          ref={listRef}
          id={`${generatedId}-list`}
          role="listbox"
          aria-label={ariaLabel || `Filter ${label}`}
          className="relative max-h-60 overflow-y-auto"
        >
          {items.map((it, i) => {
            const isSel = it.value === (value || '');
            return (
              <li
                key={it.value || '__all'}
                id={`${generatedId}-${i}`}
                role="option"
                aria-selected={isSel}
                data-i={i}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(it.value)}
                className={`flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs transition-colors duration-100 active:scale-[0.98] motion-reduce:transition-none ${
                  i === active ? 'bg-[var(--surface-muted)]' : ''
                } ${isSel ? 'font-semibold text-[var(--royal-600)]' : 'text-[var(--text-main)]'}`}
              >
                <span className="truncate">{it.label}</span>
                <Check
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 shrink-0 transition-all duration-200 motion-reduce:transition-none ${
                    isSel ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                  }`}
                />
              </li>
            );
          })}
        </ul>
      </FloatingPanel>
    </div>
  );
}
