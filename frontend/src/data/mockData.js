export const INITIAL_MOCK_TRANSACTIONS = [
  {
    id: 'TRX-001',
    title: 'Penjualan Fotokopi & Jilid Skripsi',
    type: 'pemasukan',
    category: 'Penjualan',
    amount: 145000,
    date: '2026-11-20',
    notes: 'Pembayaran tunai kasir',
    proofUrl: 'https://images.unsplash.com/photo-1554415707-9e4966aa500a?w=500&auto=format&fit=crop&q=60'
  },
  {
    id: 'TRX-002',
    title: 'Beli Kertas HVS A4 70gr (5 Rim)',
    type: 'pengeluaran',
    category: 'Perlengkapan',
    amount: 275000,
    date: '2026-11-21',
    notes: 'Nota pembelian Toko Berkah ATK',
    proofUrl: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=500&auto=format&fit=crop&q=60'
  },
  {
    id: 'TRX-003',
    title: 'Service & Refill Tinta Printer Epson L3110',
    type: 'pengeluaran',
    category: 'Maintenance',
    amount: 180000,
    date: '2026-11-22',
    notes: 'Kuitansi teknisi servis printer',
    proofUrl: ''
  },
  {
    id: 'TRX-004',
    title: 'Penjualan Alat Tulis Kantor (ATK)',
    type: 'pemasukan',
    category: 'Penjualan',
    amount: 92000,
    date: '2026-11-23',
    notes: 'Pembeli bayar via QRIS',
    proofUrl: ''
  }
];

export const formatRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(number);
};

