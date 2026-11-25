import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import FloatingPanel from './FloatingPanel';

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
];
const WEEKDAYS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const parseISO = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
};
const todayISO = () => {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth(), n.getDate());
};

const CAL_CSS = `
@keyframes cal-next{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
@keyframes cal-prev{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:none}}
@keyframes cal-zoom{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
.cal-next{animation:cal-next 260ms var(--ease-out)}
.cal-prev{animation:cal-prev 260ms var(--ease-out)}
.cal-zoom{animation:cal-zoom 220ms var(--ease-out)}
@media (prefers-reduced-motion:reduce){.cal-next,.cal-prev,.cal-zoom{animation:none}}
`;

/** Kalender kustom pengganti <input type="date"> (port pola Dashboard). */
export default function DateField({
  value,
  onChange,
  id,
  ariaLabel,
  allowClear = true,
  className = ''
}) {
  const fieldId = useId();
  const anchorRef = useRef(null);
  const kbdRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('days'); // 'days' | 'months'
  const [dir, setDir] = useState('none');
  const [view, setView] = useState(() => {
    const p = parseISO(value) || parseISO(todayISO());
    return { y: p.y, m: p.m };
  });
  const [focusISO, setFocusISO] = useState(value || todayISO());

  const sel = parseISO(value);
  const today = todayISO();
  const label = sel ? `${pad2(sel.d)}/${pad2(sel.m + 1)}/${sel.y}` : allowClear ? 'Semua tanggal' : 'Pilih tanggal';

  const close = useCallback(() => setOpen(false), []);
  const openPanel = (e) => {
    if (open) {
      close();
      return;
    }
    const p = parseISO(value) || parseISO(todayISO());
    setView({ y: p.y, m: p.m });
    setFocusISO(value || todayISO());
    setMode('days');
    setDir('none');
    kbdRef.current = e.detail === 0;
    setOpen(true);
  };

  const shiftMonth = (delta) => {
    setDir(delta > 0 ? 'next' : 'prev');
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const shiftYear = (delta) => {
    setDir(delta > 0 ? 'next' : 'prev');
    setView((v) => ({ ...v, y: v.y + delta }));
  };
  const choose = (iso) => {
    onChange(iso);
    close();
    anchorRef.current?.focus();
  };

  const cells = useMemo(() => {
    const offset = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(view.y, view.m, 1 - offset + i);
      return {
        iso: toISO(d.getFullYear(), d.getMonth(), d.getDate()),
        day: d.getDate(),
        out: d.getMonth() !== view.m
      };
    });
  }, [view]);

  const moveFocus = (days) => {
    const p = parseISO(focusISO);
    const nd = new Date(p.y, p.m, p.d + days);
    setFocusISO(toISO(nd.getFullYear(), nd.getMonth(), nd.getDate()));
    if (nd.getMonth() !== view.m || nd.getFullYear() !== view.y) {
      setDir(days > 0 ? 'next' : 'prev');
      setView({ y: nd.getFullYear(), m: nd.getMonth() });
    }
  };
  const onGridKey = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) {
      e.preventDefault();
      kbdRef.current = true;
      moveFocus(step);
    }
  };

  useEffect(() => {
    if (!open || mode !== 'days' || !kbdRef.current) return undefined;
    let r2;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() =>
        document
          .querySelector(`[data-cal-day="${fieldId}-${focusISO}"]`)
          ?.focus({ preventScroll: true })
      );
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [open, mode, focusISO, view, fieldId]);

  const navBtn =
    'flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] motion-reduce:transition-none';

  return (
    <div className={`relative ${className}`}>
      <button
        ref={anchorRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel || `Pilih tanggal, ${label}`}
        onClick={openPanel}
        className={`group flex h-10 w-full items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-main)] shadow-[var(--shadow-inset-hero)] outline-none transition-all duration-200 hover:-translate-y-px hover:border-[color:var(--royal-400)] hover:shadow-[var(--shadow-inset-hero-hover)] focus-visible:border-[color:var(--royal-400)] focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-[0.99] motion-reduce:transition-none ${
          open ? 'border-[color:var(--royal-400)] ring-2 ring-[color:var(--royal-300)]' : ''
        }`}
      >
        <CalendarDays
          className="h-4 w-4 shrink-0 text-[var(--royal-600)] transition-transform duration-200 group-hover:-rotate-6 motion-reduce:transition-none"
          aria-hidden="true"
        />
        <span className="flex-1 text-left font-medium tabular-nums">{label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-300 motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      <FloatingPanel
        open={open}
        anchorRef={anchorRef}
        onClose={close}
        matchWidth
        role="dialog"
        ariaLabel="Kalender"
        className="w-[19rem] rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3 shadow-[var(--shadow-popover-lg)]"
      >
        <style>{CAL_CSS}</style>
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setDir('zoom');
              setMode((m) => (m === 'days' ? 'months' : 'days'));
            }}
            aria-label="Pilih bulan dan tahun"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-[var(--text-main)] transition-all duration-150 hover:bg-[var(--surface-muted)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] motion-reduce:transition-none"
          >
            {mode === 'days' ? `${MONTHS_ID[view.m]} ${view.y}` : view.y}
            <ChevronDown
              className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-300 motion-reduce:transition-none ${
                mode === 'months' ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label={mode === 'days' ? 'Bulan sebelumnya' : 'Tahun sebelumnya'}
              onClick={() => (mode === 'days' ? shiftMonth(-1) : shiftYear(-1))}
              className={navBtn}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={mode === 'days' ? 'Bulan berikutnya' : 'Tahun berikutnya'}
              onClick={() => (mode === 'days' ? shiftMonth(1) : shiftYear(1))}
              className={navBtn}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div key={`${mode}-${view.y}-${view.m}`} className={`cal-${dir}`}>
          {mode === 'days' ? (
            <>
              <div className="mb-1 grid grid-cols-7 place-items-center">
                {WEEKDAYS_ID.map((d) => (
                  <span
                    key={d}
                    className="flex h-8 w-9 items-center justify-center text-[11px] font-medium text-[var(--text-muted)]"
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div
                role="grid"
                aria-label={`${MONTHS_ID[view.m]} ${view.y}`}
                onKeyDown={onGridKey}
                className="grid grid-cols-7 place-items-center gap-y-0.5"
              >
                {cells.map((c) => {
                  const isSel = c.iso === value;
                  const isToday = c.iso === today;
                  const parsed = parseISO(c.iso);
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      data-cal-day={`${fieldId}-${c.iso}`}
                      tabIndex={c.iso === focusISO ? 0 : -1}
                      aria-pressed={isSel}
                      aria-label={`${c.day} ${MONTHS_ID[parsed.m]} ${parsed.y}`}
                      onClick={() => choose(c.iso)}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm tabular-nums transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-90 motion-reduce:transition-none ${
                        isSel
                          ? 'bg-[var(--royal-600)] font-semibold text-[var(--text-inverse)] shadow-md hover:scale-105'
                          : `${c.out ? 'text-[var(--text-muted-alt)]' : 'text-[var(--text-main)]'} hover:scale-110 hover:bg-[var(--surface-muted)] ${
                              isToday ? 'font-semibold ring-1 ring-inset ring-[color:var(--royal-400)]' : ''
                            }`
                      }`}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {MONTHS_ID.map((name, i) => {
                const isSel = i === view.m;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setDir('zoom');
                      setView((v) => ({ ...v, m: i }));
                      setMode('days');
                    }}
                    className={`h-11 rounded-xl text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] active:scale-95 motion-reduce:transition-none ${
                      isSel
                        ? 'bg-[var(--royal-600)] font-semibold text-[var(--text-inverse)] shadow-md'
                        : 'text-[var(--text-main)] hover:scale-105 hover:bg-[var(--surface-muted)]'
                    }`}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-[var(--border-default)] pt-2 text-xs font-medium">
          {allowClear ? (
            <button
              type="button"
              onClick={() => choose('')}
              className="rounded-md px-2 py-1 text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] motion-reduce:transition-none"
            >
              Hapus
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => choose(todayISO())}
            className="rounded-md px-2 py-1 text-[var(--text-link)] transition-all duration-150 hover:bg-[var(--surface-muted)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] motion-reduce:transition-none"
          >
            Hari ini
          </button>
        </div>
      </FloatingPanel>
    </div>
  );
}
