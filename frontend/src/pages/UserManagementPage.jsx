import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { TableSkeleton } from '../components/Skeleton';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Pencil,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { userService, ABSOLUTE_OWNER } from '../services/userService';
import { useTiltSurface } from '../hooks/useTiltSurface';
import { useMouseGlow } from '../hooks/useMouseGlow';
import { useSmoothResize } from '../hooks/useSmoothResize';
import EmptyNote from '../components/ui/EmptyNote';
import TxSearch from '../components/ui/TxSearch';
import {
  btnGhost,
  btnPrimary,
  card,
  field,
  hint,
  ico,
  iconBtn,
  label,
  motion,
  Notice
} from '../lib/ui';

// ── Animasi masuk halaman (sama dengan Dashboard: EASE_OUT + stagger) ─────────
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const BASE_DELAY = 150;
const STAGGER = 70;
const ENTER_MS = 700;
const SETTLE_MS = BASE_DELAY + 8 * STAGGER + ENTER_MS + 300; // setelah ini style animasi dilepas
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Tombol pil putih di atas latar hero (sama dengan kontrol hero di Dashboard)
const heroBtn =
  'inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--surface-app)] px-4 text-sm font-semibold text-[var(--text-main)] shadow-[var(--shadow-inset-hero)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-inset-hero-hover)] active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[color:var(--ring-on-dark)] motion-reduce:transition-none';

// Animasi hover icon: sama dengan halaman Transaksi/OCR. Dipasang di icon; elemen induknya harus punya class `group`.
const ICON_HOVER = 'transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none';
const iconCls = (extra = '') => `${ico?.className ?? 'h-4 w-4'} ${extra} ${ICON_HOVER}`;

// ── Pill: glow aksen mengikuti kursor saat hover; saat diklik glow mengembang jadi stroke penuh ──
//   field  : stroke penuh selama fokus
//   active : stroke penuh selama state terpilih (menggantikan border/ring lama)
//   press  : stroke penuh hanya selama ditekan
// Warna bisa diganti lewat --glow-c / --glow-c2 (default royal).
const GLOW_CSS = `
@property --gr{syntax:'<length>';inherits:false;initial-value:150px}
.glow-pill{position:relative;isolation:isolate;border-radius:var(--pr,.75rem)}
.glow-pill::before,.glow-pill::after{content:'';position:absolute;inset:0;pointer-events:none;border-radius:inherit;opacity:0;transition:opacity 220ms ease}
.glow-pill::before{z-index:-1;background:radial-gradient(90px circle at var(--gx,50%) var(--gy,50%),color-mix(in srgb,var(--glow-c,var(--royal-500)) 55%,transparent),transparent 70%);filter:blur(7px)}
.glow-pill::after{--gr:150px;z-index:2;padding:1px;transition:opacity 220ms ease,padding 300ms ease,--gr 1200ms cubic-bezier(.3,.7,.3,1);background:radial-gradient(var(--gr) circle at var(--gx,50%) var(--gy,50%),var(--glow-c,var(--royal-500)) calc(var(--gr)*.4),color-mix(in srgb,var(--glow-c2,var(--royal-400)) 45%,transparent) calc(var(--gr)*.62),transparent calc(var(--gr)*.8));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.glow-compact::before{display:none}
.glow-compact::after{--gr:64px}
.glow-pill:hover::before{opacity:.55}
.glow-pill:hover::after{opacity:1}
.glow-pill.glow-press:active::after,.glow-pill.is-active::after{opacity:1;--gr:calc(var(--gd,3000px)*2.6)}
.glow-pill.is-active::after{padding:2px}
.glow-field:focus-within::after{opacity:1;--gr:calc(var(--gd,3000px)*2.6);padding:2px}
.glow-pill:has(:is(input,textarea,select,button):disabled)::before,.glow-pill:has(:is(input,textarea,select,button):disabled)::after{display:none}
.glow-pill :is(input,textarea,select):not([type=hidden]):not([type=radio]){display:block;background-color:var(--surface-card)!important;border-radius:var(--pr,.75rem)!important}
.glow-pill :is(input,textarea,select):not([type=hidden]):not([type=radio]):not(:focus){border:1px solid var(--border-default)!important;box-shadow:none!important}
.glow-field :is(input,textarea,select):not([type=hidden]):focus{border:1px solid transparent!important;box-shadow:none!important;outline:none!important}
@media (hover:none){.glow-pill::before,.glow-pill:not(.is-active):not(.glow-press:active):not(.glow-field:focus-within)::after{display:none}}
@media (prefers-reduced-motion:reduce){.glow-pill::before,.glow-pill::after{transition:none}}
`;

