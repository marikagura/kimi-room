"use client";

// V2 ActiveStateCard · canon UI restored · swap server `/api/active-state/${id}`
// → client `activeStateStore` IDB (edit / close = soft delete by store.delete).

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
import { activeStateStore } from "@/lib/stores";

export type ActiveStateData = {
  id: string;
  stateType: string;
  title: string;
  summary: string | null;
  content: string;
  startAt: string; // ISO
  source: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  HEALTH: "健康 · HEALTH",
  MOOD: "情绪 · MOOD",
  PROJECT: "项目 · PROJECT",
  STRESS: "压力 · STRESS",
  RELATIONSHIP: "关系 · RELATIONSHIP",
  SCHEDULE: "日程 · SCHEDULE",
  SELF_CONCERN: "自身 · SELF",
};

function formatJst(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function ActiveStateCard({
  state,
  theme,
  onRemoved,
}: {
  state: ActiveStateData;
  theme: ReviewTheme;
  onRemoved?: (id: string) => void;
}) {
  const p = paletteFor(theme);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(state.title);
  const [draftContent, setDraftContent] = useState(state.content);
  const [title, setTitle] = useState(state.title);
  const [content, setContent] = useState(state.content);

  if (removed) return null;

  async function fire(
    action: "edit" | "close",
    payload?: { title?: string; content?: string },
  ) {
    setBusy(true);
    try {
      if (action === "edit") {
        const existing = await activeStateStore().get(state.id);
        if (!existing) throw new Error("not found");
        await activeStateStore().put({
          ...existing,
          title: payload?.title ?? existing.title,
          body: payload?.content ?? existing.body,
        });
        if (payload?.title) setTitle(payload.title);
        if (payload?.content) setContent(payload.content);
        setEditing(false);
      } else {
        await activeStateStore().delete(state.id);
        setRemoved(true);
        onRemoved?.(state.id);
      }
    } catch (e) {
      console.error("[active-state]", e);
      alert("出错了。再试一次。");
    } finally {
      setBusy(false);
    }
  }

  const isDay = theme === "day";
  const hingeColor = isDay ? p.dropCap : p.accent;
  const typeLabel = TYPE_LABEL[state.stateType] ?? state.stateType;

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
        padding: "20px 22px 16px",
        marginTop: 14,
        marginBottom: 0,
        boxShadow: isDay
          ? `inset 0 1px 0 rgba(251,238,201,0.04)`
          : `0 0 0 4px ${p.cardBg}, 0 0 0 5px ${p.hairline}`,
        margin: isDay ? undefined : "4px",
      }}
    >
      <HingeMedallion color={hingeColor} paper={p.paper} />

      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Chip src={typeLabel} palette={p} />
        <span
          style={{
            fontSize: 10,
            fontStyle: "italic",
            color: p.inkMute,
            letterSpacing: "0.05em",
          }}
        >
          since {formatJst(state.startAt)}
        </span>
      </header>

      {editing ? (
        <>
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="title"
            style={{
              width: "100%",
              fontSize: 14,
              fontWeight: 500,
              color: p.ink,
              background: isDay ? "rgba(0,0,0,0.18)" : "rgba(212,175,106,0.04)",
              border: `0.6px solid ${p.hairline}`,
              borderRadius: 4,
              padding: "6px 8px",
              marginBottom: 6,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            rows={4}
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
        </>
      ) : (
        <>
          <h3
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              color: p.ink,
              fontFamily:
                'var(--font-serif-cn)',
            }}
          >
            {title}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12.5,
              color: p.inkSoft,
              lineHeight: 1.65,
              whiteSpace: "pre-line",
              fontFamily:
                'var(--font-serif-cn)',
            }}
          >
            {content}
          </p>
        </>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 14,
        }}
      >
        {editing ? (
          <>
            <WaxSeal
              title="save"
              color={p.ok}
              ring={p.ok}
              bg={p.sealBg}
              disabled={busy}
              onClick={() =>
                fire("edit", { title: draftTitle, content: draftContent })
              }
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
            <WaxSeal
              title="close"
              color={p.reject}
              ring={p.reject}
              bg={p.sealBg}
              disabled={busy}
              onClick={() => {
                if (!confirm(`Close active state "${title}"?`)) return;
                void fire("close");
              }}
            >
              <SealCross c={p.reject} />
            </WaxSeal>
          </>
        )}
      </div>
    </article>
  );
}
