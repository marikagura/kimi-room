import Link from "next/link";
import { getTheme } from "@/lib/day-theme";
import { DEMO_PAPERS } from "@/lib/ephemera-demo";
import { EphemeraClient } from "@/components/ephemera/EphemeraClient";

// Open-source build: the room is fed a neutral, fictional demo set (see
// lib/ephemera-demo.ts). In core mode, swap DEMO_PAPERS for papers read from
// kimi-core; to drive live push, wire the pipeline described in docs/EPHEMERA.md.
export default async function EphemeraPage() {
  const theme = await getTheme();
  const isDay = theme === "day";
  // A quiet surround so the white paper reads like a receipt against a dark
  // night (or warm daylight). The sheets carry their own thermal-paper palette.
  const bg = isDay ? "#e9ddcf" : "#141010";
  const mute = isDay ? "#8a6f5a" : "#6f6257";

  return (
    <main style={{ background: bg, minHeight: "100dvh", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 20px)",
          left: 20,
          zIndex: 8,
        }}
      >
        <Link
          href="/room"
          aria-label="回到 room"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: mute,
            textDecoration: "none",
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: "italic",
            fontSize: 13,
            letterSpacing: 1,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M9 2 L 4 7 L 9 12" stroke="currentColor" strokeWidth="1.3" fill="none" />
          </svg>
          room
        </Link>
      </div>

      <EphemeraClient papers={DEMO_PAPERS} isDay={isDay} />
    </main>
  );
}
