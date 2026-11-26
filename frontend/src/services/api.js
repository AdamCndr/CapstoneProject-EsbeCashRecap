import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'esbe_access_token';

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
  const { data } = await api.post('/auth/login', { username, password });
  return data;
}

export async function getMeRequest() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function checkOwnerOnlyRequest() {
  const { data } = await api.get('/auth/owner-only');
  return data;
}

export async function extractTransactionProofRequest(file, { shift, paymentMethod } = {}) {
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
