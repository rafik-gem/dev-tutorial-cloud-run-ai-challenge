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
} from 'lucide-react';
import type {
  InteractionDocument,
  InteractionMessage,
  ReflectionMode,
  UserProfile,
} from '../types';
import { saveInteraction, stripUndefined } from '../firebase';

interface ReflectionStudioProps {
  user: UserProfile;
  activeInteraction: InteractionDocument | null;
  onInteractionSaved: (interaction: InteractionDocument) => void;
  onDeleteInteraction: (id: string) => void;
  onNewReflection: () => void;
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
}) => {
  const [mode, setMode] = useState<ReflectionMode>(activeInteraction?.mode || 'reflection');
  const [title, setTitle] = useState<string>(activeInteraction?.title || '');
  const [inputText, setInputText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [pendingRetryInteraction, setPendingRetryInteraction] = useState<InteractionDocument | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when active interaction changes
  useEffect(() => {
    if (activeInteraction) {
      setMode(activeInteraction.mode);
      setTitle(activeInteraction.title);
      setApiError(null);
      setSaveError(null);
      setPendingRetryInteraction(null);
    } else {
      setMode('reflection');
      setTitle('');
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

  const messages = activeInteraction?.messages || [];

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
      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 space-y-6">
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
          <div className="relative flex rounded-xl border border-slate-800 bg-[#121522] shadow-lg shadow-black/40 focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
            <textarea
              ref={inputRef}
              id="reflection-composer-input"
              rows={messages.length === 0 ? 3 : 2}
              placeholder={
                messages.length === 0
                  ? "Write down your journal entry, thought, or question here..."
                  : "Reply to continue the reflection or ask Gemini to elaborate..."
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

            <div className="flex items-end p-2">
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
            <span>Press Enter to send &bull; Shift + Enter for new line</span>
            <span>
              {inputText.length} chars &bull; Verified save to Firestore
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
