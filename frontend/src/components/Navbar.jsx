export default function Navbar({ currentPage, onPageChange, transactionCount }) {
  const navItems = [
    { key: 'dashboard', label: 'Dashboard Rekap (Pemilik)', icon: '📊' },
    { key: 'form', label: 'Catat Pendapatan', icon: '📝' },
    { key: 'ocr', label: 'Konfirmasi OCR & Duplikat', icon: '🔍' },
    { key: 'upload', label: 'Unggah Bukti', icon: '📎' },
    { key: 'history', label: 'Riwayat Transaksi', icon: '📋', count: transactionCount }
  ];

  return (
    <nav className="flex border-b border-slate-200 space-x-1 sm:space-x-3 overflow-x-auto pb-0.5">
      {navItems.map((item) => {
        const isActive = currentPage === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onPageChange(item.key)}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              isActive
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className="text-[11px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200 ml-0.5">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

