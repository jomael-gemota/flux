import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '../../store/authStore';
import { fetchMe } from '../../api/auth';
import { SignInPage } from './SignInPage';
import { PendingApprovalPage } from './PendingApprovalPage';
import { Loader2 } from 'lucide-react';

/** Decode a JWT and return whether it has expired (without verifying the signature). */
function isTokenExpired(jwt: string): boolean {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    // exp is seconds-since-epoch; compare to now with a 30-second grace window
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now() - 30_000;
  } catch {
    return true; // malformed token → treat as expired
  }
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { token, user, loading, setAuth, logout } = useAuthStore();

  // ── Step 1: Handle OAuth callback — token arrives as ?auth_token=<jwt> ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingToken = params.get('auth_token');
    const authError     = params.get('auth_error');

    if (incomingToken) {
      localStorage.setItem('flux_auth_token', incomingToken);
      useAuthStore.setState({ token: incomingToken, loading: true });
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (authError) {
      logout();
      window.history.replaceState({}, '', `${window.location.pathname}?auth_error=${authError}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 2: Verify / refresh the stored token on mount and when token changes ──
  useEffect(() => {
    const stored = localStorage.getItem('flux_auth_token');

    // No token at all — nothing to verify
    if (!stored) {
      useAuthStore.setState({ loading: false });
      return;
    }

    // Token is already expired client-side — clear immediately, no network call
    if (isTokenExpired(stored)) {
      logout();
      return;
    }

    // Token is locally valid and we already have a cached user — show the app
    // instantly and silently refresh in the background.
    const cachedUser = useAuthStore.getState().user;
    if (cachedUser) {
      useAuthStore.setState({ loading: false });
      // Background refresh to pick up any role/status changes and renew the token
      fetchMe()
        .then(({ user: freshUser, token: freshToken }) => setAuth(freshToken, freshUser))
        .catch(() => logout());
      return;
    }

    // No cached user yet (first login after OAuth redirect) — show spinner and fetch
    fetchMe()
      .then(({ user: freshUser, token: freshToken }) => setAuth(freshToken, freshUser))
      .catch(() => logout());
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const urlError = new URLSearchParams(window.location.search).get('auth_error') ?? undefined;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E9EEF6] dark:bg-[#171717] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!token || !user) return <SignInPage error={urlError} />;
  if (user.status === 'pending')  return <PendingApprovalPage />;
  if (user.status === 'rejected') return <RejectedPage />;

  return <>{children}</>;
}

function RejectedPage() {
  const { logout } = useAuthStore();
  return (
    <div className="min-h-screen bg-[#E9EEF6] dark:bg-[#171717] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
        <img src="/logo.png" alt="Flux Workflow" className="w-12 h-12 rounded-xl mx-auto mb-5" />
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Your account request was not approved. Please contact a Platform Owner if you think this is a mistake.
        </p>
        <button
          onClick={logout}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
