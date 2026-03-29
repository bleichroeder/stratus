import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/tools";

// Force Node.js runtime — crypto and Supabase need it
export const runtime = "nodejs";

async function handler(req: NextRequest) {
  const apiKey = await authenticateApiKey(req.headers.get("authorization"));
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Invalid API key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create a fresh server + transport per request.
  // Stateless mode (sessionIdGenerator: undefined) means each request
  // is self-contained — no need to cache server instances.
  const server = new McpServer({
    name: "Stratus",
    version: "1.0.0",
  });
  registerTools(server, apiKey);

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
