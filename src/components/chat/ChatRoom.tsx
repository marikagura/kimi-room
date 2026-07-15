"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EmptyRose } from "@/components/EmptyRose";
import { chatStore, memoryStore } from "@/lib/stores";
import {
  friendlyLLMError,
  isLLMConfigured,
  llmChat,
  llmGenerate,
  loadLLMSettings,
  setActiveModel,
  type ChatMessage as LLMChatMessage,
  type LLMSettings,
} from "@/lib/llm-client";
import { buildSystemMessage, getSystemContextStats } from "@/lib/system-prompt";
import { readCoreChat, writeCoreChat, readCoreThreads, deleteCoreChat } from "@/lib/kimi-core-client";
import { isCoreBackend } from "@/lib/backend-mode";

// Grow a textarea to fit its content, capped at maxPx px.
function useAutoResize(value: string, maxPx = 360) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, [value, maxPx]);
  return ref;
}

// ============================================
// types
// ============================================

type ToolEvent = {
  id: string;
  name: string;
  arguments?: string;
  preview?: string; // result preview "5 条" / "未找到" 等
  status: "pending" | "done" | "error";
};

// 一条 assistant 回复的一个候选 (swipe 变体). 顶层 content/thinking/cost/coreId
// 是「当前选中变体」的镜像 — 渲染 / 存储 / core merge 全走顶层字段, swipes 只是
// 候选池. 单变体消息不建 swipes (箭头不显示).
type SwipeVariant = {
  content: string;
  thinking?: string;
  cost?: { inTok: number; outTok: number };
  coreId?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string; // extended thinking 块 (reasoning 模型)
  tools?: ToolEvent[]; // MCP tool 调用记录
  cost?: { inTok: number; outTok: number }; // token usage from the LLM response (browser-direct; USD unknown — endpoint/model price varies)
  ts: string; // ISO
  coreId?: string; // kimi-core CHAT event id (core mode) — lets retry delete the exact row cross-device
  swipes?: SwipeVariant[]; // 重 roll 出的候选池 (含当前选中)
  swipeIndex?: number; // 当前选中的候选下标
};

type ChatTheme = "day" | "night";

type SessionState = {
  sessionId: string;
  startedAt: string;
  msgs: ChatMessage[];
};

// Merge core-sourced rows into the local timeline instead of wholesale-replacing
// it. Two things the old "replace with core rows" lost: (1) per-reply local-only
// fields (cost / thinking / tools) that core's CoreChatMsg doesn't carry, and
// (2) optimistic local messages not yet synced to core (e.g. a reply whose
// fire-and-forget write is still in flight). We rebuild from core rows (the
// cross-device source of truth) but re-attach local-only fields by matching
// role+content, and keep any trailing local msgs newer than the newest core row.
function mergeCoreRows(
  local: ChatMessage[],
  rows: { id: string; role: "user" | "assistant"; text: string; at: string }[],
): ChatMessage[] {
  const merged: ChatMessage[] = rows.map((r) => {
    // Re-attach local-only fields: match the already-synced row by its stable core id,
    // else (a local msg that hasn't been tagged with a coreId yet) by role+content.
    const prior = local.find(
      (m) => (m.coreId && m.coreId === r.id) || (m.role === r.role && m.content === r.text),
    );
    return {
      id: `core-${r.id}`, // stable across rehydrates (was index-based, which shifted on every merge)
      coreId: r.id,
      role: r.role,
      content: r.text,
      ts: r.at,
      ...(prior?.thinking ? { thinking: prior.thinking } : {}),
      ...(prior?.tools ? { tools: prior.tools } : {}),
      ...(prior?.cost ? { cost: prior.cost } : {}),
      // swipe 候选池是 local-only — core 只有选中的那条, 重建时把池带回来
      ...(prior?.swipes ? { swipes: prior.swipes, swipeIndex: prior.swipeIndex } : {}),
    };
  });
  // Preserve unsynced optimistic messages: any local msg newer than the newest
  // core row (its write may still be in flight) that isn't already represented.
  const newestCoreAt = rows.length ? rows[rows.length - 1].at : "";
  for (const m of local) {
    if (
      m.ts > newestCoreAt &&
      !merged.some((x) => x.role === m.role && x.content === m.content)
    ) {
      merged.push(m);
    }
  }
  return merged;
}

// ============================================
// theme tokens
// ============================================

type ChatPalette = {
  bg: string;
  ink: string;
  inkSoft: string;
  inkMute: string;
  accent: string;
  hairline: string;
  inputBg: string;
  inputInk: string;
  bubbleBg: string; // user bubble background, CC 风格
};

const DAY: ChatPalette = {
  bg: "#fbf5f0",
  ink: "#2e2618",
  inkSoft: "rgba(46,38,24,0.78)",
  inkMute: "rgba(46,38,24,0.5)",
  accent: "#8a6558",
  hairline: "rgba(46,38,24,0.18)",
  inputBg: "rgba(255,255,255,0.85)",
  inputInk: "#2e2618",
  bubbleBg: "rgba(58,42,28,0.08)",
};

const NIGHT: ChatPalette = {
  bg: "#0a0506",
  ink: "#ece2cc",
  inkSoft: "rgba(236,226,204,0.84)",
  inkMute: "rgba(236,226,204,0.46)",
  accent: "#d4af6c",
  hairline: "rgba(236,226,204,0.2)",
  inputBg: "rgba(20,12,14,0.55)",
  inputInk: "#ece2cc",
  bubbleBg: "rgba(40,28,22,0.92)",
};

function autoTheme(): ChatTheme {
  if (typeof window === "undefined") return "night";
  const h = (new Date().getUTCHours() + 9) % 24;
  return h >= 6 && h < 18 ? "day" : "night";
}

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Noto Serif SC", "Helvetica Neue", system-ui, sans-serif';

// ============================================
// mock seed (Phase 1 — 等接 backend)
// ============================================

// Fresh /chat 显示空 — EmptyRose 占位. 之前是 placeholder 3 条 sample
// 让 layout 看着不空, 现在 EmptyRose 更优雅.
const MOCK: ChatMessage[] = [];

// ============================================
// localStorage keys
// ============================================

