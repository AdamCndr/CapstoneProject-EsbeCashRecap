/**
 * Komponen Skeleton reusable berbasis Tailwind animate-pulse.
 */
export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-3 py-2" role="status" aria-label="Memuat data">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex items-center gap-4">
          {Array.from({ length: cols }).map((__, colIdx) => (
            <div
              key={colIdx}
              className={`h-4 animate-pulse rounded-md bg-[var(--surface-muted)] ${
                colIdx === 0 ? 'w-1/3' : 'flex-1'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Memuat ringkasan">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="card space-y-3">
          <div className="h-3.5 w-1/2 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-7 w-2/3 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--surface-muted)]" />
        </div>
      ))}
    </div>
  );
}

