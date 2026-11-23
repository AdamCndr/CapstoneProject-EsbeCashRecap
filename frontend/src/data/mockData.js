export const INITIAL_MOCK_TRANSACTIONS = [
  {
    id: 'TRX-001',
    title: 'Fotokopi Modul & Jilid Skripsi',
    type: 'pemasukan',
    category: 'Jasa Fotokopi',
    paymentMethod: 'tunai', // tunai | qris | transfer
    shift: 'pagi', // pagi | siang
    amount: 145000,
    date: '2026-11-20',
    time: '09:15',
    referenceId: 'CASH-901',
    notes: 'Pelanggan mahasiswa, bayar uang pas',
    proofUrl: 'https://images.unsplash.com/photo-1554415707-9e4966aa500a?w=500&auto=format&fit=crop&q=60',
    isDuplicate: false
  },
  {
    id: 'TRX-002',
    title: 'Print Warna & Kertas HVS 5 Rim',
    type: 'pemasukan',
    category: 'Percetakan & ATK',
    paymentMethod: 'qris',
    shift: 'pagi',
    amount: 275000,
    date: '2026-11-20',
    time: '11:42',
    referenceId: 'NMID-982341209',
    notes: 'Pembayaran QRIS Merchant Esbe',
    proofUrl: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=500&auto=format&fit=crop&q=60',
    isDuplicate: false
  },
  {
    id: 'TRX-003',
    title: 'Order Cetak Spanduk Toko Sebelah',
    type: 'pemasukan',
    category: 'Percetakan',
    paymentMethod: 'transfer',
    shift: 'siang',
    amount: 350000,
    date: '2026-11-20',
    time: '15:20',
    referenceId: 'BCA-TRF-8812',
    notes: 'Transfer rekening BCA pemilik toko',
    proofUrl: 'https://images.unsplash.com/photo-1554415707-9e4966aa500a?w=500&auto=format&fit=crop&q=60',
    isDuplicate: false
  },
  {
    id: 'TRX-004',
    title: 'Beli Refill Tinta Printer Epson Black (2 Botol)',
    type: 'pengeluaran',
    category: 'Perlengkapan',
    paymentMethod: 'tunai',
    shift: 'siang',
    amount: 180000,
    date: '2026-11-20',
    time: '16:05',
    referenceId: 'NOTA-ATK-44',
    notes: 'Beli di toko grosir komputer seberang',
    proofUrl: '',
    isDuplicate: false
  },
  {
    id: 'TRX-005',
    title: 'Fotokopi KTP & Print Berkas Lamaran',
    type: 'pemasukan',
    category: 'Jasa Fotokopi',
    paymentMethod: 'qris',
    shift: 'pagi',
    amount: 45000,
    date: '2026-11-21',
    time: '08:30',
    referenceId: 'NMID-992144812',
    notes: 'QRIS Gopay',
    proofUrl: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=500&auto=format&fit=crop&q=60',
    isDuplicate: false
  }
];

export const formatRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(number);
};
