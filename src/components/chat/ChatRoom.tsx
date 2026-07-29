"use client";

// ARCVS chat.
//
// One screen in three readings: night (gold on near-black), day (rose on warm
// paper) and either of those with round avatars beside the bubbles. Day and
// night are the same tree under two palettes — the sun/moon control swaps the
// palette object, nothing about layout moves. Avatars are a switch, not a
// separate screen.
//
// Fixed meanings, applied to every element: rose is me and sits right, gold is
// the other voice and sits left, grey is the system.
//
// Generation goes through ChatProvider (see lib/chat-provider.ts) — the browser
// calling a model endpoint directly, or this deployment's Claude CLI. The UI
// does not branch on which; picking a profile picks the backend.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EmptyRose } from "@/components/EmptyRose";
import { chatStore, memoryStore } from "@/lib/stores";
import {
  friendlyLLMError,
  llmGenerate,
  loadLLMSettings,
  setActiveModel,
  type LLMSettings,
} from "@/lib/llm-client";
import {
  isProviderConfigured,
  probeP,
  probeCodex,
  pProfile,
  codexProfile,
  readActiveProviderChoice,
  resolveProvider,
  writeActiveProviderChoice,
  type ChatTurn,
  type PCapability,
  type ToolEvent,
  type Usage,
} from "@/lib/chat-provider";
import { buildSystemMessage, getSystemContextStats } from "@/lib/system-prompt";
import { readCoreChat, writeCoreChat, readCoreThreads, deleteCoreChat } from "@/lib/kimi-core-client";
import { isCoreBackend } from "@/lib/backend-mode";
import {
  chatImageUrl,
  detectLink,
  fetchLinkPreview,
  putChatImage,
  type ChatImage,
  type LinkPreview,
} from "@/lib/chat-media";
import {
  ARCVS_KEYFRAMES,
  FONT_CN,
  FONT_LATIN,
  ONUM,
  paletteFor,
  SEND_ART,
  type ChatTheme,
  type Palette,
} from "./arcvs/tokens";
import {
  ToolLine,
  ActionMarks,
  Avatar,
  Cogitatio,
  CostBar,
  ImageBubble,
  LinkCard,
  type CostStats,
} from "./arcvs/parts";
import {
  BackChevron,
  FourPointStar,
  MoonMark,
  PhotoMark,
  RingGauge,
  StopMark,
  SunMark,
} from "./arcvs/icons";

