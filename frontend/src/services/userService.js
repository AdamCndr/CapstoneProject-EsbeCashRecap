import api from './api';

const STORAGE_USERS_KEY = 'esbe_registered_accounts';

// Akun Pemilik Absolut (Permanent Master Owner) - tidak dapat diedit atau dihapus
export const ABSOLUTE_OWNER = {
  id: 'usr-owner-root',
  username: 'owner',
  name: 'Umar Syafie',
  role: 'Pemilik',
  createdAt: '2026-01-01',
  isAbsolute: true
};

export const INITIAL_USERS = [
  ABSOLUTE_OWNER,
  {
    id: 'usr-002',
    username: 'admin',
    name: 'Administrator Esbe',
    role: 'Pemilik',
    createdAt: '2026-01-15',
    isAbsolute: false
  },
  {
    id: 'usr-003',
    username: 'karyawan',
    name: 'Budi Santoso',
    role: 'Karyawan',
    createdAt: '2026-02-01',
    isAbsolute: false
  },
  {
    id: 'usr-004',
    username: 'kasir',
    name: 'Siti Rahma',
    role: 'Karyawan',
    createdAt: '2026-02-10',
    isAbsolute: false
  },
  {
    id: 'usr-005',
    username: 'andi',
    name: 'Andi Saputra',
    role: 'Karyawan',
    createdAt: '2026-03-01',
    isAbsolute: false
  }
];

// Inisialisasi awal ke localStorage jika belum ada
export const getStoredUsers = () => {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    const parsed = JSON.parse(raw);
    // Pastikan akun absolut selalu ada dan tidak bisa hilang
    const hasAbsolute = parsed.some((u) => u.username === ABSOLUTE_OWNER.username);
    if (!hasAbsolute) {
      const ensured = [ABSOLUTE_OWNER, ...parsed];
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(ensured));
      return ensured;
    }
    return parsed;
  } catch {
    return INITIAL_USERS;
  }
};

export const setStoredUsers = (users) => {
  try {
    // Pastikan akun absolut tetap dipertahankan
    const sanitized = users.map((u) =>
      u.username === ABSOLUTE_OWNER.username ? { ...u, isAbsolute: true } : u
    );
    if (!sanitized.some((u) => u.username === ABSOLUTE_OWNER.username)) {
      sanitized.unshift(ABSOLUTE_OWNER);
    }
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.error('Gagal menyimpan pengguna ke storage:', err);
  }
};

/**
 * Service API Manajemen Pengguna (Frontend-Only dengan kesiapan integrasi backend).
 * Jika backend API tersedia, fungsi akan mencoba memanggil backend terlebih dahulu.
 * Jika backend offline/belum diimplementasikan, otomatis fallback ke state/localStorage lokal.
 */
export const userService = {
  // 1. Ambil semua akun
  async getAllUsers() {
    try {
      const response = await api.get('/users');
      if (response.data && response.data.data) {
        return response.data.data;
      }
    } catch {
      // Fallback ke penyimpanan lokal saat backend belum siap
    }
    return getStoredUsers();
  },

  // 2. Tambah akun baru (Hanya Owner)
  async createUser(userData) {
    const cleanUsername = (userData.username || '').trim().toLowerCase();
    const cleanName = (userData.name || '').trim();
    const role = userData.role === 'Pemilik' ? 'Pemilik' : 'Karyawan';

    if (!cleanUsername) throw new Error('Username wajib diisi');
    if (!cleanName) throw new Error('Nama lengkap wajib diisi');

    // Coba via Backend API jika sudah ada
    try {
      const res = await api.post('/users', {
        username: cleanUsername,
        name: cleanName,
        password: userData.password,
        role
      });
      if (res.data?.data) {
        return res.data.data;
      }
    } catch {
      // Fallback lokal
    }

    const currentUsers = getStoredUsers();
    if (currentUsers.some((u) => u.username.toLowerCase() === cleanUsername)) {
      throw new Error(`Username '${cleanUsername}' sudah digunakan. Silakan gunakan username lain.`);
    }

    const newUser = {
      id: `usr-${Date.now()}`,
      username: cleanUsername,
      name: cleanName,
      role,
      createdAt: new Date().toISOString().split('T')[0],
      isAbsolute: false
    };

    const updated = [...currentUsers, newUser];
    setStoredUsers(updated);
    return newUser;
  },

  // 3. Update akun
  async updateUser(id, updateData) {
    const currentUsers = getStoredUsers();
    const target = currentUsers.find((u) => u.id === id);

    if (!target) throw new Error('Pengguna tidak ditemukan');
    if (target.isAbsolute && target.username === ABSOLUTE_OWNER.username) {
      if (updateData.role && updateData.role !== 'Pemilik') {
        throw new Error('Role akun pemilik absolut tidak boleh diubah.');
      }
    }

    try {
      const res = await api.put(`/users/${id}`, updateData);
      if (res.data?.data) {
        return res.data.data;
      }
    } catch {
      // Fallback lokal
    }

    const updatedList = currentUsers.map((u) => {
      if (u.id === id) {
        return {
          ...u,
          name: updateData.name ? updateData.name.trim() : u.name,
          role: u.isAbsolute ? 'Pemilik' : (updateData.role || u.role)
        };
      }
      return u;
    });

    setStoredUsers(updatedList);
    return updatedList.find((u) => u.id === id);
  },

  // 4. Hapus akun (Akun absolut ditolak keras)
  async deleteUser(id) {
    const currentUsers = getStoredUsers();
    const target = currentUsers.find((u) => u.id === id);

    if (!target) throw new Error('Pengguna tidak ditemukan.');
    if (target.isAbsolute || target.username === ABSOLUTE_OWNER.username) {
      throw new Error('Akun Pemilik Absolut adalah cadangan permanen dan TIDAK DAPAT dihapus!');
    }

    try {
      await api.delete(`/users/${id}`);
    } catch {
      // Fallback lokal
    }

    const filtered = currentUsers.filter((u) => u.id !== id);
    setStoredUsers(filtered);
    return true;
  }
};

