"use client";

import { useEffect, useState, useCallback } from "react";

export interface CrossDayLink {
  fromDateKey: string;
  toDateKey: string;
}

interface CalendarArcsProps {
  crossDayLinks: CrossDayLink[];
  dayCellRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  hoveredDay: string | null;
}

interface ArcPath {
  key: string;
  d: string;
  highlighted: boolean;
}

export function CalendarArcs({
  crossDayLinks,
  dayCellRefs,
  containerRef,
  hoveredDay,
}: CalendarArcsProps) {
  const [arcs, setArcs] = useState<ArcPath[]>([]);

  const computeArcs = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const newArcs: ArcPath[] = [];

    for (const link of crossDayLinks) {
      const fromEl = dayCellRefs.current.get(link.fromDateKey);
      const toEl = dayCellRefs.current.get(link.toDateKey);
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      // Center points relative to container
      const x1 = fromRect.left + fromRect.width / 2 - containerRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
      const x2 = toRect.left + toRect.width / 2 - containerRect.left;
      const y2 = toRect.top + toRect.height / 2 - containerRect.top;

      // Midpoint
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;

      // Perpendicular offset for the control point
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const offset = Math.min(dist * 0.2, 60);

      // Offset perpendicular (rotate 90 degrees)
      const cx = mx + (dy / dist) * offset;
      const cy = my - (dx / dist) * offset;

      const isHighlighted =
        hoveredDay === link.fromDateKey || hoveredDay === link.toDateKey;

      newArcs.push({
        key: `${link.fromDateKey}-${link.toDateKey}`,
        d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
        highlighted: isHighlighted,
      });
    }

    setArcs(newArcs);
  }, [crossDayLinks, dayCellRefs, containerRef, hoveredDay]);

  useEffect(() => {
    computeArcs();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      computeArcs();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [computeArcs, containerRef]);

  if (arcs.length === 0) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
      {arcs.map((arc) => (
        <path
          key={arc.key}
          d={arc.d}
          fill="none"
          stroke={arc.highlighted ? "rgb(96 165 250)" : "currentColor"}
          strokeWidth={arc.highlighted ? 2 : 1.5}
          opacity={arc.highlighted ? 0.6 : 0.15}
          className="text-stone-400 dark:text-stone-500 transition-opacity duration-200"
        />
      ))}
    </svg>
  );
}
