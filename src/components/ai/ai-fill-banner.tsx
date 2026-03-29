"use client";

import { Sparkles, X, Loader2 } from "lucide-react";

interface AIFillBannerProps {
  onFill: () => void;
  onDismiss: () => void;
  loading: boolean;
}

export function AIFillBanner({ onFill, onDismiss, loading }: AIFillBannerProps) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800">
      <Sparkles size={14} className="shrink-0 text-stone-400 dark:text-stone-500 hidden sm:block" />
      <span className="text-xs text-stone-600 dark:text-stone-400 flex-1 min-w-0 truncate">
        AI can help fill this template
      </span>
      <button
        onClick={onFill}
        disabled={loading}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {loading ? "Generating..." : "Fill with AI"}
      </button>
      <button
        onClick={onDismiss}
        disabled={loading}
        className="p-0.5 rounded text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 disabled:opacity-50"
      >
        <X size={14} />
      </button>
    </div>
  );
}
