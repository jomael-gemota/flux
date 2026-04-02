import type { AuthUser, UserRole, UserStatus } from '../types/auth';
import { useAuthStore } from '../store/authStore';

const BASE = '/api';

function authHeaders(): Record<string, string> {
    const token = useAuthStore.getState().getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
            ...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
            ...authHeaders(),
            ...(options.headers ?? {}),
        },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
}

/** Fetch the current user (refreshes JWT if needed) */
export async function fetchMe(): Promise<{ user: AuthUser; token: string }> {
    return request('/auth/me');
}

/** Redirect browser to Google's OAuth consent screen */
export function redirectToGoogleSignIn(): void {
    window.location.href = '/api/auth/google';
}

// ── Admin / Platform Owner ─────────────────────────────────────────────────

export interface AdminUser extends AuthUser { createdAt: string; }

export function listUsers(): Promise<AdminUser[]> {
    return request('/admin/users');
}

export function updateUser(
    id: string,
    patch: { status?: UserStatus; role?: UserRole },
): Promise<AdminUser> {
    return request(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
    });
}

export function deleteUser(id: string): Promise<{ deleted: boolean }> {
    return request(`/admin/users/${id}`, { method: 'DELETE' });
}

export function fetchAdminStats(): Promise<{ total: number; pending: number; approved: number }> {
    return request('/admin/stats');
}
