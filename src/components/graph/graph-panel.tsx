"use client";

import { useState, useRef, useMemo } from "react";
import { buildGraphData } from "@/lib/graph";
import { GraphView, type GraphViewHandle } from "@/components/graph/graph-view";
import { GraphControls } from "@/components/graph/graph-controls";
import { FloatingOrbs } from "@/components/ui/floating-orbs";
import type { Note } from "@/lib/types";

interface GraphPanelProps {
  notes: Note[];
  onSelectNote: (id: string) => void;
  onClose: () => void;
}

export function GraphPanel({ notes, onSelectNote, onClose }: GraphPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showOrphans, setShowOrphans] = useState(true);
  const graphRef = useRef<GraphViewHandle>(null);
  const graphData = useMemo(() => buildGraphData(notes), [notes]);

  const handleSelectNote = (id: string) => {
    onClose();
    onSelectNote(id);
  };

  return (
    <div className="flex-1 relative overflow-hidden">
      <FloatingOrbs />

      <div className="absolute inset-0 z-[1]">
        <GraphView
          ref={graphRef}
          data={graphData}
          onSelectNote={handleSelectNote}
          searchQuery={searchQuery}
          showOrphans={showOrphans}
        />

        <GraphControls
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showOrphans={showOrphans}
          onToggleOrphans={() => setShowOrphans((v) => !v)}
          data={graphData}
          onZoomIn={() => graphRef.current?.zoomIn()}
          onZoomOut={() => graphRef.current?.zoomOut()}
          onResetView={() => graphRef.current?.resetView()}
          onClose={onClose}
        />
      </div>

      {graphData.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center space-y-2">
            <p className="text-sm text-stone-400 dark:text-stone-500">No notes yet</p>
            <p className="text-xs text-stone-300 dark:text-stone-600">
              Create notes and link them with [[wiki links]] to see your knowledge graph
            </p>
          </div>
        </div>
      )}

      {graphData.nodes.length > 0 && graphData.edges.length === 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="px-4 py-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm">
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Link notes with [[wiki links]] to see connections
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
