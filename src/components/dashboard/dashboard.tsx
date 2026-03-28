"use client";

import type { Note, Json, CalendarEvent } from "@/lib/types";
import { FileText, Plus, CalendarDays, Lock, Clock, Users, LayoutTemplate } from "lucide-react";
import { useMemo } from "react";
import { UpcomingMeetings } from "./upcoming-meetings";
import type { VaultStatus } from "@/components/vault/vault-context";

interface DashboardProps {
  notes: Note[];
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onDailyNote: () => void;
  onNewFromTemplate: () => void;
  creatingNote?: boolean;
  creatingDailyNote?: boolean;
  vaultStatus: VaultStatus;
  onVaultUnlock: () => void;
  userName?: string | null;
  isGoogleUser?: boolean;
  onPrepareMeetingNote?: (event: CalendarEvent) => void;
  preparingNoteForEventId?: string | null;
  collaborativeNoteIds?: Set<string>;
  sharedWithMeNotes?: Note[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function todayFormatted(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function extractPreview(content: Json | null): string {
  if (!content) return "";
  try {
    // TipTap JSON: content is { type: "doc", content: [...] }
    const doc = content as { type?: string; content?: Array<Record<string, unknown>> };
    if (doc?.type === "doc" && Array.isArray(doc.content)) {
      const lines: string[] = [];
      for (const node of doc.content) {
        if (lines.length >= 2) break;
        const text = extractTextFromNode(node);
        if (text.trim()) lines.push(text.trim());
      }
      return lines.join("\n");
    }
    // Fallback: stringify and truncate
    const str = typeof content === "string" ? content : JSON.stringify(content);
    return str.slice(0, 120);
  } catch {
    return "";
  }
}

function extractTextFromNode(node: Record<string, unknown>): string {
  if (node.text && typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) {
    return (node.content as Array<Record<string, unknown>>)
      .map(extractTextFromNode)
      .join("");
  }
  return "";
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function Dashboard({ notes, onSelectNote, onCreateNote, onDailyNote, onNewFromTemplate, creatingNote, creatingDailyNote, vaultStatus, onVaultUnlock, userName, isGoogleUser, onPrepareMeetingNote, preparingNoteForEventId, collaborativeNoteIds = new Set(), sharedWithMeNotes = [] }: DashboardProps) {
  const recentNotes = useMemo(() => {
    const sharedIds = new Set(sharedWithMeNotes.map((n) => n.id));
    return notes
      .filter((n) => !n.is_folder && !n.is_template && !n.archived_at && !collaborativeNoteIds.has(n.id) && !sharedIds.has(n.id))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8);
  }, [notes, collaborativeNoteIds, sharedWithMeNotes]);


  const allCollabNotes = useMemo(() => {
    const sharedIds = new Set(sharedWithMeNotes.map((n) => n.id));
    const ownedCollab = notes.filter(
      (n) => collaborativeNoteIds.has(n.id) && !sharedIds.has(n.id) && !n.is_folder && !n.archived_at
    );
    return [...ownedCollab, ...sharedWithMeNotes]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [notes, collaborativeNoteIds, sharedWithMeNotes]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Greeting + quick actions */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
              {getGreeting()}{userName ? `, ${userName}` : ""}.
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
              Today is {todayFormatted()}.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onCreateNote}
              disabled={creatingNote}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50 transition-colors"
            >
              <Plus size={16} />
              {creatingNote ? "Creating..." : "New note"}
            </button>
            <button
              onClick={onDailyNote}
              disabled={creatingDailyNote}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 transition-colors"
            >
              <CalendarDays size={16} />
              {creatingDailyNote ? "Creating..." : "Daily note"}
            </button>
            <button
              onClick={onNewFromTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              <LayoutTemplate size={16} />
              Template
            </button>
          </div>
        </div>

        {/* Upcoming meetings (Google users only) */}
        {isGoogleUser && onPrepareMeetingNote && (
          <UpcomingMeetings
            onPrepareMeetingNote={onPrepareMeetingNote}
            preparingNoteForEventId={preparingNoteForEventId ?? null}
          />
        )}

        {/* Recent notes */}
        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Recent notes
          </h2>

          {recentNotes.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={32} strokeWidth={1} className="mx-auto text-stone-300 dark:text-stone-700 mb-3" />
              <p className="text-sm text-stone-400 dark:text-stone-500">
                No notes yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentNotes.map((note) => {
                const isEncrypted = note.encrypted;
                const preview = isEncrypted ? null : extractPreview(note.content);

                return (
                  <button
                    key={note.id}
                    onClick={() => {
                      if (isEncrypted && vaultStatus !== "unlocked") {
                        onVaultUnlock();
                      } else {
                        onSelectNote(note.id);
                      }
                    }}
                    className="text-left p-4 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-sm transition-all group cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate group-hover:text-stone-700 dark:group-hover:text-stone-200">
                        {note.title || "Untitled"}
                      </h3>
                      <div className="flex items-center gap-1 shrink-0">
                        {collaborativeNoteIds.has(note.id) && (
                          <Users size={12} className="text-blue-500 dark:text-blue-400 mt-0.5" />
                        )}
                        {isEncrypted && (
                          <Lock size={12} className="text-stone-400 dark:text-stone-500 mt-0.5" />
                        )}
                      </div>
                    </div>

                    {isEncrypted ? (
                      <p className="text-xs text-stone-400 dark:text-stone-600 italic">
                        {vaultStatus === "unlocked" ? "Encrypted content" : "Unlock vault to view"}
                      </p>
                    ) : preview ? (
                      <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                        {preview}
                      </p>
                    ) : (
                      <p className="text-xs text-stone-400 dark:text-stone-600 italic">
                        Empty note
                      </p>
                    )}

                    <div className="flex items-center gap-1 mt-2.5 text-stone-400 dark:text-stone-600">
                      <Clock size={10} />
                      <span className="text-[10px]">{timeAgo(note.updated_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Shared with me */}
        {allCollabNotes.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-blue-500 dark:text-blue-400" />
              <h2 className="text-sm font-medium text-stone-700 dark:text-stone-300">
                Collaborations
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allCollabNotes.slice(0, 4).map((note) => (
                <button
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  className="text-left p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/20 hover:border-blue-200 dark:hover:border-blue-800/50 hover:shadow-sm transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                      {note.title || "Untitled"}
                    </h3>
                    <Users size={12} className="shrink-0 text-blue-500 dark:text-blue-400 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-1 mt-2.5 text-stone-400 dark:text-stone-600">
                    <Clock size={10} />
                    <span className="text-[10px]">{timeAgo(note.updated_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
