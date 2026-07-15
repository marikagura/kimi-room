"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { KimiPalette } from "@/lib/kimi-palettes";
import type { KimiTheme } from "@/lib/day-theme-client";
import { isCoreBackend } from "@/lib/backend-mode";
import { callCoreTool } from "@/lib/kimi-core-client";
import { type Paper, axisColor, groupPapers } from "@/lib/papers";

const onum: CSSProperties = { fontFeatureSettings: '"onum" 1' };

// Hand-drawn gilt star — the "kept / 常驻" mark (Le Petit Prince: the star you
// keep). An SVG line, not an icon font or emoji (kimi-design).
function StarMark({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ display: "inline-block", flexShrink: 0 }}>
      <path
        d="M12 3l2.5 6.1 6.6.5-5 4.3 1.6 6.4L12 16.9 6.7 20.3l1.6-6.4-5-4.3 6.6-.5z"
        fill="none"
        stroke={color}
        strokeWidth="1.1"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Pips({ n, color, mute }: { n: number; color: string; mute: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: i < n ? color : "transparent",
            border: `1px solid ${i < n ? color : mute}`,
          }}
        />
      ))}
    </span>
  );
}

function yearOf(p: Paper): string {
  return (p.publishedAt ?? p.createdAt).slice(0, 4);
}
function firstSentence(s: string): string {
  const m = s.match(/^[^。.!！?？]*[。.!！?？]/);
  if (m) return m[0];
  return s.length > 50 ? `${s.slice(0, 50)}…` : s;
}

