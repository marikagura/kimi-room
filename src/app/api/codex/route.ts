import { NextResponse } from "next/server";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { isAuthed } from "@/lib/stores/owner-session";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Codex generation backend — the sibling of /api/p, for the other vendor's CLI.
//
// It exists as its own route rather than an env switch on /api/p because the two
// CLIs share nothing but the idea. Codex runs as `codex exec --json`, not `-p`
// (its own `-p` is `--profile`), and reports thread.started / item.completed /
// turn.completed rather than Claude's stream_event vocabulary. One route trying
// to be both would be a branch at every line.
//
// What they do share, deliberately, is the trust boundary and the frames sent to
// the browser — the client cannot tell which CLI answered:
//   1. Owner session required before anything else.
//   2. No shell: spawn() with an argv array, prompt over stdin, never in argv.
//      `model` is matched against the configured list and `resume` against a
//      UUID shape; anything else is rejected rather than cleaned up.
//   3. Sandboxed by default (read-only), because nobody is at the terminal to
//      approve anything.
//
// Two differences are visible in the room and worth knowing before choosing it:
//   · No token-level streaming. `--json` emits whole items, so a reply lands in
//     one piece instead of arriving a character at a time.
//   · Cache is reported on every turn (cached_input_tokens), so the MEMORIA
//     gauge is actually fed — most raw API endpoints never report it.
//
// env:
//   CODEX_ENABLED=1   opt in. Unset → the mode does not exist (GET says
//                     enabled:false and the UI never lists it).
//   CODEX_BIN         path to the CLI (default: "codex" on PATH)
//   CODEX_CWD         working directory (default: the user's home)
//   CODEX_MODELS      comma list offered in the switcher. Empty by default, which
//                     means "whatever ~/.codex/config.toml says" — this repo has
//                     no way to know which models an account can reach, and a
//                     guessed list would just be a menu of errors.
//   CODEX_SANDBOX     read-only (default) | workspace-write | danger-full-access.
//                     Past read-only the chat can write real files.

const ENABLED = process.env.CODEX_ENABLED === "1";
const BIN = process.env.CODEX_BIN || "codex";
const CWD = process.env.CODEX_CWD || homedir();
const MODELS = (process.env.CODEX_MODELS ?? "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const SANDBOXES = new Set(["read-only", "workspace-write", "danger-full-access"]);
const SANDBOX = SANDBOXES.has(process.env.CODEX_SANDBOX ?? "")
  ? (process.env.CODEX_SANDBOX as string)
  : "read-only";

/** Codex's thread id. It reaches argv via `exec resume`, so the shape is checked. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_PROMPT_CHARS = 200_000;

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

export async function GET(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json({ enabled: false, reason: "unauthorized" }, { status: 401 });
  }
  if (!ENABLED) {
    return NextResponse.json({ enabled: false, reason: "CODEX_ENABLED not set" });
  }
  const { ok, version } = await probeCli();
  if (!ok) {
    return NextResponse.json({ enabled: false, reason: `${BIN} not found on PATH` });
  }
  return NextResponse.json({
    enabled: true,
    version,
    // Empty means the CLI's own configured default; the switcher shows one row.
    models: MODELS,
    cwd: CWD,
    sandbox: SANDBOX,
    streaming: false,
  });
}

type Body = {
  prompt?: string;
  model?: string;
  resume?: string;
  system?: string;
  /** Maps to Codex's model_reasoning_effort config key. */
  effort?: string;
};

const EFFORTS = new Set(["low", "medium", "high", "xhigh"]);

