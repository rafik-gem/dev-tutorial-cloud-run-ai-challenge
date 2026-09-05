import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  Send,
  RefreshCw,
  Copy,
  Check,
  Compass,
  Lightbulb,
  FileText,
  MessageCircle,
  AlertCircle,
  Clock,
  User as UserIcon,
  Bot,
  Trash2,
  Share2,
  MapPin,
  Download,
  Mic,
  MicOff,
  TrendingUp,
  BookOpen,
  Minimize2,
  Type,
  ArrowLeft,
} from 'lucide-react';
import type {
  InteractionDocument,
  InteractionMessage,
  ReflectionMode,
  UserProfile,
  JournalLocation,
  JournalMood,
} from '../types';
import { JOURNAL_MOODS } from '../types';
import { saveInteraction, stripUndefined, getNotificationSettings } from '../firebase';
import { LocationPickerModal } from './LocationPickerModal';

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface ReflectionStudioProps {
  user: UserProfile;
  activeInteraction: InteractionDocument | null;
  onInteractionSaved: (interaction: InteractionDocument) => void;
  onDeleteInteraction: (id: string) => void;
  onNewReflection: () => void;
  onOpenMoodDashboard?: () => void;
  isReadingMode?: boolean;
  onToggleReadingMode?: (active?: boolean) => void;
}

const MODES: { id: ReflectionMode; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  {
    id: 'reflection',
    label: 'Deep Reflection',
    icon: Compass,
    description: 'Empathetic validation, emotional themes & constructive inquiries',
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm Ideas',
    icon: Lightbulb,
    description: 'Creative angles, actionable pathways & strategic solutions',
  },
  {
    id: 'summary',
    label: 'Executive Summary',
    icon: FileText,
    description: 'Structured distillation: Core themes, insights & next steps',
  },
  {
    id: 'conversation',
    label: 'Freeform Dialogue',
    icon: MessageCircle,
    description: 'Multi-turn conversational exploration with Gemini',
  },
];

const SUGGESTED_PROMPTS: Record<ReflectionMode, string[]> = {
  reflection: [
    'I had a challenging moment today and felt overwhelmed...',
    'Today something unexpectedly made me grateful and grounded...',
    'I am wrestling with a decision and want to inspect my doubts...',
  ],
  brainstorm: [
    'How can I structure a 30-day focus sprint on my new project?',
    'Brainstorm creative rituals to start my morning with clarity...',
    'Give me 5 unconventional solutions to overcome creative block...',
  ],
  summary: [
    'Here are my scattered meeting and journal notes from today...',
    'Summarize this week\'s accomplishments and highlight blockers...',
    'Distill key lessons from my latest retrospective thoughts...',
  ],
  conversation: [
    'What do you think is the link between consistency and rest?',
    'Let\'s explore mental models for balancing urgency vs importance...',
    'Help me unpack why I procrastinated on this specific task...',
  ],
};

