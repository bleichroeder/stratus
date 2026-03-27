"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { SketchPad, type Stroke } from "./sketch-pad";
import { useCallback } from "react";

function SketchNodeView(props: ReactNodeViewProps) {
  const { node, updateAttributes, editor } = props;

  const handleChange = useCallback(
    (strokes: Stroke[]) => {
      updateAttributes({ strokes });
    },
    [updateAttributes]
  );

  const handleHeightChange = useCallback(
    (height: number) => {
      updateAttributes({ height });
    },
    [updateAttributes]
  );

  const handleBgColorChange = useCallback(
    (backgroundColor: string) => {
      updateAttributes({ backgroundColor });
    },
    [updateAttributes]
  );

  // Detect if collaboration is active (Yjs manages undo in that case)
  const isCollaborative = editor.extensionManager.extensions.some(
    (ext) => ext.name === "collaboration"
  );

  return (
    <NodeViewWrapper className="my-4">
      <SketchPad
        strokes={(node.attrs.strokes as Stroke[]) ?? []}
        onChange={handleChange}
        height={(node.attrs.height as number) ?? 350}
        onHeightChange={handleHeightChange}
        readOnly={!editor.isEditable}
        collaborative={isCollaborative}
        backgroundColor={(node.attrs.backgroundColor as string) ?? ""}
        onBackgroundColorChange={handleBgColorChange}
      />
    </NodeViewWrapper>
  );
}

export const SketchBlock = Node.create({
  name: "sketchBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      strokes: {
        default: [],
        parseHTML: (element) => {
          const data = element.getAttribute("data-strokes");
          try {
            return data ? JSON.parse(data) : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => ({
          "data-strokes": JSON.stringify(attributes.strokes),
        }),
      },
      height: {
        default: 350,
        parseHTML: (element) => Number(element.getAttribute("data-height")) || 350,
        renderHTML: (attributes) => ({
          "data-height": attributes.height,
        }),
      },
      backgroundColor: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-bg-color") || "",
        renderHTML: (attributes) => ({
          "data-bg-color": attributes.backgroundColor,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="sketch-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "sketch-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SketchNodeView);
  },
});
