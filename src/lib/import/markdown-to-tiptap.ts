/**
 * Converts Markdown (with Obsidian extensions) to TipTap JSON.
 *
 * Supported syntax:
 * - CommonMark (headings, paragraphs, bold, italic, code, blockquotes, lists, images, links, hr)
 * - Strikethrough (~~text~~)
 * - Task lists (- [ ] / - [x])
 * - Fenced code blocks with language
 * - Obsidian [[wikilinks]]
 * - Obsidian callouts (> [!TYPE] content)
 */

import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

// ── Types ────────────────────────────────────────────────────────────────

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

type NoteIdResolver = (title: string) => string | null;

// ── Markdown-it setup ────────────────────────────────────────────────────

function createParser() {
  const md = new MarkdownIt("commonmark", { html: false, linkify: true });

  // Enable strikethrough
  md.enable("strikethrough");

  // Plugin: parse [[wikilinks]] into custom tokens
  md.inline.ruler.after("link", "wikilink", (state, silent) => {
    const src = state.src.slice(state.pos);
    const match = src.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (!match) return false;
    if (!silent) {
      const token = state.push("wikilink", "", 0);
      token.meta = { target: match[1].trim(), alias: match[2]?.trim() || null };
    }
    state.pos += match[0].length;
    return true;
  });

  return md;
}

// ── Callout extraction ───────────────────────────────────────────────────

const CALLOUT_RE = /^\[!(\w+)\]\s*(.*)?$/i;
const CALLOUT_TYPE_MAP: Record<string, string> = {
  note: "info",
  info: "info",
  abstract: "info",
  summary: "info",
  tldr: "info",
  tip: "tip",
  hint: "tip",
  important: "tip",
  success: "tip",
  check: "tip",
  done: "tip",
  question: "info",
  help: "info",
  faq: "info",
  warning: "warning",
  caution: "warning",
  attention: "warning",
  failure: "error",
  fail: "error",
  missing: "error",
  danger: "error",
  error: "error",
  bug: "error",
  example: "info",
  quote: "info",
  cite: "info",
};

function tryParseCallout(
  tokens: Token[],
  index: number
): { calloutType: string; titleText: string | null; bodyTokens: Token[]; consumed: number } | null {
  const openToken = tokens[index];
  if (openToken.type !== "blockquote_open") return null;

  // Find the matching blockquote_close
  let depth = 1;
  let closeIdx = index + 1;
  while (closeIdx < tokens.length && depth > 0) {
    if (tokens[closeIdx].type === "blockquote_open") depth++;
    if (tokens[closeIdx].type === "blockquote_close") depth--;
    closeIdx++;
  }
  // closeIdx is now one past the blockquote_close

  // Look at the first paragraph inside
  const inner = tokens.slice(index + 1, closeIdx - 1);
  if (inner.length < 3) return null;
  if (inner[0].type !== "paragraph_open") return null;

  // The inline token should start with [!TYPE]
  const inlineToken = inner[1];
  if (inlineToken.type !== "inline" || !inlineToken.content) return null;

  const match = inlineToken.content.match(CALLOUT_RE);
  if (!match) return null;

  const rawType = match[1].toLowerCase();
  const calloutType = CALLOUT_TYPE_MAP[rawType] || "info";
  const titleText = match[2]?.trim() || null;

  // Body tokens are everything after the first paragraph
  const bodyTokens = inner.slice(3); // skip paragraph_open, inline, paragraph_close

  return { calloutType, titleText, bodyTokens, consumed: closeIdx - index };
}

// ── Token → TipTap conversion ────────────────────────────────────────────

export function markdownToTiptap(
  markdown: string,
  resolveNoteId?: NoteIdResolver
): TipTapNode {
  const md = createParser();

  // Strip YAML frontmatter
  const stripped = markdown.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const tokens = md.parse(stripped, {});

  const doc: TipTapNode = { type: "doc", content: [] };
  convertBlockTokens(tokens, 0, tokens.length, doc.content!, resolveNoteId);

  // Ensure doc has at least one node
  if (!doc.content || doc.content.length === 0) {
    doc.content = [{ type: "paragraph" }];
  }

  return doc;
}

