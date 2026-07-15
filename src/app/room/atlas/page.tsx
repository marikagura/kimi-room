import Link from "next/link";
import { DEMO_PLACES } from "@/lib/atlas-demo";
import { AtlasClient, type AtlasPalette } from "@/components/atlas/AtlasClient";
import { getTheme, ROSE_GOTHIC_DAY } from "@/lib/day-theme";
import { MUCHA_COLORWAYS } from "@/lib/mucha-tokens";

const ivoryDark = MUCHA_COLORWAYS.ivory.dark;
const NIGHT: AtlasPalette = {
  bg: ivoryDark.bg,
  bgSolid: "#0e0a06", // night window surround (solid)
  paper: ivoryDark.paper,
  ink: ivoryDark.ink,
  accent: ivoryDark.accent,
  accent2: ivoryDark.accent2,
  mute: ivoryDark.mute,
  hair: ivoryDark.hair,
};
const DAY: AtlasPalette = {
  bg: ROSE_GOTHIC_DAY.bg,
  bgSolid: "#ead9cf", // day window surround / veil (warm paper)
  paper: ROSE_GOTHIC_DAY.paper,
  ink: ROSE_GOTHIC_DAY.ink,
  accent: ROSE_GOTHIC_DAY.rose,
  accent2: ROSE_GOTHIC_DAY.roseDeep,
  mute: ROSE_GOTHIC_DAY.inkMute,
  hair: ROSE_GOTHIC_DAY.hair,
};

// The open-source build feeds the Atlas a static demo set (see lib/atlas-demo.ts).
// Swap DEMO_PLACES for your own data source — the drawing renders it unchanged.
export default async function AtlasPage() {
  const theme = await getTheme();
  const isDay = theme === "day";
  const p = isDay ? DAY : NIGHT;
  const places = DEMO_PLACES;

  return (
    <main
      className="flex-1 w-full relative"
      style={{
        background: p.bg,
        color: p.ink,
        minHeight: "100dvh",
        fontFamily: 'var(--font-serif)',
      }}
    >
      {/* back to /room */}
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "52px 24px 0" }}>
        <Link
          href="/room"
          aria-label="回到 room"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: p.mute,
            textDecoration: "none",
            fontFamily: 'var(--font-serif)',
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

      <AtlasClient places={places} p={p} isDay={isDay} />
    </main>
  );
}
