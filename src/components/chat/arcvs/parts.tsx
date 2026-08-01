"use client";

// The pieces of one ARCVS conversation, in the order they appear down a turn:
// the cost bar that stays at the top, then per-message COGITATIO / tool lines /
// bubble / card, then the three bare action marks.

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  CheckMark,
  Chevron,
  CopyMark,
  Diamond,
  ForkMark,
  FourPointStar,
  LinkMark,
  ListenMark,
  RewindMark,
  RingGauge,
  SwipeArrow,
} from "./icons";
import { FONT_CN, FONT_LATIN, ONUM, type Palette } from "./tokens";
import { chatImageUrl, type LinkPreview } from "@/lib/chat-media";

// ============================================
// MEMORIA · the cost bar
// ============================================

export type CostStats = {
  /** 0–1. Share of input tokens served from cache this session. */
  cacheHit: number | null;
  contextUsed: number;
  contextMax: number;
  /** USD spent today, when the backend reports a price. */
  spendToday: number | null;
};

function compactTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

/**
 * Always at the head of the page, never a popover. Three readings: how much of
 * the context was cached, how full the window is, what today cost. The context
 * gauge turns amber past 85% and red past 95% — the only place the chat shifts
 * hue on its own.
 */
export function CostBar({ p, stats }: { p: Palette; stats: CostStats }) {
  const frac = stats.contextMax > 0 ? stats.contextUsed / stats.contextMax : 0;
  const gaugeColor = frac > 0.95 ? p.bad : frac > 0.85 ? p.warn : p.gold;
  // Latin and figures only. The tiny sizes are a latin-only tier — a Chinese
  // gloss here would either sit under the 9px floor or push the row onto two
  // lines on a narrow phone.
  const label = {
    fontSize: 6.5,
    letterSpacing: 1.5,
    fontFamily: FONT_LATIN,
    whiteSpace: "nowrap",
  } as const;

  return (
    <div
      style={{
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: "0 18px",
        padding: "6px 0 7px",
        borderTop: `1px solid ${p.ruleSoft}`,
        borderBottom: `1px solid ${p.rule}`,
        position: "relative",
      }}
    >
      <span
        aria-hidden
        style={{ position: "absolute", left: 0, bottom: -1, width: 26, height: 1, background: p.goldHi }}
      />
      {stats.cacheHit != null && (
        <>
          <span style={{ display: "flex", width: 13, height: 13, flex: "none" }}>
            <RingGauge color={p.gold} track={p.ruleSoft} frac={stats.cacheHit} />
          </span>
          <span style={{ ...label, letterSpacing: 2, color: p.goldDim }} title="缓存命中率">
            MEMORIA{" "}
            <span style={{ ...ONUM, fontSize: 8, color: p.goldHi }}>
              {Math.round(stats.cacheHit * 100)}%
            </span>
          </span>
        </>
      )}
      <span style={{ flex: 1, minWidth: 4 }} />
      <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
        <span style={{ ...label, color: p.inkMute, overflow: "hidden", textOverflow: "ellipsis" }} title="已用 / 上限">
          CONTEXTVS{" "}
          <span style={{ ...ONUM, color: p.inkSoft }}>{compactTokens(stats.contextUsed)}</span>/
          <span style={ONUM}>{compactTokens(stats.contextMax)}</span>
        </span>
        <span
          style={{
            width: 44,
            height: 3,
            borderRadius: 2,
            background: p.ruleSoft,
            overflow: "hidden",
            display: "inline-block",
          }}
        >
          <span
            style={{
              display: "block",
              width: `${Math.min(100, frac * 100)}%`,
              height: "100%",
              background:
                frac > 0.85
                  ? gaugeColor
                  : `linear-gradient(90deg, ${p.gold}, ${p.goldHi})`,
              transition: "width .4s ease",
            }}
          />
        </span>
      </span>
      {stats.spendToday != null && (
        <span style={{ ...label, color: p.warn, opacity: 0.85, flex: "none" }} title="今日花费">
          IMPENSA{" "}
          <span style={{ ...ONUM, fontSize: 8, color: p.warn }}>
            ${stats.spendToday < 0.01 ? stats.spendToday.toFixed(3) : stats.spendToday.toFixed(2)}
          </span>
        </span>
      )}
    </div>
  );
}

// ============================================
// COGITATIO · thinking
// ============================================

/**
 * Collapsed it is one line with a live second count; expanded the reasoning
 * shows in italic behind a hairline. While streaming the diamond breathes and
 * the counter climbs; when the reply lands the number stops at its total. No
 * spinner anywhere.
 */
