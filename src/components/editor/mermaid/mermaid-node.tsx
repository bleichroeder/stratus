"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import "tldraw/tldraw.css";

function WhiteboardNodeView(props: ReactNodeViewProps) {
  const { node, updateAttributes, editor } = props;
  const snapshot = node.attrs.snapshot;
  const [expanded, setExpanded] = useState(false);
  const [TldrawModule, setTldrawModule] = useState<typeof import("tldraw") | null>(null);
  const editorRef = useRef<any>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy-load tldraw
  useEffect(() => {
    import("tldraw").then(setTldrawModule);
  }, []);

  const handleMount = useCallback(
    (tlEditor: any) => {
      editorRef.current = tlEditor;

      // Load existing snapshot if present
      if (snapshot && Object.keys(snapshot).length > 0) {
        try {
          tlEditor.loadSnapshot(snapshot);
        } catch {
          // Ignore corrupt snapshots
        }
      }

      // Set read-only if viewer
      if (!editor.isEditable) {
        tlEditor.updateInstanceState({ isReadonly: true });
      }

      // Auto-save on changes (debounced)
      tlEditor.store.listen(
        () => {
          if (!editor.isEditable) return;
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => {
            if (editorRef.current) {
              const snap = editorRef.current.getSnapshot();
              updateAttributes({ snapshot: snap });
            }
          }, 500);
        },
        { scope: "document", source: "user" }
      );
    },
    [snapshot, editor, updateAttributes]
  );

  // Cleanup save timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const height = expanded ? 600 : (node.attrs.height as number) || 400;

  if (!TldrawModule) {
    return (
      <NodeViewWrapper className="my-4" contentEditable={false}>
        <div
          className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex items-center justify-center text-sm text-stone-400"
          style={{ height: `${height}px` }}
        >
          Loading whiteboard...
        </div>
      </NodeViewWrapper>
    );
  }

  const { Tldraw } = TldrawModule;

  return (
    <NodeViewWrapper className="my-4" contentEditable={false}>
      <div className="rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden" ref={containerRef}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-stone-50 dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
            Whiteboard
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>

        {/* Canvas */}
        <div style={{ height: `${height}px` }} className="bg-white dark:bg-stone-950">
          <Tldraw
            onMount={handleMount}
            autoFocus={false}
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const MermaidBlock = Node.create({
  // Keep the name "mermaidBlock" for backwards compatibility with any existing content
  // This is now a whiteboard/diagram block powered by tldraw
  name: "mermaidBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      snapshot: {
        default: {},
        parseHTML: (element) => {
          const data = element.getAttribute("data-snapshot");
          try {
            return data ? JSON.parse(data) : {};
          } catch {
            return {};
          }
        },
        renderHTML: (attributes) => ({
          "data-snapshot": JSON.stringify(attributes.snapshot),
        }),
      },
      height: {
        default: 400,
        parseHTML: (element) =>
          Number(element.getAttribute("data-height")) || 400,
        renderHTML: (attributes) => ({
          "data-height": attributes.height,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "mermaid-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WhiteboardNodeView);
  },
});
