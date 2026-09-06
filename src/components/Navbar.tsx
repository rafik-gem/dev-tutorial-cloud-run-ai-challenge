import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  LogOut,
  PlusCircle,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  ShieldAlert,
  TrendingUp,
  Palette,
} from 'lucide-react';
import type { UserProfile, ColorThemeId } from '../types';
import { COLOR_THEMES } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  onSignOut: () => void;
  onNewReflection: () => void;
  onOpenSecurityModal: () => void;
  onOpenAdmin?: () => void;
  onOpenNotifications?: () => void;
  onOpenMoodDashboard?: () => void;
  onOpenThemeModal?: () => void;
  currentTheme?: ColorThemeId;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isReadingMode?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onSignOut,
  onNewReflection,
  onOpenSecurityModal,
  onOpenAdmin,
  onOpenNotifications,
  onOpenMoodDashboard,
  onOpenThemeModal,
  currentTheme = 'midnight-indigo',
  sidebarOpen,
  onToggleSidebar,
  isReadingMode = false,
}) => {
  const isAdmin = user?.role === 'admin' || user?.email === 'rafikrafik3956@gmail.com';
  const activeThemeObj = COLOR_THEMES.find((t) => t.id === currentTheme) || COLOR_THEMES[0];

  return (
    <header
      id="app-navbar"
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800/80 bg-[#0A0C12]/80 px-4 backdrop-blur-md transition-all sm:px-6"
    >
      <div className="flex items-center gap-3">
        {user && !isReadingMode && (
          <button
            id="toggle-sidebar-button"
            onClick={onToggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-[#12151F] text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-slate-200 hover:border-slate-700 focus:outline-none cursor-pointer"
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
              {isReadingMode ? (
                <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-950/40 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                  <BookOpen className="h-3 w-3 text-amber-400" />
                  <span>Reading Mode</span>
                </span>
              ) : (
                <span className="hidden items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-950/40 px-2.5 py-0.5 text-xs font-medium text-indigo-300 sm:inline-flex">
                  <Sparkles className="h-3 w-3 text-indigo-400" />
                  Gemini 3.6 Flash
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {user ? (
          <>
            {/* RBAC Admin Trigger */}
            {isAdmin && onOpenAdmin && (
              <button
                id="admin-dashboard-button"
                onClick={onOpenAdmin}
                className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-950/40 px-2.5 py-1.5 text-xs font-semibold text-purple-300 transition-all hover:bg-purple-900/50 hover:border-purple-500/50 shadow-sm"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-purple-400" />
                <span>Admin RBAC</span>
              </button>
            )}

            {/* Notification Webhooks */}
            {onOpenNotifications && (
              <button
                id="notifications-settings-button"
                onClick={onOpenNotifications}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#12151F] text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-slate-200"
                title="External Notifications"
                aria-label="External Notifications"
              >
                <Bell className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Mood Dashboard Trigger */}
            {onOpenMoodDashboard && (
              <button
                id="mood-dashboard-button"
                onClick={onOpenMoodDashboard}
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/40 px-2.5 py-1.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-900/50 hover:border-amber-500/50 shadow-xs cursor-pointer"
                title="Weekly Mood Trend & Analytics Dashboard"
              >
                <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Mood Trends</span>
              </button>
            )}

            {/* Theme Settings Button */}
            {onOpenThemeModal && (
              <button
                id="theme-settings-button"
                onClick={onOpenThemeModal}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#12151F] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white hover:border-slate-700 cursor-pointer shadow-xs"
                title={`Active Theme: ${activeThemeObj.name} (Click to customize)`}
                aria-label="Customize color theme"
              >
                <div className="relative flex items-center justify-center">
                  <Palette className="h-3.5 w-3.5 text-slate-400" />
                  <span
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full border border-black/40 shadow-xs"
                    style={{ backgroundColor: activeThemeObj.accentHex }}
                  />
                </div>
                <span className="hidden md:inline text-slate-300 text-xs">
                  {activeThemeObj.fontBadge}
                </span>
              </button>
            )}

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

            <div className="h-5 w-px bg-slate-800 mx-0.5" />

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
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-200 leading-tight">
                    {user.displayName || 'Journalist'}
                  </span>
                  {isAdmin && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded">
                      ADMIN
                    </span>
                  )}
                </div>
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
          <div className="flex items-center gap-2">
            {onOpenThemeModal && (
              <button
                id="landing-theme-settings-button"
                onClick={onOpenThemeModal}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#12151F] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white hover:border-slate-700 cursor-pointer shadow-xs"
                title={`Active Theme: ${activeThemeObj.name} (Click to customize)`}
                aria-label="Customize color theme"
              >
                <div className="relative flex items-center justify-center">
                  <Palette className="h-3.5 w-3.5 text-slate-400" />
                  <span
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full border border-black/40 shadow-xs"
                    style={{ backgroundColor: activeThemeObj.accentHex }}
                  />
                </div>
                <span className="text-slate-300 text-xs">
                  {activeThemeObj.fontBadge}
                </span>
              </button>
            )}
            <button
              id="nav-security-link"
              onClick={onOpenSecurityModal}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#12151F] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white hover:border-slate-700"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Architecture & Security</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

