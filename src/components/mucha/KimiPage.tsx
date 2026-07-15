import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Glass } from "./Glass";
import { MuchaVine } from "./MuchaVine";
import type { KimiPalette } from "@/lib/kimi-palettes";

// Shared page wrapper for /room/keepsakes, /room/study.
// Optional top/bottom vine ornaments.
export function KimiPage({
  children,
  P,
  vines = true,
  style,
}: {
  children: ReactNode;
  P: KimiPalette;
  vines?: boolean;
  style?: CSSProperties;
}) {
  return (
    <main
      className="flex-1 w-full relative overflow-hidden"
      style={{
        background: P.bg,
        color: P.ink,
        fontFamily:
          'var(--font-serif)',
        minHeight: "100svh",
        ...style,
      }}
    >
      {vines && (
        <>
          <div
            aria-hidden
            style={{ position: "absolute", top: 42, left: 0, right: 0, color: P.hair, opacity: 0.6 }}
          >
            <MuchaVine color={P.hair} accent={P.accent} />
          </div>
          <div
            aria-hidden
            style={{ position: "absolute", bottom: 28, left: 0, right: 0, color: P.hair, opacity: 0.5 }}
          >
            <MuchaVine color={P.hair} accent={P.accent} />
          </div>
        </>
      )}
      <div className="relative max-w-md mx-auto w-full">{children}</div>
    </main>
  );
}

// Minimal structural type — KimiTopNav 接 PAL_GOLD / PAL_ROSE / GOTHIC /
// MuchaPalette / 等. navGlass/navBorder optional (MuchaPalette 没, fallback
// 白 glass).
type NavPalette = Pick<KimiPalette, "ink" | "mute"> & {
  navGlass?: string;
  navBorder?: string;
};

// Unified 灵动岛风 3-tile top nav (owner 0859: GothicTopNav merge 进来,
// wardrobe inline 也 migrate). title ALL CAPS, sub lowercase italic.
export function KimiTopNav({
  title,
  sub,
  icon = "♡",
  iconColor,
  P,
  backHref = "/room",
}: {
  title: string;
  sub?: string;
  icon?: ReactNode;
  iconColor?: string;
  P: NavPalette;
  backHref?: string;
}) {
  // 默认 white glass (MuchaPalette 等 没 navGlass/navBorder field)
  const tint = P.navGlass ?? "rgba(255,255,255,0.5)";
  const border = P.navBorder ?? "rgba(255,255,255,0.9)";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "58px 16px 8px",
        alignItems: "center",
      }}
    >
      <Link href={backHref} aria-label="back" className="block">
        <Glass
          radius={22}
          tint={tint}
          border={border}
          style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <span style={{ fontSize: 20, color: P.ink, marginTop: -2 }}>‹</span>
        </Glass>
      </Link>
      <Glass
        radius={22}
        tint={tint}
        border={border}
        style={{ padding: "8px 16px", display: "flex", gap: 8, alignItems: "center" }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: 3,
            color: P.ink,
            fontFamily: 'var(--font-serif)',
            fontStyle: "italic",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        {sub ? (
          <span
            style={{
              fontSize: 9,
              color: P.mute,
              fontStyle: "italic",
              fontFamily: 'var(--font-serif)',
              letterSpacing: 1,
            }}
          >
            · {sub}
          </span>
        ) : null}
      </Glass>
      <Glass
        radius={22}
        tint={tint}
        border={border}
        style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span style={{ fontSize: 14, color: iconColor ?? P.ink }}>{icon}</span>
      </Glass>
    </div>
  );
}
