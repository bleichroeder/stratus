"use client";

import { useState, useEffect, useCallback } from "react";
import { Key, Plus, Copy, Check, Trash2, Loader2 } from "lucide-react";

interface ApiKeyInfo {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
}

const ALL_SCOPES = [
  { value: "notes:read", label: "Read", desc: "Get notes by ID" },
  { value: "notes:write", label: "Write", desc: "Create and update notes" },
  { value: "notes:search", label: "Search", desc: "Full-text search" },
] as const;

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([
    "notes:read",
    "notes:write",
    "notes:search",
  ]);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<"key" | "config" | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim() || !newKeyScopes.length) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim(), scopes: newKeyScopes }),
      });
      if (res.ok) {
        const data = await res.json();
        setRevealedKey(data.key);
        setNewKeyName("");
        setNewKeyScopes(["notes:read", "notes:write", "notes:search"]);
        setShowCreate(false);
        await fetchKeys();
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      await fetch("/api/v1/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } finally {
      setRevoking(null);
    }
  }

  function toggleScope(scope: string) {
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  function copyToClipboard(text: string, type: "key" | "config") {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  function mcpConfig(key: string) {
    return JSON.stringify(
      {
        mcpServers: {
          stratus: {
            url: `${window.location.origin}/api/mcp`,
            headers: {
              Authorization: `Bearer ${key}`,
            },
          },
        },
      },
      null,
      2
    );
  }

  function timeAgo(dateStr: string | null): string {
    if (!dateStr) return "Never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div>
      <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            API Keys
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Connect Stratus to AI tools like Claude, Cursor, and others via MCP.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Generate Key</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Revealed key (shown once after creation) */}
      {revealedKey && (
        <div className="mb-4 p-3 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
            Save this key — it cannot be retrieved again.
          </p>
          <div className="flex items-start gap-2 mb-3">
            <code className="flex-1 min-w-0 text-xs bg-white dark:bg-stone-800 px-2 py-1.5 rounded border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-mono break-all">
              {revealedKey}
            </code>
            <button
              onClick={() => copyToClipboard(revealedKey, "key")}
              className="shrink-0 p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400"
              title="Copy key"
            >
              {copied === "key" ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 mb-1.5">
            MCP config (paste into claude_desktop_config.json or Cursor settings):
          </p>
          <div className="relative">
            <pre className="text-[11px] sm:text-xs bg-white dark:bg-stone-800 p-2 rounded border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 overflow-x-auto max-w-full">
              {mcpConfig(revealedKey)}
            </pre>
            <button
              onClick={() =>
                copyToClipboard(mcpConfig(revealedKey), "config")
              }
              className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-400"
              title="Copy config"
            >
              {copied === "config" ? (
                <Check size={12} />
              ) : (
                <Copy size={12} />
              )}
            </button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            className="mt-2 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create key form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-4 p-3 rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50"
        >
          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
            Key name
          </label>
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder='e.g. "Claude Desktop", "Cursor"'
            className="w-full rounded-md border border-stone-300 dark:border-stone-600 px-3 py-1.5 text-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500 mb-3"
            autoFocus
          />
          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
            Scopes
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {ALL_SCOPES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleScope(s.value)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  newKeyScopes.includes(s.value)
                    ? "border-stone-900 dark:border-stone-100 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
                    : "border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:border-stone-400 dark:hover:border-stone-500"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-sm rounded-md text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newKeyName.trim() || !newKeyScopes.length}
              className="px-3 py-1.5 text-sm rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50 flex items-center gap-1.5"
            >
              {creating && <Loader2 size={14} className="animate-spin" />}
              Generate
            </button>
          </div>
        </form>
      )}

      {/* Key list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-stone-400 dark:text-stone-500">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8 text-sm text-stone-400 dark:text-stone-500">
          <Key size={24} className="mx-auto mb-2 opacity-50" />
          <p>No API keys yet.</p>
          <p className="text-xs mt-1">Generate a key to connect AI tools.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-start justify-between p-3 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Key size={14} className="shrink-0 text-stone-500 dark:text-stone-400" />
                  <span className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                    {k.name}
                  </span>
                  <code className="text-xs text-stone-400 dark:text-stone-500 font-mono">
                    {k.key_prefix}...
                  </code>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-stone-500 dark:text-stone-400">
                  <span>
                    Scopes:{" "}
                    {k.scopes
                      .map((s) => s.replace("notes:", ""))
                      .join(", ")}
                  </span>
                  <span>Last used: {timeAgo(k.last_used_at)}</span>
                </div>
              </div>
              <button
                onClick={() => handleRevoke(k.id)}
                disabled={revoking === k.id}
                className="shrink-0 p-1.5 rounded text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                title="Revoke key"
              >
                {revoking === k.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
