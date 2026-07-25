import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_BASE = '/api';

interface User {
  id: number;
  username: string;
  is_admin: boolean;
}

interface SaveData {
  player?: Record<string, unknown>;
  inventory?: Record<string, unknown>;
  exploration?: Record<string, unknown>;
  ui?: Record<string, unknown>;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  saving: boolean;

  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;

  saveGame: (data: SaveData) => Promise<boolean>;
  loadGame: () => Promise<SaveData | null>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,
      error: null,
      saving: false,

      clearError: () => set({ error: null }),

      saveGame: async (data) => {
        const token = get().token;
        if (!token) return false;
        set({ saving: true });
        try {
          const res = await fetch(`${API_BASE}/save.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ data }),
          });
          const ok = res.ok;
          set({ saving: false });
          return ok;
        } catch {
          set({ saving: false });
          return false;
        }
      },

      loadGame: async () => {
        const token = get().token;
        if (!token) return null;
        try {
          const res = await fetch(`${API_BASE}/load.php`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return null;
          const json = await res.json();
          return json.data || null;
        } catch {
          return null;
        }
      },

      login: async (username, password) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch(`${API_BASE}/auth/login.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          const data = await res.json();
          if (!res.ok) {
            set({ loading: false, error: data.error || 'Ошибка входа' });
            return false;
          }
          set({ user: data.user, token: data.token, loading: false, error: null });
          return true;
        } catch {
          set({ loading: false, error: 'Ошибка соединения с сервером' });
          return false;
        }
      },

      register: async (username, password) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch(`${API_BASE}/auth/register.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          const data = await res.json();
          if (!res.ok) {
            set({ loading: false, error: data.error || 'Ошибка регистрации' });
            return false;
          }
          set({ user: data.user, token: data.token, loading: false, error: null });
          return true;
        } catch {
          set({ loading: false, error: 'Ошибка соединения с сервером' });
          return false;
        }
      },

      logout: async () => {
        const token = get().token;
        set({ loading: true });
        try {
          await fetch(`${API_BASE}/auth/logout.php`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // ignore
        }
        set({ user: null, token: null, loading: false, error: null });
      },

      checkSession: async () => {
        const token = get().token;
        if (!token) {
          set({ user: null, token: null });
          return;
        }
        try {
          const res = await fetch(`${API_BASE}/auth/me.php`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            set({ user: null, token: null });
            return;
          }
          const data = await res.json();
          set({ user: data.user });
        } catch {
          set({ user: null, token: null });
        }
      },
    }),
    {
      name: 'auth',
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          state.checkSession();
        }
      },
    },
  ),
);
