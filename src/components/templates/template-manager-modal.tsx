"use client";

import { useState } from "react";
import { Modal, ConfirmModal, PromptModal } from "@/components/ui/modal";
import { type TemplateItem } from "@/lib/templates";
import { LayoutTemplate, Pencil, Trash2, Lock } from "lucide-react";

interface TemplateManagerModalProps {
  open: boolean;
  onClose: () => void;
  templates: TemplateItem[];
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

export function TemplateManagerModal({
  open,
  onClose,
  templates,
  onDelete,
  onRename,
}: TemplateManagerModalProps) {
  const [deleteTarget, setDeleteTarget] = useState<TemplateItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<TemplateItem | null>(null);

  const builtIn = templates.filter((t) => t.builtIn);
  const custom = templates.filter((t) => !t.builtIn);

  return (
    <>
      <Modal open={open} onClose={onClose} title="Manage templates">
        <div className="space-y-3 max-h-[400px] overflow-y-auto -mx-4 px-4">
          {builtIn.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                Built-in
              </span>
              {builtIn.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md"
                >
                  <span className="shrink-0 text-stone-400 dark:text-stone-500">
                    <LayoutTemplate size={16} />
                  </span>
                  <span className="flex-1 text-sm text-stone-900 dark:text-stone-100">
                    {t.title}
                  </span>
                  <span className="text-stone-300 dark:text-stone-600">
                    <Lock size={12} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {custom.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                My Templates
              </span>
              {custom.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md group hover:bg-stone-50 dark:hover:bg-stone-800/50"
                >
                  <span className="shrink-0 text-stone-400 dark:text-stone-500">
                    <LayoutTemplate size={16} />
                  </span>
                  <span className="flex-1 text-sm text-stone-900 dark:text-stone-100 truncate">
                    {t.title}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => setRenameTarget(t)}
                      className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 dark:text-stone-500"
                      title="Rename"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {custom.length === 0 && (
            <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">
              No custom templates yet. Save a note as a template to get started.
            </p>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDelete(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        title="Delete template"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />

      <PromptModal
        open={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={(value) => {
          if (renameTarget) {
            onRename(renameTarget.id, value);
            setRenameTarget(null);
          }
        }}
        title="Rename template"
        placeholder="Template name"
        defaultValue={renameTarget?.title ?? ""}
        submitLabel="Rename"
      />
    </>
  );
}
