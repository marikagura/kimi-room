"use client";

// V2 ReviewCard · canon UI restored · 走 memoryStore IDB instead of
// `/api/memory-review/${id}` server endpoint. For V2 alpha · review items
// are memory entries with reviewStatus='pending' · owner 0525 Q3 ack.

import { useState } from "react";
import { HourglassIcon } from "@/components/HourglassIcon";
import { paletteFor, chipLabelFor, type ReviewTheme } from "./theme";
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

export type ReviewItemData = {
  id: string;
  pendingType: string;
  title: string;
  content: string;
  sourceRefType: string | null;
  priority: number;
  createdAt: string;
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

export function ReviewCard({
  item,
  theme,
  onRemoved,
}: {
  item: ReviewItemData;
  theme: ReviewTheme;
  onRemoved?: (id: string) => void;
}) {
  const p = paletteFor(theme);
  const isDay = theme === "day";
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.content);
  const [content, setContent] = useState(item.content);
  const [priority, setPriority] = useState(item.priority);

  if (removed) return null;

  type Action = "approve" | "reject" | "edit" | "expire" | "priority";
  async function fire(
    action: Action,
    payload?: { content?: string; priority?: number },
  ) {
    setBusy(true);
    try {
      const existing = await memoryStore().get(item.id);
      if (!existing) throw new Error("not found");
      if (action === "edit") {
        await memoryStore().put({
          ...existing,
          content: payload?.content ?? existing.content,
        });
        setContent(payload?.content ?? content);
        setEditing(false);
      } else if (action === "priority") {
        const next = payload?.priority ?? 0;
        await memoryStore().put({ ...existing, order: next });
        setPriority(next);
      } else if (action === "approve") {
        await memoryStore().put({
          ...existing,
          reviewStatus: "approved",
          active: true,
        });
        setRemoved(true);
        onRemoved?.(item.id);
      } else if (action === "reject") {
        await memoryStore().put({
          ...existing,
          reviewStatus: "rejected",
          active: false,
        });
        setRemoved(true);
        onRemoved?.(item.id);
      } else if (action === "expire") {
        await memoryStore().delete(item.id);
        setRemoved(true);
        onRemoved?.(item.id);
      }
    } catch (e) {
      console.error("[review-card]", e);
      alert("出错了。再试一次。");
    } finally {
      setBusy(false);
    }
  }

  function handleRoseTap(idx: number) {
    const target = priority === idx + 1 ? 0 : idx + 1;
    setPriority(target);
    void fire("priority", { priority: target });
  }

  const dropCap = content.charAt(0);
  const rest = content.slice(1);
  const chipText = chipLabelFor(item.pendingType, item.sourceRefType);
  const ts = formatJst(item.createdAt);
  const conf = Math.max(0, Math.min(5, priority));

  const hingeColor = isDay ? p.dropCap : p.accent;

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
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontStyle: "italic",
            fontSize: 11,
            color: p.inkMute,
            letterSpacing: "0.05em",
          }}
        >
          {ts}
        </span>
        <ConfidenceRoses
          score={conf}
          accent={p.dropCap}
          mute={p.inkMute}
          paper={p.paper}
          onTap={busy ? undefined : handleRoseTap}
        />
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          autoFocus
          style={{
            width: "100%",
            background: isDay ? "rgba(0,0,0,0.25)" : "rgba(212,175,106,0.04)",
            color: p.ink,
            border: `0.6px solid ${p.hairline}`,
            borderRadius: 6,
            padding: 12,
            fontSize: 14,
            lineHeight: 1.7,
            fontFamily: "inherit",
            resize: "vertical",
            outline: "none",
          }}
        />
      ) : (
        <p
          style={{
            margin: "0 0 12px",
            color: p.ink,
            fontSize: 13.5,
            lineHeight: 1.7,
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
          {rest}
        </p>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginTop: 6,
        }}
      >
        <Chip src={chipText} palette={p} />

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {editing ? (
            <>
              <WaxSeal
                title="save"
                color={p.ok}
                ring={p.ok}
                bg={p.sealBg}
                disabled={busy}
                onClick={() => fire("edit", { content: draft })}
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
                  setDraft(content);
                  setEditing(false);
                }}
              >
                <SealBack c={p.inkMute} />
              </WaxSeal>
            </>
          ) : (
            <>
              <WaxSeal
                title="approve"
                color={p.ok}
                ring={p.ok}
                bg={p.sealBg}
                disabled={busy}
                onClick={() => fire("approve")}
              >
                <SealCheck c={p.ok} />
              </WaxSeal>
              <WaxSeal
                title="edit"
                color={p.edit}
                ring={p.hairline}
                bg={p.sealBg}
                disabled={busy}
                onClick={() => {
                  setDraft(content);
                  setEditing(true);
                }}
              >
                <SealPen c={p.edit} />
              </WaxSeal>
              <WaxSeal
                title="expire"
                color={p.expire}
                ring={p.hairline}
                bg={p.sealBg}
                disabled={busy}
                onClick={() => fire("expire")}
              >
                <HourglassIcon size={13} />
              </WaxSeal>
              <WaxSeal
                title="reject"
                color={p.reject}
                ring={p.reject}
                bg={p.sealBg}
                disabled={busy}
                onClick={() => fire("reject")}
              >
                <SealCross c={p.reject} />
              </WaxSeal>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function ConfidenceRoses({
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
  onTap?: (index: number) => void;
}) {
  const [pulse, setPulse] = useState<number | null>(null);
  function handleTap(i: number) {
    if (!onTap) return;
    setPulse(i);
    setTimeout(() => setPulse(null), 340);
    onTap(i);
  }
  return (
    <span
      aria-label={`confidence ${score}/5`}
      style={{ display: "inline-flex", gap: 3, alignItems: "center" }}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < score;
        const glyph = (
          <RoseGlyph filled={filled} accent={accent} mute={mute} paper={paper} />
        );
        if (!onTap) return <span key={i}>{glyph}</span>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => handleTap(i)}
            aria-label={`set priority ${i + 1}`}
            title={`priority ${i + 1}`}
            style={{
              background: "transparent",
              border: "none",
              padding: 2,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
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

function RoseGlyph({
  filled,
  accent,
  mute,
  paper,
}: {
  filled: boolean;
  accent: string;
  mute: string;
  paper: string;
}) {
  const outerFill = filled ? accent : "transparent";
  const innerFill = filled
    ? `color-mix(in srgb, ${accent} 55%, ${paper})`
    : "transparent";
  const stroke = filled ? accent : mute;
  return (
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
}