function trackGlow(e) {
  const el = e.currentTarget;
  // Saat sudah aktif/fokus, titik pusat dikunci di titik klik supaya stroke penuh tidak bergeser mengikuti kursor.
  if (el.matches('.glow-field:focus-within, .is-active')) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--gx', `${e.clientX - r.left}px`);
  el.style.setProperty('--gy', `${e.clientY - r.top}px`);
}

// Klik: simpan titik klik + jarak ke sudut terjauh, supaya glow mengembang sampai menutup SELURUH keliling (full stroke).
function pressGlow(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  el.style.setProperty('--gx', `${x}px`);
  el.style.setProperty('--gy', `${y}px`);
  el.style.setProperty('--gd', `${Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y))}px`);
}

function GlowPill({
  radius = '0.75rem',
  className = '',
  field: isField = false,
  active = false,
  press = false,
  compact = false,
  color,
  color2,
  children
}) {
  const style = { '--pr': radius };
  if (color) {
    style['--glow-c'] = color;
    style['--glow-c2'] = color2 || color;
  }
  return (
    <div
      className={`glow-pill ${isField ? 'glow-field' : ''} ${active ? 'is-active' : ''} ${press ? 'glow-press' : ''} ${compact ? 'glow-compact' : ''} ${className}`}
      style={style}
      onMouseMove={trackGlow}
      onPointerDown={pressGlow}
    >
      {children}
    </div>
  );
}

// Skala tipografi kartu (seragam dengan Dashboard):
//   judul 18px semibold · subjudul 14px muted
function CardHeader({ title, hint: hintText, right }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-[11rem] flex-1">
        <h2 className="text-lg font-semibold leading-snug text-[var(--text-main)]">{title}</h2>
        {hintText && <p className="mt-1 text-sm leading-snug text-[var(--text-muted)]">{hintText}</p>}
      </div>
      {right}
    </div>
  );
}

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--royal-500)]';

const ROLE_OPTIONS = [
  {
    value: 'Karyawan',
    label: 'Karyawan (Kasir)',
    Icon: User,
    glow: ['var(--amber-500)', 'var(--amber-400)'],
    active: 'border-transparent bg-[var(--amber-50)] text-[var(--amber-700)]'
  },
  {
    value: 'Pemilik',
    label: 'Pemilik (Owner)',
    Icon: Shield,
    active: 'border-transparent bg-[var(--royal-50)] text-[var(--royal-700)]'
  }
];

const MIN_PASSWORD = 6;

const ROLE_FILTERS = [
  ['semua', 'Semua'],
  ['Pemilik', 'Pemilik (Owner)'],
  ['Karyawan', 'Karyawan']
];

const USER_COLUMNS = [
  { key: 'nama', label: 'Pengguna', sort: (u) => u.name || '' },
  { key: 'username', label: 'Username', sort: (u) => u.username || '' },
  { key: 'peran', label: 'Peran / Hak Akses', sort: (u) => u.role || '' },
  {
    key: 'status',
    label: 'Status Akun',
    sort: (u) =>
      u.isAbsolute || u.username === ABSOLUTE_OWNER.username ? 'Cadangan Absolut' : 'Aktif'
  },
  { key: 'aksi', label: 'Aksi', align: 'right', noSort: true }
];

