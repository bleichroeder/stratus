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
import { CalloutBlock } from "./callout/callout-node";
import { MeetingMeta } from "./meeting-meta";
import type { Json } from "@/lib/types";
import type { Note } from "@/lib/types";
import { ShareButton } from "./share-button";
import { StatusBar } from "./status-bar";
import { useCollaboration } from "@/lib/yjs/useCollaboration";
import { getUserColor } from "@/lib/yjs/awareness";
import { CollaborateButton } from "./collaborate-button";
import { PresenceAvatars } from "./presence-avatars";
import type { NoteCollaborator } from "@/lib/types";
import "./cursor-styles.css";

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
  isEncrypted?: boolean;
  onShare?: () => Promise<string>;
  onUnshare?: () => void;
  saveStatus?: "idle" | "saving" | "saved";
  isCollaborative?: boolean;
  collaboratorRole?: "owner" | "editor" | "viewer" | null;
  currentUserId?: string;
  currentUserEmail?: string;
  currentUserDisplayName?: string;
  isOwner?: boolean;
  isInsideVault?: boolean;
  collaborators?: NoteCollaborator[];
  onCollaboratorsChange?: (collaborators: NoteCollaborator[]) => void;
  editorRef?: React.MutableRefObject<{ insertContent: (content: Json) => void; setContent: (content: Json) => void } | null>;
  onSummarize?: () => void;
  aiLoading?: boolean;
  bannerSlot?: React.ReactNode;
}

