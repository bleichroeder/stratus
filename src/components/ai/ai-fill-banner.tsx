"use client";

import { Sparkles, X, Loader2 } from "lucide-react";

interface AIFillBannerProps {
  onFill: () => void;
  onDismiss: () => void;
  loading: boolean;
}

export function AIFillBanner({ onFill, onDismiss, loading }: AIFillBannerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-violet-50 dark:bg-violet-950/30 border-b border-violet-200 dark:border-violet-800/50">
      <Sparkles size={14} className="shrink-0 text-violet-500 dark:text-violet-400" />
      <span className="text-xs text-violet-700 dark:text-violet-300 flex-1">
        AI can help fill this template
      </span>
      <button
        onClick={onFill}
        disabled={loading}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {loading ? "Generating..." : "Fill with AI"}
      </button>
      <button
        onClick={onDismiss}
        disabled={loading}
        className="p-0.5 rounded text-violet-400 dark:text-violet-500 hover:text-violet-600 dark:hover:text-violet-300 disabled:opacity-50"
      >
        <X size={14} />
      </button>
    </div>
  );
}
