import axios from 'axios';

// All API calls go through this instance.
// Resolves with the `data` field of { success, data } and rejects with { code, message, details? }.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => (res.config.responseType === 'blob' ? res.data : res.data.data),
  (err) => {
    const error = err.response?.data?.error || {
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the server. Check your connection.',
    };
    const isLogin = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLogin) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export default api;
