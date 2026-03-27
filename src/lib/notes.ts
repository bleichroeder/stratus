import { createClient } from "@/lib/supabase/client";
import type { Note, Json, NoteCollaborator } from "@/lib/types";

function getSupabase() {
  return createClient();
}

export async function getNotes(): Promise<Note[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getArchivedNotes(): Promise<Note[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getNote(id: string): Promise<Note | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function createNote(
  note: { title?: string; content?: Json | null; parent_id?: string | null; is_folder?: boolean; encrypted?: boolean } = {}
): Promise<Note> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      title: note.title ?? "Untitled",
      content: note.content ?? null,
      parent_id: note.parent_id ?? null,
      is_folder: note.is_folder ?? false,
      encrypted: note.encrypted ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateNote(
  id: string,
  updates: { title?: string; content?: Json | null; parent_id?: string | null; encrypted?: boolean }
): Promise<Note> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function archiveNote(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("notes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function archiveNoteWithChildren(id: string, allNotes: Note[]): Promise<string[]> {
  const supabase = getSupabase();
  const idsToArchive = collectChildIds(id, allNotes);
  const { error } = await supabase
    .from("notes")
    .update({ archived_at: new Date().toISOString() })
    .in("id", idsToArchive);
  if (error) throw error;
  return idsToArchive;
}

function collectChildIds(id: string, notes: Note[]): string[] {
  const ids = [id];
  const children = notes.filter((n) => n.parent_id === id);
  for (const child of children) {
    ids.push(...collectChildIds(child.id, notes));
  }
  return ids;
}

export async function restoreNote(id: string): Promise<Note> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notes")
    .update({ archived_at: null, parent_id: null })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function permanentlyDeleteNote(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

export interface SearchResult {
  id: string;
  title: string;
  headline: string;
  rank: number;
}

export async function searchNotes(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("search_notes", {
    p_query: trimmed,
    p_limit: 20,
  });

  if (error) {
    console.error("Search error:", error);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    headline: r.headline as string,
    rank: r.rank as number,
  }));
}

export async function shareNote(id: string): Promise<{ token: string; shared_at: string }> {
  const token = crypto.randomUUID();
  const shared_at = new Date().toISOString();
  const supabase = getSupabase();
  const { error } = await supabase
    .from("notes")
    .update({ shared_token: token, shared_at })
    .eq("id", id);
  if (error) throw error;
  return { token, shared_at };
}

export async function unshareNote(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("notes")
    .update({ shared_token: null, shared_at: null })
    .eq("id", id);
  if (error) throw error;
}

// --- Collaboration ---

export async function getCollaborators(noteId: string): Promise<NoteCollaborator[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("note_collaborators")
    .select("*")
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function addCollaborator(
  noteId: string,
  userId: string,
  role: "editor" | "viewer" = "editor"
): Promise<NoteCollaborator> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("note_collaborators")
    .insert({
      note_id: noteId,
      user_id: userId,
      role,
      invited_by: user?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeCollaborator(noteId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("note_collaborators")
    .delete()
    .eq("note_id", noteId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function getCollaborativeNoteIds(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("note_collaborators")
    .select("note_id");

  if (error) throw error;

  // Return unique note IDs
  return [...new Set((data ?? []).map((r) => r.note_id))];
}

export async function updateCollaboratorRole(
  noteId: string,
  userId: string,
  role: "editor" | "viewer"
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("note_collaborators")
    .update({ role })
    .eq("note_id", noteId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function getSharedWithMeNotes(): Promise<Note[]> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Get note IDs where the current user is a collaborator
  const { data: collabs, error: collabError } = await supabase
    .from("note_collaborators")
    .select("note_id")
    .eq("user_id", user.id);

  if (collabError) throw collabError;
  if (!collabs || collabs.length === 0) return [];

  const noteIds = collabs.map((c) => c.note_id);
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .in("id", noteIds)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function uploadImage(
  file: File,
  options?: { noteId?: string; isCollaborative?: boolean }
): Promise<string | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const ext = file.name.split(".").pop();
  const fileName =
    options?.isCollaborative && options?.noteId
      ? `shared/${options.noteId}/${crypto.randomUUID()}.${ext}`
      : `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("note-attachments")
    .upload(fileName, file);

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("note-attachments").getPublicUrl(fileName);

  return publicUrl;
}
