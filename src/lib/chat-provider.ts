// One interface over the two generation backends.
//
//   direct — the browser calls an OpenAI-compatible or Anthropic endpoint with a
//            key stored in localStorage. The original path, unchanged; the
//            profile list, key handling and model switcher are the same objects
//            they always were. This is what a fresh install uses.
//
//   p      — the browser calls this deployment's /api/p, which runs the Claude
//            CLI on the machine hosting the room. Generation happens inside the
//            operator's own Claude session: its CLAUDE.md, its MCP servers, its
//            subscription. Nothing about that configuration lives in this
//            repository. Off unless the deployer sets CLAUDE_P_ENABLED=1.
//
// kimi-core RAG is orthogonal to both. It supplies retrieved memory to the
// prompt; either provider can be used with or without it.
//
// The chat UI holds a ChatProvider and never branches on which one it is —
// picking a profile in the model switcher picks the provider.

import {
  friendlyLLMError,
  getActiveProfile,
  llmChat,
  loadLLMSettings,
  type ChatMessage as LLMChatMessage,
  type LLMSettings,
} from "@/lib/llm-client";

export type ProviderKind = "direct" | "p";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ToolEvent = {
  id: string;
  name: string;
  arguments?: string;
  preview?: string;
  status: "pending" | "done" | "error";
  ms?: number;
};

export type Usage = {
  inTok: number;
  outTok: number;
  cacheReadTok?: number;
  cacheCreateTok?: number;
  costUsd?: number;
};

export type ProviderEvent =
  | { type: "text"; delta: string }
  | { type: "thinking"; delta: string }
  | { type: "tool"; tool: ToolEvent }
  | { type: "session"; sessionId: string };

export type SendOpts = {
  system?: string;
  signal?: AbortSignal;
  onEvent?: (e: ProviderEvent) => void;
  /** -p only: the CLI session to continue, so a thread keeps its context. */
  resumeId?: string;
};

export type SendResult = {
  text: string;
  thinking?: string;
  usage?: Usage;
  tools?: ToolEvent[];
  /** -p only: the CLI session id to store on the thread for the next turn. */
  sessionId?: string;
};

export interface ChatProvider {
  kind: ProviderKind;
  /** Profile id, for matching against the settings list. */
  id: string;
  /** What the model switcher shows. */
  label: string;
  model: string;
  send(turns: ChatTurn[], opts: SendOpts): Promise<SendResult>;
}

// ============================================
// -p capability probe
// ============================================

export type PCapability = {
  enabled: boolean;
  version?: string;
  models?: string[];
  cwd?: string;
  tools?: string[];
  reason?: string;
};

const P_PROFILE_ID = "p-cli";

/** Only used if the probe answered without a model list; the real one is the
  * route's allowlist. */
const FALLBACK_MODEL = "claude-sonnet-5";

let pCapCache: PCapability | null = null;
let pCapInFlight: Promise<PCapability> | null = null;

/**
 * Ask the server whether -p exists here. Cached for the page's lifetime: the
 * answer depends on env and an installed binary, neither of which changes while
 * someone is chatting. A 401 (no owner session) reads as "not available", which
 * is the correct answer for a visitor — the option is absent, not greyed out.
 */
export async function probeP(): Promise<PCapability> {
  if (pCapCache) return pCapCache;
  if (pCapInFlight) return pCapInFlight;
  pCapInFlight = fetch("/api/p", { method: "GET" })
    .then((r) => r.json() as Promise<PCapability>)
    .catch(() => ({ enabled: false, reason: "probe failed" }))
    .then((c) => {
      pCapCache = c;
      pCapInFlight = null;
      return c;
    });
  return pCapInFlight;
}

export function isPProfileId(id: string): boolean {
  return id === P_PROFILE_ID;
}

/** The synthetic profile the switcher lists when -p is available. */
export function pProfile(cap: PCapability): {
  id: string;
  name: string;
  format: string;
  models: string[];
} {
  return {
    id: P_PROFILE_ID,
    name: "claude -p · 本机",
    format: "cli",
    models: cap.models ?? [FALLBACK_MODEL],
  };
}

// ============================================
// direct
// ============================================

function directProvider(settings: LLMSettings): ChatProvider | null {
  const profile = getActiveProfile(settings);
  if (!profile) return null;
  const model = settings.activeModel || profile.models[0] || "";
  return {
    kind: "direct",
    id: profile.id,
    label: `${profile.name || "未命名"} · ${model || "no model"}`,
    model,
    async send(turns, opts) {
      const msgs: LLMChatMessage[] = [];
      if (opts.system) msgs.push({ role: "system", content: opts.system });
      for (const t of turns) msgs.push({ role: t.role, content: t.content });
      const r = await llmChat(msgs, {
        signal: opts.signal,
        onEvent: opts.onEvent
          ? (e) =>
              opts.onEvent!(
                e.type === "text"
                  ? { type: "text", delta: e.delta }
                  : { type: "thinking", delta: e.delta },
              )
          : undefined,
      });
      return { text: r.text, thinking: r.thinking, usage: r.usage };
    },
  };
}

// ============================================
// -p
// ============================================

// The CLI takes a single prompt, not a message array. A resumed session already
// holds the earlier turns, so only the new message is sent; a fresh session gets
// the transcript inlined so the first reply is not context-blind.
function flattenTurns(turns: ChatTurn[], resuming: boolean): string {
  if (resuming) {
    const last = [...turns].reverse().find((t) => t.role === "user");
    return last?.content ?? turns[turns.length - 1]?.content ?? "";
  }
  if (turns.length === 1) return turns[0].content;
  const body = turns
    .slice(0, -1)
    .map((t) => `${t.role === "user" ? "对方" : "你"}: ${t.content}`)
    .join("\n\n");
  const last = turns[turns.length - 1];
  return `以下是之前的对话:\n\n${body}\n\n---\n\n${last.content}`;
}

