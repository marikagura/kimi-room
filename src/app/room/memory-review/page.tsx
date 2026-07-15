"use client";

// V2 /room/memory-review · canon UI restored · client component, IDB-driven.
//
// canon V1 (server async + Prisma pendingItem / memory / activeState):
// → V2 client: memoryStore + activeStateStore IDB.
//
// owner 0525 Q3 ack · tag-then-review flow · 用户 "+" 加 memory → reviewStatus='pending'
// → ReviewCard approve/reject/edit/expire seal action. canon UI 整 套 (hero
// 记忆审核 + 4 filter chip + ACTIVE STATES + ARCHIVES section · 各 WaxSeal +
// HingeMedallion + RoseBud + Flourish) keep intact.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ReviewCard,
  type ReviewItemData,
} from "@/components/memory-review/ReviewCard";
import {
  ActiveStateCard,
  type ActiveStateData,
} from "@/components/memory-review/ActiveStateCard";
import {
  MemoryCard,
  type MemoryRowData,
} from "@/components/memory-review/MemoryCard";
import {
  paletteFor,
  type ReviewTheme,
} from "@/components/memory-review/theme";
import { activeStateStore, memoryStore } from "@/lib/stores";
import type {
  ActiveStateEntry,
  MemoryEntry,
} from "@/lib/stores/types";

type FilterId = "all" | "high" | "low" | "today";

