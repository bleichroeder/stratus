"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { extractWikiLinks } from "@/lib/graph";
import { formatDailyNoteTitle } from "@/lib/context-hints";
import { parseDailyNoteTitle, dateKey } from "@/lib/calendar-utils";
import { tiptapToPlainText } from "@/lib/ai";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { CalendarArcs, type CrossDayLink } from "@/components/calendar/calendar-arcs";
import { CalendarControls } from "@/components/calendar/calendar-controls";
import { DayPopover } from "@/components/calendar/day-popover";
import type { WikiLinkPip } from "@/components/calendar/day-cell";
import type { Note } from "@/lib/types";

interface CalendarPanelProps {
  notes: Note[];
  onSelectNote: (id: string) => void;
  onDailyNote: (date: Date) => void;
  onClose: () => void;
}

export function CalendarPanel({ notes, onSelectNote, onDailyNote, onClose }: CalendarPanelProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const dayCellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Deselect on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedDay) {
        setSelectedDay(null);
        setSelectedDate(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedDay]);

  // Build lookup maps from notes
  const {
    dailyNotesByDate, previewsByDate, fullPreviewsByDate, wikiLinksByDate,
    crossDayLinks, noteIdToNote, noteIdToDateKey,
  } = useMemo(() => {
    const dailyNotesByDate = new Map<string, Note>();
    const noteIdToNote = new Map<string, Note>();
    const noteIdToDateKey = new Map<string, string>();

    for (const note of notes) {
      if (!note.is_folder) {
        noteIdToNote.set(note.id, note);
      }
    }

    for (const note of notes) {
      if (note.is_folder) continue;
      const parsed = parseDailyNoteTitle(note.title);
      if (parsed) {
        const key = dateKey(parsed);
        dailyNotesByDate.set(key, note);
        noteIdToDateKey.set(note.id, key);
      }
    }

    const previewsByDate = new Map<string, string>();
    const fullPreviewsByDate = new Map<string, string>();
    const wikiLinksByDate = new Map<string, WikiLinkPip[]>();
    const crossDayLinks: CrossDayLink[] = [];
    const seenLinks = new Set<string>();

    for (const [key, note] of dailyNotesByDate) {
      if (note.content) {
        const text = tiptapToPlainText(note.content).trim();
        if (text) {
          previewsByDate.set(key, text.slice(0, 200));
          fullPreviewsByDate.set(key, text.slice(0, 2000));
        }
      }

      const linkedIds = extractWikiLinks(note.content);
      const pips: WikiLinkPip[] = [];

      for (const linkedId of linkedIds) {
        const linkedNote = noteIdToNote.get(linkedId);
        if (!linkedNote) continue;

        const linkedDateKey = noteIdToDateKey.get(linkedId);
        pips.push({
          id: linkedId,
          title: linkedNote.title,
          isDailyNote: !!linkedDateKey,
        });

        if (linkedDateKey && linkedDateKey !== key) {
          const arcKey = [key, linkedDateKey].sort().join(":");
          if (!seenLinks.has(arcKey)) {
            seenLinks.add(arcKey);
            crossDayLinks.push({ fromDateKey: key, toDateKey: linkedDateKey });
          }
        }
      }

      if (pips.length > 0) {
        wikiLinksByDate.set(key, pips);
      }
    }

    return {
      dailyNotesByDate, previewsByDate, fullPreviewsByDate, wikiLinksByDate,
      crossDayLinks, noteIdToNote, noteIdToDateKey,
    };
  }, [notes]);

  const selectDay = useCallback((date: Date) => {
    const key = dateKey(date);
    setSelectedDay(key);
    setSelectedDate(date);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedDay(null);
    setSelectedDate(null);
  }, []);

  const handlePrev = useCallback(() => {
    clearSelection();
    setCurrentDate((d) => {
      if (viewMode === "month") {
        return new Date(d.getFullYear(), d.getMonth() - 1, 1);
      }
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 7);
      return prev;
    });
  }, [viewMode, clearSelection]);

  const handleNext = useCallback(() => {
    clearSelection();
    setCurrentDate((d) => {
      if (viewMode === "month") {
        return new Date(d.getFullYear(), d.getMonth() + 1, 1);
      }
      const next = new Date(d);
      next.setDate(next.getDate() + 7);
      return next;
    });
  }, [viewMode, clearSelection]);

  const handleToday = useCallback(() => {
    clearSelection();
    setCurrentDate(new Date());
  }, [clearSelection]);

  const handleClickDay = useCallback(
    (date: Date) => {
      // If clicking a day outside the current month, navigate there and select it
      if (viewMode === "month" && date.getMonth() !== currentDate.getMonth()) {
        setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
        selectDay(date);
        return;
      }
      const key = dateKey(date);
      // Toggle selection: click again to deselect
      if (selectedDay === key) {
        clearSelection();
      } else {
        selectDay(date);
      }
    },
    [viewMode, currentDate, selectedDay, selectDay, clearSelection]
  );

  const handleOpenNote = useCallback(() => {
    if (!selectedDay) return;
    const existingNote = dailyNotesByDate.get(selectedDay);
    if (existingNote) {
      onClose();
      onSelectNote(existingNote.id);
    }
  }, [selectedDay, dailyNotesByDate, onSelectNote, onClose]);

  const handleCreateNote = useCallback(() => {
    if (!selectedDate) return;
    onDailyNote(selectedDate);
  }, [selectedDate, onDailyNote]);

  const handleClickPip = useCallback(
    (noteId: string) => {
      const targetDateKey = noteIdToDateKey.get(noteId);
      if (targetDateKey) {
        const targetNote = noteIdToNote.get(noteId);
        if (targetNote) {
          const targetDate = parseDailyNoteTitle(targetNote.title);
          if (targetDate) {
            setCurrentDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
            selectDay(targetDate);
            return;
          }
        }
      }
      onClose();
      onSelectNote(noteId);
    },
    [noteIdToDateKey, noteIdToNote, onSelectNote, onClose, selectDay]
  );

  // Modal data
  const popoverPreview = selectedDay ? fullPreviewsByDate.get(selectedDay) ?? null : null;
  const popoverHasNote = selectedDay ? dailyNotesByDate.has(selectedDay) : false;
  const popoverWikiLinks = selectedDay ? wikiLinksByDate.get(selectedDay) ?? [] : [];

  return (
    <div className="flex-1 relative overflow-hidden bg-white dark:bg-stone-950" ref={containerRef}>
      <div className="absolute inset-0 flex flex-col pt-16">
        <CalendarGrid
          currentDate={currentDate}
          viewMode={viewMode}
          selectedDay={selectedDay}
          dailyNotesByDate={dailyNotesByDate}
          previewsByDate={previewsByDate}
          wikiLinksByDate={wikiLinksByDate}
          onClickDay={handleClickDay}
          onClickPip={handleClickPip}
          onHoverDay={setHoveredDay}
          dayCellRefs={dayCellRefs}
        />
      </div>

      <CalendarArcs
        crossDayLinks={crossDayLinks}
        dayCellRefs={dayCellRefs}
        containerRef={containerRef}
        hoveredDay={hoveredDay}
      />

      {/* Day detail popover */}
      {selectedDay && selectedDate && (
        <DayPopover
          date={selectedDate}
          preview={popoverPreview}
          hasNote={popoverHasNote}
          wikiLinks={popoverWikiLinks}
          onOpenNote={handleOpenNote}
          onCreateNote={handleCreateNote}
          onClickPip={handleClickPip}
          onClose={clearSelection}
        />
      )}

      <CalendarControls
        currentDate={currentDate}
        viewMode={viewMode}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewModeChange={setViewMode}
        onClose={onClose}
      />

      {dailyNotesByDate.size === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center space-y-2">
            <p className="text-sm text-stone-400 dark:text-stone-500">No daily notes yet</p>
            <p className="text-xs text-stone-300 dark:text-stone-600">
              Click any day to create a daily note
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
