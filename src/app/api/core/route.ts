import { NextResponse } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { isAuthed } from "@/lib/stores/owner-session";

// Server-side redirect to a running kimi-core MCP gateway.
//
// The browser never sees KIMI_API_KEY. It POSTs { name, arguments } here; this
// route forwards the call over the official MCP Streamable-HTTP client (handles
// the initialize handshake + SSE framing) with the Bearer key from the server
// env, and hands back the tool's text output. kimi-core tools are agent-text
// (content:[{type:"text"}]), so we return that text for RAG injection — we do
// not try to reconstruct structured rows. See docs/BACKENDS.md.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This route attaches the operator's privileged KIMI_API_KEY and forwards a
// client-named tool to kimi-core, so it is a trust boundary. Defense in depth:
// (1) require the owner session cookie (same gate /api/store uses) so an
// anonymous caller can't reach kimi-core at all, and (2) a hardcoded allowlist
// of the exact tools the room actually invokes (every callCoreTool call site in
// src/) — anything else (gmail_read, memory_search full, …) is rejected before
// we ever connect. Note the allowlist checks tool NAMES only, not arguments:
// `store` is allowed as a whole, including op:"empty" — the core-adapter's own
// backup/empty flow uses it, and every caller past this gate is the owner.
const ALLOWED_TOOLS = new Set([
  "memory_search_safe",
  "memory_write",
  "chat_read",
  "chat_write",
  "chat_threads",
  "chat_delete",
  "paper_list",
  "store",
]);

export async function POST(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json(
      { error: "unauthorized — sign in via POST /api/auth (see docs/SELF-HOST.md)" },
      { status: 401 },
    );
  }

  const base = process.env.KIMI_CORE_URL;
  const key = process.env.KIMI_API_KEY;
  if (!base || !key) {
    return NextResponse.json(
      { error: "kimi-core not configured — set KIMI_CORE_URL + KIMI_API_KEY (see docs/BACKENDS.md)" },
      { status: 503 },
    );
  }

  let body: { name?: string; arguments?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.name) {
    return NextResponse.json({ error: "missing tool name" }, { status: 400 });
  }
  // Reject any tool the room doesn't legitimately call (the proxy holds the
  // operator's key, so an un-allowlisted name = privileged-tool abuse).
  if (!ALLOWED_TOOLS.has(body.name)) {
    return NextResponse.json({ error: "tool not permitted" }, { status: 403 });
  }

  const url = new URL(`${base.replace(/\/$/, "")}/mcp`);
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { Authorization: `Bearer ${key}` } },
  });
  const client = new Client({ name: "kimi-room", version: "0.1.0" });

  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: body.name,
      arguments: body.arguments ?? {},
    });
    const content = (result?.content ?? []) as Array<{ type?: string; text?: string }>;
    const text = content
      .filter((c) => c?.type === "text" && typeof c.text === "string")
      .map((c) => c.text as string)
      .join("\n");
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  } finally {
    await client.close().catch(() => {});
  }
}
