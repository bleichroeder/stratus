import type { Json } from "@/lib/types";

// --- Types ---

export type AIAction = "template-fill" | "summarize" | "freeform";

export interface ContextNoteInput {
  title: string;
  content: string;
}

export interface AIRequest {
  action: AIAction;
  templateId?: string;
  prompt?: string;
  context?: string;
  noteTitle?: string;
  contextNotes?: ContextNoteInput[];
}

// --- TipTap JSON to plain text ---

export function tiptapToPlainText(content: Json): string {
  if (!content || typeof content !== "object") return "";
  const doc = content as { type?: string; content?: Json[] };
  if (doc.type !== "doc" || !Array.isArray(doc.content)) return "";
  return doc.content.map((node) => nodeToText(node, 0)).join("\n");
}

function nodeToText(node: Json, depth: number): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: Json[]; attrs?: Record<string, unknown> };

  if (n.type === "text") return n.text ?? "";

  const inner = Array.isArray(n.content)
    ? n.content.map((c) => nodeToText(c, depth)).join("")
    : "";

  switch (n.type) {
    case "heading": {
      const level = (n.attrs?.level as number) ?? 1;
      return "#".repeat(level) + " " + inner + "\n";
    }
    case "paragraph":
      return inner + "\n";
    case "bulletList":
    case "orderedList":
      return Array.isArray(n.content)
        ? n.content.map((item, i) => {
            const prefix = n.type === "orderedList" ? `${i + 1}. ` : "- ";
            return prefix + nodeToText(item, depth + 1);
          }).join("")
        : "";
    case "taskList":
      return Array.isArray(n.content)
        ? n.content.map((item) => {
            const ti = item as { attrs?: { checked?: boolean }; content?: Json[] };
            const checked = ti.attrs?.checked ? "[x]" : "[ ]";
            const text = Array.isArray(ti.content)
              ? ti.content.map((c) => nodeToText(c, depth + 1)).join("")
              : "";
            return `- ${checked} ${text}`;
          }).join("")
        : "";
    case "listItem":
    case "taskItem":
      return inner;
    case "codeBlock":
      return "```\n" + inner + "```\n";
    case "blockquote":
      return inner.split("\n").map((l) => "> " + l).join("\n") + "\n";
    case "calloutBlock":
      return inner;
    case "horizontalRule":
      return "---\n";
    default:
      return inner;
  }
}

// --- Inline markdown to TipTap text nodes ---

function parseInlineMarkdown(text: string): Json[] {
  if (!text) return [];
  const tokens: Json[] = [];
  // Regex matches: **bold**, *italic*, ~~strike~~, `code`, or plain text between them
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      tokens.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[2] !== undefined) {
      // **bold**
      tokens.push({ type: "text", text: match[2], marks: [{ type: "bold" }] });
    } else if (match[3] !== undefined) {
      // *italic*
      tokens.push({ type: "text", text: match[3], marks: [{ type: "italic" }] });
    } else if (match[4] !== undefined) {
      // ~~strike~~
      tokens.push({ type: "text", text: match[4], marks: [{ type: "strike" }] });
    } else if (match[5] !== undefined) {
      // `code`
      tokens.push({ type: "text", text: match[5], marks: [{ type: "code" }] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    tokens.push({ type: "text", text: text.slice(lastIndex) });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", text }];
}

function inlineParagraph(text: string): Json {
  return { type: "paragraph", content: parseInlineMarkdown(text) };
}

// --- Plain text (markdown-ish) to TipTap JSON nodes ---

export function plainTextToTiptapNodes(text: string): Json[] {
  const lines = text.split("\n");
  const nodes: Json[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      nodes.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: parseInlineMarkdown(headingMatch[2]),
      });
      i++;
      continue;
    }

    // Task items: collect consecutive task lines into a taskList
    if (/^[-*]\s+\[[ x]\]\s/.test(line)) {
      const items: Json[] = [];
      while (i < lines.length && /^[-*]\s+\[[ x]\]\s/.test(lines[i])) {
        const m = lines[i].match(/^[-*]\s+\[([ x])\]\s(.*)/)!;
        items.push({
          type: "taskItem",
          attrs: { checked: m[1] === "x" },
          content: [m[2] ? inlineParagraph(m[2]) : { type: "paragraph", content: [] }],
        });
        i++;
      }
      nodes.push({ type: "taskList", content: items });
      continue;
    }

    // Bullet items: collect consecutive lines into a bulletList
    if (/^[-*]\s+/.test(line) && !/^[-*]\s+\[/.test(line)) {
      const items: Json[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]) && !/^[-*]\s+\[/.test(lines[i])) {
        const itemText = lines[i].replace(/^[-*]\s+/, "");
        items.push({
          type: "listItem",
          content: [itemText ? inlineParagraph(itemText) : { type: "paragraph", content: [] }],
        });
        i++;
      }
      nodes.push({ type: "bulletList", content: items });
      continue;
    }

    // Ordered list items
    if (/^\d+\.\s+/.test(line)) {
      const items: Json[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\.\s+/, "");
        items.push({
          type: "listItem",
          content: [itemText ? inlineParagraph(itemText) : { type: "paragraph", content: [] }],
        });
        i++;
      }
      nodes.push({ type: "orderedList", content: items });
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Default: paragraph with inline markdown
    nodes.push(inlineParagraph(line));
    i++;
  }

  return nodes;
}

