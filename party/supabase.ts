import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let clientEnvKey: string | null = null;

function getClient(env?: Record<string, unknown>): SupabaseClient {
  const url = (
    env?.SUPABASE_URL ?? env?.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  ) as string | undefined;
  const key = (
    env?.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  ) as string | undefined;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  // Recreate client if env changed
  const envKey = `${url}:${key}`;
  if (!client || clientEnvKey !== envKey) {
    client = createClient(url, key);
    clientEnvKey = envKey;
  }
  return client;
}

export async function loadNoteContent(
  noteId: string,
  env?: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const supabase = getClient(env);
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
  content: Record<string, unknown>,
  env?: Record<string, unknown>
): Promise<void> {
  const supabase = getClient(env);
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
  userId: string,
  env?: Record<string, unknown>
): Promise<{ allowed: boolean; role: "owner" | "editor" | "viewer" }> {
  const supabase = getClient(env);

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
