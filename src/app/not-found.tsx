import Link from "next/link";
import { getTheme } from "@/lib/day-theme";

// 404 · day → 大数字 + 孤独玫瑰, night → 三月相 fade + 四〇四. 字统一 "迷路了".

const IVORY = "#ebdfd4";
const GOTHIC = "#0c0c0c";
const INK = "#1a0e0a";
const INK_NIGHT = "#d8d0c8";
const ROSE = "#a83040";
const GOLD = "#c4a060";
const MUTE_DAY = "rgba(26,14,10,0.5)";

function LoneRose({ color, mute }: { color: string; mute: string }) {
  return (
    <svg width={80} height={80} viewBox="0 0 60 60" aria-hidden>
      <path d="M30 58 Q31 44 30 30" stroke={mute} strokeWidth="0.6" fill="none" />
      <path
        d="M30 46 Q24 44 22 40 Q26 44 30 44 Z"
        fill={`${mute}80`}
        stroke={mute}
        strokeWidth="0.4"
      />
      <path
        d="M30 8 Q44 11, 47 22 Q53 27, 49 38 Q47 51, 30 52 Q13 51, 11 38 Q7 27, 13 22 Q16 11, 30 8 Z"
        fill={`${color}30`}
        stroke={color}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M30 22 Q37 26, 33 32 Q26 32, 30 24"
        fill="none"
        stroke={color}
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <path
        d="M30 24 Q34 28, 31 31"
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ThreePhaseMoon() {
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 16 }}>
      <svg width="32" height="32" viewBox="0 0 24 24" style={{ opacity: 0.3 }}>
        <circle cx="12" cy="12" r="12" fill="#e4d3ad" />
        <path d="M 12,0 A 12,12 0 0 0 12,24 A 6,12 0 0 1 12,0 Z" fill="rgba(14,8,4,0.94)" />
      </svg>
      <svg
        width="50"
        height="50"
        viewBox="0 0 24 24"
        style={{ filter: "drop-shadow(0 0 8px rgba(212,154,86,0.32))" }}
      >
        <defs>
          <radialGradient id="m404-light" cx="38%" cy="36%" r="70%">
            <stop offset="0%" stopColor="#fff6e0" />
            <stop offset="55%" stopColor="#e4d3ad" />
            <stop offset="100%" stopColor="#9b7c50" />
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="12" fill="url(#m404-light)" />
        <path d="M 12,0 A 12,12 0 0 0 12,24 A 0.1,12 0 0 1 12,0 Z" fill="rgba(14,8,4,0.94)" />
      </svg>
      <svg width="32" height="32" viewBox="0 0 24 24" style={{ opacity: 0.3 }}>
        <circle cx="12" cy="12" r="12" fill="#e4d3ad" />
        <path d="M 12,0 A 12,12 0 0 1 12,24 A 6,12 0 0 0 12,0 Z" fill="rgba(14,8,4,0.94)" />
      </svg>
    </div>
  );
}

export default async function NotFound() {
  const theme = await getTheme();
  const isDay = theme === "day";
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
      {isDay ? (
        <>
          <LoneRose color={ROSE} mute={MUTE_DAY} />
          <div
            style={{
              fontFamily: '"Cormorant Garamond", serif',
              fontSize: 84,
              fontWeight: 300,
              fontStyle: "italic",
              color: GOLD,
              letterSpacing: 4,
              lineHeight: 1,
              marginTop: 10,
            }}
          >
            404
          </div>
        </>
      ) : (
        <>
          <ThreePhaseMoon />
          <div
            style={{
              fontFamily: '"Cormorant Garamond", "Noto Serif SC", serif',
              fontStyle: "italic",
              fontSize: 22,
              color: GOLD,
              letterSpacing: 2,
            }}
          >
            四〇四
          </div>
        </>
      )}
      <div
        style={{
          fontFamily: '"Cormorant Garamond", "Noto Serif SC", serif',
          fontStyle: "italic",
          fontSize: 16,
          marginTop: 14,
          letterSpacing: 1,
        }}
      >
        迷路了
      </div>
      <Link
        href="/room"
        style={{
          marginTop: 28,
          fontSize: 11,
          color: GOLD,
          letterSpacing: 3,
          fontStyle: "italic",
          fontFamily: '"Cormorant Garamond", serif',
          borderBottom: `0.6px solid ${GOLD}`,
          paddingBottom: 2,
          textDecoration: "none",
        }}
      >
        ← back
      </Link>
    </main>
  );
}
