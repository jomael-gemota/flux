import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '../../store/authStore';
import { fetchMe } from '../../api/auth';
import { SignInPage } from './SignInPage';
import { PendingApprovalPage } from './PendingApprovalPage';
import { Loader2 } from 'lucide-react';

export function AuthGate({ children }: { children: ReactNode }) {
  const { token, user, loading, setAuth, setUser, logout } = useAuthStore();

  // Handle OAuth callback — token arrives as ?auth_token=<jwt> in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingToken = params.get('auth_token');
    const authError     = params.get('auth_error');

    if (incomingToken) {
      // Store the token then clean the URL
      localStorage.setItem('flux_auth_token', incomingToken);
      useAuthStore.setState({ token: incomingToken });
      const clean = window.location.pathname;
      window.history.replaceState({}, '', clean);
    }

    if (authError) {
      logout();
      const clean = `${window.location.pathname}?auth_error=${authError}`;
      window.history.replaceState({}, '', clean);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Verify stored token on mount / after token arrives
  useEffect(() => {
    const stored = localStorage.getItem('flux_auth_token');
    if (!stored) {
      useAuthStore.setState({ loading: false });
      return;
    }

    fetchMe()
      .then(({ user: freshUser, token: freshToken }) => {
        setAuth(freshToken, freshUser);
      })
      .catch(() => {
        logout();
      });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull auth_error from URL for the sign-in page
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
        <img src="/logo.png" alt="Flux" className="w-12 h-12 rounded-xl mx-auto mb-5" />
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
