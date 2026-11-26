import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'esbe_access_token';
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    /* abaikan jika storage tidak tersedia */
  }
  return config;
});

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    /* abaikan */
  }
}

export async function loginRequest(username, password) {
  if (USE_MOCK) {
    await delay(400);
    const isOwner = /^(owner|pemilik)$/i.test((username || '').trim());
    return {
      data: {
        accessToken: 'mock-token',
        user: {
          id: isOwner ? 'mock-owner-1' : 'mock-staff-1',
          username: username || (isOwner ? 'owner' : 'kasir'),
          full_name: isOwner ? 'Umar Syafie' : null,
          role: isOwner ? 'owner' : 'staff',
        },
      },
    };
  }
  const { data } = await api.post('/auth/login', { username, password });
  return data;
}

export async function getMeRequest() {
  if (USE_MOCK) {
    const saved = localStorage.getItem('esbe_current_user');
    return { user: saved ? JSON.parse(saved) : null };
  }
  const { data } = await api.get('/auth/me');
  return data;
}

export async function checkOwnerOnlyRequest() {
  const { data } = await api.get('/auth/owner-only');
  return data;
}

export async function extractTransactionProofRequest(file, { shift, paymentMethod } = {}) {
  if (USE_MOCK) {
    await delay(500);
    return {
      title: file?.name ? `Nota ${file.name}` : 'Transaksi Nota (Mode Offline)',
      amount: 50000,
      category: 'Penjualan',
      shift: shift || 'pagi',
      payment_method: paymentMethod || 'Tunai',
      type: 'masuk',
    };
  }
  const formData = new FormData();
  formData.append('file', file);
  if (shift) formData.append('shift', shift);
  if (paymentMethod) formData.append('payment_method', paymentMethod);

  const { data } = await api.post('/transactions/extract', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export default api;
