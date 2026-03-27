import { Node, mergeAttributes } from "@tiptap/core";

const CALLOUT_STYLES: Record<string, string> = {
  info: "background:#eff6ff;border:1px solid #bfdbfe;border-radius:0.5rem;padding:1rem;margin:0.75rem 0;",
  warning: "background:#fffbeb;border:1px solid #fde68a;border-radius:0.5rem;padding:1rem;margin:0.75rem 0;",
  tip: "background:#f0fdf4;border:1px solid #bbf7d0;border-radius:0.5rem;padding:1rem;margin:0.75rem 0;",
  error: "background:#fef2f2;border:1px solid #fecaca;border-radius:0.5rem;padding:1rem;margin:0.75rem 0;",
};

export const CalloutBlockStatic = Node.create({
  name: "calloutBlock",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      calloutType: { default: "info" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const type = node.attrs.calloutType || "info";
    const style = CALLOUT_STYLES[type] || CALLOUT_STYLES.info;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "callout-block",
        style,
      }),
      0,
    ];
  },
});