function frame(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

/**
 * Codex's JSONL turned into the frames the browser already reads.
 *
 * Its items arrive whole rather than as deltas, so an agent_message is pushed as
 * one `text` frame — the client appends, which makes a single append correct.
 */
function translate(ev: Record<string, unknown>, push: (o: unknown) => void): void {
  const type = ev.type;

  if (type === "thread.started") {
    if (typeof ev.thread_id === "string") push({ t: "session", sessionId: ev.thread_id });
    return;
  }

  if (type === "item.started" || type === "item.completed") {
    const item = ev.item as Record<string, unknown> | undefined;
    if (!item) return;
    const kind = item.type;
    const id = String(item.id ?? "");
    const done = type === "item.completed";

    if (kind === "agent_message") {
      if (done && typeof item.text === "string") push({ t: "text", d: item.text });
      return;
    }

    if (kind === "reasoning") {
      const text = typeof item.text === "string" ? item.text : "";
      if (done && text) push({ t: "thinking", d: text });
      return;
    }

    if (kind === "command_execution") {
      const cmd = typeof item.command === "string" ? item.command : "";
      const failed = typeof item.exit_code === "number" && item.exit_code !== 0;
      push({
        t: "tool",
        id,
        name: "shell",
        args: cmd ? JSON.stringify({ command: cmd }).slice(0, 4000) : undefined,
        status: done ? (failed ? "error" : "done") : "pending",
        preview: done
          ? String(item.aggregated_output ?? "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 120)
          : undefined,
      });
      return;
    }

    // Anything else Codex grows later (file changes, MCP calls, web search) still
    // gets a row rather than vanishing: the name is whatever it called itself.
    push({
      t: "tool",
      id,
      name: String(kind ?? "item"),
      status: done ? "done" : "pending",
    });
    return;
  }

  if (type === "turn.completed") {
    const usage = ev.usage as Record<string, number> | undefined;
    push({
      t: "result",
      usage: usage
        ? {
            inTok: usage.input_tokens ?? 0,
            outTok: usage.output_tokens ?? 0,
            cacheReadTok: usage.cached_input_tokens ?? 0,
            cacheCreateTok: 0,
          }
        : undefined,
    });
    return;
  }

  if (type === "turn.failed" || type === "error") {
    const err = ev.error as { message?: string } | undefined;
    push({ t: "error", message: err?.message ?? "codex turn failed" });
  }
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
      { error: "codex mode is off — set CODEX_ENABLED=1" },
      { status: 503 },
    );
  }
  const { ok } = await probeCli();
  if (!ok) {
    return NextResponse.json(
      { error: `Codex CLI not found (${BIN}) — install it or set CODEX_BIN` },
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

  // Allowlist, not sanitize. With no list configured nothing is passed and the
  // CLI uses its own default, so an unrecognised value is still refused rather
  // than silently ignored.
  const model = (body.model ?? "").trim();
  if (model && !MODELS.includes(model)) {
    return NextResponse.json({ error: "unknown_model" }, { status: 400 });
  }

  const resume = (body.resume ?? "").trim();
  if (resume && !UUID_RE.test(resume)) {
    return NextResponse.json({ error: "bad_session_id" }, { status: 400 });
  }

  const effort = (body.effort ?? "").trim();
  if (effort && !EFFORTS.has(effort)) {
    return NextResponse.json({ error: "unknown_effort" }, { status: 400 });
  }

  // `-` for the prompt means "read it from stdin", which is the whole point:
  // nothing the browser typed becomes an argv entry.
  const args = resume ? ["exec", "resume", resume, "-"] : ["exec", "-"];
  args.push("--json", "--skip-git-repo-check");
  // Sandbox goes in as a config override rather than `-s`: `exec resume` is its
  // own subcommand and does not take `-s`, so the flag form works on a first
  // turn and then fails on every turn after it. One form for both paths.
  args.push("-c", `sandbox_mode="${SANDBOX}"`);
  if (model) args.push("-m", model);
  if (effort) args.push("-c", `model_reasoning_effort="${effort}"`);

  // Codex has no --append-system-prompt; a per-turn system message rides in
  // front of the prompt instead, which is where the CLI would have put it.
  const system = String(body.system ?? "").trim();
  const stdinText = system ? `${system}\n\n---\n\n${prompt}` : prompt;

  const child = spawn(BIN, args, {
    cwd: CWD,
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  child.stdin.write(stdinText);
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
          // Codex prints human lines to stdout too ("Reading additional input…"),
          // so anything that is not a JSON object is skipped rather than logged
          // as an error.
          if (!t.startsWith("{")) continue;
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
        errBuf = (errBuf + chunk).slice(-2000);
      });

      child.on("error", (e) => {
        push({ t: "error", message: `spawn failed: ${e.message}` });
        finish();
      });

      child.on("close", (code) => {
        if (code !== 0) {
          push({ t: "error", message: errBuf.trim() || `codex exited with code ${code}` });
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
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
