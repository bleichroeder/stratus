"use client";

import { Search, ZoomIn, ZoomOut, Eye, EyeOff, Maximize, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { GraphData } from "@/lib/graph";

interface GraphControlsProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showOrphans: boolean;
  onToggleOrphans: () => void;
  data: GraphData;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  showBackButton?: boolean;
}

export function GraphControls({
  searchQuery,
  onSearchChange,
  showOrphans,
  onToggleOrphans,
  data,
  onZoomIn,
  onZoomOut,
  onResetView,
  showBackButton = false,
}: GraphControlsProps) {
  const connectedCount = new Set(data.edges.flatMap((e) => [e.source, e.target])).size;

  return (
    <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none z-10">
      {/* Left column: back + search + stats */}
      <div className="pointer-events-auto flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {showBackButton && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm shadow-sm text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </Link>
          )}

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm shadow-sm">
            <Search size={14} className="text-stone-400 dark:text-stone-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search notes..."
              className="bg-transparent text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 outline-none w-44"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm text-xs text-stone-400 dark:text-stone-500">
          {data.nodes.length} notes &middot; {data.edges.length} links &middot; {connectedCount} connected
        </div>
      </div>

      {/* Right column: zoom + toggle controls */}
      <div className="pointer-events-auto flex flex-col gap-1 rounded-lg border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm shadow-sm p-1">
        <button
          onClick={onZoomIn}
          className="p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 transition-colors"
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={onZoomOut}
          className="p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 transition-colors"
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={onResetView}
          className="p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 transition-colors"
          title="Reset view"
        >
          <Maximize size={16} />
        </button>
        <div className="border-t border-stone-200 dark:border-stone-700 my-0.5" />
        <button
          onClick={onToggleOrphans}
          className="p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 transition-colors"
          title={showOrphans ? "Hide unlinked notes" : "Show unlinked notes"}
        >
          {showOrphans ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>
    </div>
  );
}
