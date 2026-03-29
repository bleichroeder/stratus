import type { ContextHint } from "@/lib/templates";

/**
 * Format a Date as a daily note title string.
 * Must match the format used by todayString() in dashboard and MCP tools:
 * "March 29, 2026"
 */
export function formatDailyNoteTitle(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Given a ContextHint, return the daily note title strings to look up.
 */
export function getDailyNoteTitles(hint: ContextHint): string[] {
  if (hint.type === "daily_recent") {
    const days = hint.days ?? 1;
    const titles: string[] = [];
    for (let i = 1; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      titles.push(formatDailyNoteTitle(d));
    }
    return titles;
  }

  if (hint.type === "daily_week") {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    // Monday of this week
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const titles: string[] = [];
    // From Monday up to (but not including) today
    for (let i = mondayOffset; i >= 1; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      titles.push(formatDailyNoteTitle(d));
    }
    return titles;
  }

  return [];
}
