"use client";

// V2 MemoryCard · canon UI restored · 走 memoryStore IDB.

import { useState } from "react";
import { paletteFor, type ReviewTheme } from "./theme";
import {
  Chip,
  WaxSeal,
  SealCheck,
  SealPen,
  SealCross,
  SealBack,
  HingeMedallion,
} from "./seals";
import { memoryStore } from "@/lib/stores";

export type MemoryRowData = {
  id: string;
  memoryType: string;
  title: string;
  summary: string | null;
  content: string;
  importance: number;
  isActive: boolean;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  CORE: "核心 · CORE",
  BOUNDARY: "边界 · BOUNDARY",
  PREFERENCE: "偏好 · PREF",
  EPISODE: "事件 · EPISODE",
  STATE: "状态 · STATE",
  REGISTER: "register · REG",
  SCENE: "场景 · SCENE",
};

function formatJst(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${hh}:${mm}`;
}

export function MemoryCard({
  memory,
  theme,
}: {
  memory: MemoryRowData;
  theme: ReviewTheme;
}) {
  const p = paletteFor(theme);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(memory.isActive);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(memory.title);
  const [draftContent, setDraftContent] = useState(memory.content);
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [importance, setImportance] = useState(memory.importance);

  type Action = "edit" | "deactivate" | "restore" | "priority";
  async function fire(
    action: Action,
    payload?: { title?: string; content?: string; importance?: number },
  ) {
    setBusy(true);
    try {
      const existing = await memoryStore().get(memory.id);
      if (!existing) throw new Error("not found");
      if (action === "edit") {
        await memoryStore().put({
          ...existing,
          key: payload?.title ?? existing.key,
          content: payload?.content ?? existing.content,
        });
        if (payload?.title) setTitle(payload.title);
        if (payload?.content) setContent(payload.content);
        setEditing(false);
      } else if (action === "deactivate") {
        await memoryStore().put({ ...existing, active: false });
        setActive(false);
      } else if (action === "restore") {
        await memoryStore().put({ ...existing, active: true });
        setActive(true);
      } else if (action === "priority") {
        const next = payload?.importance ?? importance;
        await memoryStore().put({ ...existing, order: next });
        setImportance(next);
      }
    } catch (e) {
      console.error("[memory-card]", e);
      alert("出错了。再试一次。");
    } finally {
      setBusy(false);
    }
  }

  function tapRose(idx: number) {
    const target = importance === idx + 1 ? 1 : idx + 1;
    setImportance(target);
    void fire("priority", { importance: target });
  }

  const isDay = theme === "day";
  const hingeColor = isDay ? p.dropCap : p.accent;
  const ts = formatJst(memory.createdAt);
  const typeLabel = TYPE_LABEL[memory.memoryType] ?? memory.memoryType;
  const chipLabel = active ? typeLabel : `${typeLabel} · deactivated`;
  const dropCap = content.charAt(0);
  const rest = content.slice(1);

  return (
    <article
      className="kimi-card-lift"
      style={{
        position: "relative",
        background: p.cardBg,
        backdropFilter: !isDay ? "blur(14px)" : undefined,
        WebkitBackdropFilter: !isDay ? "blur(14px)" : undefined,
        border: `1px solid ${p.cardBorder}`,
        borderRadius: 8,
        padding: "22px 24px 18px",
        marginTop: 14,
        opacity: active ? 1 : 0.55,
        boxShadow: isDay
          ? `inset 0 1px 0 rgba(251,238,201,0.04)`
          : `0 0 0 4px ${p.cardBg}, 0 0 0 5px ${p.hairline}`,
        margin: isDay ? undefined : "4px",
      }}
    >
      <HingeMedallion color={hingeColor} paper={p.paper} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontStyle: "italic",
            letterSpacing: "0.05em",
            color: p.inkMute,
          }}
        >
          {ts}
        </span>
        <RosesRow
          score={importance}
          accent={p.dropCap}
          mute={p.inkMute}
          paper={p.paper}
          onTap={busy ? undefined : tapRose}
        />
      </div>

      {editing ? (
        <input
          type="text"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          style={{
            width: "100%",
            fontSize: 15,
            color: p.ink,
            background: isDay ? "rgba(0,0,0,0.18)" : "rgba(212,175,106,0.04)",
            border: `0.6px solid ${p.hairline}`,
            borderRadius: 4,
            padding: "6px 8px",
            marginBottom: 6,
            fontFamily: "inherit",
            fontWeight: 500,
            outline: "none",
          }}
        />
      ) : (
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: 14,
            fontWeight: 500,
            color: p.ink,
            fontFamily:
              'var(--font-serif-cn)',
          }}
        >
          {title}
        </h3>
      )}

      {editing ? (
        <textarea
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          rows={6}
          style={{
            width: "100%",
            background: isDay ? "rgba(0,0,0,0.18)" : "rgba(212,175,106,0.04)",
            color: p.ink,
            border: `0.6px solid ${p.hairline}`,
            borderRadius: 4,
            padding: "8px 10px",
            fontSize: 13,
            lineHeight: 1.7,
            fontFamily: "inherit",
            resize: "vertical",
            outline: "none",
          }}
        />
      ) : (
        <p
          style={{
            margin: 0,
            color: p.ink,
            fontSize: 13.5,
            lineHeight: 1.75,
            fontFamily:
              'var(--font-serif)',
          }}
        >
          <span
            style={{
              float: "left",
              fontFamily: 'var(--font-serif)',
              fontSize: 38,
              lineHeight: 0.85,
              fontWeight: 500,
              color: p.dropCap,
              marginRight: 6,
              marginTop: 4,
            }}
          >
            {dropCap}
          </span>
          {rest.length > 480 ? rest.slice(0, 480) + "…" : rest}
        </p>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 14,
          gap: 12,
        }}
      >
        <Chip src={chipLabel} palette={p} />

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {editing ? (
            <>
              <WaxSeal
                title="save"
                color={p.ok}
                ring={p.ok}
                bg={p.sealBg}
                disabled={busy}
                onClick={() => fire("edit", { title: draftTitle, content: draftContent })}
              >
                <SealCheck c={p.ok} />
              </WaxSeal>
              <WaxSeal
                title="cancel"
                color={p.inkMute}
                ring={p.hairline}
                bg={p.sealBg}
                disabled={busy}
                onClick={() => {
                  setDraftTitle(title);
                  setDraftContent(content);
                  setEditing(false);
                }}
              >
                <SealBack c={p.inkMute} />
              </WaxSeal>
            </>
          ) : (
            <>
              <WaxSeal
                title="edit"
                color={p.edit}
                ring={p.hairline}
                bg={p.sealBg}
                disabled={busy}
                onClick={() => {
                  setDraftTitle(title);
                  setDraftContent(content);
                  setEditing(true);
                }}
              >
                <SealPen c={p.edit} />
              </WaxSeal>
              {active ? (
                <WaxSeal
                  title="deactivate"
                  color={p.reject}
                  ring={p.reject}
                  bg={p.sealBg}
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(`停用 memory "${title.slice(0, 18)}..."?`)) return;
                    void fire("deactivate");
                  }}
                >
                  <SealCross c={p.reject} />
                </WaxSeal>
              ) : (
                <WaxSeal
                  title="restore"
                  color={p.ok}
                  ring={p.ok}
                  bg={p.sealBg}
                  disabled={busy}
                  onClick={() => fire("restore")}
                >
                  <SealCheck c={p.ok} />
                </WaxSeal>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function RosesRow({
  score,
  accent,
  mute,
  paper,
  onTap,
}: {
  score: number;
  accent: string;
  mute: string;
  paper: string;
  onTap?: (i: number) => void;
}) {
  const [pulse, setPulse] = useState<number | null>(null);
  function handleTap(i: number) {
    if (!onTap) return;
    setPulse(i);
    setTimeout(() => setPulse(null), 340);
    onTap(i);
  }
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < score;
        const outerFill = filled ? accent : "transparent";
        const innerFill = filled
          ? `color-mix(in srgb, ${accent} 55%, ${paper})`
          : "transparent";
        const stroke = filled ? accent : mute;
        const glyph = (
          <svg
            width={14}
            height={14}
            viewBox="8 7 16 16"
            fill="none"
            style={{ display: "inline-block", flexShrink: 0 }}
            aria-hidden
          >
            <path
              d="M16 7 Q 10 10, 9 16 Q 9 22, 16 24 Q 23 22, 23 16 Q 22 10, 16 7 Z"
              fill={outerFill}
              stroke={stroke}
              strokeWidth="0.9"
            />
            <path
              d="M16 10 Q 12 12, 12 17 Q 13 21, 16 22 Q 19 21, 20 17 Q 20 12, 16 10 Z"
              fill={innerFill}
              stroke={stroke}
              strokeWidth="0.6"
              opacity={filled ? 1 : 0.55}
            />
            {filled && <circle cx="16" cy="16" r="1.6" fill={paper} />}
          </svg>
        );
        if (!onTap) return <span key={i}>{glyph}</span>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => handleTap(i)}
            aria-label={`set importance ${i + 1}`}
            title={`importance ${i + 1}`}
            style={{
              background: "transparent",
              border: "none",
              padding: 2,
              cursor: "pointer",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "rgba(0,0,0,0.1)",
            }}
          >
            <span className={pulse === i ? "kimi-rose-tap-active" : ""}>{glyph}</span>
          </button>
        );
      })}
    </span>
  );
}
