"use client";

import { useState } from "react";
import { Archive, RotateCcw, Trash2, X, FileText, Folder, Loader2 } from "lucide-react";
import type { Note } from "@/lib/types";
import { ConfirmModal } from "@/components/ui/modal";

interface ArchivePanelProps {
  notes: Note[];
  onRestore: (id: string) => Promise<void>;
  onPermanentDelete: (id: string) => Promise<void>;
  onPermanentDeleteAll: () => Promise<void>;
  onClose: () => void;
}

function daysLeft(archivedAt: string): number {
  const archived = new Date(archivedAt).getTime();
  const expiry = archived + 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function ArchivePanel({ notes, onRestore, onPermanentDelete, onPermanentDeleteAll, onClose }: ArchivePanelProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; noteId: string | null; isAll: boolean }>({
    open: false,
    noteId: null,
    isAll: false,
  });
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  return (
    <>
      {/* Fixed overlay — covers everything including mobile nav */}
      <div className="fixed inset-0 z-50 flex md:justify-start justify-end flex-col md:flex-row">
        {/* Backdrop — on mobile it's above the panel, on desktop it's to the right */}
        <div
          className="order-first md:order-last flex-1 bg-black/20 animate-[fadeIn_150ms_ease-out]"
          onClick={onClose}
        />

        {/* Panel — bottom sheet on mobile, left sidebar on desktop */}
        <div className="
          md:w-72 md:h-full md:order-first
          max-h-[85dvh] md:max-h-none
          border-t md:border-t-0 md:border-r border-stone-200 dark:border-stone-800
          bg-stone-50 dark:bg-stone-900
          flex flex-col shrink-0 shadow-lg relative
          md:animate-[slideInLeft_150ms_ease-out]
          animate-[slideUp_200ms_ease-out]
          rounded-t-xl md:rounded-none
        ">
          {deletingAll && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-stone-50/80 dark:bg-stone-900/80 backdrop-blur-[2px] rounded-t-xl md:rounded-none">
              <Loader2 size={24} className="animate-spin text-stone-400 dark:text-stone-500" />
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-3">Deleting all items&hellip;</p>
            </div>
          )}

          {/* Drag handle — mobile only */}
          <div className="md:hidden flex justify-center pt-2 pb-1">
            <div className="w-8 h-1 rounded-full bg-stone-300 dark:bg-stone-700" />
          </div>

          <div className="flex items-center justify-between p-3 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <Archive size={16} className="text-stone-500 dark:text-stone-400" />
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Archive</h2>
              {notes.length > 0 && (
                <span className="text-[10px] text-stone-400 dark:text-stone-500">{notes.length}</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-400"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {notes.length === 0 ? (
              <p className="text-sm text-stone-400 dark:text-stone-500 px-3 py-8 text-center">
                No archived items
              </p>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="group px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {note.is_folder ? (
                      <Folder size={14} className="shrink-0 text-stone-400 dark:text-stone-500" />
                    ) : (
                      <FileText size={14} className="shrink-0 text-stone-400 dark:text-stone-500" />
                    )}
                    <span className="text-sm text-stone-700 dark:text-stone-300 truncate flex-1">
                      {note.title}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 ml-[22px]">
                    <span className="text-xs text-stone-400 dark:text-stone-500">
                      {note.archived_at && `${daysLeft(note.archived_at)}d left`}
                    </span>
                    {/* Always visible on mobile (no hover), hover-reveal on desktop */}
                    <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={async () => {
                          setRestoringIds((prev) => new Set([...prev, note.id]));
                          try { await onRestore(note.id); } finally {
                            setRestoringIds((prev) => { const n = new Set(prev); n.delete(note.id); return n; });
                          }
                        }}
                        disabled={restoringIds.has(note.id)}
                        className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-600 disabled:opacity-50"
                      >
                        {restoringIds.has(note.id) ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                        Restore
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ open: true, noteId: note.id, isAll: false })}
                        className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                      >
                        <Trash2 size={10} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-stone-200 dark:border-stone-800 space-y-2">
            {notes.length > 0 && (
              <button
                onClick={() => setDeleteConfirm({ open: true, noteId: null, isAll: true })}
                disabled={deletingAll}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
              >
                {deletingAll ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                {deletingAll ? "Deleting..." : `Delete all (${notes.length})`}
              </button>
            )}
            <p className="text-[10px] text-stone-400 dark:text-stone-500 text-center">
              Items auto-delete after 7 days
            </p>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, noteId: null, isAll: false })}
        onConfirm={async () => {
          setDeleteLoading(true);
          const isAll = deleteConfirm.isAll;
          try {
            if (isAll) {
              setDeleteConfirm({ open: false, noteId: null, isAll: false });
              setDeletingAll(true);
              await onPermanentDeleteAll();
            } else if (deleteConfirm.noteId) {
              await onPermanentDelete(deleteConfirm.noteId);
              setDeleteConfirm({ open: false, noteId: null, isAll: false });
            }
          } finally {
            setDeleteLoading(false);
            setDeletingAll(false);
          }
        }}
        title={deleteConfirm.isAll ? "Delete all archived items" : "Delete permanently"}
        message={
          deleteConfirm.isAll
            ? `This will permanently delete all ${notes.length} archived item${notes.length !== 1 ? "s" : ""}. This cannot be undone.`
            : "This will permanently delete this item. This cannot be undone."
        }
        confirmLabel="Delete forever"
        danger
        loading={deleteLoading}
      />
    </>
  );
}
