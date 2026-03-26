import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { WikiLink } from "@/components/editor/wiki-link";
import { SketchBlockStatic } from "@/components/editor/sketch/sketch-node-static";

const lowlight = createLowlight(common);
const SHARE_EXPIRY_DAYS = 7;

export default async function SharedNotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = createServiceClient();
  const { data: note, error } = await supabase
    .from("notes")
    .select("id, title, content, shared_at, created_at, updated_at")
    .eq("shared_token", token)
    .single();

  if (error || !note) {
    notFound();
  }

  // Check expiry
  if (note.shared_at) {
    const sharedTime = new Date(note.shared_at).getTime();
    const expiryTime = sharedTime + SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (Date.now() > expiryTime) {
      // Fallback cleanup: clear the expired token
      await supabase
        .from("notes")
        .update({ shared_token: null, shared_at: null })
        .eq("id", note.id);

      return (
        <div className="min-h-screen bg-white dark:bg-stone-950 flex items-center justify-center">
          <div className="text-center space-y-3 px-4">
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              Link expired
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm">
              This shared note link has expired. The author can share it again to generate a new link.
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Shared via <span className="font-mono font-semibold">stratus</span>
            </p>
          </div>
        </div>
      );
    }
  }

  let html = "";
  if (note.content) {
    try {
      html = generateHTML(note.content as Record<string, unknown>, [
        StarterKit.configure({ codeBlock: false }),
        TaskList,
        TaskItem,
        Image,
        Link,
        Underline,
        CodeBlockLowlight.configure({ lowlight }),
        WikiLink,
        SketchBlockStatic,
      ]);
    } catch {
      html = "<p>Unable to render this note.</p>";
    }
  }

  const formattedDate = new Date(note.updated_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-white dark:bg-stone-950">
      <article className="max-w-3xl mx-auto px-4 py-12 md:px-8 md:py-16">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100 mb-2">
            {note.title}
          </h1>
          <p className="text-sm text-stone-400 dark:text-stone-500">
            Last updated {formattedDate}
          </p>
        </header>

        <div
          className="tiptap prose prose-stone dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>

      <footer className="border-t border-stone-200 dark:border-stone-800 py-6 text-center">
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Shared via <span className="font-mono font-semibold">stratus</span>
        </p>
      </footer>
    </div>
  );
}