// Grow a textarea to fit its content, between one line and maxPx px. Height is
// zeroed before reading scrollHeight — "auto" leaves the element at its current
// size in a flex row, so the measurement would only ever ratchet upward.
function useAutoResize(value: string, minPx = 20, maxPx = 160) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minPx), maxPx)}px`;
  }, [value, minPx, maxPx]);
  return ref;
}

// ============================================
// types
// ============================================

// One candidate for a reply. The top-level content/thinking/cost/coreId mirror
// the selected candidate — rendering, storage and core merge all read the top
// level, and swipes is only the pool. A single-candidate reply has no pool.
type SwipeVariant = {
  content: string;
  thinking?: string;
  thinkingSec?: number;
  cost?: Usage;
  coreId?: string;
  tools?: ToolEvent[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  thinkingSec?: number;
  tools?: ToolEvent[];
  cost?: Usage;
  ts: string;
  coreId?: string;
  swipes?: SwipeVariant[];
  swipeIndex?: number;
  /** A picture sent from the composer. Pixels live in IndexedDB. */
  image?: ChatImage;
  /** A link posted on its own, rendered as a card. */
  link?: LinkPreview;
};

type SessionState = {
  sessionId: string;
  startedAt: string;
  msgs: ChatMessage[];
  /**
   * One CLI session per backend, because they are different machines' idea of
   * the same conversation and their ids are not interchangeable — handing a
   * Claude session id to `codex exec resume` just fails.
   */
  cliSessions?: Partial<Record<"p" | "codex", string>>;
  /**
   * Which backend produced the last turn. A CLI session only knows the turns it
   * ran itself, so after a switch its memory has a hole where the other backend
   * spoke. Resuming is therefore allowed only when the last turn was this same
   * backend; otherwise the turn starts a fresh CLI session with the visible
   * transcript inlined, which is what "it should know what we just said" means.
   */
  lastKind?: "direct" | "p" | "codex";
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
    const prior = local.find(
      (m) => (m.coreId && m.coreId === r.id) || (m.role === r.role && m.content === r.text),
    );
    return {
      id: `core-${r.id}`,
      coreId: r.id,
      role: r.role,
      content: r.text,
      ts: r.at,
      ...(prior?.thinking ? { thinking: prior.thinking, thinkingSec: prior.thinkingSec } : {}),
      ...(prior?.tools ? { tools: prior.tools } : {}),
      ...(prior?.cost ? { cost: prior.cost } : {}),
      ...(prior?.image ? { image: prior.image } : {}),
      ...(prior?.link ? { link: prior.link } : {}),
      ...(prior?.swipes ? { swipes: prior.swipes, swipeIndex: prior.swipeIndex } : {}),
    };
  });
  const newestCoreAt = rows.length ? rows[rows.length - 1].at : "";
  for (const m of local) {
    if (m.ts > newestCoreAt && !merged.some((x) => x.role === m.role && x.content === m.content)) {
      merged.push(m);
    }
  }
  return merged;
}

// ============================================
// localStorage keys
// ============================================

const HEADER_LABEL_KEY = "kimi-web:chat:headerLabel";
const SESSION_KEY = "kimi-web:chat:session";
const THEME_KEY = "kimi-web:chat:theme";
const BG_KEY = "kimi-web:chat:bg";
const BG_FIT_KEY = "kimi-web:chat:bgFit";
const AVATAR_ON_KEY = "kimi-web:chat:avatars";
const AVATAR_SRC_KEY = "kimi-web:chat:avatarIds";
const SPEND_KEY = "kimi-web:chat:spend";
const CONTEXT_MAX_KEY = "kimi-web:chat:contextMax";
const FONT_SCALE_KEY = "kimi-web:chat:fontScale";

/**
 * Body size. 12px is the original step; the rest scale off it. Bubble text and
 * COGITATIO follow; the latin small-caps labels do not — those are a scale, not
 * something to read, and enlarging them only breaks the rows apart.
 */
const FONT_SCALES = [
  { id: 0.88, label: "小" },
  { id: 1, label: "中" },
  { id: 1.15, label: "大" },
  { id: 1.32, label: "特大" },
] as const;
const BASE_FS = 12;

// ============================================
// background options (从 public/images/mood)
// ============================================

const BG_OPTIONS = [
  { id: "none", label: "无", url: null },
  { id: "paris", label: "paris", url: "/images/mood/paris.jpg" },
  { id: "vienna", label: "vienna", url: "/images/mood/vienna.jpg" },
  { id: "ribbon", label: "ribbon", url: "/images/mood/ribbon.jpg" },
  { id: "kintsugi", label: "kintsugi", url: "/images/mood/kintsugi-blossom.jpg" },
  { id: "lilies", label: "lilies", url: "/images/mood/lilies-stairs.jpg" },
  { id: "peony", label: "peony", url: "/images/mood/peony-scroll.jpg" },
  { id: "white-rose", label: "rose", url: "/images/mood/white-rose.jpg" },
];

/** How a mood picture meets the screen. */
type BgFit = "adapt" | "fill";

function autoTheme(): ChatTheme {
  if (typeof window === "undefined") return "night";
  const h = new Date().getHours();
  return h >= 6 && h < 18 ? "day" : "night";
}

/**
 * One utterance, cut into bubbles at its blank lines.
 *
 * A wall of text is a letter, not speech. People say long things in pieces with
 * pauses between them, so the break follows the paragraphing the writer already
 * put there — no guessing at sentence ends, no fixed length, only the blank line
 * they left themselves.
 *
 * The bracket corners belong to the group rather than each piece: top-left on
 * the first, bottom-right on the last. One utterance is bracketed once.
 *
 * While streaming this falls out on its own — a new bubble appears when the text
 * reaches the next blank line.
 */
function splitParagraphs(text: string): string[] {
  const parts = text.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean);
  return parts.length ? parts : [text];
}

/** How long a link scrape may hold up a turn before it is sent without one. */
const LINK_WAIT_MS = 2500;

/**
 * What one message looks like to the model.
 *
 * The card is drawn for her — thumbnail, title, site all sit in the interface.
 * The model sees none of that; it receives this string. So a scraped title has
 * to be folded in here, or what arrives is a bare URL: not openable, not
 * identifiable, guessable only from its own characters.
 *
 * The URL itself is not repeated — her own line already contains it.
 *
 * A picture is still only announced, not shown: every backend here takes a
 * plain string, so there is nowhere to put the pixels yet.
 */
function turnText(m: { content: string; image?: ChatImage; link?: LinkPreview }): string {
  if (m.link) {
    const head = [m.link.title, m.link.site].filter(Boolean).join(" · ");
    if (head) return m.content ? `${m.content}\n\n[link · ${head}]` : `[link · ${head}]\n${m.link.url}`;
    return m.content || m.link.url;
  }
  if (!m.content && m.image) return "(图片)";
  return m.content;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================
// component
// ============================================

export function ChatRoom() {
  const [theme, setTheme] = useState<ChatTheme>("night");
  const [bgId, setBgId] = useState<string>("none");
  const [bgFit, setBgFit] = useState<BgFit>("adapt");
  const [avatarsOn, setAvatarsOn] = useState(false);
  const [avatarIds, setAvatarIds] = useState<{ me?: string; them?: string }>({});
  const [avatarUrls, setAvatarUrls] = useState<{ me?: string; them?: string }>({});
  const [headerLabel, setHeaderLabel] = useState<string>("他");
  const [editingHeader, setEditingHeader] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [sysStats, setSysStats] = useState<{
    spChars: number;
    memInjectOn: boolean;
    memTotalActive: number;
  } | null>(null);

  const [session, setSession] = useState<SessionState>(() => ({
    sessionId: `session-${Date.now()}`,
    startedAt: new Date().toISOString(),
    msgs: [],
  }));
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState("");
  const draftRef = useAutoResize(draft);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  /** Object URL for a self-imported background; resolved from IndexedDB on load. */
  const [ownBgUrl, setOwnBgUrl] = useState<string | undefined>(undefined);
  const avatarSlotRef = useRef<"me" | "them">("me");

  const threadRef = useRef(session.sessionId);
  useEffect(() => {
    threadRef.current = session.sessionId;
  }, [session.sessionId]);
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // ── providers ──
  const [llmSettings, setLlmSettings] = useState<LLMSettings | null>(null);
  const [pCap, setPCap] = useState<PCapability | null>(null);
  const [codexCap, setCodexCap] = useState<PCapability | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [providerTick, setProviderTick] = useState(0); // re-read the choice after a pick
  useEffect(() => {
    setLlmSettings(loadLLMSettings());
    void probeP().then(setPCap);
    void probeCodex().then(setCodexCap);
  }, []);
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
  const thinkStartRef = useRef<number | null>(null);

  // ── swipe → core 时间线的 debounced 同步 ──
  const swipeSyncTimer = useRef<number | null>(null);
  const pendingSwipeSync = useRef(false);

  // ── cost bar ──
  const [spendToday, setSpendToday] = useState<number | null>(null);
  const [contextMax, setContextMax] = useState(200_000);
  const [fontScale, setFontScale] = useState(1);

  useEffect(() => {
    if (!showDrawer) return;
    void getSystemContextStats().then(setSysStats);
  }, [showDrawer]);

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
      const fit = localStorage.getItem(BG_FIT_KEY);
      if (fit === "adapt" || fit === "fill") setBgFit(fit);
      setAvatarsOn(localStorage.getItem(AVATAR_ON_KEY) === "1");
      const cm = Number(localStorage.getItem(CONTEXT_MAX_KEY));
      if (cm > 0) setContextMax(cm);
      const fs = Number(localStorage.getItem(FONT_SCALE_KEY));
      if (FONT_SCALES.some((f) => f.id === fs)) setFontScale(fs);
      try {
        const ids = JSON.parse(localStorage.getItem(AVATAR_SRC_KEY) ?? "{}") as {
          me?: string;
          them?: string;
        };
        setAvatarIds(ids);
      } catch {}
      try {
        const spend = JSON.parse(localStorage.getItem(SPEND_KEY) ?? "{}") as {
          day?: string;
          usd?: number;
        };
        if (spend.day === todayKey() && typeof spend.usd === "number") setSpendToday(spend.usd);
      } catch {}
    } catch {}
  }, []);

  // Resolve avatar blobs → object urls. A slot may also hold a plain path
  // ("/images/…") for a deployment that ships portraits in public/ instead of
  // having someone pick them on the device.
  useEffect(() => {
    let alive = true;
    const resolve = async (id?: string) => {
      if (!id) return undefined;
      if (id.startsWith("/") || id.startsWith("http")) return id;
      return (await chatImageUrl(id)) ?? undefined;
    };
    void (async () => {
      const next = { me: await resolve(avatarIds.me), them: await resolve(avatarIds.them) };
      if (alive) setAvatarUrls(next);
    })();
    return () => {
      alive = false;
    };
  }, [avatarIds]);

  // thread resolution (URL param → core → localStorage)
  useEffect(() => {
    try {
      const sessionParam = searchParams.get("session");
      const newParam = searchParams.get("new");

      if (newParam === "1") {
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
        // ── DEPLOYER KNOB ── to change the no-param default, edit the `else` branch:
        //   • most-recent thread  — default, below (best for multi-device / one person)
        //   • always blank / new  — replace its body with: setSession((s) => ({ ...s, msgs: [] }))
        //   • device-local last   — read localStorage SESSION_KEY instead (single-device)
        const openThread = (tid: string) =>
          readCoreChat({ threadId: tid, take: 200 }).then((rows) => {
            setSession((s) => ({
              sessionId: tid,
              startedAt: rows[0]?.at ?? new Date().toISOString(),
              cliSessions: s.sessionId === tid ? s.cliSessions : undefined,
              lastKind: s.sessionId === tid ? s.lastKind : undefined,
              msgs:
                s.sessionId === tid
                  ? mergeCoreRows(s.msgs, rows)
                  : rows.map((r) => ({
                      id: `core-${r.id}`,
                      coreId: r.id,
                      role: r.role,
                      content: r.text,
                      ts: r.at,
                    })),
            }));
          });
        if (sessionParam) {
          void openThread(sessionParam).catch(() => {});
        } else {
          void readCoreThreads({ limit: 1 })
            .then((ths) => {
              if (ths[0]) return openThread(ths[0].threadId);
              setSession((s) => ({ ...s, msgs: [] }));
            })
            .catch(() => {});
        }
        return;
      }

      if (sessionParam) {
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
            setSession({ sessionId: d.id, startedAt: d.createdAt, msgs });
          })
          .catch(() => {});
        return;
      }

      const ses = localStorage.getItem(SESSION_KEY);
      if (ses) {
        const parsed = JSON.parse(ses) as SessionState;
        if (parsed?.msgs?.length) setSession(parsed);
      }
    } catch {}
  }, [searchParams]);

  // Preferences are written where they change, not from an effect. Persisting
  // in an effect means the mount-time defaults get written before the values
  // read back from storage have landed, and a reload can come up with the
  // defaults it just saved over.
  const store = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }, []);

  const applyTheme = useCallback(
    (t: ChatTheme) => {
      setTheme(t);
      store(THEME_KEY, t);
    },
    [store],
  );
  const applyHeaderLabel = useCallback(
    (v: string) => {
      setHeaderLabel(v);
      store(HEADER_LABEL_KEY, v);
    },
    [store],
  );
  const applyBg = useCallback(
    (id: string) => {
      setBgId(id);
      store(BG_KEY, id);
    },
    [store],
  );
  const applyBgFit = useCallback(
    (f: BgFit) => {
      setBgFit(f);
      store(BG_FIT_KEY, f);
    },
    [store],
  );
  const applyAvatarsOn = useCallback(
    (v: boolean) => {
      setAvatarsOn(v);
      store(AVATAR_ON_KEY, v ? "1" : "0");
    },
    [store],
  );
  const applyAvatarIds = useCallback(
    (next: { me?: string; them?: string }) => {
      setAvatarIds(next);
      store(AVATAR_SRC_KEY, JSON.stringify(next));
    },
    [store],
  );

  // The session does come through an effect — it changes from a dozen places —
  // but the blank session the component mounts with is never written, so it
  // cannot land on top of a stored conversation before that conversation has
  // been read back.
  const mountSessionId = useRef(session.sessionId);
  useEffect(() => {
    if (!(session.sessionId === mountSessionId.current && session.msgs.length === 0)) {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch {}
    }
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session]);

  // auto-backup chat session to ChatStore IDB. Debounced 2s after last change.
  useEffect(() => {
    if (session.msgs.length === 0) return;
    const t = setTimeout(() => {
      const firstUser = session.msgs.find((m) => m.role === "user");
      void chatStore()
        .put({
          id: session.sessionId,
          source: "cc-chat",
          title: firstUser ? firstUser.content.slice(0, 60) : null,
          messages: session.msgs.map((m) => ({ role: m.role, content: m.content, ts: m.ts })),
          note: null,
          theme,
        })
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [session, theme]);

  // core mode: re-hydrate on focus so another device's messages appear.
  useEffect(() => {
    if (!isCoreBackend()) return;
    function refresh() {
      if (busy || pendingSwipeSync.current || document.visibilityState === "hidden") return;
      const tid = threadRef.current;
      void readCoreChat({ threadId: tid, take: 200 })
        .then((rows) => {
          if (!rows.length) return;
          setSession((s) => (s.sessionId === tid ? { ...s, msgs: mergeCoreRows(s.msgs, rows) } : s));
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

  const p = paletteFor(theme);
  // "own:<id>" is a picture the owner imported; the rest are the shipped set.
  const bg = useMemo(() => {
    if (bgId.startsWith("own:")) return { id: bgId, label: "自选", url: ownBgUrl ?? null };
    return BG_OPTIONS.find((b) => b.id === bgId) ?? BG_OPTIONS[0];
  }, [bgId, ownBgUrl]);

  // The stored id survives reloads; the blob URL does not, so it is remade.
  useEffect(() => {
    if (!bgId.startsWith("own:")) {
      setOwnBgUrl(undefined);
      return;
    }
    let alive = true;
    void chatImageUrl(bgId.slice(4)).then((u) => {
      if (alive) setOwnBgUrl(u ?? undefined);
    });
    return () => {
      alive = false;
    };
  }, [bgId]);
  const sendArt = SEND_ART[theme];
  const provider = useMemo(
    () => resolveProvider(pCap, codexCap),
    // llmSettings / providerTick both stand for "the pick may have changed"
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pCap, codexCap, llmSettings, providerTick],
  );

  // Cost bar. Cache share and price only exist when the backend reports them —
  // the -p backend does, a raw API endpoint mostly does not, and an absent
  // reading is left out of the bar rather than faked as zero.
  const costStats: CostStats = useMemo(() => {
    const lastCost = [...session.msgs].reverse().find((m) => m.cost)?.cost;
    const cacheRead = lastCost?.cacheReadTok ?? 0;
    const cacheCreate = lastCost?.cacheCreateTok ?? 0;
    const fresh = lastCost?.inTok ?? 0;
    const totalIn = cacheRead + cacheCreate + fresh;
    return {
      cacheHit: cacheRead > 0 && totalIn > 0 ? cacheRead / totalIn : null,
      contextUsed: totalIn + (lastCost?.outTok ?? 0),
      contextMax,
      spendToday,
    };
  }, [session.msgs, contextMax, spendToday]);

  function addSpend(usd: number) {
    setSpendToday((prev) => {
      const next = (prev ?? 0) + usd;
      try {
        localStorage.setItem(SPEND_KEY, JSON.stringify({ day: todayKey(), usd: next }));
      } catch {}
      return next;
    });
  }

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((n) => (n === msg ? null : n)), 2200);
  }, []);

  // ============================================
  // actions
  // ============================================

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

  async function streamReply(msgs: ChatMessage[], replyId: string, threadId?: string) {
    if (!provider || !isProviderConfigured(pCap)) {
      patchReply(replyId, {
        content: "(还没有可用的后端 · 进 /backstage/settings 填 API key，或在服务端开 CLAUDE_P_ENABLED=1 用本机 claude -p)",
      });
      setBusy(false);
      return;
    }
    const ac = new AbortController();
    abortRef.current = ac;
    thinkStartRef.current = Date.now();

    const acc = { text: "", thinking: "" };
    const toolMap = new Map<string, ToolEvent>();
    let flushTimer: number | null = null;
    const flush = () => {
      flushTimer = null;
      patchReply(replyId, {
        content: acc.text,
        thinking: acc.thinking || undefined,
        tools: toolMap.size ? [...toolMap.values()] : undefined,
      });
    };
    const scheduleFlush = () => {
      if (flushTimer == null) flushTimer = window.setTimeout(flush, 80);
    };

    try {
      const sys = await buildSystemMessage();
      const turns: ChatTurn[] = msgs
        .filter((m) => m.content.trim() || m.image || m.link)
        .map((m) => ({ role: m.role, content: turnText(m) }));

      const r = await provider.send(turns, {
        system: sys.text || undefined,
        signal: ac.signal,
        resumeId:
          (provider.kind === "p" || provider.kind === "codex") &&
          sessionRef.current.lastKind === provider.kind
            ? sessionRef.current.cliSessions?.[provider.kind]
            : undefined,
        onEvent: (e) => {
          if (e.type === "text") acc.text += e.delta;
          else if (e.type === "thinking") acc.thinking += e.delta;
          else if (e.type === "tool") toolMap.set(e.tool.id, e.tool);
          else if (e.type === "session") {
            const sid = e.sessionId;
            const k = provider.kind;
            if (k === "p" || k === "codex") {
              setSession((s) =>
                s.cliSessions?.[k] === sid
                  ? s
                  : { ...s, cliSessions: { ...s.cliSessions, [k]: sid } },
              );
            }
          }
          scheduleFlush();
        },
      });

      if (flushTimer != null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      const text = r.text?.trim() || "(空响应)";
      const thinkingSec = thinkStartRef.current
        ? Math.max(0, Math.round((Date.now() - thinkStartRef.current) / 1000))
        : undefined;
      patchReply(replyId, {
        content: text,
        thinking: r.thinking || acc.thinking || undefined,
        thinkingSec,
        cost: r.usage,
        tools: r.tools ?? (toolMap.size ? [...toolMap.values()] : undefined),
      });
      if (r.usage?.costUsd) addSpend(r.usage.costUsd);
      if (r.sessionId && (provider.kind === "p" || provider.kind === "codex")) {
        const sid = r.sessionId;
        const k = provider.kind;
        setSession((s) =>
          s.cliSessions?.[k] === sid ? s : { ...s, cliSessions: { ...s.cliSessions, [k]: sid } },
        );
      }
      setSession((s) => (s.lastKind === provider.kind ? s : { ...s, lastKind: provider.kind }));

      // Await the core persist before `finally` clears busy: while busy is true
      // the focus/visibility refresh bails, so this closes the window where a
      // refresh could read core (without this reply yet) and drop the message.
      if (r.text?.trim()) {
        const coreId = await writeCoreChat("assistant", r.text.trim(), threadId);
        if (coreId) patchReply(replyId, { coreId });
      }
    } catch (e) {
      if (flushTimer != null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if ((e as Error)?.name === "AbortError") {
        patchReply(replyId, {
          content: acc.text || "(停了 · 回拨或重来一次)",
          thinking: acc.thinking || undefined,
        });
        return;
      }
      console.error("[chat:provider]", e);
      const fe = friendlyLLMError(e);
      patchReply(replyId, { content: `⚠ ${fe.title}\n\n${fe.detail}\n\n→ ${fe.hint}` });
    } finally {
      abortRef.current = null;
      thinkStartRef.current = null;
      setBusy(false);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    const linkUrl = detectLink(text);
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

    // Scraped once, used twice: the card is drawn for her, and the title also
    // has to travel with this turn — otherwise the model receives a bare URL it
    // cannot open and cannot identify.
    //
    // Briefly awaited rather than awaited outright: a slow site should not hold
    // up her message, so past the deadline the turn goes without it and the
    // title only lands in the card.
    let msgs = nextMsgs;
    if (linkUrl) {
      const job = fetchLinkPreview(linkUrl).then((preview) => {
        if (preview) {
          setSession((s) => ({
            ...s,
            msgs: s.msgs.map((m) => (m.id === userMsg.id ? { ...m, link: preview } : m)),
          }));
        }
        return preview;
      });
      const preview = await Promise.race([
        job,
        new Promise<null>((r) => setTimeout(() => r(null), LINK_WAIT_MS)),
      ]);
      if (preview) {
        msgs = nextMsgs.map((m) => (m.id === userMsg.id ? { ...m, link: preview } : m));
      }
    }

    const threadId = session.sessionId;
    void writeCoreChat("user", text, threadId).then((coreId) => {
      if (coreId) {
        setSession((s) => ({
          ...s,
          msgs: s.msgs.map((m) => (m.id === userMsg.id ? { ...m, coreId } : m)),
        }));
      }
    });
    await streamReply(msgs, replyId, threadId);
  }

  async function pickImage(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(0);
    try {
      const img = await putChatImage(file, (f) => setUploading(f));
      const msg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: "user",
        content: "",
        image: img,
        ts: new Date().toISOString(),
      };
      setSession((s) => ({ ...s, msgs: [...s.msgs, msg] }));
    } catch (e) {
      console.error("[chat:image]", e);
      flash("图片没存上 · 再选一次");
    } finally {
      setUploading(null);
    }
  }

  /** Import a picture of one's own as the background. Stored like any chat
   *  image — downscaled into IndexedDB, never uploaded. */
  async function pickBackground(file: File) {
    if (!file.type.startsWith("image/")) return;
    try {
      const img = await putChatImage(file);
      applyBg(`own:${img.id}`);
    } catch {
      flash("背景没存上");
    }
  }

  async function pickAvatar(file: File) {
    if (!file.type.startsWith("image/")) return;
    try {
      const img = await putChatImage(file);
      applyAvatarIds({ ...avatarIds, [avatarSlotRef.current]: img.id });
    } catch {
      flash("头像没存上");
    }
  }

  function copyMsg(id: string) {
    const m = session.msgs.find((x) => x.id === id);
    if (!m) return;
    void navigator.clipboard
      .writeText(m.content || m.link?.url || "")
      .then(() => flash("已复制"))
      .catch(() => {});
  }

  // Re-roll the last reply. The old text goes into the candidate pool rather
  // than being lost; the new one streams in as a fresh candidate.
  // Core mode keeps only the selected candidate on the timeline: the old row is
  // deleted, the new one written when it lands, and swiping back re-syncs.
  async function regenerate(msgId?: string) {
    if (busy) return;
    const at = msgId
      ? session.msgs.findIndex((m) => m.id === msgId)
      : session.msgs.length - 1 - [...session.msgs].reverse().findIndex((m) => m.role === "assistant");
    if (at < 0 || at >= session.msgs.length) return;
    const cur = session.msgs[at];
    if (cur.role !== "assistant") return;
    const historyMsgs = session.msgs.slice(0, at);
    if (!historyMsgs.length) return;

    const pool: SwipeVariant[] =
      cur.swipes ??
      (cur.content
        ? [
            {
              content: cur.content,
              thinking: cur.thinking,
              thinkingSec: cur.thinkingSec,
              cost: cur.cost,
              coreId: cur.coreId,
              tools: cur.tools,
            },
          ]
        : []);
    const swipes = [...pool, { content: "" }];
    const swipeIndex = swipes.length - 1;

    if (cur.coreId) {
      void deleteCoreChat(cur.coreId);
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
          thinkingSec: undefined,
          cost: undefined,
          tools: undefined,
          coreId: undefined,
          swipes,
          swipeIndex,
        },
      ],
    }));
    setBusy(true);
    await streamReply(historyMsgs, cur.id, session.sessionId);
  }

  function switchSwipe(msgId: string, dir: 1 | -1) {
    if (busy) return;
    const m = session.msgs.find((x) => x.id === msgId);
    if (!m) return;
    const pool = m.swipes;
    if (!pool || pool.length === 0) {
      if (dir === 1) void regenerate(msgId);
      return;
    }
    const cur = m.swipeIndex ?? 0;
    const next = cur + dir;
    if (next < 0) return;
    if (next >= pool.length) {
      void regenerate(msgId);
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
              thinkingSec: v.thinkingSec,
              cost: v.cost,
              tools: v.tools,
              coreId: v.coreId,
              swipeIndex: next,
            }
          : x,
      ),
    }));
    scheduleSwipeSync(msgId);
  }

  // 2s after the last switch (so a run of taps collapses into one), align the
  // core timeline with the selected candidate: delete rows left by the others,
  // write one for the selection if it has none. pendingSwipeSync blocks the
  // focus refresh so an old row cannot come back over the new selection.
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
      const staleIds = m.swipes.filter((v, i) => i !== idx && v.coreId).map((v) => v.coreId!);
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

  /**
   * FVRCA — branch. Everything up to and including this message becomes a new
   * thread and the view moves there; the original is untouched and still in the
   * history list. No confirmation: nothing is lost.
   */
  async function forkFrom(msgId: string) {
    const at = session.msgs.findIndex((m) => m.id === msgId);
    if (at < 0) return;
    const kept = session.msgs.slice(0, at + 1).map((m, i) => ({
      ...m,
      id: `fk-${i}-${Date.now()}`,
      coreId: undefined,
    }));
    const newId = `session-${Date.now()}`;
    // A branch starts its own CLI session: resuming the parent's would make the
    // model continue the transcript we just cut away from.
    setSession({
      sessionId: newId,
      startedAt: new Date().toISOString(),
      msgs: kept,
      cliSessions: undefined,
      lastKind: undefined,
    });
    if (isCoreBackend()) {
      for (const m of kept) {
        if (m.content.trim()) await writeCoreChat(m.role, m.content.trim(), newId);
      }
    }
    flash("分叉了 · 这是新的一支");
  }

  /**
   * RETRO — rewind. Drops this reply and everything after it, and puts the
   * message that prompted it back in the composer. The one action that asks
   * first, because it removes turns.
   */
  function rewindTo(msgId: string) {
    const at = session.msgs.findIndex((m) => m.id === msgId);
    if (at < 0) return;
    const dropped = session.msgs.length - at;
    if (!confirm(`回拨到这里 · 之后的 ${dropped} 条会去掉 (自己那句回到输入框). 确定?`)) return;

    // Walk back to the user turn that produced this reply, so rewinding lands
    // with that text editable rather than re-sending it blind.
    let cut = at;
    let restored = "";
    for (let i = at; i >= 0; i--) {
      if (session.msgs[i].role === "user") {
        cut = i;
        restored = session.msgs[i].content;
        break;
      }
    }
    const removed = session.msgs.slice(cut);
    for (const m of removed) {
      if (m.coreId) void deleteCoreChat(m.coreId);
      for (const v of m.swipes ?? []) if (v.coreId) void deleteCoreChat(v.coreId);
    }
    setSession((s) => ({
      ...s,
      msgs: s.msgs.slice(0, cut),
      // The CLI session still holds the removed turns; drop the handle so the
      // next send starts a session that matches what is on screen.
      cliSessions: undefined,
      lastKind: undefined,
    }));
    if (restored) setDraft(restored);
  }

  /**
   * A fresh window and nothing else: no summary, no memory write, no backend.
   * The old session stays in the chat store, so the history page can reach it —
   * nothing is lost, which is why there is no confirm.
   */
  function freshWindow() {
    setSession({
      sessionId: `session-${Date.now()}`,
      startedAt: new Date().toISOString(),
      msgs: [
        {
          id: `m-${Date.now()}`,
          role: "assistant",
          content: "新窗. 接着说.",
          ts: new Date().toISOString(),
        },
      ],
    });
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
      if (session.msgs.length >= 2 && isProviderConfigured(pCap)) {
        try {
          const transcript = session.msgs.map((m) => `[${m.role}] ${m.content}`).join("\n\n");
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
        await memoryStore().put({
          key: title,
          content: session.msgs.map((m) => `[${m.role}] ${m.content}`).join("\n\n"),
          order: 0,
          active: true,
          tags: ["chat-closeout"],
          reviewStatus: "pending",
        });
      }
      try {
        await chatStore().delete(session.sessionId);
      } catch {}
      setSession({
        sessionId: `session-${Date.now()}`,
        startedAt: new Date().toISOString(),
        msgs: [
          {
            id: `m-${Date.now()}`,
            role: "assistant",
            content: title ? `新窗. 上次存为 "${title}". 接着说.` : "新窗. 接着说.",
            ts: new Date().toISOString(),
          },
        ],
      });
    } catch (e) {
      console.error("[chat:closeout]", e);
      flash("closeout 失败");
    } finally {
      setBusy(false);
    }
  }

  // ============================================
  // render
  // ============================================

  const lastAssistantId = useMemo(() => {
    for (let i = session.msgs.length - 1; i >= 0; i--) {
      if (session.msgs[i].role === "assistant") return session.msgs[i].id;
    }
    return null;
  }, [session.msgs]);

  return (
    <main
      style={
        {
          position: "fixed",
          inset: 0,
          background: p.bg,
          color: p.ink,
          fontFamily: FONT_LATIN,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          // Set once here; the places that read it follow (bubble body,
          // COGITATIO). A variable rather than a prop because those places sit
          // in two different files, and threading it would run the wire through
          // everything in between.
          "--kimi-chat-fs": `${(BASE_FS * fontScale).toFixed(1)}px`,
        } as React.CSSProperties
      }
    >
      <style>{ARCVS_KEYFRAMES}</style>

      {/* mood picture. "adapt" shows the whole frame over a blurred bleed of
          itself, so nothing is cropped away and the edges still reach the
          screen; "fill" is the old crop-to-cover for anyone who prefers it. */}
      {bg.url && (
        <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
          {bgFit === "adapt" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${bg.url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(38px) saturate(120%)",
                transform: "scale(1.12)",
                opacity: theme === "day" ? 0.16 : 0.2,
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${bg.url})`,
              backgroundSize: bgFit === "adapt" ? "contain" : "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              opacity: theme === "day" ? 0.18 : 0.22,
              mixBlendMode: theme === "day" ? "multiply" : "screen",
            }}
          />
        </div>
      )}
      {/* the warm wash at the head of the page */}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: p.glow, zIndex: 0, pointerEvents: "none" }} />
      {/* rising dust — the one purely atmospheric layer, gone under reduced motion */}
      <div
        className="arcvs-dust"
        aria-hidden
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 280, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}
      >
        <span
          className="arcvs-anim"
          style={{
            position: "absolute",
            left: "18%",
            bottom: 30,
            width: 2.2,
            height: 2.2,
            borderRadius: "50%",
            background: theme === "day" ? "rgba(176,64,99,.7)" : "rgba(230,205,150,.9)",
            boxShadow: theme === "day" ? "0 0 6px rgba(176,64,99,.4)" : "0 0 6px rgba(230,205,150,.7)",
            animation: "arcvs-dustrise 16s linear infinite",
          }}
        />
        <span
          className="arcvs-anim"
          style={{
            position: "absolute",
            left: "84%",
            bottom: 44,
            width: 2,
            height: 2,
            borderRadius: "50%",
            background: theme === "day" ? "rgba(176,64,99,.55)" : "rgba(210,138,161,.8)",
            boxShadow: "0 0 6px rgba(210,138,161,.5)",
            animation: "arcvs-dustrise2 21s linear infinite 6s",
          }}
        />
      </div>

      {/* header */}
      <header
        style={{
          position: "relative",
          zIndex: 3,
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 11,
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)",
          paddingBottom: 10,
          paddingLeft: 18,
          paddingRight: 18,
        }}
      >
        <Link href="/room" aria-label="back" style={{ display: "flex", flex: "none", textDecoration: "none" }}>
          <BackChevron color={p.theme === "day" ? p.roseDim : p.gold} />
        </Link>

        {avatarsOn && (
          <div style={{ display: "flex", flex: "none" }}>
            <Avatar p={p} mine={false} src={avatarUrls.them} size={30} style={{ zIndex: 2 }} />
            <Avatar p={p} mine src={avatarUrls.me} size={30} style={{ marginLeft: -8 }} />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => {
          if (!editingHeader) {
            setDraftLabel(headerLabel);
            setEditingHeader(true);
          }
        }}>
          {editingHeader ? (
            <input
              autoFocus
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              onBlur={() => {
                if (draftLabel.trim()) applyHeaderLabel(draftLabel.trim());
                setEditingHeader(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (draftLabel.trim()) applyHeaderLabel(draftLabel.trim());
                  setEditingHeader(false);
                } else if (e.key === "Escape") setEditingHeader(false);
              }}
              style={{
                fontSize: 14,
                letterSpacing: 6,
                color: p.ink,
                background: "transparent",
                border: "none",
                borderBottom: `0.6px solid ${p.gold}`,
                outline: "none",
                fontFamily: FONT_CN,
                width: 140,
                padding: "1px 0",
              }}
            />
          ) : (
            <>
              <div style={{ fontFamily: FONT_CN, fontSize: 14, letterSpacing: 6, color: p.ink }}>
                {headerLabel}
              </div>
              <div style={{ fontSize: 6.5, letterSpacing: 2.5, color: p.theme === "day" ? p.roseDim : p.goldDim }}>
                {provider ? provider.label.toUpperCase() : "NVLLVS · 未配置后端"}
              </div>
            </>
          )}
        </div>

        {/* sun / moon — one screen, two colourways */}
        <button
          type="button"
          onClick={() => applyTheme(theme === "day" ? "night" : "day")}
          aria-label={theme === "day" ? "夜" : "昼"}
          style={{
            flex: "none",
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: `1px solid ${p.rule}`,
            background: p.theme === "day" ? "rgba(252,247,239,.85)" : "rgba(12,8,5,.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {theme === "day" ? <MoonMark color={p.roseDim} /> : <SunMark color={p.warn} />}
        </button>
        <button
          type="button"
          onClick={() => setShowDrawer((v) => !v)}
          aria-label="设置"
          style={{
            flex: "none",
            width: 30,
            height: 38,
            background: "transparent",
            border: "none",
            color: p.inkSoft,
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          ⋯
        </button>
      </header>

      {/* MEMORIA — always at the head, never a popover */}
      <div style={{ position: "relative", zIndex: 3 }}>
        <CostBar p={p} stats={costStats} />
      </div>

      {showDrawer && (
        <SettingsDrawer
          p={p}
          theme={theme}
          bgId={bgId}
          bgFit={bgFit}
          avatarsOn={avatarsOn}
          avatarUrls={avatarUrls}
          contextMax={contextMax}
          sysStats={sysStats}
          onBg={applyBg}
          onImportBg={() => bgFileRef.current?.click()}
          onBgFit={applyBgFit}
          onAvatars={applyAvatarsOn}
          onPickAvatar={(slot) => {
            avatarSlotRef.current = slot;
            avatarFileRef.current?.click();
          }}
          onClearAvatar={(slot) => applyAvatarIds({ ...avatarIds, [slot]: undefined })}
          fontScale={fontScale}
          onFontScale={(v) => {
            setFontScale(v);
            store(FONT_SCALE_KEY, String(v));
          }}
          onContextMax={(n) => {
            setContextMax(n);
            store(CONTEXT_MAX_KEY, String(n));
          }}
          onCloseout={newWindow}
          onFresh={freshWindow}
          closeoutReady={isProviderConfigured(pCap)}
        />
      )}

      {/* messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "12px 16px 12px 12px",
          position: "relative",
          zIndex: 1,
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
          display: "flex",
          flexDirection: "column",
          gap: 11,
        }}
      >
        {/* the spine — only in the no-avatar reading, where the node dots hang on it */}
        {!avatarsOn && session.msgs.length > 0 && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 21,
              top: 8,
              bottom: 8,
              width: 1,
              background: `linear-gradient(180deg, transparent, ${p.ruleSoft} 12%, ${p.ruleSoft} 88%, transparent)`,
              pointerEvents: "none",
            }}
          />
        )}

        {session.msgs.length === 0 && !busy ? (
          <EmptyRose message="今天还没说话 · 写一句" palette="gothic" />
        ) : (
          session.msgs.map((m, i) => {
            const prev = session.msgs[i - 1];
            const showTs =
              !prev || new Date(m.ts).getTime() - new Date(prev.ts).getTime() > 5 * 60 * 1000;
            const streaming = busy && m.role === "assistant" && m.id === lastAssistantId;
            return (
              <MessageItem
                key={m.id}
                msg={m}
                p={p}
                avatarsOn={avatarsOn}
                avatarUrl={m.role === "user" ? avatarUrls.me : avatarUrls.them}
                showTs={showTs}
                streaming={streaming}
                thinkStartedAt={streaming ? (thinkStartRef.current ?? undefined) : undefined}
                onCopy={() => copyMsg(m.id)}
                onFork={() => void forkFrom(m.id)}
                onRewind={() => rewindTo(m.id)}
                onSwipe={
                  m.role === "assistant" && !busy ? (dir) => switchSwipe(m.id, dir) : undefined
                }
              />
            );
          })
        )}
        {busy && !session.msgs.some((m) => m.id === lastAssistantId && m.content) && (
          <div style={{ paddingLeft: avatarsOn ? 40 : 29 }}>
            <Cogitatio p={p} streaming startedAt={thinkStartRef.current ?? undefined} />
          </div>
        )}
      </div>

      {notice && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 96,
            zIndex: 8,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontFamily: FONT_CN,
              fontSize: 10,
              letterSpacing: 1,
              color: p.ink,
              background: p.theme === "day" ? "rgba(252,247,239,.94)" : "rgba(20,14,9,.92)",
              border: `1px solid ${p.rule}`,
              borderRadius: 999,
              padding: "5px 14px",
              boxShadow: p.panelShadow,
            }}
          >
            {notice}
          </span>
        </div>
      )}

      {/* composer */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          flex: "none",
          borderTop: `1px solid ${p.rule}`,
          background: p.chrome,
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
        }}
      >
        <ModelSwitcher
          p={p}
          settings={llmSettings}
          cap={pCap}
          codexCap={codexCap}
          open={showModelPicker}
          onToggle={() => setShowModelPicker((v) => !v)}
          onPickDirect={(pid, model) => {
            writeActiveProviderChoice("direct", model);
            setActiveModel(pid, model);
            setLlmSettings(loadLLMSettings());
            setProviderTick((n) => n + 1);
            setShowModelPicker(false);
          }}
          onPickP={(model) => {
            writeActiveProviderChoice("p", model);
            setProviderTick((n) => n + 1);
            setShowModelPicker(false);
          }}
          onPickCodex={(model) => {
            writeActiveProviderChoice("codex", model);
            setProviderTick((n) => n + 1);
            setShowModelPicker(false);
          }}
        />
        <div
          style={{
            display: "flex",
            // bottom-aligned so the two round keys stay put as the field grows
            alignItems: "flex-end",
            gap: 9,
            padding: "6px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)",
          }}
        >
          {/* picture port */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="发图片"
            disabled={uploading != null}
            style={{
              flex: "none",
              width: 42,
              height: 42,
              borderRadius: "50%",
              border: `1px solid ${p.rule}`,
              background: p.fieldBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: uploading != null ? "default" : "pointer",
              position: "relative",
            }}
          >
            {uploading != null ? (
              <RingGauge color={p.gold} track={p.ruleSoft} frac={uploading} size={20} width={2} />
            ) : (
              <PhotoMark color={p.theme === "day" ? p.roseDim : p.gold} />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickImage(f);
              e.target.value = "";
            }}
          />
          <input
            ref={avatarFileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickAvatar(f);
              e.target.value = "";
            }}
          />
          <input
            ref={bgFileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickBackground(f);
              e.target.value = "";
            }}
          />

          <div
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 21,
              border: `1px solid ${p.fieldBorder}`,
              background: p.fieldBg,
              display: "flex",
              alignItems: "center",
              padding: "10px 16px",
              boxSizing: "border-box",
            }}
          >
            <textarea
              ref={draftRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="写一句…"
              rows={1}
              style={{
                flex: 1,
                minWidth: 0,
                display: "block",
                background: "transparent",
                color: p.ink,
                border: "none",
                outline: "none",
                resize: "none",
                overflowY: "auto",
                fontFamily: FONT_CN,
                fontSize: 12,
                lineHeight: 1.7,
                padding: 0,
                margin: 0,
                boxSizing: "content-box",
                maxHeight: 160,
              }}
            />
          </div>

          <button
            type="button"
            onClick={busy ? stopStreaming : () => void send()}
            disabled={!busy && !draft.trim()}
            aria-label={busy ? "停" : "发送"}
            style={{
              flex: "none",
              width: 42,
              height: 42,
              borderRadius: "50%",
              // Art with its own ground stands alone; the drawn mark, and art
              // that fades at the edge, need a line to still read as a button.
              border:
                sendArt && !busy
                  ? sendArt.ring === "none"
                    ? "none"
                    : `1px solid ${p.theme === "day" ? "rgba(176,64,99,.45)" : "rgba(230,205,150,.55)"}`
                  : `1px solid ${busy || draft.trim() ? p.bubbleThemCorner : p.rule}`,
              background: p.theme === "day" ? "rgba(252,247,239,.92)" : "rgba(13,10,7,.8)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: busy || draft.trim() ? "pointer" : "default",
              position: "relative",
              opacity: busy || draft.trim() ? 1 : 0.5,
            }}
          >
            {!sendArt && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: -4,
                  borderRadius: "50%",
                  border: `1px dashed ${p.ruleSoft}`,
                }}
              />
            )}
            {busy ? (
              <StopMark color={p.theme === "day" ? p.roseHi : p.goldHi} />
            ) : sendArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sendArt.src}
                alt=""
                style={{
                  position: "absolute",
                  inset: -1,
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  display: "block",
                }}
              />
            ) : (
              <FourPointStar color={p.theme === "day" ? p.roseHi : p.goldHi} />
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

// ============================================
// ModelSwitcher
// ============================================

// One thin line above the composer: the active backend and model. Opening it
// lists every configured profile, plus the local `claude -p` option when the
// server says it exists. When it does not, the option is not in the list at
// all — not greyed out, not there.
function ModelSwitcher({
  p,
  settings,
  cap,
  open,
  onToggle,
  onPickDirect,
  onPickP,
  onPickCodex,
  codexCap,
}: {
  p: Palette;
  settings: LLMSettings | null;
  cap: PCapability | null;
  codexCap: PCapability | null;
  open: boolean;
  onToggle: () => void;
  onPickDirect: (profileId: string, model: string) => void;
  onPickP: (model: string) => void;
  onPickCodex: (model: string) => void;
}) {
  const profiles = settings?.profiles ?? [];
  const withModels = profiles.filter((pf) => pf.models.length > 0);
  const choice = typeof window !== "undefined" ? readActiveProviderChoice() : { kind: "direct" as const, model: "" };
  const active = profiles.find((pf) => pf.id === settings?.activeProfileId) ?? profiles[0];
  const activeModel = settings?.activeModel || active?.models[0] || "";
  const pOn = !!cap?.enabled;
  const codexOn = !!codexCap?.enabled;

  const label =
    choice.kind === "codex" && codexOn
      ? `codex · ${choice.model || "本机"}`
      : choice.kind === "p" && pOn
        ? `claude -p · ${choice.model || cap?.models?.[0] || "sonnet"}`
        : active
          ? `${active.name || "未命名"} · ${activeModel || "no model"}`
          : "配置后端";

  const group = {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: p.inkMute,
    padding: "4px 4px 2px",
    fontFamily: FONT_LATIN,
  };
  const item = (isActive: boolean) => ({
    display: "block",
    width: "100%",
    textAlign: "left" as const,
    padding: "5px 8px",
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    color: isActive ? (p.theme === "day" ? p.roseHi : p.goldHi) : p.inkSoft,
    background: isActive ? (p.theme === "day" ? "rgba(176,64,99,.08)" : "rgba(230,205,150,.09)") : "transparent",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  });

  return (
    <div style={{ position: "relative", padding: "4px 16px 0" }}>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 12,
            right: 12,
            maxHeight: 320,
            overflowY: "auto",
            background: p.theme === "day" ? "rgba(252,247,239,.97)" : "rgba(16,11,7,.95)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            border: `1px solid ${p.rule}`,
            borderRadius: 12,
            padding: "8px 10px",
            boxShadow: p.panelShadow,
            zIndex: 9,
          }}
        >
          {pOn && (
            <div style={{ marginBottom: 8 }}>
              <div style={group}>
                {pProfile(cap!).name}
                <span style={{ marginLeft: 6, opacity: 0.7 }}>cli</span>
              </div>
              {(cap!.models ?? ["sonnet"]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onPickP(m)}
                  style={item(choice.kind === "p" && choice.model === m)}
                >
                  {m}
                </button>
              ))}
              <div
                style={{
                  fontSize: 8.5,
                  lineHeight: 1.6,
                  letterSpacing: 0.5,
                  color: p.inkMute,
                  padding: "4px 8px 0",
                  fontFamily: FONT_CN,
                }}
              >
                跑在本机的 claude · 带着这台机器自己的 CLAUDE.md、MCP、订阅额度
              </div>
            </div>
          )}

          {codexOn && (
            <div style={{ marginBottom: 8 }}>
              <div style={group}>
                {codexProfile(codexCap!).name}
                <span style={{ marginLeft: 6, opacity: 0.7 }}>cli</span>
              </div>
              {codexProfile(codexCap!).models.map((m) => (
                <button
                  key={m || "default"}
                  type="button"
                  onClick={() => onPickCodex(m)}
                  style={item(choice.kind === "codex" && choice.model === m)}
                >
                  {m || "默认模型"}
                </button>
              ))}
              <div
                style={{
                  fontSize: 8.5,
                  lineHeight: 1.6,
                  letterSpacing: 0.5,
                  color: p.inkMute,
                  padding: "4px 8px 0",
                  fontFamily: FONT_CN,
                }}
              >
                跑在本机的 codex · 回复整条落地, 不逐字浮现
              </div>
            </div>
          )}

          {withModels.length === 0 && !pOn && !codexOn ? (
            <Link
              href="/backstage/settings"
              style={{ display: "block", fontSize: 11, color: p.inkSoft, padding: "6px 4px", textDecoration: "none" }}
            >
              还没有档案 · 去 /backstage/settings 加 →
            </Link>
          ) : (
            withModels.map((pf) => (
              <div key={pf.id} style={{ marginBottom: 8 }}>
                <div style={group}>
                  {pf.name || "未命名"}
                  <span style={{ marginLeft: 6, opacity: 0.7 }}>{pf.format}</span>
                </div>
                {pf.models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onPickDirect(pf.id, m)}
                    style={item(
                      choice.kind === "direct" &&
                        pf.id === settings?.activeProfileId &&
                        m === settings?.activeModel,
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            ))
          )}
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
              borderTop: `1px solid ${p.ruleSoft}`,
              marginTop: 4,
              fontFamily: FONT_LATIN,
            }}
          >
            管理档案 →
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: "transparent",
          border: "none",
          padding: "2px 0",
          fontSize: 9,
          letterSpacing: 1.5,
          color: p.inkMute,
          cursor: "pointer",
          fontFamily: FONT_LATIN,
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
            background:
              (choice.kind === "p" && pOn) || (choice.kind === "codex" && codexOn)
                ? p.warn
                : active?.apiKey
                  ? p.gold
                  : p.inkMute,
            display: "inline-block",
            opacity: 0.85,
          }}
        />
        {label}
        <span style={{ fontSize: 8, opacity: 0.8 }}>{open ? "▲" : "▼"}</span>
      </button>
    </div>
  );
}