function convertBlockTokens(
  tokens: Token[],
  start: number,
  end: number,
  output: TipTapNode[],
  resolveNoteId?: NoteIdResolver
): void {
  let i = start;

  while (i < end) {
    const token = tokens[i];

    // ── Callout (must check before generic blockquote) ──
    if (token.type === "blockquote_open") {
      const callout = tryParseCallout(tokens, i);
      if (callout) {
        const content: TipTapNode[] = [];
        if (callout.titleText) {
          content.push({
            type: "paragraph",
            content: [{ type: "text", marks: [{ type: "bold" }], text: callout.titleText }],
          });
        }
        if (callout.bodyTokens.length > 0) {
          convertBlockTokens(callout.bodyTokens, 0, callout.bodyTokens.length, content, resolveNoteId);
        }
        if (content.length === 0) {
          content.push({ type: "paragraph" });
        }
        output.push({
          type: "calloutBlock",
          attrs: { calloutType: callout.calloutType },
          content,
        });
        i += callout.consumed;
        continue;
      }
    }

    // ── Heading ──
    if (token.type === "heading_open") {
      const level = parseInt(token.tag.slice(1), 10);
      const inlineToken = tokens[i + 1];
      const node: TipTapNode = {
        type: "heading",
        attrs: { level },
        content: inlineToken ? convertInlineTokens(inlineToken.children || [], resolveNoteId) : [],
      };
      output.push(node);
      i += 3; // heading_open, inline, heading_close
      continue;
    }

    // ── Paragraph ──
    if (token.type === "paragraph_open") {
      const inlineToken = tokens[i + 1];
      const content = inlineToken ? convertInlineTokens(inlineToken.children || [], resolveNoteId) : [];
      output.push({ type: "paragraph", content: content.length > 0 ? content : undefined });
      i += 3;
      continue;
    }

    // ── Blockquote ──
    if (token.type === "blockquote_open") {
      const closeIdx = findClose(tokens, i, "blockquote_open", "blockquote_close");
      const content: TipTapNode[] = [];
      convertBlockTokens(tokens, i + 1, closeIdx, content, resolveNoteId);
      output.push({ type: "blockquote", content: content.length > 0 ? content : [{ type: "paragraph" }] });
      i = closeIdx + 1;
      continue;
    }

    // ── Bullet list ──
    if (token.type === "bullet_list_open") {
      const closeIdx = findClose(tokens, i, "bullet_list_open", "bullet_list_close");
      // Check if this is a task list
      const isTaskList = hasTaskListItems(tokens, i + 1, closeIdx);
      if (isTaskList) {
        const content = convertListItems(tokens, i + 1, closeIdx, true, resolveNoteId);
        output.push({ type: "taskList", content });
      } else {
        const content = convertListItems(tokens, i + 1, closeIdx, false, resolveNoteId);
        output.push({ type: "bulletList", content });
      }
      i = closeIdx + 1;
      continue;
    }

    // ── Ordered list ──
    if (token.type === "ordered_list_open") {
      const closeIdx = findClose(tokens, i, "ordered_list_open", "ordered_list_close");
      const content = convertListItems(tokens, i + 1, closeIdx, false, resolveNoteId);
      output.push({ type: "orderedList", attrs: { start: token.attrGet("start") ? parseInt(token.attrGet("start")!, 10) : 1 }, content });
      i = closeIdx + 1;
      continue;
    }

    // ── Code block ──
    if (token.type === "fence" || token.type === "code_block") {
      output.push({
        type: "codeBlock",
        attrs: { language: token.info?.trim() || null },
        content: token.content ? [{ type: "text", text: token.content }] : undefined,
      });
      i++;
      continue;
    }

    // ── Horizontal rule ──
    if (token.type === "hr") {
      output.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // ── HTML block (skip) ──
    if (token.type === "html_block") {
      // Convert to a paragraph with the raw text
      const text = token.content.trim();
      if (text) {
        output.push({ type: "paragraph", content: [{ type: "text", text }] });
      }
      i++;
      continue;
    }

    // Skip close tokens and other unhandled tokens
    i++;
  }
}

// ── List items ───────────────────────────────────────────────────────────

function hasTaskListItems(tokens: Token[], start: number, end: number): boolean {
  for (let i = start; i < end; i++) {
    if (tokens[i].type === "list_item_open") {
      // Check for task list marker in next inline
      for (let j = i + 1; j < end && tokens[j].type !== "list_item_close"; j++) {
        if (tokens[j].type === "inline" && /^\[[ xX]\]\s/.test(tokens[j].content)) {
          return true;
        }
      }
    }
  }
  return false;
}

function convertListItems(
  tokens: Token[],
  start: number,
  end: number,
  isTaskList: boolean,
  resolveNoteId?: NoteIdResolver
): TipTapNode[] {
  const items: TipTapNode[] = [];
  let i = start;

  while (i < end) {
    if (tokens[i].type === "list_item_open") {
      const closeIdx = findClose(tokens, i, "list_item_open", "list_item_close");
      const content: TipTapNode[] = [];
      const innerTokens = tokens.slice(i + 1, closeIdx);

      if (isTaskList) {
        // Parse task items: strip checkbox from inline content (mutate in-place)
        let checked = false;
        for (const t of innerTokens) {
          if (t.type === "inline" && /^\[[ xX]\]\s/.test(t.content)) {
            checked = /^\[[xX]\]/.test(t.content);
            t.content = t.content.replace(/^\[[ xX]\]\s*/, "");
            if (t.children) {
              for (const c of t.children) {
                if (c.type === "text" && /^\[[ xX]\]\s/.test(c.content)) {
                  c.content = c.content.replace(/^\[[ xX]\]\s*/, "");
                }
              }
              t.children = t.children.filter((c) => !(c.type === "text" && c.content === ""));
            }
          }
        }
        convertBlockTokens(innerTokens, 0, innerTokens.length, content, resolveNoteId);
        items.push({ type: "taskItem", attrs: { checked }, content: content.length > 0 ? content : [{ type: "paragraph" }] });
      } else {
        convertBlockTokens(innerTokens, 0, innerTokens.length, content, resolveNoteId);
        items.push({ type: "listItem", content: content.length > 0 ? content : [{ type: "paragraph" }] });
      }
      i = closeIdx + 1;
    } else {
      i++;
    }
  }

  return items;
}

// ── Inline tokens ────────────────────────────────────────────────────────

function convertInlineTokens(
  tokens: Token[],
  resolveNoteId?: NoteIdResolver
): TipTapNode[] {
  const result: TipTapNode[] = [];
  const markStack: TipTapMark[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Wikilink (atomic token)
    if (token.type === "wikilink") {
      const target = token.meta?.target as string;
      const alias = token.meta?.alias as string | null;
      const displayText = alias || target;
      const noteId = resolveNoteId?.(target) || null;

      const marks: TipTapMark[] = [
        ...markStack,
        { type: "wikiLink", attrs: { noteId, title: target } },
      ];
      result.push({ type: "text", marks, text: displayText });
      continue;
    }

    // Text
    if (token.type === "text" || token.type === "html_inline") {
      if (token.content) {
        result.push({
          type: "text",
          ...(markStack.length > 0 ? { marks: [...markStack] } : {}),
          text: token.content,
        });
      }
      continue;
    }

    // Softbreak / hardbreak
    if (token.type === "softbreak" || token.type === "hardbreak") {
      result.push({ type: "hardBreak" });
      continue;
    }

    // Code inline
    if (token.type === "code_inline") {
      result.push({
        type: "text",
        marks: [...markStack, { type: "code" }],
        text: token.content,
      });
      continue;
    }

    // Bold open/close
    if (token.type === "strong_open") {
      markStack.push({ type: "bold" });
      continue;
    }
    if (token.type === "strong_close") {
      removeLastMark(markStack, "bold");
      continue;
    }

    // Italic open/close
    if (token.type === "em_open") {
      markStack.push({ type: "italic" });
      continue;
    }
    if (token.type === "em_close") {
      removeLastMark(markStack, "italic");
      continue;
    }

    // Strikethrough open/close
    if (token.type === "s_open") {
      markStack.push({ type: "strike" });
      continue;
    }
    if (token.type === "s_close") {
      removeLastMark(markStack, "strike");
      continue;
    }

    // Link open/close
    if (token.type === "link_open") {
      markStack.push({
        type: "link",
        attrs: {
          href: token.attrGet("href") || "",
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      });
      continue;
    }
    if (token.type === "link_close") {
      removeLastMark(markStack, "link");
      continue;
    }

    // Image
    if (token.type === "image") {
      result.push({
        type: "image",
        attrs: {
          src: token.attrGet("src") || "",
          alt: token.content || null,
          title: token.attrGet("title") || null,
        },
      });
      continue;
    }
  }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function findClose(tokens: Token[], openIdx: number, openType: string, closeType: string): number {
  let depth = 1;
  for (let i = openIdx + 1; i < tokens.length; i++) {
    if (tokens[i].type === openType) depth++;
    if (tokens[i].type === closeType) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return tokens.length - 1;
}

function removeLastMark(marks: TipTapMark[], type: string): void {
  for (let i = marks.length - 1; i >= 0; i--) {
    if (marks[i].type === type) {
      marks.splice(i, 1);
      return;
    }
  }
}
