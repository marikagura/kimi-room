import Link from "next/link";
import { DualAvatarsClient } from "@/components/mucha/DualAvatarsClient";
import { MuchaArch } from "@/components/mucha/MuchaArch";
import { MuchaVine } from "@/components/mucha/MuchaVine";
import { MuchaMedallion } from "@/components/mucha/MuchaMedallion";
import { MuchaMosaic } from "@/components/mucha/MuchaMosaic";
import { MUCHA_COLORWAYS } from "@/lib/mucha-tokens";
import { getMoonPhase } from "@/lib/moon-phase";
import { MoonPhaseSvg } from "@/components/MoonPhaseSvg";
import { RoseBloomDial } from "@/components/RoseBloomDial";
import { getTheme, ROSE_GOTHIC_DAY } from "@/lib/day-theme";
import { ThemeToggleLink } from "@/components/ThemeToggle";
import { cookies } from "next/headers";
import { resolveRoom, ROOM_LAYOUT_COOKIE, ROMAN } from "@/lib/room-blocks";

// 强制每次访问拿最新月相 (server-rendered 用当下 date — 不要 build time 静态化)
export const dynamic = "force-dynamic";

// Night palette — Mucha ivory dark (default).
const NIGHT_PALETTE = MUCHA_COLORWAYS.ivory.dark;

// Day palette adapted to MuchaPalette shape so existing SVG components
// (Arch / Vine / Medallion / Mosaic) keep working.
const DAY_PALETTE = {
  bg: ROSE_GOTHIC_DAY.bg,
  paper: ROSE_GOTHIC_DAY.paper,
  ink: ROSE_GOTHIC_DAY.ink,
  accent: ROSE_GOTHIC_DAY.rose,
  accent2: ROSE_GOTHIC_DAY.roseDeep,
  mute: ROSE_GOTHIC_DAY.inkMute,
  hair: ROSE_GOTHIC_DAY.hair,
} as const;

// Landing blocks are assembled from the registry in src/lib/room-blocks.ts.
// The user picks per block (tile / bottom-link / off) in /backstage/settings;
// the choice rides in the `kimi-room-layout` cookie. Default = canon 6 as tiles
// + any addon (Atlas) as a bottom link.