// --- Prompt builders ---

const TEMPLATE_PROMPTS: Record<string, { system: string; systemWithContext: string; needsTopic: boolean }> = {
  "builtin-daily-standup": {
    system: "You are helping fill a daily standup note. Generate 2-3 realistic example talking points for each section: Yesterday (what was done), Today (what's planned), and Blockers (any obstacles). Use markdown task list format (- [ ] item). Keep each point concise — one line each.",
    systemWithContext: "You are helping fill a daily standup note. The user has provided their recent daily notes as context. Use the information from those notes to:\n- \"Yesterday\" section: Extract what was listed as planned/done items from the most recent note\n- \"Today\" section: Suggest follow-ups, continuations, or new items\n- \"Blockers\" section: Carry forward any unresolved blockers\nUse markdown task list format (- [ ] item). Keep each point concise — one line each. Be specific, referencing actual items from the context.",
    needsTopic: false,
  },
  "builtin-meeting-notes": {
    system: "You are helping prepare meeting notes. Given the meeting topic, suggest 3-5 agenda items as bullet points, and 2-3 potential action items as task list items. Use markdown formatting.",
    systemWithContext: "You are helping prepare meeting notes. The user has provided notes as context. Use the context to suggest relevant agenda items as bullet points and action items as task list items. Reference specific topics, decisions, or open questions from the context notes. Use markdown formatting.",
    needsTopic: true,
  },
  "builtin-weekly-review": {
    system: "You are helping fill a weekly review. Generate 2-3 thoughtful reflection prompts for each section: Accomplishments (what went well), Challenges (what was difficult), and Next Week Goals (what to focus on). Use markdown bullet points.",
    systemWithContext: "You are helping fill a weekly review. The user has provided their daily notes from this week as context. Use the information to:\n- \"Accomplishments\" section: Summarize what was actually completed across the week\n- \"Challenges\" section: Identify blockers, delays, or difficulties mentioned\n- \"Next Week Goals\" section: Suggest follow-ups based on incomplete items or trends\nUse markdown bullet points. Be specific, referencing actual work from the context.",
    needsTopic: false,
  },
  "builtin-bug-report": {
    system: "You are helping draft a bug report. Generate example placeholder text for each section: Steps to Reproduce (3 numbered steps), Expected Behavior (1-2 sentences), Actual Behavior (1-2 sentences). Use markdown formatting.",
    systemWithContext: "You are helping draft a bug report. The user has provided notes as context. Use the context to pre-fill relevant details in each section: Steps to Reproduce, Expected Behavior, Actual Behavior. Use markdown formatting.",
    needsTopic: false,
  },
  "builtin-todo-list": {
    system: "You are helping create a TODO list. Given the goal or project, generate 5-8 actionable, specific task items. Use markdown task list format (- [ ] item). Order from most to least important.",
    systemWithContext: "You are helping create a TODO list. The user has provided notes as context. Extract actionable items, follow-ups, and incomplete tasks from the context. Generate 5-8 specific task items. Use markdown task list format (- [ ] item). Order from most to least important.",
    needsTopic: true,
  },
};

