"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Typography from "@tiptap/extension-typography";
import { common, createLowlight } from "lowlight";
import { useEffect, useRef, useState, useCallback } from "react";
import { EditorToolbar } from "./toolbar";
import { SlashCommands } from "./slash-commands";
import { WikiLink, createWikiLinkPlugin } from "./wiki-link";
import { WikiLinkSuggest } from "./wiki-link-suggest";
import { Backlinks } from "./backlinks";
import { SketchBlock } from "./sketch/sketch-node";
import type { Json } from "@/lib/types";
import type { Note } from "@/lib/types";
import { ShareButton } from "./share-button";

const lowlight = createLowlight(common);

interface NoteEditorProps {
  noteId: string;
  content: Json | null;
  onUpdate: (content: Json) => void;
  onImageUpload?: (file: File) => Promise<string | null>;
  notes: Note[];
  onSelectNote: (id: string) => void;
  sharedToken?: string | null;
  sharedAt?: string | null;
  onShare?: () => Promise<string>;
  onUnshare?: () => void;
}

export function NoteEditor({ noteId, content, onUpdate, onImageUpload, notes, onSelectNote, sharedToken, sharedAt, onShare, onUnshare }: NoteEditorProps) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const noteIdRef = useRef(noteId);
  const onUpdateRef = useRef(onUpdate);

  // Wiki link suggest state
  const [wikiSuggest, setWikiSuggest] = useState<{
    open: boolean;
    query: string;
    from: number;
    to: number;
    position: { top: number; left: number } | null;
  }>({ open: false, query: "", from: 0, to: 0, position: null });

  onUpdateRef.current = onUpdate;
  noteIdRef.current = noteId;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing... Type "/" for commands',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: "rounded-lg max-w-full",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline cursor-pointer hover:text-blue-800",
        },
      }),
      Underline,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Typography,
      SlashCommands,
      WikiLink,
      SketchBlock,
    ],
    content: content as Record<string, unknown> | undefined,
    editorProps: {
      attributes: {
        class:
          "prose prose-stone max-w-none focus:outline-none min-h-[calc(100vh-12rem)] px-4 py-3 md:px-8 md:py-4",
        spellcheck: "true",
        autocorrect: "on",
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer?.files.length) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith("image/") && onImageUpload) {
            event.preventDefault();
            onImageUpload(file).then((url) => {
              if (url) {
                const { tr } = view.state;
                const pos = view.posAtCoords({
                  left: event.clientX,
                  top: event.clientY,
                })?.pos;
                if (pos !== undefined) {
                  const node = view.state.schema.nodes.image.create({ src: url });
                  view.dispatch(tr.insert(pos, node));
                }
              }
            });
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/") && onImageUpload) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) {
                onImageUpload(file).then((url) => {
                  if (url) {
                    const node = view.state.schema.nodes.image.create({ src: url });
                    const tr = view.state.tr.replaceSelectionWith(node);
                    view.dispatch(tr);
                  }
                });
              }
              return true;
            }
          }
        }
        return false;
      },
      handleClick: (view, _pos, event) => {
        // Handle wiki link clicks
        const target = event.target as HTMLElement;
        const wikiLink = target.closest('[data-type="wiki-link"]');
        if (wikiLink) {
          const linkNoteId = wikiLink.getAttribute("data-note-id");
          if (linkNoteId) {
            onSelectNote(linkNoteId);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      const savedNoteId = noteIdRef.current;
      debounceTimer.current = setTimeout(() => {
        if (noteIdRef.current === savedNoteId) {
          onUpdateRef.current(editor.getJSON() as Json);
        }
      }, 500);

      // Check for [[ pattern
      const { $from } = editor.state.selection;
      const textBefore = $from.parent.textBetween(
        Math.max(0, $from.parentOffset - 50),
        $from.parentOffset,
        undefined,
        "\ufffc"
      );
      const match = textBefore.match(/\[\[([^\]]*?)$/);
      if (match) {
        const coords = editor.view.coordsAtPos($from.pos);
        setWikiSuggest({
          open: true,
          query: match[1],
          from: $from.pos - match[0].length,
          to: $from.pos,
          position: { top: coords.top, left: coords.left },
        });
      } else if (wikiSuggest.open) {
        setWikiSuggest((prev) => ({ ...prev, open: false }));
      }
    },
  });

  const handleWikiSelect = useCallback(
    (note: Note) => {
      if (!editor) return;
      const { from, to } = wikiSuggest;

      // Delete the [[ and query text, insert the wiki link then unset the mark
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContent({
          type: "text",
          marks: [
            {
              type: "wikiLink",
              attrs: { noteId: note.id, title: note.title },
            },
          ],
          text: note.title,
        })
        .unsetMark("wikiLink")
        .insertContent({ type: "text", text: " " })
        .run();

      setWikiSuggest((prev) => ({ ...prev, open: false }));
    },
    [editor, wikiSuggest]
  );

  // When the noteId changes, cancel any pending save and load new content
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (editor) {
      editor.commands.setContent(
        content ? (content as Record<string, unknown>) : { type: "doc", content: [] }
      );
    }
    setWikiSuggest((prev) => ({ ...prev, open: false }));
  }, [noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b border-stone-200 dark:border-stone-800">
        <div className="flex-1 border-b-0">
          <EditorToolbar editor={editor} onImageUpload={onImageUpload} />
        </div>
        {onShare && onUnshare && (
          <div className="px-2 bg-white dark:bg-stone-950">
            <ShareButton
              noteId={noteId}
              sharedToken={sharedToken ?? null}
              sharedAt={sharedAt ?? null}
              onShare={onShare}
              onUnshare={onUnshare}
            />
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
        <Backlinks
          currentNoteId={noteId}
          notes={notes}
          onSelectNote={onSelectNote}
        />
      </div>
      <WikiLinkSuggest
        open={wikiSuggest.open}
        query={wikiSuggest.query}
        notes={notes}
        position={wikiSuggest.position}
        onSelect={handleWikiSelect}
        onClose={() => setWikiSuggest((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