export default async function RoomPage({
  searchParams,
}: {
  searchParams?: Promise<{ day?: string }>;
}) {
  // 可选 ?day=YYYY-MM-DD override 月相 + day-of-month rose stage. 不传用 today.
  const params = (await searchParams) ?? {};
  const dayOverride = params.day;
  const refDate = dayOverride
    ? new Date(`${dayOverride}T12:00:00+09:00`)
    : new Date();
  // Theme from cookie (set by ThemeToggleLink server action).
  const theme = await getTheme();
  const isDay = theme === "day";
  const p = isDay ? DAY_PALETTE : NIGHT_PALETTE;
  const moon = getMoonPhase();

  // Assemble landing blocks from the registry + the user's saved layout cookie.
  const layoutCookie = (await cookies()).get(ROOM_LAYOUT_COOKIE)?.value;
  const { tiles, links } = resolveRoom(layoutCookie ? decodeURIComponent(layoutCookie) : null);
  // JST day-of-month for rose stage selection (day mode hero)
  const jst = new Date(refDate.getTime() + 9 * 3600 * 1000);
  const dayOfMonth = jst.getUTCDate();
  return (
    <main
      className="flex-1 w-full relative overflow-hidden"
      style={{
        background: p.bg,
        color: p.ink,
        fontFamily: 'var(--font-serif)',
      }}
    >
      {/* ambient animations — 月相 idle slow rotate + avatars breathing */}
      <style>{`
        @keyframes kimi-moon-idle {
          0%   { transform: rotate(0deg);   filter: drop-shadow(0 0 8px rgba(212,154,86,0.32)) drop-shadow(0 0 14px rgba(212,154,86,0.18)); }
          50%  { filter: drop-shadow(0 0 11px rgba(212,154,86,0.42)) drop-shadow(0 0 18px rgba(212,154,86,0.24)); }
          100% { transform: rotate(360deg); filter: drop-shadow(0 0 8px rgba(212,154,86,0.32)) drop-shadow(0 0 14px rgba(212,154,86,0.18)); }
        }
        @keyframes kimi-breath {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.025); }
        }
        .kimi-moon-idle   { animation: kimi-moon-idle 90s linear infinite; }
        .kimi-breath      { animation: kimi-breath 4.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .kimi-moon-idle, .kimi-breath { animation: none; }
        }
      `}</style>

      {/* mosaic corners */}
      <div aria-hidden style={{ position: "absolute", top: 10, left: 10, color: p.hair, opacity: 0.6 }}>
        <MuchaMosaic color={p.hair} accent={p.accent} size={40} />
      </div>
      <div
        aria-hidden
        style={{ position: "absolute", top: 10, right: 10, color: p.hair, opacity: 0.6, transform: "scaleX(-1)" }}
      >
        <MuchaMosaic color={p.hair} accent={p.accent} size={40} />
      </div>

      <div className="relative max-w-md mx-auto w-full pt-14 pb-24 px-4">
        {/* framed section — medallion + moon + vine + grid 都在 arch 里面.
            secondary nav 在 framed 外, 不被 arch 包. */}
        <div style={{ position: "relative" }}>
          {/* outer poster arch — anchored to framed section, base 在 V/VI 底.
              top: -30 让 flower crown 探出 framed 顶 (medallion 上方仍可见,
              跟之前 iPhone 上的视觉一致). bottom: 0 = framed 底 = grid 底. */}
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              top: -30,
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 350,
              color: p.hair,
              opacity: 0.9,
            }}
          >
            <MuchaArch color={p.hair} accent={p.accent} />
          </div>
          {/* medallion with avatars */}
          <div className="flex justify-center mt-5">
          <div style={{ position: "relative", width: 170, height: 170 }}>
            <div style={{ position: "absolute", inset: 0, color: p.hair }}>
              <MuchaMedallion color={p.hair} accent={p.accent} size={170} />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <DualAvatarsClient size={54} accent={p.accent} gap={-6} />
            </div>
          </div>
        </div>

        {/* hero — tap → /chat. day mode: rose bloom dial (4 stage by
            day-of-month). night mode: real moon phase SVG. */}
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <Link
            href="/chat"
            aria-label={
              isDay
                ? `open chat — 玫瑰盛放 day ${dayOfMonth}`
                : `open chat — 今天 ${moon.name}`
            }
            title={isDay ? `day ${dayOfMonth}` : moon.name}
            style={{
              display: "inline-block",
              lineHeight: 0,
              textDecoration: "none",
              transition: "transform 200ms",
            }}
            className={
              isDay
                ? "hover:scale-105 active:scale-95"
                : "kimi-moon-idle hover:scale-105 active:scale-95"
            }
          >
            {isDay ? (
              <RoseBloomDial
                day={dayOfMonth}
                size={64}
                accentMain={DAY_PALETTE.accent2}
                accentDeep={DAY_PALETTE.accent}
                hairline={DAY_PALETTE.accent}
              />
            ) : (
              <MoonPhaseSvg phase={moon.fraction} size={64} />
            )}
          </Link>
        </div>

        {/* vine divider */}
        <div style={{ padding: "12px 70px 0", color: p.hair }}>
          <MuchaVine color={p.hair} accent={p.accent} />
        </div>

        {/* 3x2 module grid */}
        <div
          className="grid grid-cols-2 gap-3"
          style={{ padding: "18px 26px", position: "relative", zIndex: 2 }}
        >
          {tiles.map((m, i) => (
            <Link
              key={m.id}
              href={m.href}
              className="block"
              style={{
                height: 128,
                position: "relative",
                background: `linear-gradient(180deg, ${p.paper} 0%, transparent 140%)`,
                border: `0.6px solid ${p.hair}`,
                padding: 12,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                overflow: "hidden",
                color: p.ink,
              }}
            >
              <svg
                viewBox="0 0 100 20"
                width="100%"
                height="14"
                style={{ color: p.hair, position: "absolute", top: 0, left: 0, right: 0 }}
              >
                <path d="M4 18 Q4 2 50 2 Q96 2 96 18" fill="none" stroke="currentColor" strokeWidth="0.5" />
                <circle cx="50" cy="5" r="1" fill={p.accent} />
              </svg>
              <div style={{ fontSize: 10, letterSpacing: 2, color: p.accent, fontStyle: "italic", marginTop: 6 }}>
                {ROMAN[i + 1] ?? i + 1}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 22,
                    color: p.ink,
                    letterSpacing: 0.5,
                    fontFamily: 'var(--font-serif)',
                    fontWeight: 400,
                  }}
                >
                  {m.name}
                </div>
                <div style={{ fontSize: 8, letterSpacing: 3, color: p.mute, marginTop: 3 }}>
                  {m.sub}
                </div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 0.5, background: p.hair }} />
                  <div style={{ color: p.accent, fontSize: 12 }}>→</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        </div>{/* /framed section — arch base 在 V/VI 底 */}

        {/* secondary nav · owner 0519 0407 · backstage 放 theme toggle 旁 · 同
            字体 · 昼/夜 dim (虚色 opacity 0.65) · backstage 实色 (opacity 1) */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginTop: 22,
          }}
        >
          <ThemeToggleLink current={theme} color={p.mute} />
          {/* addon blocks (registry slot "link") — same register as backstage */}
          {links.map((b) => (
            <Link
              key={b.id}
              href={b.href}
              style={{
                padding: "8px 14px",
                margin: 0,
                fontSize: 14,
                letterSpacing: 3,
                color: p.ink,
                fontStyle: "italic",
                fontFamily: 'var(--font-serif)',
                textDecoration: "none",
                opacity: 0.82,
              }}
            >
              {b.name.toLowerCase()}
            </Link>
          ))}
          <Link
            href="/backstage"
            style={{
              padding: "8px 14px",
              margin: 0,
              fontSize: 14,
              letterSpacing: 3,
              color: p.ink,
              fontStyle: "italic",
              fontFamily: 'var(--font-serif)',
              textDecoration: "none",
              opacity: 1,
            }}
          >
            backstage
          </Link>
        </div>

      </div>
    </main>
  );
}
