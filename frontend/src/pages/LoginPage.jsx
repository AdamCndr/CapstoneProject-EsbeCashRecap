import { useState } from 'react';
import { btnPrimary, card, field, label, Notice } from '../lib/ui';

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Isi username dan password');
      return;
    }

    const isAdmin = username.trim().toLowerCase() === 'admin';
    onLoginSuccess({
      username: username.trim(),
      name: isAdmin ? 'Administrator' : 'Kasir Toko',
      role: isAdmin ? 'Admin' : 'Operator'
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 text-neutral-900">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-lg leading-none font-medium">Esbe Cash Recap</p>

        <div className={`${card} p-6 sm:p-8`}>
          <h1 className="text-[28px] leading-8 font-medium">Rekap kas harian Fotocopy Esbe</h1>
          <p className="mt-2 text-sm leading-5 text-neutral-600">
            Masuk untuk mencatat pendapatan per shift atau melihat rekap
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <Notice kind="error">{error}</Notice>}

            <div>
              <label htmlFor="username" className={label}>
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nama pengguna"
                className={field}
              />
            </div>

            <div>
              <label htmlFor="password" className={label}>
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata sandi"
                className={field}
              />
            </div>

            <button type="submit" className={`${btnPrimary} w-full`}>
              Masuk
            </button>
          </form>

          <p className="mt-6 border-t border-neutral-900/10 pt-4 text-xs leading-4 text-neutral-500">
            Mode mockup: username dan password bebas. Coba{' '}
            <code className="font-mono text-neutral-700">admin</code> atau{' '}
            <code className="font-mono text-neutral-700">kasir</code>
          </p>
        </div>
      </div>
    </main>
  );
}