export function NoteEditor({
  noteId,
  content,
  onUpdate,
  onImageUpload,
  notes,
  onSelectNote,
  sharedToken,
  sharedAt,
  isEncrypted = false,
  onShare,
  onUnshare,
  saveStatus = "idle",
  isCollaborative = false,
  collaboratorRole,
  currentUserId,
  currentUserEmail,
  currentUserDisplayName,
  isOwner = true,
  isInsideVault = false,
  collaborators = [],
  onCollaboratorsChange,
  editorRef,
  onSummarize,
  aiLoading,
  bannerSlot,
}: NoteEditorProps) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const noteIdRef = useRef(noteId);
  const onUpdateRef = useRef(onUpdate);
  const isCollaborativeRef = useRef(isCollaborative);

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
  isCollaborativeRef.current = isCollaborative;

  // Collaboration hook — only active when isCollaborative is true
  const { ydoc, provider, connectionStatus, collabExtensions } = useCollaboration({
    noteId,
    isCollaborative,
    userName: currentUserDisplayName || currentUserEmail,
    userColor: getUserColor(currentUserId ?? ""),
  });

  // Only treat as collaborative once Yjs extensions are loaded
  const collabReady = isCollaborative && collabExtensions.length > 0;

  // Build extensions list — collaboration extensions added conditionally
  const extensions = [
    StarterKit.configure({
      codeBlock: false,
      // Disable built-in history when collaborative (Yjs has its own undo manager)
      ...(collabReady ? { history: false } : {}),
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
    CalloutBlock,
    MeetingMeta,
    // Collaboration extensions (dynamically loaded by useCollaboration hook)
    ...collabExtensions,
  ];

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      // When collaborative AND Yjs extensions are loaded, content comes from Yjs
      content: collabReady
        ? undefined
        : (content as Record<string, unknown> | undefined),
      editable: collaboratorRole !== "viewer",
      editorProps: {
        attributes: {
          class:
            "prose prose-stone max-w-none focus:outline-none min-h-full px-4 py-3 md:px-8 md:py-4",
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
                    const node = view.state.schema.nodes.image.create({
                      src: url,
                    });
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
                      const node = view.state.schema.nodes.image.create({
                        src: url,
                      });
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
        // Skip debounced save for collaborative notes — Yjs handles sync,
        // and the client saves to Supabase periodically for search/share compat
        if (!isCollaborativeRef.current) {
          if (debounceTimer.current) clearTimeout(debounceTimer.current);
          const savedNoteId = noteIdRef.current;
          debounceTimer.current = setTimeout(() => {
            if (noteIdRef.current === savedNoteId) {
              onUpdateRef.current(editor.getJSON() as Json);
            }
          }, 500);
        }

        // Check for [[ pattern (wiki link suggest)
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
    },
    // Re-create editor when collaboration state changes
    [collabReady, collabExtensions]
  );

  // Periodic Supabase save for collaborative notes (keeps search/share in sync)
  useEffect(() => {
    if (!isCollaborative || !editor) return;
    const interval = setInterval(() => {
      if (editor && noteIdRef.current) {
        onUpdateRef.current(editor.getJSON() as Json);
      }
    }, 10000); // Save every 10 seconds
    return () => clearInterval(interval);
  }, [isCollaborative, editor]);

  // Save to Supabase on unmount for collaborative notes
  useEffect(() => {
    if (!isCollaborative || !editor) return;
    return () => {
      if (editor && noteIdRef.current) {
        onUpdateRef.current(editor.getJSON() as Json);
      }
    };
  }, [isCollaborative, editor]);

  const handleWikiSelect = useCallback(
    (note: Note) => {
      if (!editor) return;
      const { from, to } = wikiSuggest;

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

  // When the noteId changes on non-collaborative notes, load new content
  useEffect(() => {
    if (isCollaborative) return; // Yjs handles content for collaborative notes
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (editor) {
      setTimeout(() => {
        // emitUpdate: false prevents onUpdate from firing — this is a
        // navigation load, not a user edit, so it should not trigger a save
        editor.commands.setContent(
          content
            ? (content as Record<string, unknown>)
            : { type: "doc", content: [] },
          { emitUpdate: false }
        );
      }, 0);
    }
    setWikiSuggest((prev) => ({ ...prev, open: false }));
  }, [noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update editable state when role changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(collaboratorRole !== "viewer");
    }
  }, [editor, collaboratorRole]);

  // Expose editor ref for template insertion
  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor
        ? {
            insertContent: (content: Json) => {
              const doc = content as { content?: unknown[] };
              if (doc?.content) {
                editor.chain().focus().insertContent(doc.content as unknown[]).run();
              }
            },
            setContent: (content: Json) => {
              editor.commands.setContent(content as Record<string, unknown>);
            },
          }
        : null;
    }
  }, [editor, editorRef]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center border-b border-stone-200 dark:border-stone-800">
        <div className="flex-1 border-b-0">
          <EditorToolbar
            editor={editor}
            onImageUpload={onImageUpload}
            disabled={collaboratorRole === "viewer"}
            onSummarize={onSummarize}
            aiLoading={aiLoading}
          />
        </div>
        {/* Presence avatars for collaborative notes */}
        {isCollaborative && (
          <PresenceAvatars provider={provider} />
        )}
        {/* Collaborate button */}
        {onCollaboratorsChange && (
          <div className="px-1 bg-white dark:bg-stone-950">
            <CollaborateButton
              noteId={noteId}
              isEncrypted={isEncrypted}
              isInsideVault={isInsideVault}
              isOwner={isOwner}
              collaborators={collaborators}
              onCollaboratorsChange={onCollaboratorsChange}
            />
          </div>
        )}
        {onShare && onUnshare && (
          <div className="px-2 bg-white dark:bg-stone-950">
            <ShareButton
              noteId={noteId}
              sharedToken={sharedToken ?? null}
              sharedAt={sharedAt ?? null}
              isEncrypted={isEncrypted}
              onShare={onShare}
              onUnshare={onUnshare}
            />
          </div>
        )}
      </div>
      {bannerSlot}
      <div className="flex-1 overflow-y-auto relative">
        {/* Viewer badge */}
        {collaboratorRole === "viewer" && (
          <div className="sticky top-0 z-10 flex justify-center py-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
              View only
            </span>
          </div>
        )}
        <EditorContent editor={editor} />
        <Backlinks
          currentNoteId={noteId}
          notes={notes}
          onSelectNote={onSelectNote}
        />
      </div>
      <StatusBar
        editor={editor}
        saveStatus={saveStatus}
        isCollaborative={isCollaborative}
        connectionStatus={connectionStatus}
        collaboratorRole={collaboratorRole}
      />
      <WikiLinkSuggest
        open={wikiSuggest.open}
        query={wikiSuggest.query}
        notes={notes}
        position={wikiSuggest.position}
        onSelect={handleWikiSelect}
        onClose={() =>
          setWikiSuggest((prev) => ({ ...prev, open: false }))
        }
      />
    </div>
  );
}
