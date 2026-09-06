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
  theme?: ColorThemeId;
}

export type ColorThemeId =
  | 'midnight-indigo'
  | 'midnight-blue'
  | 'forest-green'
  | 'amethyst-twilight'
  | 'obsidian-amber';

export interface ColorTheme {
  id: ColorThemeId;
  name: string;
  tagline: string;
  description: string;
  accentLabel: string;
  bgHex: string;
  surfaceHex: string;
  accentHex: string;
  glowColor: string;
  borderHex: string;
  fontBadge: string;
  swatchColors: [string, string, string]; // bg, surface, accent
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'midnight-indigo',
    name: 'Midnight Indigo',
    tagline: 'Deep Cosmic Twilight',
    description: 'The signature ReflectAI atmosphere with deep cosmic indigo, violet nebulae, and stellar clarity.',
    accentLabel: 'Indigo & Violet',
    bgHex: '#0A0C12',
    surfaceHex: '#121522',
    accentHex: '#6366f1',
    glowColor: 'rgba(99, 102, 241, 0.18)',
    borderHex: '#272b3b',
    fontBadge: 'Cosmic',
    swatchColors: ['#0A0C12', '#121522', '#6366f1'],
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    tagline: 'Oceanic Sapphire Abyss',
    description: 'Deep nocturnal blue depths inspired by quiet bioluminescent ocean trenches and arctic night skies.',
    accentLabel: 'Sapphire & Cyan',
    bgHex: '#060B14',
    surfaceHex: '#0D172A',
    accentHex: '#0ea5e9',
    glowColor: 'rgba(14, 165, 233, 0.20)',
    borderHex: '#1b2c4d',
    fontBadge: 'Oceanic',
    swatchColors: ['#060B14', '#0D172A', '#0ea5e9'],
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    tagline: 'Evergreen Woodland Night',
    description: 'Earthy, grounding canopy greens with mossy shadows, cedar mist, and serene woodland calm.',
    accentLabel: 'Emerald & Sage',
    bgHex: '#06120D',
    surfaceHex: '#0D2118',
    accentHex: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.19)',
    borderHex: '#193c2e',
    fontBadge: 'Woodland',
    swatchColors: ['#06120D', '#0D2118', '#10b981'],
  },
  {
    id: 'amethyst-twilight',
    name: 'Amethyst Twilight',
    tagline: 'Mystic Plum & Lavender',
    description: 'Dreamlike twilight violet and amethyst minerals for philosophical, introspective reflection.',
    accentLabel: 'Amethyst & Fuchsia',
    bgHex: '#0E0817',
    surfaceHex: '#1B112D',
    accentHex: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.19)',
    borderHex: '#352157',
    fontBadge: 'Mystic',
    swatchColors: ['#0E0817', '#1B112D', '#a855f7'],
  },
  {
    id: 'obsidian-amber',
    name: 'Obsidian Amber',
    tagline: 'Volcanic Warm Hearth',
    description: 'Rich volcanic charcoal with warm amber embers, hearth fires, and organic bronze undertones.',
    accentLabel: 'Amber & Bronze',
    bgHex: '#100D09',
    surfaceHex: '#1E1912',
    accentHex: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.18)',
    borderHex: '#3e3020',
    fontBadge: 'Hearth',
    swatchColors: ['#100D09', '#1E1912', '#f59e0b'],
  },
];

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

