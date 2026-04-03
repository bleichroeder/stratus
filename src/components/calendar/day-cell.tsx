"use client";

import { forwardRef } from "react";

export interface WikiLinkPip {
  id: string;
  title: string;
  isDailyNote: boolean;
}

interface DayCellProps {
  date: Date;
  preview: string | null;
  hasNote: boolean;
  wikiLinks: WikiLinkPip[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  viewMode: "month" | "week";
  onClick: () => void;
  onClickPip: (noteId: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const DayCell = forwardRef<HTMLDivElement, DayCellProps>(
  function DayCell(
    {
      date, preview, hasNote, wikiLinks, isCurrentMonth, isToday,
      isSelected, viewMode, onClick, onClickPip,
      onMouseEnter, onMouseLeave,
    },
    ref
  ) {
    const maxPips = viewMode === "week" ? 8 : 4;
    const visiblePips = wikiLinks.slice(0, maxPips);
    const overflowCount = wikiLinks.length - maxPips;

    return (
      <div
        ref={ref}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`
          group relative flex flex-col border cursor-pointer overflow-hidden
          bg-white dark:bg-stone-950 transition-colors
          ${isSelected
            ? "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
            : "border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-900/50"
          }
          ${viewMode === "week" ? "min-h-[300px]" : "min-h-[100px]"}
          ${!isCurrentMonth ? "opacity-40" : ""}
          ${isToday && !isSelected ? "ring-1 ring-blue-400/50 dark:ring-blue-500/50 ring-inset" : ""}
        `}
      >
        {/* Day number */}
        <div className="flex items-center justify-between px-2 py-1">
          <span
            className={`text-xs font-medium ${
              isToday
                ? "bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                : "text-stone-500 dark:text-stone-400"
            }`}
          >
            {date.getDate()}
          </span>
          {hasNote && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500" />
          )}
        </div>

        {/* Content preview */}
        {preview && (
          <div className="px-2 flex-1 overflow-hidden">
            <p
              className={`text-xs text-stone-600 dark:text-stone-300 leading-relaxed ${
                viewMode === "week" ? "line-clamp-[12]" : "line-clamp-3"
              }`}
            >
              {preview}
            </p>
          </div>
        )}

        {/* Wiki link pips */}
        {wikiLinks.length > 0 && (
          <div className="px-2 py-1 flex flex-wrap gap-1 mt-auto">
            {visiblePips.map((pip) => (
              <button
                key={pip.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onClickPip(pip.id);
                }}
                className={`px-1.5 py-0.5 text-[10px] rounded-full truncate max-w-[80px] transition-colors ${
                  pip.isDailyNote
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60"
                    : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
                }`}
                title={pip.title}
              >
                {pip.title}
              </button>
            ))}
            {overflowCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] text-stone-400 dark:text-stone-500">
                +{overflowCount}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);
