/**
 * Obsidian vault importer.
 *
 * Reads a set of files (from a directory picker or zip), reconstructs the
 * folder hierarchy, converts Markdown → TipTap JSON, and batch-creates
 * everything in stratus.
 */

import { markdownToTiptap } from "./markdown-to-tiptap";
import { createNote } from "@/lib/notes";
import type { Json } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface ImportFile {
  /** Relative path from vault root, e.g. "Projects/Todo.md" */
  path: string;
  content: string;
}

export interface ImportPreview {
  folders: string[];
  notes: { path: string; title: string }[];
  skipped: string[];
}

export interface ImportProgress {
  total: number;
  completed: number;
  current: string;
  phase: "folders" | "notes";
}

export type ProgressCallback = (progress: ImportProgress) => void;

export interface ImportResult {
  foldersCreated: number;
  notesCreated: number;
  errors: { path: string; error: string }[];
}

// ── File reading ─────────────────────────────────────────────────────────

/**
 * Read files from a directory input (webkitdirectory).
 * Strips the top-level vault folder name from paths.
 */
export async function readFilesFromInput(files: FileList): Promise<ImportFile[]> {
  const result: ImportFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // webkitRelativePath is like "VaultName/folder/note.md"
    const relativePath = file.webkitRelativePath || file.name;

    // Only import .md files
    if (!file.name.endsWith(".md")) continue;

    // Skip hidden files/folders
    if (relativePath.split("/").some((p) => p.startsWith("."))) continue;

    const content = await file.text();

    // Strip the top-level directory (the vault folder itself)
    const parts = relativePath.split("/");
    const stripped = parts.length > 1 ? parts.slice(1).join("/") : parts[0];

    result.push({ path: stripped, content });
  }

  return result;
}

// ── Preview ──────────────────────────────────────────────────────────────

export function previewImport(files: ImportFile[]): ImportPreview {
  const folders = new Set<string>();
  const notes: { path: string; title: string }[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".md")) {
      skipped.push(file.path);
      continue;
    }

    // Collect folder paths
    const parts = file.path.split("/");
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join("/"));
    }

    const title = extractTitle(file);
    notes.push({ path: file.path, title });
  }

  // Sort folders by depth so parents come first
  const sortedFolders = [...folders].sort((a, b) => {
    const da = a.split("/").length;
    const db = b.split("/").length;
    return da - db || a.localeCompare(b);
  });

  return { folders: sortedFolders, notes, skipped };
}

// ── Import execution ─────────────────────────────────────────────────────

export async function executeImport(
  files: ImportFile[],
  onProgress?: ProgressCallback
): Promise<ImportResult> {
  const preview = previewImport(files);
  const totalOps = preview.folders.length + preview.notes.length;
  let completed = 0;
  const errors: { path: string; error: string }[] = [];

  // Map of folder path → created stratus folder ID
  const folderMap = new Map<string, string>();

  // Phase 1: Create folders (parents first, since they're sorted by depth)
  for (const folderPath of preview.folders) {
    onProgress?.({
      total: totalOps,
      completed,
      current: folderPath,
      phase: "folders",
    });

    try {
      const parts = folderPath.split("/");
      const name = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join("/");
      const parentId = parentPath ? folderMap.get(parentPath) ?? null : null;

      const folder = await createNote({
        title: name,
        is_folder: true,
        parent_id: parentId,
      });
      folderMap.set(folderPath, folder.id);
    } catch (err) {
      errors.push({ path: folderPath, error: String(err) });
    }
    completed++;
  }

  // Build a title→id map for resolving [[wikilinks]]
  // We'll do two passes: first create all notes, then we could resolve links.
  // For now, resolve against the incoming file titles.
  const titleToFile = new Map<string, string>();
  for (const note of preview.notes) {
    titleToFile.set(note.title.toLowerCase(), note.path);
  }

  // Phase 2: Create notes
  for (const file of files) {
    if (!file.path.endsWith(".md")) continue;

    const title = extractTitle(file);
    onProgress?.({
      total: totalOps,
      completed,
      current: title,
      phase: "notes",
    });

    try {
      const parts = file.path.split("/");
      const parentPath = parts.slice(0, -1).join("/");
      const parentId = parentPath ? folderMap.get(parentPath) ?? null : null;

      const tiptapDoc = markdownToTiptap(file.content, (_target) => {
        // wikilink resolution: return null for now since we don't have IDs yet.
        // The links will still display correctly, just without navigation.
        return null;
      });

      await createNote({
        title,
        content: tiptapDoc as unknown as Json,
        parent_id: parentId,
      });
    } catch (err) {
      errors.push({ path: file.path, error: String(err) });
    }
    completed++;
  }

  return {
    foldersCreated: preview.folders.length - errors.filter((e) => preview.folders.includes(e.path)).length,
    notesCreated: preview.notes.length - errors.filter((e) => !preview.folders.includes(e.path)).length,
    errors,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function extractTitle(file: ImportFile): string {
  // Try to get title from first H1 in the content
  const h1Match = file.content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();

  // Fall back to filename without extension
  const filename = file.path.split("/").pop() || "Untitled";
  return filename.replace(/\.md$/, "");
}
