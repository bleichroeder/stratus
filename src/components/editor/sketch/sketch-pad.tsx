"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import getStroke from "perfect-freehand";
import {
  Pen,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  GripHorizontal,
  Square,
  Circle,
  Minus,
  Paintbrush,
  MoveRight,
  Diamond,
  Type,
} from "lucide-react";

// --- Data Model ---

export interface FreehandStroke {
  type?: "freehand"; // optional for backwards compat with old strokes
  points: number[][];
  color: string;
  size: number;
}

export interface ShapeStroke {
  type: "rectangle" | "ellipse" | "line" | "arrow" | "diamond";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fillColor: string;
  strokeWidth: number;
}

export interface TextStroke {
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export type Stroke = FreehandStroke | ShapeStroke | TextStroke;

function isShape(s: Stroke): s is ShapeStroke {
  return s.type === "rectangle" || s.type === "ellipse" || s.type === "line" || s.type === "arrow" || s.type === "diamond";
}

function isText(s: Stroke): s is TextStroke {
  return s.type === "text";
}

// --- Props ---

interface SketchPadProps {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  height?: number;
  onHeightChange?: (height: number) => void;
  readOnly?: boolean;
  collaborative?: boolean;
  backgroundColor?: string;
  onBackgroundColorChange?: (color: string) => void;
}

// --- Constants ---

const COLORS = [
  "#1c1917",
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#9333ea",
  "#e7e5e4",
];

// Light and dark background color pairs [light, dark]
const BG_COLOR_PAIRS: [string, string][] = [
  ["", ""],              // default (transparent / grid)
  ["#ffffff", "#1c1917"], // white / near-black
  ["#fefce8", "#422006"], // yellow light / dark
  ["#f0fdf4", "#052e16"], // green light / dark
  ["#eff6ff", "#172554"], // blue light / dark
  ["#fef2f2", "#450a0a"], // red light / dark
  ["#faf5ff", "#3b0764"], // purple light / dark
  ["#f5f5f4", "#292524"], // stone light / dark
  ["#fdf4ff", "#4a044e"], // fuchsia light / dark
  ["#f0fdfa", "#042f2e"], // teal light / dark
];

const PEN_SIZES = [3, 6, 10];
const TEXT_SIZES = [14, 18, 24];

type Tool = "pen" | "eraser" | "rectangle" | "ellipse" | "line" | "arrow" | "diamond" | "text";

const SHAPE_TOOLS: Tool[] = ["rectangle", "ellipse", "line", "arrow", "diamond"];

// --- Helpers ---

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

function renderFreehand(stroke: FreehandStroke) {
  const outlinePoints = getStroke(stroke.points, {
    size: stroke.size,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });
  return getSvgPathFromStroke(outlinePoints);
}

// --- Component ---

export function SketchPad({
  strokes,
  onChange,
  height = 350,
  onHeightChange,
  readOnly = false,
  collaborative = false,
  backgroundColor = "",
  onBackgroundColorChange,
}: SketchPadProps) {
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [fillColor, setFillColor] = useState("transparent");
  const [penSize, setPenSize] = useState(PEN_SIZES[0]);
  const [textSize, setTextSize] = useState(TEXT_SIZES[1]);
  const [showColors, setShowColors] = useState(false);
  const [showBgColors, setShowBgColors] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<number[][] | null>(null);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [shapePreview, setShapePreview] = useState<ShapeStroke | null>(null);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [future, setFuture] = useState<Stroke[][]>([]);
  const [active, setActive] = useState(false);
  // Text editing state
  const [textEditing, setTextEditing] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const textInputRef = useRef<HTMLInputElement>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const resizing = useRef(false);
  const resizeStart = useRef({ y: 0, h: 0 });

  const isShapeTool = SHAPE_TOOLS.includes(tool);
  const isLineLike = tool === "line" || tool === "arrow";

  // Focus text input when editing
  useEffect(() => {
    if (textEditing) {
      setTimeout(() => textInputRef.current?.focus(), 0);
    }
  }, [textEditing]);

  function getPoint(e: React.PointerEvent): number[] {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top, e.pressure ?? 0.5];
  }

