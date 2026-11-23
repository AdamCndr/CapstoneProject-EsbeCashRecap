import { useEffect, useState } from 'react';
import api from './services/api';

export default function App() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/items');
      setItems(res.data.data || []);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Gagal memuat data dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setStatusMsg('');

    try {
      await api.post('/items', {
        name,
        price: Number(price),
      });
      setName('');
      setPrice('');
      setStatusMsg('Data berhasil disimpan ke back-end!');
      await fetchItems();
    } catch (err) {
      const details = err.response?.data?.details?.join(', ');
      setErrorMsg(details || err.response?.data?.message || 'Gagal menyimpan data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4">
      <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold mb-1">Esbe Cash Recap</h1>
        <p className="text-sm text-slate-400 mb-6">
          Tes koneksi React (Vite + Tailwind + Axios) ke Express API v1
        </p>

        {loading && (
          <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 text-sm text-amber-300">
            Memproses data...
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 text-sm text-rose-300">
            {errorMsg}
          </div>
        )}

        {statusMsg && (
          <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-sm text-emerald-300">
            {statusMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 mb-6">
          <input
            type="text"
            placeholder="Nama item / layanan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="number"
            placeholder="Nominal (Rp)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            className="w-full sm:w-36 rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition cursor-pointer"
          >
            Simpan
          </button>
        </form>

        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg bg-slate-800/70 border border-slate-700/60 px-4 py-2.5 text-sm"
            >
              <span>{item.name}</span>
              <span className="font-semibold text-indigo-300">
                Rp{Number(item.price).toLocaleString('id-ID')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}