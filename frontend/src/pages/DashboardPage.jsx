import { useState } from 'react';
import { formatRupiah } from '../data/mockData';
import {
  card,
  field,
  ico,
  formatDateID,
  label,
  methodIcon,
  methodLabel,
  PageHeader,
  shiftHours,
  shiftLabel,
  ShiftTag
} from '../lib/ui';

const sum = (list) => list.reduce((acc, t) => acc + Number(t.amount || 0), 0);
// Transaksi tanpa metode dianggap tunai, sama seperti tampilan tabel
const methodOf = (t) => t.paymentMethod || 'tunai';
const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

// Warna = arti: tunai netral, non-tunai keluarga biru
const METHODS = [
  { key: 'tunai', source: 'Laci kas', tone: 'bg-neutral-800' },
  { key: 'qris', source: 'Merchant QRIS', tone: 'bg-blue-800' },
  { key: 'transfer', source: 'Rekening toko', tone: 'bg-blue-300' }
];
const SHIFTS = [
  { key: 'pagi', tone: 'bg-amber-500' },
  { key: 'siang', tone: 'bg-blue-800' }
];

// Baris buku kas: nama ..... nominal
function LedgerRow({ tone, name, amount, share }) {
  return (
    <li className="flex items-end gap-2 text-sm leading-5">
      <span className="flex items-center gap-2 text-neutral-700">
        <span className={`h-2 w-2 rounded-full ${tone}`} aria-hidden="true" />
        {name}
      </span>
      <span className="mb-1 flex-1 border-b border-dotted border-neutral-300" aria-hidden="true" />
      <span className="font-medium tabular-nums text-neutral-900">{amount}</span>
      {share != null && <span className="w-10 text-right text-xs tabular-nums text-neutral-500">{share}%</span>}
    </li>
  );
}

