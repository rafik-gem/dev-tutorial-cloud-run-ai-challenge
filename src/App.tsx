import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  subscribeToUserInteractions,
  deleteInteraction,
  syncUserProfile,
  updateUserTheme,
} from './firebase';
import type { InteractionDocument, UserProfile, ColorThemeId } from './types';
import { COLOR_THEMES } from './types';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { HistorySidebar } from './components/HistorySidebar';
import { ReflectionStudio } from './components/ReflectionStudio';
import { SecurityModal } from './components/SecurityModal';
import { AdminDashboard } from './components/AdminDashboard';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { MoodDashboardModal } from './components/MoodDashboardModal';
import { ThemeSettingsModal } from './components/ThemeSettingsModal';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authActionLoading, setAuthActionLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [interactions, setInteractions] = useState<InteractionDocument[]>([]);
  const [activeInteraction, setActiveInteraction] = useState<InteractionDocument | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [securityModalOpen, setSecurityModalOpen] = useState<boolean>(false);
  const [adminDashboardOpen, setAdminDashboardOpen] = useState<boolean>(false);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState<boolean>(false);
  const [moodDashboardOpen, setMoodDashboardOpen] = useState<boolean>(false);
  const [themeModalOpen, setThemeModalOpen] = useState<boolean>(false);
  const [isReadingMode, setIsReadingMode] = useState<boolean>(false);
  const [previousSidebarState, setPreviousSidebarState] = useState<boolean>(true);

  // User Color Theme state with localStorage initialization
  const [currentTheme, setCurrentTheme] = useState<ColorThemeId>(() => {
    try {
      const saved = localStorage.getItem('reflectai_theme');
      if (saved && COLOR_THEMES.some((t) => t.id === saved)) {
        return saved as ColorThemeId;
      }
    } catch {}
    return 'midnight-indigo';
  });

  // Apply data-theme attribute on document root and persist to localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    try {
      localStorage.setItem('reflectai_theme', currentTheme);
    } catch {}
  }, [currentTheme]);

  const handleSelectTheme = (themeId: ColorThemeId) => {
    setCurrentTheme(themeId);
    if (user?.uid) {
      updateUserTheme(user.uid, themeId).catch((err) => {
        console.warn('Failed to sync theme to Firestore profile:', err);
      });
    }
  };

  const handleToggleReadingMode = (forced?: boolean) => {
    setIsReadingMode((prev) => {
      const next = typeof forced === 'boolean' ? forced : !prev;
      if (next) {
        setPreviousSidebarState(sidebarOpen);
        setSidebarOpen(false);
      } else {
        setSidebarOpen(previousSidebarState);
      }
      return next;
    });
  };

  // Monitor Firebase Authentication state and sync role profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await syncUserProfile(firebaseUser);
          setUser(profile);
          if (profile.theme && COLOR_THEMES.some((t) => t.id === profile.theme)) {
            setCurrentTheme(profile.theme);
          }
        } catch {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: firebaseUser.email === 'rafikrafik3956@gmail.com' ? 'admin' : 'user',
          });
        }
      } else {
        setUser(null);
        setActiveInteraction(null);
        setInteractions([]);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to user-isolated Firestore interactions
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserInteractions(
      user.uid,
      (items) => {
        setInteractions(items);
        // If an active interaction exists, sync it with updated data
        if (activeInteraction) {
          const updated = items.find((i) => i.id === activeInteraction.id);
          if (updated) {
            setActiveInteraction(updated);
          }
        }
      },
      (err) => {
        console.error('Firestore subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, activeInteraction?.id]);

  const handleSignIn = async () => {
    setAuthActionLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      const code = err?.code || '';
      if (code === 'auth/popup-blocked') {
        setAuthError('The sign-in popup was blocked by your browser. Please allow popups or open this app in a new tab.');
      } else if (code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in was cancelled before completion. Please try again.');
      } else {
        setAuthError(err?.message || 'Failed to authenticate with Google.');
      }
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setActiveInteraction(null);
      setInteractions([]);
    } catch (err: any) {
      console.error('Sign-out failed:', err);
    }
  };

  const handleNewReflection = () => {
    setActiveInteraction(null);
  };

  const handleSelectInteraction = (interaction: InteractionDocument) => {
    setActiveInteraction(interaction);
  };

  const handleInteractionSaved = (interaction: InteractionDocument) => {
    setActiveInteraction(interaction);
  };

  const handleDeleteInteraction = async (id: string) => {
    if (!user) return;
    try {
      await deleteInteraction(user.uid, id);
      if (activeInteraction?.id === id) {
        setActiveInteraction(null);
      }
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert(`Could not delete reflection: ${err?.message || 'Database error'}`);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0C12]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-800 border-t-indigo-500" />
          <span className="text-xs font-medium tracking-wider uppercase text-slate-400">Initializing secure session...</span>
        </div>
      </div>
    );
  }

  const activeThemeObj = COLOR_THEMES.find((t) => t.id === currentTheme) || COLOR_THEMES[0];

  return (
    <div
      id="reflect-ai-root"
      className="relative flex min-h-screen flex-col font-sans text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200 transition-colors duration-300"
      style={{
        backgroundColor: activeThemeObj.bgHex,
      }}
    >
      {/* Immersive ambient gradient glow dynamically customized per theme */}
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% -20%, ${activeThemeObj.glowColor}, transparent)`,
        }}
      />

      <div className="relative z-10 flex flex-col flex-1 min-h-screen">
        <Navbar
          user={user}
          onSignOut={handleSignOut}
          onNewReflection={handleNewReflection}
          onOpenSecurityModal={() => setSecurityModalOpen(true)}
          onOpenAdmin={() => setAdminDashboardOpen(true)}
          onOpenNotifications={() => setNotificationsModalOpen(true)}
          onOpenMoodDashboard={() => setMoodDashboardOpen(true)}
          onOpenThemeModal={() => setThemeModalOpen(true)}
          currentTheme={currentTheme}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          isReadingMode={isReadingMode}
        />

        <main className="flex flex-1 overflow-hidden">
          {user ? (
            <div className="flex flex-1 w-full overflow-hidden">
              {!isReadingMode && (
                <HistorySidebar
                  interactions={interactions}
                  activeInteractionId={activeInteraction?.id || null}
                  onSelectInteraction={handleSelectInteraction}
                  onDeleteInteraction={handleDeleteInteraction}
                  onNewReflection={handleNewReflection}
                  isOpen={sidebarOpen}
                  onClose={() => setSidebarOpen(false)}
                />
              )}

              <ReflectionStudio
                user={user}
                activeInteraction={activeInteraction}
                onInteractionSaved={handleInteractionSaved}
                onDeleteInteraction={handleDeleteInteraction}
                onNewReflection={handleNewReflection}
                onOpenMoodDashboard={() => setMoodDashboardOpen(true)}
                isReadingMode={isReadingMode}
                onToggleReadingMode={handleToggleReadingMode}
              />
            </div>
          ) : (
            <LandingPage
              onSignIn={handleSignIn}
              isLoading={authActionLoading}
              onOpenSecurityModal={() => setSecurityModalOpen(true)}
              authError={authError}
            />
          )}
        </main>
      </div>

      <SecurityModal
        isOpen={securityModalOpen}
        onClose={() => setSecurityModalOpen(false)}
      />

      {adminDashboardOpen && user && (
        <AdminDashboard
          currentUser={user}
          onClose={() => setAdminDashboardOpen(false)}
          interactions={interactions}
        />
      )}

      {user && (
        <NotificationSettingsModal
          isOpen={notificationsModalOpen}
          onClose={() => setNotificationsModalOpen(false)}
          userId={user.uid}
        />
      )}

      {user && (
        <MoodDashboardModal
          isOpen={moodDashboardOpen}
          onClose={() => setMoodDashboardOpen(false)}
          interactions={interactions}
          onSelectInteraction={handleSelectInteraction}
          onNewReflection={handleNewReflection}
          user={user}
        />
      )}

      <ThemeSettingsModal
        isOpen={themeModalOpen}
        onClose={() => setThemeModalOpen(false)}
        currentTheme={currentTheme}
        onSelectTheme={handleSelectTheme}
      />
    </div>
  );
}
