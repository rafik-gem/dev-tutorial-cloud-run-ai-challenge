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
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { InteractionDocument } from './types';

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
          messages: Array.isArray(data.messages) ? data.messages : [],
          summary: data.summary || undefined,
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
}

/**
 * Deletes an interaction document strictly isolated to the authenticated user
 */
export async function deleteInteraction(userId: string, interactionId: string): Promise<void> {
  if (!userId || !interactionId) return;
  const docRef = doc(db, 'users', userId, 'interactions', interactionId);
  await deleteDoc(docRef);
}
