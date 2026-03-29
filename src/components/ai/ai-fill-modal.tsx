"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Sparkles, Search, X, Plus, Loader2, Lock, FileText } from "lucide-react";
import { searchNotes, type SearchResult } from "@/lib/notes";
import type { ContextHint } from "@/lib/templates";

export interface ContextNote {
  id: string;
  title: string;
  preview: string;
  content: string;
}

interface AIFillModalProps {
  open: boolean;
  onClose: () => void;
  templateId: string;
  contextHint: ContextHint;
  onGenerate: (params: {
    contextNotes: ContextNote[];
    instructions?: string;
  }) => void;
  loading: boolean;
}

export function AIFillModal({
  open,
  onClose,
  templateId,
  contextHint,
  onGenerate,
  loading,
}: AIFillModalProps) {
  const [suggestedNotes, setSuggestedNotes] = useState<ContextNote[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manualNotes, setManualNotes] = useState<ContextNote[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [instructions, setInstructions] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch suggested notes when modal opens
  useEffect(() => {
    if (!open) return;
    // Reset state
    setManualNotes([]);
    setSearchQuery("");
    setSearchResults([]);
    setInstructions("");

    if (contextHint.type === "none") {
      setSuggestedNotes([]);
      setSelectedIds(new Set());
      return;
    }

    setSuggestionsLoading(true);
    fetch("/api/ai/context-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hint: contextHint }),
    })
      .then((res) => res.json())
      .then((data) => {
        const notes: ContextNote[] = data.notes ?? [];
        setSuggestedNotes(notes);
        setSelectedIds(new Set(notes.map((n) => n.id)));
      })
      .catch(() => {
        setSuggestedNotes([]);
        setSelectedIds(new Set());
      })
      .finally(() => setSuggestionsLoading(false));
  }, [open, contextHint]);

  // Debounced search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchNotes(query);
      setSearchResults(results);
      setSearching(false);
    }, 300);
  }, []);

  const toggleNote = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addManualNote = useCallback((result: SearchResult) => {
    // Don't add duplicates
    if (suggestedNotes.some((n) => n.id === result.id) || manualNotes.some((n) => n.id === result.id)) {
      // Just select it
      setSelectedIds((prev) => new Set([...prev, result.id]));
      return;
    }

    // Fetch full content for this note
    fetch("/api/ai/context-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteIds: [result.id] }),
    })
      .then((res) => res.json())
      .then((data) => {
        const notes: ContextNote[] = data.notes ?? [];
        if (notes.length > 0) {
          setManualNotes((prev) => [...prev, notes[0]]);
          setSelectedIds((prev) => new Set([...prev, notes[0].id]));
        }
      });

    setSearchQuery("");
    setSearchResults([]);
  }, [suggestedNotes, manualNotes]);

  const removeManualNote = useCallback((id: string) => {
    setManualNotes((prev) => prev.filter((n) => n.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(() => {
    const allNotes = [...suggestedNotes, ...manualNotes];
    const selected = allNotes.filter((n) => selectedIds.has(n.id));
    onGenerate({
      contextNotes: selected,
      instructions: instructions.trim() || undefined,
    });
  }, [suggestedNotes, manualNotes, selectedIds, instructions, onGenerate]);

  const selectedCount = selectedIds.size;
  const allNotes = [...suggestedNotes, ...manualNotes];
  // Filter search results to exclude already-added notes
  const addedIds = new Set(allNotes.map((n) => n.id));
  const filteredResults = searchResults.filter((r) => !addedIds.has(r.id));

  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title="Fill with AI">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto -mx-4 px-4">
        {/* Suggested notes */}
        {suggestionsLoading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-stone-400 dark:text-stone-500">
            <Loader2 size={14} className="animate-spin" />
            Finding relevant notes...
          </div>
        ) : (suggestedNotes.length > 0 || manualNotes.length > 0) ? (
          <div className="space-y-2">
            <label className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">
              Context Notes
              {selectedCount > 0 && (
                <span className="ml-1.5 normal-case tracking-normal text-violet-500">
                  ({selectedCount} selected)
                </span>
              )}
            </label>

            {/* Suggested notes list */}
            {suggestedNotes.length > 0 && (
              <div className="space-y-1">
                {suggestedNotes.map((note) => (
                  <NoteCheckbox
                    key={note.id}
                    note={note}
                    checked={selectedIds.has(note.id)}
                    onToggle={() => toggleNote(note.id)}
                    suggested
                  />
                ))}
              </div>
            )}

            {/* Manually added notes */}
            {manualNotes.length > 0 && (
              <div className="space-y-1">
                {manualNotes.map((note) => (
                  <NoteCheckbox
                    key={note.id}
                    note={note}
                    checked={selectedIds.has(note.id)}
                    onToggle={() => toggleNote(note.id)}
                    onRemove={() => removeManualNote(note.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : contextHint.type !== "none" ? (
          <p className="text-xs text-stone-400 dark:text-stone-500 py-2">
            No suggested notes found. Search to add notes as context.
          </p>
        ) : null}

        {/* Search to add notes */}
        <div className="space-y-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search notes to add as context..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            {searching && (
              <Loader2
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-stone-400"
              />
            )}
          </div>

          {/* Search results dropdown */}
          {filteredResults.length > 0 && (
            <div className="border border-stone-200 dark:border-stone-700 rounded-md overflow-hidden max-h-[160px] overflow-y-auto">
              {filteredResults.slice(0, 5).map((result) => (
                <button
                  key={result.id}
                  onClick={() => addManualNote(result)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors border-b border-stone-100 dark:border-stone-800 last:border-0"
                >
                  <Plus size={14} className="shrink-0 text-violet-500" />
                  <span className="truncate text-stone-900 dark:text-stone-100">
                    {result.title}
                  </span>
                </button>
              ))}
            </div>
          )}

          {searchQuery.trim() && !searching && filteredResults.length === 0 && searchResults.length > 0 && (
            <p className="text-xs text-stone-400 dark:text-stone-500 px-1">
              All matching notes already added
            </p>
          )}
        </div>

        {/* Additional instructions */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">
            Instructions (optional)
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Any specific guidance for the AI..."
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-stone-200 dark:border-stone-700">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-3 py-1.5 text-sm rounded-md text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {loading ? "Generating..." : "Fill with AI"}
        </button>
      </div>
    </Modal>
  );
}

function NoteCheckbox({
  note,
  checked,
  onToggle,
  onRemove,
  suggested,
}: {
  note: ContextNote;
  checked: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  suggested?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-stone-50 dark:hover:bg-stone-800/50 group">
      <button onClick={onToggle} className="shrink-0">
        <div
          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            checked
              ? "bg-violet-600 border-violet-600"
              : "border-stone-300 dark:border-stone-600"
          }`}
        >
          {checked && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </button>
      <FileText size={14} className="shrink-0 text-stone-400 dark:text-stone-500" />
      <div className="min-w-0 flex-1" onClick={onToggle}>
        <div className="text-sm text-stone-900 dark:text-stone-100 truncate cursor-pointer">
          {note.title}
        </div>
        <div className="text-xs text-stone-400 dark:text-stone-500 truncate">
          {note.preview}
        </div>
      </div>
      {suggested && (
        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
          Suggested
        </span>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-opacity"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
