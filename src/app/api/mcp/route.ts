import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextRequest } from "next/server";
import { authenticateApiKey, type ApiKeyRecord } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/tools";

// Cache server instances per API key so initialization state persists
// across requests within the same serverless function instance.
// MCP requires: initialize → initialized → tools/list. Without caching,
// each request creates a fresh uninitialized server and tools/list fails.
const serverCache = new Map<string, McpServer>();

function getOrCreateServer(apiKey: ApiKeyRecord): McpServer {
  let server = serverCache.get(apiKey.id);
  if (!server) {
    server = new McpServer({
      name: "Stratus",
      version: "1.0.0",
    });
    registerTools(server, apiKey);
    serverCache.set(apiKey.id, server);
  }
  return server;
}

async function handler(req: NextRequest) {
  const apiKey = await authenticateApiKey(req.headers.get("authorization"));
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Invalid API key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const server = getOrCreateServer(apiKey);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  return transport.handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer sk_stratus_")) {
    return handler(req);
  }

  return new Response(
    JSON.stringify({
      name: "Stratus",
      version: "1.0.0",
      description: "Note-taking tools for AI assistants",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

export async function DELETE(req: NextRequest) {
  return handler(req);
}
