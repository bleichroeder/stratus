import { Node, mergeAttributes } from "@tiptap/core";

export const MermaidBlockStatic = Node.create({
  name: "mermaidBlock",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      snapshot: { default: {} },
      height: { default: 400 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const h = node.attrs.height ?? 400;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "mermaid-block",
        style: `width:100%;height:${h}px;border:1px solid #d6d3d1;border-radius:0.5rem;background:#fafaf9;display:flex;align-items:center;justify-content:center;color:#a8a29e;font-size:0.875rem;font-family:monospace;margin:1em 0;`,
      }),
      "[ whiteboard ]",
    ];
  },
});
