import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Lock, ShieldCheck, Store, User } from 'lucide-react';
import { btnPrimary, btnSecondary, card, field, hint, ico, label, motion, Notice } from '../lib/ui';
import { usePageReveal } from '../lib/motion';
import ShiftSwitch from '../components/ui/ShiftSwitch';
import { loginRequest, setStoredToken } from '../services/api';

const EXIT_MS = 450; // login memudar keluar
const PAUSE_MS = 250; // jeda kosong sebelum greeting
const HOLD_MS = 1900; // lama greeting tampil
const FADE_MS = 700; // cross-fade ke aplikasi (sinkron dengan CSS)
const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

const GREETING_CSS = `
.welcome-title {
  margin: 0;
  color: var(--text-inverse);
  font-size: clamp(2.5rem, 8vw, 4.5rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
  animation: welcome-rise 700ms var(--ease-out) 100ms both;
}
.welcome-name {
  margin: 14px 0 0;
  color: var(--royal-100);
  font-size: clamp(1.15rem, 3.6vw, 1.6rem);
  font-weight: 500;
  line-height: 1.4;
  animation: welcome-rise 700ms var(--ease-out) 220ms both;
}
@keyframes welcome-rise {
  from { opacity: 0; transform: translateY(14px); }
}
@media (prefers-reduced-motion: reduce) {
  .welcome-title, .welcome-name {
    animation-delay: 0s !important;
    animation-duration: 0.01ms !important;
  }
}
`;

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--royal-500)]';

