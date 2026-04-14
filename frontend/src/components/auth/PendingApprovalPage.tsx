import { Clock, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export function PendingApprovalPage() {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#E9EEF6] dark:bg-[#171717] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">

        <img src="/logo.png" alt="Flux Workflow" className="w-12 h-12 rounded-xl object-contain shadow-md mx-auto mb-5" />

        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/20 mx-auto mb-4">
          <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Awaiting Approval
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-1">
          Hi <span className="font-semibold text-gray-700 dark:text-slate-300">{user?.name ?? 'there'}</span>,
          your account has been registered.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
          A Platform Owner will review your request and grant access shortly.
          You'll be able to sign in once approved.
        </p>

        <button
          onClick={logout}
          className="flex items-center gap-2 mx-auto text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}
