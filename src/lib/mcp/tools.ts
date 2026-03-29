import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { tiptapToPlainText } from "@/lib/ai";
import { markdownToTiptap } from "@/lib/import/markdown-to-tiptap";
import { type ApiKeyRecord, hasScope } from "./auth";
import type { Json } from "@/lib/types";

export function registerTools(server: McpServer, apiKey: ApiKeyRecord) {
  const userId = apiKey.user_id;
  const supabase = createServiceClient();

  // ── SEARCH NOTES ──────────────────────────────────
  if (hasScope(apiKey, "notes:search")) {
    server.tool(
      "search_notes",
      "Search notes by content or title. Returns matching notes with snippets.",
      {
        query: z.string().describe("Search query"),
        limit: z.number().min(1).max(50).default(10).describe("Max results"),
      },
      async ({ query, limit }) => {
        // Use the fts column directly since search_notes() RPC uses auth.uid()
        const words = query
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => `${w}:*`)
          .join(" & ");

        const { data, error } = await supabase
          .from("notes")
          .select("id, title, content, updated_at")
          .eq("user_id", userId)
          .is("archived_at", null)
          .eq("is_folder", false)
          .eq("is_template", false)
          .eq("encrypted", false)
          .textSearch("fts", words)
          .order("updated_at", { ascending: false })
          .limit(limit);

        if (error) {
          return {
            content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          };
        }

        const results = (data || []).map((n) => ({
          id: n.id,
          title: n.title,
          snippet: tiptapToPlainText(n.content as Json).slice(0, 200) + "...",
          updated_at: n.updated_at,
        }));

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(results, null, 2) },
          ],
        };
      }
    );
  }

  // ── GET NOTE ──────────────────────────────────────
  if (hasScope(apiKey, "notes:read")) {
    server.tool(
      "get_note",
      "Get a note by ID. Returns full content as markdown.",
      {
        note_id: z.string().uuid().describe("Note ID"),
      },
      async ({ note_id }) => {
        const { data, error } = await supabase
          .from("notes")
          .select("*")
          .eq("id", note_id)
          .eq("user_id", userId)
          .single();

        if (error || !data) {
          return { content: [{ type: "text" as const, text: "Note not found." }] };
        }

        const plain = tiptapToPlainText(data.content as Json);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: data.id,
                  title: data.title,
                  content: plain,
                  created_at: data.created_at,
                  updated_at: data.updated_at,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    server.tool(
      "get_daily_note",
      "Get today's daily note (or a specific date). Daily notes use the title format 'March 29, 2026' and live in a Daily Notes / year / month folder hierarchy.",
      {
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Date in YYYY-MM-DD format. Defaults to today."),
      },
      async ({ date }) => {
        const d = date ? new Date(date + "T00:00:00") : new Date();
        const title = d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const { data, error } = await supabase
          .from("notes")
          .select("*")
          .eq("user_id", userId)
          .eq("title", title)
          .eq("is_folder", false)
          .is("archived_at", null)
          .single();

        if (error || !data) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No daily note found for ${title}.`,
              },
            ],
          };
        }

        const plain = tiptapToPlainText(data.content as Json);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: data.id,
                  title: data.title,
                  content: plain,
                  created_at: data.created_at,
                  updated_at: data.updated_at,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );
  }

  // ── CREATE NOTE ───────────────────────────────────
  if (hasScope(apiKey, "notes:write")) {
    server.tool(
      "create_note",
      "Create a new note. Content should be plain text or markdown — it will be stored as a simple document.",
      {
        title: z.string().describe("Note title"),
        content: z.string().describe("Note content (plain text or markdown)"),
      },
      async ({ title, content }) => {
        const tiptapContent = markdownToTiptap(content);

        const { data, error } = await supabase
          .from("notes")
          .insert({
            user_id: userId,
            title,
            content: tiptapContent,
          })
          .select("id, title, created_at")
          .single();

        if (error) {
          return {
            content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Created note "${data.title}" (${data.id})`,
            },
          ],
        };
      }
    );

    server.tool(
      "append_to_daily_note",
      "Append content to today's daily note. Creates the note (inside Daily Notes / year / month folders) if it doesn't exist. Ideal for logging work summaries.",
      {
        content: z
          .string()
          .describe("Content to append (plain text or markdown)"),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Date in YYYY-MM-DD format. Defaults to today."),
      },
      async ({ content, date }) => {
        const d = date ? new Date(date + "T00:00:00") : new Date();
        const title = d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const yearStr = String(d.getFullYear());
        const monthStr = d.toLocaleDateString("en-US", { month: "long" });

        // Try to find existing daily note by title
        const { data: existing } = await supabase
          .from("notes")
          .select("id, content")
          .eq("user_id", userId)
          .eq("title", title)
          .eq("is_folder", false)
          .is("archived_at", null)
          .single();

        if (existing) {
          // Append new content nodes to existing document
          const existingDoc = (existing.content as Record<string, unknown>) || {
            type: "doc",
            content: [],
          };
          const existingContent = (existingDoc.content as unknown[]) || [];
          const newDoc = markdownToTiptap(content);
          const newNodes = (newDoc.content as unknown[]) || [];
          const merged = {
            type: "doc",
            content: [...existingContent, ...newNodes],
          };

          const { error } = await supabase
            .from("notes")
            .update({
              content: merged as unknown as Json,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (error) {
            return {
              content: [{ type: "text" as const, text: `Error: ${error.message}` }],
            };
          }
          return {
            content: [
              {
                type: "text" as const,
                text: `Appended to daily note "${title}".`,
              },
            ],
          };
        } else {
          // Create folder hierarchy: Daily Notes / year / month
          const findOrCreateFolder = async (
            folderTitle: string,
            parentId: string | null
          ): Promise<string> => {
            let query = supabase
              .from("notes")
              .select("id")
              .eq("user_id", userId)
              .eq("title", folderTitle)
              .eq("is_folder", true)
              .is("archived_at", null);

            query = parentId === null
              ? query.is("parent_id", null)
              : query.eq("parent_id", parentId);

            const { data: folder } = await query.single();

            if (folder) return folder.id;

            const { data: created, error } = await supabase
              .from("notes")
              .insert({
                user_id: userId,
                title: folderTitle,
                is_folder: true,
                parent_id: parentId,
              })
              .select("id")
              .single();

            if (error || !created) throw new Error(error?.message || "Failed to create folder");
            return created.id;
          };

          try {
            const rootId = await findOrCreateFolder("Daily Notes", null);
            const yearId = await findOrCreateFolder(yearStr, rootId);
            const monthId = await findOrCreateFolder(monthStr, yearId);

            const { error } = await supabase.from("notes").insert({
              user_id: userId,
              title,
              content: markdownToTiptap(content),
              parent_id: monthId,
            });

            if (error) {
              return {
                content: [{ type: "text" as const, text: `Error: ${error.message}` }],
              };
            }
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Created daily note "${title}".`,
                },
              ],
            };
          } catch (err) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error creating daily note: ${err instanceof Error ? err.message : String(err)}`,
                },
              ],
            };
          }
        }
      }
    );

    server.tool(
      "update_note",
      "Update an existing note's title or content.",
      {
        note_id: z.string().uuid().describe("Note ID"),
        title: z.string().optional().describe("New title"),
        content: z
          .string()
          .optional()
          .describe("New content (replaces existing)"),
      },
      async ({ note_id, title, content }) => {
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (title) updates.title = title;
        if (content) updates.content = markdownToTiptap(content);

        const { error } = await supabase
          .from("notes")
          .update(updates)
          .eq("id", note_id)
          .eq("user_id", userId);

        if (error) {
          return {
            content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          };
        }
        return {
          content: [
            { type: "text" as const, text: `Updated note ${note_id}.` },
          ],
        };
      }
    );
  }
}