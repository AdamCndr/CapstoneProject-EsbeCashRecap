import { useId, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { motion } from '../../lib/ui';

/** Searchbar rincian transaksi dengan pola Dashboard (token palet + reduced motion). */
export default function TxSearch({ value, onChange, label, placeholder, className = '' }) {
  const id = useId();
  const inputRef = useRef(null);

  return (
    <div
      className={`group relative w-full transition-[width] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none sm:w-80 sm:focus-within:w-96 ${className}`}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)] transition-colors duration-200 group-hover:text-[var(--royal-600)] group-focus-within:text-[var(--royal-600)] motion-reduce:transition-none"
      />
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="searchbox"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onChange('');
          }
        }}
        className={`h-10 w-full rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] pl-10 pr-10 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] hover:-translate-y-px hover:border-[color:var(--royal-400)] hover:shadow-[var(--shadow-search-hover)] focus:border-[color:var(--royal-400)] focus:shadow-[var(--shadow-search-focus)] focus:ring-2 focus:ring-[color:var(--royal-300)] active:scale-[0.99] motion-reduce:transition-none ${motion}`}
      />
      <button
        type="button"
        aria-label="Hapus pencarian"
        tabIndex={value ? 0 : -1}
        onClick={() => {
          onChange('');
          inputRef.current?.focus();
        }}
        className={`absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--royal-500)] active:scale-90 motion-reduce:transition-none ${
          value ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0'
        }`}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