export default function DashboardPage({ transactions }) {
  const [selectedDate, setSelectedDate] = useState('2026-11-20');
  const [selectedShift, setSelectedShift] = useState('semua'); // 'semua' | 'pagi' | 'siang'

  // Filter tanggal, lalu shift
  const onDate = transactions.filter((t) => !selectedDate || t.date === selectedDate);
  const filtered = onDate.filter((t) => selectedShift === 'semua' || t.shift === selectedShift);

  // Pemasukan per metode
  const income = filtered.filter((t) => t.type === 'pemasukan');
  const totalPemasukan = sum(income);
  const totalPengeluaran = sum(filtered.filter((t) => t.type === 'pengeluaran'));
  const totalBersih = totalPemasukan - totalPengeluaran;
  const totals = Object.fromEntries(METHODS.map((m) => [m.key, sum(income.filter((t) => methodOf(t) === m.key))]));
  const nonTunai = totals.qris + totals.transfer;
  const pctTunai = pct(totals.tunai, totalPemasukan);
  const pctNonTunai = totalPemasukan > 0 ? 100 - pctTunai : 0;

  // Pendapatan per shift pada tanggal terpilih (tidak ikut filter shift)
  const shiftTotals = SHIFTS.map((s) => ({
    ...s,
    total: sum(onDate.filter((t) => t.shift === s.key && t.type === 'pemasukan'))
  }));
  const shiftSum = shiftTotals.reduce((acc, s) => acc + s.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard pemilik · Fotocopy Esbe"
        title={formatDateID(selectedDate)}
        description="Pendapatan tunai dan non-tunai per tanggal dan shift"
        actions={
          <>
            <div>
              <label htmlFor="dash-date" className={label}>
                Tanggal
              </label>
              <input
                id="dash-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`${field} w-auto cursor-pointer`}
              />
            </div>
            <div>
              <label htmlFor="dash-shift" className={label}>
                Shift
              </label>
              <select
                id="dash-shift"
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className={`${field} w-auto cursor-pointer`}
              >
                <option value="semua">Semua shift</option>
                <option value="pagi">Pagi</option>
                <option value="siang">Siang</option>
              </select>
            </div>
          </>
        }
      />

      {/* Angka utama */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className={`${card} p-5`}>
          <p className="text-[13px] leading-5 text-neutral-600">Total bersih</p>
          <p
            className={`mt-2 text-[28px] leading-8 font-medium tabular-nums ${totalBersih >= 0 ? 'text-neutral-900' : 'text-red-600'
              }`}
          >
            {formatRupiah(totalBersih)}
          </p>
          <p className="mt-1 text-xs leading-4 text-neutral-500">
            Pemasukan {formatRupiah(totalPemasukan)} · Pengeluaran {formatRupiah(totalPengeluaran)}
          </p>
        </div>

        {METHODS.map(({ key, source }) => {
          const Icon = methodIcon[key];
          return (
            <div key={key} className={`${card} p-5`}>
              <div className="flex items-center justify-between text-[13px] leading-5 text-neutral-600">
                <span className="flex items-center gap-2">
                  <Icon {...ico} />
                  {methodLabel[key]}
                </span>
                <span className="tabular-nums text-neutral-500">{pct(totals[key], totalPemasukan)}%</span>
              </div>
              <p className="mt-2 text-[28px] leading-8 font-medium tabular-nums text-neutral-900">
                {formatRupiah(totals[key])}
              </p>
              <p className="mt-1 text-xs leading-4 text-neutral-500">{source}</p>
            </div>
          );
        })}
      </div>

      {/* Proporsi metode dan rekap per shift */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className={`${card} p-6`}>
          <h3 className="text-base leading-6 font-medium text-neutral-900">Proporsi metode pembayaran</h3>
          <p className="mt-1 text-[13px] leading-5 text-neutral-600">Uang tunai fisik dibanding QRIS dan transfer</p>

          <div
            className="mt-5 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-neutral-100"
            role="img"
            aria-label={`Tunai ${pctTunai}%, non-tunai ${pctNonTunai}%`}
          >
            {totalPemasukan > 0 &&
              METHODS.map(
                (m) =>
                  totals[m.key] > 0 && (
                    <div
                      key={m.key}
                      style={{ width: `${(totals[m.key] / totalPemasukan) * 100}%` }}
                      className={m.tone}
                    />
                  )
              )}
          </div>

          <ul className="mt-5 space-y-2">
            {METHODS.map((m) => (
              <LedgerRow
                key={m.key}
                tone={m.tone}
                name={methodLabel[m.key]}
                amount={formatRupiah(totals[m.key])}
                share={pct(totals[m.key], totalPemasukan)}
              />
            ))}
          </ul>
          <p className="mt-4 flex justify-between border-t border-neutral-900/10 pt-3 text-[13px] leading-5 text-neutral-600">
            <span>Non-tunai (QRIS + transfer)</span>
            <span className="tabular-nums">
              {formatRupiah(nonTunai)} · {pctNonTunai}%
            </span>
          </p>
        </div>

        <div className={`${card} p-6`}>
          <h3 className="text-base leading-6 font-medium text-neutral-900">Rekap per shift</h3>
          <p className="mt-1 text-[13px] leading-5 text-neutral-600">Untuk mencocokkan setoran saat pergantian shift</p>

          <div className="mt-5 space-y-5">
            {shiftTotals.map((s) => (
              <div key={s.key}>
                <ul>
                  <LedgerRow tone={s.tone} name={`${shiftLabel[s.key]} · ${shiftHours[s.key]}`} amount={formatRupiah(s.total)} />
                </ul>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    style={{ width: `${shiftSum > 0 ? (s.total / shiftSum) * 100 : 0}%` }}
                    className={`h-full ${s.tone}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rincian transaksi */}
      <div className={`${card} p-6`}>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h3 className="text-base leading-6 font-medium text-neutral-900">Rincian transaksi</h3>
          <span className="text-xs tabular-nums text-neutral-500">{filtered.length} transaksi</span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-12 text-center text-sm text-neutral-600">
            Data belum tersedia untuk tanggal dan shift ini
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-900/10">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-neutral-50 text-[13px] leading-5 text-neutral-600">
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-4 py-3 font-medium">Keterangan</th>
                  <th className="px-4 py-3 font-medium">Shift</th>
                  <th className="px-4 py-3 font-medium">Metode</th>
                  <th className="px-4 py-3 text-right font-medium">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900/10">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="tabular-nums text-neutral-900">{t.time || '-'}</div>
                      <div className="font-mono text-xs text-neutral-500">{t.id}</div>
                    </td>
                    <td className="px-4 py-3 text-neutral-900">{t.title}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ShiftTag shift={t.shift} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-neutral-700">{methodLabel[methodOf(t)] || t.paymentMethod}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums ${t.type === 'pemasukan' ? 'text-neutral-900' : 'text-red-600'
                        }`}
                    >
                      {t.type === 'pemasukan' ? '+' : '−'} {formatRupiah(t.amount)}
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
