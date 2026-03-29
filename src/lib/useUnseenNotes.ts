"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
 * Collect ancestor folder IDs for a note by walking parent_id up the tree.
 */
function getAncestorIds(noteId: string, parentMap: Map<string, string | null>): string[] {
  const ancestors: string[] = [];
  let current = parentMap.get(noteId) ?? null;
  while (current) {
    ancestors.push(current);
    current = parentMap.get(current) ?? null;
  }
  return ancestors;
}

/**
 * Tracks which notes have been updated since the user last viewed them.
 * Returns a Set of "unseen" note IDs (including ancestor folders) and a markSeen function.
 */
export function useUnseenNotes(notes: Note[]) {
  const [unseenIds, setUnseenIds] = useState<Set<string>>(new Set());
  const viewedRef = useRef<Record<string, string>>(loadViewedMap());

  // Build parent lookup map
  const parentMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const note of notes) {
      map.set(note.id, note.parent_id);
    }
    return map;
  }, [notes]);

  // Recompute unseen set whenever notes change
  useEffect(() => {
    const viewed = viewedRef.current;
    const unseen = new Set<string>();

    for (const note of notes) {
      if (note.is_folder || note.is_template) continue;
      const lastViewed = viewed[note.id];
      if (!lastViewed || note.updated_at > lastViewed) {
        unseen.add(note.id);
        // Bubble up to ancestor folders
        for (const ancestorId of getAncestorIds(note.id, parentMap)) {
          unseen.add(ancestorId);
        }
      }
    }

    setUnseenIds(unseen);
  }, [notes, parentMap]);

  // Mark a note as seen — update localStorage and remove from unseen set
  const markSeen = useCallback((noteId: string) => {
    // Store the note's current updated_at (not "now") so that only genuinely
    // new changes (with a later updated_at) will re-trigger the dot.
    // Fall back to a far-future timestamp to suppress the dot if note isn't found.
    const note = notes.find((n) => n.id === noteId);
    const viewed = viewedRef.current;
    viewed[noteId] = note?.updated_at ?? "9999-12-31T23:59:59.999Z";
    viewedRef.current = viewed;
    saveViewedMap(viewed);

    // Recompute the full unseen set from scratch to correctly clear ancestor folders
    setUnseenIds(() => {
      const unseen = new Set<string>();
      for (const note of notes) {
        if (note.is_folder || note.is_template) continue;
        const lastViewed = viewed[note.id];
        if (!lastViewed || note.updated_at > lastViewed) {
          unseen.add(note.id);
          for (const ancestorId of getAncestorIds(note.id, parentMap)) {
            unseen.add(ancestorId);
          }
        }
      }
      return unseen;
    });
  }, [notes, parentMap]);

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