function pProvider(model: string): ChatProvider {
  return {
    kind: "p",
    id: P_PROFILE_ID,
    label: `claude -p · ${model}`,
    model,
    async send(turns, opts) {
      const res = await fetch("/api/p", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: flattenTurns(turns, !!opts.resumeId),
          model,
          resume: opts.resumeId || undefined,
          system: opts.system || undefined,
        }),
        signal: opts.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`-p request failed (${res.status}): ${detail.slice(0, 200)}`);
      }

      let text = "";
      let thinking = "";
      let usage: Usage | undefined;
      let sessionId: string | undefined;
      let failure: string | undefined;
      const tools = new Map<string, ToolEvent>();
      const startedAt: Record<string, number> = {};

      await readSSE(res, (payload) => {
        let ev: Record<string, unknown>;
        try {
          ev = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          return;
        }
        switch (ev.t) {
          case "text": {
            const d = String(ev.d ?? "");
            text += d;
            opts.onEvent?.({ type: "text", delta: d });
            break;
          }
          case "thinking": {
            const d = String(ev.d ?? "");
            thinking += d;
            opts.onEvent?.({ type: "thinking", delta: d });
            break;
          }
          case "session": {
            sessionId = String(ev.sessionId ?? "");
            if (sessionId) opts.onEvent?.({ type: "session", sessionId });
            break;
          }
          case "tool": {
            const id = String(ev.id ?? "");
            if (!id) break;
            const prior = tools.get(id);
            if (ev.status === "pending") {
              startedAt[id] = Date.now();
              const t: ToolEvent = {
                id,
                name: String(ev.name ?? "tool"),
                arguments: typeof ev.args === "string" ? ev.args : undefined,
                status: "pending",
              };
              tools.set(id, t);
              opts.onEvent?.({ type: "tool", tool: t });
            } else {
              const t: ToolEvent = {
                id,
                name: prior?.name ?? String(ev.name ?? "tool"),
                arguments: prior?.arguments,
                status: ev.status === "error" ? "error" : "done",
                preview: typeof ev.preview === "string" ? ev.preview : prior?.preview,
                ms: startedAt[id] ? Date.now() - startedAt[id] : undefined,
              };
              tools.set(id, t);
              opts.onEvent?.({ type: "tool", tool: t });
            }
            break;
          }
          case "result": {
            const u = ev.usage as Usage | undefined;
            if (u) {
              usage = {
                inTok: u.inTok ?? 0,
                outTok: u.outTok ?? 0,
                cacheReadTok: u.cacheReadTok,
                cacheCreateTok: u.cacheCreateTok,
                costUsd: typeof ev.costUsd === "number" ? ev.costUsd : undefined,
              };
            } else if (typeof ev.costUsd === "number") {
              usage = { inTok: 0, outTok: 0, costUsd: ev.costUsd };
            }
            if (typeof ev.sessionId === "string" && ev.sessionId) sessionId = ev.sessionId;
            break;
          }
          case "error": {
            failure = String(ev.message ?? "claude -p failed");
            break;
          }
        }
      });

      // A CLI failure with no text at all is an error, not an empty reply.
      // Partial text plus a failure keeps the text and drops the noise.
      if (failure && !text.trim()) throw new Error(failure);

      return {
        text,
        thinking: thinking || undefined,
        usage,
        sessionId,
        tools: tools.size ? [...tools.values()] : undefined,
      };
    },
  };
}

async function readSSE(res: Response, onData: (json: string) => void): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("stream body unavailable");
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload) onData(payload);
    }
  }
}

// ============================================
// resolve
// ============================================

const ACTIVE_KIND_KEY = "kimi-chat:provider";

/** Which backend the switcher last selected. */
export function readActiveProviderChoice(): { kind: ProviderKind; model: string } {
  if (typeof window === "undefined") return { kind: "direct", model: "" };
  try {
    const raw = localStorage.getItem(ACTIVE_KIND_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { kind?: string; model?: string };
      if (p.kind === "p") return { kind: "p", model: p.model || FALLBACK_MODEL };
    }
  } catch {}
  return { kind: "direct", model: "" };
}

export function writeActiveProviderChoice(kind: ProviderKind, model: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_KIND_KEY, JSON.stringify({ kind, model }));
  } catch {}
}

/**
 * The provider the next turn should use. Returns null when nothing is usable —
 * no API key on the direct side and no -p available — which the UI turns into
 * the "configure a backend" prompt rather than a failed request.
 */
export function resolveProvider(cap: PCapability | null): ChatProvider | null {
  const choice = readActiveProviderChoice();
  if (choice.kind === "p") {
    if (cap?.enabled) {
      const models = cap.models ?? [FALLBACK_MODEL];
      return pProvider(models.includes(choice.model) ? choice.model : models[0]);
    }
    // -p was selected but is gone (env off, CLI uninstalled, session expired).
    // Fall through to direct rather than failing the send.
  }
  return directProvider(loadLLMSettings());
}

export function isProviderConfigured(cap: PCapability | null): boolean {
  const choice = readActiveProviderChoice();
  if (choice.kind === "p" && cap?.enabled) return true;
  return !!getActiveProfile()?.apiKey;
}

export { friendlyLLMError };
