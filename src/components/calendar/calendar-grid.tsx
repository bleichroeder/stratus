"use client";

import { useCallback } from "react";
import { DayCell, type WikiLinkPip } from "@/components/calendar/day-cell";
import { getMonthDays, getWeekDays, isSameDay, formatWeekday, dateKey } from "@/lib/calendar-utils";
import type { Note } from "@/lib/types";

interface CalendarGridProps {
  currentDate: Date;
  viewMode: "month" | "week";
  selectedDay: string | null;
  dailyNotesByDate: Map<string, Note>;
  previewsByDate: Map<string, string>;
  wikiLinksByDate: Map<string, WikiLinkPip[]>;
  onClickDay: (date: Date) => void;
  onClickPip: (noteId: string) => void;
  onHoverDay: (dateStr: string | null) => void;
  dayCellRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

export function CalendarGrid({
  currentDate,
  viewMode,
  selectedDay,
  dailyNotesByDate,
  previewsByDate,
  wikiLinksByDate,
  onClickDay,
  onClickPip,
  onHoverDay,
  dayCellRefs,
}: CalendarGridProps) {
  const today = new Date();
  const dates =
    viewMode === "month"
      ? getMonthDays(currentDate.getFullYear(), currentDate.getMonth())
      : getWeekDays(currentDate);

  const setRef = useCallback(
    (key: string, el: HTMLDivElement | null) => {
      if (el) {
        dayCellRefs.current.set(key, el);
      } else {
        dayCellRefs.current.delete(key);
      }
    },
    [dayCellRefs]
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-stone-200 dark:border-stone-800">
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className="px-2 py-1.5 text-xs font-medium text-stone-400 dark:text-stone-500 text-center"
          >
            {formatWeekday(i)}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        className={`grid grid-cols-7 flex-1 ${
          viewMode === "week" ? "" : "auto-rows-fr"
        }`}
      >
        {dates.map((date) => {
          const key = dateKey(date);
          const isCurrentMonth = date.getMonth() === currentDate.getMonth();
          const preview = previewsByDate.get(key) ?? null;
          const hasNote = dailyNotesByDate.has(key);
          const wikiLinks = wikiLinksByDate.get(key) ?? [];

          return (
            <DayCell
              key={key}
              ref={(el) => setRef(key, el)}
              date={date}
              preview={preview}
              hasNote={hasNote}
              wikiLinks={wikiLinks}
              isCurrentMonth={viewMode === "week" ? true : isCurrentMonth}
              isToday={isSameDay(date, today)}
              isSelected={selectedDay === key}
              viewMode={viewMode}
              onClick={() => onClickDay(date)}
              onClickPip={onClickPip}
              onMouseEnter={() => onHoverDay(key)}
              onMouseLeave={() => onHoverDay(null)}
            />
          );
        })}
      </div>
    </div>
  );
}
