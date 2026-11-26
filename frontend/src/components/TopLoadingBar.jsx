import { useEffect, useRef, useState } from 'react';

/**
 * TopLoadingBar — Garis progres tipis di paling atas layar saat pindah halaman.
 * @param {{ trigger: string }} props
 */
export default function TopLoadingBar({ trigger }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'done'
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setStatus('loading');
    const finishTimer = setTimeout(() => setStatus('done'), 260);
    const hideTimer = setTimeout(() => setStatus('idle'), 520);

    return () => {
      clearTimeout(finishTimer);
      clearTimeout(hideTimer);
    };
  }, [trigger]);

  if (status === 'idle') return null;

  return (
    <div
      className={`top-loading-bar ${status === 'done' ? 'is-done' : ''}`}
      aria-hidden="true"
    />
  );
}

