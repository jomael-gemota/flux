import { useRef } from 'react';
import { redirectToGoogleSignIn } from '../../api/auth';

export function SignInPage({ error }: { error?: string }) {
  const bgRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = bgRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--mx', nx.toFixed(3));
    el.style.setProperty('--my', ny.toFixed(3));
  }

  function resetParallax() {
    const el = bgRef.current;
    if (!el) return;
    el.style.setProperty('--mx', '0');
    el.style.setProperty('--my', '0');
  }

  return (
    <div
      className="min-h-screen bg-[#E9EEF6] dark:bg-[#171717] flex items-center justify-center p-4 relative overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={resetParallax}
    >
      <div ref={bgRef} className="absolute inset-0 pointer-events-none">
        {/* Main agentic vector scene (inspired by reference image) */}
        <div
          className="absolute inset-0 opacity-[0.58] dark:opacity-[0.34] agent-float-slow"
          style={{ transform: 'translate3d(calc(var(--mx, 0) * 12px), calc(var(--my, 0) * 12px), 0)' }}
        >
          <svg viewBox="0 0 1200 700" className="w-full h-full">
            <defs>
              <linearGradient id="agentBgLine" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#93C5FD" />
                <stop offset="100%" stopColor="#C4B5FD" />
              </linearGradient>
              <radialGradient id="agentCore" cx="50%" cy="50%" r="52%">
                <stop offset="0%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#CBD5E1" />
              </radialGradient>
              <linearGradient id="agentRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#67E8F9" />
                <stop offset="100%" stopColor="#A78BFA" />
              </linearGradient>
            </defs>

            {/* Concentric spotlight circles */}
            <circle cx="740" cy="350" r="350" fill="#94A3B8" opacity="0.16" />
            <circle cx="740" cy="350" r="280" fill="#E2E8F0" opacity="0.17" />
            <circle cx="740" cy="350" r="210" fill="#CBD5E1" opacity="0.18" />

            {/* Soft workflow wedges */}
            <path d="M390 250 L740 350 L390 450 A350 350 0 0 1 390 250Z" fill="#E2E8F0" opacity="0.16" />
            <path d="M530 150 L740 350 L530 550 A280 280 0 0 1 530 150Z" fill="#F1F5F9" opacity="0.14" />

            {/* Left utility blocks */}
            <g opacity="0.74">
              <rect x="260" y="260" width="70" height="70" rx="10" fill="#E5E7EB" />
              <rect x="350" y="215" width="170" height="110" rx="10" fill="#E5E7EB" />
              <rect x="390" y="355" width="80" height="80" rx="10" fill="#E5E7EB" />
              <path d="M285 294m-15 0a15 15 0 1 0 30 0a15 15 0 1 0 -30 0" stroke="#94A3B8" strokeWidth="5" fill="none" />
              <path d="M298 307l14 14" stroke="#94A3B8" strokeWidth="5" strokeLinecap="round" />
              <path d="M368 245h35M368 270h70M368 295h55" stroke="#94A3B8" strokeWidth="5" strokeLinecap="round" />
              <path d="M412 390l-12 12l12 12M448 390l12 12l-12 12" stroke="#94A3B8" strokeWidth="5" strokeLinecap="round" fill="none" />
            </g>

            {/* Simple AI side profile */}
            <path
              d="M732 190
                 C675 194, 632 236, 624 300
                 C620 330, 624 356, 640 383
                 C650 400, 652 417, 645 435
                 C676 431, 701 416, 719 392
                 C733 373, 738 352, 739 333
                 C748 328, 754 321, 754 312
                 C754 303, 748 296, 739 292
                 C738 267, 740 236, 732 190Z"
              fill="#E2E8F0"
              opacity="0.95"
            />
            <circle cx="715" cy="314" r="5" fill="#94A3B8" />

            {/* AI ear/core + circuits */}
            <circle cx="835" cy="332" r="88" fill="url(#agentCore)" opacity="0.95" />
            <circle cx="835" cy="332" r="74" fill="none" stroke="url(#agentRing)" strokeWidth="5" className="agent-ring-spin" />
            <circle cx="835" cy="332" r="55" fill="#64748B" opacity="0.75" />
            <text x="835" y="350" textAnchor="middle" fill="#F8FAFC" fontSize="58" fontWeight="700" style={{ letterSpacing: 1 }}>AI</text>

            <g stroke="url(#agentBgLine)" strokeWidth="3" strokeLinecap="round" className="agent-circuit-pulse" fill="none">
              <path d="M905 298h76" /><circle cx="985" cy="298" r="3" fill="#E2E8F0" />
              <path d="M915 332h100" /><circle cx="1019" cy="332" r="3" fill="#E2E8F0" />
              <path d="M904 368h84" /><circle cx="992" cy="368" r="3" fill="#E2E8F0" />
              <path d="M880 250v-56" /><circle cx="880" cy="190" r="3" fill="#E2E8F0" />
              <path d="M930 265l46-32" /><circle cx="980" cy="230" r="3" fill="#E2E8F0" />
              <path d="M930 399l52 38" /><circle cx="986" cy="440" r="3" fill="#E2E8F0" />
              <path d="M875 414v48" /><circle cx="875" cy="466" r="3" fill="#E2E8F0" />
            </g>
          </svg>
        </div>

        {/* Tiny floating particles */}
        <div
          className="absolute inset-0 opacity-60 dark:opacity-40 agent-float-fast"
          style={{ transform: 'translate3d(calc(var(--mx, 0) * -10px), calc(var(--my, 0) * -10px), 0)' }}
        >
          <svg viewBox="0 0 1200 700" className="w-full h-full">
            <g className="agent-node-pulse" fill="#E2E8F0">
              <circle cx="250" cy="220" r="3" />
              <circle cx="330" cy="160" r="2.5" />
              <circle cx="540" cy="510" r="2.5" />
              <circle cx="960" cy="245" r="3" />
              <circle cx="1010" cy="420" r="2.5" />
            </g>
          </svg>
        </div>
      </div>

      <div className="pointer-events-none absolute -top-20 -left-24 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-violet-400/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-md grid md:grid-cols-2">
        {/* Left panel */}
        <div className="hidden md:flex flex-col justify-between p-8 bg-gradient-to-br from-blue-600 to-violet-600 text-white">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block" />
              Secure workspace access
            </div>
            <h2 className="mt-5 text-2xl font-bold leading-tight">
              Build and run smarter workflows with Flux
            </h2>
            <p className="mt-3 text-sm text-white/85 leading-relaxed">
              Connect your tools, automate repetitive work, and monitor executions in one clean canvas.
            </p>
          </div>

          <div className="space-y-2 text-sm text-white/90">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-white/80" />
              Google Sign-In + owner approval
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-white/80" />
              Private workflows per user
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-white/80" />
              Team-ready automation platform
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="p-7 sm:p-8">
          <div className="flex flex-col items-center gap-3 mb-7">
            <img src="/logo.png" alt="Flux" className="w-16 h-16 rounded-2xl object-contain shadow-md" />
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Welcome to Flux</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Sign in to continue to your automation workspace
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
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 px-3.5 py-3">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              New accounts require <span className="font-semibold text-slate-700 dark:text-slate-200">Platform Owner approval</span> before access is granted.
            </p>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-4">
            By continuing, you agree to your organization&apos;s access policies.
          </p>
        </div>
      </div>
    </div>
  );
}
