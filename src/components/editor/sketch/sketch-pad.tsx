"use client";

import { useState, useRef, useCallback } from "react";
import getStroke from "perfect-freehand";
import {
  Pen,
  Eraser,
  Undo2,
  Trash2,
  GripHorizontal,
} from "lucide-react";

export interface Stroke {
  points: number[][];
  color: string;
  size: number;
}

interface SketchPadProps {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  height?: number;
  onHeightChange?: (height: number) => void;
  readOnly?: boolean;
}

const COLORS = [
  "#1c1917",
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#9333ea",
  "#e7e5e4",
];

const PEN_SIZES = [3, 6, 10];

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );
  d.push("Z");
  return d.join(" ");
}

function renderStroke(stroke: Stroke) {
  const outlinePoints = getStroke(stroke.points, {
    size: stroke.size,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });
  return getSvgPathFromStroke(outlinePoints);
}

export function SketchPad({
  strokes,
  onChange,
  height = 350,
  onHeightChange,
  readOnly = false,
}: SketchPadProps) {
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [penSize, setPenSize] = useState(PEN_SIZES[0]);
  const [showColors, setShowColors] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<number[][] | null>(null);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [active, setActive] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const resizing = useRef(false);
  const resizeStart = useRef({ y: 0, h: 0 });

  function getPoint(e: React.PointerEvent): number[] {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return [
      e.clientX - rect.left,
      e.clientY - rect.top,
      e.pressure ?? 0.5,
    ];
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    setActive(true);

    if (tool === "eraser") {
      handleErase(e);
      return;
    }
    setCurrentStroke([getPoint(e)]);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drawing.current || readOnly) return;
    e.preventDefault();

    if (tool === "eraser") {
      handleErase(e);
      return;
    }
    if (currentStroke) {
      setCurrentStroke((prev) => [...(prev ?? []), getPoint(e)]);
    }
  }

  function handlePointerUp() {
    if (!drawing.current || readOnly) return;
    drawing.current = false;

    if (tool === "pen" && currentStroke && currentStroke.length > 1) {
      const newStroke: Stroke = { points: currentStroke, color, size: penSize };
      const newStrokes = [...strokes, newStroke];
      setHistory((prev) => [...prev, strokes]);
      onChange(newStrokes);
    }
    setCurrentStroke(null);
  }

  function handleErase(e: React.PointerEvent) {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const radius = 15;

    const remaining = strokes.filter((stroke) =>
      !stroke.points.some(([px, py]) => Math.hypot(px - x, py - y) < radius)
    );

    if (remaining.length !== strokes.length) {
      setHistory((prev) => [...prev, strokes]);
      onChange(remaining);
    }
  }

  function handleUndo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    onChange(prev);
  }

  function handleClear() {
    if (strokes.length === 0) return;
    setHistory((prev) => [...prev, strokes]);
    onChange([]);
  }

  // Resize handle
  function handleResizeDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    resizing.current = true;
    resizeStart.current = { y: e.clientY, h: height };
  }

  function handleResizeMove(e: React.PointerEvent) {
    if (!resizing.current) return;
    const delta = e.clientY - resizeStart.current.y;
    const newHeight = Math.max(150, Math.min(800, resizeStart.current.h + delta));
    onHeightChange?.(newHeight);
  }

  function handleResizeUp() {
    resizing.current = false;
  }

  const currentPath =
    currentStroke && currentStroke.length > 1
      ? getSvgPathFromStroke(
          getStroke(currentStroke, {
            size: penSize,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
          })
        )
      : null;

  const showToolbar = !readOnly && active;

  return (
    <div
      ref={containerRef}
      className="select-none group/sketch relative"
      onBlur={(e) => {
        // Deactivate when focus leaves the entire sketch container
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          setActive(false);
          setShowColors(false);
        }
      }}
      tabIndex={-1}
    >
      {/* Toolbar — only visible when active */}
      <div
        className={`flex items-center gap-1 px-2 py-1.5 bg-stone-100 dark:bg-stone-800 rounded-t-lg border border-b-0 border-stone-200 dark:border-stone-700 transition-all ${
          showToolbar ? "opacity-100 h-auto" : "opacity-0 h-0 overflow-hidden border-0 p-0"
        }`}
      >
        <button
          onClick={() => setTool("pen")}
          className={`p-1.5 rounded transition-colors ${
            tool === "pen"
              ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
          }`}
          title="Pen"
        >
          <Pen size={14} />
        </button>
        <button
          onClick={() => setTool("eraser")}
          className={`p-1.5 rounded transition-colors ${
            tool === "eraser"
              ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
          }`}
          title="Eraser"
        >
          <Eraser size={14} />
        </button>

        <div className="w-px h-4 bg-stone-300 dark:bg-stone-600 mx-1" />

        {PEN_SIZES.map((s) => (
          <button
            key={s}
            onClick={() => setPenSize(s)}
            className={`p-1.5 rounded transition-colors ${
              penSize === s ? "bg-stone-200 dark:bg-stone-700" : "hover:bg-stone-200 dark:hover:bg-stone-700"
            }`}
            title={`Size ${s}`}
          >
            <div
              className="rounded-full bg-stone-900 dark:bg-stone-100"
              style={{ width: Math.max(4, s), height: Math.max(4, s) }}
            />
          </button>
        ))}

        <div className="w-px h-4 bg-stone-300 dark:bg-stone-600 mx-1" />

        <div className="relative">
          <button
            onClick={() => setShowColors((v) => !v)}
            className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            title="Color"
          >
            <div
              className="w-4 h-4 rounded-full border border-stone-300 dark:border-stone-600"
              style={{ backgroundColor: color }}
            />
          </button>
          {showColors && (
            <div className="absolute top-full left-0 mt-1 flex gap-1 p-1.5 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-lg z-10">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setShowColors(false); }}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${
                    color === c
                      ? "border-stone-900 dark:border-stone-100 scale-110"
                      : "border-transparent hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={handleUndo}
          disabled={history.length === 0}
          className="p-1.5 rounded text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors"
          title="Undo"
        >
          <Undo2 size={14} />
        </button>
        <button
          onClick={handleClear}
          disabled={strokes.length === 0}
          className="p-1.5 rounded text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors"
          title="Clear"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        className={`bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 ${
          showToolbar ? "rounded-b-lg" : "rounded-lg"
        } ${tool === "eraser" && !readOnly ? "cursor-crosshair" : ""} ${!readOnly ? "touch-none" : ""}`}
        onClick={() => { if (!readOnly) setActive(true); }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <pattern id="sketch-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="0.5" className="fill-stone-200 dark:fill-stone-800" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#sketch-grid)" />

        {strokes.map((stroke, i) => (
          <path key={i} d={renderStroke(stroke)} fill={stroke.color} opacity={0.9} />
        ))}

        {currentPath && <path d={currentPath} fill={color} opacity={0.9} />}
      </svg>

      {/* Resize handle */}
      {!readOnly && (
        <div
          className="flex items-center justify-center py-1 cursor-ns-resize opacity-0 group-hover/sketch:opacity-100 transition-opacity"
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
        >
          <GripHorizontal size={14} className="text-stone-400 dark:text-stone-600" />
        </div>
      )}
    </div>
  );
}
