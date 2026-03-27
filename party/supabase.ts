import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    client = createClient(url, key);
  }
  return client;
}

export async function loadNoteContent(
  noteId: string
): Promise<Record<string, unknown> | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("notes")
    .select("content")
    .eq("id", noteId)
    .single();

  if (error) {
    console.error("Failed to load note content:", error);
    return null;
  }

  return data?.content as Record<string, unknown> | null;
}

export async function saveNoteContent(
  noteId: string,
  content: Record<string, unknown>
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from("notes")
    .update({ content })
    .eq("id", noteId);

  if (error) {
    console.error("Failed to save note content:", error);
  }
}

export async function checkAccess(
  noteId: string,
  userId: string
): Promise<{ allowed: boolean; role: "owner" | "editor" | "viewer" }> {
  const supabase = getClient();

  // Check if user is the note owner
  const { data: note, error: noteError } = await supabase
    .from("notes")
    .select("user_id, encrypted")
    .eq("id", noteId)
    .single();

  if (noteError || !note) {
    return { allowed: false, role: "viewer" };
  }

  // Block access to encrypted notes
  if (note.encrypted) {
    return { allowed: false, role: "viewer" };
  }

  if (note.user_id === userId) {
    return { allowed: true, role: "owner" };
  }

  // Check collaborator table
  const { data: collab, error: collabError } = await supabase
    .from("note_collaborators")
    .select("role")
    .eq("note_id", noteId)
    .eq("user_id", userId)
    .single();

  if (collabError || !collab) {
    return { allowed: false, role: "viewer" };
  }

  return {
    allowed: true,
    role: collab.role as "editor" | "viewer",
  };
}