// V2 owner 0518 ack · memory import md/txt/任意 文本 · auto-split episodes:
// 优先 try date markers (YYYY-MM-DD, ## headings, ---horizontal rule) ·
// fallback: ~800 字 chunk by blank-line boundary.
function splitIntoEpisodes(text: string): { key: string; content: string }[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  // Pattern 1: markdown headings (## / # 后跟内容)
  if (/^#{1,3}\s/m.test(clean)) {
    const parts = clean.split(/(?=^#{1,3}\s)/m).map((s) => s.trim()).filter(Boolean);
    return parts.map((p) => {
      const headMatch = p.match(/^#{1,3}\s+([^\n]+)/);
      const key = headMatch ? headMatch[1].trim().slice(0, 80) : "";
      const body = p.replace(/^#{1,3}\s+[^\n]+\n?/, "").trim();
      return { key: key || body.slice(0, 40), content: body || key };
    });
  }

  // Pattern 2: ISO date lines (2026-05-18 / 2026.05.18)
  const dateMatch = clean.match(/^\d{4}[-./]\d{2}[-./]\d{2}/m);
  if (dateMatch) {
    const parts = clean
      .split(/(?=^\d{4}[-./]\d{2}[-./]\d{2})/m)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.map((p) => {
      const dm = p.match(/^(\d{4}[-./]\d{2}[-./]\d{2})/);
      const key = dm ? dm[1] : p.slice(0, 40);
      const body = dm ? p.slice(dm[1].length).trim() : p;
      return { key, content: body || key };
    });
  }

  // Pattern 3: horizontal rule separators ---
  if (/^---+$/m.test(clean)) {
    const parts = clean.split(/^---+$/m).map((s) => s.trim()).filter(Boolean);
    return parts.map((p, i) => ({
      key: `episode ${i + 1}`,
      content: p,
    }));
  }

  // Pattern 4: blank-line groups · chunk ~800 字
  const blocks = clean.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const out: { key: string; content: string }[] = [];
  let buf = "";
  let idx = 1;
  for (const b of blocks) {
    if (buf.length + b.length > 800 && buf) {
      out.push({ key: `episode ${idx++}`, content: buf });
      buf = b;
    } else {
      buf = buf ? buf + "\n\n" + b : b;
    }
  }
  if (buf) out.push({ key: `episode ${idx}`, content: buf });
  return out;
}

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "high", label: "高分" },
  { id: "low", label: "低分" },
  { id: "today", label: "今日" },
];

function jstStartOfToday(): number {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return jst.getTime() - 9 * 3600 * 1000;
}

function memoryEntryToReview(m: MemoryEntry): ReviewItemData {
  return {
    id: m.id,
    pendingType: "MEMORY_CANDIDATE",
    title: m.key,
    content: m.content,
    sourceRefType: m.tags[0] ?? null,
    priority: m.order,
    createdAt: m.createdAt,
  };
}

function memoryEntryToRow(m: MemoryEntry): MemoryRowData {
  const memoryType = m.tags[0] ?? "CORE";
  return {
    id: m.id,
    memoryType,
    title: m.key,
    summary: null,
    content: m.content,
    importance: m.order,
    isActive: m.active,
    createdAt: m.createdAt,
  };
}

function activeStateEntryToData(s: ActiveStateEntry): ActiveStateData {
  return {
    id: s.id,
    stateType: s.stateType,
    title: s.title,
    summary: s.summary,
    content: s.body ?? s.summary,
    startAt: s.createdAt,
    source: null,
  };
}

function readClientTheme(): ReviewTheme {
  if (typeof document === "undefined") return "night";
  const m = document.cookie.match(/(?:^|;\s*)kimi-theme=([^;]+)/);
  return m && m[1] === "day" ? "day" : "night";
}

export default function MemoryReviewPage() {
  const sp = useSearchParams();
  const filter: FilterId = (FILTERS.find((f) => f.id === sp.get("f"))?.id ??
    "all") as FilterId;

  const [theme, setTheme] = useState<ReviewTheme>("night");
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [actives, setActives] = useState<ActiveStateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [draftKey, setDraftKey] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftTags, setDraftTags] = useState("");

  const p = paletteFor(theme);
  const isDay = theme === "day";

  useEffect(() => {
    setTheme(readClientTheme());
    let alive = true;
    Promise.all([memoryStore().list(), activeStateStore().list()])
      .then(([m, a]) => {
        if (!alive) return;
        setMemories(m);
        setActives(a);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // filter logic mirroring canon
  const todayStart = useMemo(() => jstStartOfToday(), []);
  function passesFilter(m: MemoryEntry): boolean {
    if (filter === "high") return m.order >= 3;
    if (filter === "low") return m.order < 3;
    if (filter === "today") return new Date(m.createdAt).getTime() >= todayStart;
    return true;
  }

  const pendingItems: ReviewItemData[] = useMemo(
    () =>
      memories
        .filter((m) => (m.reviewStatus ?? "pending") === "pending")
        .filter(passesFilter)
        .sort((a, b) =>
          b.order !== a.order
            ? b.order - a.order
            : a.createdAt < b.createdAt
              ? 1
              : -1,
        )
        .map(memoryEntryToReview),
    [memories, filter, todayStart],
  );

  const recentItems: MemoryRowData[] = useMemo(
    () =>
      [...memories]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 30)
        .map(memoryEntryToRow),
    [memories],
  );

  const activeItems: ActiveStateData[] = useMemo(
    () =>
      [...actives]
        .filter((s) => s.body || s.summary)
        .sort((a, b) =>
          a.stateType !== b.stateType
            ? a.stateType.localeCompare(b.stateType)
            : a.createdAt < b.createdAt
              ? 1
              : -1,
        )
        .map(activeStateEntryToData),
    [actives],
  );

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!draftKey.trim() || !draftContent.trim()) return;
    const saved = await memoryStore().put({
      key: draftKey.trim(),
      content: draftContent.trim(),
      order: 0,
      active: true,
      tags: draftTags.split(",").map((t) => t.trim()).filter(Boolean),
      reviewStatus: "pending",
    });
    setMemories((prev) => [...prev, saved]);
    setDraftKey("");
    setDraftContent("");
    setDraftTags("");
    setAdding(false);
  }

  async function onImport(file: File) {
    const text = await file.text();
    const episodes = splitIntoEpisodes(text);
    if (!episodes.length) {
      alert("没读出可分割的 episode · 检查 file 内容");
      return;
    }
    const ok = confirm(
      `读到 ${episodes.length} 段 episode · 全 import 进 memory? (status=pending, 可单独 review)`,
    );
    if (!ok) return;
    for (const ep of episodes) {
      await memoryStore().put({
        key: ep.key,
        content: ep.content,
        order: 0,
        active: true,
        tags: [],
        reviewStatus: "pending",
      });
    }
    const all = await memoryStore().list();
    setMemories(all);
  }

  function handleReviewRemoved(id: string) {
    // entry stays in store with new status · just re-fetch to refresh sections
    memoryStore()
      .list()
      .then(setMemories);
  }

  function handleActiveRemoved(id: string) {
    setActives((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <main
      style={{
        minHeight: "100svh",
        background: p.pageBgGradient,
        color: p.ink,
        fontFamily:
          'var(--font-serif)',
        padding: "48px 20px 80px",
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* hero */}
        <header style={{ textAlign: "center", marginBottom: 36 }}>
          <p
            style={{
              fontSize: 10,
              letterSpacing: 6,
              color: p.inkMute,
              fontStyle: "italic",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            backstage · curation
          </p>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
            }}
          >
            <RoseBud color={p.accent} dark={isDay ? null : "#3a0d10"} size={34} />
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 38,
                  letterSpacing: 8,
                  fontWeight: 500,
                  lineHeight: 1.05,
                  color: p.ink,
                  fontFamily:
                    'var(--font-serif-cn)',
                  display: "inline-block",
                }}
              >
                {Array.from("记忆审核").map((ch, i) => {
                  const offsets = [0, -8, -2, -6];
                  return (
                    <span
                      key={i}
                      style={{
                        position: "relative",
                        top: offsets[i] ?? 0,
                        display: "inline-block",
                      }}
                    >
                      {ch}
                    </span>
                  );
                })}
              </h1>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 11,
                  letterSpacing: 6,
                  color: p.inkSoft,
                  fontStyle: "italic",
                }}
              >
                MEMORIES PENDING · {pendingItems.length}
              </p>
            </div>
            <RoseBud color={p.accent} dark={isDay ? null : "#3a0d10"} size={34} mirror />
          </div>
          <Flourish accent={p.accent} isDay={isDay} />
        </header>

        {/* filter pills + add button */}
        <div
          style={{
            display: "flex",
            marginBottom: 28,
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FILTERS.map((f) => {
              const active = f.id === filter;
              return (
                <Link
                  key={f.id}
                  href={`/room/memory-review?f=${f.id}`}
                  style={{
                    fontSize: 11,
                    letterSpacing: 2,
                    padding: "5px 14px",
                    borderRadius: 99,
                    color: active ? p.accent : p.inkSoft,
                    border: `0.6px solid ${active ? p.accent : p.hairline}`,
                    background: active ? `${p.accent}14` : "transparent",
                    textDecoration: "none",
                    transition: "color 160ms, border-color 160ms, background 160ms",
                  }}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
          <span style={{ flex: 1 }} />
          {!adding && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  padding: "5px 12px",
                  borderRadius: 99,
                  color: p.inkMute,
                  border: `0.5px solid ${p.inkMute}`,
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontStyle: "italic",
                }}
              >
                ↑ import md/txt
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".md,.txt,.markdown,.json,text/plain,text/markdown,application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void onImport(f);
                }}
              />
              <button
                type="button"
                onClick={() => setAdding(true)}
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  padding: "5px 14px",
                  borderRadius: 99,
                  color: p.accent,
                  border: `0.6px solid ${p.accent}`,
                  background: `${p.accent}10`,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                + 加 memory
              </button>
            </div>
          )}
        </div>

        {adding && (
          <article
            style={{
              background: p.cardBg,
              border: `1px solid ${p.cardBorder}`,
              borderRadius: 8,
              padding: "18px 22px 14px",
              marginBottom: 24,
            }}
          >
            <form onSubmit={onAdd} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="text"
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                placeholder="key / trigger word"
                autoFocus
                style={{
                  background: isDay ? "rgba(0,0,0,0.18)" : "rgba(212,175,106,0.04)",
                  border: `0.6px solid ${p.hairline}`,
                  borderRadius: 4,
                  padding: "6px 8px",
                  color: p.ink,
                  fontFamily: "inherit",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                placeholder="content (injected into context when key matches)"
                rows={5}
                style={{
                  background: isDay ? "rgba(0,0,0,0.18)" : "rgba(212,175,106,0.04)",
                  border: `0.6px solid ${p.hairline}`,
                  borderRadius: 4,
                  padding: "8px 10px",
                  color: p.ink,
                  fontFamily: "inherit",
                  fontSize: 13,
                  lineHeight: 1.7,
                  outline: "none",
                  resize: "vertical",
                }}
              />
              <input
                type="text"
                value={draftTags}
                onChange={(e) => setDraftTags(e.target.value)}
                placeholder="tags (comma-sep · e.g. CORE,PREFERENCE)"
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: `0.5px solid ${p.hairline}`,
                  padding: "5px 0",
                  color: p.ink,
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontStyle: "italic",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 16, justifyContent: "flex-end", marginTop: 6 }}>
                <button
                  type="submit"
                  style={{
                    background: "transparent",
                    border: `0.5px solid ${p.accent}`,
                    padding: "5px 16px",
                    color: p.accent,
                    fontSize: 11,
                    letterSpacing: 2,
                    fontStyle: "italic",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  save (pending)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setDraftKey("");
                    setDraftContent("");
                    setDraftTags("");
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: p.inkMute,
                    fontSize: 11,
                    letterSpacing: 2,
                    fontStyle: "italic",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  cancel
                </button>
              </div>
            </form>
          </article>
        )}

        {loading && (
          <p
            style={{
              textAlign: "center",
              fontSize: 12,
              color: p.inkMute,
              fontStyle: "italic",
              padding: "24px 0",
            }}
          >
            …
          </p>
        )}

        {/* active states */}
        {activeItems.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <SectionHeader cn="进行中" en={`ACTIVE STATES · ${activeItems.length}`} palette={p} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activeItems.map((s) => (
                <ActiveStateCard
                  key={s.id}
                  state={s}
                  theme={theme}
                  onRemoved={handleActiveRemoved}
                />
              ))}
            </div>
          </section>
        )}

        {/* pending */}
        {pendingItems.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <SectionHeader cn="待审核" en={`PENDING · ${pendingItems.length}`} palette={p} />
            <div style={{ display: "flex", flexDirection: "column", gap: isDay ? 14 : 4 }}>
              {pendingItems.map((it) => (
                <ReviewCard key={it.id} item={it} theme={theme} onRemoved={handleReviewRemoved} />
              ))}
            </div>
          </section>
        )}

        {/* recent — 永远显示 (10 条 max) */}
        <section>
          <SectionHeader cn="最近记忆" en={`RECENT · ${recentItems.length}`} palette={p} />
          {recentItems.length === 0 && !loading ? (
            <EmptyState palette={p} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentItems.map((m) => (
                <MemoryCard key={m.id} memory={m} theme={theme} />
              ))}
            </div>
          )}
        </section>

        {/* footer link */}
        <div style={{ textAlign: "center", marginTop: 56 }}>
          <Link
            href="/room"
            style={{
              fontSize: 10,
              letterSpacing: 4,
              color: p.inkMute,
              textTransform: "uppercase",
              fontStyle: "italic",
              textDecoration: "none",
            }}
          >
            ← room
          </Link>
        </div>
      </div>
    </main>
  );
}