export function getTemplatePromptConfig(templateId: string) {
  return TEMPLATE_PROMPTS[templateId] ?? null;
}

export function buildSystemPrompt(action: AIAction, templateId?: string, hasContextNotes?: boolean): string {
  if (action === "template-fill" && templateId && TEMPLATE_PROMPTS[templateId]) {
    const prompts = TEMPLATE_PROMPTS[templateId];
    if (hasContextNotes) {
      return prompts.systemWithContext;
    }
    return prompts.system;
  }
  if (action === "summarize") {
    return "You are a note summarization assistant. Summarize the provided note content into a concise paragraph (2-3 sentences) followed by key bullet points. Be direct and preserve important details. Do NOT use bold, italic, or any other inline formatting — just plain text with bullet points (- item).";
  }
  if (hasContextNotes) {
    return "You are a helpful writing assistant embedded in a note-taking app. The user has provided notes as context. Generate content based on their request, referencing specific details from the context notes. Use markdown formatting (headings, bullet points, task lists). Be concise and useful.";
  }
  return "You are a helpful writing assistant embedded in a note-taking app. Generate content based on the user's request. Use markdown formatting (headings, bullet points, task lists). Be concise and useful.";
}

export function buildUserPrompt(action: AIAction, params: {
  context?: string;
  noteTitle?: string;
  prompt?: string;
  templateId?: string;
  contextNotes?: ContextNoteInput[];
}): string {
  const contextSection = formatContextNotes(params.contextNotes);

  if (action === "template-fill") {
    const parts: string[] = [];
    if (contextSection) parts.push(contextSection);
    const topic = params.prompt || "";
    if (topic) parts.push(`Additional instructions: ${topic}`);
    if (parts.length > 0) {
      parts.push("Please generate the content for this template based on the above.");
      return parts.join("\n\n");
    }
    return "Please generate example content for this template.";
  }
  if (action === "summarize") {
    return `Please summarize the following note:\n\n${params.context || ""}`;
  }
  // freeform
  const parts: string[] = [];
  if (contextSection) parts.push(contextSection);
  if (params.prompt) parts.push(params.prompt);
  if (params.context) parts.push(`\nCurrent note context:\n${params.context}`);
  return parts.join("\n") || "Hello";
}

function formatContextNotes(notes?: ContextNoteInput[]): string {
  if (!notes || notes.length === 0) return "";
  const sections = notes.map(
    (n) => `--- Note: "${n.title}" ---\n${n.content}`
  );
  return `Context from the user's notes:\n\n${sections.join("\n\n")}`;
}

const MAX_CONTEXT_CHARS = 8000;

export function truncateContextNotes(notes: ContextNoteInput[]): ContextNoteInput[] {
  if (notes.length === 0) return notes;

  const totalChars = notes.reduce((sum, n) => sum + n.content.length, 0);
  if (totalChars <= MAX_CONTEXT_CHARS) return notes;

  // Proportional truncation — earlier notes (more recent) get priority
  const budget = MAX_CONTEXT_CHARS;
  const perNote = Math.floor(budget / notes.length);
  let remaining = budget;

  return notes.map((n, i) => {
    const isLast = i === notes.length - 1;
    const allowance = isLast ? remaining : Math.min(perNote, remaining);
    remaining -= Math.min(n.content.length, allowance);
    if (n.content.length <= allowance) return n;
    return { ...n, content: n.content.slice(0, allowance) + "..." };
  });
}
