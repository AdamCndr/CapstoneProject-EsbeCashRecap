import { pathToFileURL } from 'node:url';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

/**
 * Dataset 60 transaksi deterministik untuk pengujian GET /recap dan GET /dashboard/summary.
 * Terdiri dari:
 * - 52 transaksi status 'terkonfirmasi' (dihitung oleh SQL SUM)
 * - 4 transaksi status 'perlu_ditinjau' (TIDAK dihitung dalam total, hanya dihitung pada perlu_ditinjau_count)
 * - 4 transaksi status 'ditolak' (TIDAK dihitung di mana pun)
 *
 * Periode: 2026-11-20 s/d 2026-11-26 (7 hari terakhir relatif terhadap 2026-11-26).
 */
export const MANUAL_60_TRANSACTIONS = [
  // ======================== 2026-11-20 (7 terkonfirmasi + 1 perlu_ditinjau = 8) ========================
  // Group (2026-11-20, pagi, tunai): pem 125.000, peng 25.000, tot 100.000, cnt 3
  { date: '2026-11-20', time: '07:15:00', shift: 'pagi', method: 'tunai', type: 'pemasukan', amount: 50000, status: 'terkonfirmasi', title: 'Fotokopi Skripsi 200 lbr' },
  { date: '2026-11-20', time: '09:30:00', shift: 'pagi', method: 'tunai', type: 'pemasukan', amount: 75000, status: 'terkonfirmasi', title: 'Cetak & Jilid Hardcover' },
  { date: '2026-11-20', time: '11:00:00', shift: 'pagi', method: 'tunai', type: 'pengeluaran', amount: 25000, status: 'terkonfirmasi', title: 'Beli Lakban & Staples' },
  // Group (2026-11-20, pagi, qris): pem 100.000, peng 0, tot 100.000, cnt 2
  { date: '2026-11-20', time: '10:10:00', shift: 'pagi', method: 'qris', type: 'pemasukan', amount: 40000, status: 'terkonfirmasi', title: 'Print Warna QRIS' },
  { date: '2026-11-20', time: '12:20:00', shift: 'pagi', method: 'qris', type: 'pemasukan', amount: 60000, status: 'terkonfirmasi', title: 'Laminating & ATK QRIS' },
  // Group (2026-11-20, siang, transfer): pem 150.000, peng 50.000, tot 100.000, cnt 2
  { date: '2026-11-20', time: '15:00:00', shift: 'siang', method: 'transfer', type: 'pemasukan', amount: 150000, status: 'terkonfirmasi', title: 'Order Brosur Kantor' },
  { date: '2026-11-20', time: '17:30:00', shift: 'siang', method: 'transfer', type: 'pengeluaran', amount: 50000, status: 'terkonfirmasi', title: 'Beli Kertas HVS F4' },
  // Excluded (perlu_ditinjau #1)
  { date: '2026-11-20', time: '13:00:00', shift: 'pagi', method: 'qris', type: 'pemasukan', amount: 999000, status: 'perlu_ditinjau', title: 'QRIS Indikasi Duplikat #1' },

  // ======================== 2026-11-21 (7 terkonfirmasi + 1 ditolak = 8) ========================
  // Group (2026-11-21, pagi, tunai): pem 100.000, peng 0, tot 100.000, cnt 2
  { date: '2026-11-21', time: '08:00:00', shift: 'pagi', method: 'tunai', type: 'pemasukan', amount: 80000, status: 'terkonfirmasi', title: 'Fotokopi Modul Kuliah' },
  { date: '2026-11-21', time: '11:45:00', shift: 'pagi', method: 'tunai', type: 'pemasukan', amount: 20000, status: 'terkonfirmasi', title: 'Alat Tulis Map' },
  // Group (2026-11-21, siang, tunai): pem 150.000, peng 30.000, tot 120.000, cnt 3
  { date: '2026-11-21', time: '14:30:00', shift: 'siang', method: 'tunai', type: 'pemasukan', amount: 90000, status: 'terkonfirmasi', title: 'Cetak Banner Mini' },
  { date: '2026-11-21', time: '16:15:00', shift: 'siang', method: 'tunai', type: 'pemasukan', amount: 60000, status: 'terkonfirmasi', title: 'Jilid Spiral 6 Buku' },
  { date: '2026-11-21', time: '19:00:00', shift: 'siang', method: 'tunai', type: 'pengeluaran', amount: 30000, status: 'terkonfirmasi', title: 'Bayar Kebersihan & Air' },
  // Group (2026-11-21, siang, qris): pem 180.000, peng 0, tot 180.000, cnt 2
  { date: '2026-11-21', time: '15:20:00', shift: 'siang', method: 'qris', type: 'pemasukan', amount: 110000, status: 'terkonfirmasi', title: 'Scan & Print A3 QRIS' },
  { date: '2026-11-21', time: '20:10:00', shift: 'siang', method: 'qris', type: 'pemasukan', amount: 70000, status: 'terkonfirmasi', title: 'Foto Copy Berwarna' },
  // Excluded (ditolak #1)
  { date: '2026-11-21', time: '18:00:00', shift: 'siang', method: 'transfer', type: 'pemasukan', amount: 888000, status: 'ditolak', title: 'Bukti Transfer Palsu #1' },

  // ======================== 2026-11-22 (7 terkonfirmasi = 7) ========================
  // Group (2026-11-22, pagi, qris): pem 100.000, peng 0, tot 100.000, cnt 2
  { date: '2026-11-22', time: '07:45:00', shift: 'pagi', method: 'qris', type: 'pemasukan', amount: 45000, status: 'terkonfirmasi', title: 'Print Tugas QRIS' },
  { date: '2026-11-22', time: '10:30:00', shift: 'pagi', method: 'qris', type: 'pemasukan', amount: 55000, status: 'terkonfirmasi', title: 'Pembelian Kertas & Pulpen' },
  // Group (2026-11-22, pagi, transfer): pem 200.000, peng 40.000, tot 160.000, cnt 2
  { date: '2026-11-22', time: '09:15:00', shift: 'pagi', method: 'transfer', type: 'pemasukan', amount: 200000, status: 'terkonfirmasi', title: 'Cetak Undangan 100 pcs' },
  { date: '2026-11-22', time: '12:50:00', shift: 'pagi', method: 'transfer', type: 'pengeluaran', amount: 40000, status: 'terkonfirmasi', title: 'Tinta Refill Warna' },
  // Group (2026-11-22, siang, tunai): pem 80.000, peng 10.000, tot 70.000, cnt 3
  { date: '2026-11-22', time: '14:40:00', shift: 'siang', method: 'tunai', type: 'pemasukan', amount: 30000, status: 'terkonfirmasi', title: 'Fotokopi KTP & KK' },
  { date: '2026-11-22', time: '17:00:00', shift: 'siang', method: 'tunai', type: 'pemasukan', amount: 50000, status: 'terkonfirmasi', title: 'Beli Materai & Amplop' },
  { date: '2026-11-22', time: '20:30:00', shift: 'siang', method: 'tunai', type: 'pengeluaran', amount: 10000, status: 'terkonfirmasi', title: 'Plastik Kresek Toko' },

  // ======================== 2026-11-23 (8 terkonfirmasi + 1 perlu_ditinjau + 1 ditolak = 10) ========================
  // Group (2026-11-23, pagi, tunai): pem 100.000, peng 0, tot 100.000, cnt 3
  { date: '2026-11-23', time: '08:10:00', shift: 'pagi', method: 'tunai', type: 'pemasukan', amount: 25000, status: 'terkonfirmasi', title: 'Fotokopi Soal Ujian' },
  { date: '2026-11-23', time: '09:40:00', shift: 'pagi', method: 'tunai', type: 'pemasukan', amount: 35000, status: 'terkonfirmasi', title: 'Jilid Lakban' },
  { date: '2026-11-23', time: '11:20:00', shift: 'pagi', method: 'tunai', type: 'pemasukan', amount: 40000, status: 'terkonfirmasi', title: 'Print Hitam Putih' },
  // Group (2026-11-23, siang, qris): pem 250.000, peng 0, tot 250.000, cnt 3
  { date: '2026-11-23', time: '14:25:00', shift: 'siang', method: 'qris', type: 'pemasukan', amount: 120000, status: 'terkonfirmasi', title: 'Cetak Proposal Proyek' },
  { date: '2026-11-23', time: '16:50:00', shift: 'siang', method: 'qris', type: 'pemasukan', amount: 80000, status: 'terkonfirmasi', title: 'Print Poster Art Paper' },
  { date: '2026-11-23', time: '19:15:00', shift: 'siang', method: 'qris', type: 'pemasukan', amount: 50000, status: 'terkonfirmasi', title: 'Laminating Sertifikat' },
  // Group (2026-11-23, siang, transfer): pem 300.000, peng 100.000, tot 200.000, cnt 2
  { date: '2026-11-23', time: '15:10:00', shift: 'siang', method: 'transfer', type: 'pemasukan', amount: 300000, status: 'terkonfirmasi', title: 'Cetak Buku Panduan Sekolah' },
  { date: '2026-11-23', time: '18:05:00', shift: 'siang', method: 'transfer', type: 'pengeluaran', amount: 100000, status: 'terkonfirmasi', title: 'Servis Mesin Fotokopi' },
  // Excluded
  { date: '2026-11-23', time: '16:00:00', shift: 'siang', method: 'qris', type: 'pemasukan', amount: 777000, status: 'perlu_ditinjau', title: 'QRIS Indikasi Duplikat #2' },
  { date: '2026-11-23', time: '10:00:00', shift: 'pagi', method: 'tunai', type: 'pemasukan', amount: 666000, status: 'ditolak', title: 'Input Salah Ditolak #2' },

  // ======================== 2026-11-24 (7 terkonfirmasi + 1 perlu_ditinjau = 8) ========================
  // Group (2026-11-24, pagi, transfer): pem 300.000, peng 0, tot 300.000, cnt 2
  { date: '2026-11-24', time: '08:50:00', shift: 'pagi', method: 'transfer', type: 'pemasukan', amount: 175000, status: 'terkonfirmasi', title: 'Order Nota Toko' },
  { date: '2026-11-24', time: '11:10:00', shift: 'pagi', method: 'transfer', type: 'pemasukan', amount: 125000, status: 'terkonfirmasi', title: 'Cetak Kop Surat' },
  // Group (2026-11-24, siang, tunai): pem 150.000, peng 50.000, tot 100.000, cnt 3
  { date: '2026-11-24', time: '14:15:00', shift: 'siang', method: 'tunai', type: 'pemasukan', amount: 65000, status: 'terkonfirmasi', title: 'Fotokopi Diktat' },
  { date: '2026-11-24', time: '17:20:00', shift: 'siang', method: 'tunai', type: 'pemasukan', amount: 85000, status: 'terkonfirmasi', title: 'ATK Paket Sekolah' },
  { date: '2026-11-24', time: '19:45:00', shift: 'siang', method: 'tunai', type: 'pengeluaran', amount: 50000, status: 'terkonfirmasi', title: 'Beli Toner Cadangan' },
  // Group (2026-11-24, siang, qris): pem 200.000, peng 0, tot 200.000, cnt 2
  { date: '2026-11-24', time: '15:30:00', shift: 'siang', method: 'qris', type: 'pemasukan', amount: 95000, status: 'terkonfirmasi', title: 'Print Dokumen Warna' },
  { date: '2026-11-24', time: '20:00:00', shift: 'siang', method: 'qris', type: 'pemasukan', amount: 105000, status: 'terkonfirmasi', title: 'Cetak Stiker Vinyl' },
  // Excluded (perlu_ditinjau #3)
  { date: '2026-11-24', time: '16:30:00', shift: 'siang', method: 'transfer', type: 'pemasukan', amount: 555000, status: 'perlu_ditinjau', title: 'Transfer Perlu Cek Mutasi #3' },

  // ======================== 2026-11-25 (8 terkonfirmasi + 1 ditolak = 9) ========================
  // Group (2026-11-25, pagi, tunai): pem 50.000, peng 15.000, tot 35.000, cnt 3
  { date: '2026-11-25', time: '07:30:00', shift: 'pagi', method: 'tunai', type: 'pemasukan', amount: 10000, status: 'terkonfirmasi', title: 'Fotokopi 20 Lembar' },
  { date: '2026-11-25', time: '09:20:00', shift: 'pagi', method: 'tunai', type: 'pemasukan', amount: 40000, status: 'terkonfirmasi', title: 'Map & Amplop Coklat' },
  { date: '2026-11-25', time: '11:40:00', shift: 'pagi', method: 'tunai', type: 'pengeluaran', amount: 15000, status: 'terkonfirmasi', title: 'Beli Lem & Gunting' },
  // Group (2026-11-25, pagi, qris): pem 200.000, peng 0, tot 200.000, cnt 3
  { date: '2026-11-25', time: '08:40:00', shift: 'pagi', method: 'qris', type: 'pemasukan', amount: 60000, status: 'terkonfirmasi', title: 'Print Laporan Magang' },
  { date: '2026-11-25', time: '10:50:00', shift: 'pagi', method: 'qris', type: 'pemasukan', amount: 90000, status: 'terkonfirmasi', title: 'Cetak Foto & Bingkai' },
  { date: '2026-11-25', time: '13:15:00', shift: 'pagi', method: 'qris', type: 'pemasukan', amount: 50000, status: 'terkonfirmasi', title: 'Scan Dokumen PDF' },
  // Group (2026-11-25, siang, transfer): pem 250.000, peng 35.000, tot 215.000, cnt 2
  { date: '2026-11-25', time: '15:40:00', shift: 'siang', method: 'transfer', type: 'pemasukan', amount: 250000, status: 'terkonfirmasi', title: 'Pesanan Kalender Meja' },
  { date: '2026-11-25', time: '18:20:00', shift: 'siang', method: 'transfer', type: 'pengeluaran', amount: 35000, status: 'terkonfirmasi', title: 'Kurir Bahan Kertas' },
  // Excluded (ditolak #3)
  { date: '2026-11-25', time: '12:00:00', shift: 'pagi', method: 'qris', type: 'pemasukan', amount: 444000, status: 'ditolak', title: 'QRIS Expired Ditolak #3' },

  // ======================== 2026-11-26 (8 terkonfirmasi + 1 perlu_ditinjau + 1 ditolak = 10) ========================
  // Group (2026-11-26, pagi, tunai): pem 100.000, peng 0, tot 100.000, cnt 2
  { date: '2026-11-26', time: '07:20:00', shift: 'pagi', method: 'tunai', type: 'pemasukan', amount: 75000, status: 'terkonfirmasi', title: 'Fotokopi Arsip Kantor' },
  { date: '2026-11-26', time: '10:05:00', shift: 'pagi', method: 'tunai', type: 'pemasukan', amount: 25000, status: 'terkonfirmasi', title: 'Beli Buku Tulis' },
  // Group (2026-11-26, pagi, qris): pem 200.000, peng 0, tot 200.000, cnt 2
  { date: '2026-11-26', time: '09:10:00', shift: 'pagi', method: 'qris', type: 'pemasukan', amount: 85000, status: 'terkonfirmasi', title: 'Print Makalah QRIS' },
  { date: '2026-11-26', time: '12:40:00', shift: 'pagi', method: 'qris', type: 'pemasukan', amount: 115000, status: 'terkonfirmasi', title: 'Jilid Hardcover + Cetak' },
  // Group (2026-11-26, siang, tunai): pem 50.000, peng 20.000, tot 30.000, cnt 2
  { date: '2026-11-26', time: '14:50:00', shift: 'siang', method: 'tunai', type: 'pemasukan', amount: 50000, status: 'terkonfirmasi', title: 'Fotokopi & Laminating' },
  { date: '2026-11-26', time: '17:10:00', shift: 'siang', method: 'tunai', type: 'pengeluaran', amount: 20000, status: 'terkonfirmasi', title: 'Beli Isi Staples & Tisu' },
  // Group (2026-11-26, siang, transfer): pem 200.000, peng 0, tot 200.000, cnt 2
  { date: '2026-11-26', time: '16:00:00', shift: 'siang', method: 'transfer', type: 'pemasukan', amount: 140000, status: 'terkonfirmasi', title: 'Cetak Stempel & Kartu Nama' },
  { date: '2026-11-26', time: '19:30:00', shift: 'siang', method: 'transfer', type: 'pemasukan', amount: 60000, status: 'terkonfirmasi', title: 'Print A3 Kalkir' },
  // Excluded
  { date: '2026-11-26', time: '15:15:00', shift: 'siang', method: 'qris', type: 'pemasukan', amount: 333000, status: 'perlu_ditinjau', title: 'QRIS Indikasi Duplikat #4' },
  { date: '2026-11-26', time: '18:45:00', shift: 'siang', method: 'tunai', type: 'pemasukan', amount: 222000, status: 'ditolak', title: 'Transaksi Batal Ditolak #4' },
];

