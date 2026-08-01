"use client";

// The pieces of one ARCVS conversation, in the order they appear down a turn:
// the cost bar that stays at the top, then per-message COGITATIO / ACTVS /
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
import { FONT_CN, FONT_LATIN, FONT_MONO, ONUM, type Palette } from "./tokens";
import { chatImageUrl, type LinkPreview } from "@/lib/chat-media";

// ============================================
// MEMORIA · the cost bar
// ============================================

/** One turn's reading, split into the parts the backend reports separately. */
export type TokenSplit = {
  cacheRead: number;
  cacheWrite: number;
  fresh: number;
  output: number;
};

export type CostStats = {
  contextUsed: number;
  contextMax: number;
  /** USD spent today, when the backend reports a price. */
  spendToday: number | null;
  /** The last turn, split. Null until a turn has reported usage. */
  lastTurn: TokenSplit | null;
  /** Every turn on this thread, added up, with the turn count. */
  thread: (TokenSplit & { turns: number; planTurns: number }) | null;
};

function compactTokens(n: number): string {
  // 1M rather than 1000K: the settings drawer offers 128K / 200K / 1M, and the
  // bar should read in the same units the setting is written in.
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

/**
 * Detail figures are written out in full. The rounded form is the bar's job —
 * repeating "228.4K" after a tap would make the tap pointless. Group separators
 * are for the eye: a six-digit run without them has to be counted digit by digit.
 */
function exactTokens(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Always at the head of the page, never a popover. Two readings on the face —
 * how full the window is, what this thread cost — and the breakdown behind a tap.
 *
 * The gauge has one expression: the bottom rule itself. It was previously three
 * side by side — the figures, a short inline pill, and a 26px gilt tick at the
 * lower left — and the tick read as a second progress bar because it was the
 * same weight and roughly the same length as the pill. The tick's left endpoint
 * is unchanged; it now carries the reading instead of decorating it.
 *
 * The gauge turns amber past 85% and red past 95% — the only place the chat
 * shifts hue on its own.
 */
export function CostBar({ p, stats }: { p: Palette; stats: CostStats }) {
  const [open, setOpen] = useState(false);
  const frac = stats.contextMax > 0 ? stats.contextUsed / stats.contextMax : 0;
  const pct = Math.max(0, Math.min(1, frac));
  const gaugeColor = frac > 0.95 ? p.bad : frac > 0.85 ? p.warn : p.gold;
  const night = p.theme === "night";
  // Latin and figures only. The tiny sizes are a latin-only tier — a Chinese
  // gloss here would either sit under the 9px floor or push the row onto two
  // lines on a narrow phone.
  const label = {
    fontSize: 6.5,
    letterSpacing: 1.5,
    fontFamily: FONT_LATIN,
    whiteSpace: "nowrap",
  } as const;
  // A subscription thread reports no price. Saying so beats leaving the slot blank.
  const plan = stats.spendToday == null && (stats.thread?.planTurns ?? 0) > 0;

  return (
    <div
      style={{
        flex: "none",
        position: "relative",
        margin: "0 18px",
        borderTop: `1px solid ${p.ruleSoft}`,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="用量明细"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "6px 0 7px",
          background: "transparent",
          border: "none",
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span style={{ ...label, color: p.inkMute, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
          CONTEXTVS{" "}
          <span style={{ ...ONUM, color: p.inkSoft }}>{compactTokens(stats.contextUsed)}</span>/
          <span style={ONUM}>{compactTokens(stats.contextMax)}</span>
        </span>
        <span style={{ flex: 1, minWidth: 4 }} />
        {stats.spendToday != null && (
          <span style={{ ...label, color: p.warn, opacity: 0.85, flex: "none" }}>
            IMPENSA{" "}
            <span style={{ ...ONUM, fontSize: 8, color: p.warn }}>
              ${stats.spendToday < 0.01 ? stats.spendToday.toFixed(3) : stats.spendToday.toFixed(2)}
            </span>
          </span>
        )}
        {plan && (
          <span style={{ ...label, color: p.inkMute, flex: "none" }}>
            IMPENSA <span style={{ color: p.goldDim }}>PLAN</span>
          </span>
        )}
        <span style={{ flex: "none", display: "flex", opacity: open ? 1 : 0.55 }}>
          <Chevron color={open ? (night ? p.goldHi : p.goldDim) : p.inkMute} up={open} size={9} />
        </span>
      </button>

      {/* The gauge is the rule. Track runs the full width; the gilt length is
          what has been used. Neither takes pointer events — they sit over the
          button's last two pixels, and would otherwise eat taps along that edge. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 1,
          background: p.rule,
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 2,
          width: `${pct * 100}%`,
          background: frac > 0.85 ? gaugeColor : `linear-gradient(90deg, ${p.gold}, ${p.goldHi})`,
          // At night the line carries a faint bloom: it reads as light falling on
          // dark paper rather than a plastic progress bar. Day is parchment, and
          // parchment does not glow. The trailing pair of digits is alpha — gold,
          // amber and red are all six-digit hex in both palettes, so this appends
          // cleanly.
          boxShadow: night ? `0 0 6px ${frac > 0.85 ? gaugeColor : p.gold}66` : undefined,
          transition: "width .5s ease, background .4s ease",
          pointerEvents: "none",
        }}
      />

      {open && (
        <>
          {/* Tap anywhere else to close, same as the model popover. */}
          <button
            type="button"
            aria-label="收起用量明细"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 7,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "default",
            }}
          />
          <UsagePanel p={p} stats={stats} />
        </>
      )}
    </div>
  );
}

/** One row of the panel: Chinese name, Latin tag, an old-style figure right. */
function UsageRow({
  p,
  cn,
  la,
  value,
  tone,
  mark,
}: {
  p: Palette;
  cn: string;
  la?: string;
  value: string;
  tone?: string;
  mark?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 7, padding: "3px 0" }}>
      <span style={{ fontFamily: FONT_CN, fontSize: 10, color: p.inkSoft, flex: "none" }}>{cn}</span>
      {la && (
        <span
          style={{ fontSize: 7, letterSpacing: 1.6, color: p.inkMute, fontFamily: FONT_LATIN, flex: "none" }}
        >
          {la}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 6 }} />
      {mark}
      <span
        style={{
          ...ONUM,
          fontSize: 12,
          color: tone ?? p.ink,
          fontFamily: FONT_LATIN,
          flex: "none",
          minWidth: 62,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** A section head: the diamond mark, a Latin tag, a Chinese gloss. */
function UsageHead({ p, la, cn }: { p: Palette; la: string; cn: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
      <Diamond color={p.goldDim} size={7} filled={p.goldHi} />
      <span style={{ fontSize: 7.5, letterSpacing: 2, color: p.inkMute, fontFamily: FONT_LATIN }}>{la}</span>
      {/* Section heads can carry a figure ("本线程 · 3 轮"), so old-style here too. */}
      <span style={{ ...ONUM, fontFamily: FONT_CN, fontSize: 9.5, color: p.inkMute, opacity: 0.75 }}>{cn}</span>
    </div>
  );
}

/**
 * The opened face. The bar says how full the window is; this says how it filled,
 * what the thread has spent in total, and who the bill went to. Nothing already
 * printed on the bar is repeated here — the headline figure is what remains,
 * not what has been used.
 *
 * Austere register: hairlines, small-caps Latin tags, large old-style figures,
 * nothing pictorial.
 */
function UsagePanel({ p, stats }: { p: Palette; stats: CostStats }) {
  const last = stats.lastTurn;
  const thread = stats.thread;
  const left = Math.max(0, stats.contextMax - stats.contextUsed);
  const lastIn = last ? last.cacheRead + last.cacheWrite + last.fresh : 0;
  const hit = last && lastIn > 0 ? last.cacheRead / lastIn : null;

  const seam = { height: 1, background: p.ruleSoft, margin: "9px 0 8px" } as const;

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 7px)",
        left: 0,
        right: 0,
        zIndex: 8,
        maxHeight: "66vh",
        overflowY: "auto",
        // The panel tokens exist for exactly this kind of surface.
        background: p.panel,
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        border: `1px solid ${p.panelBorder}`,
        // 3–4px: an editorial corner. This is a ledger slip drawn out from under
        // the gilt rule, not another rounded card.
        borderRadius: 4,
        boxShadow: p.panelShadow,
        padding: "13px 14px 14px",
      }}
    >
      {/* The figure in focus is what is left, not what is used — the bar
          already prints what is used, six pixels above. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ ...ONUM, fontSize: 26, lineHeight: 1, color: p.goldHi, fontFamily: FONT_LATIN }}>
          {compactTokens(left)}
        </span>
        <span style={{ fontFamily: FONT_CN, fontSize: 10, color: p.inkMute }}>还剩</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 7, letterSpacing: 2, color: p.inkMute, fontFamily: FONT_LATIN }}>
          RELIQVVM
        </span>
      </div>

      {last ? (
        <>
          <div aria-hidden style={seam} />
          <UsageHead p={p} la="VLTIMA" cn="这一轮" />
          <UsageRow
            p={p}
            cn="缓存读"
            la="CACHE · READ"
            value={exactTokens(last.cacheRead)}
            mark={
              hit != null ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flex: "none" }}>
                  <RingGauge color={p.gold} track={p.ruleSoft} frac={hit} size={9} width={1.5} />
                  <span style={{ ...ONUM, fontSize: 8, color: p.goldDim, fontFamily: FONT_LATIN }}>
                    {Math.round(hit * 100)}%
                  </span>
                </span>
              ) : undefined
            }
          />
          <UsageRow p={p} cn="缓存写" la="CACHE · WRITE" value={exactTokens(last.cacheWrite)} />
          <UsageRow p={p} cn="新送" la="FRESH" value={exactTokens(last.fresh)} />
          <UsageRow p={p} cn="出" la="OUT" value={exactTokens(last.output)} />
        </>
      ) : (
        <>
          <div aria-hidden style={seam} />
          <div style={{ fontFamily: FONT_CN, fontSize: 10, lineHeight: 1.7, color: p.inkMute }}>
            这条线程还没有一轮读数。说一句话就有了。
          </div>
        </>
      )}

      {thread && (
        <>
          <div aria-hidden style={seam} />
          <UsageHead p={p} la="SVMMA" cn={`${thread.turns} 轮`} />
          <UsageRow
            p={p}
            cn="进"
            la="IN"
            value={exactTokens(thread.cacheRead + thread.cacheWrite + thread.fresh)}
          />
          <UsageRow p={p} cn="出" la="OUT" value={exactTokens(thread.output)} />
        </>
      )}

      <div aria-hidden style={seam} />
      {/* Two grains under one head: the dollar figure is kept per day and spans
          every thread, while the plan count is this thread's. The day is marked
          on the row that has one; the other carries its own unit. */}
      <UsageHead p={p} la="IMPENSA" cn="" />
      <UsageRow
        p={p}
        cn="接口"
        la="API · 今日"
        value={stats.spendToday != null ? `$${stats.spendToday.toFixed(4)}` : "——"}
        tone={stats.spendToday != null ? p.warn : p.inkMute}
      />
      {(thread?.planTurns ?? 0) > 0 && (
        <UsageRow
          p={p}
          cn="订阅额度"
          la="PLAN"
          value={`${thread?.planTurns} 轮`}
          tone={p.inkSoft}
        />
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
// ACTVS · tool rows
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
 * One thin line per tool call. Done is a solid diamond and the elapsed time;
 * running is an amber edge with a sweep and a pulsing dot; failed is a red edge
 * with the message left in place — a failure gets quieter, never hidden.
 */
export function Actus({ p, tool }: { p: Palette; tool: ToolRow }) {
  const [open, setOpen] = useState(false);
  const running = tool.status === "pending";
  const failed = tool.status === "error";

  const edge = failed ? p.bad : running ? p.warn : p.gold;
  const mark = failed ? p.bad : running ? p.warn : p.goldDim;

  const args = (() => {
    if (!tool.arguments) return null;
    try {
      return JSON.stringify(JSON.parse(tool.arguments), null, 2);
    } catch {
      return tool.arguments;
    }
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        onClick={() => args && setOpen((v) => !v)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: `1px solid ${failed ? "rgba(192,80,60,.4)" : p.ruleSoft}`,
          borderLeft: `2px solid ${edge}`,
          borderRadius: 7,
          padding: "5.5px 10px",
          background: p.theme === "day" ? "rgba(252,247,241,.85)" : "rgba(14,10,6,.6)",
          overflow: "hidden",
          cursor: args ? "pointer" : "default",
          textAlign: "left",
          font: "inherit",
          width: "100%",
        }}
      >
        {running && (
          <span
            className="arcvs-anim"
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: "45%",
              background: `linear-gradient(105deg, transparent, ${
                p.theme === "day" ? "rgba(176,64,99,.06)" : "rgba(230,205,150,.08)"
              } 48%, transparent)`,
              animation: "arcvs-sweep 2.6s linear infinite",
              pointerEvents: "none",
            }}
          />
        )}
        <Diamond color={mark} size={9} filled={failed || running ? undefined : p.goldHi} />
        <span
          style={{
            fontSize: 7,
            letterSpacing: 1.8,
            color: mark,
            fontFamily: FONT_LATIN,
            whiteSpace: "nowrap",
          }}
        >
          ACTVS · {tool.name}
        </span>
        {tool.preview && (
          <span
            style={{
              fontSize: 9,
              letterSpacing: 0.5,
              color: p.inkMute,
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
        {tool.status === "done" && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              flex: "none",
              fontSize: 6.5,
              letterSpacing: 1,
              color: p.ok,
            }}
          >
            <CheckMark color={p.ok} />
            {tool.ms != null && <span style={ONUM}>{(tool.ms / 1000).toFixed(1)}″</span>}
          </span>
        )}
        {running && (
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
            fontFamily: FONT_MONO,
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
