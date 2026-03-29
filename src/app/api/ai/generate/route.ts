import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt, buildUserPrompt, truncateContextNotes, type AIAction, type ContextNoteInput } from "@/lib/ai";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI not configured" }, { status: 500 });
  }

  let body: {
    action?: string;
    templateId?: string;
    prompt?: string;
    context?: string;
    noteTitle?: string;
    contextNotes?: ContextNoteInput[];
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = body.action as AIAction;
  if (!action || !["template-fill", "summarize", "freeform"].includes(action)) {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  const contextNotes = body.contextNotes ? truncateContextNotes(body.contextNotes) : undefined;
  const hasContext = !!contextNotes && contextNotes.length > 0;

  const systemPrompt = buildSystemPrompt(action, body.templateId, hasContext);
  const userPrompt = buildUserPrompt(action, {
    context: body.context,
    noteTitle: body.noteTitle,
    prompt: body.prompt,
    templateId: body.templateId,
    contextNotes,
  });

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: hasContext ? 2048 : 1024,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Gemini API error:", res.status, errorText);

      if (res.status === 429) {
        return Response.json(
          { error: "Rate limit reached. Try again in a moment." },
          { status: 429 }
        );
      }

      return Response.json(
        { error: `AI generation failed (${res.status}). Please try again.` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";

    return Response.json({ text });
  } catch (err) {
    console.error("AI fetch error:", err);
    return Response.json(
      { error: "Failed to reach AI service." },
      { status: 502 }
    );
  }
}