export const ReflectionStudio: React.FC<ReflectionStudioProps> = ({
  user,
  activeInteraction,
  onInteractionSaved,
  onDeleteInteraction,
  onNewReflection,
  onOpenMoodDashboard,
  isReadingMode,
  onToggleReadingMode,
}) => {
  const [mode, setMode] = useState<ReflectionMode>(activeInteraction?.mode || 'reflection');
  const [mood, setMood] = useState<JournalMood | undefined>(activeInteraction?.mood);
  const [title, setTitle] = useState<string>(activeInteraction?.title || '');
  const [location, setLocation] = useState<JournalLocation | undefined>(activeInteraction?.location);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [pendingRetryInteraction, setPendingRetryInteraction] = useState<InteractionDocument | null>(null);

  // Distraction-Free Reading Mode State
  const [localReadingMode, setLocalReadingMode] = useState<boolean>(false);
  const readingModeActive = typeof isReadingMode === 'boolean' ? isReadingMode : localReadingMode;
  const [readingFontSize, setReadingFontSize] = useState<'normal' | 'large' | 'xl'>('large');
  const [readingFontFamily, setReadingFontFamily] = useState<'serif' | 'sans'>('serif');

  const toggleReading = (target?: boolean) => {
    if (onToggleReadingMode) {
      onToggleReadingMode(target);
    } else {
      setLocalReadingMode((prev) => (typeof target === 'boolean' ? target : !prev));
    }
  };

  // Keyboard shortcut listener for Escape key to exit reading mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && readingModeActive) {
        toggleReading(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readingModeActive, onToggleReadingMode]);

  // Web Speech API Voice Dictation State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseTextRef = useRef<string>('');
  const finalSpeechRef = useRef<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check browser Web Speech API availability on mount
  useEffect(() => {
    const hasSpeech =
      typeof window !== 'undefined' &&
      Boolean(
        (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
      );
    setIsSpeechSupported(hasSpeech);
  }, []);

  // Stop voice dictation and clean up on entry change or component unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup errors
        }
        recognitionRef.current = null;
      }
      setIsListening(false);
    };
  }, [activeInteraction?.id]);

  const stopVoiceDictation = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const startVoiceDictation = () => {
    setSpeechError(null);

    const SpeechConstructor =
      typeof window !== 'undefined'
        ? ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
           (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition)
        : null;

    if (!SpeechConstructor) {
      setSpeechError('Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

      // Capture pre-existing text before speech begins
      baseTextRef.current = inputText;
      finalSpeechRef.current = '';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interimTranscript = '';
        let newlyFinalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            newlyFinalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        if (newlyFinalTranscript) {
          finalSpeechRef.current += (finalSpeechRef.current ? ' ' : '') + newlyFinalTranscript.trim();
        }

        const base = baseTextRef.current.trim();
        const finalChunk = finalSpeechRef.current.trim();
        const interimChunk = interimTranscript.trim();

        const combined = [base, finalChunk, interimChunk].filter(Boolean).join(' ');
        setInputText(combined);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        console.warn('Web Speech API recognition notice:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSpeechError('Microphone permission was denied. Please allow microphone access in your browser settings.');
        } else if (event.error === 'no-speech') {
          // No speech detected, graceful non-fatal behavior
          return;
        } else if (event.error === 'network') {
          setSpeechError('Network connectivity error during voice dictation.');
        } else {
          setSpeechError(`Voice dictation note: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err: unknown) {
      console.error('Failed to initialize Web Speech API:', err);
      setSpeechError('Unable to start voice recognition in this environment.');
      setIsListening(false);
    }
  };

  const handleToggleVoiceDictation = () => {
    if (isListening) {
      stopVoiceDictation();
    } else {
      startVoiceDictation();
    }
  };

  // Sync state when active interaction changes
  useEffect(() => {
    if (activeInteraction) {
      setMode(activeInteraction.mode);
      setMood(activeInteraction.mood);
      setTitle(activeInteraction.title);
      setLocation(activeInteraction.location);
      setApiError(null);
      setSaveError(null);
      setPendingRetryInteraction(null);
    } else {
      setMode('reflection');
      setMood(undefined);
      setTitle('');
      setLocation(undefined);
      setInputText('');
      setApiError(null);
      setSaveError(null);
      setPendingRetryInteraction(null);
    }
  }, [activeInteraction?.id]);

  // Scroll to bottom of message stream
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeInteraction?.messages, isSubmitting]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleQuickPromptSelect = (promptText: string) => {
    setInputText(promptText);
    inputRef.current?.focus();
  };

  /**
   * Submit reflection/message to Gemini API and persist immediately to Firestore
   * Strict adherence to Guaranteed Transaction Verification
   */
  const handleSubmit = async (overridePrompt?: string) => {
    const promptToSubmit = (overridePrompt || inputText).trim();
    if (!promptToSubmit || isSubmitting) return;

    stopVoiceDictation();
    setApiError(null);
    setSaveError(null);
    setIsSubmitting(true);

    const now = new Date().toISOString();
    const interactionId = activeInteraction?.id || `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Prepare user message
    const userMessage: InteractionMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: promptToSubmit,
      timestamp: now,
    };

    // Calculate updated messages
    const currentMessages = activeInteraction?.messages || [];
    const updatedMessages = [...currentMessages, userMessage];

    // Compute title if new
    let resolvedTitle = title.trim();
    if (!resolvedTitle) {
      resolvedTitle = promptToSubmit.slice(0, 50).replace(/\n/g, ' ');
      if (promptToSubmit.length > 50) resolvedTitle += '...';
      setTitle(resolvedTitle);
    }

    try {
      // Step 1: Call Gemini API Proxy
      const response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          mode,
          mood,
          location,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned ${response.status}: Failed to generate reflection.`);
      }

      const data = await response.json();
      const modelMessage: InteractionMessage = {
        id: `msg_model_${Date.now()}`,
        role: 'model',
        content: data.text,
        timestamp: data.timestamp || new Date().toISOString(),
        modelUsed: data.modelUsed || 'gemini-3.6-flash',
      };

      const finalMessages = [...updatedMessages, modelMessage];

      const fullInteraction: InteractionDocument = {
        id: interactionId,
        userId: user.uid,
        title: resolvedTitle,
        mode,
        mood,
        location,
        messages: finalMessages,
        summary: mode === 'summary' ? data.text : activeInteraction?.summary,
        createdAt: activeInteraction?.createdAt || now,
        updatedAt: new Date().toISOString(),
      };

      // Step 2: Strict Firestore Persistence with zero-crash hygiene
      try {
        await saveInteraction(user.uid, fullInteraction);
        // Only clear input buffer upon confirmed successful write
        setInputText('');
        onInteractionSaved(fullInteraction);

        // Step 3: Dispatch external webhook notification if user enabled it (non-blocking)
        getNotificationSettings(user.uid)
          .then((notifSettings) => {
            if (notifSettings && notifSettings.enabled && notifSettings.webhookUrl) {
              fetch('/api/notifications/dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  webhookUrl: notifSettings.webhookUrl,
                  title: resolvedTitle,
                  mode,
                  snippet: data.text.slice(0, 300),
                  locationName: location?.name,
                }),
              }).catch((e) => console.warn('Notification webhook dispatch warning:', e));
            }
          })
          .catch(() => {});
      } catch (dbErr: any) {
        console.error('Firestore save failed:', dbErr);
        setPendingRetryInteraction(fullInteraction);
        setSaveError(
          `Generated successfully from Gemini, but failed to save to Firestore: ${dbErr?.message || 'Database error'}. Your reflection is preserved below.`
        );
      }
    } catch (err: any) {
      console.error('Submission failed:', err);
      // Retain user input buffer so nothing is lost!
      setApiError(err?.message || 'An error occurred while communicating with Gemini.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Retry saving a pending interaction that succeeded with Gemini but failed Firestore persistence
   */
  const handleRetrySave = async () => {
    if (!pendingRetryInteraction) return;
    try {
      setSaveError(null);
      await saveInteraction(user.uid, pendingRetryInteraction);
      setInputText('');
      onInteractionSaved(pendingRetryInteraction);
      setPendingRetryInteraction(null);
    } catch (dbErr: any) {
      setSaveError(`Retry save failed: ${dbErr?.message || 'Check network or permissions'}`);
    }
  };

  /**
   * Export the current reflection content as a downloadable formatted text file (.txt)
   */
  const handleExportTextFile = () => {
    const reflectionTitle = title.trim() || activeInteraction?.title || 'Journal Reflection';
    const reflectionMode = MODES.find((m) => m.id === mode)?.label || mode;
    const createdAt = activeInteraction?.createdAt
      ? new Date(activeInteraction.createdAt).toLocaleString()
      : new Date().toLocaleString();

    let textContent = `=====================================================\n`;
    textContent += `REFLECTAI JOURNAL ENTRY\n`;
    textContent += `Title:    ${reflectionTitle}\n`;
    textContent += `Date:     ${createdAt}\n`;
    textContent += `Mode:     ${reflectionMode}\n`;
    if (mood) {
      textContent += `Mood:     ${mood.emoji} ${mood.label} (Energy: ${mood.score}/5)\n`;
    }
    if (user.displayName || user.email) {
      textContent += `Author:   ${user.displayName || user.email}\n`;
    }
    if (location) {
      textContent += `Location: ${location.name}`;
      if (location.address) textContent += ` (${location.address})`;
      textContent += ` [${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}]\n`;
    }
    textContent += `=====================================================\n\n`;

    if (messages.length > 0) {
      textContent += `--- CONVERSATION TRANSCRIPT ---\n\n`;
      messages.forEach((m, idx) => {
        const speaker = m.role === 'user' ? 'YOU' : `GEMINI AI (${m.modelUsed || 'Reflection'})`;
        const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleString() : '';
        textContent += `[#${idx + 1}] ${speaker} ${timeStr ? `[${timeStr}]` : ''}\n`;
        textContent += `-----------------------------------------------------\n`;
        textContent += `${m.content}\n\n`;
      });
    }

    if (inputText.trim()) {
      textContent += `--- CURRENT DRAFT / WORKING NOTES ---\n\n`;
      textContent += `${inputText.trim()}\n\n`;
    }

    if (messages.length === 0 && !inputText.trim()) {
      textContent += `(No content recorded in this entry yet)\n\n`;
    }

    textContent += `=====================================================\n`;
    textContent += `Generated securely by ReflectAI\n`;
    textContent += `Strictly isolated to user: ${user.uid}\n`;
    textContent += `=====================================================\n`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const sanitizedTitle = reflectionTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'reflection';
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${sanitizedTitle}_${timestamp}.txt`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const messages = activeInteraction?.messages || [];

  const allWords = [
    title,
    ...messages.map((m) => m.content),
    inputText,
  ]
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const readingStats = {
    words: allWords.length,
    minutes: Math.max(1, Math.ceil(allWords.length / 180)),
  };

  // Dedicated Distraction-Free Reading Mode Canvas
  if (readingModeActive) {
    return (
      <div
        id="reflection-studio-reading-mode"
        className="flex flex-1 flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#0A0C12] selection:bg-indigo-500/30 selection:text-indigo-200"
      >
        {/* Distraction-Free Reading Toolbar */}
        <div
          id="reading-mode-toolbar"
          className="border-b border-slate-800/80 bg-[#0D0F17]/90 px-4 py-2.5 sm:px-8 flex items-center justify-between shadow-md z-10 backdrop-blur-md"
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-3 py-1 text-xs font-semibold text-indigo-300 shadow-xs">
              <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
              <span>Reading Mode</span>
            </span>

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 border-l border-slate-800 pl-3">
              <span>{readingStats.minutes} min read</span>
              <span>•</span>
              <span>{readingStats.words} words</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Font Size Selectors */}
            <div className="flex items-center bg-[#141724] border border-slate-800 rounded-lg p-0.5 text-xs text-slate-300">
              <button
                id="reading-font-size-normal"
                type="button"
                onClick={() => setReadingFontSize('normal')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  readingFontSize === 'normal' ? 'bg-indigo-600 text-white font-medium' : 'hover:text-white'
                }`}
                title="Normal text size (16px)"
              >
                A
              </button>
              <button
                id="reading-font-size-large"
                type="button"
                onClick={() => setReadingFontSize('large')}
                className={`px-2 py-1 rounded transition-colors text-sm font-medium cursor-pointer ${
                  readingFontSize === 'large' ? 'bg-indigo-600 text-white' : 'hover:text-white'
                }`}
                title="Large text size (18px)"
              >
                A+
              </button>
              <button
                id="reading-font-size-xl"
                type="button"
                onClick={() => setReadingFontSize('xl')}
                className={`px-2 py-1 rounded transition-colors text-base font-semibold cursor-pointer ${
                  readingFontSize === 'xl' ? 'bg-indigo-600 text-white' : 'hover:text-white'
                }`}
                title="Extra Large text size (20px)"
              >
                A++
              </button>
            </div>

            {/* Font Family Selector */}
            <div className="hidden md:flex items-center bg-[#141724] border border-slate-800 rounded-lg p-0.5 text-xs text-slate-300">
              <button
                id="reading-font-serif"
                type="button"
                onClick={() => setReadingFontFamily('serif')}
                className={`px-2.5 py-1 rounded font-serif transition-colors cursor-pointer ${
                  readingFontFamily === 'serif' ? 'bg-indigo-600 text-white font-medium' : 'hover:text-white'
                }`}
                title="Classic Serif book typeface"
              >
                Serif
              </button>
              <button
                id="reading-font-sans"
                type="button"
                onClick={() => setReadingFontFamily('sans')}
                className={`px-2.5 py-1 rounded font-sans transition-colors cursor-pointer ${
                  readingFontFamily === 'sans' ? 'bg-indigo-600 text-white font-medium' : 'hover:text-white'
                }`}
                title="Modern Sans-serif typeface"
              >
                Sans
              </button>
            </div>

            {/* Export Text in Reading Mode */}
            <button
              id="reading-mode-export-btn"
              type="button"
              onClick={handleExportTextFile}
              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#141724] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              title="Export entry as text file"
            >
              <Download className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Exit Reading Mode Button */}
            <button
              id="exit-reading-mode-btn"
              type="button"
              onClick={() => toggleReading(false)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md hover:from-indigo-600 hover:to-purple-700 transition-all cursor-pointer"
              title="Exit Reading Mode (Press Escape)"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span>Exit Reading Mode</span>
              <kbd className="hidden sm:inline-block ml-1 rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-mono text-indigo-100">
                Esc
              </kbd>
            </button>
          </div>
        </div>

        {/* Scrollable Reading Canvas */}
        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-12 sm:py-14 custom-scrollbar">
          <article
            id="reading-mode-content"
            className={`mx-auto max-w-2xl sm:max-w-3xl rounded-3xl border border-slate-800/70 bg-[#0E111C]/85 backdrop-blur-md p-6 sm:p-12 shadow-2xl shadow-black/60 ${
              readingFontFamily === 'serif' ? 'font-serif' : 'font-sans'
            }`}
          >
            {/* Reading Masthead */}
            <header className="border-b border-slate-800/80 pb-8 mb-8 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-950/60 border border-indigo-500/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                  {MODES.find((m) => m.id === mode)?.label || mode}
                </span>

                {mood && (
                  <span
                    id="reading-mood-badge"
                    className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-950/40 px-3 py-1 text-xs text-amber-200"
                  >
                    <span>{mood.emoji}</span>
                    <span className="font-medium">{mood.label}</span>
                    <span className="text-[10px] text-amber-300 font-mono">({mood.score}/5 energy)</span>
                  </span>
                )}

                {location && (
                  <span
                    id="reading-location-badge"
                    className="flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-3 py-1 text-xs text-indigo-300"
                  >
                    <MapPin className="h-3 w-3 text-indigo-400" />
                    <span>{location.name}</span>
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-serif font-normal text-white tracking-tight leading-tight">
                {title.trim() || activeInteraction?.title || 'Journal Reflection'}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-sans">
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>
                    {activeInteraction?.createdAt
                      ? new Date(activeInteraction.createdAt).toLocaleDateString(undefined, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : new Date().toLocaleDateString(undefined, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                  </span>
                </div>
                {user.displayName && (
                  <>
                    <span>•</span>
                    <span className="text-slate-300 font-medium">By {user.displayName}</span>
                  </>
                )}
              </div>
            </header>

            {/* Reading Content */}
            {messages.length === 0 && !inputText.trim() ? (
              <div className="py-16 text-center text-slate-400 space-y-4 font-sans">
                <Compass className="h-10 w-10 text-slate-600 mx-auto" />
                <p className="text-base text-slate-300">
                  This reflection does not have any recorded thoughts yet.
                </p>
                <button
                  id="reading-mode-start-writing-btn"
                  onClick={() => toggleReading(false)}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer"
                >
                  Return to Composer & Write
                </button>
              </div>
            ) : (
              <div className="space-y-10">
                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  return (
                    <section
                      key={msg.id || index}
                      className={
                        isUser
                          ? 'space-y-3'
                          : 'my-8 border-l-2 border-indigo-500/40 bg-indigo-950/20 rounded-r-2xl py-5 px-6 sm:px-8 space-y-3'
                      }
                    >
                      <div className="flex items-center justify-between text-xs font-sans">
                        <span
                          className={`font-semibold uppercase tracking-wider ${
                            isUser ? 'text-indigo-400' : 'text-purple-300 flex items-center gap-1.5'
                          }`}
                        >
                          {!isUser && <Sparkles className="h-3.5 w-3.5 text-indigo-400" />}
                          {isUser ? 'Personal Reflection' : `Gemini Reflection (${msg.modelUsed || 'AI'})`}
                        </span>
                        {msg.timestamp && (
                          <span className="text-[11px] text-slate-500 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div
                        className={`prose prose-invert max-w-none text-slate-200 ${
                          readingFontSize === 'normal'
                            ? 'text-base leading-relaxed'
                            : readingFontSize === 'large'
                            ? 'text-lg leading-loose'
                            : 'text-xl leading-loose'
                        }`}
                      >
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </section>
                  );
                })}

                {/* If working draft notes exist */}
                {inputText.trim() && (
                  <section className="mt-8 border-t border-dashed border-slate-800 pt-6 space-y-2">
                    <div className="text-xs font-sans uppercase tracking-wider text-amber-400/90 font-semibold">
                      Working Draft Notes
                    </div>
                    <div
                      className={`prose prose-invert max-w-none text-slate-300 ${
                        readingFontSize === 'normal'
                          ? 'text-base leading-relaxed'
                          : readingFontSize === 'large'
                          ? 'text-lg leading-loose'
                          : 'text-xl leading-loose'
                      }`}
                    >
                      <ReactMarkdown>{inputText}</ReactMarkdown>
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* Reading Masthead Footer */}
            <footer className="mt-14 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-sans">
              <div className="flex items-center gap-2">
                <span>ReflectAI Distraction-Free Reader</span>
                <span>•</span>
                <span className="text-slate-500">Press Esc to exit anytime</span>
              </div>
              <button
                id="reading-mode-bottom-exit-btn"
                type="button"
                onClick={() => toggleReading(false)}
                className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                <span>Return to Editor</span>
              </button>
            </footer>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div id="reflection-studio-container" className="flex flex-1 flex-col h-[calc(100vh-4rem)] overflow-hidden bg-transparent">
      {/* Studio Header & Controls */}
      <div className="border-b border-slate-800/80 bg-[#0D0F17]/90 backdrop-blur-md px-4 py-3 sm:px-6 shadow-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <input
              id="reflection-title-input"
              type="text"
              placeholder="Give this reflection a title (e.g., Morning Mindset, Project Blockers)..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-base sm:text-lg font-serif font-medium text-white placeholder:text-slate-500 focus:outline-none focus:border-b focus:border-indigo-500 border-b border-transparent transition-colors py-0.5 bg-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Mood Pill (if selected) */}
            {mood && (
              <div
                id="header-mood-pill"
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/40 px-2.5 py-1.5 text-xs text-amber-200 shadow-xs"
                title={`Logged Mood: ${mood.label} (Energy: ${mood.score}/5)`}
              >
                <span className="text-sm leading-none">{mood.emoji}</span>
                <span className="font-medium hidden sm:inline">{mood.label}</span>
                <span className="text-[10px] text-amber-300 font-mono">({mood.score}/5)</span>
                <button
                  id="remove-mood-header-btn"
                  onClick={() => setMood(undefined)}
                  className="ml-0.5 text-amber-300/60 hover:text-white cursor-pointer"
                  title="Clear mood"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Location Pin Button */}
            {location ? (
              <div
                id="header-location-pill"
                className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/50 px-2.5 py-1.5 text-xs text-indigo-300 shadow-sm"
              >
                <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                <span
                  onClick={() => setIsLocationModalOpen(true)}
                  className="max-w-[130px] sm:max-w-[180px] truncate cursor-pointer hover:underline"
                  title={`${location.name}${location.address ? ` (${location.address})` : ''}`}
                >
                  {location.name}
                </span>
                <button
                  id="remove-location-header-btn"
                  onClick={() => setLocation(undefined)}
                  className="ml-1 text-slate-400 hover:text-white cursor-pointer"
                  title="Remove location"
                >
                  &times;
                </button>
              </div>
            ) : (
              <button
                id="open-location-picker-btn"
                onClick={() => setIsLocationModalOpen(true)}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#141724] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-indigo-300 hover:border-indigo-500/40 transition-colors cursor-pointer"
                title="Pin location to this entry"
              >
                <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                <span>Pin Location</span>
              </button>
            )}

            {/* Reading Mode Button */}
            <button
              id="reading-mode-toggle-btn"
              onClick={() => toggleReading(true)}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/40 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/50 hover:border-indigo-500/50 hover:text-white transition-all shadow-xs cursor-pointer"
              title="Enter distraction-free Reading Mode (Hides inputs and sidebar)"
            >
              <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Reading Mode</span>
              <span className="sm:hidden">Read</span>
            </button>

            {/* Export Text File Button */}
            <button
              id="export-reflection-text-btn"
              onClick={handleExportTextFile}
              disabled={messages.length === 0 && !inputText.trim() && !title.trim()}
              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#141724] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white hover:border-indigo-500/40 disabled:opacity-40 disabled:hover:bg-[#141724] disabled:hover:text-slate-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Export current reflection as a downloadable text file"
            >
              <Download className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Export Text</span>
              <span className="sm:hidden">Export</span>
            </button>

            {activeInteraction && (
              <button
                id="delete-reflection-button"
                onClick={() => {
                  if (window.confirm('Delete this reflection entry permanently?')) {
                    onDeleteInteraction(activeInteraction.id);
                  }
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#141724] px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-red-950/40 hover:text-red-400 hover:border-red-900/50 transition-colors cursor-pointer"
                title="Delete reflection"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}

            <button
              id="start-new-button"
              onClick={onNewReflection}
              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#141724] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset / Blank</span>
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/60">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
            Intent Mode:
          </span>
          {MODES.map((m) => {
            const Icon = m.icon;
            const isSelected = mode === m.id;
            return (
              <button
                key={m.id}
                id={`mode-selector-${m.id}`}
                onClick={() => setMode(m.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 ring-1 ring-indigo-500'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                title={m.description}
              >
                <Icon className={`h-3 w-3 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mood Selector Row */}
        <div id="mood-selector-container" className="mt-2 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/40">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
            Mood & Energy:
          </span>
          {JOURNAL_MOODS.map((m) => {
            const isSelected = mood?.id === m.id;
            return (
              <button
                key={m.id}
                id={`mood-selector-${m.id}`}
                type="button"
                onClick={() => setMood(isSelected ? undefined : m)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-500/60 shadow-xs shadow-amber-500/10 ring-1 ring-amber-500/40'
                    : 'bg-[#121522] text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title={`${m.label} (Energy scale: ${m.score}/5)`}
              >
                <span className="text-sm leading-none">{m.emoji}</span>
                <span>{m.label}</span>
                <span className={`text-[10px] font-mono px-1 rounded-sm ${
                  isSelected ? 'bg-amber-400/20 text-amber-300 font-semibold' : 'text-slate-500'
                }`}>
                  {m.score}/5
                </span>
              </button>
            );
          })}
          {mood && (
            <button
              id="clear-mood-selection-btn"
              type="button"
              onClick={() => setMood(undefined)}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline ml-1 cursor-pointer"
              title="Clear selected mood"
            >
              Clear
            </button>
          )}

          {onOpenMoodDashboard && (
            <button
              id="open-mood-dashboard-from-studio-btn"
              type="button"
              onClick={onOpenMoodDashboard}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-950/20 px-2 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-950/40 hover:border-amber-500/40 transition-colors cursor-pointer"
              title="Open Weekly Mood & Emotional Energy Trend Graph"
            >
              <TrendingUp className="h-3 w-3 text-amber-400" />
              <span>Weekly Trend</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 space-y-6">
        {/* Pinned Location Atmosphere Banner */}
        {location && (
          <div
            id="pinned-location-ambient-banner"
            className="mx-auto max-w-3xl rounded-xl border border-indigo-500/25 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-indigo-950/30 p-3 flex items-center justify-between shadow-md"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>{location.name}</span>
                  <span className="text-[10px] text-indigo-400 font-mono">
                    [{location.lat.toFixed(3)}, {location.lng.toFixed(3)}]
                  </span>
                </div>
                {location.address && (
                  <div className="text-[11px] text-slate-400 truncate max-w-sm sm:max-w-md">
                    {location.address}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                id="edit-pinned-location-btn"
                onClick={() => setIsLocationModalOpen(true)}
                className="text-[11px] text-indigo-300 hover:text-white px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-500/30 transition-colors"
              >
                Change Pin
              </button>
              <button
                id="remove-pinned-location-btn"
                onClick={() => setLocation(undefined)}
                className="text-[11px] text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Remove location"
              >
                &times;
              </button>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          /* Empty State / Fresh Canvas */
          <div id="reflection-empty-state" className="mx-auto max-w-2xl py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 mb-4 shadow-lg shadow-indigo-950/40">
              <Compass className="h-6 w-6" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-white">
              What is unfolding in your mind today?
            </h2>
            <p className="mt-2 text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              Write as freely or fragmented as you wish. Gemini will analyze, reflect, or brainstorm solutions with empathetic clarity.
            </p>

            {/* Quick Inspiration Prompts */}
            <div className="mt-6 text-left">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
                Quick Prompts for {MODES.find((m) => m.id === mode)?.label}
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {SUGGESTED_PROMPTS[mode].map((prompt, idx) => (
                  <button
                    key={idx}
                    id={`quick-prompt-${idx}`}
                    onClick={() => handleQuickPromptSelect(prompt)}
                    className="flex flex-col text-left rounded-xl border border-slate-800/80 bg-[#111422]/90 backdrop-blur-sm p-3.5 text-xs text-slate-300 shadow-md hover:border-indigo-500/50 hover:bg-[#161B2E] transition-all cursor-pointer"
                  >
                    <span className="line-clamp-3 leading-relaxed">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Render Message Thread */
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                id={`message-bubble-${msg.id}`}
                className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'model' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20 mt-1">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 sm:p-5 shadow-lg transition-all ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-tr-xs shadow-indigo-950/40'
                      : 'border border-slate-800/90 bg-[#121522]/90 backdrop-blur-md text-slate-200 rounded-tl-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b pb-2 mb-3 text-[11px] font-medium opacity-80 border-white/10">
                    <div className="flex items-center gap-1.5">
                      {msg.role === 'user' ? (
                        <>
                          <UserIcon className="h-3 w-3" />
                          <span>You (Journal Entry)</span>
                        </>
                      ) : (
                        <>
                          <Bot className="h-3 w-3 text-indigo-400" />
                          <span>Gemini Reflection</span>
                          {msg.modelUsed && (
                            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-indigo-300 font-mono border border-slate-700/50">
                              {msg.modelUsed}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] opacity-75">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {msg.role === 'model' && (
                        <button
                          id={`copy-msg-${msg.id}`}
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="text-slate-400 hover:text-white transition-colors p-0.5 rounded cursor-pointer"
                          title="Copy message"
                        >
                          {copiedMessageId === msg.id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed text-slate-200">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-200 border border-slate-700 shadow-xs mt-1">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="User"
                        className="h-8 w-8 rounded-xl object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-xs font-bold">
                        {(user.displayName || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isSubmitting && (
              <div className="flex items-center gap-3 text-slate-400 text-xs py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md animate-pulse">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-300">Gemini is reflecting on your thoughts</span>
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce delay-100">.</span>
                  <span className="animate-bounce delay-200">.</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error Banners */}
      {apiError && (
        <div
          id="api-error-banner"
          className="mx-4 sm:mx-8 mb-2 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-200 shadow-lg backdrop-blur-sm"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{apiError}</span>
          </div>
          <button
            id="retry-api-button"
            onClick={() => handleSubmit()}
            className="rounded bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
          >
            Retry Gemini
          </button>
        </div>
      )}

      {saveError && (
        <div
          id="save-error-banner"
          className="mx-4 sm:mx-8 mb-2 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-950/40 p-3 text-xs text-amber-200 shadow-lg backdrop-blur-sm"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{saveError}</span>
          </div>
          {pendingRetryInteraction && (
            <button
              id="retry-save-button"
              onClick={handleRetrySave}
              className="rounded bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-800 transition-colors cursor-pointer"
            >
              Retry Save
            </button>
          )}
        </div>
      )}

      {/* Suggested Follow-ups for Active Conversation */}
      {messages.length > 0 && !isSubmitting && (
        <div className="px-4 sm:px-8 py-2 bg-[#0D0F17]/80 backdrop-blur-md border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[11px] font-medium text-slate-400 shrink-0">Follow-up:</span>
          <button
            id="followup-summarize"
            onClick={() => handleSubmit('Can you summarize the top insights and key takeaways from our reflection so far?')}
            className="rounded-full border border-slate-700 bg-[#141828] px-3 py-1 text-slate-300 hover:bg-[#1C2138] hover:border-indigo-500/50 hover:text-white shrink-0 transition-colors cursor-pointer"
          >
            Distill Top Insights
          </button>
          <button
            id="followup-actions"
            onClick={() => handleSubmit('What are 3 practical, low-friction action steps I can take tomorrow?')}
            className="rounded-full border border-slate-700 bg-[#141828] px-3 py-1 text-slate-300 hover:bg-[#1C2138] hover:border-indigo-500/50 hover:text-white shrink-0 transition-colors cursor-pointer"
          >
            3 Practical Action Steps
          </button>
          <button
            id="followup-reframe"
            onClick={() => handleSubmit('Offer an alternative, empowering mental reframe for this situation.')}
            className="rounded-full border border-slate-700 bg-[#141828] px-3 py-1 text-slate-300 hover:bg-[#1C2138] hover:border-indigo-500/50 hover:text-white shrink-0 transition-colors cursor-pointer"
          >
            Empowering Reframe
          </button>
        </div>
      )}

      {/* Input Composer */}
      <div className="border-t border-slate-800/80 bg-[#0A0C12]/90 backdrop-blur-md p-3 sm:p-4 shadow-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="mx-auto max-w-3xl flex flex-col gap-2"
        >
          {/* Active Voice Listening Banner */}
          {isListening && (
            <div
              id="voice-listening-indicator"
              className="flex items-center justify-between rounded-lg bg-red-950/60 border border-red-500/40 px-3 py-1.5 text-xs text-red-200 shadow-md backdrop-blur-xs"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <span className="font-medium text-red-100">
                  Microphone active &bull; Listening to your voice dictation...
                </span>
              </div>
              <button
                id="stop-voice-dictation-banner-btn"
                type="button"
                onClick={stopVoiceDictation}
                className="text-[11px] font-semibold text-red-300 hover:text-white underline cursor-pointer"
              >
                Done Speaking
              </button>
            </div>
          )}

          {/* Speech Error Banner */}
          {speechError && (
            <div
              id="speech-error-banner"
              className="flex items-center justify-between rounded-lg bg-amber-950/50 border border-amber-500/40 px-3 py-1.5 text-xs text-amber-200 shadow-md"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>{speechError}</span>
              </div>
              <button
                id="dismiss-speech-error-btn"
                type="button"
                onClick={() => setSpeechError(null)}
                className="text-[11px] font-semibold text-amber-300 hover:text-white underline cursor-pointer ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="relative flex rounded-xl border border-slate-800 bg-[#121522] shadow-lg shadow-black/40 focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
            <textarea
              ref={inputRef}
              id="reflection-composer-input"
              rows={messages.length === 0 ? 3 : 2}
              placeholder={
                messages.length === 0
                  ? "Write or dictate your journal entry, thought, or question here..."
                  : "Reply to continue the reflection or dictate notes..."
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={isSubmitting}
              className="w-full resize-none rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-60 leading-relaxed font-sans bg-transparent"
            />

            <div className="flex items-end p-2 gap-1.5">
              {/* Voice Dictation Button (Web Speech API) */}
              <button
                id="voice-dictation-btn"
                type="button"
                onClick={handleToggleVoiceDictation}
                disabled={!isSpeechSupported || isSubmitting}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all cursor-pointer ${
                  isListening
                    ? 'bg-red-600 text-white shadow-md shadow-red-500/40 animate-pulse hover:bg-red-700'
                    : 'bg-[#181c2e] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/50'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
                title={
                  !isSpeechSupported
                    ? 'Voice dictation is not supported in this browser'
                    : isListening
                    ? 'Listening... Click to stop voice dictation'
                    : 'Dictate journal entry with voice (Web Speech API)'
                }
                aria-label={isListening ? 'Stop voice dictation' : 'Dictate with voice'}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4 text-white" />
                ) : (
                  <Mic className="h-4 w-4 text-slate-300 hover:text-indigo-300" />
                )}
              </button>

              <button
                id="submit-reflection-button"
                type="submit"
                disabled={!inputText.trim() || isSubmitting}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20 transition-all hover:from-indigo-600 hover:to-purple-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Send entry to Gemini"
                aria-label="Send reflection"
              >
                {isSubmitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-white" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 flex-wrap">
              <span>Press Enter to send &bull; Shift + Enter for new line</span>
              {isSpeechSupported && (
                <span className="hidden sm:inline text-slate-500">&bull; Voice dictation ready</span>
              )}
            </span>
            <span>
              {inputText.length} chars &bull; Verified save to Firestore
            </span>
          </div>
        </form>
      </div>

      {/* Interactive Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        currentLocation={location}
        onSelectLocation={(loc) => setLocation(loc)}
      />
    </div>
  );
};
