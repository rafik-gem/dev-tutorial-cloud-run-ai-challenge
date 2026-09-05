import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  subscribeToUserInteractions,
  deleteInteraction,
} from './firebase';
import type { InteractionDocument, UserProfile } from './types';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { HistorySidebar } from './components/HistorySidebar';
import { ReflectionStudio } from './components/ReflectionStudio';
import { SecurityModal } from './components/SecurityModal';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authActionLoading, setAuthActionLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [interactions, setInteractions] = useState<InteractionDocument[]>([]);
  const [activeInteraction, setActiveInteraction] = useState<InteractionDocument | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [securityModalOpen, setSecurityModalOpen] = useState<boolean>(false);

  // Monitor Firebase Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
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

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0A0C12] font-sans text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Immersive ambient gradient glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.15),transparent)] pointer-events-none z-0" />

      <div className="relative z-10 flex flex-col flex-1 min-h-screen">
        <Navbar
          user={user}
          onSignOut={handleSignOut}
          onNewReflection={handleNewReflection}
          onOpenSecurityModal={() => setSecurityModalOpen(true)}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        <main className="flex flex-1 overflow-hidden">
          {user ? (
            <div className="flex flex-1 w-full overflow-hidden">
              <HistorySidebar
                interactions={interactions}
                activeInteractionId={activeInteraction?.id || null}
                onSelectInteraction={handleSelectInteraction}
                onDeleteInteraction={handleDeleteInteraction}
                onNewReflection={handleNewReflection}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
              />

              <ReflectionStudio
                user={user}
                activeInteraction={activeInteraction}
                onInteractionSaved={handleInteractionSaved}
                onDeleteInteraction={handleDeleteInteraction}
                onNewReflection={handleNewReflection}
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
    </div>
  );
}
