import { Check, Clock } from 'lucide-react';
import { ico, motion, shiftHours } from '../../lib/ui';

const OPTIONS = [
  {
    value: 'pagi',
    label: 'Shift Pagi',
    dot: 'bg-[var(--shift-pagi)]',
    active: 'border-[var(--amber-500)] bg-[var(--amber-50)] ring-2 ring-[var(--amber-100)]',
    compactActive: 'bg-[var(--surface-card)] text-[var(--amber-700)] shadow-[var(--shadow-royal-card)]',
    short: 'Pagi',
    text: 'text-[var(--amber-700)]',
    check: 'border-[var(--amber-600)] bg-[var(--amber-600)]'
  },
  {
    value: 'siang',
    label: 'Shift Siang / Sore',
    dot: 'bg-[var(--shift-siang)]',
    active: 'border-[var(--royal-700)] bg-[var(--royal-50)] ring-2 ring-[var(--royal-100)]',
    compactActive: 'bg-[var(--surface-card)] text-[var(--royal-800)] shadow-[var(--shadow-royal-card)]',
    short: 'Siang',
    text: 'text-[var(--royal-800)]',
    check: 'border-[var(--royal-700)] bg-[var(--royal-700)]'
  }
];

/** Pemilih shift dua opsi (radio asli + label kartu) dengan token Dashboard. */
export default function ShiftSwitch({
  value,
  onChange,
  name = 'shift',
  disabled = false,
  compact = false,
  className = ''
}) {
  if (compact) {
    return (
      <fieldset
        className={`grid grid-cols-2 gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-1 ${className}`}
        disabled={disabled}
      >
        <legend className="sr-only">Pilih shift kerja</legend>
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              } ${active ? opt.compactActive : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'} focus-within:ring-2 focus-within:ring-[color:var(--royal-300)] ${motion}`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={active}
                onChange={() => onChange(opt.value)}
                disabled={disabled}
                className="sr-only"
              />
              <span className={`h-2 w-2 rounded-full ${opt.dot}`} aria-hidden="true" />
              {opt.short}
            </label>
          );
        })}
      </fieldset>
    );
  }

  return (
    <fieldset className={`space-y-2.5 ${className}`} disabled={disabled}>
      <legend className="sr-only">Pilih shift kerja</legend>
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`flex items-center justify-between rounded-xl border p-3.5 text-left ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            } ${
              active
                ? opt.active
                : 'border-[var(--border-default)] bg-[var(--surface-card)] hover:border-[var(--border-strong)]'
            } focus-within:border-[color:var(--royal-400)] focus-within:ring-2 focus-within:ring-[color:var(--royal-300)] ${motion}`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={active}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
              className="sr-only"
            />
            <span className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${opt.dot}`} aria-hidden="true" />
              <span>
                <span className={`block text-sm font-semibold ${active ? opt.text : 'text-[var(--text-main)]'}`}>
                  {opt.label}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted)] tabular-nums">
                  <Clock {...ico} />
                  {shiftHours[opt.value]} WIB
                </span>
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                active ? opt.check : 'border-[var(--border-strong)]'
              }`}
            >
              {active && <Check className="h-3 w-3 text-[var(--text-inverse)]" strokeWidth={2.5} />}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