function Flourish({ accent, isDay }: { accent: string; isDay: boolean }) {
  if (isDay) {
    const w = 300;
    return (
      <div
        aria-hidden
        style={{
          marginTop: 14,
          display: "flex",
          justifyContent: "center",
          opacity: 0.85,
        }}
      >
        <svg width={w} height="22" viewBox={`0 0 ${w} 22`}>
          <g
            stroke={accent}
            strokeWidth="0.7"
            fill="none"
            strokeLinecap="round"
          >
            <g transform="translate(8 11)">
              <circle r="3" fill={accent} fillOpacity="0.18" />
              <circle r="1.6" fill={accent} fillOpacity="0.4" />
              <circle r="0.5" fill={accent} />
              <path d="M -3 0 Q -7 -2 -10 0" />
              <path d="M 3 0 Q 7 2 10 0" />
            </g>
            <path d="M 22 11 Q 40 5 60 11 Q 80 17 100 11" />
            <g transform={`translate(${w / 2} 11)`}>
              <circle r="6" />
              <circle r="3" fill={accent} fillOpacity="0.22" />
              <circle r="1.4" fill={accent} />
              <path d="M 0 -8 Q -3 -10 -6 -8" />
              <path d="M 0 -8 Q 3 -10 6 -8" />
              <path d="M 0 8 Q -3 10 -6 8" />
              <path d="M 0 8 Q 3 10 6 8" />
            </g>
            <path
              d={`M ${w - 100} 11 Q ${w - 80} 17 ${w - 60} 11 Q ${w - 40} 5 ${w - 22} 11`}
            />
            <g transform={`translate(${w - 8} 11)`}>
              <circle r="3" fill={accent} fillOpacity="0.18" />
              <circle r="1.6" fill={accent} fillOpacity="0.4" />
              <circle r="0.5" fill={accent} />
              <path d="M -3 0 Q -7 -2 -10 0" />
              <path d="M 3 0 Q 7 2 10 0" />
            </g>
          </g>
        </svg>
      </div>
    );
  }
  return (
    <div
      aria-hidden
      style={{
        marginTop: 16,
        display: "flex",
        justifyContent: "center",
        opacity: 0.78,
      }}
    >
      <svg width="180" height="10" viewBox="0 0 180 10">
        <g stroke={accent} strokeWidth="0.7" fill="none" strokeLinecap="round">
          <path d="M 2 5 L 70 5" />
          <circle cx="90" cy="5" r="1.5" fill={accent} />
          <circle cx="90" cy="5" r="3" />
          <path d="M 110 5 L 178 5" />
        </g>
      </svg>
    </div>
  );
}

