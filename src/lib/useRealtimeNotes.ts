"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Note } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Subscribe to Supabase Realtime changes on the notes table.
 * Merges INSERT / UPDATE / DELETE events into the notes state.
 * Calls onExternalChange(noteId) for any change not originating from this tab.
 */
export function useRealtimeNotes(
  userId: string | null,
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
  activeTabId: string | null,
  onExternalChange?: (noteId: string) => void
) {
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    let channel: RealtimeChannel;

    channel = supabase
      .channel("notes-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const note = payload.new as Note;
          if (note.archived_at || note.is_template) return;
          setNotes((prev) => {
            if (prev.some((n) => n.id === note.id)) return prev;
            return [note, ...prev];
          });
          onExternalChange?.(note.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Note;
          if (updated.is_template) return;

          if (updated.archived_at) {
            // Note was archived — remove from active list
            setNotes((prev) => prev.filter((n) => n.id !== updated.id));
            return;
          }

          setNotes((prev) => {
            const exists = prev.some((n) => n.id === updated.id);
            if (!exists) {
              // Unarchived or newly visible — add it
              return [updated, ...prev];
            }
            return prev.map((n) => {
              if (n.id !== updated.id) return n;
              // If this note is actively being edited, only update metadata
              if (n.id === activeTabIdRef.current) {
                return { ...n, title: updated.title, updated_at: updated.updated_at, parent_id: updated.parent_id, archived_at: updated.archived_at };
              }
              return updated;
            });
          });
          onExternalChange?.(updated.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setNotes((prev) => prev.filter((n) => n.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, setNotes, onExternalChange]);
}
