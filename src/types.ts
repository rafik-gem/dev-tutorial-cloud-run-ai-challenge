export type ReflectionMode = 'reflection' | 'brainstorm' | 'summary' | 'conversation';

export interface InteractionMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

export interface InteractionDocument {
  id: string;
  userId: string;
  title: string;
  mode: ReflectionMode;
  messages: InteractionMessage[];
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
