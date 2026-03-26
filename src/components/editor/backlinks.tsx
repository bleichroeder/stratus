"use client";

import { FileText, ArrowUpRight } from "lucide-react";
import type { Note } from "@/lib/types";

interface BacklinksProps {
  currentNoteId: string;
  notes: Note[];
  onSelectNote: (id: string) => void;
}

export function Backlinks({ currentNoteId, notes, onSelectNote }: BacklinksProps) {
  // Find notes that reference the current note via wiki links
  const backlinks = notes.filter((note) => {
    if (note.id === currentNoteId || note.is_folder) return false;
    const content = JSON.stringify(note.content ?? "");
    return content.includes(currentNoteId);
  });

  if (backlinks.length === 0) return null;

  return (
    <div className="border-t border-stone-200 dark:border-stone-800 px-8 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2">
        Backlinks ({backlinks.length})
      </h3>
      <div className="space-y-1">
        {backlinks.map((note) => (
          <button
            key={note.id}
            onClick={() => onSelectNote(note.id)}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 transition-colors group"
          >
            <FileText size={14} className="shrink-0" />
            <span className="truncate">{note.title}</span>
            <ArrowUpRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100 ml-auto" />
          </button>
        ))}
      </div>
    </div>
  );
}
