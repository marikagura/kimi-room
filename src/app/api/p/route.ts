import { NextResponse } from "next/server";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { isAuthed } from "@/lib/stores/owner-session";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// `-p` generation backend — run the reply on the Claude CLI installed on THIS
// machine instead of calling a model API from the browser.
//
// The point of the mode: generation happens inside the operator's own Claude
// session, so the reply carries whatever that environment already has — its
// CLAUDE.md, its MCP servers, its subscription quota. The room ships no Claude
// configuration of its own; everything in the harness comes from the deployer's
// machine. The other backend ("direct", the browser calling an OpenAI-compatible
// or Anthropic endpoint with a key from localStorage) is untouched and stays the
// default. See docs/ADDONS.md.
//
// Trust boundary — this route spends the deployer's subscription, so:
//   1. Owner session cookie required, checked before anything else (same gate
//      /api/core and /api/tts use). A visitor who finds the deployment URL gets
//      401 and never reaches the CLI.
//   2. Nothing the browser sends is interpolated into a shell. There is no
//      shell: spawn() with an argv array. The prompt goes over stdin, never in
//      argv. `model` is matched against a fixed id set and `resume` against a
//      UUID shape; anything else is rejected before spawn.
//   3. The route writes no transcript to disk. The CLI keeps its own session
//      store on the operator's machine — that is what --resume reads, and it is
//      the deployer's own file, not something this route exports.
//
// env:
//   CLAUDE_P_ENABLED=1        opt in. Unset → the mode does not exist (GET says
//                             enabled:false and the UI never lists it).
//   CLAUDE_P_BIN              path to the CLI (default: "claude" on PATH). It has
//                             to be Claude's CLI or something that speaks its argv
//                             and its stream-json events — this route is not a
//                             generic agent runner. Another vendor's CLI will not
//                             drop in: Codex, for one, runs non-interactively as
//                             `codex exec --json` and emits thread.started /
//                             item.completed, and its `-p` means --profile, so
//                             pointing this at it misfires rather than failing
//                             cleanly. Supporting one is a second ChatProvider,
//                             not a different path here.
//   CLAUDE_P_CWD              working directory (default: the user's home)
//   CLAUDE_P_PERMISSION_MODE  default | acceptEdits | bypassPermissions | plan
//                             (default: "default" — tool calls needing approval
//                             are declined, since nobody is at the terminal)
//   CLAUDE_P_ALLOWED_TOOLS    comma list passed to --allowedTools. Empty by
//                             default: the reply is text only. Opening this up
//                             lets the chat read and write real files.

const ENABLED = process.env.CLAUDE_P_ENABLED === "1";
const BIN = process.env.CLAUDE_P_BIN || "claude";
const CWD = process.env.CLAUDE_P_CWD || homedir();
const ALLOWED_TOOLS = (process.env.CLAUDE_P_ALLOWED_TOOLS ?? "").trim();

/**
 * The models this deployment will run, newest first.
 *
 * Pinned ids rather than the CLI's floating aliases (`opus`, `sonnet`): an alias
 * always means whichever version is current, so the older ones become
 * unreachable the moment a new release lands. Listing them out lets generations
 * coexist — worth having, because they are not strictly ordered by quality for
 * every job, and a conversation started on one is best continued on it.
 *
 * The cost of pinning is that this list goes stale. It is one array, and an id
 * the installed CLI does not know fails loudly rather than silently downgrading.
 *
 * These strings reach argv, so the set is closed: an unrecognised model is
 * rejected outright rather than cleaned up and passed along.
 */
const MODELS = [
  "claude-opus-5",
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-5",
  "claude-sonnet-4-5",
  "claude-fable-5",
] as const;

const DEFAULT_MODEL = "claude-sonnet-5";

