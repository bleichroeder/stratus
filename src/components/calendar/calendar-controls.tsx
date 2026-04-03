"use client";

import { ChevronLeft, ChevronRight, X, Calendar, Rows3 } from "lucide-react";
import { formatMonthYear } from "@/lib/calendar-utils";

interface CalendarControlsProps {
  currentDate: Date;
  viewMode: "month" | "week";
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (mode: "month" | "week") => void;
  onClose: () => void;
}

export function CalendarControls({
  currentDate,
  viewMode,
  onPrev,
  onNext,
  onToday,
  onViewModeChange,
  onClose,
}: CalendarControlsProps) {
  return (
    <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none z-10">
      {/* Left: navigation */}
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm shadow-sm">
          <button
            onClick={onPrev}
            className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 transition-colors"
            title={viewMode === "month" ? "Previous month" : "Previous week"}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-stone-900 dark:text-stone-100 min-w-[140px] text-center">
            {formatMonthYear(currentDate)}
          </span>
          <button
            onClick={onNext}
            className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 transition-colors"
            title={viewMode === "month" ? "Next month" : "Next week"}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <button
          onClick={onToday}
          className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm shadow-sm text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          Today
        </button>
      </div>

      {/* Right: view toggle + close */}
      <div className="pointer-events-auto flex flex-col gap-1 rounded-lg border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm shadow-sm p-1">
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 transition-colors"
          title="Close calendar"
        >
          <X size={16} />
        </button>
        <div className="border-t border-stone-200 dark:border-stone-700 my-0.5" />
        <button
          onClick={() => onViewModeChange("month")}
          className={`p-1.5 rounded transition-colors ${
            viewMode === "month"
              ? "bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100"
              : "hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400"
          }`}
          title="Month view"
        >
          <Calendar size={16} />
        </button>
        <button
          onClick={() => onViewModeChange("week")}
          className={`p-1.5 rounded transition-colors ${
            viewMode === "week"
              ? "bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100"
              : "hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400"
          }`}
          title="Week view"
        >
          <Rows3 size={16} />
        </button>
      </div>
    </div>
  );
}
