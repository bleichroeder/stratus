import type * as Party from "partykit/server";
import { onConnect, unstable_getYDoc } from "y-partykit";
import { verifyToken } from "./auth";
import { checkAccess } from "./supabase";

// Connection metadata stored in party storage
type ConnMeta = { userId: string; email: string; role: string };

export default class CollabServer implements Party.Server {
  connectionMeta = new Map<string, ConnMeta>();

  constructor(readonly room: Party.Room) {}

  get noteId(): string {
    return this.room.id.replace("note:", "");
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    try {
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      conn.close(4401, "Missing authentication token");
      return;
    }

    const supabaseUrl = (
      this.room.env.SUPABASE_URL ??
      this.room.env.NEXT_PUBLIC_SUPABASE_URL ??
      process.env.SUPABASE_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ) as string;
    if (!supabaseUrl) {
      console.error("[collab] No SUPABASE_URL in room.env or process.env");
      conn.close(4500, "Server misconfigured");
      return;
    }

    let payload;
    try {
      payload = await verifyToken(token, supabaseUrl);
    } catch (err) {
      console.error("[collab] Token verification failed:", err);
      conn.close(4401, "Invalid token");
      return;
    }

    const access = await checkAccess(this.noteId, payload.sub);
    if (!access.allowed) {
      console.error("[collab] Access denied for user", payload.sub, "on note", this.noteId);
      conn.close(4403, "Not authorized");
      return;
    }

    this.connectionMeta.set(conn.id, {
      userId: payload.sub,
      email: payload.email ?? "Unknown",
      role: access.role,
    });

    // Yjs sync with snapshot persistence to Durable Object storage.
    // When the room cold-starts, y-partykit loads the snapshot.
    // If no snapshot exists (first time), the first client pushes its content.
    await onConnect(conn, this.room, {
      persist: { mode: "snapshot" },
      gc: false,
    });
    } catch (err) {
      console.error("[collab] onConnect error:", err);
      conn.close(4500, "Internal server error");
    }
  }

  async onClose(conn: Party.Connection) {
    this.connectionMeta.delete(conn.id);

    // Ensure state is persisted when last client leaves
    const connections = [...this.room.getConnections()];
    if (connections.length === 0) {
      try {
        const ydoc = await unstable_getYDoc(this.room, {
          persist: { mode: "snapshot" },
          gc: false,
        });
        await ydoc.writeState();
      } catch (err) {
        console.error("Failed to persist on last disconnect:", err);
      }
    }
  }

  // HTTP endpoint for archive/delete notifications
  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === "POST") {
      try {
        const body = (await req.json()) as { type: string };
        if (body.type === "note-archived" || body.type === "note-deleted") {
          for (const conn of this.room.getConnections()) {
            conn.send(JSON.stringify(body));
          }
          return new Response("OK", { status: 200 });
        }
        return new Response("Unknown message type", { status: 400 });
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }
    }
    return new Response("Method not allowed", { status: 405 });
  }
}

CollabServer satisfies Party.Worker;
