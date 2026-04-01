import { Mark, mergeAttributes } from "@tiptap/core";

// Server-safe version of WikiLink for generateHTML (no "use client", no PM plugins)
export const WikiLinkStatic = Mark.create({
  name: "wikiLink",
  inclusive: false,
  excludes: "_",

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-note-id"),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-note-id": attributes.noteId,
        }),
      },
      title: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-title"),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-title": attributes.title,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="wiki-link"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "wiki-link",
        class:
          "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded px-0.5",
      }),
      0,
    ];
  },
});
