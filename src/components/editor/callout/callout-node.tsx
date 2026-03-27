"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type ReactNodeViewProps } from "@tiptap/react";
import { useCallback } from "react";
import { Info, AlertTriangle, Lightbulb, AlertCircle } from "lucide-react";

const CALLOUT_TYPES = {
  info: { icon: Info, label: "Info", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", iconColor: "text-blue-500" },
  warning: { icon: AlertTriangle, label: "Warning", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", iconColor: "text-amber-500" },
  tip: { icon: Lightbulb, label: "Tip", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", iconColor: "text-green-500" },
  error: { icon: AlertCircle, label: "Error", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", iconColor: "text-red-500" },
} as const;

type CalloutType = keyof typeof CALLOUT_TYPES;

function CalloutNodeView(props: ReactNodeViewProps) {
  const { node, updateAttributes, editor } = props;
  const type = (node.attrs.calloutType as CalloutType) || "info";
  const config = CALLOUT_TYPES[type];
  const Icon = config.icon;

  const cycleType = useCallback(() => {
    if (!editor.isEditable) return;
    const types = Object.keys(CALLOUT_TYPES) as CalloutType[];
    const nextIndex = (types.indexOf(type) + 1) % types.length;
    updateAttributes({ calloutType: types[nextIndex] });
  }, [type, updateAttributes, editor]);

  return (
    <NodeViewWrapper className="my-3">
      <div className={`flex gap-3 p-4 rounded-lg border ${config.bg} ${config.border}`}>
        <button
          onClick={cycleType}
          className={`shrink-0 mt-0.5 ${config.iconColor} ${editor.isEditable ? "cursor-pointer hover:opacity-70" : ""}`}
          title={editor.isEditable ? `Click to change type (${config.label})` : config.label}
          contentEditable={false}
        >
          <Icon size={18} />
        </button>
        <div className="flex-1 min-w-0 prose prose-stone dark:prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed text-sm">
          <NodeViewContent />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const CalloutBlock = Node.create({
  name: "calloutBlock",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      calloutType: {
        default: "info",
        parseHTML: (element) => element.getAttribute("data-callout-type") || "info",
        renderHTML: (attributes) => ({ "data-callout-type": attributes.calloutType }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout-block" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },
});
