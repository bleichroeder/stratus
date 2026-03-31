/**
 * Converts TipTap JSON documents to Markdown.
 *
 * Handles all node types used in the editor:
 * - Headings, paragraphs, lists (bullet, ordered, task)
 * - Code blocks, blockquotes, horizontal rules
 * - Images, callouts, wiki links
 * - Inline marks: bold, italic, strike, code, underline, link, wikiLink
 *
 * Produces Obsidian-compatible output (callouts, [[wikilinks]]).
 */

import type { Json } from "@/lib/types";

interface TipTapNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface MarkdownOptions {
  rewriteImageUrl?: (url: string) => string;
  noteIdToTitle?: Map<string, string>;
}

// Reverse map from internal callout types back to Obsidian-style types
const CALLOUT_TYPE_TO_OBSIDIAN: Record<string, string> = {
  info: "NOTE",
  warning: "WARNING",
  tip: "TIP",
  error: "ERROR",
};

export function tiptapToMarkdown(doc: Json, options?: MarkdownOptions): string {
  if (!doc || typeof doc !== "object") return "";
  const node = doc as TipTapNode;
  if (node.type !== "doc" || !Array.isArray(node.content)) return "";

  return blocksToMarkdown(node.content, 0, options).trimEnd() + "\n";
}

function blocksToMarkdown(
  nodes: TipTapNode[],
  depth: number,
  options?: MarkdownOptions,
): string {
  const parts: string[] = [];

  for (const node of nodes) {
    const md = blockToMarkdown(node, depth, options);
    if (md !== null) parts.push(md);
  }

  return parts.join("\n\n");
}

function blockToMarkdown(
  node: TipTapNode,
  depth: number,
  options?: MarkdownOptions,
): string | null {
  switch (node.type) {
    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const prefix = "#".repeat(Math.min(level, 6));
      return `${prefix} ${inlineToMarkdown(node.content, options)}`;
    }

    case "paragraph":
      return inlineToMarkdown(node.content, options);

    case "bulletList":
      return listToMarkdown(node.content, depth, "bullet", options);

    case "orderedList":
      return listToMarkdown(node.content, depth, "ordered", options);

    case "taskList":
      return listToMarkdown(node.content, depth, "task", options);

    case "listItem":
    case "taskItem":
      // Handled inside listToMarkdown
      return null;

    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const code = node.content
        ? node.content.map((c) => c.text ?? "").join("")
        : "";
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case "blockquote": {
      if (!node.content) return "> ";
      const inner = blocksToMarkdown(node.content, depth, options);
      return inner
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }

    case "horizontalRule":
      return "---";

    case "image": {
      const src = node.attrs?.src as string | undefined;
      if (!src) return null;
      const rewritten = options?.rewriteImageUrl?.(src) ?? src;
      const alt = (node.attrs?.alt as string) ?? "";
      const title = node.attrs?.title as string | undefined;
      if (title) return `![${alt}](${rewritten} "${title}")`;
      return `![${alt}](${rewritten})`;
    }

    case "calloutBlock": {
      const calloutType = (node.attrs?.calloutType as string) ?? "info";
      const obsidianType = CALLOUT_TYPE_TO_OBSIDIAN[calloutType] ?? "NOTE";
      if (!node.content || node.content.length === 0) {
        return `> [!${obsidianType}]`;
      }
      const inner = blocksToMarkdown(node.content, depth, options);
      return `> [!${obsidianType}]\n${inner
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}`;
    }

    case "hardBreak":
      return "  \n";

    case "meetingMeta":
      return null;

    case "sketchBlock":
      return "<!-- Sketch omitted -->";

    case "mermaidBlock":
      return "<!-- Whiteboard omitted -->";

    default:
      // Unknown block — try to render children
      if (node.content) {
        return blocksToMarkdown(node.content, depth, options);
      }
      return null;
  }
}

function listToMarkdown(
  items: TipTapNode[] | undefined,
  depth: number,
  listType: "bullet" | "ordered" | "task",
  options?: MarkdownOptions,
): string {
  if (!items) return "";
  const indent = "  ".repeat(depth);
  const lines: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const children = item.content ?? [];

    // Separate inline content (first paragraph) from nested blocks (sub-lists, etc.)
    const firstBlock = children[0];
    const restBlocks = children.slice(1);

    let prefix: string;
    if (listType === "task") {
      const checked = item.attrs?.checked ? "[x]" : "[ ]";
      prefix = `${indent}- ${checked} `;
    } else if (listType === "ordered") {
      prefix = `${indent}${i + 1}. `;
    } else {
      prefix = `${indent}- `;
    }

    // Render the first block inline with the prefix
    const firstLine = firstBlock
      ? inlineToMarkdown(firstBlock.content, options)
      : "";
    lines.push(`${prefix}${firstLine}`);

    // Render nested blocks (sub-lists, etc.) with increased depth
    for (const child of restBlocks) {
      if (
        child.type === "bulletList" ||
        child.type === "orderedList" ||
        child.type === "taskList"
      ) {
        const subType =
          child.type === "bulletList"
            ? "bullet"
            : child.type === "orderedList"
              ? "ordered"
              : "task";
        lines.push(listToMarkdown(child.content, depth + 1, subType, options));
      } else {
        const nested = blockToMarkdown(child, depth, options);
        if (nested !== null) {
          // Indent continuation lines under the list item
          const continuationIndent = "  ".repeat(depth + 1);
          lines.push(
            nested
              .split("\n")
              .map((l) => `${continuationIndent}${l}`)
              .join("\n"),
          );
        }
      }
    }
  }

  return lines.join("\n");
}

function inlineToMarkdown(
  nodes: TipTapNode[] | undefined,
  options?: MarkdownOptions,
): string {
  if (!nodes) return "";
  const parts: string[] = [];

  for (const node of nodes) {
    if (node.type === "hardBreak") {
      parts.push("  \n");
      continue;
    }

    if (node.type === "image") {
      const src = node.attrs?.src as string | undefined;
      if (src) {
        const rewritten = options?.rewriteImageUrl?.(src) ?? src;
        const alt = (node.attrs?.alt as string) ?? "";
        parts.push(`![${alt}](${rewritten})`);
      }
      continue;
    }

    if (node.type !== "text" || !node.text) continue;

    let text = node.text;
    const marks = node.marks ?? [];

    // Check for wikiLink mark — takes priority, renders as [[Title]]
    const wikiMark = marks.find((m) => m.type === "wikiLink");
    if (wikiMark) {
      const noteId = wikiMark.attrs?.noteId as string | undefined;
      const title = wikiMark.attrs?.title as string | undefined;
      const resolvedTitle =
        (noteId && options?.noteIdToTitle?.get(noteId)) ?? title ?? text;
      parts.push(`[[${resolvedTitle}]]`);
      continue;
    }

    // Apply marks in order: bold, italic, strike, code, underline, link
    for (const mark of marks) {
      switch (mark.type) {
        case "code":
          text = `\`${text}\``;
          break;
        case "bold":
          text = `**${text}**`;
          break;
        case "italic":
          text = `*${text}*`;
          break;
        case "strike":
          text = `~~${text}~~`;
          break;
        case "underline":
          text = `<u>${text}</u>`;
          break;
        case "link": {
          const href = mark.attrs?.href as string | undefined;
          if (href) text = `[${text}](${href})`;
          break;
        }
      }
    }

    parts.push(text);
  }

  return parts.join("");
}
