"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FolderOpen,
  FileText,
  Folder,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  readFilesFromInput,
  previewImport,
  executeImport,
  type ImportFile,
  type ImportPreview,
  type ImportProgress,
  type ImportResult,
} from "@/lib/import/obsidian";

type Step = "idle" | "preview" | "importing" | "done";

export function ImportSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("idle");
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(async (fileList: FileList) => {
    setError(null);
    try {
      const imported = await readFilesFromInput(fileList);
      if (imported.length === 0) {
        setError(
          "No .md files found in the selected folder. Make sure you selected an Obsidian vault folder.",
        );
        return;
      }
      setFiles(imported);
      setPreview(previewImport(imported));
      setStep("preview");
    } catch (err) {
      setError(`Failed to read files: ${err}`);
    }
  }, []);

  const handleImport = useCallback(async () => {
    setStep("importing");
    setError(null);
    try {
      const importResult = await executeImport(files, setProgress);
      setResult(importResult);
      setStep("done");
    } catch (err) {
      setError(`Import failed: ${err}`);
      setStep("preview");
    }
  }, [files]);

  const handleReset = useCallback(() => {
    setStep("idle");
    setFiles([]);
    setPreview(null);
    setProgress(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <div className="mt-8 pt-8 border-t border-stone-200 dark:border-stone-700">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Import
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Import notes from an Obsidian vault folder.
          </p>
        </div>
        <Upload
          size={18}
          className="shrink-0 text-stone-400 dark:text-stone-500"
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        /* @ts-expect-error webkitdirectory is non-standard but widely supported */
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
          }
        }}
      />

      {/* Step: Idle — select folder */}
      {step === "idle" && (
        <div className="space-y-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-900/50 transition-colors cursor-pointer active:bg-stone-100 dark:active:bg-stone-800"
          >
            <div className="w-9 h-9 shrink-0 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
              <FolderOpen
                size={18}
                className="text-stone-500 dark:text-stone-400"
              />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                Choose vault folder
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                All .md files and folder structure will be imported
              </p>
            </div>
          </button>

          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && preview && (
        <div className="space-y-3">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {preview.notes.length} note{preview.notes.length !== 1 ? "s" : ""}{" "}
            and {preview.folders.length} folder
            {preview.folders.length !== 1 ? "s" : ""} found.
          </p>

          {/* Folder tree preview */}
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 max-h-52 overflow-y-auto">
            <div className="p-2">
              {preview.folders.map((folder) => (
                <div
                  key={folder}
                  className="flex items-center gap-2 px-2 py-1 text-sm text-stone-600 dark:text-stone-400"
                  style={{
                    paddingLeft: `${(folder.split("/").length - 1) * 16 + 8}px`,
                  }}
                >
                  <Folder
                    size={14}
                    className="shrink-0 text-stone-400 dark:text-stone-500"
                  />
                  <span className="truncate">{folder.split("/").pop()}</span>
                </div>
              ))}
              {preview.notes.map((note) => {
                const depth = note.path.split("/").length - 1;
                return (
                  <div
                    key={note.path}
                    className="flex items-center gap-2 px-2 py-1 text-sm text-stone-600 dark:text-stone-400"
                    style={{ paddingLeft: `${depth * 16 + 8}px` }}
                  >
                    <FileText
                      size={14}
                      className="shrink-0 text-stone-400 dark:text-stone-500"
                    />
                    <span className="truncate">{note.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {preview.skipped.length > 0 && (
            <details className="text-xs">
              <summary className="text-stone-500 dark:text-stone-400 cursor-pointer hover:text-stone-700 dark:hover:text-stone-300">
                {preview.skipped.length} file
                {preview.skipped.length !== 1 ? "s" : ""} skipped
                (non-markdown)
              </summary>
              <div className="mt-1 p-2 rounded-md bg-stone-50 dark:bg-stone-900 text-stone-400 dark:text-stone-500 space-y-0.5 max-h-24 overflow-y-auto">
                {preview.skipped.map((f) => (
                  <div key={f} className="truncate">
                    {f}
                  </div>
                ))}
              </div>
            </details>
          )}

          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex-1 rounded-md border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors active:bg-stone-100 dark:active:bg-stone-800"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-3 py-2 text-sm hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors"
            >
              <Upload size={14} />
              Import {preview.notes.length} note
              {preview.notes.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === "importing" && progress && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
            <Loader2 size={14} className="animate-spin shrink-0" />
            <span className="truncate">
              {progress.phase === "folders"
                ? "Creating folders"
                : "Creating notes"}{" "}
              — {progress.completed} of {progress.total}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
            <div
              className="h-full bg-stone-900 dark:bg-stone-100 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progress.current && (
            <p className="text-xs text-stone-400 dark:text-stone-500 truncate">
              {progress.current}
            </p>
          )}
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check size={14} className="shrink-0" />
            <span>
              Imported {result.notesCreated} note
              {result.notesCreated !== 1 ? "s" : ""} and{" "}
              {result.foldersCreated} folder
              {result.foldersCreated !== 1 ? "s" : ""}.
            </span>
          </div>

          {result.errors.length > 0 && (
            <details className="text-xs">
              <summary className="text-red-500 dark:text-red-400 cursor-pointer">
                {result.errors.length} error
                {result.errors.length !== 1 ? "s" : ""} occurred
              </summary>
              <div className="mt-1 p-2 rounded-md bg-red-50 dark:bg-red-900/20 space-y-0.5 max-h-24 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-red-600 dark:text-red-400">
                    <span className="font-medium">{e.path}:</span> {e.error}
                  </div>
                ))}
              </div>
            </details>
          )}

          <button
            onClick={handleReset}
            className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
          >
            Import another vault
          </button>
        </div>
      )}
    </div>
  );
}
