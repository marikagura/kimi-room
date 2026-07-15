// V3 LLM API client · reusable across surfaces.
//
// 设计 (owner 0525 ack · 0716 profiles+streaming 扩展):
// - Provider profiles: 多档案 {name, format, endpoint, key, models[]}, localStorage
//   存, 一份 JSON (`kimi-llm-settings`). DeepSeek 一条 / Claude 一条 / OpenRouter
//   一条 — chat 里下拉切, 不用回 settings 改字段.
// - 两种 wire format:
//   · openai    — chat completions (OpenAI / OpenRouter / DeepSeek / Together /
//                 vLLM / Ollama / 任何 OpenAI-compat)
//   · anthropic — Messages API 原生直连 (CORS 走
//                 anthropic-dangerous-direct-browser-access header, 不用 proxy)
// - Streaming: opts.onEvent 提供即走 SSE (text / thinking delta); 端点拒绝流式
//   (4xx) 自动退回非流式一次. opts.signal 可 abort.
// - 采样参数 (temperature / maxTokens / topP) 全局持久化, per-call opts 覆盖.
// - 旧版三 key (kimi-llm-api-key / -endpoint / -model) 首次读取时自动迁移成
//   第一条档案, 旧 key 保留不删 (降级可回).
// - 调用面兼容: llmChat / llmGenerate / llmGenerateWithImage / isLLMConfigured
//   签名不变, 内部走 active profile.
//
// 官端 closed SaaS 用户 (ChatGPT app / Claude.ai) 路径: 不调 API, 用 manual
// 输入 archive · /chat 入口 fallback "configure LLM key in settings" prompt.

// ============================================
// storage
// ============================================

const SETTINGS_KEY = "kimi-llm-settings";

// legacy V2 keys (migrated on first load, kept in place)
const KEY_API_KEY = "kimi-llm-api-key";
const KEY_ENDPOINT = "kimi-llm-endpoint";
const KEY_MODEL = "kimi-llm-model";

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

export type ProviderFormat = "openai" | "anthropic";

export type ProviderProfile = {
  id: string;
  name: string; // "DeepSeek" / "OpenRouter" / 自定义
  format: ProviderFormat;
  endpoint: string; // base URL 或完整路径, normalize 兼容两种写法
  apiKey: string;
  models: string[]; // 该档案下可选模型 (手填或「拉取模型」填充)
};

export type LLMParams = {
  temperature: number;
  maxTokens: number;
  topP?: number; // undefined = 不发
};

export type LLMSettings = {
  profiles: ProviderProfile[];
  activeProfileId: string;
  activeModel: string;
  params: LLMParams;
};

export const DEFAULT_PARAMS: LLMParams = { temperature: 0.7, maxTokens: 1024 };

function emptySettings(): LLMSettings {
  return {
    profiles: [],
    activeProfileId: "",
    activeModel: "",
    params: { ...DEFAULT_PARAMS },
  };
}

function readLS(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

// endpoint hostname → 可读档案名 (迁移 + settings「新档案」占位用)
export function guessProviderName(endpoint: string): string {
  const h = endpoint.toLowerCase();
  if (h.includes("openrouter")) return "OpenRouter";
  if (h.includes("deepseek")) return "DeepSeek";
  if (h.includes("anthropic")) return "Anthropic";
  if (h.includes("openai")) return "OpenAI";
  if (h.includes("together")) return "Together";
  if (h.includes("moonshot")) return "Moonshot";
  if (h.includes("localhost") || h.includes("127.0.0.1")) return "Local";
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "Provider";
  }
}