/**
 * Total hasil hitungan manual (hanya status = 'terkonfirmasi', 52 dari 60 transaksi).
 * Seluruh angka di bawah dihitung manual di atas kertas dan dibandingkan terhadap query SQL.
 */
export const EXPECTED_MANUAL_RECAP = {
  totalSeededRows: 60,
  confirmedCount: 52,
  perluDitinjauCount: 4,
  ditolakCount: 4,
  grandTotal: {
    total_pemasukan: 3535000,
    total_pengeluaran: 375000,
    grand_total: 3160000,
    transaction_count: 52,
  },
  byDateShiftMethod: [
    { date: '2026-11-20', shift: 'pagi', method: 'qris', pemasukan: 100000, pengeluaran: 0, total: 100000, transaction_count: 2 },
    { date: '2026-11-20', shift: 'pagi', method: 'tunai', pemasukan: 125000, pengeluaran: 25000, total: 100000, transaction_count: 3 },
    { date: '2026-11-20', shift: 'siang', method: 'transfer', pemasukan: 150000, pengeluaran: 50000, total: 100000, transaction_count: 2 },

    { date: '2026-11-21', shift: 'pagi', method: 'tunai', pemasukan: 100000, pengeluaran: 0, total: 100000, transaction_count: 2 },
    { date: '2026-11-21', shift: 'siang', method: 'qris', pemasukan: 180000, pengeluaran: 0, total: 180000, transaction_count: 2 },
    { date: '2026-11-21', shift: 'siang', method: 'tunai', pemasukan: 150000, pengeluaran: 30000, total: 120000, transaction_count: 3 },

    { date: '2026-11-22', shift: 'pagi', method: 'qris', pemasukan: 100000, pengeluaran: 0, total: 100000, transaction_count: 2 },
    { date: '2026-11-22', shift: 'pagi', method: 'transfer', pemasukan: 200000, pengeluaran: 40000, total: 160000, transaction_count: 2 },
    { date: '2026-11-22', shift: 'siang', method: 'tunai', pemasukan: 80000, pengeluaran: 10000, total: 70000, transaction_count: 3 },

    { date: '2026-11-23', shift: 'pagi', method: 'tunai', pemasukan: 100000, pengeluaran: 0, total: 100000, transaction_count: 3 },
    { date: '2026-11-23', shift: 'siang', method: 'qris', pemasukan: 250000, pengeluaran: 0, total: 250000, transaction_count: 3 },
    { date: '2026-11-23', shift: 'siang', method: 'transfer', pemasukan: 300000, pengeluaran: 100000, total: 200000, transaction_count: 2 },

    { date: '2026-11-24', shift: 'pagi', method: 'transfer', pemasukan: 300000, pengeluaran: 0, total: 300000, transaction_count: 2 },
    { date: '2026-11-24', shift: 'siang', method: 'qris', pemasukan: 200000, pengeluaran: 0, total: 200000, transaction_count: 2 },
    { date: '2026-11-24', shift: 'siang', method: 'tunai', pemasukan: 150000, pengeluaran: 50000, total: 100000, transaction_count: 3 },

    { date: '2026-11-25', shift: 'pagi', method: 'qris', pemasukan: 200000, pengeluaran: 0, total: 200000, transaction_count: 3 },
    { date: '2026-11-25', shift: 'pagi', method: 'tunai', pemasukan: 50000, pengeluaran: 15000, total: 35000, transaction_count: 3 },
    { date: '2026-11-25', shift: 'siang', method: 'transfer', pemasukan: 250000, pengeluaran: 35000, total: 215000, transaction_count: 2 },

    { date: '2026-11-26', shift: 'pagi', method: 'qris', pemasukan: 200000, pengeluaran: 0, total: 200000, transaction_count: 2 },
    { date: '2026-11-26', shift: 'pagi', method: 'tunai', pemasukan: 100000, pengeluaran: 0, total: 100000, transaction_count: 2 },
    { date: '2026-11-26', shift: 'siang', method: 'transfer', pemasukan: 200000, pengeluaran: 0, total: 200000, transaction_count: 2 },
    { date: '2026-11-26', shift: 'siang', method: 'tunai', pemasukan: 50000, pengeluaran: 20000, total: 30000, transaction_count: 2 },
  ],
  byShift: [
    { shift: 'pagi', pemasukan: 1575000, pengeluaran: 80000, total: 1495000, transaction_count: 26 },
    { shift: 'siang', pemasukan: 1960000, pengeluaran: 295000, total: 1665000, transaction_count: 26 },
  ],
  byMethod: [
    { method: 'qris', pemasukan: 1230000, pengeluaran: 0, total: 1230000, transaction_count: 16 },
    { method: 'transfer', pemasukan: 1400000, pengeluaran: 225000, total: 1175000, transaction_count: 12 },
    { method: 'tunai', pemasukan: 905000, pengeluaran: 150000, total: 755000, transaction_count: 24 },
  ],
  byDate: [
    { date: '2026-11-20', pemasukan: 375000, pengeluaran: 75000, total: 300000, transaction_count: 7 },
    { date: '2026-11-21', pemasukan: 430000, pengeluaran: 30000, total: 400000, transaction_count: 7 },
    { date: '2026-11-22', pemasukan: 380000, pengeluaran: 50000, total: 330000, transaction_count: 7 },
    { date: '2026-11-23', pemasukan: 650000, pengeluaran: 100000, total: 550000, transaction_count: 8 },
    { date: '2026-11-24', pemasukan: 650000, pengeluaran: 50000, total: 600000, transaction_count: 7 },
    { date: '2026-11-25', pemasukan: 500000, pengeluaran: 50000, total: 450000, transaction_count: 8 },
    { date: '2026-11-26', pemasukan: 550000, pengeluaran: 20000, total: 530000, transaction_count: 8 },
  ],
  dashboardOn20261126: {
    date: '2026-11-26',
    total_hari_ini: { pemasukan: 550000, pengeluaran: 20000, total: 530000, transaction_count: 8 },
    per_shift: {
      pagi: { pemasukan: 300000, pengeluaran: 0, total: 300000, transaction_count: 4 },
      siang: { pemasukan: 250000, pengeluaran: 20000, total: 230000, transaction_count: 4 },
    },
    per_metode: {
      tunai: { pemasukan: 150000, pengeluaran: 20000, total: 130000, transaction_count: 4 },
      qris: { pemasukan: 200000, pengeluaran: 0, total: 200000, transaction_count: 2 },
      transfer: { pemasukan: 200000, pengeluaran: 0, total: 200000, transaction_count: 2 },
    },
    perlu_ditinjau_count: 4,
  },
};

