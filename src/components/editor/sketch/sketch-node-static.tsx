import { Node, mergeAttributes } from "@tiptap/core";

// Minimal server-safe version of SketchBlock for generateHTML
export const SketchBlockStatic = Node.create({
  name: "sketchBlock",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      strokes: { default: [] },
      height: { default: 350 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="sketch-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const h = node.attrs.height ?? 350;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "sketch-block",
        style: `width:100%;height:${h}px;border:1px solid #d6d3d1;border-radius:0.5rem;background:#fafaf9;display:flex;align-items:center;justify-content:center;color:#a8a29e;font-size:0.875rem;font-family:monospace;margin:1em 0;`,
      }),
      "[ sketch ]",
    ];
  },
});
