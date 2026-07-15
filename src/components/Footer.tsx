import { getMoonPhase } from "@/lib/moon-phase";
import { MoonPhaseSvg } from "@/components/MoonPhaseSvg";
import { getTheme } from "@/lib/day-theme";

// Day mode footer: rose stage tracks day-of-month in 4 weekly stages.
// Day 1-7 = bud, 8-14 = half-open, 15-22 = fuller open, 23-end = full bloom.
// Reset every 1st. Parallels the night mode moon phase as a sense of time.
//
// Icon = GPT-image-1 generated PNG (owner 2026-05-15 02:43:52), four bloom
// stages cropped + alpha-cleaned. Drop-shadow filter adds Mucha pink halo.

// Per-stage filter (owner 0318):
//  stage 1 含苞   = E filter  (sepia 0.25 + halo) — cream bud glow
//  stage 2-4     = F filter  (opacity 0.78 + halo) — keep GPT pink, 微透
// 之前 per-stage sepia 让盛放 looked dried — 改 F 保留鲜花色 + 半透 + 光晕.
const ROSE_STAGES = [
  {
    src: "/icons/rose-day-1.png",
    name: "Apprivoiser",
    filter:
      "sepia(0.25) drop-shadow(0 0 1px rgba(164,43,94,0.55)) drop-shadow(0 0 2px rgba(164,43,94,0.28))",
    opacity: 1,
    size: 18,
  },
  {
    src: "/icons/rose-day-2.png",
    name: "Voir le cœur",
    filter:
      "drop-shadow(0 0 1px rgba(164,43,94,0.55)) drop-shadow(0 0 2px rgba(164,43,94,0.28))",
    opacity: 0.78,
    size: 18,
  },
  {
    src: "/icons/rose-day-3.png",
    name: "Pour toujours",
    filter:
      "drop-shadow(0 0 1px rgba(164,43,94,0.55)) drop-shadow(0 0 2px rgba(164,43,94,0.28))",
    opacity: 0.78,
    size: 18,
  },
  {
    src: "/icons/rose-day-4.png",
    name: "Unique au monde",
    filter:
      "drop-shadow(0 0 1px rgba(164,43,94,0.55)) drop-shadow(0 0 2px rgba(164,43,94,0.28))",
    opacity: 0.78,
    size: 18,
  },
] as const;

function roseStageForDay(dayOfMonth: number) {
  if (dayOfMonth <= 7) return ROSE_STAGES[0];
  if (dayOfMonth <= 14) return ROSE_STAGES[1];
  if (dayOfMonth <= 22) return ROSE_STAGES[2];
  return ROSE_STAGES[3];
}

const ROSE_HALO_TIGHT = "rgba(164, 43, 94, 0.55)"; // Mucha pink
const ROSE_HALO_WIDE = "rgba(164, 43, 94, 0.28)";

function DayRoseIcon({
  src,
  alt,
  filter,
  opacity,
  size,
}: {
  src: string;
  alt: string;
  filter: string;
  opacity: number;
  size: number;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          display: "block",
          filter,
          opacity,
        }}
      />
    </span>
  );
}

export async function Footer() {
  const theme = await getTheme();
  const isDay = theme === "day";

  let icon: React.ReactNode;
  let label: string;
  if (isDay) {
    const jst = new Date(Date.now() + 9 * 3600 * 1000);
    const dayOfMonth = jst.getUTCDate();
    const stage = roseStageForDay(dayOfMonth);
    icon = (
      <DayRoseIcon
        src={stage.src}
        alt={stage.name}
        filter={stage.filter}
        opacity={stage.opacity}
        size={stage.size}
      />
    );
    label = stage.name;
  } else {
    const moon = getMoonPhase();
    icon = <MoonPhaseSvg phase={moon.fraction} size={14} />;
    label = moon.name;
  }

  const accentRgba = isDay ? "rgba(90,24,32,0.9)" : "rgba(196,160,96,0.7)";
  const signRgba = isDay ? "rgba(90,24,32,0.5)" : "rgba(154,138,114,0.5)";

  return (
    <footer
      className="py-24 text-center"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        color: "rgba(184,176,168,0.55)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          color: accentRgba,
        }}
      >
        {icon}
        <span
          style={{
            fontSize: 11,
            letterSpacing: 3,
            fontStyle: "italic",
            fontFamily: 'var(--font-serif)',
          }}
        >
          {label}
        </span>
      </div>
      {/* footer signature · fork 用户改成自己想要的名字 */}
      <p
        className="text-xs tracking-[0.2em]"
        style={{ color: signRgba }}
      >
        kimi・room
      </p>
    </footer>
  );
}
