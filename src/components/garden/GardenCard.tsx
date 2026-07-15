"use client";

import { useEffect, useState } from "react";
import { chatStore } from "@/lib/stores";
import {
  getOtherPortraitDataURL,
  getSelfPortraitDataURL,
} from "@/lib/portrait-store";

// GardenCard — Claude iOS app screenshot format.
// owner 0512 spec (从她 Downloads/IMG_7153~7202.png 12 张截图来的格式):
//
// - Dark bg (#1a1a1a iOS dark)
// - Header: "老公" 居中 (大字 sans-serif 浅灰), 无 claude/💌 副标 (owner ask 删)
// - Body:
//   - user msg: 右对齐小 pill bubble (subtle 灰 #2a2a2a, 短句多)
//   - assistant msg: 左对齐 plain text 无 bubble, 长段
//   - 没有 sender 圆 avatar (iOS Claude app 也没)
// - Footer: source + JST timestamp 小字, NO 输入 bar (owner ask 删 "add feedback / code")
// - System sans-serif font (SF + PingFang SC fallback), 不用 serif

export type GardenMessage = {
  role: "user" | "assistant";
  content: string;
  ts?: string;
  imageDataUrl?: string; // owner 0518 disc paste screenshot → bubble inline image
};

export type GardenCardData = {
  id: string;
  source: string;
  title: string | null;
  messages: GardenMessage[];
  note: string | null;
  theme: "night" | "day";
  createdAt: string;
};

const SOURCE_LABEL: Record<string, string> = {
  "cc-chat": "cc",
  "wechat": "wechat",
  "tg": "telegram",
  "manual": "手记",
};