export default function LoginPage({ onLoginSuccess, onReveal, onDone }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detectedUser, setDetectedUser] = useState(null);

  const [selectedShift, setSelectedShift] = useState(() =>
    new Date().getHours() >= 14 ? 'siang' : 'pagi'
  );
  const { reveal } = usePageReveal();

  // Fase: login -> exit -> greet -> out
  const [phase, setPhase] = useState('login');
  const [pending, setPending] = useState(null);
  const cb = useRef({ onLoginSuccess, onReveal, onDone });
  cb.current = { onLoginSuccess, onReveal, onDone };

  const startTransition = (user) => {
    if (phase !== 'login') return;
    setPending(user);
    setPhase('exit');
  };

  useEffect(() => {
    if (phase === 'login') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const k = reduced ? 0.15 : 1;
    const timers = [];

    if (phase === 'exit') {
      timers.push(setTimeout(() => setPhase('greet'), (EXIT_MS + PAUSE_MS) * k));
    } else if (phase === 'greet') {
      timers.push(
        setTimeout(() => {
          cb.current.onLoginSuccess(pending); // set session + aplikasi siap di belakang
          setPhase('out');
        }, HOLD_MS * k)
      );
    } else if (phase === 'out') {
      timers.push(setTimeout(() => cb.current.onReveal?.(), 30));
      timers.push(setTimeout(() => cb.current.onDone?.(), FADE_MS * k));
    }
    return () => timers.forEach(clearTimeout);
  }, [phase, pending]);

  // Kunci scroll body selama greeting
  useEffect(() => {
    if (phase === 'login') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  const showShift = !!detectedUser;

  // Jam & tanggal hidup di pojok kanan atas
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const dateText = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Submit: validasi kredensial ke backend /auth/login
  const handleCheckCredentials = async (e) => {
    e.preventDefault();
    if (phase !== 'login' || isSubmitting) return;
    setError('');

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || !password.trim()) {
      setError('Masukkan username/nama dan password');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginRequest(cleanUser, password);
      const { accessToken, user } = res.data;
      setStoredToken(accessToken);

      const userRole = user.role === 'owner' ? 'Pemilik' : 'Karyawan';
      const displayName = userRole === 'Pemilik' ? `Pemilik (${user.username})` : `Kasir (${user.username})`;
      const userData = { id: user.id, username: user.username, name: displayName, role: userRole };

      if (userRole === 'Pemilik') {
        startTransition({ ...userData, shift: null });
      } else {
        setDetectedUser(userData); // panel shift muncul di samping
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal login. Periksa koneksi backend atau kredensial Anda.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmShift = (e) => {
    e.preventDefault();
    if (!detectedUser) return;
    startTransition({ ...detectedUser, shift: selectedShift });
  };

  const handleQuickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError('');
    setDetectedUser(null);
  };

  const chipClass = `inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-main)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] ${motion} ${focusRing}`;

  return (
    <main
      className={`fixed inset-0 z-[100] overflow-hidden text-[var(--text-inverse)] transition-[opacity,transform,filter] duration-700 ${EASE} ${phase === 'out' ? 'pointer-events-none scale-105 opacity-0 blur-[8px]' : ''
        }`}
      style={{ background: 'var(--grad-hero) center / cover no-repeat' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[30vh] -left-[18vw] aspect-square w-[min(86vw,680px)] rounded-full bg-[var(--glass-decor)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 max-w-[70vw] rounded-full bg-[var(--glass-subtle)]"
      />
      <style>{GREETING_CSS}</style>

      <div className="absolute inset-0 flex flex-col overflow-y-auto p-4 sm:p-8">
        {(phase === 'login' || phase === 'exit') && (
          <div
            className={`flex w-full flex-1 flex-col transition-[opacity,transform,filter] duration-[450ms] ${EASE} ${phase === 'exit' ? 'pointer-events-none -translate-y-3 scale-[0.98] opacity-0 blur-[3px]' : ''
              }`}
          >
            {/* Bar atas: identitas toko + waktu */}
            <header className="flex items-center justify-between gap-4" style={reveal(0)}>
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-strong)]">
                  <Store size={22} strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="leading-tight">
                  <p className="text-base font-semibold tracking-tight">Esbe Cash Recap</p>
                  <p className="text-xs text-[var(--royal-100)]">Fotocopy Esbe Lampu Merah</p>
                </div>
              </div>
              <p className="rounded-full border border-[var(--glass-border)] bg-[var(--glass-subtle)] px-3 py-1.5 text-xs text-[var(--royal-100)]">
                <span className="hidden sm:inline">{dateText}, </span>
                <span className="font-medium text-[var(--text-inverse)] tabular-nums">{timeText}</span>
              </p>
            </header>

            {/* Karcis: form di kiri, "sobekan" pilih shift terbuka di kanan */}
            <div className="m-auto w-full py-8" style={reveal(1)}>
              <div
                className={`${card} mx-auto flex w-full max-w-md flex-col overflow-hidden shadow-[var(--shadow-royal-card)] transition-[width] duration-500 ${EASE} motion-reduce:transition-none md:max-w-none md:flex-row ${showShift ? 'md:w-[46rem]' : 'md:w-[24rem]'
                  }`}
              >
                {/* FORM */}
                <div className="w-full shrink-0 p-6 sm:p-8 md:w-[24rem]">
                  <h1 className="text-xl font-semibold tracking-tight text-[var(--text-main)]">Masuk</h1>
                  <p className={`${hint} mt-1`}>
                    Pemilik langsung ke dashboard. Karyawan memilih shift setelah ini.
                  </p>

                  <form onSubmit={handleCheckCredentials} className="mt-6 space-y-4">
                    {error && <Notice kind="error">{error}</Notice>}

                    <div>
                      <label htmlFor="username" className={label}>
                        Username
                      </label>
                      <div className="relative">
                        <User
                          size={16}
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-muted)]"
                        />
                        <input
                          id="username"
                          type="text"
                          required
                          autoComplete="username"
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            setDetectedUser(null);
                          }}
                          placeholder="owner atau kasir"
                          className={`${field} pl-9`}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="password" className={label}>
                        Password
                      </label>
                      <div className="relative">
                        <Lock
                          size={16}
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-muted)]"
                        />
                        <input
                          id="password"
                          type="password"
                          required
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Kata sandi"
                          className={`${field} pl-9`}
                        />
                      </div>
                    </div>

                    <button type="submit" className={`${btnPrimary} w-full`}>
                      Masuk
                      <ArrowRight {...ico} />
                    </button>
                  </form>

                  <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--border-default)] pt-4">
                    <span className="text-xs text-[var(--text-muted)]">Akun contoh:</span>
                    <button
                      type="button"
                      onClick={() => handleQuickFill('owner', '123456')}
                      aria-label="Isi cepat akun Pemilik: owner / 123456"
                      className={chipClass}
                    >
                      <ShieldCheck size={13} className="text-[var(--royal-700)]" aria-hidden="true" />
                      owner
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickFill('kasir', '123456')}
                      aria-label="Isi cepat akun Karyawan: kasir / 123456"
                      className={chipClass}
                    >
                      <User size={13} className="text-[var(--amber-600)]" aria-hidden="true" />
                      kasir
                    </button>
                  </div>
                </div>

                {/* SOBEKAN SHIFT */}
                <div
                  aria-hidden={!showShift}
                  inert={!showShift}
                  className={`overflow-hidden transition-all duration-500 ${EASE} motion-reduce:transition-none ${showShift
                    ? 'max-h-[40rem] opacity-100 md:max-h-none md:w-[22rem]'
                    : 'max-h-0 opacity-0 md:w-0'
                    }`}
                >
                  <div className="h-full border-t-2 border-dashed border-[var(--border-default)] bg-[var(--surface-muted)] p-6 sm:p-8 md:w-[22rem] md:border-t-0 md:border-l-2">
                    {detectedUser && (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--amber-50)] text-[var(--amber-700)]">
                            <User size={20} strokeWidth={1.75} aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-[var(--text-muted)]">Karyawan terdeteksi</p>
                            <h2 className="truncate text-base font-semibold text-[var(--text-main)]">
                              {detectedUser.name}
                            </h2>
                          </div>
                        </div>

                        <p className="mt-4 text-sm leading-5 text-[var(--text-muted-alt)]">
                          Pilih shift bertugas untuk memulai pencatatan kas.
                        </p>

                        <form onSubmit={handleConfirmShift} className="mt-4 space-y-4">
                          <ShiftSwitch
                            name="login-shift"
                            value={selectedShift}
                            onChange={setSelectedShift}
                          />

                          <div className="space-y-2 pt-2">
                            <button type="submit" className={`${btnPrimary} w-full`}>
                              Mulai shift {selectedShift === 'pagi' ? 'pagi' : 'siang'}
                              <ArrowRight {...ico} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDetectedUser(null);
                                setPassword('');
                              }}
                              className={`${btnSecondary} w-full`}
                            >
                              <ArrowLeft {...ico} />
                              Ganti akun
                            </button>
                          </div>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {(phase === 'greet' || phase === 'out') && (
          <div className="relative m-auto w-full max-w-[90vw] text-center">
            <h1 className="welcome-title">Welcome</h1>
            <p className="welcome-name">{pending?.name || pending?.username}</p>
          </div>
        )}
      </div>
    </main>
  );
}