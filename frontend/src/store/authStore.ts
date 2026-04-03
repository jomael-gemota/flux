import { create } from 'zustand';
import type { AuthUser } from '../types/auth';

const TOKEN_KEY = 'flux_auth_token';
const USER_KEY  = 'flux_auth_user';

function readStoredUser(): AuthUser | null {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
        return null;
    }
}

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
    user:    readStoredUser(),
    loading: true,

    setAuth(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        set({ token, user, loading: false });
    },

    setUser(user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        set({ user, loading: false });
    },

    logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        set({ token: null, user: null, loading: false });
    },

    getToken() {
        return get().token;
    },
}));
