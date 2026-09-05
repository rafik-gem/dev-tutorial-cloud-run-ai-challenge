import React from 'react';
import {
  X,
  TrendingUp,
  Sparkles,
  Heart,
  Compass,
  ArrowRight,
} from 'lucide-react';
import type { InteractionDocument, UserProfile } from '../types';
import { MoodTrendGraph } from './MoodTrendGraph';

interface MoodDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  interactions: InteractionDocument[];
  onSelectInteraction: (interaction: InteractionDocument) => void;
  onNewReflection: () => void;
  user: UserProfile | null;
}

export const MoodDashboardModal: React.FC<MoodDashboardModalProps> = ({
  isOpen,
  onClose,
  interactions,
  onSelectInteraction,
  onNewReflection,
  user,
}) => {
  if (!isOpen) return null;

  const entriesWithMood = interactions.filter((i) => i.mood);

  return (
    <div
      id="mood-dashboard-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">
                  Mood & Emotional Health Dashboard
                </h2>
                <span className="hidden sm:inline-flex rounded-full border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  {entriesWithMood.length} Logged Entries
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Visualize weekly emotional vitality, mood spectrum distributions, and reflective cadence.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="mood-modal-new-entry-btn"
              onClick={() => {
                onClose();
                onNewReflection();
              }}
              className="hidden sm:flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Log Mood Today</span>
            </button>
            <button
              id="close-mood-dashboard-btn"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              aria-label="Close Mood Dashboard"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Dashboard Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar">
          {/* Main Visualization Component */}
          <MoodTrendGraph
            interactions={interactions}
            onSelectInteraction={(item) => {
              onSelectInteraction(item);
              onClose();
            }}
          />

          {/* Reflection & Mental Fitness Guidance Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="rounded-xl border border-slate-800/80 bg-[#121522]/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-1.5">
                <Heart className="h-3.5 w-3.5 text-rose-400" />
                <span>Emotional Awareness</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Recording your mood alongside deep writing helps correlate daily stress factors with cognitive clarity.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-[#121522]/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-1.5">
                <Compass className="h-3.5 w-3.5 text-indigo-400" />
                <span>Intent Mode Pairing</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                When energy is 1–2/5, switch to <strong>Synthesis</strong> or <strong>Summary</strong> mode for gentle processing. When 4–5/5, explore <strong>Brainstorm</strong> mode.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-[#121522]/70 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>Write With Gemini</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ReflectAI will attune its empathy and question depth based on your active mood rating.
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onNewReflection();
                }}
                className="mt-2 flex items-center justify-between text-xs text-amber-300 hover:text-amber-200 font-medium group"
              >
                <span>Open Reflection Studio</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-900/90 px-6 py-3 text-xs text-slate-400">
          <span>Data securely stored in user-isolated Firestore</span>
          <button
            id="dismiss-mood-dashboard-btn"
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-800/60 px-4 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
