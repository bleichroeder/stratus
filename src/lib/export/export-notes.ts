/**
 * Export orchestrator — fetches all notes, decrypts vault notes,
 * converts to Markdown, bundles attachments, and produces a .zip Blob.
 *
 * Runs entirely client-side so vault decryption keys never leave the browser.
 */

import JSZip from "jszip";
import {
  getNotes,
  getArchivedNotes,
  getSharedWithMeNotes,
  getTemplates,
} from "@/lib/notes";
import {
  decryptContent,
  isEncryptedPayload,
} from "@/lib/crypto";
import { tiptapToMarkdown } from "./tiptap-to-markdown";
import type { Note, Json } from "@/lib/types";

// --- Public types ---

export interface ExportOptions {
  includeArchived: boolean;
  includeShared: boolean;
  includeTemplates: boolean;
  includeVault: boolean;
  includeAttachments: boolean;
}

export interface ExportProgress {
  phase: "fetching" | "decrypting" | "converting" | "attachments" | "zipping";
  current: number;
  total: number;
}

export type ProgressCallback = (progress: ExportProgress) => void;

// --- Helpers ---

const UNSAFE_FILENAME_RE = /[/\\:*?"<>|]/g;

function sanitizeFilename(name: string): string {
  return name.replace(UNSAFE_FILENAME_RE, "_").trim() || "Untitled";
}

/**
 * Build the full file path for a note by walking up the parent_id chain.
 * Returns segments like ["Folder", "SubFolder", "Note Title"].
 */
function buildPathSegments(
  note: Note,
  noteMap: Map<string, Note>,
): string[] {
  const segments: string[] = [];
  const visited = new Set<string>();

  // Walk up from the note (not including the note itself yet)
  let currentId = note.parent_id;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const parent = noteMap.get(currentId);
    if (!parent) break;
    segments.unshift(sanitizeFilename(parent.title));
    currentId = parent.parent_id;
  }

  return segments;
}

/**
 * Deduplicate paths: if "Folder/Note.md" already exists, produce "Folder/Note (2).md".
 */
function deduplicatePath(path: string, usedPaths: Set<string>): string {
  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }
  const dotIdx = path.lastIndexOf(".");
  const base = dotIdx > -1 ? path.slice(0, dotIdx) : path;
  const ext = dotIdx > -1 ? path.slice(dotIdx) : "";
  let counter = 2;
  while (usedPaths.has(`${base} (${counter})${ext}`)) counter++;
  const deduped = `${base} (${counter})${ext}`;
  usedPaths.add(deduped);
  return deduped;
}

/**
 * Walk TipTap JSON content tree and collect all image src URLs.
 */
function collectImageUrls(content: Json): string[] {
  const urls: string[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "image" && typeof (n.attrs as Record<string, unknown>)?.src === "string") {
      urls.push((n.attrs as Record<string, unknown>).src as string);
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }
  walk(content);
  return urls;
}

/**
 * Extract a filename from a URL, falling back to a hash.
 */
function filenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").pop();
    if (last && last.includes(".")) return last;
  } catch { /* ignore */ }
  // Fallback: use a short hash of the URL
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  }
  return `image-${Math.abs(hash).toString(16)}.png`;
}

// --- Main export function ---

