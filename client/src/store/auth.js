import { create } from 'zustand';
import api from '../api/client';

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
};

// useAuth((s) => s.user) -> { _id, name, email, role } | null
export const useAuth = create((set) => ({
  user: readUser(),
  token: localStorage.getItem('token'),

  login: async (email, password) => {
    const { token, user } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
    return user;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
}));