  function getXY(e: React.PointerEvent): { x: number; y: number } {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function pushHistory() {
    setHistory((prev) => [...prev, strokes]);
    setFuture([]); // clear redo stack on new action
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    setActive(true);

    if (tool === "text") {
      // Commit any existing text first
      commitText();
      const pt = getXY(e);
      setTextEditing(pt);
      setTextValue("");
      return;
    }

    if (tool === "eraser") {
      handleErase(e);
      return;
    }

    if (isShapeTool) {
      const pt = getXY(e);
      setShapeStart(pt);
      setShapePreview(null);
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

    if (tool === "text") return;

    if (isShapeTool && shapeStart) {
      const pt = getXY(e);
      const x = Math.min(shapeStart.x, pt.x);
      const y = Math.min(shapeStart.y, pt.y);
      const w = Math.abs(pt.x - shapeStart.x);
      const h = Math.abs(pt.y - shapeStart.y);
      setShapePreview({
        type: tool as ShapeStroke["type"],
        x: isLineLike ? shapeStart.x : x,
        y: isLineLike ? shapeStart.y : y,
        width: isLineLike ? pt.x - shapeStart.x : w,
        height: isLineLike ? pt.y - shapeStart.y : h,
        color,
        fillColor,
        strokeWidth: penSize,
      });
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
      pushHistory();
      onChange([...strokes, newStroke]);
    }

    if (isShapeTool && shapePreview) {
      if (Math.abs(shapePreview.width) > 2 || Math.abs(shapePreview.height) > 2) {
        pushHistory();
        onChange([...strokes, shapePreview]);
      }
    }

    setCurrentStroke(null);
    setShapeStart(null);
    setShapePreview(null);
  }

  function commitText() {
    if (textEditing && textValue.trim()) {
      const newText: TextStroke = {
        type: "text",
        x: textEditing.x,
        y: textEditing.y,
        text: textValue.trim(),
        color,
        fontSize: textSize,
      };
      pushHistory();
      onChange([...strokes, newText]);
    }
    setTextEditing(null);
    setTextValue("");
  }

  function handleErase(e: React.PointerEvent) {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const radius = 15;

    const remaining = strokes.filter((stroke) => {
      if (isText(stroke)) {
        // Approximate text bounding box
        const tw = stroke.text.length * stroke.fontSize * 0.6;
        const th = stroke.fontSize;
        return !(x >= stroke.x - radius && x <= stroke.x + tw + radius && y >= stroke.y - th - radius && y <= stroke.y + radius);
      }
      if (isShape(stroke)) {
        const sx = isLineLike ? Math.min(stroke.x, stroke.x + stroke.width) : stroke.x;
        const sy = isLineLike ? Math.min(stroke.y, stroke.y + stroke.height) : stroke.y;
        const sw = Math.abs(stroke.width);
        const sh = Math.abs(stroke.height);
        return !(x >= sx - radius && x <= sx + sw + radius && y >= sy - radius && y <= sy + sh + radius);
      }
      return !stroke.points.some(([px, py]) => Math.hypot(px - x, py - y) < radius);
    });

    if (remaining.length !== strokes.length) {
      pushHistory();
      onChange(remaining);
    }
  }

  function handleUndo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture((f) => [...f, strokes]);
    setHistory((h) => h.slice(0, -1));
    onChange(prev);
  }

  function handleRedo() {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setHistory((h) => [...h, strokes]);
    setFuture((f) => f.slice(0, -1));
    onChange(next);
  }

  function handleClear() {
    if (strokes.length === 0) return;
    pushHistory();
    onChange([]);
  }

  // Resize
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

  // Current freehand preview
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

  function toolBtn(t: Tool, icon: React.ReactNode, title: string) {
    return (
      <button
        onClick={() => { commitText(); setTool(t); }}
        className={`p-1.5 rounded transition-colors ${
          tool === t
            ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
            : "text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
        }`}
        title={title}
      >
        {icon}
      </button>
    );
  }

  // Unique pattern ID per instance
  const patternId = useRef(`sketch-grid-${Math.random().toString(36).slice(2, 8)}`).current;

  return (
    <div
      ref={containerRef}
      className="select-none group/sketch relative"
      onBlur={(e) => {
        // relatedTarget is null when clicking non-focusable elements (SVG, buttons without tabIndex)
        // In that case, check after a tick whether focus is still inside the container
        if (e.relatedTarget && !containerRef.current?.contains(e.relatedTarget as Node)) {
          commitText();
          setActive(false);
          setShowColors(false);
          setShowBgColors(false);
        } else if (!e.relatedTarget) {
          requestAnimationFrame(() => {
            if (!containerRef.current?.contains(document.activeElement)) {
              // Focus truly left the container
              commitText();
              setActive(false);
              setShowColors(false);
              setShowBgColors(false);
            }
          });
        }
      }}
      tabIndex={-1}
    >
      {/* Toolbar */}
      <div
        className={`flex items-center gap-1 px-2 py-1.5 bg-stone-100 dark:bg-stone-800 rounded-t-lg border border-b-0 border-stone-200 dark:border-stone-700 transition-all ${
          showToolbar ? "opacity-100 h-auto" : "opacity-0 h-0 overflow-hidden border-0 p-0"
        }`}
        onMouseDown={(e) => e.preventDefault()}
      >
        {toolBtn("pen", <Pen size={14} />, "Pen")}
        {toolBtn("eraser", <Eraser size={14} />, "Eraser")}
        {toolBtn("text", <Type size={14} />, "Text")}

        <div className="w-px h-4 bg-stone-300 dark:bg-stone-600 mx-1" />

        {toolBtn("rectangle", <Square size={14} />, "Rectangle")}
        {toolBtn("ellipse", <Circle size={14} />, "Ellipse")}
        {toolBtn("diamond", <Diamond size={14} />, "Diamond")}
        {toolBtn("line", <Minus size={14} />, "Line")}
        {toolBtn("arrow", <MoveRight size={14} />, "Arrow")}

        <div className="w-px h-4 bg-stone-300 dark:bg-stone-600 mx-1" />

        {/* Size controls — pen sizes for drawing, text sizes for text tool */}
        {tool === "text" ? (
          TEXT_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setTextSize(s)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                textSize === s ? "bg-stone-200 dark:bg-stone-700" : "hover:bg-stone-200 dark:hover:bg-stone-700"
              } text-stone-600 dark:text-stone-400`}
              title={`${s}px`}
            >
              {s}
            </button>
          ))
        ) : (
          PEN_SIZES.map((s) => (
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
          ))
        )}

        <div className="w-px h-4 bg-stone-300 dark:bg-stone-600 mx-1" />

        {/* Stroke color */}
        <div className="relative">
          <button
            onClick={() => { setShowColors((v) => !v); setShowBgColors(false); }}
            className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            title="Color"
          >
            <div
              className="w-4 h-4 rounded-full border border-stone-300 dark:border-stone-600"
              style={{ backgroundColor: color }}
            />
          </button>
          {showColors && (
            <div className="absolute top-full left-0 mt-1 p-1.5 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-lg z-10">
              <div className="flex gap-1">
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
              {isShapeTool && (
                <>
                  <div className="text-[9px] text-stone-400 mt-1.5 mb-1">Fill</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setFillColor("transparent"); setShowColors(false); }}
                      className={`w-5 h-5 rounded-full border-2 transition-transform ${
                        fillColor === "transparent"
                          ? "border-stone-900 dark:border-stone-100 scale-110"
                          : "border-stone-300 dark:border-stone-600 hover:scale-110"
                      }`}
                      title="No fill"
                    >
                      <div className="w-full h-full rounded-full bg-white dark:bg-stone-950 relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-full h-px bg-red-400 rotate-45" />
                        </div>
                      </div>
                    </button>
                    {COLORS.map((c) => (
                      <button
                        key={`fill-${c}`}
                        onClick={() => { setFillColor(c); setShowColors(false); }}
                        className={`w-5 h-5 rounded-full border-2 transition-transform ${
                          fillColor === c
                            ? "border-stone-900 dark:border-stone-100 scale-110"
                            : "border-transparent hover:scale-110"
                        }`}
                        style={{ backgroundColor: c, opacity: 0.5 }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Background color */}
        {onBackgroundColorChange && (
          <div className="relative">
            <button
              onClick={() => { setShowBgColors((v) => !v); setShowColors(false); }}
              className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
              title="Background color"
            >
              <Paintbrush size={14} className="text-stone-500 dark:text-stone-400" />
            </button>
            {showBgColors && (
              <div className="absolute top-full left-0 mt-1 flex gap-1 flex-wrap max-w-[180px] p-1.5 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-lg z-10">
                {BG_COLOR_PAIRS.map(([light, dark]) => {
                  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  const bgColor = isDark ? dark : light;
                  const isSelected = backgroundColor === bgColor;
                  return (
                    <button
                      key={light || "default"}
                      onClick={() => { onBackgroundColorChange(bgColor); setShowBgColors(false); }}
                      className={`w-5 h-5 rounded border-2 transition-transform ${
                        isSelected
                          ? "border-stone-900 dark:border-stone-100 scale-110"
                          : "border-stone-300 dark:border-stone-600 hover:scale-110"
                      }`}
                      style={{ backgroundColor: bgColor || (isDark ? "#0c0a09" : "#ffffff") }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex-1" />

        {!collaborative && (
          <>
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className="p-1.5 rounded text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors"
              title="Undo"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={handleRedo}
              disabled={future.length === 0}
              className="p-1.5 rounded text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors"
              title="Redo"
            >
              <Redo2 size={14} />
            </button>
          </>
        )}
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
      <div className="relative">
        <svg
          ref={svgRef}
          width="100%"
          height={height}
          className={`border border-stone-200 dark:border-stone-700 ${
            showToolbar ? "rounded-b-lg" : "rounded-lg"
          } ${(tool === "eraser" || isShapeTool || tool === "text") && !readOnly ? "cursor-crosshair" : ""} ${!readOnly ? "touch-none" : ""}`}
          style={{ backgroundColor: backgroundColor || undefined }}
          onClick={() => { if (!readOnly) setActive(true); }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
            </marker>
          </defs>

          {/* Grid dots */}
          {!backgroundColor && (
            <>
              <pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="0.5" className="fill-stone-200 dark:fill-stone-800" />
              </pattern>
              <rect width="100%" height="100%" fill={`url(#${patternId})`} />
            </>
          )}

          {/* Existing strokes */}
          {strokes.map((stroke, i) =>
            isText(stroke) ? (
              <text
                key={i}
                x={stroke.x}
                y={stroke.y}
                fill={stroke.color}
                fontSize={stroke.fontSize}
                fontFamily="system-ui, -apple-system, sans-serif"
                opacity={0.9}
              >
                {stroke.text}
              </text>
            ) : isShape(stroke) ? (
              <ShapeSVG key={i} shape={stroke} />
            ) : (
              <path key={i} d={renderFreehand(stroke)} fill={stroke.color} opacity={0.9} />
            )
          )}

          {/* Current freehand preview */}
          {currentPath && <path d={currentPath} fill={color} opacity={0.9} />}

          {/* Shape preview while drawing */}
          {shapePreview && <ShapeSVG shape={shapePreview} opacity={0.6} />}
        </svg>

        {/* Text input overlay */}
        {textEditing && (
          <input
            ref={textInputRef}
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { commitText(); }
              if (e.key === "Escape") { setTextEditing(null); setTextValue(""); }
            }}
            onBlur={() => commitText()}
            className="absolute bg-transparent border-none outline-none text-stone-900 dark:text-stone-100 caret-stone-900 dark:caret-stone-100"
            style={{
              left: textEditing.x,
              top: textEditing.y - textSize,
              fontSize: textSize,
              fontFamily: "system-ui, -apple-system, sans-serif",
              color,
              minWidth: 100,
              width: Math.max(100, textValue.length * textSize * 0.65 + 20),
            }}
            placeholder="Type here..."
          />
        )}
      </div>

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

// --- Shape rendering ---

function ShapeSVG({ shape, opacity = 0.9 }: { shape: ShapeStroke; opacity?: number }) {
  const common = {
    stroke: shape.color,
    strokeWidth: shape.strokeWidth,
    fill: shape.fillColor === "transparent" ? "none" : shape.fillColor,
    opacity,
  };

  switch (shape.type) {
    case "rectangle":
      return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={2} {...common} />;
    case "ellipse":
      return (
        <ellipse
          cx={shape.x + shape.width / 2}
          cy={shape.y + shape.height / 2}
          rx={shape.width / 2}
          ry={shape.height / 2}
          {...common}
        />
      );
    case "diamond": {
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      const points = `${cx},${shape.y} ${shape.x + shape.width},${cy} ${cx},${shape.y + shape.height} ${shape.x},${cy}`;
      return <polygon points={points} {...common} />;
    }
    case "line":
      return (
        <line
          x1={shape.x}
          y1={shape.y}
          x2={shape.x + shape.width}
          y2={shape.y + shape.height}
          stroke={shape.color}
          strokeWidth={shape.strokeWidth}
          strokeLinecap="round"
          opacity={opacity}
        />
      );
    case "arrow":
      return (
        <line
          x1={shape.x}
          y1={shape.y}
          x2={shape.x + shape.width}
          y2={shape.y + shape.height}
          stroke={shape.color}
          strokeWidth={shape.strokeWidth}
          strokeLinecap="round"
          markerEnd="url(#arrowhead)"
          style={{ color: shape.color }}
          opacity={opacity}
        />
      );
    default:
      return null;
  }
}
