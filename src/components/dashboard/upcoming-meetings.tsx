"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchCalendarEvents } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/types";
import { Video, Users, FileText } from "lucide-react";

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
  const attendeeCount = event.attendees.filter((a) => !a.self).length;

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
          {event.title}
        </p>
        <button
          onClick={() => onPrepareMeetingNote(event)}
          disabled={isPreparing}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 shrink-0 transition-colors"
        >
          <FileText size={12} />
          {isPreparing ? "Creating..." : "Prepare note"}
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs text-stone-400 dark:text-stone-500">
        <span className="font-mono whitespace-nowrap">
          {formatTimeRange(event.startTime, event.endTime)}
        </span>
        {attendeeCount > 0 && (
          <span className="flex items-center gap-1">
            <Users size={10} />
            {attendeeCount}
          </span>
        )}
        {event.meetingLink && (
          <a
            href={event.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Video size={10} />
            Join
          </a>
        )}
      </div>
    </div>
  );
}

const MAX_EVENTS_PER_DAY = 5;

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

  // Group events by day label
  const grouped = useMemo(() => {
    const groups: { label: string; events: CalendarEvent[] }[] = [];
    for (const event of events) {
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
          {grouped.map((group) => (
            <div key={group.label} className="space-y-2">
              {grouped.length > 1 && (
                <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                  {group.label}
                </p>
              )}
              {group.events.slice(0, MAX_EVENTS_PER_DAY).map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPrepareMeetingNote={onPrepareMeetingNote}
                  isPreparing={preparingNoteForEventId === event.id}
                />
              ))}
              {group.events.length > MAX_EVENTS_PER_DAY && (
                <p className="text-xs text-stone-400 dark:text-stone-500 pl-3">
                  +{group.events.length - MAX_EVENTS_PER_DAY} more
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
