import React, { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  MessageSquare,
  Trash2,
  Download,
  Filter,
  Compass,
  Lightbulb,
  FileText,
  MessageCircle,
  Clock,
  Plus,
} from 'lucide-react';
import type { InteractionDocument, ReflectionMode } from '../types';

interface HistorySidebarProps {
  interactions: InteractionDocument[];
  activeInteractionId: string | null;
  onSelectInteraction: (interaction: InteractionDocument) => void;
  onDeleteInteraction: (id: string) => void;
  onNewReflection: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const MODE_ICONS: Record<ReflectionMode, React.ComponentType<{ className?: string }>> = {
  reflection: Compass,
  brainstorm: Lightbulb,
  summary: FileText,
  conversation: MessageCircle,
};

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  interactions,
  activeInteractionId,
  onSelectInteraction,
  onDeleteInteraction,
  onNewReflection,
  isOpen,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModeFilter, setSelectedModeFilter] = useState<string>('all');

  const filteredInteractions = useMemo(() => {
    return interactions.filter((item) => {
      const matchesMode = selectedModeFilter === 'all' || item.mode === selectedModeFilter;
      if (!matchesMode) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const titleMatch = item.title?.toLowerCase().includes(q);
      const contentMatch = item.messages?.some((m) => m.content.toLowerCase().includes(q));
      return titleMatch || contentMatch;
    });
  }, [interactions, searchQuery, selectedModeFilter]);

  const handleExportMarkdown = (e: React.MouseEvent, interaction: InteractionDocument) => {
    e.stopPropagation();
    let md = `# ${interaction.title || 'Journal Reflection'}\n\n`;
    md += `*Mode: ${interaction.mode} | Date: ${new Date(interaction.createdAt).toLocaleDateString()}*\n\n---\n\n`;

    interaction.messages.forEach((m) => {
      const sender = m.role === 'user' ? '### 👤 You' : `### ✨ Gemini (${m.modelUsed || 'Reflection'})`;
      md += `${sender}\n*${new Date(m.timestamp).toLocaleString()}*\n\n${m.content}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${interaction.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'reflection'}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <aside
      id="history-sidebar"
      className="w-full sm:w-80 shrink-0 border-r border-slate-800/80 bg-[#0D0F17]/95 flex flex-col h-[calc(100vh-4rem)] shadow-xl z-20"
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-sm font-semibold text-white">
              Journal History
            </h2>
            <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-400 border border-slate-700/50">
              {interactions.length}
            </span>
          </div>

          <button
            id="sidebar-new-entry-btn"
            onClick={onNewReflection}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-2.5 py-1 text-xs font-semibold text-white hover:from-indigo-600 hover:to-purple-700 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>New</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            id="history-search-input"
            type="text"
            placeholder="Search past entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-[#141724] pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500/80 focus:bg-[#181C2C] focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
          {['all', 'reflection', 'brainstorm', 'summary', 'conversation'].map((f) => (
            <button
              key={f}
              id={`filter-pill-${f}`}
              onClick={() => setSelectedModeFilter(f)}
              className={`rounded-full px-2.5 py-0.5 capitalize whitespace-nowrap transition-colors cursor-pointer ${
                selectedModeFilter === f
                  ? 'bg-indigo-600 text-white font-medium shadow-xs'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Interactions List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filteredInteractions.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 px-4">
            {interactions.length === 0 ? (
              <p>No journal entries yet. Write your first reflection to save it to Firestore.</p>
            ) : (
              <p>No entries matching your filter criteria.</p>
            )}
          </div>
        ) : (
          filteredInteractions.map((item) => {
            const Icon = MODE_ICONS[item.mode] || Compass;
            const isActive = activeInteractionId === item.id;
            const previewText = item.messages[0]?.content || 'Empty entry';

            return (
              <div
                key={item.id}
                id={`history-item-${item.id}`}
                onClick={() => onSelectInteraction(item)}
                className={`group relative flex flex-col rounded-xl p-3 text-left transition-all cursor-pointer border ${
                  isActive
                    ? 'border-indigo-500/60 bg-indigo-950/30 shadow-md shadow-indigo-950/40 text-slate-100'
                    : 'border-slate-800/50 bg-[#121520]/40 hover:border-slate-700 hover:bg-[#161B29] text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span className="truncate text-xs font-semibold text-slate-200 group-hover:text-white">
                      {item.title || 'Untitled Reflection'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      id={`export-btn-${item.id}`}
                      onClick={(e) => handleExportMarkdown(e, item)}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      title="Export as Markdown"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      id={`delete-btn-${item.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete "${item.title || 'this entry'}"?`)) {
                          onDeleteInteraction(item.id);
                        }
                      }}
                      className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-950/50"
                      title="Delete entry"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <p className="line-clamp-2 text-[11px] text-slate-400 leading-relaxed">
                  {previewText}
                </p>

                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/60">
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(item.updatedAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>

                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-2.5 w-2.5" />
                    {item.messages.length} msg{item.messages.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