export function Cogitatio({
  p,
  text,
  streaming,
  startedAt,
  seconds,
  defaultOpen,
}: {
  p: Palette;
  text?: string;
  streaming: boolean;
  startedAt?: number;
  seconds?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  // The clock lives in state, not in render: reading Date.now() while rendering
  // makes the component non-idempotent, and React may render more often than
  // the second actually ticks.
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!streaming || !startedAt) return;
    const step = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    step();
    const t = setInterval(step, 1000);
    return () => clearInterval(t);
  }, [streaming, startedAt]);

  const shown = streaming && startedAt ? elapsed : (seconds ?? 0);

  const accent = p.theme === "day" ? p.roseDim : p.goldDim;
  const accentHi = p.theme === "day" ? p.roseHi : p.gold;

  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 5,
          alignItems: "stretch",
          border: `1px dashed ${p.theme === "day" ? "rgba(142,79,60,.32)" : "rgba(201,167,106,.3)"}`,
          borderRadius: 8,
          padding: open && text ? "7px 11px 8px" : "6px 11px",
          background: p.theme === "day" ? "rgba(252,247,239,.8)" : "rgba(16,11,7,.5)",
          cursor: text ? "pointer" : "default",
          textAlign: "left",
          font: "inherit",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* the beat. It breathes while the reply is still being thought
              through and holds still once the seconds stop. */}
          <span
            className="arcvs-anim"
            aria-hidden
            style={{
              width: 6,
              height: 6,
              flex: "none",
              transform: "rotate(45deg)",
              border: `1px solid ${p.theme === "day" ? "rgba(142,79,60,.55)" : "rgba(201,167,106,.6)"}`,
              boxSizing: "border-box",
              animation: streaming
                ? "arcvs-goldbreath 2.2s ease-in-out infinite alternate"
                : undefined,
            }}
          />
          <span style={{ fontSize: 7, letterSpacing: 2.5, color: accent, fontFamily: FONT_LATIN }}>
            COGITATIO ·{" "}
            <span style={{ ...ONUM, color: accentHi }}>{shown}″</span>
          </span>
          <span style={{ flex: 1 }} />
          {text && <Chevron color={accentHi} up={open} />}
        </span>
        {open && text && (
          <span
            style={{
              fontFamily: FONT_CN,
              // 跟着正文那一档走, 比正文小一点点 —— 它是旁白不是正文
              fontSize: "calc(var(--kimi-chat-fs, 12px) - 1.5px)",
              fontStyle: "italic",
              lineHeight: 1.7,
              color: p.inkMute,
              borderLeft: `1px solid ${p.theme === "day" ? "rgba(142,79,60,.3)" : "rgba(201,167,106,.3)"}`,
              paddingLeft: 8,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              display: "block",
            }}
          >
            {text}
          </span>
        )}
      </button>
    </div>
  );
}

// ============================================
// tool lines
// ============================================

export type ToolRow = {
  id: string;
  name: string;
  arguments?: string;
  preview?: string;
  status: "pending" | "done" | "error";
  ms?: number;
};

/**
 * One line per tool call: what ran, a short result, and how it ended. Running
 * shows a soft dot, done a tick and the elapsed time, failed the message in the
 * error colour — a failure gets quieter, never hidden. Tapping a row opens its
 * arguments.
 */
