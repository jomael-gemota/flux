import { create } from 'zustand';
import type { AuthUser } from '../types/auth';

const TOKEN_KEY = 'flux_auth_token';

interface AuthState {
    token: string | null;
    user: AuthUser | null;
    loading: boolean;
    setAuth: (token: string, user: AuthUser) => void;
    setUser: (user: AuthUser) => void;
    logout: () => void;
    getToken: () => string | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    token:   localStorage.getItem(TOKEN_KEY),
    user:    null,
    loading: true,

    setAuth(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        set({ token, user, loading: false });
    },

    setUser(user) {
        set({ user, loading: false });
    },

    logout() {
        localStorage.removeItem(TOKEN_KEY);
        set({ token: null, user: null, loading: false });
    },

    getToken() {
        return get().token;
    },
}));