function RoseBud({
  color,
  dark = null,
  size = 32,
  mirror = false,
}: {
  color: string;
  dark?: string | null;
  size?: number;
  mirror?: boolean;
}) {
  const headOuterFill = dark ?? color;
  const headOuterOpacity = dark ? 0.85 : 0.18;
  const headInnerFill = dark ?? color;
  const headInnerOpacity = dark ? 0.6 : 0.35;
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 30 30"
      style={{ transform: mirror ? "scaleX(-1)" : "none", flexShrink: 0 }}
    >
      <g
        stroke={color}
        strokeWidth="0.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 15 28 Q 14 22 12 18 Q 10 14 13 11" />
        <path d="M 12 22 Q 8 21 6 24" />
        <path d="M 13 18 Q 17 18 19 22" />
        <path
          d="M 15 11 Q 11 9 11 13 Q 11 16 15 16 Q 19 16 19 13 Q 19 9 15 11 Z"
          fill={headOuterFill}
          fillOpacity={headOuterOpacity}
        />
        <path
          d="M 15 13 Q 13 12 13 14 Q 13 15.5 15 15.5 Q 17 15.5 17 14 Q 17 12 15 13 Z"
          fill={headInnerFill}
          fillOpacity={headInnerOpacity}
        />
        <circle cx="15" cy="14" r="0.7" fill={color} />
        <path d="M 11 13 Q 7 12 5 14" />
        <path d="M 19 13 Q 23 12 25 14" />
      </g>
    </svg>
  );
}

