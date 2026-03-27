"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Loader2, Check, Wifi, WifiOff } from "lucide-react";
import type { ConnectionStatus } from "@/lib/yjs/useCollaboration";

interface StatusBarProps {
  editor: Editor | null;
  saveStatus?: "idle" | "saving" | "saved";
  isCollaborative?: boolean;
  connectionStatus?: ConnectionStatus;
  collaboratorRole?: "owner" | "editor" | "viewer" | null;
}

export function StatusBar({
  editor,
  saveStatus = "idle",
  isCollaborative = false,
  connectionStatus = "disconnected",
  collaboratorRole,
}: StatusBarProps) {
  const [stats, setStats] = useState({ characters: 0, words: 0, line: 1, col: 1 });

  useEffect(() => {
    if (!editor) return;

    function update() {
      if (!editor?.state?.doc) return;
      const text = editor.state.doc.textContent;
      const characters = text.length;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;

      // Get cursor position as line:col
      const { from } = editor.state.selection;
      const resolved = editor.state.doc.resolve(from);
      // Count block-level nodes before cursor as "lines"
      let line = 1;
      editor.state.doc.nodesBetween(0, from, (node, pos) => {
        if (node.isBlock && pos < from && pos > 0) line++;
      });
      const col = resolved.parentOffset + 1;

      setStats({ characters, words, line, col });
    }

    update();
    editor.on("selectionUpdate", update);
    editor.on("update", update);

    return () => {
      editor.off("selectionUpdate", update);
      editor.off("update", update);
    };
  }, [editor]);

  return (
    <div className="flex items-center gap-3 px-4 py-1 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 text-[11px] text-stone-400 dark:text-stone-500 select-none shrink-0">
      {/* Cursor position */}
      <span>Ln {stats.line}, Col {stats.col}</span>

      <span className="text-stone-300 dark:text-stone-700">|</span>

      {/* Word / character count */}
      <span>{stats.words} {stats.words === 1 ? "word" : "words"}</span>
      <span>{stats.characters} {stats.characters === 1 ? "char" : "chars"}</span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Role badge for collaborative notes */}
      {isCollaborative && collaboratorRole && (
        <span className="capitalize">{collaboratorRole}</span>
      )}

      {/* Connection status for collaborative notes */}
      {isCollaborative && (
        <span className="flex items-center gap-1" title={`Connection: ${connectionStatus}`}>
          {connectionStatus === "connected" ? (
            <Wifi size={10} className="text-green-500" />
          ) : connectionStatus === "connecting" ? (
            <Wifi size={10} className="text-yellow-500 animate-pulse" />
          ) : (
            <WifiOff size={10} className="text-red-500" />
          )}
          <span className="capitalize">{connectionStatus}</span>
        </span>
      )}

      {/* Save status */}
      {!isCollaborative && (
        <span className="flex items-center gap-1">
          {saveStatus === "saving" ? (
            <>
              <Loader2 size={10} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : saveStatus === "saved" ? (
            <>
              <Check size={10} className="text-green-500" />
              <span>Saved</span>
            </>
          ) : (
            <span>Ready</span>
          )}
        </span>
      )}
    </div>
  );
}
