"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  FilePlus,
  FolderPlus,
  Search,
  LogOut,
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Trash2,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Archive,
  CalendarDays,
} from "lucide-react";
import type { Note } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { searchNotes, type SearchResult } from "@/lib/notes";
import { LogoFull, LogoIcon } from "@/components/ui/logo";

interface SidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: (parentId?: string | null) => void;
  onCreateFolder: (parentId?: string | null) => void;
  onDeleteNote: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onMoveNote: (noteId: string, newParentId: string | null) => void;
  onRenameNote: (id: string, title: string) => void;
  onDailyNote: () => void;
  showArchive: boolean;
  onToggleArchive: () => void;
  archiveCount: number;
  isMobile?: boolean;
  mobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
}

function NoteTreeItem({
  note,
  notes,
  depth,
  activeNoteId,
  selectedIds,
  onSelectNote,
  onToggleSelect,
  onCreateNote,
  onCreateFolder,
  onDeleteNote,
  onRenameNote,
  expandedFolders,
  toggleFolder,
  draggedId,
  dropTargetId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  note: Note;
  notes: Note[];
  depth: number;
  activeNoteId: string | null;
  selectedIds: Set<string>;
  onSelectNote: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onCreateNote: (parentId?: string | null) => void;
  onCreateFolder: (parentId?: string | null) => void;
  onDeleteNote: (id: string) => void;
  onRenameNote: (id: string, title: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
  draggedId: string | null;
  dropTargetId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, targetId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(note.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const isExpanded = expandedFolders.has(note.id);
  const hasChildren = notes.some((n) => n.parent_id === note.id);
  const isActive = note.id === activeNoteId;
  const isSelected = selectedIds.has(note.id);
  const isDragged = note.id === draggedId;
  const isDropTarget = note.id === dropTargetId && note.is_folder;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startRename() {
    setEditValue(note.title);
    setEditing(true);
  }

  function commitRename() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== note.title) {
      onRenameNote(note.id, trimmed);
    }
    setEditing(false);
  }

  return (
    <div>
      <div
        draggable={!editing}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart(note.id);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          if (note.is_folder) onDragOver(e, note.id);
        }}
        onDragLeave={onDragLeave}
        onDrop={(e) => {
          if (note.is_folder) onDrop(e, note.id);
        }}
        className={`group flex items-center gap-1 py-1 px-2 cursor-pointer rounded-md text-sm transition-colors
          ${isDragged ? "opacity-40" : ""}
          ${isDropTarget ? "bg-blue-100 dark:bg-blue-900/30 ring-1 ring-blue-400 dark:ring-blue-500" : ""}
          ${isSelected && !isDropTarget ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-l-2 border-blue-400 dark:border-blue-500 rounded-none" : ""}
          ${!isDropTarget && !isSelected && !isDragged ? (isActive ? "bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100" : "hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400") : ""}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={(e) => {
          if (editing) return;
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onToggleSelect(note.id);
            return;
          }
          if (note.is_folder) {
            toggleFolder(note.id);
          } else {
            onSelectNote(note.id);
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          startRename();
        }}
      >
        {note.is_folder ? (
          <>
            {isExpanded ? (
              <ChevronDown size={14} className="shrink-0" />
            ) : (
              <ChevronRight size={14} className="shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen size={14} className="shrink-0 text-stone-500 dark:text-stone-400" />
            ) : (
              <Folder size={14} className="shrink-0 text-stone-500 dark:text-stone-400" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            <FileText size={14} className="shrink-0 text-stone-400 dark:text-stone-500" />
          </>
        )}
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-1 py-0 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-stone-500"
          />
        ) : (
          <span className="truncate flex-1">{note.title}</span>
        )}
        {!editing && (
          <div className="hidden group-hover:flex items-center gap-0.5">
            {note.is_folder && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateNote(note.id);
                  }}
                  className="p-0.5 rounded hover:bg-stone-300 dark:hover:bg-stone-600"
                  title="New note in folder"
                >
                  <FilePlus size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateFolder(note.id);
                  }}
                  className="p-0.5 rounded hover:bg-stone-300 dark:hover:bg-stone-600"
                  title="New subfolder"
                >
                  <FolderPlus size={12} />
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                startRename();
              }}
              className="p-0.5 rounded hover:bg-stone-300 dark:hover:bg-stone-600"
              title="Rename"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNote(note.id);
              }}
              className="p-0.5 rounded hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
      {note.is_folder && isExpanded && hasChildren && (
        <NoteTree
          notes={notes}
          parentId={note.id}
          depth={depth + 1}
          activeNoteId={activeNoteId}
          selectedIds={selectedIds}
          onSelectNote={onSelectNote}
          onToggleSelect={onToggleSelect}
          onCreateNote={onCreateNote}
          onCreateFolder={onCreateFolder}
          onDeleteNote={onDeleteNote}
          onRenameNote={onRenameNote}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
          draggedId={draggedId}
          dropTargetId={dropTargetId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
      )}
    </div>
  );
}

function NoteTree({
  notes,
  parentId = null,
  depth = 0,
  activeNoteId,
  selectedIds,
  onSelectNote,
  onToggleSelect,
  onCreateNote,
  onCreateFolder,
  onDeleteNote,
  onRenameNote,
  expandedFolders,
  toggleFolder,
  draggedId,
  dropTargetId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  notes: Note[];
  parentId?: string | null;
  depth?: number;
  activeNoteId: string | null;
  selectedIds: Set<string>;
  onSelectNote: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onCreateNote: (parentId?: string | null) => void;
  onCreateFolder: (parentId?: string | null) => void;
  onDeleteNote: (id: string) => void;
  onRenameNote: (id: string, title: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
  draggedId: string | null;
  dropTargetId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, targetId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
}) {
  const children = notes.filter((n) => n.parent_id === parentId);
  const sorted = [...children].sort((a, b) => {
    if (a.is_folder && !b.is_folder) return -1;
    if (!a.is_folder && b.is_folder) return 1;
    return a.title.localeCompare(b.title);
  });

  return (
    <div>
      {sorted.map((note) => (
        <NoteTreeItem
          key={note.id}
          note={note}
          notes={notes}
          depth={depth}
          activeNoteId={activeNoteId}
          selectedIds={selectedIds}
          onSelectNote={onSelectNote}
          onToggleSelect={onToggleSelect}
          onCreateNote={onCreateNote}
          onCreateFolder={onCreateFolder}
          onDeleteNote={onDeleteNote}
          onRenameNote={onRenameNote}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
          draggedId={draggedId}
          dropTargetId={dropTargetId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
      ))}
    </div>
  );
}

export function Sidebar({
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onCreateFolder,
  onDeleteNote,
  onDeleteMultiple,
  onMoveNote,
  onRenameNote,
  onDailyNote,
  showArchive,
  onToggleArchive,
  archiveCount,
  isMobile = false,
  mobileMenuOpen = false,
  onCloseMobileMenu,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [ftsResults, setFtsResults] = useState<SearchResult[] | null>(null);
  const [ftsLoading, setFtsLoading] = useState(false);
  const ftsTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const router = useRouter();
  const supabase = createClient();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);

  // Debounced full-text search
  useEffect(() => {
    if (!search.trim()) {
      setFtsResults(null);
      setFtsLoading(false);
      return;
    }
    setFtsLoading(true);
    if (ftsTimer.current) clearTimeout(ftsTimer.current);
    ftsTimer.current = setTimeout(async () => {
      const results = await searchNotes(search);
      setFtsResults(results);
      setFtsLoading(false);
    }, 300);
    return () => {
      if (ftsTimer.current) clearTimeout(ftsTimer.current);
    };
  }, [search]);

  // Multi-select
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Escape clears selection
  useEffect(() => {
    if (selectedIds.size === 0) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") clearSelection();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [selectedIds.size]);

  function toggleFolder(id: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Check if moving noteId into targetId would create a cycle
  function wouldCreateCycle(noteId: string, targetId: string | null): boolean {
    if (targetId === null) return false;
    if (noteId === targetId) return true;
    let current = targetId;
    while (current) {
      const parent = notes.find((n) => n.id === current);
      if (!parent?.parent_id) break;
      if (parent.parent_id === noteId) return true;
      current = parent.parent_id;
    }
    return false;
  }

  function handleDragStart(id: string) {
    setDraggedId(id);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDropTargetId(null);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    if (wouldCreateCycle(draggedId, targetId)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetId(targetId);
  }

  function handleDragLeave() {
    setDropTargetId(null);
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    if (wouldCreateCycle(draggedId, targetId)) return;

    const draggedNote = notes.find((n) => n.id === draggedId);
    // Don't move if already in this folder
    if (draggedNote?.parent_id === targetId) {
      setDraggedId(null);
      setDropTargetId(null);
      return;
    }

    onMoveNote(draggedId, targetId);
    // Auto-expand the target folder
    setExpandedFolders((prev) => new Set([...prev, targetId]));
    setDraggedId(null);
    setDropTargetId(null);
  }

  // Drop on root area = move to root (remove from folder)
  function handleRootDragOver(e: React.DragEvent) {
    if (!draggedId) return;
    const draggedNote = notes.find((n) => n.id === draggedId);
    if (draggedNote?.parent_id === null) return; // already at root
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetId("__root__");
  }

  function handleRootDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!draggedId) return;
    const draggedNote = notes.find((n) => n.id === draggedId);
    if (draggedNote?.parent_id === null) {
      setDraggedId(null);
      setDropTargetId(null);
      return;
    }
    onMoveNote(draggedId, null);
    setDraggedId(null);
    setDropTargetId(null);
  }

  const filteredNotes = search
    ? notes.filter((n) =>
        n.title.toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  const isRootDropTarget = dropTargetId === "__root__";

  // On mobile, hide sidebar when menu is closed
  if (isMobile && !mobileMenuOpen) return null;

  // On mobile, don't show collapsed mode
  if (!isMobile && collapsed) {
    return (
      <div className="w-12 h-full border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 flex flex-col items-center py-3 gap-2">
        <button
          onClick={() => setCollapsed(false)}
          className="rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          title="Expand sidebar"
        >
          <LogoIcon size={24} />
        </button>
        <button
          onClick={() => onCreateNote()}
          className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400"
          title="New note"
        >
          <FilePlus size={16} />
        </button>
        <button
          onClick={onDailyNote}
          className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400"
          title="Daily note"
        >
          <CalendarDays size={16} />
        </button>
        <div className="flex-1" />
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 transition-colors"
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button
          onClick={handleLogout}
          className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    );
  }

  const sidebarContent = (
    <div className={`${isMobile ? "w-72" : "w-64"} h-full border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 flex flex-col`}>
      {/* Header */}
      <div className="p-3 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center justify-between mb-2">
          <LogoFull size={22} />
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-7 pr-3 py-1.5 text-sm rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-500 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-stone-200 dark:border-stone-800">
        <button
          onClick={() => onCreateNote()}
          className="flex items-center gap-1.5 px-2 py-1 text-sm rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400"
          title="New note"
        >
          <FilePlus size={14} />
          <span>Note</span>
        </button>
        <button
          onClick={() => onCreateFolder()}
          className="flex items-center gap-1.5 px-2 py-1 text-sm rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400"
          title="New folder"
        >
          <FolderPlus size={14} />
          <span>Folder</span>
        </button>
        <button
          onClick={onDailyNote}
          className="flex items-center gap-1.5 px-2 py-1 text-sm rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 ml-auto"
          title="Open today's daily note"
        >
          <CalendarDays size={14} />
        </button>
      </div>

      {/* Note tree */}
      <div
        className={`flex-1 overflow-y-auto py-1 transition-colors ${
          isRootDropTarget ? "bg-blue-50 dark:bg-blue-900/10" : ""
        }`}
        onDragOver={handleRootDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleRootDrop}
      >
        {search ? (
          ftsLoading && !ftsResults ? (
            <p className="text-sm text-stone-400 dark:text-stone-500 px-3 py-4 text-center">
              Searching...
            </p>
          ) : ftsResults && ftsResults.length > 0 ? (
            <div>
              {ftsResults.map((result) => (
                <div
                  key={result.id}
                  className={`py-1.5 px-3 cursor-pointer rounded-md text-sm hover:bg-stone-200 dark:hover:bg-stone-700 ${
                    result.id === activeNoteId
                      ? "bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100"
                      : "text-stone-600 dark:text-stone-400"
                  }`}
                  onClick={() => onSelectNote(result.id)}
                >
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="shrink-0 text-stone-400 dark:text-stone-500" />
                    <span className="truncate font-medium">{result.title}</span>
                  </div>
                  <p
                    className="text-xs text-stone-400 dark:text-stone-500 truncate mt-0.5 ml-[22px] [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:rounded-sm [&_mark]:px-0.5"
                    dangerouslySetInnerHTML={{ __html: result.headline }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400 dark:text-stone-500 px-3 py-4 text-center">
              No results found
            </p>
          )
        ) : filteredNotes.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-500 px-3 py-4 text-center">
            No notes yet. Create one!
          </p>
        ) : (
          <NoteTree
            notes={filteredNotes}
            activeNoteId={activeNoteId}
            selectedIds={selectedIds}
            onSelectNote={onSelectNote}
            onToggleSelect={toggleSelect}
            onCreateNote={onCreateNote}
            onCreateFolder={onCreateFolder}
            onDeleteNote={onDeleteNote}
            onRenameNote={onRenameNote}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            draggedId={draggedId}
            dropTargetId={dropTargetId}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        )}
        {/* Drop hint when dragging */}
        {draggedId && isRootDropTarget && (
          <div className="mx-2 my-1 py-1.5 text-center text-xs text-blue-500 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-600 rounded-md">
            Drop here to move to root
          </div>
        )}
      </div>

      {/* Multi-select action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-stone-200 dark:border-stone-800 bg-blue-50 dark:bg-blue-900/20">
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={() => {
              onDeleteMultiple(Array.from(selectedIds));
              clearSelection();
            }}
            className="px-2 py-1 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            Archive ({selectedIds.size})
          </button>
          <button
            onClick={clearSelection}
            className="px-2 py-1 text-xs rounded text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-stone-200 dark:border-stone-800">
        <button
          onClick={onToggleArchive}
          className={`flex items-center gap-2 w-full px-4 py-2 text-sm transition-colors ${
            showArchive
              ? "bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
          }`}
        >
          <Archive size={14} />
          <span>Archive</span>
          {archiveCount > 0 && (
            <span className="ml-auto text-xs bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
              {archiveCount}
            </span>
          )}
        </button>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
          <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 border-t border-stone-200 dark:border-stone-800 text-left text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm">
            <LogOut size={14} />
            <span>Sign out</span>
          </div>
          {userEmail && (
            <p className="text-xs text-stone-400 dark:text-stone-500 truncate mt-0.5" title={userEmail}>
              {userEmail}
            </p>
          )}
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-40 flex">
        <div className="shrink-0">{sidebarContent}</div>
        <div
          className="flex-1 bg-black/40"
          onClick={onCloseMobileMenu}
        />
      </div>
    );
  }

  return sidebarContent;
}
