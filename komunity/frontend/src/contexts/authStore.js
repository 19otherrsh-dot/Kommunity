import { create } from 'zustand';
import { authApi } from '@/api';

// Auth is persisted server-side via an httpOnly cookie (set by the backend).
// We keep a token in memory only for the socket.io handshake; it is never
// written to localStorage, so it can't be exfiltrated by XSS. On reload the
// cookie re-authenticates and bootstrap() restores the user via /auth/me.
export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  authChecked: false,

  setToken: (token) => set({ token }),

  // Called once on app start: the cookie (if present) authenticates /auth/me.
  bootstrap: async () => {
    try {
      const { data } = await authApi.me();
      set({ user: data, authChecked: true });
    } catch (_) {
      set({ user: null, token: null, authChecked: true });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.login({ email, password });
      set({ user: data.user, token: data.token, isLoading: false, authChecked: true });
      return { ok: true };
    } catch (err) {
      set({ isLoading: false });
      return { ok: false, error: err.response?.data?.error || 'Login failed' };
    }
  },

  register: async (fullName, email, password, ref) => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.register({ full_name: fullName, email, password, ref });
      set({ user: data.user, token: data.token, isLoading: false, authChecked: true });
      return { ok: true };
    } catch (err) {
      set({ isLoading: false });
      return { ok: false, error: err.response?.data?.error || 'Registration failed' };
    }
  },

  socialLogin: async (firebaseToken) => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.socialLogin(firebaseToken);
      set({ user: data.user, token: data.token, isLoading: false, authChecked: true });
      return { ok: true };
    } catch (err) {
      set({ isLoading: false });
      return { ok: false, error: err.response?.data?.error || 'Social login failed' };
    }
  },

  logout: async () => {
    try { await authApi.logout(); } catch (_) {}
    set({ user: null, token: null });
  },

  fetchMe: async () => {
    try {
      const { data } = await authApi.me();
      set({ user: data });
    } catch (_) {
      set({ user: null, token: null });
    }
  },

  updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),

  isAuthenticated: () => !!get().user,
  isMemberOf: (communityId) => get().user?.memberships?.some(m => m.community_id === communityId),
}));
