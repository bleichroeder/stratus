"use client";

import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attrs: { noteId: string; title: string }) => ReturnType;
    };
  }
}

export const WikiLink = Mark.create({
  name: "wikiLink",
  inclusive: false,
  excludes: "_",

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-note-id"),
        renderHTML: (attributes) => ({
          "data-note-id": attributes.noteId,
        }),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-title"),
        renderHTML: (attributes) => ({
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
          "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded px-0.5 cursor-pointer hover:underline",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setWikiLink:
        (attrs) =>
        ({ chain }) => {
          return chain().setMark(this.name, attrs).run();
        },
    };
  },
});

// Input rule: detect [[ and show autocomplete
export interface WikiLinkSuggestion {
  id: string;
  title: string;
}

interface WikiLinkPluginOptions {
  onOpen: (query: string, from: number, to: number) => void;
  onClose: () => void;
  onUpdate: (query: string, from: number, to: number) => void;
}

export function createWikiLinkPlugin(options: WikiLinkPluginOptions) {
  const pluginKey = new PluginKey("wikiLinkSuggest");

  return new Plugin({
    key: pluginKey,
    state: {
      init() {
        return { active: false, query: "", from: 0, to: 0 };
      },
      apply(tr, prev) {
        const meta = tr.getMeta(pluginKey);
        if (meta) return meta;
        if (tr.docChanged) {
          // Check if we're in a [[ context
          const { $from } = tr.selection;
          const textBefore = $from.parent.textBetween(
            Math.max(0, $from.parentOffset - 50),
            $from.parentOffset,
            undefined,
            "\ufffc"
          );
          const match = textBefore.match(/\[\[([^\]]*?)$/);
          if (match) {
            const query = match[1];
            const from = $from.pos - query.length;
            const to = $from.pos;
            return { active: true, query, from: from - 2, to }; // -2 for [[
          }
        }
        // Check if we should deactivate
        if (prev.active) {
          const { $from } = tr.selection;
          const textBefore = $from.parent.textBetween(
            Math.max(0, $from.parentOffset - 50),
            $from.parentOffset,
            undefined,
            "\ufffc"
          );
          if (!textBefore.match(/\[\[([^\]]*?)$/)) {
            return { active: false, query: "", from: 0, to: 0 };
          }
        }
        return prev;
      },
    },
    view() {
      return {
        update(view) {
          const state = pluginKey.getState(view.state);
          if (state?.active) {
            options.onUpdate(state.query, state.from, state.to);
          } else {
            options.onClose();
          }
        },
      };
    },
  });
}