export function newProfileId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Load settings. Migrates legacy single-config keys into profile #1 the first
// time (new key absent + any legacy key present); legacy keys left untouched.
export function loadLLMSettings(): LLMSettings {
  if (typeof window === "undefined") return emptySettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LLMSettings>;
      const s = emptySettings();
      if (Array.isArray(parsed.profiles)) {
        s.profiles = parsed.profiles.filter(
          (p): p is ProviderProfile => !!p && typeof p.id === "string",
        );
        for (const p of s.profiles) {
          if (p.format !== "anthropic") p.format = "openai";
          if (!Array.isArray(p.models)) p.models = [];
        }
      }
      if (typeof parsed.activeProfileId === "string") s.activeProfileId = parsed.activeProfileId;
      if (typeof parsed.activeModel === "string") s.activeModel = parsed.activeModel;
      if (parsed.params) {
        if (typeof parsed.params.temperature === "number") s.params.temperature = parsed.params.temperature;
        if (typeof parsed.params.maxTokens === "number") s.params.maxTokens = parsed.params.maxTokens;
        if (typeof parsed.params.topP === "number") s.params.topP = parsed.params.topP;
      }
      return s;
    }
  } catch {}

  // migrate legacy V2 single config → profile #1
  const legacyKey = readLS(KEY_API_KEY);
  const legacyEndpoint = readLS(KEY_ENDPOINT);
  const legacyModel = readLS(KEY_MODEL);
  const s = emptySettings();
  if (legacyKey || legacyEndpoint || legacyModel) {
    const endpoint = legacyEndpoint || DEFAULT_ENDPOINT;
    const model = legacyModel || DEFAULT_MODEL;
    const profile: ProviderProfile = {
      id: newProfileId(),
      name: guessProviderName(endpoint),
      format: "openai",
      endpoint,
      apiKey: legacyKey,
      models: model ? [model] : [],
    };
    s.profiles = [profile];
    s.activeProfileId = profile.id;
    s.activeModel = model;
    saveLLMSettings(s);
  }
  return s;
}

