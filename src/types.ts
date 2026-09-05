export type ReflectionMode = 'reflection' | 'brainstorm' | 'summary' | 'conversation';

export interface JournalLocation {
  placeId?: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
}

export type MoodId = 'serene' | 'grateful' | 'reflective' | 'energized' | 'anxious' | 'exhausted';

export interface JournalMood {
  id: MoodId;
  label: string;
  emoji: string;
  score: number; // 1 to 5 numeric scale
}

export const JOURNAL_MOODS: JournalMood[] = [
  { id: 'serene', label: 'Serene', emoji: '🌿', score: 5 },
  { id: 'grateful', label: 'Grateful', emoji: '✨', score: 5 },
  { id: 'energized', label: 'Energized', emoji: '⚡', score: 4 },
  { id: 'reflective', label: 'Reflective', emoji: '🌊', score: 3 },
  { id: 'anxious', label: 'Anxious', emoji: '🌪️', score: 2 },
  { id: 'exhausted', label: 'Exhausted', emoji: '🕯️', score: 1 },
];

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
  mood?: JournalMood;
  location?: JournalLocation;
  messages: InteractionMessage[];
  summary?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: 'user' | 'admin';
}

export interface NotificationSettings {
  webhookUrl: string;
  enabled: boolean;
  platform: 'discord' | 'slack' | 'custom';
  notifyOnModes: ReflectionMode[];
}

export interface SystemTelemetry {
  totalInteractions: number;
  totalUsers: number;
  activeModels: Record<string, number>;
  modeCounts: Record<ReflectionMode, number>;
  lastUpdated: string;
}

