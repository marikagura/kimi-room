"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EmptyRose } from "@/components/EmptyRose";
import { chatStore, memoryStore } from "@/lib/stores";
import { friendlyLLMError, isLLMConfigured, llmChat, llmGenerate, type ChatMessage as LLMChatMessage } from "@/lib/llm-client";
import { buildSystemMessage, getSystemContextStats } from "@/lib/system-prompt";

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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string; // extended thinking 块 (opus 4.6 reasoning)
  tools?: ToolEvent[]; // MCP tool 调用记录
  ts: string; // ISO
};

type ChatTheme = "day" | "night";

type SessionState = {
  sessionId: string;
  startedAt: string;
  msgs: ChatMessage[];
};

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
        // brand new thread, ignore localStorage
        setSession({
          sessionId: `session-${Date.now()}`,
          startedAt: new Date().toISOString(),
          msgs: [],
        });
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

  const p = theme === "day" ? DAY : NIGHT;
  const bg = useMemo(() => BG_OPTIONS.find((b) => b.id === bgId) ?? BG_OPTIONS[0], [bgId]);

  // ============================================
  // actions
  // ============================================

  // V2 · client-side LLM call via lib/llm-client.ts (OpenAI-format chat
  // completion). canon V1 streamed SSE w/ thinking + tool_call/tool_result
  // 事件; V2 简化 non-streaming · 设置 LLM key 在 /settings 后 即可 chat.
  async function streamReply(msgs: ChatMessage[], replyId: string) {
    if (!isLLMConfigured()) {
      setSession((s) => ({
        ...s,
        msgs: s.msgs.map((m) =>
          m.id === replyId
            ? {
                ...m,
                content:
                  "(LLM API key 没填 · 进 /backstage/settings 填 endpoint + key 才能 chat)",
              }
            : m,
        ),
      }));
      setBusy(false);
      return;
    }
    try {
      const sys = await buildSystemMessage();
      const llmMsgs: LLMChatMessage[] = [];
      if (sys.text) {
        llmMsgs.push({ role: "system", content: sys.text });
      }
      for (const m of msgs) {
        llmMsgs.push({ role: m.role, content: m.content });
      }
      const r = await llmChat(llmMsgs);
      const text = r.text?.trim() || "(空响应)";
      setSession((s) => ({
        ...s,
        msgs: s.msgs.map((m) =>
          m.id === replyId ? { ...m, content: text } : m,
        ),
      }));
    } catch (e) {
      console.error("[chat:llm]", e);
      const fe = friendlyLLMError(e);
      setSession((s) => ({
        ...s,
        msgs: s.msgs.map((m) =>
          m.id === replyId
            ? {
                ...m,
                content: `⚠ ${fe.title}\n\n${fe.detail}\n\n→ ${fe.hint}`,
              }
            : m,
        ),
      }));
    } finally {
      setBusy(false);
    }
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
    await streamReply(nextMsgs, replyId);
  }

  function copyMsg(id: string) {
    const m = session.msgs.find((x) => x.id === id);
    if (!m) return;
    void navigator.clipboard.writeText(m.content).catch(() => {});
  }

  async function retryLast() {
    if (busy) return;
    // 删掉最后一条 assistant, 用其前的 history (含最后一条 user) 重 fire.
    const lastAssistantIdx = [...session.msgs]
      .reverse()
      .findIndex((m) => m.role === "assistant");
    if (lastAssistantIdx === -1) return;
    const removeAt = session.msgs.length - 1 - lastAssistantIdx;
    const historyMsgs = session.msgs.slice(0, removeAt);
    if (!historyMsgs.length) return;

    const replyId = `m-${Date.now()}`;
    const replyMsg: ChatMessage = {
      id: replyId,
      role: "assistant",
      content: "",
      ts: new Date().toISOString(),
    };
    setSession((s) => ({ ...s, msgs: [...historyMsgs, replyMsg] }));
    setBusy(true);
    await streamReply(historyMsgs, replyId);
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
          padding: "16px 16px 4px",
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
            // retry 只对最后一条 assistant 显示 (并且不是 streaming 中)
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
                onRetry={isLastAssistant ? retryLast : undefined}
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
          padding: "6px 10px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)",
          borderTop: `0.4px solid ${p.hairline}`,
          background:
            theme === "day"
              ? "rgba(251,245,240,0.92)"
              : "rgba(10,5,6,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
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
          onClick={send}
          disabled={busy || !draft.trim()}
          aria-label="send"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            background: draft.trim() ? p.accent : `${p.accent}55`,
            color: theme === "day" ? "#fff" : "#1a0e08",
            cursor: draft.trim() ? "pointer" : "default",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ↑
        </button>
      </div>
    </main>
  );
}

// ============================================
// MessageItem
// ============================================

function MessageItem({
  msg,
  palette,
  showTs,
  onCopy,
  onRetry,
}: {
  msg: ChatMessage;
  palette: ChatPalette;
  showTs: boolean;
  onCopy: () => void;
  onRetry?: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
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
            textAlign: isUser ? "right" : "left",
            // user CC 风气泡; assistant 纯文本无气泡
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
          {msg.content || (
            <span style={{ color: p.inkMute, fontStyle: "italic" }}>...</span>
          )}
        </div>
      </div>
      {showActions && (
        <div
          style={{
            display: "flex",
            justifyContent: isUser ? "flex-end" : "flex-start",
            marginTop: 4,
            gap: 8,
          }}
        >
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
