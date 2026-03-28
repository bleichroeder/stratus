"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LogoFull } from "@/components/ui/logo";
import {
  Upload,
  FolderOpen,
  FileText,
  Folder,
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
  X,
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

type Step = "select" | "preview" | "importing" | "done";

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("select");
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
        setError("No .md files found in the selected folder. Make sure you selected an Obsidian vault folder.");
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

  return (
    <div className="min-h-screen bg-white dark:bg-stone-950 flex flex-col">
      {/* Header */}
      <div className="border-b border-stone-200 dark:border-stone-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <LogoFull size={22} />
          </div>
          <h1 className="text-sm font-medium text-stone-900 dark:text-stone-100">Import Notes</h1>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-8">
        {/* Step: Select files */}
        {step === "select" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
                Import from Obsidian
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Select your Obsidian vault folder to import all notes and folder structure.
              </p>
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

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center gap-4 p-12 rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-900/50 transition-colors cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                <FolderOpen size={24} className="text-stone-500 dark:text-stone-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                  Choose vault folder
                </p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                  All .md files and folder structure will be imported
                </p>
              </div>
            </button>

            <div className="rounded-lg border border-stone-200 dark:border-stone-800 p-4 space-y-3">
              <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100">
                What gets imported
              </h3>
              <ul className="space-y-2 text-sm text-stone-500 dark:text-stone-400">
                <li className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 text-green-500 shrink-0" />
                  Markdown notes with formatting (headings, lists, code blocks, links, images)
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 text-green-500 shrink-0" />
                  Folder structure preserved as stratus folders
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 text-green-500 shrink-0" />
                  <span>[[Wikilinks]] converted to stratus note links</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 text-green-500 shrink-0" />
                  Callouts converted to stratus callout blocks
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 text-green-500 shrink-0" />
                  Task lists (checkboxes) preserved
                </li>
              </ul>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && preview && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
                Review import
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {preview.notes.length} note{preview.notes.length !== 1 ? "s" : ""} and{" "}
                {preview.folders.length} folder{preview.folders.length !== 1 ? "s" : ""} will be
                created.
              </p>
            </div>

            {/* Folder tree preview */}
            <div className="rounded-lg border border-stone-200 dark:border-stone-800 max-h-80 overflow-y-auto">
              <div className="p-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900">
                <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Contents
                </p>
              </div>
              <div className="p-2">
                {preview.folders.map((folder) => (
                  <div
                    key={folder}
                    className="flex items-center gap-2 px-2 py-1 text-sm text-stone-600 dark:text-stone-400"
                    style={{ paddingLeft: `${(folder.split("/").length - 1) * 16 + 8}px` }}
                  >
                    <Folder size={14} className="shrink-0 text-stone-400 dark:text-stone-500" />
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
                      <FileText size={14} className="shrink-0 text-stone-400 dark:text-stone-500" />
                      <span className="truncate">{note.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {preview.skipped.length > 0 && (
              <details className="text-sm">
                <summary className="text-stone-500 dark:text-stone-400 cursor-pointer hover:text-stone-700 dark:hover:text-stone-300">
                  {preview.skipped.length} file{preview.skipped.length !== 1 ? "s" : ""} skipped
                  (non-markdown)
                </summary>
                <div className="mt-2 p-3 rounded-md bg-stone-50 dark:bg-stone-900 text-stone-400 dark:text-stone-500 text-xs space-y-1 max-h-32 overflow-y-auto">
                  {preview.skipped.map((f) => (
                    <div key={f} className="truncate">{f}</div>
                  ))}
                </div>
              </details>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setStep("select");
                  setFiles([]);
                  setPreview(null);
                  setError(null);
                }}
                className="flex-1 rounded-md border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 px-4 py-2.5 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                className="flex-1 rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 py-2.5 text-sm font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors"
              >
                <span className="flex items-center justify-center gap-2">
                  <Upload size={14} />
                  Import {preview.notes.length} note{preview.notes.length !== 1 ? "s" : ""}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && progress && (
          <div className="space-y-6 text-center py-12">
            <Loader2 size={32} className="animate-spin text-stone-400 dark:text-stone-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
                Importing notes...
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {progress.phase === "folders" ? "Creating folders" : "Creating notes"} &middot;{" "}
                {progress.completed} of {progress.total}
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500 truncate max-w-sm mx-auto">
                {progress.current}
              </p>
            </div>

            {/* Progress bar */}
            <div className="max-w-sm mx-auto">
              <div className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-stone-900 dark:bg-stone-100 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && result && (
          <div className="space-y-6 text-center py-12">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Check size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
                Import complete
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Created {result.notesCreated} note{result.notesCreated !== 1 ? "s" : ""} and{" "}
                {result.foldersCreated} folder{result.foldersCreated !== 1 ? "s" : ""}.
              </p>
            </div>

            {result.errors.length > 0 && (
              <div className="max-w-sm mx-auto text-left">
                <details className="text-sm">
                  <summary className="text-red-500 dark:text-red-400 cursor-pointer">
                    {result.errors.length} error{result.errors.length !== 1 ? "s" : ""} occurred
                  </summary>
                  <div className="mt-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-xs space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <div key={i} className="text-red-600 dark:text-red-400">
                        <span className="font-medium">{e.path}:</span> {e.error}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-6 py-2.5 text-sm font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors"
            >
              Go to your notes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
