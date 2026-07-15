"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GardenCard, type GardenCardData } from "../garden/GardenCard";
import { GardenAddForm } from "../garden/GardenAddForm";
import { chatStore } from "@/lib/stores";
import type { ChatEntry } from "@/lib/stores/types";

function chatEntryToCard(e: ChatEntry): GardenCardData {
  return {
    id: e.id,
    source: e.source,
    title: e.title,
    messages: e.messages,
    note: e.note,
    theme: e.theme,
    createdAt: e.createdAt,
  };
}

// /room/disc client — turntable + chat shuffle (owner 0706 + 0738 + 0742).
// 0742 fix: theme-aware (day mode 进入 是 night palette 的 bug).
// day turntable = light plinth + clear vinyl (类 preview finance-drawer day).

const FONT_DISPLAY = 'var(--font-serif)';

// ─────────────────────────────────────────────────────────────
// palette switch
// ─────────────────────────────────────────────────────────────
type Pal = {
  ink: string;
  mute: string;
  gold: string;
  hair: string;
  labelRose: string;
  bronzeDk: string;
  // turntable
  plinthBg: string;
  plinthBorder: string;
  plinthShadow: string;
  feltBg: string;
  feltBorder: string;
  feltShadow: string;
  // summary card
  cardBg: string;
  // overlay (list / chat / paste modal)
  overlayBg: string;
  overlayBorder: string;
  // vinyl pressing
  pressing: "clear" | "black";
};

function makePal(isDay: boolean): Pal {
  if (isDay) {
    return {
      ink: "#1a0e0a",
      mute: "rgba(26,14,10,0.55)",
      gold: "#8a6558", // day bronze
      hair: "rgba(106,74,72,0.32)",
      labelRose: "#A42B5E", // Mucha 粉 day
      bronzeDk: "#5A3A28",
      plinthBg: "linear-gradient(180deg, #d8c8b8 0%, #b89878 100%)",
      plinthBorder: "#8a6558",
      plinthShadow:
        "inset 0 2px 8px rgba(255,255,255,0.4), inset 0 -2px 8px rgba(90,40,20,0.2), 0 8px 22px rgba(60,30,20,0.25)",
      feltBg: "radial-gradient(circle, #c8b8a0 0%, #a89478 100%)",
      feltBorder: "rgba(90,40,20,0.4)",
      feltShadow: "inset 0 0 18px rgba(90,40,20,0.25)",
      cardBg: "linear-gradient(180deg, rgba(245,235,222,0.7) 0%, rgba(220,207,194,0.5) 100%)",
      overlayBg: "#f5ebde",
      overlayBorder: "rgba(106,74,72,0.5)",
      pressing: "clear",
    };
  }
  return {
    ink: "#e8e6e0",
    mute: "rgba(232,230,224,0.5)",
    gold: "#b8a070",
    hair: "rgba(184,160,112,0.22)",
    labelRose: "#c8576f",
    bronzeDk: "#5A3A28",
    plinthBg: "linear-gradient(180deg, #1c1612 0%, #0e0a08 100%)",
    plinthBorder: "rgba(184,160,112,0.4)",
    plinthShadow:
      "inset 0 2px 12px rgba(0,0,0,0.7), 0 8px 30px rgba(0,0,0,0.6)",
    feltBg: "radial-gradient(circle, #2a1c20 0%, #1a1216 100%)",
    feltBorder: "rgba(184,160,112,0.3)",
    feltShadow: "inset 0 0 30px rgba(0,0,0,0.6)",
    cardBg:
      "linear-gradient(180deg, rgba(45,38,28,0.4) 0%, rgba(20,16,12,0.25) 100%)",
    overlayBg: "#15110f",
    overlayBorder: "rgba(184,160,112,0.22)",
    pressing: "black",
  };
}

