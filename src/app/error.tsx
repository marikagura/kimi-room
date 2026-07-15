"use client";

import { useState } from "react";

// 500 · day + night 都 Variant500B (沙漏倒洒 + 时间洒了一桌 replaced by
// "L'égarement"). 字 day+night 统一 法语 "L'égarement" (owner 260517 0146).

const IVORY = "#ebdfd4";
const GOTHIC = "#0c0c0c";
const INK = "#1a0e0a";
const INK_NIGHT = "#d8d0c8";
const GOLD = "#c4a060";

function HourglassSpilled({ color }: { color: string }) {
  return (
    <svg
      width={90}
      height={90}
      viewBox="0 0 60 60"
      aria-hidden
      fill="none"
      stroke={color}
      strokeWidth="0.8"
    >
      <g transform="rotate(28 30 30)">
        <line x1="14" y1="10" x2="46" y2="10" />
        <line x1="14" y1="50" x2="46" y2="50" />
        <path d="M15 10 Q22 22 30 30 Q22 38 15 50" />
        <path d="M45 10 Q38 22 30 30 Q38 38 45 50" />
      </g>
      <circle cx="48" cy="42" r="0.8" fill={color} stroke="none" />
      <circle cx="52" cy="46" r="0.6" fill={color} stroke="none" />
      <circle cx="49" cy="48" r="0.5" fill={color} stroke="none" />
      <circle cx="54" cy="50" r="0.4" fill={color} stroke="none" />
      <circle cx="50" cy="52" r="0.5" fill={color} stroke="none" />
    </svg>
  );
}

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isDay] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.dataset.theme === "day";
  });
  return (
    <main
      style={{
        background: isDay ? IVORY : GOTHIC,
        color: isDay ? INK : INK_NIGHT,
        minHeight: "100svh",
        padding: "50px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <HourglassSpilled color={GOLD} />
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 56,
          fontWeight: 300,
          fontStyle: "italic",
          color: GOLD,
          letterSpacing: 4,
          marginTop: 16,
        }}
      >
        500
      </div>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: "italic",
          fontSize: 18,
          marginTop: 12,
          letterSpacing: 1,
        }}
      >
        L&apos;égarement
      </div>
      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: 24,
          fontSize: 11,
          color: GOLD,
          letterSpacing: 3,
          fontStyle: "italic",
          fontFamily: 'var(--font-serif)',
          background: "transparent",
          border: `0.4px solid ${GOLD}`,
          padding: "8px 16px",
          cursor: "pointer",
          borderRadius: 0,
        }}
      >
        ↻ retry
      </button>
    </main>
  );
}
