import api, { USE_MOCK } from './api';

const STORAGE_USERS_KEY = 'esbe_registered_accounts';

// Akun Pemilik Absolut (Permanent Master Owner) - tidak dapat diedit atau dihapus
export const ABSOLUTE_OWNER = {
  id: 'usr-owner-root',
  username: 'owner',
  name: 'Pemilik Toko (Esbe)',
  role: 'Pemilik',
  createdAt: '2026-01-01',
  isAbsolute: true
};

export const INITIAL_USERS = [
  ABSOLUTE_OWNER,
  {
    id: 'usr-002',
    username: 'employee',
    name: 'Karyawan Kasir',
    role: 'Karyawan',
    createdAt: '2026-02-01',
    isAbsolute: false
  }
];

function mapRoleToUi(role) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'owner' || normalized === 'pemilik' || normalized === 'admin') {
    return 'Pemilik';
  }
  return 'Karyawan';
}

function mapRoleToApi(role) {
  return role === 'Pemilik' || role === 'owner' ? 'owner' : 'employee';
}

function mapBackendUserToUi(u) {
  return {
    id: u.id,
    username: u.username,
    name: u.name || u.fullname || u.username,
    role: mapRoleToUi(u.role),
    is_active: u.is_active !== false,
    isAbsolute: Boolean(u.isAbsolute || u.username === ABSOLUTE_OWNER.username),
    createdAt: u.createdAt || (u.create_at ? String(u.create_at).slice(0, 10) : null)
  };
}

function extractApiErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    fallback
  );
}

// Inisialisasi fallback lokal (hanya aktif ketika VITE_USE_MOCK=true)
export const getStoredUsers = () => {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    const parsed = JSON.parse(raw);
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
 * Service API Manajemen Pengguna.
 * Terhubung langsung ke endpoint backend /users (PostgreSQL) sehingga akun employee
 * yang didaftarkan Owner dapat langsung digunakan untuk login di /auth/login.
 */
export const userService = {
  async getAllUsers() {
    if (USE_MOCK) {
      return getStoredUsers();
    }

    try {
      const response = await api.get('/users');
      const rows = response.data?.data || [];
      return rows.map(mapBackendUserToUi);
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Gagal memuat daftar pengguna dari server backend.'));
    }
  },

  async createUser(userData) {
    const cleanUsername = (userData.username || '').trim().toLowerCase();
    const cleanName = (userData.name || '').trim();
    const uiRole = userData.role === 'Pemilik' ? 'Pemilik' : 'Karyawan';

    if (!cleanUsername) throw new Error('Username wajib diisi');
    if (!cleanName) throw new Error('Nama lengkap wajib diisi');
    if (!userData.password || userData.password.length < 6) {
      throw new Error('Kata sandi minimal 6 karakter');
    }

    if (USE_MOCK) {
      const currentUsers = getStoredUsers();
      if (currentUsers.some((u) => u.username.toLowerCase() === cleanUsername)) {
        throw new Error(`Username '${cleanUsername}' sudah digunakan. Silakan gunakan username lain.`);
      }

      const newUser = {
        id: `usr-${Date.now()}`,
        username: cleanUsername,
        name: cleanName,
        role: uiRole,
        createdAt: new Date().toISOString().split('T')[0],
        isAbsolute: false
      };

      setStoredUsers([...currentUsers, newUser]);
      return newUser;
    }

    try {
      const res = await api.post('/users', {
        username: cleanUsername,
        name: cleanName,
        password: userData.password,
        role: mapRoleToApi(uiRole)
      });
      return mapBackendUserToUi(res.data?.data);
    } catch (err) {
      throw new Error(
        extractApiErrorMessage(err, 'Gagal mendaftarkan akun. Pastikan server backend aktif.')
      );
    }
  },

  async updateUser(id, updateData) {
    if (USE_MOCK) {
      const currentUsers = getStoredUsers();
      const target = currentUsers.find((u) => u.id === id);
      if (!target) throw new Error('Pengguna tidak ditemukan');
      if (target.isAbsolute && target.username === ABSOLUTE_OWNER.username) {
        if (updateData.role && updateData.role !== 'Pemilik') {
          throw new Error('Role akun pemilik absolut tidak boleh diubah.');
        }
      }
      const updatedList = currentUsers.map((u) =>
        u.id === id
          ? {
              ...u,
              name: updateData.name ? updateData.name.trim() : u.name,
              role: u.isAbsolute ? 'Pemilik' : updateData.role || u.role
            }
          : u
      );
      setStoredUsers(updatedList);
      return updatedList.find((u) => u.id === id);
    }

    try {
      const payload = { ...updateData };
      if (payload.role) payload.role = mapRoleToApi(payload.role);
      const res = await api.put(`/users/${id}`, payload);
      return mapBackendUserToUi(res.data?.data);
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Gagal memperbarui akun pengguna.'));
    }
  },

  async deleteUser(id) {
    if (USE_MOCK) {
      const currentUsers = getStoredUsers();
      const target = currentUsers.find((u) => u.id === id);
      if (!target) throw new Error('Pengguna tidak ditemukan.');
      if (target.isAbsolute || target.username === ABSOLUTE_OWNER.username) {
        throw new Error('Akun Pemilik Absolut adalah cadangan permanen dan TIDAK DAPAT dihapus!');
      }
      setStoredUsers(currentUsers.filter((u) => u.id !== id));
      return true;
    }

    try {
      await api.delete(`/users/${id}`);
      return true;
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Gagal menghapus akun pengguna.'));
    }
  }
};
