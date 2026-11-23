import { useState } from 'react';

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Harap isi username dan password!');
      return;
    }

    const userData = {
      username: username.trim(),
      name: username.toLowerCase() === 'admin' ? 'Administrator' : 'Kasir Toko',
      role: username.toLowerCase() === 'admin' ? 'Admin' : 'Operator'
    };

    onLoginSuccess(userData);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl font-bold border border-indigo-100 shadow-sm">
            💵
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Esbe Cash Recap</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Halaman Login Rekapitulasi Kas & Transaksi
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm rounded-lg">
            {error}
          </div>
        )}

        <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl space-y-1">
          <span className="font-semibold text-indigo-700">💡 Info Frontend (Mockup Mode):</span>
          <p className="text-slate-500">
            Bisa masukkan username dan password apa saja untuk login contoh:
          </p>
          <p>
            Username: <code className="bg-slate-200 px-1.5 py-0.5 rounded text-indigo-800 font-semibold">admin</code> / <code className="bg-slate-200 px-1.5 py-0.5 rounded text-indigo-800 font-semibold">kasir</code>
          </p>
          <p>
            Password: <code className="bg-slate-200 px-1.5 py-0.5 rounded text-indigo-800 font-semibold">123456</code> (atau bebas)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan nama pengguna"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition duration-150 cursor-pointer shadow-md mt-2"
          >
            Masuk ke Aplikasi
          </button>
        </form>
      </div>
    </main>
  );
}
