import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/tools";

function createHandler() {
  return async (req: NextRequest) => {
    const apiKey = await authenticateApiKey(req.headers.get("authorization"));
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

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
  };
}

const handler = createHandler();

export async function POST(req: NextRequest) {
  return handler(req);
}

export async function GET(req: NextRequest) {
  // MCP clients may send GET for SSE streams; pass through to transport
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer sk_stratus_")) {
    return handler(req);
  }

  // Non-authenticated GET returns server info
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