export function ToolLine({ p, tool }: { p: Palette; tool: ToolRow }) {
  const [open, setOpen] = useState(false);
  const running = tool.status === "pending";
  const failed = tool.status === "error";
  const mark = failed ? p.bad : running ? p.warn : p.inkMute;

  const args = (() => {
    if (!tool.arguments) return null;
    try {
      return JSON.stringify(JSON.parse(tool.arguments), null, 2);
    } catch {
      return tool.arguments;
    }
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <button
        type="button"
        onClick={() => args && setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "transparent",
          border: "none",
          padding: "1px 0",
          cursor: args ? "pointer" : "default",
          textAlign: "left",
          font: "inherit",
          width: "100%",
        }}
      >
        {running ? (
          <span
            className="arcvs-anim"
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: p.warn,
              flex: "none",
              animation: "arcvs-pulsewarn 1.4s ease-in-out infinite",
            }}
          />
        ) : failed ? (
          <span style={{ fontSize: 10, color: p.bad, lineHeight: 1, flex: "none" }}>×</span>
        ) : (
          <CheckMark color={p.ok} />
        )}
        <span
          style={{
            fontSize: 11,
            letterSpacing: 0.5,
            color: mark,
            fontStyle: "italic",
            fontFamily: FONT_CN,
            whiteSpace: "nowrap",
          }}
        >
          {tool.name}
        </span>
        {tool.preview && (
          <span
            style={{
              fontSize: 11,
              color: p.inkMute,
              fontStyle: "italic",
              fontFamily: FONT_CN,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            · {tool.preview}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {tool.status === "done" && tool.ms != null && (
          <span style={{ ...ONUM, fontSize: 9, color: p.inkMute, flex: "none", fontFamily: FONT_LATIN }}>
            {(tool.ms / 1000).toFixed(1)}s
          </span>
        )}
      </button>
      {open && args && (
        <pre
          style={{
            margin: 0,
            marginLeft: 14,
            paddingLeft: 8,
            borderLeft: `1px solid ${p.ruleSoft}`,
            fontSize: 10,
            lineHeight: 1.55,
            color: p.inkSoft,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {args}
        </pre>
      )}
    </div>
  );
}

// ============================================
// link card
// ============================================

/**
 * A link posted on its own becomes a card: square thumbnail, two lines of
 * title, then the mark and the host. When the site gives no picture the
 * thumbnail slot keeps a paper ground and a diamond — never an empty frame.
 */
export function LinkCard({
  p,
  link,
  mine,
  compact,
}: {
  p: Palette;
  link: LinkPreview;
  mine: boolean;
  compact?: boolean;
}) {
  const side = mine ? p.rose : p.gold;
  const thumb = compact ? 58 : 64;
  // A thumbnail that will not load is treated as no thumbnail: the slot keeps
  // its paper ground and diamond rather than becoming an empty frame.
  //
  // Whether a host will serve us its picture is not knowable when the metadata
  // is scraped — some CDNs answer only to requests referred from their own
  // site, and refuse ours with or without a referrer. The answer arrives when
  // the browser actually asks, so the decision belongs here, not upstream.
  const [thumbBad, setThumbBad] = useState(false);
  const showThumb = !!link.image && !thumbBad;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer noopener"
      style={{
        display: "block",
        position: "relative",
        background: mine ? p.bubbleMe : p.bubbleThem,
        border: `1px solid ${mine ? p.bubbleMeBorder : p.bubbleThemBorder}`,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: p.theme === "day" ? "0 8px 18px rgba(120,70,70,.1)" : "0 8px 18px rgba(0,0,0,.4)",
        textDecoration: "none",
        maxWidth: 280,
      }}
    >
      <span style={{ display: "flex" }}>
        {showThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={link.image}
            alt=""
            onError={() => setThumbBad(true)}
            style={{
              width: thumb,
              height: thumb,
              objectFit: "cover",
              flex: "none",
              filter: p.theme === "night" ? "saturate(.85)" : undefined,
            }}
          />
        ) : (
          <span
            style={{
              width: thumb,
              height: thumb,
              flex: "none",
              background: p.theme === "day" ? "rgba(246,239,228,.98)" : "rgba(22,16,9,.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRight: `1px solid ${p.ruleSoft}`,
            }}
          >
            <Diamond color={side} size={14} />
          </span>
        )}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            padding: "8px 12px 7px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span
            style={{
              fontFamily: FONT_CN,
              fontSize: compact ? 10 : 10.5,
              lineHeight: 1.55,
              color: p.ink,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {link.title}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <LinkMark color={side} />
            <span
              style={{
                fontSize: 6,
                letterSpacing: 1.5,
                color: side,
                opacity: 0.8,
                fontFamily: FONT_LATIN,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {link.site}
            </span>
          </span>
        </span>
      </span>
    </a>
  );
}

// ============================================
// image message
// ============================================

/**
 * A sent picture. While it is still being stored, a ring gauge sits over it.
 *
 * Pixels normally come from IndexedDB by id. `src` is the fallback for an image
 * this device never stored — a backend that syncs pictures as URLs, or a photo
 * sent from the other device — so the bubble shows the picture instead of a
 * hole. A stale `blob:` handle from a previous page load is ignored.
 */
export function ImageBubble({
  p,
  imageId,
  src,
  w,
  h,
  progress,
  timeLabel,
}: {
  p: Palette;
  imageId: string;
  src?: string;
  w: number;
  h: number;
  progress?: number;
  timeLabel?: string;
}) {
  // Start from the plain URL when there is one so the bubble is never blank
  // while IndexedDB is being read, then swap to the stored blob once it lands.
  const initial = src && !src.startsWith("blob:") ? src : null;
  const [url, setUrl] = useState<string | null>(initial);
  useEffect(() => {
    let alive = true;
    void chatImageUrl(imageId).then((u) => {
      if (alive && u) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [imageId]);

  const maxW = 200;
  const ratio = w > 0 && h > 0 ? h / w : 0.7;
  const displayW = Math.min(maxW, w || maxW);
  const displayH = Math.round(displayW * ratio);

  return (
    <span
      style={{
        position: "relative",
        display: "block",
        width: displayW,
        height: displayH,
        border: `1px solid ${p.bubbleMeBorder}`,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: p.theme === "day" ? "0 8px 18px rgba(120,70,70,.1)" : "0 8px 18px rgba(0,0,0,.4)",
        background: p.theme === "day" ? "rgba(246,239,228,.9)" : "rgba(20,14,9,.9)",
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      )}
      {progress != null && progress < 1 && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10,6,4,.45)",
          }}
        >
          <RingGauge color={p.roseHi} track="rgba(255,255,255,.25)" frac={progress} size={26} width={2} />
        </span>
      )}
      {timeLabel && (
        <span
          style={{
            position: "absolute",
            right: 5,
            bottom: 5,
            ...ONUM,
            fontSize: 6,
            letterSpacing: 1,
            color: "rgba(255,255,255,.85)",
            background: "rgba(40,20,25,.5)",
            borderRadius: 999,
            padding: "2px 7px",
            fontFamily: FONT_LATIN,
          }}
        >
          {timeLabel}
        </span>
      )}
    </span>
  );
}

// ============================================
// action marks
// ============================================

function BareButton({
  onClick,
  label,
  children,
  disabled,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        display: "flex",
        alignItems: "center",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.28 : hover ? 1 : 0.7,
        transition: "opacity .2s",
        lineHeight: 0,
      }}
    >
      {children}
    </button>
  );
}

/**
 * Under every reply: copy, fork, rewind. Bare marks, no labels, no pills — the
 * same feel as the desktop app. Listening and the variant arrows join the row
 * when they apply, at the same weight.
 *
 * Every mark is optional and only the ones passed are drawn. Under one's own
 * message that is copy and rewind alone: forking and listening are things one
 * does to a reply, and mean nothing under the line one just typed.
 */
export function ActionMarks({
  p,
  onCopy,
  onFork,
  onRewind,
  onListen,
  listenState,
  swipe,
}: {
  p: Palette;
  onCopy: () => void;
  onFork?: () => void;
  onRewind?: () => void;
  onListen?: () => void;
  listenState?: "idle" | "loading" | "playing" | "error";
  swipe?: { index: number; total: number; onMove: (dir: 1 | -1) => void };
}) {
  const c = p.theme === "day" ? p.roseDim : p.gold;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "2px 2px 0" }}>
      <BareButton onClick={onCopy} label="复制">
        <CopyMark color={c} />
      </BareButton>
      {onFork && (
        <BareButton onClick={onFork} label="分叉 FVRCA">
          <ForkMark color={c} />
        </BareButton>
      )}
      {onRewind && (
        <BareButton onClick={onRewind} label="回拨 RETRO">
          <RewindMark color={c} />
        </BareButton>
      )}
      {onListen && (
        <BareButton onClick={onListen} label={listenState === "playing" ? "停" : "听"}>
          <ListenMark
            color={listenState === "error" ? p.bad : listenState === "loading" ? p.warn : c}
            playing={listenState === "playing"}
          />
        </BareButton>
      )}
      {swipe && swipe.total > 1 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 2 }}>
          <BareButton
            onClick={() => swipe.onMove(-1)}
            label="上一个"
            disabled={swipe.index === 0}
          >
            <SwipeArrow color={c} back />
          </BareButton>
          <span style={{ ...ONUM, fontSize: 8, letterSpacing: 1, color: p.inkMute, fontFamily: FONT_LATIN }}>
            {swipe.index + 1}/{swipe.total}
          </span>
          <BareButton onClick={() => swipe.onMove(1)} label="下一个">
            <SwipeArrow color={c} />
          </BareButton>
        </span>
      )}
    </div>
  );
}

// ============================================
// avatar
// ============================================

/**
 * The round portrait beside a bubble, shown only when avatars are on. With no
 * picture configured it falls back to the side's own mark — a diamond for the
 * other voice, a star for mine — so turning avatars on never leaves a hole and
 * the deployment carries no portrait it did not choose.
 */
export function Avatar({
  p,
  mine,
  src,
  size = 32,
  style,
}: {
  p: Palette;
  mine: boolean;
  src?: string | null;
  size?: number;
  style?: CSSProperties;
}) {
  const ring = mine ? p.bubbleMeCorner : p.bubbleThemCorner;
  return (
    <span
      style={{
        flex: "none",
        width: size,
        height: size,
        borderRadius: "50%",
        border: `1px solid ${ring}`,
        padding: 1.5,
        background: p.theme === "day" ? "rgba(252,247,239,.9)" : "rgba(10,8,6,.6)",
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
        />
      ) : mine ? (
        <FourPointStar color={p.rose} size={size * 0.42} />
      ) : (
        <Diamond color={p.gold} size={size * 0.42} filled={p.goldHi} />
      )}
    </span>
  );
}
