"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Users, X, UserPlus } from "lucide-react";
import {
  getCollaborators,
  addCollaborator,
  removeCollaborator,
  updateCollaboratorRole,
} from "@/lib/notes";
import type { NoteCollaborator } from "@/lib/types";

interface CollaborateButtonProps {
  noteId: string;
  isEncrypted?: boolean;
  isInsideVault?: boolean;
  isOwner: boolean;
  collaborators: NoteCollaborator[];
  onCollaboratorsChange: (collaborators: NoteCollaborator[]) => void;
}

export function CollaborateButton({
  noteId,
  isEncrypted = false,
  isInsideVault = false,
  isOwner,
  collaborators,
  onCollaboratorsChange,
}: CollaborateButtonProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const disabled = isEncrypted || isInsideVault;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleInvite = useCallback(async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Look up user or send product invite
      const res = await fetch("/api/users/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to invite user");
        setLoading(false);
        return;
      }

      const { userId, invited } = await res.json();

      // Check if already a collaborator
      if (collaborators.some((c) => c.user_id === userId)) {
        setError("User is already a collaborator");
        setLoading(false);
        return;
      }

      const newCollab = await addCollaborator(noteId, userId, role);
      onCollaboratorsChange([...collaborators, newCollab]);
      setEmail("");
      setError(null);

      if (invited) {
        setSuccessMessage(`Invitation sent to ${email.trim()}. They'll see this note when they sign up.`);
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      setError("Failed to invite user");
    } finally {
      setLoading(false);
    }
  }, [email, role, noteId, collaborators, onCollaboratorsChange]);

  const handleRemove = useCallback(
    async (userId: string) => {
      try {
        await removeCollaborator(noteId, userId);
        onCollaboratorsChange(
          collaborators.filter((c) => c.user_id !== userId)
        );
      } catch {
        setError("Failed to remove collaborator");
      }
    },
    [noteId, collaborators, onCollaboratorsChange]
  );

  const handleRoleChange = useCallback(
    async (userId: string, newRole: "editor" | "viewer") => {
      try {
        await updateCollaboratorRole(noteId, userId, newRole);
        onCollaboratorsChange(
          collaborators.map((c) =>
            c.user_id === userId ? { ...c, role: newRole } : c
          )
        );
      } catch {
        setError("Failed to update role");
      }
    },
    [noteId, collaborators, onCollaboratorsChange]
  );

  const title = disabled
    ? isEncrypted
      ? "Encrypted notes cannot be shared for collaboration"
      : "Vault notes cannot be shared for collaboration"
    : collaborators.length > 0
      ? `${collaborators.length} collaborator${collaborators.length !== 1 ? "s" : ""}`
      : "Collaborate";

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
        className={`p-1.5 rounded transition-colors flex items-center gap-1 ${
          disabled
            ? "text-stone-300 dark:text-stone-600 cursor-not-allowed"
            : collaborators.length > 0
              ? "text-blue-600 dark:text-blue-400 hover:bg-stone-200 dark:hover:bg-stone-700"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
        }`}
        title={title}
      >
        <Users size={16} />
        {collaborators.length > 0 && (
          <span className="text-xs font-medium">{collaborators.length}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl z-20 p-3 space-y-3">
          <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
            Collaborate on this note
          </p>

          {/* Invite form (owner only) */}
          {isOwner && (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInvite();
                  }}
                  className="flex-1 text-xs rounded-md border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-2 py-1.5 text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
                />
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "editor" | "viewer")
                  }
                  className="text-xs rounded-md border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-1.5 py-1.5 text-stone-900 dark:text-stone-100"
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
              </div>
              <button
                onClick={handleInvite}
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50"
              >
                <UserPlus size={12} />
                {loading ? "Inviting..." : "Invite"}
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}
          {successMessage && (
            <p className="text-xs text-green-600 dark:text-green-400">{successMessage}</p>
          )}

          {/* Collaborator list */}
          {collaborators.length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              <p className="text-[11px] text-stone-400 dark:text-stone-500 uppercase tracking-wide font-medium">
                Collaborators
              </p>
              {collaborators.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-1.5 px-1"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-[10px] font-medium text-stone-600 dark:text-stone-300 shrink-0">
                      {c.user_id.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs text-stone-700 dark:text-stone-300 truncate">
                      {c.user_id.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isOwner ? (
                      <select
                        value={c.role}
                        onChange={(e) =>
                          handleRoleChange(
                            c.user_id,
                            e.target.value as "editor" | "viewer"
                          )
                        }
                        className="text-[11px] rounded border border-stone-200 dark:border-stone-700 bg-transparent text-stone-500 dark:text-stone-400 px-1 py-0.5"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="text-[11px] text-stone-400 dark:text-stone-500 capitalize">
                        {c.role}
                      </span>
                    )}
                    {isOwner && (
                      <button
                        onClick={() => handleRemove(c.user_id)}
                        className="p-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-red-500"
                        title="Remove collaborator"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-400 dark:text-stone-500">
              No collaborators yet. Invite someone to start collaborating in
              real time.
            </p>
          )}

          {!isOwner && (
            <p className="text-[11px] text-stone-400 dark:text-stone-500 border-t border-stone-200 dark:border-stone-700 pt-2">
              Only the note owner can manage collaborators.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
