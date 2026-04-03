"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { formatDailyNoteTitle } from "@/lib/context-hints";
import type { WikiLinkPip } from "@/components/calendar/day-cell";

interface DayPopoverProps {
  date: Date;
  preview: string | null;
  hasNote: boolean;
  wikiLinks: WikiLinkPip[];
  onOpenNote: () => void;
  onCreateNote: () => void;
  onClickPip: (noteId: string) => void;
  onClose: () => void;
}

export function DayPopover({
  date, preview, hasNote, wikiLinks,
  onOpenNote, onCreateNote, onClickPip, onClose,
}: DayPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  const title = formatDailyNoteTitle(date);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-8 bg-black/20 dark:bg-black/40">
      <div
        ref={panelRef}
        className="flex flex-col w-[400px] max-h-[70vh] rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-stone-800">
          <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
            {title}
          </span>
          <div className="flex items-center gap-2">
            {hasNote ? (
              <button
                onClick={onOpenNote}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                <ExternalLink size={12} />
                Open note
              </button>
            ) : (
              <button
                onClick={onCreateNote}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                <Plus size={12} />
                Create note
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 dark:text-stone-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {preview ? (
            <div className="px-4 py-3">
              <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
                {preview}
              </p>
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-stone-400 dark:text-stone-500">
                {hasNote ? "Empty note" : "No daily note"}
              </p>
            </div>
          )}
        </div>

        {/* Wiki links */}
        {wikiLinks.length > 0 && (
          <div className="px-4 py-3 border-t border-stone-200 dark:border-stone-800">
            <p className="text-[10px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">
              Links
            </p>
            <div className="flex flex-wrap gap-1.5">
              {wikiLinks.map((pip) => (
                <button
                  key={pip.id}
                  onClick={() => onClickPip(pip.id)}
                  className={`px-2 py-0.5 text-xs rounded-full truncate max-w-[180px] transition-colors ${
                    pip.isDailyNote
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60"
                      : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
                  }`}
                  title={pip.title}
                >
                  {pip.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
