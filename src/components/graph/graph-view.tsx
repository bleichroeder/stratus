"use client";

import { useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type { GraphData, GraphNode, GraphEdge } from "@/lib/graph";

export interface GraphViewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

interface GraphViewProps {
  data: GraphData;
  onSelectNote: (id: string) => void;
  searchQuery: string;
  showOrphans: boolean;
}

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & GraphEdge;

function getNodeRadius(n: { linkCount: number }): number {
  return Math.min(4 + n.linkCount * 2, 14);
}

export const GraphView = forwardRef<GraphViewHandle, GraphViewProps>(function GraphView(
  { data, onSelectNote, searchQuery, showOrphans },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const hoveredRef = useRef<SimNode | null>(null);
  const isDraggingRef = useRef(false);
  const dragNodeRef = useRef<SimNode | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);
  const searchQueryRef = useRef(searchQuery);
  const onSelectNoteRef = useRef(onSelectNote);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const isDarkRef = useRef(false);

  // Keep refs in sync with props
  searchQueryRef.current = searchQuery;
  onSelectNoteRef.current = onSelectNote;

  // Check dark mode
  useEffect(() => {
    const check = () => {
      isDarkRef.current = document.documentElement.classList.contains("dark");
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Expose zoom controls via ref
  useImperativeHandle(ref, () => ({
    zoomIn() {
      const t = transformRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const newK = Math.min(8, t.k * 1.3);
      t.x = cx - (cx - t.x) * (newK / t.k);
      t.y = cy - (cy - t.y) * (newK / t.k);
      t.k = newK;
    },
    zoomOut() {
      const t = transformRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const newK = Math.max(0.1, t.k / 1.3);
      t.x = cx - (cx - t.x) * (newK / t.k);
      t.y = cy - (cy - t.y) * (newK / t.k);
      t.k = newK;
    },
    resetView() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      transformRef.current = { x: rect.width / 2, y: rect.height / 2, k: 1 };
    },
  }));

  // Draw function — reads everything from refs, no closure deps
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dark = isDarkRef.current;
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const t = transformRef.current;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    const nodes = nodesRef.current;
    const links = linksRef.current;
    const hNode = hoveredRef.current;
    const query = searchQueryRef.current.toLowerCase();

    // Search matches
    const matchIds = new Set<string>();
    if (query) {
      for (const n of nodes) {
        if (n.title.toLowerCase().includes(query)) matchIds.add(n.id);
      }
    }

    // Connected set for hover
    const connectedIds = new Set<string>();
    if (hNode) {
      connectedIds.add(hNode.id);
      for (const l of links) {
        const sId = typeof l.source === "object" ? (l.source as SimNode).id : l.source;
        const tId = typeof l.target === "object" ? (l.target as SimNode).id : l.target;
        if (sId === hNode.id) connectedIds.add(tId);
        if (tId === hNode.id) connectedIds.add(sId);
      }
    }

    // Edges
    for (const l of links) {
      const s = l.source as SimNode;
      const tgt = l.target as SimNode;
      if (s.x == null || s.y == null || tgt.x == null || tgt.y == null) continue;

      const isHighlighted = hNode && connectedIds.has(s.id) && connectedIds.has(tgt.id);
      const isSearchDimmed = query && !matchIds.has(s.id) && !matchIds.has(tgt.id);

      const dx = tgt.x - s.x;
      const dy = tgt.y - s.y;
      const cx = (s.x + tgt.x) / 2 + dy * 0.15;
      const cy = (s.y + tgt.y) / 2 - dx * 0.15;

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(cx, cy, tgt.x, tgt.y);

      if (isSearchDimmed) {
        ctx.strokeStyle = dark ? "rgba(120,113,108,0.06)" : "rgba(168,162,158,0.08)";
        ctx.lineWidth = 0.5;
      } else if (isHighlighted) {
        ctx.strokeStyle = dark ? "rgba(168,162,158,0.5)" : "rgba(120,113,108,0.5)";
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = dark ? "rgba(168,162,158,0.12)" : "rgba(120,113,108,0.15)";
        ctx.lineWidth = 0.8;
      }
      ctx.stroke();
    }

    // Nodes
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      const r = getNodeRadius(n);
      const isHovered = hNode?.id === n.id;
      const isConnected = hNode && connectedIds.has(n.id);
      const isMatch = query && matchIds.has(n.id);
      const isDimmed = (query && !matchIds.has(n.id)) || (hNode && !connectedIds.has(n.id));

      // Outer glow (cloud halo)
      if (!isDimmed) {
        const glowR = r * (isHovered ? 5 : isConnected ? 3.5 : 2.5);
        const grad = ctx.createRadialGradient(n.x, n.y, r * 0.5, n.x, n.y, glowR);
        if (isMatch) {
          grad.addColorStop(0, dark ? "rgba(96,165,250,0.25)" : "rgba(37,99,235,0.18)");
          grad.addColorStop(1, "transparent");
        } else if (isHovered) {
          grad.addColorStop(0, dark ? "rgba(214,211,209,0.3)" : "rgba(28,25,23,0.15)");
          grad.addColorStop(1, "transparent");
        } else {
          grad.addColorStop(0, dark ? "rgba(168,162,158,0.1)" : "rgba(120,113,108,0.08)");
          grad.addColorStop(1, "transparent");
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Core dot
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      if (isDimmed) {
        ctx.fillStyle = dark ? "rgba(87,83,78,0.2)" : "rgba(214,211,209,0.3)";
      } else if (isMatch) {
        ctx.fillStyle = dark ? "#60a5fa" : "#2563eb";
      } else if (isHovered) {
        ctx.fillStyle = dark ? "#e7e5e4" : "#1c1917";
      } else if (isConnected) {
        ctx.fillStyle = dark ? "#a8a29e" : "#78716c";
      } else {
        ctx.fillStyle = dark ? "rgba(168,162,158,0.6)" : "rgba(120,113,108,0.5)";
      }
      ctx.fill();

      // Label for hovered/connected/search-matched
      if ((isHovered || isConnected || isMatch) && !isDimmed) {
        ctx.font = `${isHovered ? "600" : "400"} ${isHovered ? 12 : 10}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = dark ? "rgba(231,229,228,0.9)" : "rgba(28,25,23,0.85)";
        ctx.fillText(n.title, n.x, n.y + r + 6, 140);
      }
    }

    ctx.restore();
  }, []); // No deps — reads everything from refs

  // Animation loop — stable, never recreated
  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      draw();
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  // Setup simulation when data/orphan filter changes
  useEffect(() => {
    const filteredData = showOrphans
      ? data
      : (() => {
          const connectedIds = new Set<string>();
          for (const edge of data.edges) {
            connectedIds.add(edge.source);
            connectedIds.add(edge.target);
          }
          return {
            nodes: data.nodes.filter((n) => connectedIds.has(n.id)),
            edges: data.edges,
          };
        })();

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    transformRef.current = { x: rect.width / 2, y: rect.height / 2, k: 1 };

    const simNodes: SimNode[] = filteredData.nodes.map((n) => ({ ...n }));
    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: SimLink[] = filteredData.edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({ ...e }));

    nodesRef.current = simNodes;
    linksRef.current = simLinks;

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(80)
          .strength(0.3)
      )
      .force("charge", forceManyBody<SimNode>().strength(-120).distanceMax(400))
      .force("center", forceCenter(0, 0).strength(0.05))
      .force("collide", forceCollide<SimNode>().radius((d) => getNodeRadius(d) + 8))
      .force("x", forceX<SimNode>(0).strength(0.02))
      .force("y", forceY<SimNode>(0).strength(0.02))
      .alphaDecay(0.015)
      .velocityDecay(0.4);

    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [data, showOrphans]);

  // Resize canvas
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      transformRef.current.x = width / 2;
      transformRef.current.y = height / 2;
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Screen to world coordinates
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const t = transformRef.current;
    return { x: (sx - t.x) / t.k, y: (sy - t.y) / t.k };
  }, []);

  // Find node at world position
  const nodeAtPosition = useCallback((wx: number, wy: number): SimNode | null => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const r = getNodeRadius(n);
      const dx = (n.x ?? 0) - wx;
      const dy = (n.y ?? 0) - wy;
      if (dx * dx + dy * dy < (r + 4) * (r + 4)) return n;
    }
    return null;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x, y } = screenToWorld(sx, sy);

      if (isDraggingRef.current && dragNodeRef.current) {
        dragNodeRef.current.fx = x;
        dragNodeRef.current.fy = y;
        simRef.current?.alpha(0.3).restart();
        return;
      }

      if (isDraggingRef.current && !dragNodeRef.current) {
        transformRef.current.x += e.movementX;
        transformRef.current.y += e.movementY;
        return;
      }

      const node = nodeAtPosition(x, y);
      hoveredRef.current = node;
      setHovered(node);
      if (node) {
        setTooltipPos({ x: e.clientX, y: e.clientY });
        canvas.style.cursor = "pointer";
      } else {
        canvas.style.cursor = "grab";
      }
    },
    [screenToWorld, nodeAtPosition]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const { x, y } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      const node = nodeAtPosition(x, y);
      if (node) {
        dragNodeRef.current = node;
        node.fx = node.x;
        node.fy = node.y;
        simRef.current?.alphaTarget(0.3).restart();
        canvas.style.cursor = "grabbing";
      } else {
        dragNodeRef.current = null;
        canvas.style.cursor = "grabbing";
      }
    },
    [screenToWorld, nodeAtPosition]
  );

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const node = dragNodeRef.current;
    isDraggingRef.current = false;

    if (node) {
      node.fx = null;
      node.fy = null;
      simRef.current?.alphaTarget(0);

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (dx * dx + dy * dy < 9) {
        onSelectNoteRef.current(node.id);
      }
    }

    dragNodeRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = hoveredRef.current ? "pointer" : "grab";
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const t = transformRef.current;

    const zoom = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const newK = Math.max(0.1, Math.min(8, t.k * zoom));

    t.x = sx - (sx - t.x) * (newK / t.k);
    t.y = sy - (sy - t.y) * (newK / t.k);
    t.k = newK;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    if (dragNodeRef.current) {
      dragNodeRef.current.fx = null;
      dragNodeRef.current.fy = null;
      simRef.current?.alphaTarget(0);
      dragNodeRef.current = null;
    }
    hoveredRef.current = null;
    setHovered(null);
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      />

      {hovered && (
        <div
          className="pointer-events-none fixed z-50 px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm shadow-lg max-w-[220px]"
          style={{ left: tooltipPos.x + 14, top: tooltipPos.y - 10 }}
        >
          <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
            {hovered.title}
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
            {hovered.linkCount} {hovered.linkCount === 1 ? "link" : "links"}
          </p>
        </div>
      )}
    </div>
  );
});
