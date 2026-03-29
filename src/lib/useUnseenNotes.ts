"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Note } from "@/lib/types";

const STORAGE_KEY = "stratus-note-viewed";

function loadViewedMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveViewedMap(map: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * Tracks which notes have been updated since the user last viewed them.
 * Returns a Set of "unseen" note IDs and a markSeen function.
 */
export function useUnseenNotes(notes: Note[]) {
  const [unseenIds, setUnseenIds] = useState<Set<string>>(new Set());
  const viewedRef = useRef<Record<string, string>>(loadViewedMap());

  // Recompute unseen set whenever notes change
  useEffect(() => {
    const viewed = viewedRef.current;
    const unseen = new Set<string>();

    for (const note of notes) {
      if (note.is_folder || note.is_template) continue;
      const lastViewed = viewed[note.id];
      if (!lastViewed || new Date(note.updated_at) > new Date(lastViewed)) {
        unseen.add(note.id);
      }
    }

    setUnseenIds(unseen);
  }, [notes]);

  // Mark a note as seen — update localStorage and remove from unseen set
  const markSeen = useCallback((noteId: string) => {
    const viewed = viewedRef.current;
    viewed[noteId] = new Date().toISOString();
    viewedRef.current = viewed;
    saveViewedMap(viewed);
    setUnseenIds((prev) => {
      if (!prev.has(noteId)) return prev;
      const next = new Set(prev);
      next.delete(noteId);
      return next;
    });
  }, []);

  // Prune stale entries when notes change
  useEffect(() => {
    const viewed = viewedRef.current;
    const noteIds = new Set(notes.map((n) => n.id));
    let pruned = false;
    for (const id of Object.keys(viewed)) {
      if (!noteIds.has(id)) {
        delete viewed[id];
        pruned = true;
      }
    }
    if (pruned) saveViewedMap(viewed);
  }, [notes]);

  return { unseenIds, markSeen };
}