/**
 * Mengisi 60 transaksi ke database PostgreSQL secara deterministik dan idempoten.
 *
 * @param {import('pg').Pool} pool
 * @returns {Promise<number>} Jumlah transaksi yang disisipkan.
 */
export async function seed60Transactions(pool) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Ambil mapping master ID
    const shiftsRes = await client.query('SELECT shift_type_id, LOWER(shift_name) AS name FROM shift_types');
    const methodsRes = await client.query('SELECT payment_method_id, LOWER(method_code) AS code FROM payment_methods');
    const categoriesRes = await client.query('SELECT category_id FROM categories ORDER BY category_id ASC LIMIT 1');
    const usersRes = await client.query("SELECT user_id FROM users WHERE username IN ('owner', 'employee') ORDER BY user_id ASC LIMIT 1");

    const shiftMap = Object.fromEntries(shiftsRes.rows.map((r) => [r.name, r.shift_type_id]));
    const methodMap = Object.fromEntries(methodsRes.rows.map((r) => [r.code, r.payment_method_id]));
    const categoryId = categoriesRes.rows[0]?.category_id || null;
    const userId = usersRes.rows[0]?.user_id || null;

    // Bersihkan seed60 sebelumnya agar idempoten saat dijalankan ulang
    await client.query("DELETE FROM transaction WHERE idempotency_key LIKE 'seed60-%'");

    for (let i = 0; i < MANUAL_60_TRANSACTIONS.length; i += 1) {
      const trx = MANUAL_60_TRANSACTIONS[i];
      const idemKey = `seed60-${String(i + 1).padStart(2, '0')}`;

      await client.query(
        `INSERT INTO transaction
           (shift_type_id, payment_method_id, category_id,
            created_by, confirmed_by,
            title, transaction_type, amount,
            transaction_date, transaction_time, transaction_status,
            is_duplicate, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          shiftMap[trx.shift],
          methodMap[trx.method],
          categoryId,
          userId,
          trx.status === 'terkonfirmasi' ? userId : null,
          trx.title,
          trx.type,
          trx.amount,
          trx.date,
          trx.time,
          trx.status,
          trx.status === 'perlu_ditinjau',
          idemKey,
        ],
      );
    }

    await client.query('COMMIT');
    return MANUAL_60_TRANSACTIONS.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const isEntryPoint =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  const databaseUrl = process.env.DATABASE_URL || '';
  const useSSL = Boolean(
    process.env.DB_SSL === 'true'
      || databaseUrl.includes('sslmode=require')
      || databaseUrl.includes('neon.tech')
      || process.env.NODE_ENV === 'production',
  );

  const pool = databaseUrl
    ? new Pool({ connectionString: databaseUrl, ssl: useSSL ? { rejectUnauthorized: false } : false, max: 2 })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'capstone_project',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
      });

  seed60Transactions(pool)
    .then(async (count) => {
      console.log(`✅ Berhasil menyemai ${count} transaksi uji (52 terkonfirmasi, 4 perlu_ditinjau, 4 ditolak).`);
      console.log(`📊 Target manual grand_total = Rp ${EXPECTED_MANUAL_RECAP.grandTotal.grand_total.toLocaleString('id-ID')}`);
      await pool.end();
    })
    .catch(async (err) => {
      console.error('❌ Gagal menjalankan seed 60 transaksi:', err.message);
      await pool.end();
      process.exit(1);
    });
}