function SectionHeader({
  cn,
  en,
  palette,
}: {
  cn: string;
  en: string;
  palette: ReturnType<typeof paletteFor>;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 14,
        marginBottom: 14,
        paddingBottom: 6,
        borderBottom: `0.4px solid ${palette.hairline}`,
      }}
    >
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 4,
          color: palette.ink,
          fontFamily: 'var(--font-serif-cn)',
        }}
      >
        {cn}
      </span>
      <span
        style={{
          fontSize: 9,
          letterSpacing: 4,
          color: palette.inkMute,
          fontStyle: "italic",
          textTransform: "uppercase",
        }}
      >
        {en}
      </span>
    </div>
  );
}

function EmptyState({ palette }: { palette: ReturnType<typeof paletteFor> }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 0",
        color: palette.inkSoft,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
      }}
    >
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        style={{ display: "block", color: palette.flourish, opacity: 0.85 }}
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="40" cy="40" r="22" />
          <path d="M 40 18 q 10 12 0 24 q -10 -12 0 -24" />
          <path d="M 18 40 q 12 10 24 0 q -12 -10 -24 0" />
          <circle cx="40" cy="40" r="3" fill="currentColor" stroke="none" />
        </g>
      </svg>
      <p
        style={{
          fontSize: 13,
          fontStyle: "italic",
          letterSpacing: 2,
          margin: 0,
          lineHeight: 1.7,
        }}
      >
        没有记忆
        <span
          style={{
            display: "block",
            fontSize: 10,
            opacity: 0.7,
            marginTop: 4,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          all clear · tap &quot;+ 加 memory&quot; 加 第一条
        </span>
      </p>
    </div>
  );
}