const HEADER_LABEL_KEY = "kimi-web:chat:headerLabel";
const SESSION_KEY = "kimi-web:chat:session";
const THEME_KEY = "kimi-web:chat:theme";
const BG_KEY = "kimi-web:chat:bg";

// ============================================
// background options (从 public/images/mood)
// ============================================

const BG_OPTIONS = [
  { id: "none", label: "无", url: null },
  { id: "paris", label: "paris", url: "/images/mood/paris.jpg" },
  { id: "vienna", label: "vienna", url: "/images/mood/vienna.jpg" },
  { id: "ribbon", label: "ribbon", url: "/images/mood/ribbon.jpg" },
  { id: "kintsugi", label: "kintsugi", url: "/images/mood/kintsugi-blossom.jpg" },
  { id: "sakura-ink-1", label: "樱墨", url: "/images/mood/sakura-ink-1.jpg" },
  { id: "lilies", label: "lilies", url: "/images/mood/lilies-stairs.jpg" },
  { id: "peony", label: "peony", url: "/images/mood/peony-scroll.jpg" },
  { id: "saturn-ink", label: "saturn", url: "/images/mood/saturn-ink.jpg" },
  { id: "starfield", label: "starfield", url: "/images/mood/starfield-tent.jpg" },
  { id: "white-rose", label: "rose", url: "/images/mood/white-rose.jpg" },
];

// ============================================
// component
// ============================================

