/**
 * GridSpinner — Indikator loading 3x3 kotak dengan animasi gelombang diagonal.
 * @param {{ size?: 'sm' | 'md' | 'lg', label?: string, className?: string }} props
 */
export default function GridSpinner({
  size = 'md',
  label = 'Memuat',
  className = '',
}) {
  const sizeClass =
    size === 'sm'
      ? 'grid-spinner--sm'
      : size === 'lg'
        ? 'grid-spinner--lg'
        : '';

  return (
    <span
      className={`grid-spinner ${sizeClass} ${className}`.trim()}
      role="status"
      aria-label={label}
    >
      <i style={{ '--d': 0 }} />
      <i style={{ '--d': 1 }} />
      <i style={{ '--d': 2 }} />
      <i style={{ '--d': 1 }} />
      <i style={{ '--d': 2 }} />
      <i style={{ '--d': 3 }} />
      <i style={{ '--d': 2 }} />
      <i style={{ '--d': 3 }} />
      <i style={{ '--d': 4 }} />
    </span>
  );
}

