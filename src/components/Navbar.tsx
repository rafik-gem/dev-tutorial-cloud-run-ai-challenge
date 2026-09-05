import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  LogOut,
  PlusCircle,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  onSignOut: () => void;
  onNewReflection: () => void;
  onOpenSecurityModal: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onSignOut,
  onNewReflection,
  onOpenSecurityModal,
  sidebarOpen,
  onToggleSidebar,
}) => {
  return (
    <header
      id="app-navbar"
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800/80 bg-[#0A0C12]/80 px-4 backdrop-blur-md transition-all sm:px-6"
    >
      <div className="flex items-center gap-3">
        {user && (
          <button
            id="toggle-sidebar-button"
            onClick={onToggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-[#12151F] text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-slate-200 hover:border-slate-700 focus:outline-none"
            title={sidebarOpen ? 'Hide History' : 'Show History'}
            aria-label="Toggle history panel"
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-semibold tracking-tight text-white">
                ReflectAI
              </span>
              <span className="hidden items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-950/40 px-2.5 py-0.5 text-xs font-medium text-indigo-300 sm:inline-flex">
                <Sparkles className="h-3 w-3 text-indigo-400" />
                Gemini 3.6 Flash
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {user ? (
          <>
            <button
              id="security-info-button"
              onClick={onOpenSecurityModal}
              className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-900/40 hover:border-emerald-500/40 sm:flex"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>User Isolated</span>
            </button>

            <button
              id="new-reflection-button"
              onClick={onNewReflection}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:from-indigo-600 hover:to-purple-700 hover:shadow-indigo-500/30"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>New Entry</span>
            </button>

            <div className="h-5 w-px bg-slate-800 mx-1" />

            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="h-8 w-8 rounded-full border border-slate-700 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}

              <div className="hidden flex-col sm:flex text-left">
                <span className="text-xs font-semibold text-slate-200 leading-tight">
                  {user.displayName || 'Journalist'}
                </span>
                <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                  {user.email}
                </span>
              </div>

              <button
                id="sign-out-button"
                onClick={onSignOut}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#12151F] text-slate-400 transition-colors hover:bg-red-950/40 hover:text-red-400 hover:border-red-900/50 ml-1"
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        ) : (
          <button
            id="nav-security-link"
            onClick={onOpenSecurityModal}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#12151F] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white hover:border-slate-700"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Architecture & Security</span>
          </button>
        )}
      </div>
    </header>
  );
};