export function ChatRoom() {
  const [theme, setTheme] = useState<ChatTheme>("night");
  const [bgId, setBgId] = useState<string>("none");
  const [headerLabel, setHeaderLabel] = useState<string>("他");
  const [editingHeader, setEditingHeader] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [sysStats, setSysStats] = useState<{
    spChars: number;
    memInjectOn: boolean;
    memTotalActive: number;
  } | null>(null);

  // Load sys-prompt + memory stats when drawer opens (re-fetch each time
  // so user sees fresh count after editing /backstage/character + returning).
  useEffect(() => {
    if (!showBgPicker) return;
    void getSystemContextStats().then(setSysStats);
  }, [showBgPicker]);

  const [session, setSession] = useState<SessionState>(() => ({
    sessionId: `session-${Date.now()}`,
    startedAt: new Date().toISOString(),
    msgs: MOCK,
  }));
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState("");
  const draftRef = useAutoResize(draft, 360);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // current thread id mirror — lets the focus-refresh handler read it without re-subscribing
  const threadRef = useRef(session.sessionId);
  useEffect(() => {
    threadRef.current = session.sessionId;
  }, [session.sessionId]);
  // full session mirror — swipe 的 debounced core sync 在 timeout 里读最新 state 用
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // ── model switcher ──
  const [llmSettings, setLlmSettings] = useState<LLMSettings | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  useEffect(() => {
    setLlmSettings(loadLLMSettings());
  }, []);
  // settings 页改完档案回来 (bfcache / focus) 刷新切换器数据
  useEffect(() => {
    const refresh = () => setLlmSettings(loadLLMSettings());
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  // ── streaming abort ──
  const abortRef = useRef<AbortController | null>(null);

  // ── swipe → core 时间线的 debounced 同步 ──
  const swipeSyncTimer = useRef<number | null>(null);
  const pendingSwipeSync = useRef(false);

  // load on mount
  useEffect(() => {
    try {
      const lbl = localStorage.getItem(HEADER_LABEL_KEY);
      if (lbl) setHeaderLabel(lbl);
      const t = localStorage.getItem(THEME_KEY);
      if (t === "day" || t === "night") setTheme(t);
      else setTheme(autoTheme());
      const bg = localStorage.getItem(BG_KEY);
      if (bg) setBgId(bg);

      // URL param: ?session=<id> → resume thread from DB; ?new=1 → fresh
      const sessionParam = searchParams.get("session");
      const newParam = searchParams.get("new");

      if (newParam === "1") {
        // brand new thread, ignore localStorage. 处理完立刻把 ?new=1 从 URL 洗掉:
        // searchParams 引用在 dev RSC 刷新 / router refresh 时会变, effect 重跑
        // 若还带着 new=1 会把进行中的对话再次清空 (消息发出去就消失); 刷新页面
        // 也会再开新窗丢当前对话. replaceState 不触发 next 导航, 只改地址栏.
        setSession({
          sessionId: `session-${Date.now()}`,
          startedAt: new Date().toISOString(),
          msgs: [],
        });
        try {
          window.history.replaceState(null, "", window.location.pathname);
        } catch {}
        return;
      }

      if (isCoreBackend()) {
        // core mode: each thread is a conversation in kimi-core (threadId = room
        // sessionId), merged across this person's devices.
        //   ?session=X → open that thread       ?new=1 → fresh thread (handled above)
        //   no param   → open the MOST-RECENT thread (the `else` below)
        //
        // Why most-recent (not localStorage device-local, not blank): tuned for the
        // common personal setup — one person, a phone + a computer — so opening EITHER
        // device lands on the latest conversation. A device's own localStorage can't
        // know what the other device just wrote (it would open blank); querying core
        // does. Assumes a single user (threads are not scoped per account; multi-user
        // is out of scope, same as the engine).
        //
        // ── DEPLOYER KNOB ── to change the no-param default, edit the `else` branch:
        //   • most-recent thread  — default, below (best for multi-device / one person)
        //   • always blank / new  — replace its body with: setSession((s) => ({ ...s, msgs: [] }))
        //   • device-local last   — read localStorage SESSION_KEY instead (single-device)
        const openThread = (tid: string) =>
          readCoreChat({ threadId: tid, take: 200 }).then((rows) => {
            // Merge into local only when staying on the SAME thread (preserves
            // cost/thinking/tools + unsynced optimistic msgs); switching threads
            // starts from the core rows alone.
            setSession((s) => ({
              sessionId: tid,
              startedAt: rows[0]?.at ?? new Date().toISOString(),
              msgs:
                s.sessionId === tid
                  ? mergeCoreRows(s.msgs, rows)
                  : rows.map((r, i) => ({ id: `core-${i}-${r.at}`, role: r.role, content: r.text, ts: r.at })),
            }));
          });
        if (sessionParam) {
          void openThread(sessionParam).catch(() => {});
        } else {
          // no param → open the most-recent thread (see DEPLOYER KNOB above to change)
          void readCoreThreads({ limit: 1 })
            .then((ths) => {
              if (ths[0]) return openThread(ths[0].threadId);
              setSession((s) => ({ ...s, msgs: [] })); // no threads yet → fresh empty
            })
            .catch(() => {});
        }
        return;
      }

      if (sessionParam) {
        // V2 · resume session from ChatStore IDB (canon V1 走 /api/chat/sessions)
        void chatStore()
          .get(sessionParam)
          .then((d) => {
            if (!d) return;
            const msgs: ChatMessage[] = d.messages.map((m, i) => ({
              id: `m-${i}-${d.id}`,
              role: m.role,
              content: m.content,
              ts: m.ts ?? d.createdAt,
            }));
            setSession({
              sessionId: d.id,
              startedAt: d.createdAt,
              msgs,
            });
          })
          .catch(() => {});
        return;
      }

      // default: resume from localStorage
      const ses = localStorage.getItem(SESSION_KEY);
      if (ses) {
        const parsed = JSON.parse(ses) as SessionState;
        if (parsed?.msgs?.length) setSession(parsed);
      }
    } catch {}
  }, [searchParams]);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(HEADER_LABEL_KEY, headerLabel);
    } catch {}
  }, [headerLabel]);
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    try {
      localStorage.setItem(BG_KEY, bgId);
    } catch {}
  }, [bgId]);
  useEffect(() => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {}
    // scroll to bottom on new message
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session]);

  // V2 · auto-backup chat session to ChatStore IDB (canon V1 → /api/chat/backup
  // pwa_kv). Debounced 2s after last change. 走 settings export JSON 跨 device
  // migrate.
  useEffect(() => {
    if (session.msgs.length === 0) return;
    const t = setTimeout(() => {
      const firstUser = session.msgs.find((m) => m.role === "user");
      void chatStore()
        .put({
          id: session.sessionId,
          source: "cc-chat",
          title: firstUser ? firstUser.content.slice(0, 60) : null,
          messages: session.msgs.map((m) => ({
            role: m.role,
            content: m.content,
            ts: m.ts,
          })),
          note: null,
          theme,
        })
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [session, theme]);

  // core mode: re-hydrate the merged timeline when the window regains focus, so
  // messages another device sent appear on return. Skipped mid-reply (don't clobber
  // the in-flight turn) and when the tab is hidden.
  useEffect(() => {
    if (!isCoreBackend()) return;
    function refresh() {
      // pendingSwipeSync: 切换变体后 core 还是旧内容, 等 debounced sync 落完再拉,
      // 否则 merge 会把刚选中的变体覆盖回旧的.
      if (busy || pendingSwipeSync.current || document.visibilityState === "hidden") return;
      const tid = threadRef.current;
      void readCoreChat({ threadId: tid, take: 200 })
        .then((rows) => {
          if (!rows.length) return;
          setSession((s) =>
            s.sessionId === tid
              ? { ...s, msgs: mergeCoreRows(s.msgs, rows) }
              : s,
          );
        })
        .catch(() => {});
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [busy]);

  const p = theme === "day" ? DAY : NIGHT;
  const bg = useMemo(() => BG_OPTIONS.find((b) => b.id === bgId) ?? BG_OPTIONS[0], [bgId]);

  // ============================================
  // actions
  // ============================================

  // Update one reply message; when it has a swipe pool, mirror the patch into
  // the selected variant so the pool stays consistent with the top-level fields.
  function patchReply(replyId: string, patch: Partial<SwipeVariant>) {
    setSession((s) => ({
      ...s,
      msgs: s.msgs.map((m) => {
        if (m.id !== replyId) return m;
        const next = { ...m, ...patch };
        if (m.swipes && m.swipeIndex != null && m.swipes[m.swipeIndex]) {
          const sw = [...m.swipes];
          sw[m.swipeIndex] = { ...sw[m.swipeIndex], ...patch };
          next.swipes = sw;
        }
        return next;
      }),
    }));
  }

  // V3 · client-side LLM call via lib/llm-client.ts, SSE streaming (text +
  // thinking deltas, 80ms flush 节流), stop button aborts. 端点拒绝流式时
  // llm-client 自动退回非流式. 设置 LLM key 在 /settings 后 即可 chat.
  async function streamReply(msgs: ChatMessage[], replyId: string, threadId?: string) {
    if (!isLLMConfigured()) {
      patchReply(replyId, {
        content:
          "(LLM API key 没填 · 进 /backstage/settings 填 endpoint + key 才能 chat)",
      });
      setBusy(false);
      return;
    }
    const ac = new AbortController();
    abortRef.current = ac;
    // delta 累积 + 节流 flush — 每个 SSE chunk 一次 setState 太密
    const acc = { text: "", thinking: "" };
    let flushTimer: number | null = null;
    const flush = () => {
      flushTimer = null;
      patchReply(replyId, {
        content: acc.text,
        thinking: acc.thinking || undefined,
      });
    };
    const scheduleFlush = () => {
      if (flushTimer == null) flushTimer = window.setTimeout(flush, 80);
    };
    try {
      const sys = await buildSystemMessage();
      const llmMsgs: LLMChatMessage[] = [];
      if (sys.text) {
        llmMsgs.push({ role: "system", content: sys.text });
      }
      for (const m of msgs) {
        llmMsgs.push({ role: m.role, content: m.content });
      }
      const r = await llmChat(llmMsgs, {
        signal: ac.signal,
        onEvent: (e) => {
          if (e.type === "text") acc.text += e.delta;
          else acc.thinking += e.delta;
          scheduleFlush();
        },
      });
      if (flushTimer != null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      const text = r.text?.trim() || "(空响应)";
      patchReply(replyId, {
        content: text,
        thinking: r.thinking || acc.thinking || undefined,
        cost: r.usage,
      });
      // Await the core persist before `finally` clears busy: while busy is true
      // the focus/visibility refresh bails (see its guard), so this closes the
      // window where a refresh could read core (without this reply yet) and drop
      // the just-rendered message. writeCoreChat swallows its own errors.
      if (r.text?.trim()) {
        const coreId = await writeCoreChat("assistant", r.text.trim(), threadId);
        // tag the just-rendered reply with its core row id so regenerate can delete it
        if (coreId) {
          patchReply(replyId, { coreId });
        }
      }
    } catch (e) {
      if (flushTimer != null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if ((e as Error)?.name === "AbortError") {
        // 手动停止: 已流出的部分保留 (不写 core — 半截回复不进跨设备时间线)
        patchReply(replyId, {
          content: acc.text || "(停了 · 点 retry 重新生成)",
          thinking: acc.thinking || undefined,
        });
        return;
      }
      console.error("[chat:llm]", e);
      const fe = friendlyLLMError(e);
      patchReply(replyId, {
        content: `⚠ ${fe.title}\n\n${fe.detail}\n\n→ ${fe.hint}`,
      });
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    const userMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      role: "user",
      content: text,
      ts: new Date().toISOString(),
    };
    const nextMsgs: ChatMessage[] = [...session.msgs, userMsg];
    const replyId = `m-${Date.now() + 1}`;
    const replyMsg: ChatMessage = {
      id: replyId,
      role: "assistant",
      content: "",
      ts: new Date().toISOString(),
    };
    setSession((s) => ({ ...s, msgs: [...nextMsgs, replyMsg] }));
    setDraft("");
    setBusy(true);
    const threadId = session.sessionId;
    // Fire-and-forget with an idempotency key (kimi-core dedupes on it), then tag
    // the local message with its core row id so mergeCoreRows matches by id
    // instead of falling back to role+content (which misfires on repeated text).
    void writeCoreChat("user", text, threadId).then((coreId) => {
      if (coreId) {
        setSession((s) => ({
          ...s,
          msgs: s.msgs.map((m) => (m.id === userMsg.id ? { ...m, coreId } : m)),
        }));
      }
    });
    await streamReply(nextMsgs, replyId, threadId);
  }

  function copyMsg(id: string) {
    const m = session.msgs.find((x) => x.id === id);
    if (!m) return;
    void navigator.clipboard.writeText(m.content).catch(() => {});
  }

  // 重 roll 最后一条 assistant — 旧回复进 swipe 候选池不丢, 新变体流式生成.
  // Core mode: 时间线只存「当前选中」— 旧选中的 core 行先删, 新变体生成完写新行,
  // 左滑回旧变体时 scheduleSwipeSync 再把时间线换回去.
  async function regenerate() {
    if (busy) return;
    const lastAssistantIdx = [...session.msgs]
      .reverse()
      .findIndex((m) => m.role === "assistant");
    if (lastAssistantIdx === -1) return;
    const at = session.msgs.length - 1 - lastAssistantIdx;
    const cur = session.msgs[at];
    const historyMsgs = session.msgs.slice(0, at);
    if (!historyMsgs.length) return;

    // 当前内容收进候选池 (首次重 roll 时建池), 新的空变体 append 并选中
    const pool: SwipeVariant[] =
      cur.swipes ??
      (cur.content
        ? [{ content: cur.content, thinking: cur.thinking, cost: cur.cost, coreId: cur.coreId }]
        : []);
    const swipes = [...pool, { content: "" }];
    const swipeIndex = swipes.length - 1;

    // core 时间线换行: 旧选中的行删掉 (新行生成完由 streamReply 写)
    if (cur.coreId) {
      void deleteCoreChat(cur.coreId);
      // 池里同一变体的 coreId 也清掉 — 行已删, 别在 swipe sync 里再删一次
      const stale = cur.coreId;
      for (const v of swipes) if (v.coreId === stale) v.coreId = undefined;
    }

    setSession((s) => ({
      ...s,
      msgs: [
        ...historyMsgs,
        {
          ...cur,
          content: "",
          thinking: undefined,
          cost: undefined,
          coreId: undefined,
          swipes,
          swipeIndex,
        },
      ],
    }));
    setBusy(true);
    await streamReply(historyMsgs, cur.id, session.sessionId);
  }

  // 左右切候选. 右滑到头 = 生成新变体 (酒馆语义).
  function switchSwipe(msgId: string, dir: 1 | -1) {
    if (busy) return;
    const m = session.msgs.find((x) => x.id === msgId);
    if (!m) return;
    const pool = m.swipes;
    if (!pool || pool.length === 0) {
      if (dir === 1) void regenerate();
      return;
    }
    const cur = m.swipeIndex ?? 0;
    const next = cur + dir;
    if (next < 0) return;
    if (next >= pool.length) {
      void regenerate();
      return;
    }
    const v = pool[next];
    setSession((s) => ({
      ...s,
      msgs: s.msgs.map((x) =>
        x.id === msgId
          ? {
              ...x,
              content: v.content,
              thinking: v.thinking,
              cost: v.cost,
              coreId: v.coreId,
              swipeIndex: next,
            }
          : x,
      ),
    }));
    scheduleSwipeSync(msgId);
  }

  // 切换变体后 2s (连点归并) 把 core 时间线对齐当前选中: 删非选中变体残留的行,
  // 选中变体没行则写一行. pendingSwipeSync 挡住 focus refresh, 避免旧行覆盖回来.
  function scheduleSwipeSync(msgId: string) {
    if (!isCoreBackend()) return;
    pendingSwipeSync.current = true;
    if (swipeSyncTimer.current != null) clearTimeout(swipeSyncTimer.current);
    swipeSyncTimer.current = window.setTimeout(() => {
      swipeSyncTimer.current = null;
      const s = sessionRef.current;
      const m = s.msgs.find((x) => x.id === msgId);
      if (!m || !m.swipes) {
        pendingSwipeSync.current = false;
        return;
      }
      const idx = m.swipeIndex ?? 0;
      // 非选中变体留在 core 的行全删
      const staleIds = m.swipes
        .filter((v, i) => i !== idx && v.coreId)
        .map((v) => v.coreId!);
      for (const cid of staleIds) void deleteCoreChat(cid);
      if (staleIds.length) {
        setSession((prev) => ({
          ...prev,
          msgs: prev.msgs.map((x) =>
            x.id === msgId && x.swipes
              ? {
                  ...x,
                  swipes: x.swipes.map((v, i) =>
                    i !== (x.swipeIndex ?? 0) ? { ...v, coreId: undefined } : v,
                  ),
                }
              : x,
          ),
        }));
      }
      // 选中变体没写过 core → 补一行
      if (!m.coreId && m.content.trim()) {
        void writeCoreChat("assistant", m.content.trim(), s.sessionId)
          .then((coreId) => {
            if (coreId) patchReply(msgId, { coreId });
          })
          .finally(() => {
            pendingSwipeSync.current = false;
          });
      } else {
        pendingSwipeSync.current = false;
      }
    }, 2000);
  }

  async function newWindow() {
    if (
      !confirm(
        "现在的窗口要 closeout — 总结写进 memory 然后开新窗. 旧的还能在 /room/memory-review 看. 确定?",
      )
    )
      return;
    setBusy(true);
    try {
      let title: string | null = null;
      if (session.msgs.length >= 2 && isLLMConfigured()) {
        try {
          const transcript = session.msgs
            .map((m) => `[${m.role}] ${m.content}`)
            .join("\n\n");
          const summary = await llmGenerate(
            `请用中文 1-2 句话总结以下对话, 不超过 40 字, 直接给标题, 不要解释:\n\n${transcript.slice(0, 6000)}`,
            "你 summarize 对话 1-2 句 ≤40 字, 直接给, 不解释.",
            { temperature: 0.3, maxTokens: 100 },
          );
          title = summary.trim().split("\n")[0].slice(0, 80) || null;
        } catch {
          // 总结失败 fall through · 直接 close window 不 memory
        }
      }
      if (title) {
        // 把 closeout 总结存进 memoryStore (canon V1 走 /api/chat/closeout 自动写 memory)
        await memoryStore().put({
          key: title,
          content: session.msgs
            .map((m) => `[${m.role}] ${m.content}`)
            .join("\n\n"),
          order: 0,
          active: true,
          tags: ["chat-closeout"],
          reviewStatus: "pending",
        });
      }
      // 删 旧 session ChatStore record · 起新
      try {
        await chatStore().delete(session.sessionId);
      } catch {}
      const fresh: SessionState = {
        sessionId: `session-${Date.now()}`,
        startedAt: new Date().toISOString(),
        msgs: [
          {
            id: `m-${Date.now()}`,
            role: "assistant",
            content: title
              ? `新窗. 上次存为 "${title}". 接着说.`
              : "新窗. 接着说.",
            ts: new Date().toISOString(),
          },
        ],
      };
      setSession(fresh);
    } catch (e) {
      console.error("[chat:closeout]", e);
      alert("closeout 失败.");
    } finally {
      setBusy(false);
    }
  }

  // ============================================
  // render
  // ============================================

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: p.bg,
        color: p.ink,
        fontFamily: FONT_STACK,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* bg image */}
      {bg.url && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${bg.url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: theme === "day" ? 0.18 : 0.22,
            mixBlendMode: theme === "day" ? "multiply" : "screen",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}

      {/* header */}
      <header
        style={{
          position: "relative",
          zIndex: 2,
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: 10,
          paddingLeft: 16,
          paddingRight: 16,
          borderBottom: `0.4px solid ${p.hairline}`,
          background:
            theme === "day"
              ? "rgba(251,245,240,0.85)"
              : "rgba(10,5,6,0.78)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Link
          href="/room"
          aria-label="back"
          style={{
            color: p.inkSoft,
            fontSize: 22,
            textDecoration: "none",
            width: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ‹
        </Link>

        <div
          style={{
            flex: 1,
            textAlign: "center",
            cursor: "pointer",
          }}
          onClick={() => {
            if (!editingHeader) {
              setDraftLabel(headerLabel);
              setEditingHeader(true);
            }
          }}
        >
          {editingHeader ? (
            <input
              autoFocus
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              onBlur={() => {
                if (draftLabel.trim()) setHeaderLabel(draftLabel.trim());
                setEditingHeader(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (draftLabel.trim()) setHeaderLabel(draftLabel.trim());
                  setEditingHeader(false);
                } else if (e.key === "Escape") {
                  setEditingHeader(false);
                }
              }}
              style={{
                fontSize: 16,
                color: p.ink,
                background: "transparent",
                border: "none",
                borderBottom: `0.6px solid ${p.accent}`,
                textAlign: "center",
                outline: "none",
                fontFamily: FONT_STACK,
                width: 120,
                padding: "2px 0",
              }}
            />
          ) : (
            <div style={{ fontSize: 16, color: p.ink, fontWeight: 500 }}>
              {headerLabel}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowBgPicker((v) => !v)}
          aria-label="more"
          style={{
            background: "transparent",
            border: "none",
            color: p.inkSoft,
            fontSize: 18,
            cursor: "pointer",
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ⋯
        </button>
      </header>

      {/* bg + theme picker drawer */}
      {showBgPicker && (
        <div
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 56px)",
            right: 12,
            zIndex: 5,
            background:
              theme === "day"
                ? "rgba(255,255,255,0.95)"
                : "rgba(20,12,14,0.92)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            border: `0.6px solid ${p.hairline}`,
            borderRadius: 12,
            padding: "10px 12px",
            minWidth: 180,
            boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: 2,
              color: p.inkMute,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            theme
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {(["day", "night"] as ChatTheme[]).map((t) => {
              const active = theme === t;
              const ink = active ? p.accent : p.inkSoft;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  style={{
                    flex: 1,
                    padding: "6px 0",
                    fontSize: 11,
                    letterSpacing: 2,
                    border: `0.6px solid ${active ? p.accent : p.hairline}`,
                    background: active ? `${p.accent}1f` : "transparent",
                    color: ink,
                    cursor: "pointer",
                    fontFamily: FONT_STACK,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {/* owner 0903: 自画 SVG, kimi-web 全 不准 emoji */}
                  {t === "day" ? (
                    <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden>
                      <circle cx="7" cy="7" r="2.6" fill="none" stroke={ink} strokeWidth="0.9" />
                      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                        <line
                          key={a}
                          x1="7"
                          y1="1.2"
                          x2="7"
                          y2="2.8"
                          stroke={ink}
                          strokeWidth="0.9"
                          strokeLinecap="round"
                          transform={`rotate(${a} 7 7)`}
                        />
                      ))}
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden>
                      <path
                        d="M 10 2.5 A 4.7 4.7 0 1 0 10 11.5 A 3.5 3.5 0 0 1 10 2.5 Z"
                        fill={ink}
                      />
                    </svg>
                  )}
                  <span>{t}</span>
                </button>
              );
            })}
          </div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 2,
              color: p.inkMute,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            background
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              marginBottom: 12,
            }}
          >
            {BG_OPTIONS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBgId(b.id)}
                style={{
                  padding: "5px 8px",
                  fontSize: 10,
                  letterSpacing: 1,
                  border: `0.4px solid ${bgId === b.id ? p.accent : p.hairline}`,
                  background: bgId === b.id ? `${p.accent}1a` : "transparent",
                  color: bgId === b.id ? p.accent : p.inkSoft,
                  cursor: "pointer",
                  fontFamily: FONT_STACK,
                  borderRadius: 4,
                  textAlign: "left",
                }}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* system context · read-only · edit at /backstage/character */}
          <div
            style={{
              fontSize: 9,
              letterSpacing: 2,
              color: p.inkMute,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            system context
          </div>
          <Link
            href="/backstage/character"
            style={{
              display: "block",
              padding: "8px 10px",
              fontSize: 10,
              lineHeight: 1.5,
              border: `0.4px solid ${p.hairline}`,
              borderRadius: 6,
              color: p.inkSoft,
              textDecoration: "none",
              fontFamily: FONT_STACK,
              marginBottom: 12,
            }}
          >
            {sysStats ? (
              <>
                <div>
                  SP {sysStats.spChars} 字 ·{" "}
                  {sysStats.memInjectOn
                    ? `${sysStats.memTotalActive} 条 memory 注入`
                    : "memory 不注入"}
                </div>
                <div style={{ marginTop: 4, color: p.inkMute, fontSize: 9, letterSpacing: 1 }}>
                  → /backstage/character
                </div>
              </>
            ) : (
              <span style={{ color: p.inkMute }}>…</span>
            )}
          </Link>

          <button
            type="button"
            onClick={newWindow}
            style={{
              width: "100%",
              padding: "7px 10px",
              fontSize: 10,
              letterSpacing: 2,
              border: `0.6px solid ${p.accent}`,
              background: `${p.accent}1a`,
              color: p.accent,
              cursor: "pointer",
              fontFamily: FONT_STACK,
              borderRadius: 6,
              textTransform: "uppercase",
            }}
          >
            ↺ closeout · 新窗口
          </button>
          <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
            <Link
              href="/chat/history"
              style={{
                flex: 1,
                padding: "6px 10px",
                fontSize: 9,
                letterSpacing: 2,
                border: `0.6px solid ${p.hairline}`,
                background: "transparent",
                color: p.inkSoft,
                cursor: "pointer",
                fontFamily: FONT_STACK,
                borderRadius: 6,
                textAlign: "center",
                textDecoration: "none",
                textTransform: "uppercase",
              }}
            >
              ↶ 过往 sessions
            </Link>
          </div>
        </div>
      )}

      {/* messages list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 14px 4px",
          position: "relative",
          zIndex: 1,
          // iOS PWA fix: 防止 elastic bounce 带动整个 main / 背景
          // 看起来"在滑背景图". contain 把 scroll chain 锁在 list 内.
          overscrollBehavior: "contain",
          // iOS smooth touch scrolling
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
        }}
      >
        {session.msgs.length === 0 && !busy ? (
          <EmptyRose message="今天还没说话 · 写一句" palette="gothic" />
        ) : (
          session.msgs.map((m, i) => {
            const prev = session.msgs[i - 1];
            const showTs =
              !prev ||
              new Date(m.ts).getTime() - new Date(prev.ts).getTime() > 5 * 60 * 1000;
            // retry / swipe 只对最后一条 assistant 显示 (并且不是 streaming 中)
            const isLastAssistant =
              m.role === "assistant" &&
              i === session.msgs.length - 1 &&
              m.content.length > 0 &&
              !busy;
            return (
              <MessageItem
                key={m.id}
                msg={m}
                palette={p}
                showTs={showTs}
                onCopy={() => copyMsg(m.id)}
                onRetry={isLastAssistant ? regenerate : undefined}
                onSwipe={isLastAssistant ? (dir) => switchSwipe(m.id, dir) : undefined}
              />
            );
          })
        )}
        {busy && (
          <div
            style={{
              fontSize: 12,
              color: p.inkMute,
              fontStyle: "italic",
              marginTop: 6,
            }}
          >
            ...
          </div>
        )}
      </div>

      {/* input — PWA 紧凑版, 让 message 区往下延 */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)",
          borderTop: `0.4px solid ${p.hairline}`,
          background:
            theme === "day"
              ? "rgba(251,245,240,0.92)"
              : "rgba(10,5,6,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* model switcher strip — 点开浮层切档案/模型, 不出对话页 */}
        <ModelSwitcher
          palette={p}
          theme={theme}
          settings={llmSettings}
          open={showModelPicker}
          onToggle={() => setShowModelPicker((v) => !v)}
          onPick={(pid, model) => {
            setActiveModel(pid, model);
            setLlmSettings(loadLLMSettings());
            setShowModelPicker(false);
          }}
        />
        <div
          style={{
            padding: "6px 10px 0",
            display: "flex",
            gap: 6,
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="message…"
            rows={1}
            style={{
              flex: 1,
              background: p.inputBg,
              color: p.inputInk,
              border: `0.6px solid ${p.hairline}`,
              borderRadius: 16,
              padding: "8px 12px",
              fontSize: 15,
              lineHeight: 1.4,
              fontFamily: FONT_STACK,
              outline: "none",
              resize: "none",
              overflow: "hidden",
            }}
          />
          <button
            type="button"
            onClick={busy ? stopStreaming : send}
            disabled={!busy && !draft.trim()}
            aria-label={busy ? "stop" : "send"}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "none",
              background: busy || draft.trim() ? p.accent : `${p.accent}55`,
              color: theme === "day" ? "#fff" : "#1a0e08",
              cursor: busy || draft.trim() ? "pointer" : "default",
              fontSize: busy ? 11 : 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {busy ? "◼" : "↑"}
          </button>
        </div>
      </div>
    </main>
  );
}

// ============================================
// ModelSwitcher
// ============================================

// composer 上方一行细字: 当前 档案 · 模型, 点开浮层列出所有档案的所有模型.
// 档案编辑在 /backstage/settings; 这里只切.
function ModelSwitcher({
  palette: p,
  theme,
  settings,
  open,
  onToggle,
  onPick,
}: {
  palette: ChatPalette;
  theme: ChatTheme;
  settings: LLMSettings | null;
  open: boolean;
  onToggle: () => void;
  onPick: (profileId: string, model: string) => void;
}) {
  const profiles = settings?.profiles ?? [];
  const withModels = profiles.filter((pf) => pf.models.length > 0);
  const active = profiles.find((pf) => pf.id === settings?.activeProfileId) ?? profiles[0];
  const activeModel = settings?.activeModel || active?.models[0] || "";
  const label = active
    ? `${active.name || "未命名"} · ${activeModel || "no model"}`
    : "配置 LLM";

  return (
    <div style={{ position: "relative", padding: "4px 14px 0" }}>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 10,
            right: 10,
            maxHeight: 300,
            overflowY: "auto",
            background:
              theme === "day" ? "rgba(255,255,255,0.96)" : "rgba(20,12,14,0.94)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            border: `0.6px solid ${p.hairline}`,
            borderRadius: 12,
            padding: "8px 10px",
            boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
            zIndex: 6,
          }}
        >
          {withModels.length === 0 ? (
            <Link
              href="/backstage/settings"
              style={{
                display: "block",
                fontSize: 11,
                color: p.inkSoft,
                padding: "6px 4px",
                textDecoration: "none",
              }}
            >
              还没有档案 · 去 /backstage/settings 加 →
            </Link>
          ) : (
            withModels.map((pf) => (
              <div key={pf.id} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: p.inkMute,
                    padding: "4px 4px 2px",
                  }}
                >
                  {pf.name || "未命名"}
                  <span style={{ marginLeft: 6, opacity: 0.7 }}>{pf.format}</span>
                </div>
                {pf.models.map((m) => {
                  const isActive =
                    pf.id === settings?.activeProfileId && m === settings?.activeModel;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onPick(pf.id, m)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "5px 8px",
                        fontSize: 12,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, monospace",
                        color: isActive ? p.accent : p.inkSoft,
                        background: isActive ? `${p.accent}1a` : "transparent",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            ))
          )}
          {withModels.length > 0 && (
            <Link
              href="/backstage/settings"
              style={{
                display: "block",
                fontSize: 9,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: p.inkMute,
                padding: "6px 4px 2px",
                textDecoration: "none",
                borderTop: `0.4px solid ${p.hairline}`,
                marginTop: 4,
              }}
            >
              管理档案 →
            </Link>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: "transparent",
          border: "none",
          padding: "2px 0",
          fontSize: 10,
          letterSpacing: 1,
          color: p.inkMute,
          cursor: "pointer",
          fontFamily: FONT_STACK,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: active?.apiKey ? p.accent : p.inkMute,
            display: "inline-block",
            opacity: 0.8,
          }}
        />
        {label}
        <span style={{ fontSize: 8, opacity: 0.8 }}>{open ? "▲" : "▼"}</span>
      </button>
    </div>
  );
}

// ============================================
// MessageItem
// ============================================

// Markdown emphasis rendering: *italic* / **bold**. Everything else passes
// through as-is (line breaks preserved by the parent's pre-wrap). ** matches
// before *; a span can't cross asterisks/newlines; unpaired asterisks stay literal.
function renderEmphasis(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  const re = /\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) nodes.push(<strong key={k++} style={{ fontWeight: 600 }}>{m[1]}</strong>);
    else nodes.push(<em key={k++}>{m[2]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length > 0 ? nodes : text;
}

function MessageItem({
  msg,
  palette,
  showTs,
  onCopy,
  onRetry,
  onSwipe,
}: {
  msg: ChatMessage;
  palette: ChatPalette;
  showTs: boolean;
  onCopy: () => void;
  onRetry?: () => void;
  onSwipe?: (dir: 1 | -1) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [playState, setPlayState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null); // cache the blob url so the same reply isn't re-synthesized
  const isUser = msg.role === "user";
  const p = palette;

  const tsLabel = useMemo(() => {
    try {
      const d = new Date(msg.ts);
      const j = new Date(d.getTime() + 9 * 3600 * 1000);
      const m = String(j.getUTCMonth() + 1).padStart(2, "0");
      const day = String(j.getUTCDate()).padStart(2, "0");
      const hh = String(j.getUTCHours()).padStart(2, "0");
      const mm = String(j.getUTCMinutes()).padStart(2, "0");
      return `${m}.${day} ${hh}:${mm}`;
    } catch {
      return "";
    }
  }, [msg.ts]);

  // release the cached audio blob on unmount
  useEffect(
    () => () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );

  // "听" — speak this reply via /api/tts. Reuses the cached blob (the same reply is
  // not re-synthesized); clicking while playing stops it; on failure it shows 重试.
  async function playVoice() {
    if (playState === "playing" && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayState("idle");
      return;
    }
    try {
      if (!audioUrlRef.current) {
        setPlayState("loading");
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: msg.content }),
        });
        if (!res.ok) throw new Error(`tts ${res.status}`);
        const blob = await res.blob();
        audioUrlRef.current = URL.createObjectURL(blob);
      }
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = audioUrlRef.current;
      audio.onended = () => setPlayState("idle");
      audio.onerror = () => setPlayState("error");
      setPlayState("playing");
      await audio.play();
    } catch {
      setPlayState("error");
    }
  }

  return (
    <div
      style={{
        marginTop: showTs ? 22 : 8,
      }}
    >
      {showTs && (
        <div
          style={{
            textAlign: "center",
            fontSize: 10,
            color: p.inkMute,
            marginBottom: 12,
            letterSpacing: 1,
            fontStyle: "italic",
          }}
        >
          {tsLabel}
        </div>
      )}
      {/* tool calls — assistant only. 默认 inline 简洁 (name + preview),
          点击 expand 显示 args JSON. */}
      {!isUser && msg.tools && msg.tools.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          {msg.tools.map((t) => {
            const expanded = expandedTools.has(t.id);
            const formattedArgs = (() => {
              if (!t.arguments) return null;
              try {
                return JSON.stringify(JSON.parse(t.arguments), null, 2);
              } catch {
                return t.arguments;
              }
            })();
            return (
              <div key={t.id} style={{ padding: "1px 0" }}>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedTools((prev) => {
                      const next = new Set(prev);
                      if (next.has(t.id)) next.delete(t.id);
                      else next.add(t.id);
                      return next;
                    })
                  }
                  style={{
                    fontSize: 11,
                    letterSpacing: 0.5,
                    color: p.inkMute,
                    fontStyle: "italic",
                    fontFamily: FONT_STACK,
                    lineHeight: 1.5,
                    padding: 0,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {t.status === "pending" ? "⋯ " : "✓ "}
                  {t.name}
                  {t.preview ? ` · ${t.preview}` : ""}
                </button>
                {expanded && formattedArgs && (
                  <pre
                    style={{
                      marginTop: 4,
                      marginLeft: 16,
                      paddingLeft: 8,
                      borderLeft: `2px solid ${p.hairline}`,
                      fontSize: 11,
                      lineHeight: 1.55,
                      color: p.inkSoft,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      opacity: 0.85,
                    }}
                  >
                    {formattedArgs}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* thinking block — assistant only, collapsible, default 收 */}
      {!isUser && msg.thinking && msg.thinking.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <button
            type="button"
            onClick={() => setShowThinking((v) => !v)}
            style={{
              fontSize: 11,
              letterSpacing: 1,
              color: p.inkMute,
              background: "transparent",
              border: "none",
              padding: "2px 0",
              cursor: "pointer",
              fontFamily: FONT_STACK,
              fontStyle: "italic",
            }}
          >
            {showThinking ? "▼" : "▶"} thinking · {msg.thinking.length} 字
          </button>
          {showThinking && (
            <div
              style={{
                marginTop: 6,
                paddingLeft: 12,
                borderLeft: `2px solid ${p.hairline}`,
                fontSize: 13,
                color: p.inkSoft,
                fontStyle: "italic",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                opacity: 0.85,
              }}
            >
              {msg.thinking}
            </div>
          )}
        </div>
      )}

      <div
        onClick={() => setShowActions((v) => !v)}
        style={{
          display: "flex",
          justifyContent: isUser ? "flex-end" : "flex-start",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            maxWidth: "82%",
            color: p.ink,
            fontSize: 15.5,
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            textAlign: "left",
            // user CC 风气泡(右), assistant 纯文本无气泡; 气泡内文字一律左对齐
            ...(isUser
              ? {
                  color: p.ink,
                  background: p.bubbleBg,
                  padding: "10px 14px",
                  borderRadius: 18,
                }
              : {}),
          }}
        >
          {msg.content ? (
            renderEmphasis(msg.content)
          ) : (
            <span style={{ color: p.inkMute, fontStyle: "italic" }}>...</span>
          )}
        </div>
      </div>
      {/* swipe 行 (最后一条 assistant): ‹ n/m › 切候选, 右滑到头 = 重 roll 出新变体.
          cost 并进同一行. 非 swipe 消息只显示 cost. */}
      {!isUser && (onSwipe || msg.cost) && (
        <div
          style={{
            marginTop: 3,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 9,
            letterSpacing: 1.5,
            color: p.inkMute,
            fontFamily: FONT_STACK,
            textTransform: "uppercase",
          }}
        >
          {onSwipe && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                aria-label="previous variant"
                disabled={(msg.swipeIndex ?? 0) === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onSwipe(-1);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: (msg.swipeIndex ?? 0) === 0 ? `${p.inkMute}55` : p.inkSoft,
                  cursor: (msg.swipeIndex ?? 0) === 0 ? "default" : "pointer",
                  fontSize: 13,
                  padding: "0 3px",
                  lineHeight: 1,
                }}
              >
                ‹
              </button>
              <span>
                {(msg.swipeIndex ?? 0) + 1}/{msg.swipes?.length ?? 1}
              </span>
              <button
                type="button"
                aria-label="next variant / reroll"
                onClick={(e) => {
                  e.stopPropagation();
                  onSwipe(1);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: p.inkSoft,
                  cursor: "pointer",
                  fontSize: 13,
                  padding: "0 3px",
                  lineHeight: 1,
                }}
              >
                ›
              </button>
            </span>
          )}
          {msg.cost && (
            <span>
              in {msg.cost.inTok} · out {msg.cost.outTok}
            </span>
          )}
        </div>
      )}
      {showActions && (
        <div
          style={{
            display: "flex",
            justifyContent: isUser ? "flex-end" : "flex-start",
            marginTop: 4,
            gap: 8,
          }}
        >
          {!isUser && msg.content && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                playVoice();
              }}
              style={{
                fontSize: 9,
                letterSpacing: 2,
                padding: "3px 10px",
                border: `0.4px solid ${p.hairline}`,
                background: "transparent",
                color: playState === "error" ? p.accent : p.inkMute,
                cursor: "pointer",
                fontFamily: FONT_STACK,
                borderRadius: 4,
              }}
            >
              {playState === "loading"
                ? "··· 合成中"
                : playState === "playing"
                  ? "◼ 停"
                  : playState === "error"
                    ? "✕ 重试"
                    : "听"}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
              setShowActions(false);
            }}
            style={{
              fontSize: 9,
              letterSpacing: 2,
              padding: "3px 10px",
              border: `0.4px solid ${p.hairline}`,
              background: "transparent",
              color: p.inkMute,
              cursor: "pointer",
              fontFamily: FONT_STACK,
              borderRadius: 4,
              textTransform: "uppercase",
            }}
          >
            copy
          </button>
          {onRetry && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(false);
                onRetry();
              }}
              style={{
                fontSize: 9,
                letterSpacing: 2,
                padding: "3px 10px",
                border: `0.4px solid ${p.hairline}`,
                background: "transparent",
                color: p.inkMute,
                cursor: "pointer",
                fontFamily: FONT_STACK,
                borderRadius: 4,
                textTransform: "uppercase",
              }}
            >
              ↻ retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
