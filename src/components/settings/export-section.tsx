"use client";

import { useState, useCallback } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  exportNotesLibrary,
  downloadBlob,
  type ExportOptions,
  type ExportProgress,
} from "@/lib/export/export-notes";
import { useVault } from "@/components/vault/vault-context";

const PHASE_LABELS: Record<ExportProgress["phase"], string> = {
  fetching: "Fetching notes...",
  decrypting: "Decrypting vault notes...",
  converting: "Converting to Markdown...",
  attachments: "Downloading attachments...",
  zipping: "Building ZIP...",
};

export function ExportSection() {
  const { status: vaultStatus, vaultKey } = useVault();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [options, setOptions] = useState<ExportOptions>({
    includeArchived: true,
    includeShared: true,
    includeTemplates: true,
    includeVault: true,
    includeAttachments: true,
  });

  const vaultLocked = vaultStatus !== "unlocked";
  const canExportVault = options.includeVault && !vaultLocked;

  const handleExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    setProgress(null);

    try {
      const effectiveOptions = {
        ...options,
        includeVault: canExportVault,
      };

      const blob = await exportNotesLibrary(
        effectiveOptions,
        canExportVault ? vaultKey : null,
        setProgress,
      );

      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `notes-export-${date}.zip`);
    } catch (err) {
      console.error("Export failed:", err);
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
      setProgress(null);
    }
  }, [options, canExportVault, vaultKey]);

  function toggle(key: keyof ExportOptions) {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="mt-8 pt-8 border-t border-stone-200 dark:border-stone-700">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Export
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Download your entire library as Markdown files in a ZIP archive.
          </p>
        </div>
        <Download size={18} className="shrink-0 text-stone-400 dark:text-stone-500" />
      </div>

      {/* Options */}
      <div className="space-y-1 mb-4">
        {([
          ["includeArchived", "Archived notes"],
          ["includeShared", "Shared with me"],
          ["includeTemplates", "Templates"],
          ["includeVault", "Vault (encrypted) notes"],
          ["includeAttachments", "Image attachments"],
        ] as const).map(([key, label]) => (
          <label
            key={key}
            className="flex items-start gap-2.5 py-1.5 text-sm text-stone-700 dark:text-stone-300 cursor-pointer -mx-1 px-1 rounded-md active:bg-stone-100 dark:active:bg-stone-800"
          >
            <input
              type="checkbox"
              checked={options[key]}
              onChange={() => toggle(key)}
              disabled={exporting}
              className="mt-0.5 shrink-0 rounded border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 focus:ring-stone-500"
            />
            <span className="min-w-0">
              {label}
              {key === "includeVault" && options.includeVault && vaultLocked && (
                <span className="block sm:inline sm:ml-1 text-xs text-amber-600 dark:text-amber-400">
                  (vault locked — unlock to include)
                </span>
              )}
            </span>
          </label>
        ))}
      </div>

      {/* Progress bar */}
      {exporting && progress && (
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400 mb-1">
            <span className="truncate">{PHASE_LABELS[progress.phase]}</span>
            <span className="shrink-0">{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-stone-900 dark:bg-stone-100 rounded-full transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-2.5 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-sm rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50"
      >
        {exporting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Download size={14} />
        )}
        {exporting ? "Exporting..." : "Export as ZIP"}
      </button>
    </div>
  );
}
