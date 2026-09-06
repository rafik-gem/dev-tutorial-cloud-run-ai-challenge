import React from 'react';
import { Palette, X, Check, Sparkles, Shield, Eye } from 'lucide-react';
import type { ColorThemeId } from '../types';
import { COLOR_THEMES } from '../types';

interface ThemeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ColorThemeId;
  onSelectTheme: (themeId: ColorThemeId) => void;
}

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
}) => {
  if (!isOpen) return null;

  const activeThemeObj = COLOR_THEMES.find((t) => t.id === currentTheme) || COLOR_THEMES[0];

  return (
    <div
      id="theme-settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="theme-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-modal-title"
        className="w-full max-w-2xl rounded-2xl border border-slate-800/90 bg-[#0E111C]/95 p-6 shadow-2xl shadow-black/80 backdrop-blur-xl sm:p-8 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg transition-colors"
              style={{
                backgroundColor: activeThemeObj.accentHex,
                boxShadow: `0 8px 20px ${activeThemeObj.glowColor}`,
              }}
            >
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 id="theme-modal-title" className="text-lg font-semibold text-white">
                Color Themes & Atmosphere
              </h2>
              <p className="text-xs text-slate-400">
                Choose an immersive palette tailored for deep reflection and eye comfort.
              </p>
            </div>
          </div>
          <button
            id="close-theme-modal-button"
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white cursor-pointer"
            aria-label="Close theme settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Theme Cards */}
        <div className="flex-1 overflow-y-auto py-5 pr-1 space-y-3 custom-scrollbar">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {COLOR_THEMES.map((theme) => {
              const isSelected = theme.id === currentTheme;
              return (
                <button
                  key={theme.id}
                  id={`theme-option-${theme.id}`}
                  type="button"
                  onClick={() => onSelectTheme(theme.id)}
                  className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-500/80 ring-2 ring-indigo-500/40 shadow-xl'
                      : 'border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-800/20'
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${theme.surfaceHex}ee` : `${theme.surfaceHex}99`,
                    borderColor: isSelected ? theme.accentHex : undefined,
                  }}
                >
                  <div className="space-y-2.5">
                    {/* Top row: Name + Badge + Check */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: theme.accentHex }}
                        />
                        <span className="font-medium text-sm text-white group-hover:text-slate-100">
                          {theme.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            backgroundColor: `${theme.accentHex}25`,
                            color: theme.accentHex,
                            border: `1px solid ${theme.accentHex}40`,
                          }}
                        >
                          {theme.fontBadge}
                        </span>

                        {isSelected && (
                          <div
                            className="flex h-5 w-5 items-center justify-center rounded-full text-white shadow-xs"
                            style={{ backgroundColor: theme.accentHex }}
                          >
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tagline */}
                    <p className="text-xs font-medium text-slate-300">
                      {theme.tagline}
                    </p>

                    {/* Description */}
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {theme.description}
                    </p>
                  </div>

                  {/* Bottom: Swatches & Mini preview */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">
                        Palette
                      </span>
                      <div className="flex items-center gap-1">
                        {theme.swatchColors.map((color, idx) => (
                          <div
                            key={idx}
                            className="h-3.5 w-3.5 rounded-full border border-black/40 shadow-xs"
                            style={{ backgroundColor: color }}
                            title={`Hex: ${color}`}
                          />
                        ))}
                      </div>
                    </div>

                    <span
                      className="text-[10px] font-mono"
                      style={{ color: theme.accentHex }}
                    >
                      {theme.accentLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Live Atmosphere Preview Card */}
          <div
            id="theme-live-preview-box"
            className="mt-4 rounded-xl border p-4 transition-all"
            style={{
              backgroundColor: activeThemeObj.bgHex,
              borderColor: activeThemeObj.borderHex,
              boxShadow: `0 10px 30px -10px ${activeThemeObj.glowColor}`,
            }}
          >
            <div className="flex items-center justify-between mb-3 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" style={{ color: activeThemeObj.accentHex }} />
                <span className="font-medium text-white">Live Atmosphere Preview</span>
                <span className="text-slate-400">— {activeThemeObj.name}</span>
              </div>
              <span
                className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${activeThemeObj.accentHex}20`,
                  color: activeThemeObj.accentHex,
                }}
              >
                Applied in real time
              </span>
            </div>

            <div
              className="rounded-lg p-3 border text-xs space-y-2"
              style={{
                backgroundColor: activeThemeObj.surfaceHex,
                borderColor: activeThemeObj.borderHex,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-serif font-medium text-slate-200">ReflectAI Journal</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-medium text-white"
                  style={{ backgroundColor: activeThemeObj.accentHex }}
                >
                  Active Accent
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">
                "The evening stillness provides room for honest reflection. Tranquil shadows settle across the canvas."
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 mt-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: activeThemeObj.accentHex }}
            />
            <span>Saved to account & device</span>
          </div>

          <button
            id="confirm-theme-button"
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-md transition-all cursor-pointer hover:opacity-90"
            style={{
              backgroundColor: activeThemeObj.accentHex,
            }}
          >
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
