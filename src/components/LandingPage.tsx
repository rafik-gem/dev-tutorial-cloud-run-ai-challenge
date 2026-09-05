import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  Lock,
  MessageSquare,
  History,
  Compass,
  ArrowRight,
  Database,
  KeyRound,
} from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  isLoading: boolean;
  onOpenSecurityModal: () => void;
  authError: string | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  isLoading,
  onOpenSecurityModal,
  authError,
}) => {
  return (
    <div id="landing-page-container" className="min-h-[calc(100vh-4rem)] bg-transparent py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="mx-auto max-w-4xl w-full">
        {/* Main Immersive Banner */}
        <div className="relative rounded-2xl border border-slate-800/80 bg-[#0D101A]/90 backdrop-blur-xl p-8 sm:p-12 shadow-2xl shadow-indigo-950/30 overflow-hidden transition-all">
          {/* Subtle ambient light glows */}
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-3.5 py-1 text-xs font-medium text-indigo-300 mb-6 shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Isolated Firestore & Firebase Authentication</span>
            </div>

            <h1 className="font-serif text-3xl font-bold tracking-tight text-white sm:text-5xl max-w-2xl leading-tight">
              Mindful journaling, deepened by{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Gemini AI
              </span>
              .
            </h1>

            <p className="mt-4 text-base text-slate-300 sm:text-lg max-w-2xl leading-relaxed">
              Express your daily thoughts, struggles, ideas, and reflections in a private space.
              Receive empathetic validation, structured summaries, and creative brainstorming
              without compromising your privacy.
            </p>

            {authError && (
              <div
                id="auth-error-banner"
                className="mt-6 w-full max-w-md rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-200 text-left backdrop-blur-sm"
              >
                <div className="flex items-center gap-2 font-semibold mb-1 text-red-300">
                  <Lock className="h-4 w-4 text-red-400" />
                  <span>Authentication Error</span>
                </div>
                <p>{authError}</p>
                <p className="mt-1 text-slate-400 text-[11px]">
                  If popups are restricted in this preview frame, ensure popups are allowed or open the application in a new tab.
                </p>
              </div>
            )}

            {/* Google Sign-In Action */}
            <div className="mt-8 flex flex-col items-center gap-3 w-full max-w-xs">
              <button
                id="google-signin-button"
                onClick={onSignIn}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-[#161B2B] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/40 transition-all hover:bg-[#1E2438] hover:border-indigo-500/50 hover:shadow-indigo-500/10 focus:ring-2 focus:ring-indigo-500/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              <span className="text-xs text-slate-400">
                Federated OAuth Identity &bull; No passwords stored
              </span>
            </div>
          </div>

          {/* Value Pillars Grid */}
          <div className="relative z-10 mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3 border-t border-slate-800/80 pt-10 text-left">
            <div className="flex flex-col gap-2.5 rounded-xl border border-slate-800/60 bg-[#121624]/60 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/60 border border-indigo-500/20 text-indigo-400">
                <Lock className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Owner-Bound Isolation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Stored under <code className="font-mono text-indigo-300 text-[11px] bg-indigo-950/60 px-1 py-0.5 rounded border border-indigo-800/40">/users/{'{userId}'}/interactions</code>.
                Firestore security rules strictly prevent cross-user document access.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 rounded-xl border border-slate-800/60 bg-[#121624]/60 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/60 border border-indigo-500/20 text-indigo-400">
                <Sparkles className="h-4 w-4 text-indigo-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Gemini 3.6 Flash Intelligence</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Multi-turn reflections with high-availability fallback ladders ensuring reliable, low-latency insights and summaries.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 rounded-xl border border-slate-800/60 bg-[#121624]/60 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/60 border border-indigo-500/20 text-indigo-400">
                <History className="h-4 w-4 text-indigo-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Durable Session History</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                All prompts, multi-turn dialogues, and generated takeaways are safely preserved for ongoing personal reference.
              </p>
            </div>
          </div>
        </div>

        {/* Security and Architecture Note */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-slate-800/80 bg-[#0D101A]/60 p-4 text-xs text-slate-400 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-400" />
            <span>Provisioned Cloud Firestore &bull; Zero hardcoded secrets &bull; Server-proxied AI generation</span>
          </div>
          <button
            id="open-security-details-button"
            onClick={onOpenSecurityModal}
            className="flex items-center gap-1 font-medium text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
          >
            <span>Inspect Threat Model & Rules</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