const PERMISSION_MODES = new Set(["default", "acceptEdits", "bypassPermissions", "plan"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_PROMPT_CHARS = 200_000;

// `claude --version` is slow enough (node startup) to be worth caching, and the
// answer only changes when someone installs or removes the CLI.
let probeCache: { at: number; ok: boolean; version: string } | null = null;
const PROBE_TTL_MS = 5 * 60 * 1000;

async function probeCli(): Promise<{ ok: boolean; version: string }> {
  if (probeCache && Date.now() - probeCache.at < PROBE_TTL_MS) {
    return { ok: probeCache.ok, version: probeCache.version };
  }
  let ok = false;
  let version = "";
  try {
    const { stdout } = await execFileAsync(BIN, ["--version"], { timeout: 10_000 });
    version = stdout.trim().slice(0, 80);
    ok = true;
  } catch {
    ok = false;
  }
  probeCache = { at: Date.now(), ok, version };
  return { ok, version };
}

// GET — capability probe. The client asks once on load and only shows the `-p`
// profile when this says enabled. Gated too, so an anonymous visitor cannot even
// learn whether the deployer has a Claude CLI.
export async function GET(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json({ enabled: false, reason: "unauthorized" }, { status: 401 });
  }
  if (!ENABLED) {
    return NextResponse.json({ enabled: false, reason: "CLAUDE_P_ENABLED not set" });
  }
  const { ok, version } = await probeCli();
  if (!ok) {
    return NextResponse.json({ enabled: false, reason: `${BIN} not found on PATH` });
  }
  return NextResponse.json({
    enabled: true,
    version,
    models: MODELS,
    cwd: CWD,
    tools: ALLOWED_TOOLS ? ALLOWED_TOOLS.split(",").map((t) => t.trim()).filter(Boolean) : [],
  });
}

type Body = {
  prompt?: string;
  model?: string;
  resume?: string;
  system?: string;
};

// One SSE frame. The CLI's own stream-json vocabulary is normalized here so the
// browser sees the same event shape it gets from the direct backend.
function frame(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json(
      { error: "unauthorized — sign in at /backstage/login" },
      { status: 401 },
    );
  }
  if (!ENABLED) {
    return NextResponse.json(
      { error: "-p mode is off — set CLAUDE_P_ENABLED=1 (see docs/ADDONS.md)" },
      { status: 503 },
    );
  }
  const { ok } = await probeCli();
  if (!ok) {
    return NextResponse.json(
      { error: `Claude CLI not found (${BIN}) — install it or set CLAUDE_P_BIN` },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const prompt = String(body.prompt ?? "");
  if (!prompt.trim()) {
    return NextResponse.json({ error: "empty_prompt" }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json({ error: "prompt_too_long" }, { status: 413 });
  }

  const model = (body.model ?? DEFAULT_MODEL).trim();
  if (!(MODELS as readonly string[]).includes(model)) {
    return NextResponse.json({ error: "unknown_model" }, { status: 400 });
  }

  const resume = (body.resume ?? "").trim();
  if (resume && !UUID_RE.test(resume)) {
    return NextResponse.json({ error: "bad_session_id" }, { status: 400 });
  }

  const permissionMode = process.env.CLAUDE_P_PERMISSION_MODE || "default";
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--model",
    model,
    "--permission-mode",
    PERMISSION_MODES.has(permissionMode) ? permissionMode : "default",
  ];
  if (ALLOWED_TOOLS) args.push("--allowedTools", ALLOWED_TOOLS);
  if (resume) args.push("--resume", resume);
  // A per-turn system prompt (the room's character sheet) rides alongside the
  // CLI's own CLAUDE.md rather than replacing it.
  const system = String(body.system ?? "").trim();
  if (system) args.push("--append-system-prompt", system);

  const child = spawn(BIN, args, {
    cwd: CWD,
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  // The prompt is written to stdin and the pipe closed — it is never an argv
  // entry, so shell metacharacters in it are just characters.
  child.stdin.write(prompt);
  child.stdin.end();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const push = (obj: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(frame(obj)));
        } catch {
          closed = true;
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      // The browser navigating away or hitting stop aborts the request; kill the
      // CLI rather than leaving it running against the subscription.
      req.signal.addEventListener("abort", () => {
        child.kill("SIGTERM");
        finish();
      });

      let outBuf = "";
      let errBuf = "";

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        outBuf += chunk;
        const lines = outBuf.split("\n");
        outBuf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(t) as Record<string, unknown>;
          } catch {
            continue;
          }
          translate(ev, push);
        }
      });

      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        // Keep only the tail: a failing CLI can be chatty and the browser only
        // needs enough to show one honest error line.
        errBuf = (errBuf + chunk).slice(-2000);
      });

      child.on("error", (e) => {
        push({ t: "error", message: `spawn failed: ${e.message}` });
        finish();
      });

      child.on("close", (code) => {
        if (code !== 0) {
          push({
            t: "error",
            message: errBuf.trim() || `claude exited with code ${code}`,
          });
        }
        push({ t: "done" });
        finish();
      });
    },
    cancel() {
      child.kill("SIGTERM");
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// Map one line of the CLI's stream-json onto the room's event vocabulary.
//
// The shapes consumed here (CLI --output-format stream-json):
//   {type:"system", subtype:"init", session_id}            → session id for --resume
//   {type:"stream_event", event:{content_block_delta}}     → text / thinking deltas
//   {type:"assistant", message:{content:[{type:"tool_use"}]}}  → tool started
//   {type:"user", message:{content:[{type:"tool_result"}]}}    → tool finished
//   {type:"result", subtype, usage, total_cost_usd}        → usage + cost
// Anything else is ignored rather than guessed at.
function translate(ev: Record<string, unknown>, push: (o: unknown) => void): void {
  const type = ev.type;

  if (type === "system" && ev.subtype === "init") {
    if (typeof ev.session_id === "string") push({ t: "session", sessionId: ev.session_id });
    return;
  }

  if (type === "stream_event") {
    const inner = ev.event as Record<string, unknown> | undefined;
    if (!inner) return;
    if (inner.type === "content_block_delta") {
      const delta = inner.delta as Record<string, unknown> | undefined;
      if (!delta) return;
      if (delta.type === "text_delta" && typeof delta.text === "string") {
        push({ t: "text", d: delta.text });
      } else if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
        push({ t: "thinking", d: delta.thinking });
      }
    }
    return;
  }

  if (type === "assistant") {
    const msg = ev.message as { content?: unknown[] } | undefined;
    for (const block of msg?.content ?? []) {
      const b = block as Record<string, unknown>;
      if (b.type === "tool_use") {
        push({
          t: "tool",
          id: String(b.id ?? ""),
          name: String(b.name ?? "tool"),
          args: b.input ? JSON.stringify(b.input).slice(0, 4000) : undefined,
          status: "pending",
        });
      }
    }
    return;
  }

  if (type === "user") {
    const msg = ev.message as { content?: unknown[] } | undefined;
    for (const block of msg?.content ?? []) {
      const b = block as Record<string, unknown>;
      if (b.type === "tool_result") {
        const raw = b.content;
        let preview = "";
        if (typeof raw === "string") preview = raw;
        else if (Array.isArray(raw)) {
          preview = raw
            .map((x) => (x as { text?: string })?.text ?? "")
            .join(" ");
        }
        push({
          t: "tool",
          id: String(b.tool_use_id ?? ""),
          status: b.is_error ? "error" : "done",
          preview: preview.replace(/\s+/g, " ").trim().slice(0, 120),
        });
      }
    }
    return;
  }

  if (type === "result") {
    const usage = ev.usage as Record<string, number> | undefined;
    push({
      t: "result",
      subtype: typeof ev.subtype === "string" ? ev.subtype : undefined,
      sessionId: typeof ev.session_id === "string" ? ev.session_id : undefined,
      costUsd: typeof ev.total_cost_usd === "number" ? ev.total_cost_usd : undefined,
      usage: usage
        ? {
            inTok: usage.input_tokens ?? 0,
            outTok: usage.output_tokens ?? 0,
            cacheReadTok: usage.cache_read_input_tokens ?? 0,
            cacheCreateTok: usage.cache_creation_input_tokens ?? 0,
          }
        : undefined,
    });
  }
}
