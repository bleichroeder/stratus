"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  FileText,
  FilePlus,
  FolderPlus,
  CalendarDays,
  Moon,
  Sun,
  Search,
  Folder,
  XCircle,
  LayoutTemplate,
  BookmarkPlus,
  Sparkles,
} from "lucide-react";
import type { Note } from "@/lib/types";
import { useTheme } from "@/components/theme-provider";
import { searchNotes, type SearchResult } from "@/lib/notes";

interface Action {
  id: string;
  label: string;
  icon: React.ReactNode;
  section: "notes" | "actions";
  onSelect: () => void;
}

interface CommandPaletteProps {
  notes: Note[];
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onCreateFolder: () => void;
  onDailyNote: () => void;
  onCloseAllTabs: () => void;
  onNewFromTemplate?: () => void;
  onSaveAsTemplate?: () => void;
  onSummarize?: () => void;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette({
  notes,
  onSelectNote,
  onCreateNote,
  onCreateFolder,
  onDailyNote,
  onCloseAllTabs,
  onNewFromTemplate,
  onSaveAsTemplate,
  onSummarize,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [ftsResults, setFtsResults] = useState<SearchResult[]>([]);
  const ftsTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setFtsResults([]);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Debounced FTS for command palette
  useEffect(() => {
    if (!open || !query.trim()) {
      setFtsResults([]);
      return;
    }
    if (ftsTimer.current) clearTimeout(ftsTimer.current);
    ftsTimer.current = setTimeout(async () => {
      const results = await searchNotes(query);
      setFtsResults(results);
    }, 200);
    return () => { if (ftsTimer.current) clearTimeout(ftsTimer.current); };
  }, [query, open]);

  const close = useCallback(() => setOpen(false), []);

  const allResults = useMemo(() => {
    const actions: Action[] = [
      {
        id: "new-note",
        label: "New note",
        icon: <FilePlus size={16} />,
        section: "actions",
        onSelect: () => { onCreateNote(); close(); },
      },
      {
        id: "new-folder",
        label: "New folder",
        icon: <FolderPlus size={16} />,
        section: "actions",
        onSelect: () => { onCreateFolder(); close(); },
      },
      {
        id: "daily-note",
        label: "Open daily note",
        icon: <CalendarDays size={16} />,
        section: "actions",
        onSelect: () => { onDailyNote(); close(); },
      },
      {
        id: "toggle-theme",
        label: theme === "light" ? "Switch to dark mode" : "Switch to light mode",
        icon: theme === "light" ? <Moon size={16} /> : <Sun size={16} />,
        section: "actions",
        onSelect: () => { toggleTheme(); close(); },
      },
      {
        id: "close-all-tabs",
        label: "Close all tabs",
        icon: <XCircle size={16} />,
        section: "actions",
        onSelect: () => { onCloseAllTabs(); close(); },
      },
      ...(onNewFromTemplate
        ? [
            {
              id: "new-from-template",
              label: "New note from template",
              icon: <LayoutTemplate size={16} />,
              section: "actions" as const,
              onSelect: () => { onNewFromTemplate(); close(); },
            },
          ]
        : []),
      ...(onSaveAsTemplate
        ? [
            {
              id: "save-as-template",
              label: "Save current note as template",
              icon: <BookmarkPlus size={16} />,
              section: "actions" as const,
              onSelect: () => { onSaveAsTemplate(); close(); },
            },
          ]
        : []),
      ...(onSummarize
        ? [
            {
              id: "ai-summarize",
              label: "Summarize note with AI",
              icon: <Sparkles size={16} />,
              section: "actions" as const,
              onSelect: () => { onSummarize(); close(); },
            },
          ]
        : []),
    ];

    // Use FTS results when available, otherwise fall back to fuzzy match
    const noteResults: Action[] = (ftsResults.length > 0 && query)
      ? ftsResults.map((r) => ({
          id: r.id,
          label: r.title,
          icon: <FileText size={16} />,
          section: "notes" as const,
          onSelect: () => { onSelectNote(r.id); close(); },
        }))
      : notes
          .filter((n) => !n.is_folder && fuzzyMatch(query, n.title))
          .slice(0, 15)
          .map((n) => ({
            id: n.id,
            label: n.title,
            icon: <FileText size={16} />,
            section: "notes" as const,
            onSelect: () => { onSelectNote(n.id); close(); },
          }));

    const folderResults: Action[] = notes
      .filter((n) => n.is_folder && fuzzyMatch(query, n.title))
      .slice(0, 5)
      .map((n) => ({
        id: n.id,
        label: n.title,
        icon: <Folder size={16} />,
        section: "notes" as const,
        onSelect: () => { close(); },
      }));

    const actionResults = query
      ? actions.filter((a) => fuzzyMatch(query, a.label))
      : actions;

    return [...noteResults, ...folderResults, ...actionResults];
  }, [notes, query, theme, close, onCreateNote, onCreateFolder, onDailyNote, onSelectNote, toggleTheme, ftsResults, onCloseAllTabs, onNewFromTemplate, onSaveAsTemplate, onSummarize]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function scrollToItem(index: number) {
    setTimeout(() => {
      const container = scrollContainerRef.current;
      const el = document.getElementById(`cmd-item-${index}`);
      if (!container || !el) return;

      const elTop = el.offsetTop;
      const elBottom = elTop + el.offsetHeight;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;

      if (elBottom > viewBottom) {
        container.scrollTop = elBottom - container.clientHeight;
      } else if (elTop < viewTop) {
        container.scrollTop = elTop;
      }
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(selectedIndex + 1, allResults.length - 1);
      setSelectedIndex(next);
      scrollToItem(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(selectedIndex - 1, 0);
      setSelectedIndex(next);
      scrollToItem(next);
    } else if (e.key === "Enter") {
      e.preventDefault();
      allResults[selectedIndex]?.onSelect();
    } else if (e.key === "Escape") {
      close();
    }
  }

  if (!open) return null;

  // Split into sections for display but keep flat indexing
  const noteSection: { item: Action; idx: number }[] = [];
  const actionSection: { item: Action; idx: number }[] = [];
  allResults.forEach((item, idx) => {
    if (item.section === "notes") noteSection.push({ item, idx });
    else actionSection.push({ item, idx });
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] md:pt-[20vh] px-4 md:px-0 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-200 dark:border-stone-800">
          <Search size={16} className="shrink-0 text-stone-400 dark:text-stone-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes or type a command..."
            className="flex-1 bg-transparent text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-block text-[10px] text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div ref={scrollContainerRef} className="max-h-[300px] overflow-y-auto scrollbar-thin py-1">
          {allResults.length === 0 && (
            <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-6">
              No results found
            </p>
          )}

          {noteSection.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Notes
              </div>
              {noteSection.map(({ item, idx }) => (
                <button
                  key={item.id}
                  id={`cmd-item-${idx}`}
                  onClick={item.onSelect}
                  className={`flex items-center gap-3 w-full px-4 py-2 text-sm text-left transition-colors ${
                    idx === selectedIndex
                      ? "bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                      : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50"
                  }`}
                >
                  <span className="shrink-0 text-stone-400 dark:text-stone-500">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </>
          )}

          {actionSection.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Actions
              </div>
              {actionSection.map(({ item, idx }) => (
                <button
                  key={item.id}
                  id={`cmd-item-${idx}`}
                  onClick={item.onSelect}
                  className={`flex items-center gap-3 w-full px-4 py-2 text-sm text-left transition-colors ${
                    idx === selectedIndex
                      ? "bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                      : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50"
                  }`}
                >
                  <span className="shrink-0 text-stone-400 dark:text-stone-500">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-stone-200 dark:border-stone-800 text-[10px] text-stone-400 dark:text-stone-500">
          <span><kbd className="bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-1 py-0.5">↑↓</kbd> navigate</span>
          <span><kbd className="bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-1 py-0.5">↵</kbd> select</span>
          <span><kbd className="bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-1 py-0.5">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
