"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getNotes } from "@/lib/notes";
import { buildGraphData, type GraphData } from "@/lib/graph";
import { GraphView, type GraphViewHandle } from "@/components/graph/graph-view";
import { GraphControls } from "@/components/graph/graph-controls";
import { FloatingOrbs } from "@/components/ui/floating-orbs";
import { createClient } from "@/lib/supabase/client";


export default function GraphPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [showOrphans, setShowOrphans] = useState(true);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [focusDepth, setFocusDepth] = useState(1);
  const graphRef = useRef<GraphViewHandle>(null);

  const focusNodeTitle = focusNodeId
    ? graphData.nodes.find((n) => n.id === focusNodeId)?.title ?? null
    : null;

  // Auth check + load notes
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      getNotes().then((data) => {
        setGraphData(buildGraphData(data));
        setLoading(false);
      });
    });
  }, [router]);

  const handleSelectNote = useCallback(
    (id: string) => {
      router.push(`/dashboard?note=${id}`);
    },
    [router]
  );

  if (loading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-white dark:bg-stone-950 relative">
        <FloatingOrbs />
        <Loader2 size={24} className="animate-spin text-stone-400 dark:text-stone-500" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col bg-white dark:bg-stone-950 relative overflow-hidden">
      {/* Background cloud effect */}
      <FloatingOrbs />

      {/* Graph canvas */}
      <div className="flex-1 relative z-[1]">
        <GraphView
          ref={graphRef}
          data={graphData}
          onSelectNote={handleSelectNote}
          searchQuery={searchQuery}
          showOrphans={showOrphans}
          focusNodeId={focusNodeId}
          focusDepth={focusDepth}
          onFocusNode={setFocusNodeId}
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
          showBackButton
          focusNodeTitle={focusNodeTitle}
          focusDepth={focusDepth}
          onFocusDepthChange={setFocusDepth}
          onExitFocus={() => setFocusNodeId(null)}
        />
      </div>

      {/* Empty state */}
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