export default function UserManagementPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('semua');

  // Modal State Tambah / Edit Akun (satu modal dipakai untuk dua mode)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Karyawan');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = mode tambah, objek user = mode edit
  const isEdit = !!editingUser;
  // Mengedit akun yang sedang dipakai login: peran & username dikunci agar tidak terkunci keluar
  const selfEdit = isEdit && currentUser?.username === editingUser.username;

  // Notifikasi Feedback
  const [notification, setNotification] = useState(null);
  const notifyTimer = useRef(null);
  const dialogRef = useRef(null);
  const nameRef = useRef(null);
  const titleId = useId();
  const closeTimer = useRef(null);
  const [modalShown, setModalShown] = useState(false);

  // Animasi masuk: dua frame agar keadaan tersembunyi sempat ter-paint sebelum transisi
  const [ready, setReady] = useState(prefersReducedMotion);
  const [settled, setSettled] = useState(prefersReducedMotion);

  // Tilt kartu kaca baru aktif setelah animasi masuk selesai (agar tidak bentrok dengan reveal)
  const tiltTotal = useTiltSurface({ enabled: settled });
  const tiltOwner = useTiltSurface({ enabled: settled });
  const tiltStaff = useTiltSurface({ enabled: settled });
  const heroGlow = useMouseGlow({ size: 420, opacity: 0.12 });
  useSmoothResize(tiltTotal.ref);
  useSmoothResize(tiltOwner.ref);
  useSmoothResize(tiltStaff.ref);

  useEffect(() => {
    if (settled) return undefined;
    let id2;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setReady(true));
    });
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fade + naik halus. Setelah selesai, style dilepas agar transisi/hover CSS asli kembali berlaku.
  const reveal = (i, y = 18) => {
    if (settled) return undefined;
    const d = BASE_DELAY + i * STAGGER;
    return {
      opacity: ready ? 1 : 0,
      transform: ready ? 'none' : `translateY(${y}px)`,
      transition: `opacity 650ms ease-out ${d}ms, transform ${ENTER_MS}ms ${EASE_OUT} ${d}ms`,
      willChange: 'opacity, transform'
    };
  };
  // Bar tumbuh dari 0 (transisi lebar tetap aktif agar perubahan data juga mulus)
  const grow = (pct, i, nonZero = pct > 0) => ({
    width: `${ready ? Math.max(pct, nonZero ? 2 : 0) : 0}%`,
    transition: `width 900ms ${EASE_OUT} ${settled ? 0 : BASE_DELAY + i * STAGGER + 350}ms`
  });

  // Modal tambah/edit akun: buka/tutup dengan fade + scale (tetap ter-mount selama animasi keluar)
  const resetForm = () => {
    setNewUsername('');
    setNewName('');
    setNewPassword('');
    setNewRole('Karyawan');
    setShowPassword(false);
  };

  const openAddModal = () => {
    resetForm();
    setEditingUser(null);
    clearTimeout(closeTimer.current);
    setIsAddModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setNewName(user.name || '');
    setNewUsername(user.username || '');
    setNewRole(user.role || 'Karyawan');
    setNewPassword('');
    setShowPassword(false);
    clearTimeout(closeTimer.current);
    setIsAddModalOpen(true);
  };

  const closeAddModal = useCallback(() => {
    setModalShown(false);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setIsAddModalOpen(false), prefersReducedMotion() ? 0 : 200);
  }, []);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!isAddModalOpen) {
      setModalShown(false);
      return undefined;
    }
    let id2;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setModalShown(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [isAddModalOpen]);

  const showNotify = useCallback((type, message) => {
    setNotification({ type, message });
    clearTimeout(notifyTimer.current);
    notifyTimer.current = setTimeout(() => setNotification(null), 4500);
  }, []);

  useEffect(() => () => clearTimeout(notifyTimer.current), []);

  // Ambil list user saat mount (setState hanya di callback async, bukan di badan effect)
  useEffect(() => {
    let active = true;
    userService
      .getAllUsers()
      .then((data) => {
        if (active) setUsers(data);
      })
      .catch(() => {
        if (active) showNotify('error', 'Gagal memuat daftar pengguna');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showNotify]);

  // Dipakai setelah mutasi agar tabel langsung segar
  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getAllUsers();
      setUsers(data);
    } catch {
      showNotify('error', 'Gagal memuat daftar pengguna');
    } finally {
      setLoading(false);
    }
  };

  // Submit Tambah / Edit Akun
  const handleSubmitUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newName.trim() || (!isEdit && !newPassword.trim())) {
      showNotify('error', 'Semua kolom formulir wajib diisi.');
      return;
    }
    if (newPassword && newPassword.length < MIN_PASSWORD) {
      showNotify('error', `Kata sandi minimal ${MIN_PASSWORD} karakter.`);
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        const changes = { username: newUsername, name: newName, role: newRole };
        if (newPassword) changes.password = newPassword; // kosong = kata sandi tidak diubah
        await userService.updateUser(editingUser.id, changes);
        showNotify('success', `Akun @${newUsername} berhasil diperbarui.`);
      } else {
        await userService.createUser({
          username: newUsername,
          name: newName,
          password: newPassword,
          role: newRole
        });
        showNotify('success', `Akun ${newUsername} (${newRole}) berhasil ditambahkan.`);
      }

      closeAddModal();
      resetForm();
      await loadUsers();
    } catch (err) {
      showNotify(
        'error',
        err.message ||
        (isEdit ? 'Terjadi kesalahan saat memperbarui akun.' : 'Terjadi kesalahan saat menambahkan akun.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Hapus Akun
  const handleDeleteUser = async (user) => {
    if (user.isAbsolute || user.username === ABSOLUTE_OWNER.username) {
      showNotify('error', 'Akun Pemilik Absolut tidak dapat dihapus dalam keadaan apa pun.');
      return;
    }

    const confirmMsg = `Yakin ingin menghapus akun "${user.name}" (@${user.username})?\nAkun ini tidak akan dapat login lagi.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await userService.deleteUser(user.id);
      showNotify('success', `Akun @${user.username} berhasil dihapus.`);
      await loadUsers();
    } catch (err) {
      showNotify('error', err.message || 'Gagal menghapus pengguna.');
    }
  };

  // Filter + urutan tabel (urutan hanya lokal, tidak mengubah data asli)
  const [sort, setSort] = useState({ key: null, dir: 'asc' });

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const rows = users.filter((u) => {
      const matchRole = roleFilter === 'semua' || u.role === roleFilter;
      const matchSearch = !q || u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
    if (!sort.key) return rows;
    const col = USER_COLUMNS.find((c) => c.key === sort.key);
    if (!col || col.noSort || typeof col.sort !== 'function') return rows;
    return [...rows].sort((a, b) => {
      const av = col.sort(a);
      const bv = col.sort(b);
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'id', { sensitivity: 'base' });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [users, roleFilter, searchQuery, sort]);

  const toggleSort = (key) => {
    const col = USER_COLUMNS.find((c) => c.key === key);
    if (!col || col.noSort || typeof col.sort !== 'function') return;
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  const ownerCount = users.filter((u) => u.role === 'Pemilik').length;
  const employeeCount = users.filter((u) => u.role === 'Karyawan').length;
  const pctShown = users.length ? Math.round((filteredUsers.length / users.length) * 100) : 0;
  const pctOwner = users.length ? Math.round((ownerCount / users.length) * 100) : 0;
  const pctStaff = users.length ? Math.round((employeeCount / users.length) * 100) : 0;

  // Modal: Escape, fokus terjebak, dan fokus kembali ke pemicu setelah tutup
  useEffect(() => {
    if (!isAddModalOpen) return undefined;
    const previous = document.activeElement;
    nameRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAddModal();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]):not([type="hidden"]), [href]'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [isAddModalOpen, closeAddModal]);

  const roleDescription =
    newRole === 'Pemilik'
      ? 'Owner memiliki hak akses ke Dashboard, Laporan Keuangan, & Manajemen Akun.'
      : 'Karyawan hanya memiliki akses ke Pencatatan Pendapatan, OCR, Unggah Bukti, dan Riwayat.';

  const passwordLen = newPassword.length;
  const passwordOk = passwordLen >= MIN_PASSWORD;
  // Mode edit: kata sandi boleh dikosongkan (tidak diganti), tapi kalau diisi harus cukup panjang
  const passwordValid = isEdit ? passwordLen === 0 || passwordOk : passwordOk;
  // Mode edit: tombol simpan aktif hanya kalau ada yang berubah
  const dirty =
    !isEdit ||
    newName.trim() !== editingUser.name ||
    newUsername !== editingUser.username ||
    newRole !== editingUser.role ||
    passwordLen > 0;
  const canSubmit =
    !!newName.trim() && !!newUsername.trim() && passwordValid && dirty && !submitting;

  const noMotion = prefersReducedMotion();

  return (
    <div className="space-y-5">
      <style>{GLOW_CSS}</style>
      {/* Banner Notifikasi Toast */}
      {notification && (
        <Notice kind={notification.type === 'error' ? 'error' : 'success'}>
          <span className="min-w-0 flex-1">{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className={`${iconBtn} group`}
            aria-label="Tutup notifikasi"
          >
            <X {...ico} className={iconCls()} />
          </button>
        </Notice>
      )}

      {/* HERO */}
      <section
        ref={heroGlow.ref}
        onMouseMove={heroGlow.onMouseMove}
        onMouseLeave={heroGlow.onMouseLeave}
        className="relative overflow-hidden rounded-[22px] p-5 text-[var(--text-inverse)] shadow-[var(--shadow-royal-hero)] lg:p-6"
        style={{ background: 'var(--grad-hero)', ...reveal(0) }}
        aria-label="Manajemen akun dan akses"
      >
        <div className="pointer-events-none absolute -bottom-48 -left-32 h-80 w-80 rounded-full bg-[var(--glass-soft)]" />
        {/* Glow latar mengikuti mouse; CSS variable diwariskan dari <section>. */}
        <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 rounded-[22px]" />

        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-stretch">
          <div className="relative z-10 flex flex-col gap-6">
            <div style={reveal(1, 10)}>
              <p className="group mb-3 inline-flex items-center gap-2 text-sm text-[color:var(--glass-text-soft)]">
                <ShieldCheck className={`h-4 w-4 ${ICON_HOVER}`} aria-hidden="true" />
                Pengaturan akses
              </p>
              <h1 className="break-words text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl xl:text-5xl">
                Manajemen Akun &amp; Akses
              </h1>
              <p className="mt-3 max-w-md text-sm leading-snug text-[color:var(--glass-text-soft)]">
                Kelola kredensial akun kasir karyawan dan pemilik toko. Halaman ini hanya dapat diakses oleh Owner.
              </p>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-3" style={reveal(1, 10)}>
              <button type="button" onClick={openAddModal} className={heroBtn}>
                <UserPlus {...ico} />
                Tambah Akun Baru
              </button>
            </div>
          </div>

          <div className="relative">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -right-14 -top-16 h-56 w-56 rounded-full bg-[var(--glass-line)]" />
              <div className="absolute -bottom-20 left-6 h-52 w-52 rounded-full bg-[var(--glass-soft)]" />
            </div>
            <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[34rem] xl:w-[40rem]">
              <div
                ref={tiltTotal.ref}
                onMouseMove={tiltTotal.onMouseMove}
                onMouseLeave={tiltTotal.onMouseLeave}
                className="group flex flex-col rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-subtle)] p-4 shadow-[var(--shadow-glass-card)] backdrop-blur-xl"
                style={reveal(2, 12)}
              >
                <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                  <Users className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                  Total akun
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{users.length}</p>
                <div className="mt-auto pt-3">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-line)]"
                    role="progressbar"
                    aria-valuenow={pctShown}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Menampilkan ${pctShown} persen dari seluruh akun`}
                  >
                    <div className="h-full rounded-full bg-[var(--text-inverse)]" style={grow(pctShown, 2)} />
                  </div>
                  <p className="mt-1.5 text-xs text-[color:var(--glass-text-soft)]">
                    {filteredUsers.length} ditampilkan
                  </p>
                </div>
              </div>

              <div
                ref={tiltOwner.ref}
                onMouseMove={tiltOwner.onMouseMove}
                onMouseLeave={tiltOwner.onMouseLeave}
                className="group flex flex-col rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-subtle)] p-4 shadow-[var(--shadow-glass-card)] backdrop-blur-xl"
                style={reveal(3, 12)}
              >
                <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                  <Shield className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                  Pemilik (Owner)
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{ownerCount}</p>
                <div className="mt-auto pt-3">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-line)]"
                    role="progressbar"
                    aria-valuenow={pctOwner}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Akun pemilik ${pctOwner} persen dari seluruh akun`}
                  >
                    <div className="h-full rounded-full bg-[var(--text-inverse)]" style={grow(pctOwner, 3)} />
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[color:var(--glass-text-soft)]">
                    <Lock className={`h-3 w-3 ${ICON_HOVER}`} aria-hidden="true" />1 akun absolut
                  </p>
                </div>
              </div>

              <div
                ref={tiltStaff.ref}
                onMouseMove={tiltStaff.onMouseMove}
                onMouseLeave={tiltStaff.onMouseLeave}
                className="group flex flex-col rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-subtle)] p-4 shadow-[var(--shadow-glass-card)] backdrop-blur-xl"
                style={reveal(4, 12)}
              >
                <p className="flex items-center gap-2 text-xs text-[color:var(--glass-text-soft)]">
                  <User className={`h-4 w-4 text-[var(--text-inverse)] ${ICON_HOVER}`} aria-hidden="true" />
                  Karyawan / Kasir
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{employeeCount}</p>
                <div className="mt-auto pt-3">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-line)]"
                    role="progressbar"
                    aria-valuenow={pctStaff}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Akun karyawan ${pctStaff} persen dari seluruh akun`}
                  >
                    <div className="h-full rounded-full bg-[var(--text-inverse)]" style={grow(pctStaff, 4)} />
                  </div>
                  <p className="mt-1.5 text-xs text-[color:var(--glass-text-soft)]">{pctStaff}% dari total akun</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROTEKSI AKUN ABSOLUT */}
      <div className="card group flex items-start gap-3" style={reveal(5)}>
        <ShieldAlert {...ico} className={`mt-0.5 shrink-0 text-[var(--royal-700)] ${ICON_HOVER}`} />
        <p className="text-sm leading-5 text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--royal-700)]">Proteksi Akun Absolut:</span> Sistem
          memiliki 1 Akun Pemilik Absolut (Master Backup Owner) yang terkunci secara permanen. Anda
          dapat menambah akun Owner lain maupun kasir, namun akun absolut tidak dapat dihapus demi
          memastikan toko selalu memiliki akses cadangan jika akun lain bermasalah.
        </p>
      </div>

      {/* DAFTAR AKUN */}
      <section className="card" style={reveal(6)}>
        <CardHeader
          title="Daftar akun"
          hint={`${filteredUsers.length} dari ${users.length} akun`}
          right={
            <TxSearch
              value={searchQuery}
              onChange={setSearchQuery}
              label="Cari akun"
              placeholder="Cari berdasarkan nama atau username..."
            />
          }
        />

        <div
          role="radiogroup"
          aria-label="Filter peran"
          className="relative mb-4 inline-grid grid-cols-3 rounded-xl bg-[var(--surface-muted)] p-1 text-xs font-medium"
        >
          {/* Penanda terpilih: bergeser mulus antar segmen */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-[var(--surface-card)] shadow-[var(--shadow-royal-card)]"
            style={{
              transform: `translateX(${Math.max(0, ROLE_FILTERS.findIndex(([v]) => v === roleFilter)) * 100}%)`,
              transition: noMotion ? 'none' : `transform 320ms ${EASE_OUT}`
            }}
          />
          {ROLE_FILTERS.map(([val, text]) => {
            const on = roleFilter === val;
            return (
              <label
                key={val}
                className={`relative z-10 cursor-pointer select-none whitespace-nowrap rounded-lg px-3.5 py-1.5 text-center transition-colors duration-200 motion-reduce:transition-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--royal-300)] ${on
                  ? 'font-semibold text-[var(--text-main)]'
                  : 'text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--surface-card)_55%,transparent)] hover:text-[var(--text-main)]'
                  }`}
              >
                <input
                  type="radio"
                  name="role-filter"
                  value={val}
                  checked={on}
                  onChange={() => setRoleFilter(val)}
                  className="sr-only"
                />
                {text}
              </label>
            );
          })}
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : filteredUsers.length === 0 ? (
          <EmptyNote>Tidak ada akun yang cocok dengan pencarian atau filter.</EmptyNote>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Daftar Akun Pengguna Esbe Cash Recap</caption>
              <thead>
                <tr className="text-xs text-[var(--text-muted)]">
                  {USER_COLUMNS.map((col) => {
                    const align = col.align === 'right' ? 'text-right' : '';
                    const pad = col.align === 'right' ? 'pl-3' : 'pr-3';
                    if (col.noSort) {
                      return (
                        <th key={col.key} scope="col" className={`py-2.5 font-normal ${pad} ${align}`}>
                          {col.label}
                        </th>
                      );
                    }
                    const active = sort.key === col.key;
                    const SortIcon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className={`py-2.5 font-normal ${pad} ${align}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          aria-label={`Urutkan berdasarkan ${col.label}`}
                          className={`group -mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)] motion-reduce:transition-none ${align === 'text-right' ? 'flex-row-reverse' : ''}`}
                        >
                          {col.label}
                          <SortIcon
                            aria-hidden="true"
                            className={`h-3 w-3 ${ICON_HOVER} ${active ? 'text-[var(--royal-600)]' : 'opacity-50'}`}
                          />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isCurrent = currentUser?.username === user.username;
                  const isAbs = user.isAbsolute || user.username === ABSOLUTE_OWNER.username;
                  return (
                    <tr
                      key={user.id}
                      className="group grid-l transition-colors duration-700 hover:bg-[var(--royal-50)] motion-reduce:transition-none"
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${user.role === 'Pemilik'
                              ? 'bg-[var(--royal-100)] text-[var(--royal-700)]'
                              : 'bg-[var(--amber-100)] text-[var(--amber-700)]'
                              }`}
                          >
                            {(user.name || '').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 font-medium text-[var(--text-main)]">
                              <span>{user.name}</span>
                              {isCurrent && (
                                <span className="rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted-alt)]">
                                  Anda
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">ID: {user.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 pr-3 font-mono text-xs text-[var(--text-main)]">@{user.username}</td>

                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${user.role === 'Pemilik'
                            ? 'bg-[var(--royal-100)] text-[var(--royal-700)]'
                            : 'bg-[var(--amber-100)] text-[var(--amber-700)]'
                            }`}
                        >
                          {user.role === 'Pemilik' ? (
                            <Shield className={`h-3 w-3 ${ICON_HOVER}`} aria-hidden="true" />
                          ) : (
                            <User className={`h-3 w-3 ${ICON_HOVER}`} aria-hidden="true" />
                          )}
                          {user.role}
                        </span>
                      </td>

                      <td className="py-3 pr-3">
                        {isAbs ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--royal-200)] bg-[var(--royal-50)] px-2.5 py-1 text-xs font-semibold text-[var(--royal-700)]">
                            <Lock className={`h-3 w-3 text-[var(--royal-600)] ${ICON_HOVER}`} aria-hidden="true" />
                            Cadangan Absolut (Permanen)
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">Akun Terdaftar</span>
                        )}
                      </td>

                      <td className="py-3 pl-3 text-right">
                        {isAbs ? (
                          <span
                            className="select-none px-2 py-1 text-xs italic text-[var(--text-muted)]"
                            title="Akun absolut dilindungi sistem dan tidak dapat diubah atau dihapus"
                          >
                            Terkunci
                          </span>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-2">
                            <GlowPill radius="0.5rem" press className="inline-flex">
                              <button
                                type="button"
                                onClick={() => openEditModal(user)}
                                className={`group inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-xs font-medium text-[var(--royal-700)] transition-all duration-150 hover:border-[var(--royal-500)] hover:bg-[var(--royal-50)] active:scale-95 motion-reduce:transition-none ${focusRing}`}
                                title="Edit akun ini"
                              >
                                <Pencil className={`h-3.5 w-3.5 ${ICON_HOVER}`} aria-hidden="true" />
                                Edit
                              </button>
                            </GlowPill>

                            <GlowPill radius="0.5rem" press color="var(--cash-out)" className="inline-flex">
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(user)}
                                disabled={isCurrent}
                                className={`group inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-150 active:scale-95 motion-reduce:transition-none ${focusRing} ${isCurrent
                                  ? 'cursor-not-allowed border-[var(--border-default)] text-[var(--text-muted)] active:scale-100'
                                  : 'border-[var(--border-default)] text-[var(--cash-out)] hover:border-[var(--cash-out)] hover:bg-[var(--cash-out-light)]'
                                  }`}
                                title={
                                  isCurrent
                                    ? 'Tidak bisa menghapus akun yang sedang aktif digunakan'
                                    : 'Hapus akun ini'
                                }
                              >
                                <Trash2 className={`h-3.5 w-3.5 ${ICON_HOVER}`} aria-hidden="true" />
                                Hapus
                              </button>
                            </GlowPill>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Tambah / Edit Akun */}
      {isAddModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4 backdrop-blur-[2px]"
            style={{
              opacity: modalShown ? 1 : 0,
              transition: noMotion ? 'none' : 'opacity 180ms ease'
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !submitting) closeAddModal();
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={`${card} flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden !p-0 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.18),0_6px_16px_-6px_rgba(15,23,42,0.10)]`}
              style={{
                transform: modalShown ? 'none' : 'translateY(8px) scale(0.95)',
                transition: noMotion ? 'none' : `transform 260ms ${EASE_OUT}`
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
                <div className="group flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--royal-50)] text-[var(--royal-700)]">
                    {isEdit ? (
                      <Pencil {...ico} className={iconCls()} />
                    ) : (
                      <UserPlus {...ico} className={iconCls()} />
                    )}
                  </span>
                  <div>
                    <h2 id={titleId} className="text-lg font-semibold leading-6 text-[var(--text-main)]">
                      {isEdit ? 'Edit Akun' : 'Tambah Akun Baru'}
                    </h2>
                    <p className="mt-0.5 text-xs leading-4 text-[var(--text-muted)]">
                      {isEdit
                        ? 'Perubahan langsung berlaku setelah disimpan.'
                        : 'Akun langsung aktif setelah disimpan.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={submitting}
                  className={`${iconBtn} group`}
                  aria-label="Tutup form"
                >
                  <X {...ico} className={iconCls()} />
                </button>
              </div>

              <form onSubmit={handleSubmitUser} className="flex min-h-0 flex-1 flex-col text-sm">
                <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-5">
                  <fieldset disabled={submitting || selfEdit} className={selfEdit ? 'opacity-60' : ''}>
                    <legend className={label}>Peran / Hak Akses</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {ROLE_OPTIONS.map((opt) => {
                        const active = newRole === opt.value;
                        const Icon = opt.Icon;
                        return (
                          <GlowPill
                            key={opt.value}
                            radius="0.75rem"
                            active={active}
                            color={opt.glow?.[0]}
                            color2={opt.glow?.[1]}
                            className="h-full"
                          >
                            <label
                              className={`group flex h-full w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ${motion} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--royal-300)] ${active
                                ? opt.active
                                : 'border-[var(--border-default)] bg-[var(--surface-muted)] text-[var(--text-muted)]'
                                }`}
                            >
                              <input
                                type="radio"
                                name="new-role"
                                value={opt.value}
                                checked={active}
                                onChange={() => setNewRole(opt.value)}
                                className="sr-only"
                              />
                              <Icon className={`h-3.5 w-3.5 ${ICON_HOVER}`} aria-hidden="true" />
                              {opt.label}
                              {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                            </label>
                          </GlowPill>
                        );
                      })}
                    </div>
                    <p className={`${hint} rounded-lg bg-[var(--surface-muted)] px-3 py-2`} aria-live="polite">
                      {selfEdit ? 'Peran akun yang sedang Anda gunakan tidak dapat diubah.' : roleDescription}
                    </p>
                  </fieldset>

                  <div>
                    <label htmlFor="new-name" className={label}>
                      Nama Lengkap
                    </label>
                    <GlowPill field>
                      <input
                        ref={nameRef}
                        id="new-name"
                        type="text"
                        required
                        autoComplete="off"
                        placeholder="Contoh: Rian Hidayat"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className={field}
                      />
                    </GlowPill>
                  </div>

                  <div>
                    <label htmlFor="new-username" className={label}>
                      Username Akun
                    </label>
                    <GlowPill field>
                      <span className="absolute top-1/2 left-3.5 z-[1] -translate-y-1/2 font-mono text-xs text-[var(--text-muted)]">
                        @
                      </span>
                      <input
                        id="new-username"
                        type="text"
                        required
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="rian"
                        disabled={selfEdit}
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                        className={`${field} pl-8 font-mono`}
                      />
                    </GlowPill>
                  </div>

                  <div>
                    <label htmlFor="new-password" className={label}>
                      {isEdit ? 'Kata Sandi Baru (opsional)' : 'Kata Sandi Sementara'}
                    </label>
                    <GlowPill field className="group">
                      <KeyRound
                        {...ico}
                        className={`pointer-events-none absolute top-1/2 left-3.5 z-[1] -translate-y-1/2 text-[var(--text-muted)] ${ICON_HOVER}`}
                      />
                      <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        required={!isEdit}
                        minLength={MIN_PASSWORD}
                        autoComplete="new-password"
                        placeholder={`Minimal ${MIN_PASSWORD} karakter`}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        aria-describedby="new-password-hint"
                        className={`${field} pr-11 pl-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute top-1/2 right-2 z-[1] inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] outline-none hover:text-[var(--text-main)] focus-visible:ring-2 focus-visible:ring-[color:var(--royal-300)]"
                        aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOff {...ico} /> : <Eye {...ico} />}
                      </button>
                    </GlowPill>
                    <p
                      id="new-password-hint"
                      className={`${hint} ${passwordLen > 0 && !passwordOk ? '!text-[var(--cash-out)]' : ''}`}
                      aria-live="polite"
                    >
                      {passwordLen === 0
                        ? isEdit
                          ? 'Kosongkan jika tidak ingin mengganti kata sandi.'
                          : 'Berikan ke pengguna, lalu minta mereka menggantinya.'
                        : passwordOk
                          ? 'Panjang kata sandi sudah cukup.'
                          : `Kurang ${MIN_PASSWORD - passwordLen} karakter lagi.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-6 py-3">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    disabled={submitting}
                    className={btnGhost}
                  >
                    Batal
                  </button>
                  <button type="submit" disabled={!canSubmit} className={btnPrimary}>
                    {submitting ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Akun'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}