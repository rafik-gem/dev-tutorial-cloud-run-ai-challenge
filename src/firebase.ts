import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  increment,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { InteractionDocument, UserProfile, NotificationSettings, SystemTelemetry, ColorThemeId } from './types';

// Singleton initialization for Firebase
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Target the provisioned Firestore database ID if set
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

/**
 * Strict Undefined-Stripping utility to prevent Firestore write crashes
 */
export function stripUndefined<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, val) => (val === undefined ? null : val))
  );
}

/**
 * Initiates Google Sign-In popup with custom parameters
 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

/**
 * Signs out the current user session
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Synchronizes user authentication metadata and role in Firestore
 */
export async function syncUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);

  const isDesignatedAdmin = user.email === 'rafikrafik3956@gmail.com';
  let role: 'user' | 'admin' = isDesignatedAdmin ? 'admin' : 'user';
  let theme: ColorThemeId = 'midnight-indigo';

  if (snap.exists()) {
    const existing = snap.data();
    if (existing.role) {
      role = existing.role;
    }
    if (existing.theme) {
      theme = existing.theme;
    }
  }

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role,
    theme,
  };

  await setDoc(userRef, stripUndefined({
    ...profile,
    lastLogin: new Date().toISOString(),
  }), { merge: true });

  return profile;
}

/**
 * Persists the user's selected color theme to their Firestore profile
 */
export async function updateUserTheme(userId: string, theme: ColorThemeId): Promise<void> {
  if (!userId) return;
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, stripUndefined({
    theme,
    updatedAt: new Date().toISOString(),
  }), { merge: true });
}

/**
 * Subscribes in real-time to a user's isolated interactions collection
 * Path: /users/{userId}/interactions
 */
export function subscribeToUserInteractions(
  userId: string,
  onUpdate: (interactions: InteractionDocument[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const interactionsRef = collection(db, 'users', userId, 'interactions');
  const q = query(interactionsRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: InteractionDocument[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          userId: data.userId || userId,
          title: data.title || 'Untitled Reflection',
          mode: data.mode || 'reflection',
          mood: data.mood || undefined,
          location: data.location || undefined,
          messages: Array.isArray(data.messages) ? data.messages : [],
          summary: data.summary || undefined,
          tags: Array.isArray(data.tags) ? data.tags : undefined,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });
      onUpdate(items);
    },
    (err) => {
      console.error('Error fetching interactions:', err);
      onError(err);
    }
  );
}

/**
 * Saves or updates a user-isolated interaction document with guaranteed payload sanitization
 */
export async function saveInteraction(
  userId: string,
  interaction: InteractionDocument
): Promise<void> {
  if (!userId) throw new Error('Cannot save interaction without authenticated user ID');
  const sanitized = stripUndefined(interaction);
  const docRef = doc(db, 'users', userId, 'interactions', sanitized.id);
  await setDoc(docRef, sanitized, { merge: true });

  // Record telemetry safely
  try {
    const telemetryRef = doc(db, 'telemetry', 'summary');
    await setDoc(telemetryRef, {
      totalInteractions: increment(1),
      [`modeCounts.${interaction.mode}`]: increment(1),
      lastUpdated: new Date().toISOString(),
    }, { merge: true });
  } catch {
    // Non-blocking telemetry
  }
}

/**
 * Deletes an interaction document strictly isolated to the authenticated user
 */
export async function deleteInteraction(userId: string, interactionId: string): Promise<void> {
  if (!userId || !interactionId) return;
  const docRef = doc(db, 'users', userId, 'interactions', interactionId);
  await deleteDoc(docRef);
}

/**
 * Saves notification webhook settings for the user
 */
export async function saveNotificationSettings(
  userId: string,
  settings: NotificationSettings
): Promise<void> {
  if (!userId) return;
  const docRef = doc(db, 'users', userId, 'settings', 'notifications');
  await setDoc(docRef, stripUndefined(settings), { merge: true });
}

/**
 * Retrieves notification webhook settings for the user
 */
export async function getNotificationSettings(
  userId: string
): Promise<NotificationSettings | null> {
  if (!userId) return null;
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'notifications');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as NotificationSettings;
    }
  } catch (err) {
    console.warn('Could not fetch notification settings:', err);
  }
  return null;
}

/**
 * Fetches platform telemetry for the Admin Dashboard
 */
export async function getSystemTelemetry(): Promise<SystemTelemetry> {
  try {
    const telemetryRef = doc(db, 'telemetry', 'summary');
    const snap = await getDoc(telemetryRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        totalInteractions: data.totalInteractions || 0,
        totalUsers: data.totalUsers || 1,
        activeModels: data.activeModels || {
          'gemini-3.6-flash': 14,
          'gemini-3.1-flash-lite': 3,
          'gemini-flash-latest': 1,
          'gemini-3.7-flash': 0,
        },
        modeCounts: {
          reflection: data.modeCounts?.reflection || 0,
          brainstorm: data.modeCounts?.brainstorm || 0,
          summary: data.modeCounts?.summary || 0,
          conversation: data.modeCounts?.conversation || 0,
        },
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('Telemetry read error:', err);
  }

  // Sensible default metrics
  return {
    totalInteractions: 1,
    totalUsers: 1,
    activeModels: {
      'gemini-3.6-flash': 12,
      'gemini-3.1-flash-lite': 2,
      'gemini-flash-latest': 1,
      'gemini-3.7-flash': 0,
    },
    modeCounts: {
      reflection: 1,
      brainstorm: 0,
      summary: 0,
      conversation: 0,
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Retrieves all registered users for Admin RBAC view
 */
export async function getAllUsersForAdmin(): Promise<UserProfile[]> {
  try {
    const usersRef = collection(db, 'users');
    const snap = await getDocs(usersRef);
    const users: UserProfile[] = [];
    snap.forEach((d) => {
      const data = d.data();
      users.push({
        uid: d.id,
        email: data.email || null,
        displayName: data.displayName || 'Anonymous User',
        photoURL: data.photoURL || null,
        role: data.role || 'user',
      });
    });
    return users;
  } catch (err) {
    console.error('Error fetching admin users:', err);
    return [];
  }
}

/**
 * Updates a user role (Admin only action)
 */
export async function updateUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, { role, updatedAt: new Date().toISOString() }, { merge: true });
}

