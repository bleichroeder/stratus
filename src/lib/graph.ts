import type { Note, Json } from "@/lib/types";

export interface GraphNode {
  id: string;
  title: string;
  isFolder: boolean;
  parentId: string | null;
  linkCount: number;
  updatedAt: string;
  /** Set by d3-force */
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Recursively walk ProseMirror JSON content and extract wiki-link noteIds.
 */
export function extractWikiLinks(content: Json | null): string[] {
  if (!content || typeof content !== "object") return [];

  const ids: string[] = [];

  function walk(node: Json) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }

    const obj = node as Record<string, Json | undefined>;

    // Check marks for wiki-link type
    if (Array.isArray(obj.marks)) {
      for (const mark of obj.marks) {
        if (
          mark &&
          typeof mark === "object" &&
          !Array.isArray(mark) &&
          (mark as Record<string, Json | undefined>).type === "wikiLink"
        ) {
          const attrs = (mark as Record<string, Json | undefined>).attrs;
          if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
            const noteId = (attrs as Record<string, Json | undefined>).noteId;
            if (typeof noteId === "string") ids.push(noteId);
          }
        }
      }
    }

    // Recurse into content array
    if (Array.isArray(obj.content)) {
      for (const child of obj.content) walk(child);
    }
  }

  walk(content);
  return [...new Set(ids)];
}

/**
 * Build graph data from an array of notes.
 * Nodes = non-folder notes, Edges = wiki-link references between them.
 */
export function buildGraphData(notes: Note[]): GraphData {
  const noteMap = new Map<string, Note>();
  for (const note of notes) {
    noteMap.set(note.id, note);
  }

  // Count inbound + outbound links per note
  const linkCounts = new Map<string, number>();
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const note of notes) {
    if (note.is_folder) continue;
    const targets = extractWikiLinks(note.content);
    for (const targetId of targets) {
      if (!noteMap.has(targetId)) continue;
      // Deduplicate edges (A->B same as B->A for display)
      const key = [note.id, targetId].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: note.id, target: targetId });
      linkCounts.set(note.id, (linkCounts.get(note.id) ?? 0) + 1);
      linkCounts.set(targetId, (linkCounts.get(targetId) ?? 0) + 1);
    }
  }

  const nodes: GraphNode[] = notes
    .filter((n) => !n.is_folder)
    .map((n) => ({
      id: n.id,
      title: n.title,
      isFolder: n.is_folder,
      parentId: n.parent_id,
      linkCount: linkCounts.get(n.id) ?? 0,
      updatedAt: n.updated_at,
    }));

  return { nodes, edges };
}
