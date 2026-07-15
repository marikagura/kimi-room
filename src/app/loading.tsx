// Root route-segment loading state — shown by Next.js while the next page
// fetches data. Two-layer feedback:
//   1) top edge shimmer sweep (subtle but visible)
//   2) center "loading…" pill with pulsing rose dot
// Reads kimi-theme cookie so day mode gets a rose pill on ivory instead of
// a black pill drifting on玫瑰 cream.
import { cookies } from "next/headers";

async function readTheme(): Promise<"day" | "night"> {
  const c = await cookies();
  const v = c.get("kimi-theme")?.value;
  return v && v.trim().toLowerCase() === "day" ? "day" : "night";
}

export default async function Loading() {
  const theme = await readTheme();
  const isDay = theme === "day";

  // shimmer: gold on night, Mucha pink on day
  const shimmerRGB = isDay ? "164, 43, 94" : "196, 160, 96"; // #A42B5E / #c4a060
  // pill
  const pillBg = isDay ? "rgba(252, 240, 230, 0.78)" : "rgba(20, 16, 12, 0.62)";
  const pillBorder = isDay
    ? "rgba(164, 43, 94, 0.32)"
    : "rgba(196, 160, 96, 0.35)";
  const pillColor = isDay ? "#5a1820" : "#c4a060";
  const pillShadow = isDay
    ? "0 4px 14px rgba(90, 24, 32, 0.18)"
    : "0 4px 16px rgba(0, 0, 0, 0.3)";
  const dotColor = isDay ? "#a42b5e" : "#b35268";
  const dotGlow = isDay ? "164, 43, 94" : "179, 82, 104";

  return (
    <>
      <style>{`
        @keyframes kimi-shimmer-sweep {
          0%   { background-position: -120% 0; opacity: 0.6; }
          50%  { opacity: 1; }
          100% { background-position: 220% 0; opacity: 0.6; }
        }
      `}</style>
      {/* top edge shimmer */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 2.5,
          background: `linear-gradient(90deg, transparent 0%, rgba(${shimmerRGB},0) 15%, rgba(${shimmerRGB},1) 50%, rgba(${shimmerRGB},0) 85%, transparent 100%)`,
          backgroundSize: "200% 100%",
          animation: "kimi-shimmer-sweep 1.6s ease-in-out infinite",
          zIndex: 9999,
          pointerEvents: "none",
          boxShadow: `0 0 4px rgba(${shimmerRGB},0.5)`,
        }}
      />
      {/* center pill — clear "loading" feedback */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 20px",
          borderRadius: 24,
          background: pillBg,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          color: pillColor,
          fontSize: 12,
          fontStyle: "italic",
          letterSpacing: 3,
          fontFamily: 'var(--font-serif)',
          border: `0.5px solid ${pillBorder}`,
          boxShadow: pillShadow,
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: dotColor,
            animation: "kimi-pulse-dot 1s ease-in-out infinite",
            boxShadow: `0 0 6px rgba(${dotGlow},0.6)`,
          }}
        />
        loading…
      </div>
    </>
  );
}