// ============================================
// SettingsDrawer
// ============================================

function SettingsDrawer({
  p,
  theme,
  bgId,
  bgFit,
  avatarsOn,
  avatarUrls,
  contextMax,
  sysStats,
  onBg,
  onImportBg,
  onBgFit,
  onAvatars,
  onPickAvatar,
  onClearAvatar,
  fontScale,
  onFontScale,
  onContextMax,
  onCloseout,
  onFresh,
  closeoutReady,
}: {
  p: Palette;
  theme: ChatTheme;
  bgId: string;
  bgFit: BgFit;
  avatarsOn: boolean;
  avatarUrls: { me?: string; them?: string };
  contextMax: number;
  sysStats: { spChars: number; memInjectOn: boolean; memTotalActive: number } | null;
  onBg: (id: string) => void;
  onImportBg: () => void;
  onBgFit: (f: BgFit) => void;
  onAvatars: (v: boolean) => void;
  onPickAvatar: (slot: "me" | "them") => void;
  onClearAvatar: (slot: "me" | "them") => void;
  fontScale: number;
  onFontScale: (v: number) => void;
  onContextMax: (n: number) => void;
  onCloseout: () => void;
  onFresh: () => void;
  /** A generation backend exists, so closeout can actually summarize. */
  closeoutReady: boolean;
}) {
  const heading = {
    fontSize: 9,
    letterSpacing: 2,
    color: p.inkMute,
    textTransform: "uppercase" as const,
    marginBottom: 6,
    fontFamily: FONT_LATIN,
  };
  const chip = (on: boolean) => ({
    flex: 1,
    padding: "6px 0",
    fontSize: 10,
    letterSpacing: 1.5,
    border: `1px solid ${on ? (p.theme === "day" ? p.roseHi : p.gold) : p.ruleSoft}`,
    background: on ? (p.theme === "day" ? "rgba(176,64,99,.1)" : "rgba(230,205,150,.1)") : "transparent",
    color: on ? (p.theme === "day" ? p.roseHi : p.goldHi) : p.inkSoft,
    cursor: "pointer",
    fontFamily: FONT_LATIN,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(env(safe-area-inset-top, 0px) + 88px)",
        right: 12,
        zIndex: 7,
        width: 232,
        maxHeight: "62vh",
        overflowY: "auto",
        background: theme === "day" ? "rgba(252,247,239,.97)" : "rgba(16,11,7,.95)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        border: `1px solid ${p.rule}`,
        borderRadius: 12,
        padding: "12px 13px",
        boxShadow: p.panelShadow,
      }}
    >
      {/* avatars — the third reading of the same screen */}
      <div style={heading}>avatars</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button type="button" onClick={() => onAvatars(false)} style={chip(!avatarsOn)}>
          无头像
        </button>
        <button type="button" onClick={() => onAvatars(true)} style={chip(avatarsOn)}>
          带头像
        </button>
      </div>
      {avatarsOn && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
          {(["them", "me"] as const).map((slot) => (
            <div key={slot} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => onPickAvatar(slot)}
                style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                aria-label={slot === "me" ? "换我的头像" : "换他的头像"}
              >
                <Avatar p={p} mine={slot === "me"} src={avatarUrls[slot]} size={34} />
              </button>
              <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 8, letterSpacing: 1.5, color: p.inkMute, fontFamily: FONT_LATIN }}>
                  {slot === "me" ? "EGO" : "ILLE"}
                </span>
                {avatarUrls[slot] && (
                  <button
                    type="button"
                    onClick={() => onClearAvatar(slot)}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      fontSize: 8,
                      letterSpacing: 1,
                      color: p.inkMute,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: FONT_LATIN,
                    }}
                  >
                    清除
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={heading}>background</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 6 }}>
        {BG_OPTIONS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onBg(b.id)}
            style={{
              padding: "5px 8px",
              fontSize: 10,
              letterSpacing: 1,
              border: `1px solid ${bgId === b.id ? (p.theme === "day" ? p.roseHi : p.gold) : p.ruleSoft}`,
              background: bgId === b.id ? (p.theme === "day" ? "rgba(176,64,99,.08)" : "rgba(230,205,150,.08)") : "transparent",
              color: bgId === b.id ? (p.theme === "day" ? p.roseHi : p.goldHi) : p.inkSoft,
              cursor: "pointer",
              fontFamily: FONT_LATIN,
              borderRadius: 4,
              textAlign: "left",
            }}
          >
            {b.label}
          </button>
        ))}
        {/* Last cell in the same grid, so it reads as one more option rather
            than a control bolted on. A picture chosen here is downscaled into
            IndexedDB like any chat image — it never leaves the device. */}
        <button
          type="button"
          onClick={onImportBg}
          style={{
            padding: "5px 8px",
            fontSize: 10,
            letterSpacing: 1,
            border: `1px dashed ${bgId.startsWith("own:") ? (p.theme === "day" ? p.roseHi : p.gold) : p.ruleSoft}`,
            background: bgId.startsWith("own:")
              ? p.theme === "day"
                ? "rgba(176,64,99,.08)"
                : "rgba(230,205,150,.08)"
              : "transparent",
            color: bgId.startsWith("own:")
              ? p.theme === "day"
                ? p.roseHi
                : p.goldHi
              : p.inkSoft,
            cursor: "pointer",
            fontFamily: FONT_CN,
            borderRadius: 4,
            textAlign: "left",
          }}
        >
          ＋ 自选
        </button>
      </div>
      {bgId !== "none" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button type="button" onClick={() => onBgFit("adapt")} style={chip(bgFit === "adapt")}>
            整幅
          </button>
          <button type="button" onClick={() => onBgFit("fill")} style={chip(bgFit === "fill")}>
            铺满
          </button>
        </div>
      )}

      <div style={heading}>textvs</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {FONT_SCALES.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFontScale(f.id)}
            style={{
              ...chip(fontScale === f.id),
              fontFamily: FONT_CN,
              // Each step is set in its own size, so the choice shows itself
              fontSize: Math.round(11 * f.id),
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={heading}>contextvs</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {[128_000, 200_000, 1_000_000].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onContextMax(n)}
            style={{
              ...chip(contextMax === n),
              ...ONUM,
              fontSize: 9,
            }}
          >
            {n >= 1_000_000 ? "1M" : `${n / 1000}K`}
          </button>
        ))}
      </div>

      <div style={heading}>system context</div>
      <Link
        href="/backstage/character"
        style={{
          display: "block",
          padding: "8px 10px",
          fontSize: 10,
          lineHeight: 1.5,
          border: `1px solid ${p.ruleSoft}`,
          borderRadius: 6,
          color: p.inkSoft,
          textDecoration: "none",
          fontFamily: FONT_LATIN,
          marginBottom: 10,
        }}
      >
        {sysStats ? (
          <>
            <div>
              SP {sysStats.spChars} 字 ·{" "}
              {sysStats.memInjectOn ? `${sysStats.memTotalActive} 条 memory 注入` : "memory 不注入"}
            </div>
            <div style={{ marginTop: 4, color: p.inkMute, fontSize: 9, letterSpacing: 1 }}>
              → /backstage/character
            </div>
          </>
        ) : (
          <span style={{ color: p.inkMute }}>…</span>
        )}
      </Link>

      {/* Two doors on one row, one job each: closeout summarizes into memory
          and then opens a fresh window; 新窗口 only opens the window. Without a
          generation backend closeout has nothing to summarize with, so it sits
          disabled rather than silently degrading into the other button. */}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={onCloseout}
          disabled={!closeoutReady}
          title={closeoutReady ? "总结存进 memory, 再开新窗" : "要先配一个生成后端"}
          style={{
            flex: 1,
            padding: "7px 4px",
            fontSize: 10,
            letterSpacing: 2,
            border: `1px solid ${closeoutReady ? (p.theme === "day" ? p.roseHi : p.gold) : p.ruleSoft}`,
            background: closeoutReady
              ? p.theme === "day"
                ? "rgba(176,64,99,.08)"
                : "rgba(230,205,150,.08)"
              : "transparent",
            color: closeoutReady ? (p.theme === "day" ? p.roseHi : p.goldHi) : p.inkMute,
            cursor: closeoutReady ? "pointer" : "default",
            opacity: closeoutReady ? 1 : 0.55,
            fontFamily: FONT_LATIN,
            borderRadius: 6,
            textTransform: "uppercase",
          }}
        >
          closeout
        </button>
        <button
          type="button"
          onClick={onFresh}
          style={{
            flex: 1,
            padding: "7px 4px",
            fontSize: 10,
            letterSpacing: 2,
            border: `1px solid ${p.theme === "day" ? p.roseHi : p.gold}`,
            background: p.theme === "day" ? "rgba(176,64,99,.08)" : "rgba(230,205,150,.08)",
            color: p.theme === "day" ? p.roseHi : p.goldHi,
            cursor: "pointer",
            fontFamily: FONT_CN,
            borderRadius: 6,
          }}
        >
          新窗口
        </button>
      </div>
      <Link
        href="/chat/history"
        style={{
          display: "block",
          marginTop: 6,
          padding: "6px 10px",
          fontSize: 9,
          letterSpacing: 2,
          border: `1px solid ${p.ruleSoft}`,
          color: p.inkSoft,
          fontFamily: FONT_LATIN,
          borderRadius: 6,
          textAlign: "center",
          textDecoration: "none",
          textTransform: "uppercase",
        }}
      >
        过往 sessions
      </Link>
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
  p,
  avatarsOn,
  avatarUrl,
  showTs,
  streaming,
  thinkStartedAt,
  onCopy,
  onFork,
  onRewind,
  onSwipe,
}: {
  msg: ChatMessage;
  p: Palette;
  avatarsOn: boolean;
  avatarUrl?: string;
  showTs: boolean;
  streaming: boolean;
  thinkStartedAt?: number;
  onCopy: () => void;
  onFork: () => void;
  onRewind: () => void;
  onSwipe?: (dir: 1 | -1) => void;
}) {
  const [playState, setPlayState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const mine = msg.role === "user";

  const tsLabel = useMemo(() => {
    try {
      const d = new Date(msg.ts);
      return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(
        d.getHours(),
      ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return "";
    }
  }, [msg.ts]);

  const clockLabel = useMemo(() => {
    try {
      const d = new Date(msg.ts);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return "";
    }
  }, [msg.ts]);

  useEffect(
    () => () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );

  // Speak this reply via /api/tts. The blob is cached, so the same reply is not
  // re-synthesized; tapping while it plays stops it.
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

  const sideColor = mine ? p.rose : p.gold;

  // A message that is only a link shows the card alone — the raw URL in a
  // bubble above it would be the same information twice.
  const linkOnly = !!msg.link && msg.content.trim() === msg.link.url;

  // The bubble itself, shared by both readings. Width is capped on the column
  // that holds it, not here: a percentage on a shrink-to-fit box measures
  // against its own resolved width and folds short lines in half.
  const segments = msg.content && !linkOnly ? splitParagraphs(msg.content) : [];
  const bubble = segments.length ? (
    <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", gap: 4, maxWidth: "100%" }}>
      {segments.map((seg, i) => {
        const first = i === 0;
        const last = i === segments.length - 1;
        return (
          <div
            key={i}
            style={{
              position: "relative",
              maxWidth: "100%",
              background: mine ? p.bubbleMe : p.bubbleThem,
              border: `1px solid ${mine ? p.bubbleMeBorder : p.bubbleThemBorder}`,
              // The pointed corner stays on the first piece only — it points at
              // who is speaking, and one utterance points once.
              borderRadius: avatarsOn && first ? (mine ? "10px 3px 10px 10px" : "3px 10px 10px 10px") : 10,
              padding: "9px 14px",
              boxShadow:
                p.theme === "day"
                  ? "0 8px 18px rgba(120,70,70,.08)"
                  : "inset 0 1px 0 rgba(230,205,150,.08), 0 8px 18px rgba(0,0,0,.4)",
              fontFamily: FONT_CN,
              fontSize: "var(--kimi-chat-fs, 12px)",
              lineHeight: 1.75,
              color: p.ink,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {/* the bracket corners belong to the group: top-left on the first
                piece, bottom-right on the last */}
            {first && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: -1,
                  top: -1,
                  width: 10,
                  height: 10,
                  borderLeft: `1px solid ${mine ? p.bubbleMeCorner : p.bubbleThemCorner}`,
                  borderTop: `1px solid ${mine ? p.bubbleMeCorner : p.bubbleThemCorner}`,
                  borderTopLeftRadius: avatarsOn && !mine ? 3 : 10,
                }}
              />
            )}
            {last && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  right: -1,
                  bottom: -1,
                  width: 10,
                  height: 10,
                  borderRight: `1px solid ${mine ? p.bubbleMeCorner : p.bubbleThemCorner}`,
                  borderBottom: `1px solid ${mine ? p.bubbleMeCorner : p.bubbleThemCorner}`,
                  borderBottomRightRadius: 10,
                }}
              />
            )}
            {renderEmphasis(seg)}
          </div>
        );
      })}
    </div>
  ) : null;

  // Everything that hangs off one turn, in order.
  const body = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: mine ? "flex-end" : "flex-start",
        gap: 4,
        // A ceiling, not a width — a short line gets a short bubble, and only a
        // long one reaches this and wraps.
        maxWidth: avatarsOn ? "76%" : "82%",
        minWidth: 0,
        justifySelf: mine ? "end" : "start",
      }}
    >
      {!avatarsOn && (
        <span style={{ fontSize: 6, letterSpacing: 2, color: mine ? p.roseDim : p.goldDim, fontFamily: FONT_LATIN }}>
          {mine ? "EGO" : "ILLE"} · <span style={ONUM}>{clockLabel}</span>
        </span>
      )}

      {!mine && (msg.thinking || streaming) && (
        <div style={{ width: "100%" }}>
          <Cogitatio
            p={p}
            text={msg.thinking}
            streaming={streaming && !msg.content}
            startedAt={thinkStartedAt}
            seconds={msg.thinkingSec}
          />
        </div>
      )}

      {!mine && msg.tools && msg.tools.length > 0 && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
          {msg.tools.map((t) => (
            <ToolLine key={t.id} p={p} tool={t} />
          ))}
        </div>
      )}

      {bubble}

      {msg.image && (
        <ImageBubble
          p={p}
          imageId={msg.image.id}
          src={msg.image.url}
          w={msg.image.w}
          h={msg.image.h}
          timeLabel={avatarsOn ? clockLabel : undefined}
        />
      )}

      {msg.link && <LinkCard p={p} link={msg.link} mine={mine} compact={avatarsOn} />}

      {!mine && msg.content && !streaming && (
        <ActionMarks
          p={p}
          onCopy={onCopy}
          onFork={onFork}
          onRewind={onRewind}
          onListen={playVoice}
          listenState={playState}
          swipe={
            onSwipe
              ? {
                  index: msg.swipeIndex ?? 0,
                  total: msg.swipes?.length ?? 1,
                  onMove: onSwipe,
                }
              : undefined
          }
        />
      )}

      {msg.cost && (
        <span
          style={{
            ...ONUM,
            fontSize: 8,
            letterSpacing: 1.5,
            color: p.inkMute,
            fontFamily: FONT_LATIN,
          }}
        >
          IN {msg.cost.inTok} · OUT {msg.cost.outTok}
          {msg.cost.costUsd != null ? ` · $${msg.cost.costUsd.toFixed(4)}` : ""}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ marginTop: showTs ? 10 : 0 }}>
      {showTs && (
        <div
          style={{
            textAlign: "center",
            fontSize: 8,
            color: p.inkMute,
            marginBottom: 10,
            letterSpacing: 2,
            fontFamily: FONT_LATIN,
            ...ONUM,
          }}
        >
          {tsLabel}
        </div>
      )}

      {avatarsOn ? (
        // 6c — round portrait beside the bubble, the other voice left and mine
        // right. A grid, like the spine layout below, rather than a flex row:
        // as a `flex: 0 1 auto` item the column gets squeezed to min-content,
        // and min-content for Chinese is one character — every bubble collapses
        // into a single vertical column of glyphs. A grid track does not squeeze.
        <div
          style={{
            display: "grid",
            gridTemplateColumns: mine ? "1fr 32px" : "32px 1fr",
            gap: "0 8px",
            alignItems: "start",
          }}
        >
          {mine ? (
            <>
              {body}
              <Avatar p={p} mine={mine} src={avatarUrl} size={32} />
            </>
          ) : (
            <>
              <Avatar p={p} mine={mine} src={avatarUrl} size={32} />
              {body}
            </>
          )}
        </div>
      ) : (
        // 6a / 6b — node on the spine, the turn hanging off it
        <div style={{ display: "grid", gridTemplateColumns: "19px 1fr", gap: "0 10px" }}>
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              border: `1px solid ${sideColor}`,
              boxSizing: "border-box",
              background: mine ? "rgba(176,64,99,.4)" : "rgba(201,167,106,.35)",
              margin: "4px auto 0",
            }}
          />
          <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", minWidth: 0 }}>
            {body}
          </div>
        </div>
      )}
    </div>
  );
}
