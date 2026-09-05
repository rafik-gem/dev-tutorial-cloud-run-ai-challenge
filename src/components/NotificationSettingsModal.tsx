import React, { useState, useEffect } from 'react';
import { Bell, X, Send, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import type { NotificationSettings } from '../types';
import { saveNotificationSettings, getNotificationSettings } from '../firebase';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>({
    webhookUrl: '',
    enabled: false,
    platform: 'discord',
    notifyOnModes: ['reflection', 'brainstorm', 'summary', 'conversation'],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      getNotificationSettings(userId).then((saved) => {
        if (saved) setSettings(saved);
      });
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setTestStatus(null);
    try {
      await saveNotificationSettings(userId, settings);
      setTestStatus({ type: 'success', message: 'Notification preferences saved successfully!' });
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setTestStatus({ type: 'error', message: err?.message || 'Failed to save settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!settings.webhookUrl.trim()) {
      setTestStatus({ type: 'error', message: 'Please enter a webhook URL first.' });
      return;
    }

    setIsTesting(true);
    setTestStatus(null);

    try {
      const res = await fetch('/api/notifications/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: settings.webhookUrl.trim(),
          title: 'Test Notification from ReflectAI',
          mode: 'reflection',
          snippet: 'Your external webhook integration is verified and operational! Reflections from your journal can now be dispatched automatically.',
          locationName: 'Kyoto Zen Temple & Bamboo Forest',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch test webhook.');
      }

      setTestStatus({ type: 'success', message: 'Test notification sent successfully to external webhook!' });
    } catch (err: any) {
      setTestStatus({ type: 'error', message: err?.message || 'Dispatch error.' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div
      id="notifications-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="notifications-modal-container"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">External Notifications</h2>
              <p className="text-xs text-slate-400">
                Dispatch journal summaries to Discord, Slack, or a custom webhook.
              </p>
            </div>
          </div>
          <button
            id="close-notifications-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          {/* Status Message */}
          {testStatus && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center space-x-2 border ${
                testStatus.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {testStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{testStatus.message}</span>
            </div>
          )}

          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/50 border border-slate-800">
            <div>
              <div className="text-xs font-semibold text-slate-200">Enable Dispatch</div>
              <div className="text-[11px] text-slate-400">
                Automatically dispatch notification when a reflection completes
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="toggle-notifications-enabled"
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Webhook URL Input */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
              Target Webhook URL
            </label>
            <input
              id="webhook-url-input"
              type="url"
              placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/..."
              value={settings.webhookUrl}
              onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 font-mono"
            />
            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>SSRF Protected: Cloud Metadata & private IP ranges are strictly blocked.</span>
            </div>
          </div>

          {/* Webhook Type Presets */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
              Service Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['discord', 'slack', 'custom'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  id={`select-platform-${p}`}
                  onClick={() => setSettings({ ...settings, platform: p })}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium capitalize transition-all ${
                    settings.platform === p
                      ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-300'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            id="test-webhook-btn"
            type="button"
            onClick={handleSendTest}
            disabled={isTesting || !settings.webhookUrl}
            className="px-3.5 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-xs font-medium text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center space-x-1.5"
          >
            <Send className={`w-3 h-3 ${isTesting ? 'animate-pulse' : ''}`} />
            <span>{isTesting ? 'Dispatching...' : 'Send Test'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              id="cancel-notifications-btn"
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-800 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-notifications-btn"
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-xs font-medium text-white shadow-lg shadow-indigo-500/20 transition-all"
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
