"use client";

import { useEffect, useRef } from "react";
import { X, Loader2 } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-sm mx-4 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-stone-800">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

interface PromptModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  loading?: boolean;
}

export function PromptModal({
  open,
  onClose,
  onSubmit,
  title,
  placeholder,
  defaultValue = "",
  submitLabel = "OK",
  loading = false,
}: PromptModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const val = inputRef.current?.value.trim();
    if (val) {
      onSubmit(val);
      if (!loading) onClose();
    }
  }

  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          ref={inputRef}
          type="text"
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={loading}
          className="w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 placeholder-stone-400 dark:placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500 disabled:opacity-50"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-md text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title={title}>
      <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-3 py-1.5 text-sm rounded-md text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            onConfirm();
            if (!loading) onClose();
          }}
          className={`px-3 py-1.5 text-sm rounded-md text-white flex items-center gap-1.5 disabled:opacity-50 ${
            danger
              ? "bg-red-600 hover:bg-red-700"
              : "bg-stone-900 dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200"
          }`}
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

interface ImageUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  onUrl: (url: string) => void;
}

export function ImageUploadModal({
  open,
  onClose,
  onUpload,
  onUrl,
}: ImageUploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      onClose();
    }
  }

  function handleUrl(e: React.FormEvent) {
    e.preventDefault();
    const url = urlRef.current?.value.trim();
    if (url) {
      onUrl(url);
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Insert image">
      <div className="space-y-4">
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-md border-2 border-dashed border-stone-300 dark:border-stone-700 px-4 py-6 text-sm text-stone-500 dark:text-stone-400 hover:border-stone-400 dark:hover:border-stone-600 hover:text-stone-600 dark:hover:text-stone-300 transition-colors text-center"
          >
            Click to upload an image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-stone-400 dark:text-stone-500">
          <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
          <span>or paste a URL</span>
          <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
        </div>
        <form onSubmit={handleUrl} className="flex gap-2">
          <input
            ref={urlRef}
            type="url"
            placeholder="https://example.com/image.png"
            className="flex-1 rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 placeholder-stone-400 dark:placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
          />
          <button
            type="submit"
            className="px-3 py-2 text-sm rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200"
          >
            Insert
          </button>
        </form>
      </div>
    </Modal>
  );
}
