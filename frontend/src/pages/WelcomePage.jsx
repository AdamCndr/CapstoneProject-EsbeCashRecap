import { useCallback, useEffect, useState } from 'react';
import './WelcomePage.css';

const HOLD_MS = 1900; // lama "Welcome" tampil sebelum mulai transisi
const FADE_MS = 700; // sinkron dengan durasi cross-fade di CSS

export default function WelcomePage({ user, onReveal, onDone }) {
  const [leaving, setLeaving] = useState(false);

  const finish = useCallback(() => onDone(), [onDone]);

  // Kunci scroll saat sambutan tampil agar overlay benar-benar menutup viewport
  useEffect(() => {
    document.body.classList.add('welcome-open');
    return () => document.body.classList.remove('welcome-open');
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const hold = reduced ? 250 : HOLD_MS;
    const fade = reduced ? 120 : FADE_MS;

    // Mulai membuka aplikasi (cross-fade) sebelum overlay benar-benar hilang
    const revealTimer = setTimeout(() => {
      setLeaving(true);
      onReveal();
    }, hold);
    const doneTimer = setTimeout(finish, hold + fade);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(doneTimer);
    };
  }, [onReveal, finish]);

  const fullName = user?.name || user?.username || (user?.role === 'Pemilik' ? 'Pemilik' : 'Karyawan');

  return (
    <div className={`welcome-overlay ${leaving ? 'is-leaving' : ''}`}>
      {/* Fullscreen memakai grad-hero yang sama dengan hero Dashboard */}
      <div className="welcome-decor" aria-hidden="true" />

      <div className="welcome-content">
        <h1 className="welcome-title">Welcome</h1>
        <p className="welcome-name">{fullName}</p>
      </div>
    </div>
  );
}
