"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchCalendarEvents } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/types";
import { FileText } from "lucide-react";

interface UpcomingMeetingsProps {
  onPrepareMeetingNote: (event: CalendarEvent) => void;
  preparingNoteForEventId: string | null;
}

function formatTimeRange(startTime: string, endTime: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const start = new Date(startTime).toLocaleTimeString("en-US", opts);
  const end = new Date(endTime).toLocaleTimeString("en-US", opts);
  return `${start} – ${end}`;
}

function getDayLabel(dateStr: string): string {
  const eventDate = new Date(dateStr);
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterStart = new Date(todayStart);
  dayAfterStart.setDate(dayAfterStart.getDate() + 2);

  if (eventDate >= todayStart && eventDate < tomorrowStart) return "Today";
  if (eventDate >= tomorrowStart && eventDate < dayAfterStart) return "Tomorrow";
  return eventDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function EventCard({ event, onPrepareMeetingNote, isPreparing }: {
  event: CalendarEvent;
  onPrepareMeetingNote: (event: CalendarEvent) => void;
  isPreparing: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
      <span className="hidden sm:inline text-xs font-mono text-stone-400 dark:text-stone-500 shrink-0 w-[135px] tabular-nums">
        {formatTimeRange(event.startTime, event.endTime)}
      </span>
      <div className="flex-1 min-w-0 sm:contents">
        <span className="sm:hidden block text-[11px] font-mono text-stone-400 dark:text-stone-500">
          {formatTimeRange(event.startTime, event.endTime)}
        </span>
        <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate sm:flex-1 sm:min-w-0">
          {event.title}
        </p>
      </div>
      <button
        onClick={() => onPrepareMeetingNote(event)}
        disabled={isPreparing}
        title="Prepare note"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 shrink-0 transition-colors"
      >
        <FileText size={12} />
        <span className="hidden sm:inline">{isPreparing ? "Creating..." : "Prepare note"}</span>
      </button>
    </div>
  );
}

const MAX_EVENTS = 5;

export function UpcomingMeetings({ onPrepareMeetingNote, preparingNoteForEventId }: UpcomingMeetingsProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Calculate hours needed to reach end of tomorrow
    const now = new Date();
    const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
    const hoursUntilEndOfTomorrow = Math.ceil((endOfTomorrow.getTime() - now.getTime()) / (1000 * 60 * 60));

    fetchCalendarEvents(hoursUntilEndOfTomorrow)
      .then((data) => {
        if (!cancelled) setEvents(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Take the first MAX_EVENTS events, then group by day label
  const grouped = useMemo(() => {
    const capped = events.slice(0, MAX_EVENTS);
    const groups: { label: string; events: CalendarEvent[] }[] = [];
    for (const event of capped) {
      const label = getDayLabel(event.startTime);
      const existing = groups.find((g) => g.label === label);
      if (existing) {
        existing.events.push(event);
      } else {
        groups.push({ label, events: [event] });
      }
    }
    return groups;
  }, [events]);

  if (error) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
        Upcoming meetings
      </h2>
      {loading || events.length === 0 ? (
        <p className="text-xs text-stone-400 dark:text-stone-500 py-2">
          No upcoming meetings
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map((group, i) => (
            <div key={group.label} className="space-y-1.5">
              <p className={`text-xs font-semibold uppercase tracking-wider ${i > 0 ? "pt-2 border-t border-stone-200 dark:border-stone-800" : ""} ${group.label === "Today" ? "text-stone-900 dark:text-stone-100" : "text-stone-400 dark:text-stone-500"}`}>
                {group.label}
              </p>
              {group.events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPrepareMeetingNote={onPrepareMeetingNote}
                  isPreparing={preparingNoteForEventId === event.id}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