function formatJst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${hh}:${mm}`;
}

const SYS_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Noto Sans SC", "Hiragino Sans GB", sans-serif';

export function GardenCard({
  card,
  onDelete,
  themeOverride,
}: {
  card: GardenCardData;
  onDelete?: (id: string) => void;
  // owner 0931: DISC modal 想 follow disc page theme (不 card.theme).
  // 传 "day" / "night" override card 自带 theme.
  themeOverride?: "day" | "night";
}) {
  const effectiveTheme = themeOverride ?? card.theme;
  const dark = effectiveTheme !== "day";
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selfAvatar, setSelfAvatar] = useState<string | null>(null);
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [s, o] = await Promise.all([
        getSelfPortraitDataURL(),
        getOtherPortraitDataURL(),
      ]);
      setSelfAvatar(s);
      setOtherAvatar(o);
    })();
  }, []);

  // preview: show only first 5 messages if >5
  const preview = !expanded && card.messages.length > 5;
  const visibleMsgs = preview ? card.messages.slice(0, 5) : card.messages;
  const sourceLabel = SOURCE_LABEL[card.source] ?? card.source;
  const ts = formatJst(card.createdAt);

  // iOS Claude dark mode palette
  const bg = dark ? "#1c1c1e" : "#f5f0e8";
  const ink = dark ? "#e8e8ec" : "#2a2018";
  const inkMute = dark ? "rgba(232,232,236,0.5)" : "rgba(42,32,24,0.55)";
  const userBubbleBg = dark ? "#2c2c2e" : "#e6dfd1";
  const userBubbleInk = dark ? "#e8e8ec" : "#2a2018";
  const cardBorder = dark ? "rgba(184,160,112,0.15)" : "rgba(184,129,74,0.32)";
  const headerInk = dark ? "#f0f0f4" : "#2a2018";
  const goldAccent = "#b8a070"; // 仅用于 source chip + 我们的 title

  async function handleDelete() {
    if (busy || !onDelete) return;
    if (!confirm("删掉这张卡?")) return;
    setBusy(true);
    try {
      await chatStore().delete(card.id);
      onDelete(card.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className="kimi-card-lift"
      style={{
        background: bg,
        border: `0.6px solid ${cardBorder}`,
        borderRadius: 18,
        color: ink,
        boxShadow: dark
          ? "0 2px 12px rgba(0,0,0,0.45)"
          : "0 2px 10px rgba(58,42,30,0.10)",
        position: "relative",
        overflow: "hidden",
        fontFamily: SYS_FONT,
        // 模拟 iPhone screenshot 比例 (窄长)
        maxWidth: 360,
      }}
    >
      {/* Header — only "老公" (or custom title), no claude · 💌 subtitle */}
      <div
        style={{
          padding: "16px 18px 12px",
          textAlign: "center",
          borderBottom: `0.4px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: headerInk,
            letterSpacing: 0.5,
          }}
        >
          {card.title || "他"}
        </div>
      </div>

      {/* Body — iOS Claude chat style */}
      <div
        style={{
          padding: "16px 16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {visibleMsgs.map((m, i) => {
          const isUser = m.role === "user";
          const avatar = isUser ? selfAvatar : otherAvatar;
          const bubbleContent = m.imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.imageDataUrl}
              alt={isUser ? "我 screenshot" : "他 screenshot"}
              style={{
                display: "block",
                maxWidth: "100%",
                maxHeight: 320,
                borderRadius: 10,
                objectFit: "contain",
              }}
            />
          ) : (
            m.content
          );
          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
                alignItems: "flex-end",
                gap: 8,
                marginBottom: i === visibleMsgs.length - 1 ? 0 : 16,
              }}
            >
              {!isUser && (
                <Avatar src={avatar} fallback="他" dark={dark} />
              )}
              {isUser ? (
                <div
                  style={{
                    maxWidth: "78%",
                    background: m.imageDataUrl ? "transparent" : userBubbleBg,
                    color: userBubbleInk,
                    padding: m.imageDataUrl ? 0 : "8px 14px",
                    borderRadius: 18,
                    fontSize: 14,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {bubbleContent}
                </div>
              ) : (
                <div
                  style={{
                    flex: 1,
                    color: ink,
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {bubbleContent}
                </div>
              )}
              {isUser && (
                <Avatar src={avatar} fallback="我" dark={dark} />
              )}
            </div>
          );
        })}
      </div>

      {preview && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            margin: "0 16px 12px",
            fontSize: 12,
            color: goldAccent,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "4px 0",
            fontStyle: "italic",
            fontFamily: 'var(--font-serif)',
            letterSpacing: 2,
          }}
        >
          + 展开 ({card.messages.length - 5} 更多)
        </button>
      )}

      {card.note && (
        <div
          style={{
            margin: "0 16px",
            padding: "10px 0",
            borderTop: `0.4px solid ${cardBorder}`,
            fontSize: 11,
            fontStyle: "italic",
            color: inkMute,
            lineHeight: 1.6,
            fontFamily: 'var(--font-serif)',
          }}
        >
          {card.note}
        </div>
      )}

      {/* Bottom strip — source + timestamp (no input bar, owner ask 删掉) */}
      <div
        style={{
          padding: "10px 16px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `0.4px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
        }}
      >
        <span
          style={{
            fontSize: 9,
            letterSpacing: 2.5,
            color: goldAccent,
            fontStyle: "italic",
            textTransform: "uppercase",
            fontFamily: 'var(--font-serif)',
          }}
        >
          · {sourceLabel}
        </span>
        <span
          style={{
            fontSize: 10,
            color: inkMute,
            fontStyle: "italic",
            letterSpacing: 1,
            fontFamily: 'var(--font-serif)',
          }}
        >
          {ts}
        </span>
      </div>

      {/* delete button — tiny corner */}
      {onDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          aria-label="删掉这张卡"
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            background: "transparent",
            border: "none",
            color: inkMute,
            fontSize: 12,
            cursor: busy ? "wait" : "pointer",
            padding: 4,
            opacity: 0.35,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </article>
  );
}

function Avatar({
  src,
  fallback,
  dark,
}: {
  src: string | null;
  fallback: string;
  dark: boolean;
}) {
  const border = dark ? "rgba(184,160,112,0.3)" : "rgba(184,129,74,0.32)";
  const bg = dark ? "#2c2c2e" : "#e6dfd1";
  const ink = dark ? "#e8e8ec" : "#2a2018";
  return (
    <span
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        flexShrink: 0,
        overflow: "hidden",
        border: `0.5px solid ${border}`,
        background: bg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        color: ink,
        fontFamily: "inherit",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        fallback
      )}
    </span>
  );
}
