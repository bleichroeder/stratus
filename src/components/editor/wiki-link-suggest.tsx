"use client";

import { useState, useEffect, useRef } from "react";
import { FileText } from "lucide-react";
import type { Note } from "@/lib/types";

interface WikiLinkSuggestProps {
  open: boolean;
  query: string;
  notes: Note[];
  position: { top: number; left: number } | null;
  onSelect: (note: Note) => void;
  onClose: () => void;
}

export function WikiLinkSuggest({
  open,
  query,
  notes,
  position,
  onSelect,
  onClose,
}: WikiLinkSuggestProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = notes
    .filter((n) => !n.is_folder && n.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open, filtered, selectedIndex, onSelect, onClose]);

  if (!open || !position || filtered.length === 0) return null;

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl overflow-hidden py-1"
      style={{ top: position.top + 24, left: position.left }}
    >
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
        Link to note
      </div>
      {filtered.map((note, index) => (
        <button
          key={note.id}
          onClick={() => onSelect(note)}
          className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors ${
            index === selectedIndex
              ? "bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50"
          }`}
        >
          <FileText size={14} className="shrink-0 text-stone-400" />
          <span className="truncate">{note.title}</span>
        </button>
      ))}
    </div>
  );
}
