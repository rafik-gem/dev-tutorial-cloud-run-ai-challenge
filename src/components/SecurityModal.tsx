import React from 'react';
import { X, ShieldCheck, Lock, Key, Layers, Database } from 'lucide-react';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      id="security-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="security-modal-card"
        className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0E111C] p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950/80 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-white">
                Security Architecture & Threat Controls
              </h3>
              <p className="text-xs text-slate-400">
                Production-grade multi-tenant data isolation and resilience
              </p>
            </div>
          </div>
          <button
            id="close-security-modal"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section 1: User Data Isolation in Firestore */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            <span>1. Firestore User Data Isolation Rules</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            All user reflections are stored under the subcollection{' '}
            <code className="rounded bg-slate-800/80 px-1 py-0.5 font-mono text-indigo-300 border border-slate-700/50">
              /users/{'{userId}'}/interactions/{'{interactionId}'}
            </code>
            . Zero insecure defaults are permitted; only the authenticated owner can access:
          </p>
          <pre className="rounded-xl bg-[#07090E] border border-slate-800 p-3.5 font-mono text-[11px] text-indigo-200 overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}`}
          </pre>
        </div>

        {/* Section 2: Secret Management & Zero-Hardcoding */}
        <div className="space-y-2 border-t border-slate-800/70 pt-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200">
            <Key className="h-3.5 w-3.5 text-amber-400" />
            <span>2. Zero Hardcoded Credentials & Server-Side Proxy</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The Gemini API key is never exposed to the client browser. All generation requests are proxied through an internal Express endpoint (
            <code className="font-mono text-indigo-300 text-[11px] bg-slate-800/80 px-1 py-0.5 rounded border border-slate-700/50">/api/gemini/reflect</code>
            ) backed by runtime environment variables and Secret Manager.
          </p>
        </div>

        {/* Section 3: Gemini Model Resilience Ladder */}
        <div className="space-y-2 border-t border-slate-800/70 pt-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200">
            <Layers className="h-3.5 w-3.5 text-indigo-400" />
            <span>3. Resilient Model Fallback Ladder</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Calls are resilient against transient service outages (`503`, `429`, `500`) by cascading across:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-slate-800 bg-[#141724] p-2.5">
              <span className="font-semibold text-slate-200">Primary:</span>
              <p className="font-mono text-[11px] text-indigo-400 mt-0.5">gemini-3.6-flash</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#141724] p-2.5">
              <span className="font-semibold text-slate-200">High-Availability Fallback:</span>
              <p className="font-mono text-[11px] text-indigo-400 mt-0.5">gemini-3.1-flash-lite</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#141724] p-2.5">
              <span className="font-semibold text-slate-200">Dynamic Alias:</span>
              <p className="font-mono text-[11px] text-indigo-400 mt-0.5">gemini-flash-latest</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#141724] p-2.5">
              <span className="font-semibold text-slate-200">Deep Reasoning Fallback:</span>
              <p className="font-mono text-[11px] text-indigo-400 mt-0.5">gemini-3.7-flash</p>
            </div>
          </div>
        </div>

        {/* Section 4: Payload Sanitization & Undefined Stripping */}
        <div className="space-y-2 border-t border-slate-800/70 pt-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200">
            <Database className="h-3.5 w-3.5 text-purple-400" />
            <span>4. Strict Undefined-Stripping & Transaction Guarantee</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Objects undergo recursive undefined-sanitization before reaching the Firestore driver to prevent runtime schema crashes. If persistence fails, the UI retains user input and displays a retry banner so that no user work is lost.
          </p>
        </div>

        <div className="border-t border-slate-800 pt-4 text-right">
          <button
            id="dismiss-security-modal"
            onClick={onClose}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-xs font-semibold text-white hover:from-indigo-600 hover:to-purple-700 shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
