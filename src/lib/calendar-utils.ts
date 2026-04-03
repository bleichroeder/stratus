import { formatDailyNoteTitle } from "@/lib/context-hints";

/**
 * Parse a daily note title (e.g. "March 29, 2026") back to a Date.
 * Returns null if the title doesn't match the expected format.
 */
export function parseDailyNoteTitle(title: string): Date | null {
  const parsed = new Date(title);
  if (isNaN(parsed.getTime())) return null;
  // Round-trip validation: ensure the title matches exactly
  if (formatDailyNoteTitle(parsed) !== title) return null;
  return parsed;
}

/**
 * Get all dates to display in a monthly calendar grid.
 * Returns 35 or 42 dates, filling in leading/trailing days from adjacent months.
 */
export function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Day of week for the first day (0 = Sunday)
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const totalCells = startDow + totalDays > 35 ? 42 : 35;

  const dates: Date[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(year, month, 1 - startDow + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Get the 7 dates for the week containing the given date (Sunday-start).
 */
export function getWeekDays(date: Date): Date[] {
  const dow = date.getDay();
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dow + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Check if two dates represent the same calendar day.
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Format a date as "Month Year" (e.g. "March 2026").
 */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Format a date as a short weekday header (e.g. "Sun", "Mon").
 */
export function formatWeekday(dayIndex: number): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[dayIndex];
}

/**
 * Get a date key string for Map lookups (YYYY-MM-DD format).
 */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