export async function exportNotesLibrary(
  options: ExportOptions,
  vaultKey: CryptoKey | null,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const zip = new JSZip();
  const usedPaths = new Set<string>();

  // ── Phase 1: Fetch ──
  onProgress?.({ phase: "fetching", current: 0, total: 1 });

  const [activeNotes, archivedNotes, sharedNotes, templates] =
    await Promise.all([
      getNotes(),
      options.includeArchived ? getArchivedNotes() : Promise.resolve([]),
      options.includeShared ? getSharedWithMeNotes() : Promise.resolve([]),
      options.includeTemplates ? getTemplates() : Promise.resolve([]),
    ]);

  onProgress?.({ phase: "fetching", current: 1, total: 1 });

  // Build lookup map from ALL active notes (needed for folder hierarchy)
  const noteMap = new Map<string, Note>();
  for (const n of activeNotes) noteMap.set(n.id, n);
  for (const n of archivedNotes) noteMap.set(n.id, n);

  // Build noteId → title map for wiki link resolution
  const noteIdToTitle = new Map<string, string>();
  for (const n of [...activeNotes, ...archivedNotes, ...sharedNotes, ...templates]) {
    noteIdToTitle.set(n.id, n.title);
  }

  // ── Phase 2: Separate notes into categories ──
  // Personal (non-encrypted, non-folder) notes
  const personalNotes = activeNotes.filter(
    (n) => !n.is_folder && !n.encrypted,
  );
  // Vault notes
  const vaultNotes = activeNotes.filter((n) => n.encrypted && !n.is_folder);

  // ── Phase 3: Decrypt vault notes ──
  const decryptedContent = new Map<string, Json>();

  if (options.includeVault && vaultKey && vaultNotes.length > 0) {
    for (let i = 0; i < vaultNotes.length; i++) {
      onProgress?.({
        phase: "decrypting",
        current: i,
        total: vaultNotes.length,
      });
      const note = vaultNotes[i];
      if (note.content && isEncryptedPayload(note.content)) {
        try {
          const plaintext = await decryptContent(note.content, vaultKey);
          decryptedContent.set(note.id, JSON.parse(plaintext));
        } catch {
          // If decryption fails, skip this note
          console.warn(`Failed to decrypt note "${note.title}", skipping`);
        }
      }
    }
    onProgress?.({
      phase: "decrypting",
      current: vaultNotes.length,
      total: vaultNotes.length,
    });
  }

  // ── Phase 4: Collect all image URLs for attachment download ──
  const allExportNotes: Array<{
    note: Note;
    prefix: string;
    content: Json | null;
  }> = [];

  // Personal notes — use folder hierarchy
  for (const note of personalNotes) {
    const segments = buildPathSegments(note, noteMap);
    const prefix = segments.length > 0 ? segments.join("/") + "/" : "";
    allExportNotes.push({ note, prefix, content: note.content });
  }

  // Vault notes
  if (options.includeVault && vaultKey) {
    for (const note of vaultNotes) {
      const content = decryptedContent.get(note.id) ?? null;
      if (!content) continue; // Skip if decryption failed
      const segments = buildPathSegments(note, noteMap);
      const prefix = segments.length > 0 ? segments.join("/") + "/" : "Vault/";
      allExportNotes.push({ note, prefix, content });
    }
  }

  // Archived notes
  for (const note of archivedNotes.filter((n) => !n.is_folder)) {
    allExportNotes.push({
      note,
      prefix: "Archive/",
      content: note.content,
    });
  }

  // Shared notes
  for (const note of sharedNotes.filter((n) => !n.is_folder)) {
    allExportNotes.push({
      note,
      prefix: "Shared With Me/",
      content: note.content,
    });
  }

  // Templates
  for (const note of templates) {
    allExportNotes.push({
      note,
      prefix: "Templates/",
      content: note.content,
    });
  }

  // Collect image URLs across all notes
  const imageUrlSet = new Set<string>();
  if (options.includeAttachments) {
    for (const { content } of allExportNotes) {
      if (content) {
        for (const url of collectImageUrls(content)) {
          imageUrlSet.add(url);
        }
      }
    }
  }

  // ── Phase 5: Download attachments ──
  const attachmentMap = new Map<string, string>(); // original URL → local path

  if (options.includeAttachments && imageUrlSet.size > 0) {
    const urls = [...imageUrlSet];
    const attachmentNames = new Set<string>();

    for (let i = 0; i < urls.length; i++) {
      onProgress?.({
        phase: "attachments",
        current: i,
        total: urls.length,
      });

      const url = urls[i];
      let name = filenameFromUrl(url);
      // Deduplicate attachment filenames
      if (attachmentNames.has(name)) {
        const dotIdx = name.lastIndexOf(".");
        const base = dotIdx > -1 ? name.slice(0, dotIdx) : name;
        const ext = dotIdx > -1 ? name.slice(dotIdx) : "";
        let c = 2;
        while (attachmentNames.has(`${base} (${c})${ext}`)) c++;
        name = `${base} (${c})${ext}`;
      }
      attachmentNames.add(name);

      const localPath = `attachments/${name}`;
      attachmentMap.set(url, localPath);

      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const blob = await resp.blob();
          zip.file(localPath, blob);
        }
      } catch {
        // CORS or network failure — skip silently
        console.warn(`Failed to download attachment: ${url}`);
      }
    }

    onProgress?.({
      phase: "attachments",
      current: urls.length,
      total: urls.length,
    });
  }

  // ── Phase 6: Convert notes to Markdown and add to zip ──
  const rewriteImageUrl = (url: string) => attachmentMap.get(url) ?? url;

  for (let i = 0; i < allExportNotes.length; i++) {
    onProgress?.({
      phase: "converting",
      current: i,
      total: allExportNotes.length,
    });

    const { note, prefix, content } = allExportNotes[i];
    const title = sanitizeFilename(note.title);

    let markdown: string;
    if (content) {
      markdown = tiptapToMarkdown(content, {
        rewriteImageUrl: options.includeAttachments ? rewriteImageUrl : undefined,
        noteIdToTitle,
      });
    } else {
      markdown = `# ${note.title}\n`;
    }

    const filePath = deduplicatePath(`${prefix}${title}.md`, usedPaths);
    zip.file(filePath, markdown);
  }

  onProgress?.({
    phase: "converting",
    current: allExportNotes.length,
    total: allExportNotes.length,
  });

  // ── Phase 7: Generate zip ──
  onProgress?.({ phase: "zipping", current: 0, total: 1 });
  const blob = await zip.generateAsync({ type: "blob" });
  onProgress?.({ phase: "zipping", current: 1, total: 1 });

  return blob;
}

/**
 * Trigger a file download in the browser.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
