export default function Header({ currentUser, onLogout }) {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-20 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-base shadow-sm">
            ₹
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg text-slate-900 leading-tight">
              Esbe Cash Recap
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">
              UMKM Fotocopy Esbe Lampu Merah
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-slate-600">
            Masuk: <strong className="text-indigo-700 font-semibold">{currentUser.name}</strong> ({currentUser.role})
          </span>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Keluar
          </button>
        </div>
      </div>
    </header>
  );
}

