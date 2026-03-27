"use client";

import { useState, useRef, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Lock, KeyRound } from "lucide-react";
import { parseRecoveryKey, validateRecoveryKey } from "@/lib/crypto";

interface VaultUnlockModalProps {
  open: boolean;
  onClose: () => void;
  onUnlock: (password: string) => Promise<void>;
  onRecover: (recoveryKey: string, newPassword: string) => Promise<void>;
  isOAuthUser?: boolean;
}

export function VaultUnlockModal({ open, onClose, onUnlock, onRecover, isOAuthUser }: VaultUnlockModalProps) {
  const [mode, setMode] = useState<"unlock" | "recover">("unlock");
  const [password, setPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMode("unlock");
      setPassword("");
      setRecoveryKey("");
      setNewPassword("");
      setError(null);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      await onUnlock(password);
      onClose();
    } catch (err) {
      setError("Incorrect password. If you recently changed your password, use the recovery key below.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    if (!recoveryKey || !newPassword) return;
    setLoading(true);
    setError(null);
    const parsed = parseRecoveryKey(recoveryKey);
    if (!validateRecoveryKey(parsed)) {
      setError("Invalid recovery key. It should be a 44-character base64 string.");
      setLoading(false);
      return;
    }
    try {
      await onRecover(parsed, newPassword);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid recovery key");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === "unlock" ? "Unlock vault" : "Recover vault"}>
      {mode === "unlock" ? (
        <form onSubmit={handleUnlock} className="space-y-3">
          <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 mb-2">
            <Lock size={16} />
            <p className="text-sm">{isOAuthUser ? "Enter your vault password to unlock." : "Enter your password to unlock the vault."}</p>
          </div>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isOAuthUser ? "Your vault password" : "Your account password"}
            required
            className="w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 placeholder-stone-400 dark:placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => { setMode("recover"); setError(null); }}
              className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
            >
              Forgot password?
            </button>
            <div className="flex gap-2">
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
                {loading ? "Unlocking..." : "Unlock"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={handleRecover} className="space-y-3">
          <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 mb-2">
            <KeyRound size={16} />
            <p className="text-sm">Enter your recovery key and a new password.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Recovery key</label>
            <textarea
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              placeholder="Paste your recovery key"
              required
              rows={2}
              className="w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-xs font-mono text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 placeholder-stone-400 dark:placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{isOAuthUser ? "New vault password" : "New password"}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={isOAuthUser ? "New vault password" : "New account password"}
              required
              minLength={6}
              className="w-full rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 placeholder-stone-400 dark:placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => { setMode("unlock"); setError(null); }}
              className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
            >
              Back to password
            </button>
            <button
              type="submit"
              disabled={loading || !recoveryKey || !newPassword}
              className="px-3 py-1.5 text-sm rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50"
            >
              {loading ? "Recovering..." : "Recover vault"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
