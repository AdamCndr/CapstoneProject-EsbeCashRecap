import { useState } from 'react';
import { formatRupiah } from '../data/mockData';

export default function DashboardPage({ transactions }) {
  const [selectedDate, setSelectedDate] = useState('2026-11-20');
  const [selectedShift, setSelectedShift] = useState('semua'); // 'semua' | 'pagi' | 'siang'

  // Filter transaksi berdasarkan tanggal & shift
  const filtered = transactions.filter((t) => {
    const matchDate = !selectedDate || t.date === selectedDate;
    const matchShift = selectedShift === 'semua' || t.shift === selectedShift;
    return matchDate && matchShift;
  });

  // Perhitungan Metode Pembayaran (Hanya pemasukan)
  const pemasukanList = filtered.filter((t) => t.type === 'pemasukan');
  const totalTunai = pemasukanList
    .filter((t) => t.paymentMethod === 'tunai')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const totalQris = pemasukanList
    .filter((t) => t.paymentMethod === 'qris')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const totalTransfer = pemasukanList
    .filter((t) => t.paymentMethod === 'transfer')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const totalPemasukan = totalTunai + totalQris + totalTransfer;

  const totalPengeluaran = filtered
    .filter((t) => t.type === 'pengeluaran')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const totalBersih = totalPemasukan - totalPengeluaran;

  // Breakdown Pendapatan Shift Pagi vs Siang pada tanggal terpilih
  const onSelectedDate = transactions.filter((t) => !selectedDate || t.date === selectedDate);
  const omsetShiftPagi = onSelectedDate
    .filter((t) => t.shift === 'pagi' && t.type === 'pemasukan')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const omsetShiftSiang = onSelectedDate
    .filter((t) => t.shift === 'siang' && t.type === 'pemasukan')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  // Persentase Metode Pembayaran
  const pctTunai = totalPemasukan > 0 ? Math.round((totalTunai / totalPemasukan) * 100) : 0;
  const pctNonTunai = totalPemasukan > 0 ? 100 - pctTunai : 0;

  return (
    <div className="space-y-6">
      {/* Header Dashboard & Filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
              Role: Pemilik Toko
            </span>
            <span className="text-xs text-slate-400">• Fotocopy Esbe</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Dashboard Rekapitulasi Kas</h2>
          <p className="text-xs text-slate-500">
            Pantau rincian pendapatan tunai & non-tunai per tanggal dan shift operasional.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Tanggal
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Shift
            </label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="semua">Semua Shift</option>
              <option value="pagi">Shift Pagi</option>
              <option value="siang">Shift Siang</option>
            </select>
          </div>
        </div>
      </div>

      {/* Kartu Ringkasan Metode Pembayaran (Sesuai Use Case Esbe) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Total Bersih */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Bersih (Kas Masuk - Keluar)
          </span>
          <div className={`text-2xl font-bold mt-1 ${totalBersih >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
            {formatRupiah(totalBersih)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Pengeluaran: -{formatRupiah(totalPengeluaran)}
          </span>
        </div>

        {/* Pendapatan Tunai */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              💵 Tunai
            </span>
            <span className="text-xs font-bold text-slate-400">{pctTunai}%</span>
          </div>
          <div className="text-2xl font-bold mt-1 text-slate-900">
            {formatRupiah(totalTunai)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Laci Kas Toko</span>
        </div>

        {/* Pendapatan QRIS */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
              📱 QRIS
            </span>
            <span className="text-xs font-bold text-slate-400">
              {totalPemasukan > 0 ? Math.round((totalQris / totalPemasukan) * 100) : 0}%
            </span>
          </div>
          <div className="text-2xl font-bold mt-1 text-slate-900">
            {formatRupiah(totalQris)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Rekap Merchant QRIS</span>
        </div>

        {/* Pendapatan Transfer Bank */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              🏦 Transfer Bank
            </span>
            <span className="text-xs font-bold text-slate-400">
              {totalPemasukan > 0 ? Math.round((totalTransfer / totalPemasukan) * 100) : 0}%
            </span>
          </div>
          <div className="text-2xl font-bold mt-1 text-slate-900">
            {formatRupiah(totalTransfer)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Rekening Toko</span>
        </div>
      </div>

      {/* Bar Komparasi Tunai vs Non-Tunai & Perbandingan Shift */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Rasio Tunai vs Non-Tunai */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            Proporsi Metode Pendapatan
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Perbandingan uang tunai fisik vs non-tunai (QRIS + Transfer).
          </p>

          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex mb-3">
            <div
              style={{ width: `${pctTunai}%` }}
              className="bg-emerald-500 h-full transition-all duration-300"
              title={`Tunai: ${pctTunai}%`}
            ></div>
            <div
              style={{ width: `${pctNonTunai}%` }}
              className="bg-indigo-600 h-full transition-all duration-300"
              title={`Non-Tunai: ${pctNonTunai}%`}
            ></div>
          </div>

          <div className="flex justify-between text-xs text-slate-600 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-emerald-500 rounded-sm"></span>
              <span>Tunai: <strong>{formatRupiah(totalTunai)}</strong> ({pctTunai}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-indigo-600 rounded-sm"></span>
              <span>Non-Tunai: <strong>{formatRupiah(totalQris + totalTransfer)}</strong> ({pctNonTunai}%)</span>
            </div>
          </div>
        </div>

        {/* Perbandingan Shift Pagi vs Siang */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            Rekap Pendapatan per Shift ({selectedDate || 'Semua Tanggal'})
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Memudahkan pemilik mencocokkan setoran kas tiap pergantian shift karyawan.
          </p>

          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-amber-700">☀️ Shift Pagi (08:00 - 14:00)</span>
                <span className="text-slate-900">{formatRupiah(omsetShiftPagi)}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  style={{
                    width: `${
                      omsetShiftPagi + omsetShiftSiang > 0
                        ? (omsetShiftPagi / (omsetShiftPagi + omsetShiftSiang)) * 100
                        : 0
                    }%`
                  }}
                  className="bg-amber-500 h-full"
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-blue-700">⛅ Shift Siang (14:00 - 21:00)</span>
                <span className="text-slate-900">{formatRupiah(omsetShiftSiang)}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  style={{
                    width: `${
                      omsetShiftPagi + omsetShiftSiang > 0
                        ? (omsetShiftSiang / (omsetShiftPagi + omsetShiftSiang)) * 100
                        : 0
                    }%`
                  }}
                  className="bg-blue-600 h-full"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daftar Transaksi Sesuai Filter Dashboard */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-3">
          Rincian Transaksi ({filtered.length} transaksi pada filter aktif)
        </h3>

        {filtered.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
            Tidak ada transaksi pada tanggal atau shift yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase bg-slate-50">
                  <th className="py-2.5 px-3">Waktu / ID</th>
                  <th className="py-2.5 px-3">Keterangan</th>
                  <th className="py-2.5 px-3">Shift</th>
                  <th className="py-2.5 px-3">Metode</th>
                  <th className="py-2.5 px-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{t.time || '-'}</span>
                      <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({t.id})</span>
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">{t.title}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.shift === 'pagi'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {t.shift === 'pagi' ? 'Pagi' : 'Siang'}
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold uppercase">
                        {t.paymentMethod || 'Tunai'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold whitespace-nowrap">
                      <span className={t.type === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600'}>
                        {t.type === 'pemasukan' ? '+' : '-'} {formatRupiah(t.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

