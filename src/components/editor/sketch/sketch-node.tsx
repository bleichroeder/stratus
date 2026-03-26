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

  return (
    <NodeViewWrapper className="my-4">
      <SketchPad
        strokes={(node.attrs.strokes as Stroke[]) ?? []}
        onChange={handleChange}
        height={(node.attrs.height as number) ?? 350}
        onHeightChange={handleHeightChange}
        readOnly={!editor.isEditable}
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