// ─────────────────────────────────────────────────────────────
// Vinyl disc (theme-aware pressing)
// ─────────────────────────────────────────────────────────────
function VinylDisc({
  size = 200,
  showText = true,
  pressing = "black",
  labelColor,
}: {
  size?: number;
  showText?: boolean;
  pressing?: "clear" | "black";
  labelColor: string;
}) {
  const r = size / 2;
  const isClear = pressing === "clear";
  const grad = isClear
    ? { c0: "#fff", c1: "#f0e8de", c2: "#d8c8b8" }
    : { c0: "#1a1410", c1: "#0a0806", c2: "#000" };
  const grooveStroke = isClear ? "#a8927c" : "#2a2018";
  const grooveOpacity = isClear ? 0.45 : 0.7;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        display: "block",
        filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.45))",
      }}
    >
      <defs>
        <radialGradient id={`disc-body-${size}-${pressing}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={grad.c0} stopOpacity={isClear ? 0.92 : 1} />
          <stop offset="55%" stopColor={grad.c1} stopOpacity={isClear ? 0.85 : 1} />
          <stop offset="100%" stopColor={grad.c2} stopOpacity={isClear ? 0.78 : 1} />
        </radialGradient>
        <radialGradient id={`disc-shine-${size}-${pressing}`} cx="30%" cy="30%" r="55%">
          <stop offset="0%" stopColor="#fff" stopOpacity={isClear ? 0.55 : 0.18} />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={r} cy={r} r={r - 0.5} fill={`url(#disc-body-${size}-${pressing})`} />
      {Array.from({ length: 20 }).map((_, i) => (
        <circle
          key={i}
          cx={r}
          cy={r}
          r={r * 0.32 + i * ((r * 0.66) / 20)}
          fill="none"
          stroke={grooveStroke}
          strokeWidth="0.32"
          opacity={grooveOpacity}
        />
      ))}
      <circle cx={r} cy={r} r={r - 1} fill={`url(#disc-shine-${size}-${pressing})`} />
      <circle cx={r} cy={r} r={r * 0.32} fill={labelColor} />
      <circle
        cx={r}
        cy={r}
        r={r * 0.32}
        fill="none"
        stroke="#0a0806"
        strokeWidth="0.5"
        opacity="0.6"
      />
      <circle
        cx={r}
        cy={r}
        r={r * 0.26}
        fill="none"
        stroke="#0a0806"
        strokeWidth="0.3"
        opacity="0.4"
      />
      {showText && (
        <>
          <text
            x={r}
            y={r - r * 0.16}
            textAnchor="middle"
            fontFamily="var(--font-serif)"
            fontStyle="italic"
            fontSize={r * 0.07}
            fill="#f5e4c2"
            letterSpacing="1.2"
            opacity="0.9"
          >
            kimi
          </text>
          <text
            x={r}
            y={r + r * 0.05}
            textAnchor="middle"
            fontFamily="var(--font-serif)"
            fontStyle="italic"
            fontSize={r * 0.045}
            fill="#f5e4c2"
            letterSpacing="1"
            opacity="0.75"
          >
            SIDE · A
          </text>
          <text
            x={r}
            y={r + r * 0.2}
            textAnchor="middle"
            fontFamily="var(--font-serif)"
            fontStyle="italic"
            fontSize={r * 0.038}
            fill="#f5e4c2"
            letterSpacing="2"
            opacity="0.65"
          >
            33⅓ RPM
          </text>
        </>
      )}
      <circle cx={r} cy={r} r={r * 0.035} fill="#0a0806" />
      <circle cx={r} cy={r} r={r * 0.02} fill="#000" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Mucha corner ornament
// ─────────────────────────────────────────────────────────────
function MuchaCorner({
  size = 22,
  color,
  flipX = false,
  flipY = false,
}: {
  size?: number;
  color: string;
  flipX?: boolean;
  flipY?: boolean;
}) {
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      style={{ transform: `scale(${sx}, ${sy})`, opacity: 0.55 }}
    >
      <path
        d="M2 2 Q 2 14 14 14 M 2 2 L 12 2 M 2 2 L 2 12"
        stroke={color}
        strokeWidth="0.6"
        fill="none"
      />
      <circle cx="14" cy="14" r="1.4" fill={color} opacity="0.8" />
      <path d="M 6 6 Q 9 4 12 6 Q 10 9 6 6 Z" fill={color} opacity="0.5" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Turntable (theme-aware day=light plinth/clear vinyl, night=dark)
// ─────────────────────────────────────────────────────────────
function Turntable({
  onShuffle,
  onListOpen,
  P,
}: {
  onShuffle: () => void;
  onListOpen: () => void;
  P: Pal;
}) {
  const tonearmGrad =
    "linear-gradient(90deg, #d4b88c 0%, #a8896a 50%, #6e553a 100%)";
  const pivotBg = "radial-gradient(circle, #d8bc8a 0%, #7a5a3a 100%)";
  const cartridgeBg = "#5A1820";

  return (
    <div
      style={{
        position: "relative",
        margin: "16px auto 0",
        maxWidth: 360,
        height: 290,
        background: P.plinthBg,
        border: `0.8px solid ${P.plinthBorder}`,
        boxShadow: P.plinthShadow,
      }}
    >
      <div style={{ position: "absolute", top: 8, left: 8 }}>
        <MuchaCorner color={P.gold} />
      </div>
      <div style={{ position: "absolute", top: 8, right: 8 }}>
        <MuchaCorner color={P.gold} flipX />
      </div>
      <div style={{ position: "absolute", bottom: 8, left: 8 }}>
        <MuchaCorner color={P.gold} flipY />
      </div>
      <div style={{ position: "absolute", bottom: 8, right: 8 }}>
        <MuchaCorner color={P.gold} flipX flipY />
      </div>

      {/* platter (felt) + vinyl 居中 plinth (owner 0821: 左右 margin 一致) */}
      {/* plinth 360 wide. group [felt(200) + overlap 100 + vinyl(200)] = 300 wide
          → margin 30 each side. felt left 30, vinyl left 130 (overlap 50%). */}
      <div
        style={{
          position: "absolute",
          top: 26,
          left: 30,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: P.feltBg,
          border: `0.6px solid ${P.feltBorder}`,
          boxShadow: P.feltShadow,
        }}
      />

      {/* vinyl — 整体 spin (owner 0821: revert 之前 wrapper rotate 是对的, 整 vinyl 转) */}
      <div style={{ position: "absolute", top: 36, left: 130 }}>
        <div className="kimi-disc-spin" style={{ display: "block" }}>
          <VinylDisc size={200} pressing={P.pressing} labelColor={P.labelRose} />
        </div>
      </div>

      {/* tonearm */}
      <div
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          transform: "rotate(-22deg)",
          transformOrigin: "top right",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: pivotBg,
            border: "1px solid #5A3A28",
            boxShadow:
              "inset 0 -2px 4px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.4)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#3a2818",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 168,
            height: 4,
            background: tonearmGrad,
            borderRadius: 3,
            boxShadow: "0 1px 3px rgba(0,0,0,0.45)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 10,
            left: -160,
            width: 20,
            height: 14,
            background: cartridgeBg,
            border: `0.5px solid ${P.gold}`,
            boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
          }}
        />
      </div>

      {/* speed dial knob = list 入口 (owner 0738) */}
      <button
        onClick={onListOpen}
        aria-label="all discs"
        style={{
          position: "absolute",
          bottom: 14,
          left: 14,
          display: "flex",
          gap: 8,
          alignItems: "center",
          background: "transparent",
          border: "none",
          padding: 4,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: pivotBg,
            border: "0.6px solid #5A3A28",
            boxShadow:
              "inset 0 -1.5px 3px rgba(0,0,0,0.3), 0 1.5px 3px rgba(0,0,0,0.4)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 3,
              left: "50%",
              transform: "translateX(-50%)",
              width: 2,
              height: 7,
              background: "#1a1410",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontStyle: "italic",
            fontSize: 9,
            color: P.gold,
            letterSpacing: 2,
          }}
        >
          33⅓
        </span>
      </button>

      {/* brand plate */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          right: 14,
          fontFamily: FONT_DISPLAY,
          fontStyle: "italic",
          fontSize: 9,
          color: P.gold,
          letterSpacing: 3,
          opacity: 0.85,
        }}
      >
        ◐ kimi · disc
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Transport row — owner 0821: prev / shuffle / next 三 button 一行
// (design 同款). prev/next 小三角 brass color, shuffle 中央 brass+rose.
// ─────────────────────────────────────────────────────────────
function TransportRow({
  onPrev,
  onShuffle,
  onNext,
  P,
}: {
  onPrev: () => void;
  onShuffle: () => void;
  onNext: () => void;
  P: Pal;
}) {
  const triangleStroke = P.gold;
  return (
    <div
      style={{
        margin: "32px auto 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
      }}
    >
      <button
        onClick={onPrev}
        aria-label="previous"
        style={{
          background: "transparent",
          border: "none",
          padding: 8,
          cursor: "pointer",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M18 4 L 8 12 L 18 20 Z M 6 4 L 6 20" fill={triangleStroke} />
        </svg>
      </button>

      <button
        onClick={onShuffle}
        aria-label="shuffle"
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          // owner 0850: match speed knob soft brass, 不要 saturated 亮金
          background:
            "radial-gradient(circle at 35% 35%, #d8bc8a 0%, #7a5a3a 100%)",
          border: "1.5px solid #5A3A28",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          boxShadow:
            "0 6px 14px rgba(60,40,24,0.35), inset 0 -2px 4px rgba(0,0,0,0.35), inset 0 1.5px 2px rgba(255,235,200,0.25)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 26 26">
          <path
            d="M3 8 L 9 8 L 13 13 L 17 8 L 23 8 M 17 8 L 21 6 M 17 8 L 21 10"
            stroke="#1a0e08"
            strokeWidth="1.6"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M3 18 L 9 18 L 13 13 L 17 18 L 23 18 M 17 18 L 21 16 M 17 18 L 21 20"
            stroke="#1a0e08"
            strokeWidth="1.6"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <button
        onClick={onNext}
        aria-label="next"
        style={{
          background: "transparent",
          border: "none",
          padding: 8,
          cursor: "pointer",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M6 4 L 16 12 L 6 20 Z M 18 4 L 18 20" fill={triangleStroke} />
        </svg>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Summary card — 一张 碟片 mini + 一句话 (owner 0738)
// ─────────────────────────────────────────────────────────────
function SummaryCard({
  card,
  P,
  onClick,
}: {
  card: GardenCardData;
  P: Pal;
  onClick: () => void;
}) {
  const title = card.title || pickFirstLine(card.messages[0]?.content) || "无题";
  const ts = formatJstShort(card.createdAt);

  return (
    <button
      onClick={onClick}
      style={{
        margin: "32px auto 0",
        display: "flex",
        gap: 18,
        alignItems: "center",
        padding: "14px 18px",
        maxWidth: 360,
        width: "calc(100% - 16px)",
        background: P.cardBg,
        border: `0.6px solid ${P.hair}`,
        textAlign: "left",
        cursor: "pointer",
        fontFamily: FONT_DISPLAY,
        color: P.ink,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <VinylDisc
          size={56}
          showText={false}
          pressing={P.pressing}
          labelColor={P.labelRose}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontStyle: "italic",
            color: P.ink,
            letterSpacing: 0.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 9,
            color: P.mute,
            fontStyle: "italic",
            letterSpacing: 1.5,
          }}
        >
          {ts} &nbsp;·&nbsp; tap to read
        </div>
      </div>
      <span
        style={{
          flexShrink: 0,
          color: P.gold,
          fontSize: 14,
          fontStyle: "italic",
          opacity: 0.7,
        }}
      >
        ↗
      </span>
    </button>
  );
}

function pickFirstLine(content?: string): string | null {
  if (!content) return null;
  const line = content.split(/\r?\n/)[0]?.trim();
  if (!line) return null;
  return line.length > 36 ? line.slice(0, 36) + "…" : line;
}

function formatJstShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${m}.${day}`;
}

// ─────────────────────────────────────────────────────────────
// Modal — full GardenCard expand
// ─────────────────────────────────────────────────────────────
function ChatModal({
  card,
  P,
  isDay,
  onClose,
}: {
  card: GardenCardData;
  P: Pal;
  isDay: boolean;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "60px 12px 40px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", maxWidth: 400, width: "100%" }}
      >
        <button
          onClick={onClose}
          aria-label="close"
          style={{
            position: "absolute",
            top: -42,
            right: 0,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: `0.6px solid ${P.hair}`,
            color: P.gold,
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT_DISPLAY,
            fontStyle: "italic",
          }}
        >
          ×
        </button>
        <GardenCard card={card} themeOverride={isDay ? "day" : "night"} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// List overlay — owner 0738 speed knob 弹
// ─────────────────────────────────────────────────────────────
function ListOverlay({
  cards,
  pickedIdx,
  P,
  onClose,
  onPick,
}: {
  cards: GardenCardData[];
  pickedIdx: number;
  P: Pal;
  onClose: () => void;
  onPick: (idx: number) => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: P.overlayBg,
          border: `0.6px solid ${P.overlayBorder}`,
          maxWidth: 480,
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          padding: "24px 20px",
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontStyle: "italic",
            fontSize: 18,
            color: P.gold,
            letterSpacing: 3,
            marginBottom: 18,
            textAlign: "center",
          }}
        >
          all discs · {cards.length}
        </div>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {cards.map((c, i) => {
            const isCurrent = i === pickedIdx;
            const title =
              c.title || pickFirstLine(c.messages[0]?.content) || "无题";
            return (
              <li key={c.id}>
                <button
                  onClick={() => onPick(i)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    background: isCurrent
                      ? "rgba(200,87,111,0.12)"
                      : "transparent",
                    border: "none",
                    borderBottom: `0.4px solid ${P.overlayBorder}`,
                    color: isCurrent ? P.labelRose : P.ink,
                    fontFamily: FONT_DISPLAY,
                    fontStyle: "italic",
                    fontSize: 13,
                    letterSpacing: 0.5,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ color: P.gold, marginRight: 8, opacity: 0.7 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {title}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Paste form modal — owner 0738 footer "✎ paste" link tap → 弹
// ─────────────────────────────────────────────────────────────
function PasteFormModal({
  P,
  onClose,
  onAdded,
}: {
  P: Pal;
  onClose: () => void;
  onAdded: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "60px 16px 40px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", maxWidth: 420, width: "100%" }}
      >
        <button
          onClick={onClose}
          aria-label="close"
          style={{
            position: "absolute",
            top: -42,
            right: 0,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: `0.6px solid ${P.hair}`,
            color: P.gold,
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT_DISPLAY,
            fontStyle: "italic",
          }}
        >
          ×
        </button>
        <GardenAddForm
          onAdded={() => {
            onAdded();
            onClose();
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
export function DiscClient({ isDay = false }: { isDay?: boolean }) {
  const P = makePal(isDay);
  const [cards, setCards] = useState<GardenCardData[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pickedIdx, setPickedIdx] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await chatStore().list();
      const all = rows.map(chatEntryToCard);
      all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setCards(all);
      setErr(null);
      if (all.length > 0) {
        setPickedIdx(Math.floor(Math.random() * all.length));
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const shuffle = useCallback(() => {
    if (!cards || cards.length === 0) return;
    if (cards.length === 1) return;
    let next = pickedIdx;
    while (next === pickedIdx) {
      next = Math.floor(Math.random() * cards.length);
    }
    setPickedIdx(next);
  }, [cards, pickedIdx]);

  const prev = useCallback(() => {
    if (!cards || cards.length === 0) return;
    setPickedIdx((i) => (i - 1 + cards.length) % cards.length);
  }, [cards]);

  const next = useCallback(() => {
    if (!cards || cards.length === 0) return;
    setPickedIdx((i) => (i + 1) % cards.length);
  }, [cards]);

  const total = cards?.length ?? 0;
  const current = cards?.[pickedIdx];

  return (
    <div style={{ padding: "8px 20px 60px", fontFamily: FONT_DISPLAY, color: P.ink }}>
      {total > 0 && (
        <div
          style={{
            textAlign: "center",
            marginTop: 12,
            fontFamily: FONT_DISPLAY,
            fontStyle: "italic",
            fontSize: 10,
            color: P.gold,
            letterSpacing: 4,
          }}
        >
          Shuffle &nbsp;·&nbsp; {pickedIdx + 1} / {total} &nbsp;·&nbsp; Side A
        </div>
      )}

      <Turntable onShuffle={shuffle} onListOpen={() => setListOpen(true)} P={P} />

      {err && (
        <div
          style={{
            color: "#c47878",
            fontSize: 11,
            fontStyle: "italic",
            textAlign: "center",
            margin: "24px 0",
          }}
        >
          {err}
        </div>
      )}

      {cards === null ? (
        <div
          style={{
            textAlign: "center",
            color: P.mute,
            fontStyle: "italic",
            fontSize: 12,
            letterSpacing: 2,
            margin: "32px 0",
          }}
        >
          loading...
        </div>
      ) : current ? (
        <SummaryCard card={current} P={P} onClick={() => setChatOpen(true)} />
      ) : (
        <div
          style={{
            textAlign: "center",
            maxWidth: 480,
            padding: 40,
            margin: "0 auto",
            color: P.mute,
            fontStyle: "italic",
            fontSize: 12,
            letterSpacing: 2,
            lineHeight: 1.7,
          }}
        >
          disc 是空的
          <br />
          <span style={{ fontSize: 10, opacity: 0.8 }}>
            跟他说 &quot;pin 这个&quot; 或者从 footer paste 进来
          </span>
        </div>
      )}

      {/* transport row · prev / shuffle / next (owner 0821 design 同款) */}
      {total > 0 && (
        <TransportRow onPrev={prev} onShuffle={shuffle} onNext={next} P={P} />
      )}

      {/* footer · 一起听 + paste inline 小字 link */}
      <div
        style={{
          marginTop: 36,
          display: "flex",
          justifyContent: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/playlist"
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 11,
            color: P.mute,
            fontStyle: "italic",
            letterSpacing: 3,
            textDecoration: "none",
          }}
        >
          ♪ 一起听
        </Link>
        <button
          onClick={() => setPasteOpen(true)}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: FONT_DISPLAY,
            fontSize: 11,
            color: P.mute,
            fontStyle: "italic",
            letterSpacing: 3,
          }}
        >
          ✎ paste
        </button>
      </div>

      {listOpen && cards && (
        <ListOverlay
          cards={cards}
          pickedIdx={pickedIdx}
          P={P}
          onClose={() => setListOpen(false)}
          onPick={(i) => {
            setPickedIdx(i);
            setListOpen(false);
          }}
        />
      )}
      {chatOpen && current && (
        <ChatModal
          card={current}
          P={P}
          isDay={isDay}
          onClose={() => setChatOpen(false)}
        />
      )}
      {pasteOpen && (
        <PasteFormModal
          P={P}
          onClose={() => setPasteOpen(false)}
          onAdded={refresh}
        />
      )}
    </div>
  );
}
