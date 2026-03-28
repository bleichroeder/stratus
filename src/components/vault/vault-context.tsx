"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  setupVault as cryptoSetupVault,
  unlockVault as cryptoUnlockVault,
  rewrapVaultKey,
  importRecoveryKey,
  type VaultMetadata,
} from "@/lib/crypto";
import type { Note } from "@/lib/types";

export type VaultStatus = "loading" | "uninitialized" | "locked" | "unlocked";

const VAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

interface VaultContextValue {
  status: VaultStatus;
  vaultKey: CryptoKey | null;
  vaultFolderId: string | null;
  setVaultFolderId: (id: string | null) => void;
  setupVault: (password: string) => Promise<string>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  recoverVault: (recoveryKey: string, newPassword: string) => Promise<void>;
  isInsideVault: (noteId: string, notes: Note[]) => boolean;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>("loading");
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [vaultFolderId, setVaultFolderId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VaultMetadata | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Check user_metadata on mount
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const meta = session?.user?.user_metadata;
      if (meta?.vault_salt && meta?.vault_wrapped_key) {
        const version = (meta.vault_version as number) ?? 1;
        if (version !== 1) {
          console.error(`Unsupported vault version: ${version}`);
          setStatus("uninitialized");
          return;
        }
        setMetadata({
          vault_salt: meta.vault_salt as string,
          vault_wrapped_key: meta.vault_wrapped_key as string,
          vault_version: version,
        });
        setStatus("locked");
      } else {
        setStatus("uninitialized");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Auto-unlock with cached password from login
  useEffect(() => {
    if (status !== "locked" || !metadata) return;
    let cachedPw: string | null = null;
    try { cachedPw = sessionStorage.getItem("_vp"); } catch {}
    if (!cachedPw) return;

    // Clear immediately — one attempt only
    try { sessionStorage.removeItem("_vp"); } catch {}

    cryptoUnlockVault(cachedPw, metadata)
      .then((key) => {
        setVaultKey(key);
        setStatus("unlocked");
        setFailedAttempts(0);
      })
      .catch(() => {
        // Password didn't match vault (e.g., vault was set up with a different password)
        // Silently fail — user can unlock manually
      });
  }, [status, metadata]);

  // Clear key on tab close
  useEffect(() => {
    function handleUnload() {
      setVaultKey(null);
      try { sessionStorage.removeItem("_vp"); } catch {}
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // Auto-lock after inactivity
  useEffect(() => {
    if (status !== "unlocked") return;

    function resetIdleTimer() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        setVaultKey(null);
        setStatus("locked");
      }, VAULT_TIMEOUT_MS);
    }

    document.addEventListener("mousemove", resetIdleTimer);
    document.addEventListener("keydown", resetIdleTimer);
    document.addEventListener("click", resetIdleTimer);
    resetIdleTimer();

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      document.removeEventListener("mousemove", resetIdleTimer);
      document.removeEventListener("keydown", resetIdleTimer);
      document.removeEventListener("click", resetIdleTimer);
    };
  }, [status]);

  const setupVaultFn = useCallback(async (password: string): Promise<string> => {
    const { vaultKey: key, recoveryKey, metadata: meta } = await cryptoSetupVault(password);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: meta });
    if (error) throw error;

    setMetadata(meta);
    setVaultKey(key);
    setStatus("unlocked");
    setFailedAttempts(0);
    return recoveryKey;
  }, []);

  const unlock = useCallback(async (password: string) => {
    if (!metadata) throw new Error("Vault not initialized");

    // Brute force protection
    if (lockoutUntil > Date.now()) {
      const seconds = Math.ceil((lockoutUntil - Date.now()) / 1000);
      throw new Error(`Too many attempts. Try again in ${seconds}s`);
    }

    try {
      const key = await cryptoUnlockVault(password, metadata);
      setVaultKey(key);
      setStatus("unlocked");
      setFailedAttempts(0);
      setLockoutUntil(0);
    } catch {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        // Exponential backoff: 10s, 20s, 40s, 80s...
        const delay = Math.pow(2, Math.min(attempts - MAX_FAILED_ATTEMPTS, 5)) * 10000;
        setLockoutUntil(Date.now() + delay);
      }
      throw new Error("Incorrect password. If you recently changed your password, use the recovery key below.");
    }
  }, [metadata, failedAttempts, lockoutUntil]);

  const lock = useCallback(() => {
    setVaultKey(null);
    setStatus(metadata ? "locked" : "uninitialized");
  }, [metadata]);

  const recoverVault = useCallback(async (recoveryKeyB64: string, newPassword: string) => {
    const key = await importRecoveryKey(recoveryKeyB64);
    const newMeta = await rewrapVaultKey(key, newPassword);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: newMeta });
    if (error) throw error;

    setMetadata(newMeta);
    setVaultKey(key);
    setStatus("unlocked");
    setFailedAttempts(0);
    setLockoutUntil(0);
  }, []);

  const isInsideVault = useCallback((noteId: string, notes: Note[]): boolean => {
    if (!vaultFolderId) return false;
    let current: string | null = noteId;
    while (current) {
      if (current === vaultFolderId) return true;
      const note = notes.find((n) => n.id === current);
      if (!note?.parent_id) return false;
      current = note.parent_id;
    }
    return false;
  }, [vaultFolderId]);

  return (
    <VaultContext.Provider
      value={{
        status,
        vaultKey,
        vaultFolderId,
        setVaultFolderId,
        setupVault: setupVaultFn,
        unlock,
        lock,
        recoverVault,
        isInsideVault,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}
