"use client";

import { useState, useRef, useEffect } from "react";
import { Share2, Link2, Check, Clock, RefreshCw } from "lucide-react";

interface ShareButtonProps {
  noteId: string;
  sharedToken: string | null;
  sharedAt: string | null;
  isEncrypted?: boolean;
  onShare: () => Promise<string>;
  onUnshare: () => void;
}

function daysUntilExpiry(sharedAt: string | null): number {
  if (!sharedAt) return 0;
  const shared = new Date(sharedAt).getTime();
  const expiry = shared + 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function ShareButton({ noteId, sharedToken, sharedAt, isEncrypted = false, onShare, onUnshare }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const shareUrl = sharedToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${sharedToken}`
    : null;

  const daysLeft = daysUntilExpiry(sharedAt);

  async function handleShare() {
    setLoading(true);
    try {
      await onShare();
    } finally {
      setLoading(false);
    }
  }

  async function handleReshare() {
    setLoading(true);
    try {
      await onUnshare();
      await onShare();
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => { if (!isEncrypted) setOpen((v) => !v); }}
        className={`p-1.5 rounded transition-colors ${
          isEncrypted
            ? "text-stone-300 dark:text-stone-600 cursor-not-allowed"
            : sharedToken
              ? "text-blue-600 dark:text-blue-400 hover:bg-stone-200 dark:hover:bg-stone-700"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
        }`}
        title={isEncrypted ? "Encrypted notes cannot be shared" : sharedToken ? "Sharing enabled" : "Share note"}
      >
        <Share2 size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl z-20 p-3 space-y-3">
          {sharedToken ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
                    Public link active
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-stone-400 dark:text-stone-500">
                  <Clock size={10} />
                  <span>{daysLeft}d left</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={shareUrl ?? ""}
                  className="flex-1 text-xs rounded-md border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-2 py-1.5 text-stone-600 dark:text-stone-400 truncate"
                />
                <button
                  onClick={handleCopy}
                  className="shrink-0 px-2 py-1.5 rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs hover:bg-stone-800 dark:hover:bg-stone-200"
                >
                  {copied ? <Check size={12} /> : <Link2 size={12} />}
                </button>
              </div>
              <p className="text-[11px] text-stone-400 dark:text-stone-500">
                Link expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}. Anyone with this link can view this note.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReshare}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md py-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={10} />
                  Extend 7 days
                </button>
                <button
                  onClick={() => { onUnshare(); setOpen(false); }}
                  className="flex-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md py-1.5 transition-colors"
                >
                  Stop sharing
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                Create a public link anyone can view without signing in. Links expire after 7 days.
              </p>
              <button
                onClick={handleShare}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50"
              >
                <Share2 size={14} />
                {loading ? "Creating link..." : "Share for 7 days"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
