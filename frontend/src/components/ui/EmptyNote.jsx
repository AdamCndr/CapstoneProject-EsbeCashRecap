export default function EmptyNote({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--surface-muted)] py-12 text-center text-sm text-[var(--text-muted)] ${className}`}
    >
      {children}
    </div>
  );
}