export default function PapersClient({
  initial,
  theme,
  P,
}: {
  initial: Paper[];
  theme: KimiTheme;
  P: KimiPalette;
}) {
  const [papers, setPapers] = useState<Paper[]>(initial);
  const [live, setLive] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const g = groupPapers(initial);
    return new Set(g.months[0] ? [g.months[0].key] : []);
  });

  useEffect(() => {
    let alive = true;
    if (!isCoreBackend()) return undefined;
    void (async () => {
      try {
        const text = await callCoreTool("paper_list", {});
        const rows = JSON.parse(text) as Paper[];
        if (alive && Array.isArray(rows) && rows.length) {
          setPapers(rows);
          setLive(true);
          const g = groupPapers(rows);
          if (g.months[0]) setExpanded((prev) => new Set(prev).add(g.months[0].key));
        }
      } catch {
        /* keep the demo seed */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const { pinned, months, archivedCount } = groupPapers(papers);
  const all = [...pinned, ...months.flatMap((m) => m.papers)];
  const open = openId ? all.find((p) => p.id === openId) ?? null : null;

  const toggleMonth = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const ListItem = ({ p, first }: { p: Paper; first: boolean }) => {
    const col = axisColor(p.axis, theme);
    return (
      <button
        onClick={() => setOpenId(p.id)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "block",
          width: "100%",
          boxSizing: "border-box",
          padding: "14px 2px 13px",
          borderTop: first ? "none" : `1px solid ${P.hairSoft}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: col, flexShrink: 0 }} />
          <span style={{ fontStyle: "italic", fontSize: 12.5, color: P.mute, ...onum }}>
            {p.journal ?? "—"} · {yearOf(p)}
          </span>
          <span style={{ flex: 1 }} />
          {p.pinned && <StarMark color={col} size={15} />}
          <Pips n={p.importance} color={col} mute={P.hair} />
        </div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: P.ink, lineHeight: 1.3, margin: "7px 0" }}>
          {p.title}
        </div>
        {p.axis && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
            <span style={{ fontSize: 9.5, fontStyle: "italic", color: col, border: `1px solid ${col}`, background: `${col}20`, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" }}>
              {p.axis}
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ flexShrink: 0, fontSize: 10.5, letterSpacing: 2, color: P.accent, paddingTop: 2, width: 16 }}>知</span>
          <div style={{ fontFamily: 'var(--font-serif-cn)', fontSize: 13, color: P.mute, lineHeight: 1.5 }}>
            {firstSentence(p.knowledge)}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div style={{ padding: "4px 22px 0" }}>
      <p style={{ fontSize: 11, color: P.mute, fontStyle: "italic", textAlign: "center", lineHeight: 1.65, margin: "8px 0 18px" }}>
        {live ? "paper-loop 每日追踪、月度轮换" : "示例数据 · demo — 接上 core 后是你自己的论文"}
      </p>

      {pinned.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 0 2px" }}>
            <StarMark color={P.accent} size={15} />
            <span style={{ fontSize: 9, letterSpacing: 3, color: P.accent, textTransform: "uppercase" }}>常驻 · pinned</span>
          </div>
          {pinned.map((p, i) => (
            <ListItem key={p.id} p={p} first={i === 0} />
          ))}
        </div>
      )}

      {months.map((m, mi) => {
        const isOpen = expanded.has(m.key);
        const isCurrent = mi === 0;
        return (
          <div key={m.key} style={{ marginTop: isCurrent && pinned.length === 0 ? 0 : 10 }}>
            <button
              onClick={() => toggleMonth(m.key)}
              style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 0 6px", borderTop: `1px solid ${P.hair}` }}
            >
              <span style={{ fontSize: 9, letterSpacing: 3, color: isCurrent ? P.accent : P.mute, textTransform: "uppercase", ...onum }}>
                {m.label}
              </span>
              <span style={{ fontSize: 9, color: P.mute, fontStyle: "italic", ...onum }}>· {m.papers.length} 篇</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: P.mute }}>{isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen && m.papers.map((p, i) => <ListItem key={p.id} p={p} first={i === 0} />)}
          </div>
        );
      })}

      {archivedCount > 0 && (
        <div style={{ marginTop: 14, padding: "13px 16px", border: `1px solid ${P.hairSoft}`, borderLeft: `2px solid ${P.accent}` }}>
          <span style={{ fontSize: 11, color: P.mute, fontStyle: "italic", ...onum }}>归档库 · {archivedCount} 篇已轮换出架</span>
        </div>
      )}

      {open && <Drawer p={open} theme={theme} P={P} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Drawer({ p, theme, P, onClose }: { p: Paper; theme: KimiTheme; P: KimiPalette; onClose: () => void }) {
  const col = axisColor(p.axis, theme);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 448,
          margin: "0 auto",
          maxHeight: "90vh",
          overflowY: "auto",
          background: P.bg,
          borderRadius: "22px 22px 0 0",
          borderTop: `1px solid ${P.hair}`,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ height: 6, background: col, borderRadius: "22px 22px 0 0" }} />
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: P.hair }} />
        </div>
        <div style={{ padding: "8px 24px 36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            {p.axis && (
              <span style={{ fontSize: 10, fontStyle: "italic", color: col, border: `1px solid ${col}`, background: `${col}20`, borderRadius: 3, padding: "1px 7px" }}>
                {p.axis}
              </span>
            )}
            <span style={{ flex: 1 }} />
            {p.pinned && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <StarMark color={col} size={18} />
                <span style={{ fontSize: 10, fontStyle: "italic", color: col }}>常驻</span>
              </span>
            )}
          </div>

          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21, color: P.ink, lineHeight: 1.3, fontStyle: "italic" }}>
            {p.title}
          </div>
          <div style={{ fontStyle: "italic", fontSize: 12.5, color: P.mute, margin: "6px 0 0", ...onum }}>
            {p.authors ?? "—"} · {p.journal ?? "—"} · {yearOf(p)}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0", paddingBottom: 12, borderBottom: `1px solid ${P.hairSoft}` }}>
            <Pips n={p.importance} color={col} mute={P.hair} />
            <span style={{ fontSize: 11, color: P.mute, fontStyle: "italic", ...onum }}>重要度 {p.importance}/5</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: p.hasFullText ? P.accent : P.mute, border: `1px solid ${p.hasFullText ? P.hair : P.hairSoft}`, borderRadius: 3, padding: "1px 7px" }}>
              {p.hasFullText ? "全文" : "仅摘要"}
            </span>
          </div>

          <div style={{ fontSize: 10, letterSpacing: 2, color: P.accent, marginBottom: 5, textTransform: "uppercase" }}>知识点 · knowledge</div>
          <div style={{ fontFamily: 'var(--font-serif-cn)', fontSize: 14.5, color: P.ink, lineHeight: 1.7, marginBottom: 18 }}>{p.knowledge}</div>

          {p.relevance && (
            <>
              <div style={{ fontSize: 10, letterSpacing: 2, color: P.accent, marginBottom: 5, textTransform: "uppercase" }}>为什么相关 · relevance</div>
              <div style={{ position: "relative", paddingLeft: 13, marginBottom: 18 }}>
                <div style={{ position: "absolute", left: 0, top: 2, bottom: 2, width: 2, background: P.accent, borderRadius: 2 }} />
                <div style={{ fontFamily: 'var(--font-serif)', fontStyle: "italic", fontSize: 14, color: P.mute, lineHeight: 1.6 }}>
                  {p.relevance}
                </div>
              </div>
            </>
          )}

          {/* Only render the link for http(s) URLs — paper records can be auto-
              populated from external sources, so a javascript:/data: url must not
              become a clickable href that runs in the room's origin. */}
          {p.url && /^https?:\/\//i.test(p.url) && (
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-block", marginTop: 4, fontSize: 12, fontStyle: "italic", color: P.accent, border: `1px solid ${P.hair}`, borderRadius: 3, padding: "5px 12px", ...onum }}
            >
              source ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