export function saveLLMSettings(s: LLMSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

export function getActiveProfile(s?: LLMSettings): ProviderProfile | null {
  const st = s ?? loadLLMSettings();
  if (!st.profiles.length) return null;
  return st.profiles.find((p) => p.id === st.activeProfileId) ?? st.profiles[0];
}

// chat 切换器用: 切换当前档案 + 模型, 一次写盘
export function setActiveModel(profileId: string, model: string): void {
  const s = loadLLMSettings();
  s.activeProfileId = profileId;
  s.activeModel = model;
  saveLLMSettings(s);
}

// ============================================
// V2 compat shims (settings 老代码 + 各 surface 的 isLLMConfigured)
// ============================================

export type LLMConfig = {
  apiKey: string;
  endpoint: string;
  model: string;
};

// Legacy view over the active profile. Prefer loadLLMSettings/getActiveProfile.
export function getLLMConfig(): LLMConfig {
  const s = loadLLMSettings();
  const p = getActiveProfile(s);
  if (!p) return { apiKey: "", endpoint: DEFAULT_ENDPOINT, model: DEFAULT_MODEL };
  return {
    apiKey: p.apiKey,
    endpoint: p.endpoint || DEFAULT_ENDPOINT,
    model: s.activeModel || p.models[0] || DEFAULT_MODEL,
  };
}

// Legacy write — updates the active profile in place (creates one if none).
export function setLLMConfig(c: Partial<LLMConfig>): void {
  const s = loadLLMSettings();
  let p = getActiveProfile(s);
  if (!p) {
    p = {
      id: newProfileId(),
      name: guessProviderName(c.endpoint || DEFAULT_ENDPOINT),
      format: "openai",
      endpoint: c.endpoint || DEFAULT_ENDPOINT,
      apiKey: c.apiKey ?? "",
      models: c.model ? [c.model] : [],
    };
    s.profiles.push(p);
    s.activeProfileId = p.id;
    s.activeModel = c.model ?? "";
    saveLLMSettings(s);
    return;
  }
  if (c.apiKey !== undefined) p.apiKey = c.apiKey.trim();
  if (c.endpoint !== undefined) p.endpoint = c.endpoint.trim();
  if (c.model !== undefined) {
    const m = c.model.trim();
    s.activeModel = m;
    if (m && !p.models.includes(m)) p.models.push(m);
  }
  saveLLMSettings(s);
}

export function isLLMConfigured(): boolean {
  return !!getActiveProfile()?.apiKey;
}

// ============================================
// URL normalize
// ============================================

// 用户可能填 base (https://api.deepseek.com / https://openrouter.ai/api/v1) 或
// 完整路径 — 两种都收.
function chatUrl(p: ProviderProfile): string {
  const e = p.endpoint.trim().replace(/\/+$/, "");
  if (p.format === "anthropic") {
    return e.endsWith("/v1/messages") ? e : `${e}/v1/messages`;
  }
  return e.endsWith("/chat/completions") ? e : `${e}/chat/completions`;
}

function modelsUrl(p: ProviderProfile): string {
  const e = p.endpoint.trim().replace(/\/+$/, "");
  if (p.format === "anthropic") {
    return e.endsWith("/v1/messages")
      ? e.replace(/\/v1\/messages$/, "/v1/models")
      : `${e}/v1/models`;
  }
  return e.endsWith("/chat/completions")
    ? e.replace(/\/chat\/completions$/, "/models")
    : `${e}/models`;
}

function buildHeaders(p: ProviderProfile): Record<string, string> {
  if (p.format === "anthropic") {
    return {
      "Content-Type": "application/json",
      "x-api-key": p.apiKey,
      "anthropic-version": "2023-06-01",
      // Anthropic 官方 CORS 开关 — 浏览器直连必须带
      "anthropic-dangerous-direct-browser-access": "true",
    };
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${p.apiKey}`,
  };
}

// GET /models → 模型名列表 (openai: {data:[{id}]}, anthropic: {data:[{id}]})
export async function fetchModels(profile: ProviderProfile): Promise<string[]> {
  const res = await fetch(modelsUrl(profile), {
    method: "GET",
    headers: buildHeaders(profile),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`models request failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as { data?: { id?: string }[] };
  const ids = (data.data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return [...new Set(ids)].sort();
}

// ============================================
// chat
// ============================================

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "thinking"; delta: string };

export type ChatOptions = {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  signal?: AbortSignal;
  // 提供 onEvent 即走 SSE streaming; 端点拒绝流式时自动退回非流式一次
  onEvent?: (e: StreamEvent) => void;
};

export type ChatResult = {
  text: string;
  thinking?: string;
  usage?: { inTok: number; outTok: number };
  raw?: unknown;
};

function resolveParams(opts: ChatOptions): Required<Pick<LLMParams, "temperature" | "maxTokens">> & { topP?: number } {
  const saved = loadLLMSettings().params;
  return {
    temperature: opts.temperature ?? saved.temperature ?? DEFAULT_PARAMS.temperature,
    maxTokens: opts.maxTokens ?? saved.maxTokens ?? DEFAULT_PARAMS.maxTokens,
    topP: opts.topP ?? saved.topP,
  };
}

function requireProfile(): { profile: ProviderProfile; model: string } {
  const s = loadLLMSettings();
  const profile = getActiveProfile(s);
  if (!profile || !profile.apiKey) {
    throw new Error("LLM API key not configured. Open settings → fill API key.");
  }
  const model = s.activeModel || profile.models[0] || DEFAULT_MODEL;
  return { profile, model };
}

// anthropic Messages API: system 是顶层字段, messages 只收 user/assistant
function splitSystem(messages: ChatMessage[]): {
  system: string;
  turns: { role: "user" | "assistant"; content: unknown }[];
} {
  const sys: string[] = [];
  const turns: { role: "user" | "assistant"; content: unknown }[] = [];
  for (const m of messages) {
    if (m.role === "system") sys.push(m.content);
    else turns.push({ role: m.role, content: m.content });
  }
  return { system: sys.join("\n\n"), turns };
}

async function throwHttpError(res: Response, label: string): Promise<never> {
  const errText = await res.text().catch(() => "");
  throw new Error(`${label} (${res.status}): ${errText.slice(0, 200)}`);
}

// ---- non-streaming ----

async function chatOnce(
  profile: ProviderProfile,
  model: string,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<ChatResult> {
  const p = resolveParams(opts);
  if (profile.format === "anthropic") {
    const { system, turns } = splitSystem(messages);
    const body: Record<string, unknown> = {
      model,
      messages: turns,
      max_tokens: p.maxTokens,
      temperature: p.temperature,
      stream: false,
    };
    if (system) body.system = system;
    if (p.topP !== undefined) body.top_p = p.topP;
    const res = await fetch(chatUrl(profile), {
      method: "POST",
      headers: buildHeaders(profile),
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) await throwHttpError(res, "LLM request failed");
    const data = (await res.json()) as {
      content?: { type?: string; text?: string; thinking?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const thinking = (data.content ?? [])
      .filter((b) => b.type === "thinking")
      .map((b) => b.thinking ?? "")
      .join("");
    const usage = data.usage
      ? { inTok: data.usage.input_tokens ?? 0, outTok: data.usage.output_tokens ?? 0 }
      : undefined;
    return { text, thinking: thinking || undefined, usage, raw: data };
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: p.temperature,
    max_tokens: p.maxTokens,
    stream: false,
  };
  if (p.topP !== undefined) body.top_p = p.topP;
  const res = await fetch(chatUrl(profile), {
    method: "POST",
    headers: buildHeaders(profile),
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) await throwHttpError(res, "LLM request failed");
  const data = (await res.json()) as {
    choices?: { message?: { content?: string; reasoning_content?: string; reasoning?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const msg = data.choices?.[0]?.message;
  const usage = data.usage
    ? { inTok: data.usage.prompt_tokens ?? 0, outTok: data.usage.completion_tokens ?? 0 }
    : undefined;
  return {
    text: msg?.content ?? "",
    thinking: msg?.reasoning_content || msg?.reasoning || undefined,
    usage,
    raw: data,
  };
}

// ---- streaming ----

// data: 行的增量 SSE reader. per-line callback, [DONE] 由调用方识别.
async function readSSE(
  res: Response,
  onData: (json: string) => void,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("stream body unavailable");
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // SSE 事件以空行分隔; 逐行取 data: 前缀
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? ""; // 尾部半行留到下一轮
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload) onData(payload);
    }
  }
}

async function chatStream(
  profile: ProviderProfile,
  model: string,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<ChatResult> {
  const p = resolveParams(opts);
  const onEvent = opts.onEvent!;
  let text = "";
  let thinking = "";
  let usage: ChatResult["usage"];

  if (profile.format === "anthropic") {
    const { system, turns } = splitSystem(messages);
    const body: Record<string, unknown> = {
      model,
      messages: turns,
      max_tokens: p.maxTokens,
      temperature: p.temperature,
      stream: true,
    };
    if (system) body.system = system;
    if (p.topP !== undefined) body.top_p = p.topP;
    const res = await fetch(chatUrl(profile), {
      method: "POST",
      headers: buildHeaders(profile),
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) await throwHttpError(res, "LLM stream failed");
    let inTok = 0;
    let outTok = 0;
    await readSSE(res, (payload) => {
      try {
        const ev = JSON.parse(payload) as {
          type?: string;
          message?: { usage?: { input_tokens?: number } };
          usage?: { output_tokens?: number };
          delta?: { type?: string; text?: string; thinking?: string };
        };
        if (ev.type === "message_start") {
          inTok = ev.message?.usage?.input_tokens ?? 0;
        } else if (ev.type === "content_block_delta") {
          if (ev.delta?.type === "text_delta" && ev.delta.text) {
            text += ev.delta.text;
            onEvent({ type: "text", delta: ev.delta.text });
          } else if (ev.delta?.type === "thinking_delta" && ev.delta.thinking) {
            thinking += ev.delta.thinking;
            onEvent({ type: "thinking", delta: ev.delta.thinking });
          }
        } else if (ev.type === "message_delta") {
          outTok = ev.usage?.output_tokens ?? outTok;
        }
      } catch {}
    });
    if (inTok || outTok) usage = { inTok, outTok };
    return { text, thinking: thinking || undefined, usage };
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: p.temperature,
    max_tokens: p.maxTokens,
    stream: true,
    // 最后一个 chunk 带 usage (OpenAI / DeepSeek / OpenRouter / vLLM 都认;
    // 不认的端点在 fallback 路径里覆盖)
    stream_options: { include_usage: true },
  };
  if (p.topP !== undefined) body.top_p = p.topP;
  const res = await fetch(chatUrl(profile), {
    method: "POST",
    headers: buildHeaders(profile),
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) await throwHttpError(res, "LLM stream failed");
  await readSSE(res, (payload) => {
    if (payload === "[DONE]") return;
    try {
      const ev = JSON.parse(payload) as {
        choices?: {
          delta?: { content?: string; reasoning_content?: string; reasoning?: string };
        }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
      };
      const delta = ev.choices?.[0]?.delta;
      if (delta?.content) {
        text += delta.content;
        onEvent({ type: "text", delta: delta.content });
      }
      // DeepSeek R1 系 reasoning_content · OpenRouter 统一 reasoning
      const think = delta?.reasoning_content || delta?.reasoning;
      if (think) {
        thinking += think;
        onEvent({ type: "thinking", delta: think });
      }
      if (ev.usage) {
        usage = {
          inTok: ev.usage.prompt_tokens ?? 0,
          outTok: ev.usage.completion_tokens ?? 0,
        };
      }
    } catch {}
  });
  return { text, thinking: thinking || undefined, usage };
}

// 统一入口. opts.onEvent 有 → streaming (端点 4xx 拒绝时退回非流式一次).
export async function llmChat(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<ChatResult> {
  const { profile, model } = requireProfile();
  if (opts.onEvent) {
    try {
      return await chatStream(profile, model, messages, opts);
    } catch (e) {
      // aborted → 原样抛给调用方; 4xx (端点不支持 stream / stream_options) → 退回非流式
      if ((e as Error)?.name === "AbortError") throw e;
      const msg = (e as Error)?.message ?? "";
      const is4xx = /\(4\d\d\)/.test(msg);
      if (!is4xx) throw e;
      const r = await chatOnce(profile, model, messages, opts);
      if (r.thinking) opts.onEvent({ type: "thinking", delta: r.thinking });
      if (r.text) opts.onEvent({ type: "text", delta: r.text });
      return r;
    }
  }
  return chatOnce(profile, model, messages, opts);
}

// Convenience · single-shot prompt → text (system + user message format).
export async function llmGenerate(
  prompt: string,
  system?: string,
  opts?: ChatOptions,
): Promise<string> {
  const messages: ChatMessage[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  const r = await llmChat(messages, opts);
  return r.text;
}

// ============================================
// vision
// ============================================

// V2 vision · owner 0518 disc auto-parse screenshot. openai 档案走 image_url,
// anthropic 档案转 base64 source block. 不支持 vision 的 model 会 400 —
// 调用方 catch fallback.
export async function llmGenerateWithImage(
  prompt: string,
  imageDataUrl: string,
  system?: string,
  opts?: ChatOptions,
): Promise<string> {
  const { profile, model } = requireProfile();
  const p = resolveParams(opts ?? {});

  if (profile.format === "anthropic") {
    // data:image/png;base64,xxx → source block
    const m = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error("vision: expected base64 data URL");
    const turns = [
      {
        role: "user" as const,
        content: [
          { type: "text", text: prompt },
          {
            type: "image",
            source: { type: "base64", media_type: m[1], data: m[2] },
          },
        ],
      },
    ];
    const body: Record<string, unknown> = {
      model,
      messages: turns,
      max_tokens: opts?.maxTokens ?? 2048,
      temperature: opts?.temperature ?? 0.3,
      stream: false,
    };
    if (system) body.system = system;
    const res = await fetch(chatUrl(profile), {
      method: "POST",
      headers: buildHeaders(profile),
      body: JSON.stringify(body),
      signal: opts?.signal,
    });
    if (!res.ok) await throwHttpError(res, "vision request failed");
    const data = (await res.json()) as {
      content?: { type?: string; text?: string }[];
    };
    return (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
  }

  const userContent = [
    { type: "text" as const, text: prompt },
    { type: "image_url" as const, image_url: { url: imageDataUrl } },
  ];
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: userContent });
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.maxTokens ?? 2048,
    stream: false,
  };
  if (p.topP !== undefined) body.top_p = p.topP;
  const res = await fetch(chatUrl(profile), {
    method: "POST",
    headers: buildHeaders(profile),
    body: JSON.stringify(body),
    signal: opts?.signal,
  });
  if (!res.ok) await throwHttpError(res, "vision request failed");
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

// ============================================
// error mapping
// ============================================

// Friendly Chinese message for LLM errors. Maps common patterns:
//   401 / unauthorized        → API key 错
//   429 / rate                → 太频繁
//   context_length_exceeded   → 上下文太长 (SP / memory inject / 历史 chat 总和爆 context window)
//   529 / overloaded          → anthropic 服务端忙
//   network / fetch failed    → 网络问题
//   not configured            → 没填 LLM key
// fallback: raw error msg
export function friendlyLLMError(err: unknown): {
  title: string;
  detail: string;
  hint: string;
} {
  const raw = (err as Error)?.message ?? String(err);
  const m = raw.toLowerCase();

  if ((err as Error)?.name === "AbortError") {
    return {
      title: "停了",
      detail: "这条回复被手动停止.",
      hint: "点 retry 重新生成",
    };
  }
  if (m.includes("not configured")) {
    return {
      title: "LLM 没配",
      detail: "API key 还没填.",
      hint: "去 /settings 填 endpoint + key + model",
    };
  }
  if (m.includes("(401)") || m.includes("unauthorized") || m.includes("invalid_api_key")) {
    return {
      title: "API key 不对",
      detail: "endpoint 拒了 · 401 unauthorized.",
      hint: "去 /settings 检查 API key + endpoint 是否匹配",
    };
  }
  if (m.includes("(429)") || m.includes("rate") || m.includes("quota")) {
    return {
      title: "太频繁了",
      detail: "endpoint rate limit 或 quota 用完.",
      hint: "等几分钟再试 · 或换 model · 或检查 billing",
    };
  }
  if (m.includes("context_length") || m.includes("context length") || m.includes("too long")) {
    return {
      title: "上下文太长",
      detail: "SP + memory + chat 历史 总和超过 model context window.",
      hint: "缩短 /backstage/settings 的 SP · 关 memory inject · 或新开窗口",
    };
  }
  if (m.includes("(400)") || m.includes("bad request")) {
    return {
      title: "请求格式错",
      detail: raw.slice(0, 200),
      hint: "检查 model 名字 (例: gpt-4o-mini, claude-sonnet-4-5) · 或 endpoint URL",
    };
  }
  if (m.includes("(404)") || m.includes("not found")) {
    return {
      title: "endpoint 找不到",
      detail: "model 名字写错 · 或 endpoint URL 写错.",
      hint: "检查 /settings · base URL 即可 (例: https://api.deepseek.com)",
    };
  }
  if (m.includes("(529)") || m.includes("overloaded")) {
    return {
      title: "服务端忙",
      detail: "provider 过载 · 不是你的问题.",
      hint: "等几分钟再试",
    };
  }
  if (m.includes("(500)") || m.includes("(502)") || m.includes("(503)") || m.includes("server")) {
    return {
      title: "服务端挂了",
      detail: "endpoint 5xx · 不是你的问题.",
      hint: "等几分钟 · 或换 provider",
    };
  }
  if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch")) {
    return {
      title: "网络问题",
      detail: "请求没发出去.",
      hint: "检查 endpoint URL · 网络 · CORS (浏览器开发者工具看 console)",
    };
  }
  return {
    title: "出错了",
    detail: raw.slice(0, 200),
    hint: "检查 /settings 配置 · 或 console 看完整 error",
  };
}
