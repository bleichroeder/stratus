"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { NoteEditor } from "@/components/editor/editor";
import { TabBar, type Tab } from "@/components/editor/tabs";
import { ArchivePanel } from "@/components/sidebar/archive-panel";
import { PromptModal, ConfirmModal } from "@/components/ui/modal";
import {
  getNotes,
  getNote,
  getArchivedNotes,
  createNote,
  updateNote,
  archiveNote,
  archiveNoteWithChildren,
  restoreNote,
  permanentlyDeleteNote,
  uploadImage,
  shareNote,
  unshareNote,
} from "@/lib/notes";
import type { Note, Json } from "@/lib/types";
import {
  FileText,
  Command,
  Slash,
  Link2,
  MousePointer2,
  GripVertical,
  CalendarDays,
  Menu,
} from "lucide-react";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { Welcome } from "@/components/onboarding/welcome";
import { LogoFull } from "@/components/ui/logo";

function todayString(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AppPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Detect mobile
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    function onChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
      if (!e.matches) setMobileMenuOpen(false);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Modal state
  const [folderModal, setFolderModal] = useState<{ open: boolean; parentId: string | null }>({
    open: false,
    parentId: null,
  });
  const [archiveModal, setArchiveModal] = useState<{ open: boolean; noteId: string | null; isFolder: boolean }>({
    open: false,
    noteId: null,
    isFolder: false,
  });

  const loadNotes = useCallback(async () => {
    try {
      const data = await getNotes();
      setNotes(data);
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadArchived = useCallback(async () => {
    try {
      const data = await getArchivedNotes();
      setArchivedNotes(data);
    } catch (err) {
      console.error("Failed to load archived notes:", err);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (showArchive) loadArchived();
  }, [showArchive, loadArchived]);

  // Load note content when active tab changes
  useEffect(() => {
    if (!activeTabId) {
      setActiveNote(null);
      return;
    }
    getNote(activeTabId).then((note) => {
      setActiveNote(note);
    });
  }, [activeTabId]);

  // Sync tab titles when notes change
  useEffect(() => {
    setTabs((prev) =>
      prev.map((tab) => {
        const note = notes.find((n) => n.id === tab.id);
        return note ? { ...tab, title: note.title } : tab;
      })
    );
  }, [notes]);

  function openTab(id: string) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;

    setTabs((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      return [...prev, { id: note.id, title: note.title }];
    });
    setActiveTabId(id);
    if (isMobile) setMobileMenuOpen(false);
  }

  function closeTab(id: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        const idx = prev.findIndex((t) => t.id === id);
        const newActive = next[Math.min(idx, next.length - 1)] ?? null;
        setActiveTabId(newActive?.id ?? null);
      }
      return next;
    });
  }

  function closeOtherTabs(id: string) {
    setTabs((prev) => prev.filter((t) => t.id === id));
    setActiveTabId(id);
  }

  function closeAllTabs() {
    setTabs([]);
    setActiveTabId(null);
    setActiveNote(null);
  }

  const handleUpdateContent = useCallback(
    async (content: Json) => {
      if (!activeTabId) return;
      try {
        const updated = await updateNote(activeTabId, { content });
        setActiveNote(updated);
        setNotes((prev) =>
          prev.map((n) => (n.id === updated.id ? updated : n))
        );
      } catch (err) {
        console.error("Failed to save note:", err);
      }
    },
    [activeTabId]
  );

  const handleCreateNote = useCallback(
    async (parentId?: string | null) => {
      try {
        const note = await createNote({
          parent_id: parentId ?? null,
          is_folder: false,
        });
        setNotes((prev) => [note, ...prev]);
        setTabs((prev) => [...prev, { id: note.id, title: note.title }]);
        setActiveTabId(note.id);
      } catch (err) {
        console.error("Failed to create note:", err);
      }
    },
    []
  );

  const handleCreateFolder = useCallback(
    (parentId?: string | null) => {
      setFolderModal({ open: true, parentId: parentId ?? null });
    },
    []
  );

  const handleFolderSubmit = useCallback(
    async (name: string) => {
      try {
        const folder = await createNote({
          title: name,
          parent_id: folderModal.parentId,
          is_folder: true,
        });
        setNotes((prev) => [folder, ...prev]);
      } catch (err) {
        console.error("Failed to create folder:", err);
      }
    },
    [folderModal.parentId]
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      const note = notes.find((n) => n.id === id);
      setArchiveModal({ open: true, noteId: id, isFolder: note?.is_folder ?? false });
    },
    [notes]
  );

  const handleArchiveConfirm = useCallback(async () => {
    if (!archiveModal.noteId) return;
    const id = archiveModal.noteId;
    try {
      if (archiveModal.isFolder) {
        const archivedIds = await archiveNoteWithChildren(id, notes);
        setNotes((prev) => prev.filter((n) => !archivedIds.includes(n.id)));
        // Close any tabs for archived notes
        setTabs((prev) => prev.filter((t) => !archivedIds.includes(t.id)));
        if (archivedIds.includes(activeTabId ?? "")) {
          setActiveTabId(null);
          setActiveNote(null);
        }
      } else {
        await archiveNote(id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
        closeTab(id);
      }
    } catch (err) {
      console.error("Failed to archive note:", err);
    }
  }, [archiveModal.noteId, archiveModal.isFolder, activeTabId, notes]);

  const handleDeleteMultiple = useCallback(async (ids: string[]) => {
    try {
      for (const id of ids) {
        const note = notes.find((n) => n.id === id);
        if (note?.is_folder) {
          await archiveNoteWithChildren(id, notes);
        } else {
          await archiveNote(id);
        }
      }
      // Collect all IDs that were archived (including children of folders)
      const allArchivedIds = new Set<string>();
      for (const id of ids) {
        allArchivedIds.add(id);
        // Also remove children of folders
        notes.filter((n) => n.parent_id === id).forEach((n) => allArchivedIds.add(n.id));
      }
      setNotes((prev) => prev.filter((n) => !allArchivedIds.has(n.id)));
      setTabs((prev) => prev.filter((t) => !allArchivedIds.has(t.id)));
      if (activeTabId && allArchivedIds.has(activeTabId)) {
        setActiveTabId(null);
        setActiveNote(null);
      }
    } catch (err) {
      console.error("Failed to archive notes:", err);
    }
  }, [notes, activeTabId]);

  const handleRestore = useCallback(async (id: string) => {
    try {
      const restored = await restoreNote(id);
      setArchivedNotes((prev) => prev.filter((n) => n.id !== id));
      setNotes((prev) => [restored, ...prev]);
    } catch (err) {
      console.error("Failed to restore note:", err);
    }
  }, []);

  const handlePermanentDelete = useCallback(async (id: string) => {
    try {
      await permanentlyDeleteNote(id);
      setArchivedNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Failed to permanently delete note:", err);
    }
  }, []);

  const handlePermanentDeleteAll = useCallback(async () => {
    try {
      for (const note of archivedNotes) {
        await permanentlyDeleteNote(note.id);
      }
      setArchivedNotes([]);
    } catch (err) {
      console.error("Failed to delete all archived notes:", err);
    }
  }, [archivedNotes]);

  const handleMoveNote = useCallback(
    async (noteId: string, newParentId: string | null) => {
      try {
        const updated = await updateNote(noteId, { parent_id: newParentId });
        setNotes((prev) =>
          prev.map((n) => (n.id === updated.id ? updated : n))
        );
      } catch (err) {
        console.error("Failed to move note:", err);
      }
    },
    []
  );

  const handleRenameNote = useCallback(
    async (id: string, title: string) => {
      try {
        const updated = await updateNote(id, { title });
        setNotes((prev) =>
          prev.map((n) => (n.id === updated.id ? updated : n))
        );
        if (activeTabId === id) {
          setActiveNote((prev) => (prev ? { ...prev, title } : prev));
        }
      } catch (err) {
        console.error("Failed to rename note:", err);
      }
    },
    [activeTabId]
  );

  const handleDailyNote = useCallback(async () => {
    const title = todayString();

    // Check if today's daily note already exists
    const existing = notes.find(
      (n) => n.title === title && !n.is_folder
    );
    if (existing) {
      openTab(existing.id);
      return;
    }

    // Find or create "Daily Notes" folder
    let folder = notes.find(
      (n) => n.title === "Daily Notes" && n.is_folder && n.parent_id === null
    );
    if (!folder) {
      try {
        folder = await createNote({
          title: "Daily Notes",
          is_folder: true,
          parent_id: null,
        });
        setNotes((prev) => [folder!, ...prev]);
      } catch (err) {
        console.error("Failed to create Daily Notes folder:", err);
        return;
      }
    }

    // Create today's note
    try {
      const dailyNote = await createNote({
        title,
        parent_id: folder.id,
        is_folder: false,
      });
      setNotes((prev) => [dailyNote, ...prev]);
      setTabs((prev) => [...prev, { id: dailyNote.id, title: dailyNote.title }]);
      setActiveTabId(dailyNote.id);
    } catch (err) {
      console.error("Failed to create daily note:", err);
    }
  }, [notes]);

  const handleShare = useCallback(async (): Promise<string> => {
    if (!activeTabId) throw new Error("No active note");
    const { token, shared_at } = await shareNote(activeTabId);
    setNotes((prev) =>
      prev.map((n) => (n.id === activeTabId ? { ...n, shared_token: token, shared_at } : n))
    );
    setActiveNote((prev) => (prev ? { ...prev, shared_token: token, shared_at } : prev));
    return token;
  }, [activeTabId]);

  const handleUnshare = useCallback(async () => {
    if (!activeTabId) return;
    await unshareNote(activeTabId);
    setNotes((prev) =>
      prev.map((n) => (n.id === activeTabId ? { ...n, shared_token: null, shared_at: null } : n))
    );
    setActiveNote((prev) => (prev ? { ...prev, shared_token: null, shared_at: null } : prev));
  }, [activeTabId]);

  const handleImageUpload = useCallback(async (file: File) => {
    return uploadImage(file);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center w-full">
        <p className="text-stone-400 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <Sidebar
        notes={notes}
        activeNoteId={activeTabId}
        onSelectNote={openTab}
        onCreateNote={handleCreateNote}
        onCreateFolder={handleCreateFolder}
        onDeleteNote={handleDeleteNote}
        onDeleteMultiple={handleDeleteMultiple}
        onMoveNote={handleMoveNote}
        onRenameNote={handleRenameNote}
        onDailyNote={handleDailyNote}
        showArchive={showArchive}
        onToggleArchive={() => setShowArchive((v) => !v)}
        archiveCount={archivedNotes.length}
        isMobile={isMobile}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
      />

      {showArchive && (
        <ArchivePanel
          notes={archivedNotes}
          onRestore={handleRestore}
          onPermanentDelete={handlePermanentDelete}
          onPermanentDeleteAll={handlePermanentDeleteAll}
          onClose={() => setShowArchive(false)}
        />
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        {isMobile && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400"
            >
              <Menu size={18} />
            </button>
            {activeNote ? (
              <span className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                {activeNote.title}
              </span>
            ) : (
              <LogoFull size={18} />
            )}
          </div>
        )}
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onCloseTab={closeTab}
          onCloseOthers={closeOtherTabs}
          onCloseAll={closeAllTabs}
          onRenameNote={handleRenameNote}
        />
        {activeNote ? (
          <NoteEditor
            noteId={activeNote.id}
            content={activeNote.content}
            onUpdate={handleUpdateContent}
            onImageUpload={handleImageUpload}
            notes={notes}
            onSelectNote={openTab}
            sharedToken={activeNote.shared_token}
            sharedAt={activeNote.shared_at}
            onShare={handleShare}
            onUnshare={handleUnshare}
          />
        ) : notes.length === 0 ? (
          <Welcome
            onCreateNote={() => handleCreateNote()}
            onDailyNote={handleDailyNote}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="max-w-sm w-full space-y-6 text-center">
              <div className="text-stone-300 dark:text-stone-700">
                <FileText size={48} strokeWidth={1} className="mx-auto" />
              </div>
              <p className="text-sm text-stone-400 dark:text-stone-500">
                Select a note from the sidebar, or use a shortcut:
              </p>
              <div className="grid grid-cols-2 gap-2 text-left text-xs">
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400">
                  <Command size={12} className="shrink-0" />
                  <span><kbd className="font-mono bg-stone-200 dark:bg-stone-800 rounded px-1">Ctrl+K</kbd> Command palette</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400">
                  <Slash size={12} className="shrink-0" />
                  <span><kbd className="font-mono bg-stone-200 dark:bg-stone-800 rounded px-1">/</kbd> Slash commands</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400">
                  <Link2 size={12} className="shrink-0" />
                  <span><kbd className="font-mono bg-stone-200 dark:bg-stone-800 rounded px-1">[[</kbd> Link notes</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400">
                  <CalendarDays size={12} className="shrink-0" />
                  <span>Daily note</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400">
                  <MousePointer2 size={12} className="shrink-0" />
                  <span>Double-click to rename</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400">
                  <GripVertical size={12} className="shrink-0" />
                  <span>Drag to organize</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <PromptModal
        open={folderModal.open}
        onClose={() => setFolderModal({ open: false, parentId: null })}
        onSubmit={handleFolderSubmit}
        title="New folder"
        placeholder="Folder name"
        submitLabel="Create"
      />

      <CommandPalette
        notes={notes}
        onSelectNote={openTab}
        onCreateNote={() => handleCreateNote()}
        onCreateFolder={() => handleCreateFolder()}
        onDailyNote={handleDailyNote}
        onCloseAllTabs={closeAllTabs}
      />

      <ConfirmModal
        open={archiveModal.open}
        onClose={() => setArchiveModal({ open: false, noteId: null, isFolder: false })}
        onConfirm={handleArchiveConfirm}
        title={archiveModal.isFolder ? "Archive folder" : "Archive note"}
        message={
          archiveModal.isFolder
            ? "This folder and all its contents will be moved to the archive. Items are automatically deleted after 7 days."
            : "This note will be moved to the archive. It will be automatically deleted after 7 days."
        }
        confirmLabel="Archive"
        danger
      />
    </>
  );
}
