"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Note } from "@/lib/types";

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
 * Compute the unseen set from notes and a viewed map.
 */
function computeUnseen(
  notes: Note[],
  viewedMap: Map<string, string>,
  parentMap: Map<string, string | null>,
  activeNoteId: string | null
): Set<string> {
  const unseen = new Set<string>();
  for (const note of notes) {
    if (note.is_folder || note.is_template) continue;
    if (note.id === activeNoteId) continue;
    const lastViewed = viewedMap.get(note.id);
    if (!lastViewed || note.updated_at > lastViewed) {
      unseen.add(note.id);
      for (const ancestorId of getAncestorIds(note.id, parentMap)) {
        unseen.add(ancestorId);
      }
    }
  }
  return unseen;
}

/**
 * Tracks which notes have been updated since the user last viewed them.
 * Backed by Supabase note_views table so read status syncs across devices.
 */
export function useUnseenNotes(notes: Note[], activeNoteId: string | null, userId: string | null) {
  const [unseenIds, setUnseenIds] = useState<Set<string>>(new Set());
  const viewedMapRef = useRef<Map<string, string>>(new Map());
  const activeNoteIdRef = useRef(activeNoteId);
  activeNoteIdRef.current = activeNoteId;
  const loadedRef = useRef(false);

  // Build parent lookup map
  const parentMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const note of notes) {
      map.set(note.id, note.parent_id);
    }
    return map;
  }, [notes]);

  // Load viewed timestamps from Supabase on mount
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    supabase
      .from("note_views")
      .select("note_id, viewed_at")
      .eq("user_id", userId)
      .then(({ data }) => {
        const map = viewedMapRef.current;
        for (const row of data || []) {
          map.set(row.note_id, row.viewed_at);
        }
        loadedRef.current = true;
        // Recompute after loading
        setUnseenIds(computeUnseen(notes, map, parentMap, activeNoteIdRef.current));
      });
  }, [userId]); // Only load once on mount

  // Subscribe to note_views changes (from other devices) via realtime
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const channel = supabase
      .channel("note-views-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "note_views",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = (payload.new as { note_id: string; viewed_at: string });
          if (row.note_id && row.viewed_at) {
            viewedMapRef.current.set(row.note_id, row.viewed_at);
            setUnseenIds(computeUnseen(notes, viewedMapRef.current, parentMap, activeNoteIdRef.current));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, notes, parentMap]);

  // Recompute unseen set whenever notes change (after initial load)
  useEffect(() => {
    if (!loadedRef.current) return;
    setUnseenIds(computeUnseen(notes, viewedMapRef.current, parentMap, activeNoteIdRef.current));
  }, [notes, parentMap]);

  // Keep viewed timestamp up to date for the active note
  useEffect(() => {
    if (!activeNoteId || !userId) return;
    const note = notes.find((n) => n.id === activeNoteId);
    if (!note) return;
    const current = viewedMapRef.current.get(note.id);
    if (!current || note.updated_at > current) {
      viewedMapRef.current.set(note.id, note.updated_at);
      // Persist to Supabase (fire-and-forget)
      const supabase = createClient();
      supabase
        .from("note_views")
        .upsert({ user_id: userId, note_id: note.id, viewed_at: note.updated_at }, { onConflict: "user_id,note_id" })
        .then();
      setUnseenIds(computeUnseen(notes, viewedMapRef.current, parentMap, activeNoteIdRef.current));
    }
  }, [notes, activeNoteId, userId, parentMap]);

  // Mark a note as seen
  const markSeen = useCallback((noteId: string) => {
    if (!userId) return;
    const note = notes.find((n) => n.id === noteId);
    const viewedAt = note?.updated_at ?? new Date().toISOString();
    viewedMapRef.current.set(noteId, viewedAt);

    // Persist to Supabase (fire-and-forget)
    const supabase = createClient();
    supabase
      .from("note_views")
      .upsert({ user_id: userId, note_id: noteId, viewed_at: viewedAt }, { onConflict: "user_id,note_id" })
      .then();

    setUnseenIds(computeUnseen(notes, viewedMapRef.current, parentMap, activeNoteIdRef.current));
  }, [notes, parentMap, userId]);

  return { unseenIds, markSeen };
}
