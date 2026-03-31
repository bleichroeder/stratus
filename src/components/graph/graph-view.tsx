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
  focusNodeId: string | null;
  focusDepth: number;
  onFocusNode: (id: string | null) => void;
}

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & GraphEdge;

function getNodeRadius(n: { linkCount: number }): number {
  return Math.min(4 + n.linkCount * 2, 14);
}

/**
 * Compute the set of node IDs within `depth` hops of `rootId`.
 */
function getNeighborhood(
  rootId: string,
  links: SimLink[],
  depth: number
): Set<string> {
  const neighbors = new Set<string>([rootId]);
  let frontier = new Set<string>([rootId]);

  for (let d = 0; d < depth; d++) {
    const nextFrontier = new Set<string>();
    for (const l of links) {
      const sId = typeof l.source === "object" ? (l.source as SimNode).id : l.source;
      const tId = typeof l.target === "object" ? (l.target as SimNode).id : l.target;
      if (frontier.has(sId) && !neighbors.has(tId)) {
        nextFrontier.add(tId);
        neighbors.add(tId);
      }
      if (frontier.has(tId) && !neighbors.has(sId)) {
        nextFrontier.add(sId);
        neighbors.add(sId);
      }
    }
    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  return neighbors;
}

export const GraphView = forwardRef<GraphViewHandle, GraphViewProps>(function GraphView(
  { data, onSelectNote, searchQuery, showOrphans, focusNodeId, focusDepth, onFocusNode },
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
  const focusNodeIdRef = useRef(focusNodeId);
  const focusDepthRef = useRef(focusDepth);
  const onFocusNodeRef = useRef(onFocusNode);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const isDarkRef = useRef(false);
  const lastClickTimeRef = useRef(0);

  // Keep refs in sync with props
  searchQueryRef.current = searchQuery;
  onSelectNoteRef.current = onSelectNote;
  focusNodeIdRef.current = focusNodeId;
  focusDepthRef.current = focusDepth;
  onFocusNodeRef.current = onFocusNode;

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
    const fNodeId = focusNodeIdRef.current;
    const fDepth = focusDepthRef.current;

    // Focus mode neighborhood
    const focusNeighbors = fNodeId
      ? getNeighborhood(fNodeId, links, fDepth)
      : null;

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
      const isFocusDimmed = focusNeighbors && (!focusNeighbors.has(s.id) || !focusNeighbors.has(tgt.id));

      const dx = tgt.x - s.x;
      const dy = tgt.y - s.y;
      const cx = (s.x + tgt.x) / 2 + dy * 0.15;
      const cy = (s.y + tgt.y) / 2 - dx * 0.15;

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(cx, cy, tgt.x, tgt.y);

      const isInFocusNeighborhood = focusNeighbors && focusNeighbors.has(s.id) && focusNeighbors.has(tgt.id);

      if (isFocusDimmed) {
        ctx.strokeStyle = dark ? "rgba(120,113,108,0.03)" : "rgba(168,162,158,0.04)";
        ctx.lineWidth = 0.3;
      } else if (isSearchDimmed) {
        ctx.strokeStyle = dark ? "rgba(120,113,108,0.06)" : "rgba(168,162,158,0.08)";
        ctx.lineWidth = 0.5;
      } else if (isHighlighted) {
        ctx.strokeStyle = dark ? "rgba(168,162,158,0.5)" : "rgba(120,113,108,0.5)";
        ctx.lineWidth = 1.5;
      } else if (isInFocusNeighborhood) {
        ctx.strokeStyle = dark ? "rgba(168,162,158,0.35)" : "rgba(120,113,108,0.35)";
        ctx.lineWidth = 1.2;
      } else {
        ctx.strokeStyle = dark ? "rgba(168,162,158,0.12)" : "rgba(120,113,108,0.15)";
        ctx.lineWidth = 0.8;
      }
      ctx.stroke();
    }

    // Nodes — each drawn as a cloud (cluster of soft overlapping circles)
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      const r = getNodeRadius(n);
      const isHovered = hNode?.id === n.id;
      const isConnected = hNode && connectedIds.has(n.id);
      const isMatch = query && matchIds.has(n.id);
      const isFocusRoot = fNodeId === n.id;
      const isInFocus = focusNeighbors ? focusNeighbors.has(n.id) : false;
      const isFocusDimmed = focusNeighbors && !isInFocus;
      const isHoverDimmed = !focusNeighbors && hNode && !connectedIds.has(n.id);
      const isDimmed = isFocusDimmed || (query && !matchIds.has(n.id)) || isHoverDimmed;

      // Cloud lobe layout — offsets relative to node center, scaled by radius
      // Each lobe: [dx, dy, radiusMultiplier]
      const lobes: [number, number, number][] = [
        [0, 0, 1.0],         // center
        [-0.7, -0.3, 0.8],   // left
        [0.7, -0.2, 0.75],   // right
        [0, -0.6, 0.7],      // top
        [-0.35, 0.3, 0.6],   // bottom-left
        [0.4, 0.35, 0.55],   // bottom-right
      ];

      // Pick colour + alpha based on state
      let baseR: number, baseG: number, baseB: number;
      let coreAlpha: number;
      let glowAlpha: number;

      if (isDimmed) {
        if (dark) { baseR = 87; baseG = 83; baseB = 78; }
        else { baseR = 214; baseG = 211; baseB = 209; }
        coreAlpha = isFocusDimmed ? (dark ? 0.06 : 0.1) : (dark ? 0.12 : 0.18);
        glowAlpha = isFocusDimmed ? (dark ? 0.02 : 0.03) : (dark ? 0.04 : 0.06);
      } else if (isFocusRoot) {
        // Focused node — prominent accent colour
        if (dark) { baseR = 96; baseG = 165; baseB = 250; }
        else { baseR = 37; baseG = 99; baseB = 235; }
        coreAlpha = dark ? 0.75 : 0.7;
        glowAlpha = dark ? 0.18 : 0.14;
      } else if (isMatch) {
        if (dark) { baseR = 96; baseG = 165; baseB = 250; }
        else { baseR = 37; baseG = 99; baseB = 235; }
        coreAlpha = dark ? 0.7 : 0.65;
        glowAlpha = dark ? 0.15 : 0.12;
      } else if (isHovered) {
        if (dark) { baseR = 231; baseG = 229; baseB = 228; }
        else { baseR = 28; baseG = 25; baseB = 23; }
        coreAlpha = dark ? 0.7 : 0.6;
        glowAlpha = dark ? 0.18 : 0.1;
      } else if (isConnected) {
        if (dark) { baseR = 168; baseG = 162; baseB = 158; }
        else { baseR = 120; baseG = 113; baseB = 108; }
        coreAlpha = dark ? 0.55 : 0.45;
        glowAlpha = dark ? 0.12 : 0.08;
      } else {
        if (dark) { baseR = 168; baseG = 162; baseB = 158; }
        else { baseR = 120; baseG = 113; baseB = 108; }
        coreAlpha = dark ? 0.4 : 0.35;
        glowAlpha = dark ? 0.08 : 0.06;
      }

      // Dynamic cloud scale — clouds grow as you zoom out so they stay
      // visually prominent, and shrink slightly when zoomed in to stay crisp.
      // zoomScale: 2× at full zoom-out (k=0.1), 1× at default (k=1), 0.7× at max zoom (k=8)
      const zoomScale = Math.max(0.7, Math.min(2.5, 1 / Math.sqrt(t.k)));
      const baseCloudScale = 2.2; // overall size multiplier
      const stateScale = isFocusRoot ? 1.8 : isHovered ? 1.6 : isConnected ? 1.3 : 1.0;
      const cloudScale = baseCloudScale * stateScale * zoomScale;

      // Draw each lobe as a radial gradient circle (soft blob)
      for (const [dx, dy, rm] of lobes) {
        const lx = n.x + dx * r * cloudScale;
        const ly = n.y + dy * r * cloudScale;
        const lr = r * rm * cloudScale;

        // Outer glow lobe
        const glowR = lr * 2.5;
        const gGrad = ctx.createRadialGradient(lx, ly, lr * 0.2, lx, ly, glowR);
        gGrad.addColorStop(0, `rgba(${baseR},${baseG},${baseB},${glowAlpha * rm})`);
        gGrad.addColorStop(0.6, `rgba(${baseR},${baseG},${baseB},${glowAlpha * rm * 0.3})`);
        gGrad.addColorStop(1, `rgba(${baseR},${baseG},${baseB},0)`);
        ctx.beginPath();
        ctx.arc(lx, ly, glowR, 0, Math.PI * 2);
        ctx.fillStyle = gGrad;
        ctx.fill();

        // Core lobe with soft edge
        const cGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
        cGrad.addColorStop(0, `rgba(${baseR},${baseG},${baseB},${coreAlpha * rm})`);
        cGrad.addColorStop(0.5, `rgba(${baseR},${baseG},${baseB},${coreAlpha * rm * 0.6})`);
        cGrad.addColorStop(1, `rgba(${baseR},${baseG},${baseB},0)`);
        ctx.beginPath();
        ctx.arc(lx, ly, lr, 0, Math.PI * 2);
        ctx.fillStyle = cGrad;
        ctx.fill();
      }

      // Labels — always show for focus root + neighbors; also for hovered/connected/search
      const showLabel = isFocusRoot || (focusNeighbors && isInFocus) ||
        ((isHovered || isConnected || isMatch) && !isDimmed);
      if (showLabel) {
        const labelY = n.y + r * cloudScale + 8;
        ctx.font = `${isFocusRoot || isHovered ? "600" : "400"} ${isFocusRoot || isHovered ? 12 : 10}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = dark ? "rgba(231,229,228,0.9)" : "rgba(28,25,23,0.85)";
        ctx.fillText(n.title, n.x, labelY, 140);
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
        canvas.style.cursor = "default";
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
        canvas.style.cursor = "move";
      } else {
        dragNodeRef.current = null;
        canvas.style.cursor = "move";
      }
    },
    [screenToWorld, nodeAtPosition]
  );

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const node = dragNodeRef.current;
    isDraggingRef.current = false;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const wasClick = dx * dx + dy * dy < 9;

    if (node) {
      node.fx = null;
      node.fy = null;
      simRef.current?.alphaTarget(0);

      if (wasClick) {
        // Double-click detection (300ms window)
        const now = Date.now();
        if (now - lastClickTimeRef.current < 300) {
          // Double-click on node → focus it
          onFocusNodeRef.current(node.id);
          lastClickTimeRef.current = 0;
        } else {
          lastClickTimeRef.current = now;
          // Single click → navigate to note (delayed to allow double-click)
          const nodeId = node.id;
          setTimeout(() => {
            if (lastClickTimeRef.current !== 0) {
              onSelectNoteRef.current(nodeId);
              lastClickTimeRef.current = 0;
            }
          }, 300);
        }
      }
    } else if (wasClick) {
      // Double-click on empty space → exit focus
      const now = Date.now();
      if (now - lastClickTimeRef.current < 300 && focusNodeIdRef.current) {
        onFocusNodeRef.current(null);
        lastClickTimeRef.current = 0;
      } else {
        lastClickTimeRef.current = now;
      }
    }

    dragNodeRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = hoveredRef.current ? "pointer" : "default";
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
        className="absolute inset-0 cursor-default"
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
