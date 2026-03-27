"use client";

import { useState, useEffect } from "react";
import type YPartyKitProvider from "y-partykit/provider";

interface AwarenessUser {
  name: string;
  color: string;
  clientId: number;
  isSelf: boolean;
}

interface PresenceAvatarsProps {
  provider: YPartyKitProvider | null;
}

export function PresenceAvatars({ provider }: PresenceAvatarsProps) {
  const [users, setUsers] = useState<AwarenessUser[]>([]);

  useEffect(() => {
    if (!provider) {
      setUsers([]);
      return;
    }

    const awareness = provider.awareness;

    function updateUsers() {
      const states = awareness.getStates();
      const currentClientId = awareness.clientID;
      const result: AwarenessUser[] = [];

      states.forEach((state, clientId) => {
        if (state.user) {
          result.push({
            name: state.user.name ?? "Anonymous",
            color: state.user.color ?? "#888",
            clientId,
            isSelf: clientId === currentClientId,
          });
        }
      });

      setUsers(result);
    }

    awareness.on("change", updateUsers);
    updateUsers();

    return () => {
      awareness.off("change", updateUsers);
    };
  }, [provider]);

  if (users.length === 0) return null;

  // Sort: others first, self last
  const sorted = [...users].sort((a, b) => (a.isSelf === b.isSelf ? 0 : a.isSelf ? 1 : -1));

  return (
    <div className="flex items-center gap-1 px-2">
      {sorted.slice(0, 5).map((user) => (
        <div
          key={user.clientId}
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 cursor-default ${
            user.isSelf
              ? "ring-2 ring-stone-400 dark:ring-stone-500 text-white"
              : "text-white"
          }`}
          style={{ backgroundColor: user.color }}
          title={user.isSelf ? `${user.name} (you)` : user.name}
        >
          {getInitials(user.name)}
        </div>
      ))}
      {sorted.length > 5 && (
        <div className="w-6 h-6 rounded-full bg-stone-300 dark:bg-stone-600 flex items-center justify-center text-[10px] font-medium text-stone-700 dark:text-stone-200 shrink-0">
          +{sorted.length - 5}
        </div>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  // Try splitting on spaces first (real names like "David Herzfeld")
  const spaceParts = name.trim().split(/\s+/);
  if (spaceParts.length >= 2) {
    return (spaceParts[0][0] + spaceParts[spaceParts.length - 1][0]).toUpperCase();
  }
  // Fall back to splitting on email separators
  const parts = name.split(/[@._\-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
