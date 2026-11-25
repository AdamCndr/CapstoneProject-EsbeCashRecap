import { useId } from 'react';
import { Search, X } from 'lucide-react';

/** Search field bergaya header (pill, ikon di kiri, tombol hapus di kanan).
 *  Dipakai untuk pencarian transaksi dan filter tiap kolom pada tabel rincian.
 */
export default function SearchField({
  value = '',
  onChange,
  placeholder = 'Cari...',
  label = 'Cari',
  className = '',
}) {
  const id = useId();

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        style={{ colorScheme: 'light' }}
        className="w-full rounded-full border-0 bg-[var(--surface-card)] text-[var(--text-main)] outline-none ring-1 ring-inset ring-[color:var(--border-default)] transition-[background-color,box-shadow] duration-200 placeholder:text-[var(--text-muted)] hover:ring-[color:var(--royal-400)] focus:ring-2 focus:ring-[color:var(--royal-300)] [&::-webkit-search-cancel-button]:appearance-none h-10 pl-11 pr-11 text-sm"
      />
      {value ? (
        <button
          type="button"
          aria-label={`Hapus ${label.toLowerCase()}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange?.('')}
          className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
