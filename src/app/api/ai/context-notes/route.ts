import { createClient } from "@/lib/supabase/server";
import { tiptapToPlainText } from "@/lib/ai";
import { getDailyNoteTitles } from "@/lib/context-hints";
import type { ContextHint } from "@/lib/templates";
import type { Json } from "@/lib/types";

const MAX_NOTES = 7;
const MAX_CONTENT_CHARS = 2000;

interface ContextNoteResult {
  id: string;
  title: string;
  preview: string;
  content: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { hint?: ContextHint; noteIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    let notes: ContextNoteResult[] = [];

    if (body.noteIds && body.noteIds.length > 0) {
      // Direct lookup by IDs
      const ids = body.noteIds.slice(0, MAX_NOTES);
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, content")
        .in("id", ids)
        .eq("encrypted", false)
        .is("archived_at", null);

      if (error) throw error;
      notes = (data ?? []).map((n) => toResult(n));
    } else if (body.hint) {
      notes = await resolveHint(supabase, body.hint, user.id);
    }

    return Response.json({ notes });
  } catch (err) {
    console.error("Context notes error:", err);
    return Response.json({ error: "Failed to fetch context notes" }, { status: 500 });
  }
}

async function resolveHint(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hint: ContextHint,
  userId: string,
): Promise<ContextNoteResult[]> {
  if (hint.type === "daily_recent" || hint.type === "daily_week") {
    const titles = getDailyNoteTitles(hint);
    if (titles.length === 0) return [];

    const { data, error } = await supabase
      .from("notes")
      .select("id, title, content")
      .in("title", titles)
      .eq("is_folder", false)
      .eq("encrypted", false)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(MAX_NOTES);

    if (error) throw error;
    return (data ?? []).map((n) => toResult(n));
  }

  if (hint.type === "tagged" && hint.tag_id) {
    // Get note IDs with this tag
    const { data: tagData, error: tagError } = await supabase
      .from("note_tags")
      .select("note_id")
      .eq("tag_id", hint.tag_id)
      .limit(MAX_NOTES);

    if (tagError) throw tagError;
    if (!tagData || tagData.length === 0) return [];

    const noteIds = tagData.map((t) => t.note_id);
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, content")
      .in("id", noteIds)
      .eq("encrypted", false)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((n) => toResult(n));
  }

  return [];
}

function toResult(note: { id: string; title: string; content: Json | null }): ContextNoteResult {
  const fullText = note.content ? tiptapToPlainText(note.content) : "";
  const truncated = fullText.length > MAX_CONTENT_CHARS
    ? fullText.slice(0, MAX_CONTENT_CHARS) + "..."
    : fullText;
  const preview = fullText.slice(0, 100).replace(/\n/g, " ").trim();

  return {
    id: note.id,
    title: note.title,
    preview: preview || "Empty note",
    content: truncated,
  };
}
