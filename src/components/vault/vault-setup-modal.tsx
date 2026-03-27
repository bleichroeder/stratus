"use client";

import { useState, useRef, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Shield, Copy, Check, AlertTriangle, Download } from "lucide-react";
import { formatRecoveryKey } from "@/lib/crypto";

interface VaultSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSetup: (password: string) => Promise<string>;
  isOAuthUser?: boolean;
}

export function VaultSetupModal({ open, onClose, onSetup, isOAuthUser }: VaultSetupModalProps) {
  const [step, setStep] = useState<"confirm" | "recovery">("confirm");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setStep("confirm");
      setPassword("");
      setError(null);
      setLoading(false);
      setRecoveryKey("");
      setCopied(false);
      setSaved(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(null);

    try {
      const key = await onSetup(password);
      setRecoveryKey(key);
      setStep("recovery");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set up vault");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal open={open} onClose={step === "recovery" ? () => {} : onClose} title="Set up your vault">
      {step === "confirm" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-stone-50 dark:bg-stone-800">
            <Shield size={20} className="shrink-0 text-stone-500 mt-0.5" />
            <div className="text-xs text-stone-600 dark:text-stone-400 space-y-1">
              <p>Notes in the vault are encrypted with <strong>AES-256-GCM</strong> before leaving your device.</p>
              <p>Only you can decrypt them with your password.{isOAuthUser ? " This password is separate from your Google login." : ""}</p>
            </div>
          </div>

          <form onSubmit={handleConfirm} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                {isOAuthUser ? "Create a vault password" : "Confirm your login password"}
              </label>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isOAuthUser ? "Choose a strong password" : "Your account password"}
                required
                minLength={isOAuthUser ? 6 : undefined}
                className="w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 placeholder-stone-400 dark:placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm rounded-md text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !password}
                className="px-3 py-1.5 text-sm rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50"
              >
                {loading ? "Setting up..." : "Set up vault"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle size={20} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold">Save your recovery key</p>
              <p>If you forget your password, this is the <strong>only way</strong> to recover your vault. It will not be shown again.</p>
            </div>
          </div>

          <div className="relative">
            <code className="block w-full p-3 rounded-md bg-stone-100 dark:bg-stone-800 text-xs font-mono text-stone-900 dark:text-stone-100 break-all select-all leading-relaxed">
              {formatRecoveryKey(recoveryKey)}
            </code>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-600 dark:text-stone-400"
              title="Copy"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy to clipboard"}
            </button>
            <button
              onClick={() => {
                const blob = new Blob([`stratus vault recovery key\n\n${recoveryKey}\n\nKeep this file safe. If you forget your password, this is the only way to recover your vault.\n`], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "stratus-recovery-key.txt";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              <Download size={12} />
              Download as file
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400 cursor-pointer">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="rounded border-stone-300 dark:border-stone-600 accent-stone-900 dark:accent-stone-100"
            />
            I have saved my recovery key
          </label>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              disabled={!saved}
              className="px-4 py-1.5 text-sm rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
