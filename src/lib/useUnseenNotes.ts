"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { Note } from "@/lib/types";

const STORAGE_KEY = "stratus-note-viewed";
const INITIALIZED_KEY = "stratus-note-viewed-init";

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
export function useUnseenNotes(notes: Note[], activeNoteId: string | null) {
  const [unseenIds, setUnseenIds] = useState<Set<string>>(new Set());
  const viewedRef = useRef<Record<string, string>>(loadViewedMap());
  const activeNoteIdRef = useRef(activeNoteId);
  activeNoteIdRef.current = activeNoteId;

  // Seed the viewed map on first use — mark all existing notes as seen
  // so only genuinely new/updated notes after this point show the dot.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || notes.length === 0) return;
    if (localStorage.getItem(INITIALIZED_KEY)) {
      seededRef.current = true;
      return;
    }
    const viewed = viewedRef.current;
    for (const note of notes) {
      if (note.is_folder || note.is_template) continue;
      if (!viewed[note.id]) {
        viewed[note.id] = note.updated_at;
      }
    }
    viewedRef.current = viewed;
    saveViewedMap(viewed);
    localStorage.setItem(INITIALIZED_KEY, "1");
    seededRef.current = true;
  }, [notes]);

  // Build parent lookup map
  const parentMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const note of notes) {
      map.set(note.id, note.parent_id);
    }
    return map;
  }, [notes]);

  // Keep the viewed timestamp up to date for the active note.
  // This handles save-on-open and any other writes that bump updated_at
  // while the user is looking at the note.
  useEffect(() => {
    if (!activeNoteId) return;
    const note = notes.find((n) => n.id === activeNoteId);
    if (!note) return;
    const viewed = viewedRef.current;
    if (!viewed[note.id] || note.updated_at > viewed[note.id]) {
      viewed[note.id] = note.updated_at;
      saveViewedMap(viewed);
    }
  }, [notes, activeNoteId]);

  // Recompute unseen set whenever notes change
  useEffect(() => {
    const viewed = viewedRef.current;
    const unseen = new Set<string>();

    for (const note of notes) {
      if (note.is_folder || note.is_template) continue;
      // The active note is never unseen — the user is looking at it
      if (note.id === activeNoteIdRef.current) continue;
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
    const note = notes.find((n) => n.id === noteId);
    const viewed = viewedRef.current;
    viewed[noteId] = note?.updated_at ?? "9999-12-31T23:59:59.999Z";
    viewedRef.current = viewed;
    saveViewedMap(viewed);

    // Recompute the full unseen set from scratch to correctly clear ancestor folders
    const activeId = activeNoteIdRef.current;
    setUnseenIds(() => {
      const unseen = new Set<string>();
      for (const note of notes) {
        if (note.is_folder || note.is_template) continue;
        if (note.id === activeId) continue;
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
