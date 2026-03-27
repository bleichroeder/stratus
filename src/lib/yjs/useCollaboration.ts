"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import { createClient } from "@/lib/supabase/client";
import type { AnyExtension } from "@tiptap/core";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface UseCollaborationOptions {
  noteId: string;
  isCollaborative: boolean;
  userName?: string;
  userColor?: string;
}

interface UseCollaborationReturn {
  ydoc: Y.Doc | null;
  provider: YPartyKitProvider | null;
  connectionStatus: ConnectionStatus;
  collabExtensions: AnyExtension[];
}

export function useCollaboration({
  noteId,
  isCollaborative,
  userName,
  userColor,
}: UseCollaborationOptions): UseCollaborationReturn {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<YPartyKitProvider | null>(null);
  // Stable empty array to avoid reference changes triggering useEditor re-creation
  const emptyExtensions = useRef<AnyExtension[]>([]).current;
  const [collabExtensions, setCollabExtensions] = useState<AnyExtension[]>(emptyExtensions);
  const [, forceUpdate] = useState(0);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.disconnect();
      providerRef.current.destroy();
      providerRef.current = null;
    }
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }
    setConnectionStatus("disconnected");
    setCollabExtensions(emptyExtensions);
  }, [emptyExtensions]);

  useEffect(() => {
    if (!isCollaborative || !noteId) {
      cleanup();
      return;
    }

    let cancelled = false;

    async function connect() {
      const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
      if (!host) {
        // PartyKit not configured — collaboration features disabled silently
        return;
      }

      // Get Supabase access token
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token || cancelled) return;

      // Dynamically import collaboration extension
      const { default: Collaboration } = await import("@tiptap/extension-collaboration");

      if (cancelled) return;

      // Create Yjs doc and PartyKit provider
      const ydoc = new Y.Doc();
      const provider = new YPartyKitProvider(host, `note:${noteId}`, ydoc, {
        params: { token: session.access_token },
        connect: true,
      });

      // Track connection status
      provider.on("status", ({ status }: { status: string }) => {
        if (cancelled) return;
        if (status === "connected") {
          setConnectionStatus("connected");
        } else if (status === "connecting") {
          setConnectionStatus("connecting");
        } else {
          setConnectionStatus("disconnected");
        }
      });

      // Listen for server-sent messages (archive notifications)
      provider.on("message", (event: MessageEvent) => {
        try {
          const data = JSON.parse(
            typeof event.data === "string"
              ? event.data
              : new TextDecoder().decode(event.data)
          );
          if (
            data.type === "note-archived" ||
            data.type === "note-deleted"
          ) {
            cleanup();
          }
        } catch {
          // Not a JSON message (likely Yjs sync data), ignore
        }
      });

      if (cancelled) {
        provider.disconnect();
        provider.destroy();
        ydoc.destroy();
        return;
      }

      ydocRef.current = ydoc;
      providerRef.current = provider;
      setConnectionStatus("connecting");

      // Set awareness user data (for presence avatars)
      provider.awareness.setLocalStateField("user", {
        name: userName ?? "Anonymous",
        color: userColor ?? "#888",
      });

      // Wait for initial Yjs sync before creating editor extensions
      function onSync(synced: boolean) {
        if (cancelled || !synced) return;

        // Only include Collaboration — NOT CollaborationCursor.
        // CollaborationCursor's cursor-plugin crashes during EditorState.reconfigure
        // because state.doc is undefined. We skip cursor decorations entirely for now.
        setCollabExtensions([
          Collaboration.configure({ document: ydoc }),
        ]);
        forceUpdate((n) => n + 1);
      }

      if (provider.synced) {
        onSync(true);
      } else {
        provider.once("sync", onSync);
      }
    }

    connect();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [noteId, isCollaborative, cleanup, userName, userColor]);

  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
    connectionStatus,
    collabExtensions,
  };
}
