import type { Json, Note } from "@/lib/types";

export type ContextHintType = "none" | "daily_recent" | "daily_week" | "tagged";

export interface ContextHint {
  type: ContextHintType;
  tag_id?: string;
  days?: number;
}

export const CONTEXT_HINT_NONE: ContextHint = { type: "none" };

export interface TemplateItem {
  id: string;
  title: string;
  content: Json;
  builtIn: boolean;
  contextHint: ContextHint;
}

function taskList(items: string[]): Json {
  return {
    type: "taskList",
    content: items.map((text) => ({
      type: "taskItem",
      attrs: { checked: false },
      content: [
        {
          type: "paragraph",
          content: text ? [{ type: "text", text }] : [],
        },
      ],
    })),
  };
}

function bulletList(items: string[]): Json {
  return {
    type: "bulletList",
    content: items.map((text) => ({
      type: "listItem",
      content: [
        {
          type: "paragraph",
          content: text ? [{ type: "text", text }] : [],
        },
      ],
    })),
  };
}

function orderedList(items: string[]): Json {
  return {
    type: "orderedList",
    content: items.map((text) => ({
      type: "listItem",
      content: [
        {
          type: "paragraph",
          content: text ? [{ type: "text", text }] : [],
        },
      ],
    })),
  };
}

function heading(level: number, text: string): Json {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function paragraph(text?: string): Json {
  return {
    type: "paragraph",
    content: text ? [{ type: "text", text }] : [],
  };
}

function doc(...content: Json[]): Json {
  return { type: "doc", content };
}

// --- Date helpers ---

function todayFormatted(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function weekRangeFormatted(): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(monday)} – ${fmt(friday)}, ${now.getFullYear()}`;
}

function detectEnvironment(): string[] {
  if (typeof navigator === "undefined") return ["OS: ", "Browser: ", "Version: "];
  const ua = navigator.userAgent;
  let os = "Unknown";
  if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";

  let browser = "Unknown";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";

  return [`OS: ${os}`, `Browser: ${browser}`, "Version: "];
}

// --- Built-in template factories ---
// Each returns a fresh TemplateItem with dynamic content (dates, env info)

interface BuiltinTemplateDef {
  id: string;
  titleLabel: string;
  contextHint: ContextHint;
  build: () => { title: string; content: Json };
}

const BUILTIN_DEFS: BuiltinTemplateDef[] = [
  {
    id: "builtin-daily-standup",
    titleLabel: "Daily Standup",
    contextHint: { type: "daily_recent", days: 1 },
    build: () => {
      const date = todayFormatted();
      return {
        title: `Daily Standup — ${date}`,
        content: doc(
          heading(2, `Daily Standup — ${date}`),
          heading(3, "Yesterday"),
          taskList(["", ""]),
          heading(3, "Today"),
          taskList(["", ""]),
          heading(3, "Blockers"),
          taskList([""])
        ),
      };
    },
  },
  {
    id: "builtin-meeting-notes",
    titleLabel: "Meeting Notes",
    contextHint: { type: "none" },
    build: () => {
      const date = todayFormatted();
      return {
        title: "Meeting Notes",
        content: doc(
          heading(2, "Meeting Notes"),
          paragraph(`Date: ${date}`),
          paragraph("Attendees: "),
          heading(3, "Agenda"),
          bulletList(["", ""]),
          heading(3, "Discussion"),
          paragraph(""),
          heading(3, "Action Items"),
          taskList(["", ""])
        ),
      };
    },
  },
  {
    id: "builtin-weekly-review",
    titleLabel: "Weekly Review",
    contextHint: { type: "daily_week" },
    build: () => {
      const range = weekRangeFormatted();
      return {
        title: `Weekly Review — ${range}`,
        content: doc(
          heading(2, `Weekly Review — ${range}`),
          heading(3, "Accomplishments"),
          bulletList(["", ""]),
          heading(3, "Challenges"),
          bulletList(["", ""]),
          heading(3, "Next Week Goals"),
          taskList(["", ""])
        ),
      };
    },
  },
  {
    id: "builtin-bug-report",
    titleLabel: "Bug Report",
    contextHint: { type: "none" },
    build: () => {
      const date = todayFormatted();
      const env = detectEnvironment();
      return {
        title: "Bug Report",
        content: doc(
          heading(2, "Bug Report"),
          paragraph(`Reported: ${date}`),
          heading(3, "Steps to Reproduce"),
          orderedList(["", "", ""]),
          heading(3, "Expected Behavior"),
          paragraph(""),
          heading(3, "Actual Behavior"),
          paragraph(""),
          heading(3, "Environment"),
          bulletList(env)
        ),
      };
    },
  },
  {
    id: "builtin-todo-list",
    titleLabel: "TODO List",
    contextHint: { type: "none" },
    build: () => {
      const date = todayFormatted();
      return {
        title: `TODO — ${date}`,
        content: doc(
          heading(2, `TODO — ${date}`),
          taskList(["", "", "", ""])
        ),
      };
    },
  },
];

// Static version for the picker UI (shows label, no dynamic content)
export const BUILTIN_TEMPLATES: TemplateItem[] = BUILTIN_DEFS.map((d) => ({
  id: d.id,
  title: d.titleLabel,
  content: d.build().content,
  builtIn: true,
  contextHint: d.contextHint,
}));

// Call this at creation time to get fresh dynamic content
export function buildTemplate(id: string): { title: string; content: Json } | null {
  const def = BUILTIN_DEFS.find((d) => d.id === id);
  return def ? def.build() : null;
}

function parseContextHint(raw: unknown): ContextHint {
  if (!raw || typeof raw !== "object") return CONTEXT_HINT_NONE;
  const obj = raw as Record<string, unknown>;
  const type = obj.type;
  if (type === "daily_recent" || type === "daily_week" || type === "tagged") {
    return {
      type,
      ...(typeof obj.tag_id === "string" ? { tag_id: obj.tag_id } : {}),
      ...(typeof obj.days === "number" ? { days: obj.days } : {}),
    };
  }
  return CONTEXT_HINT_NONE;
}

export function getAllTemplates(userTemplates: Note[]): TemplateItem[] {
  const custom: TemplateItem[] = userTemplates.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content ?? doc(paragraph("")),
    builtIn: false,
    contextHint: parseContextHint(n.context_hint),
  }));
  return [...BUILTIN_TEMPLATES, ...custom];
}

export function getBuiltinContextHint(templateId: string): ContextHint {
  const def = BUILTIN_DEFS.find((d) => d.id === templateId);
  return def?.contextHint ?? CONTEXT_HINT_NONE;
}

export function extractTemplatePreview(content: Json): string {
  if (!content || typeof content !== "object" || !("content" in content))
    return "";
  const nodes = (content as { content?: Json[] }).content;
  if (!Array.isArray(nodes)) return "";

  const lines: string[] = [];
  for (const node of nodes) {
    if (lines.length >= 3) break;
    const n = node as { type?: string; content?: Json[]; attrs?: { level?: number } };
    if (n.type === "heading" || n.type === "paragraph") {
      const text = extractText(n.content);
      if (text) lines.push(text);
    }
  }
  return lines.join(" · ");
}

function extractText(content?: Json[]): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((c) => {
      const node = c as { type?: string; text?: string; content?: Json[] };
      if (node.type === "text" && node.text) return node.text;
      if (node.content) return extractText(node.content);
      return "";
    })
    .join("")
    .trim();
}
