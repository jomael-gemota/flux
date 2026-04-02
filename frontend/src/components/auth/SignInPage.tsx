import { redirectToGoogleSignIn } from '../../api/auth';

export function SignInPage({ error }: { error?: string }) {
  return (
    <div className="min-h-screen bg-[#E9EEF6] dark:bg-[#171717] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-8">

        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.png" alt="Flux" className="w-16 h-16 rounded-2xl object-contain shadow-md" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Welcome to Flux</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              AI-powered workflow automation
            </p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-5 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-red-600 dark:text-red-400">
              {error === 'access_denied' ? 'Access was denied. Please try again.' : decodeURIComponent(error)}
            </p>
          </div>
        )}

        {/* Google sign-in button */}
        <button
          onClick={redirectToGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
        >
          {/* Official Google "G" logo SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-5 leading-relaxed">
          New accounts require Platform Owner approval before access is granted.
        </p>
      </div>
    </div>
  );
}
