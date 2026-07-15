import Link from "next/link";
import type { ReactNode } from "react";
import { Glass } from "./Glass";
import { GOTHIC } from "@/lib/kimi-palettes";

export function RoseBud({
  state = "bloom",
  size = 28,
  G = GOTHIC,
  color,
  accent,
}: {
  state?: "bloom" | "closed" | "wilted";
  size?: number;
  G?: typeof GOTHIC;
  color?: string;
  accent?: string;
}) {
  const c = color ?? G.accent;
  const a = accent ?? G.blood;
  if (state === "wilted") {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path
          d="M16 6 C 14 11, 13 16, 15 22 C 17 26, 19 27, 20 28"
          stroke={c}
          strokeWidth="0.8"
          opacity="0.55"
        />
        <path
          d="M15 22 C 12 20, 10 18, 9 16"
          stroke={c}
          strokeWidth="0.6"
          opacity="0.45"
        />
        <circle cx="16" cy="9" r="2" fill={c} opacity="0.3" />
      </svg>
    );
  }
  if (state === "closed") {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path
          d="M16 8 Q 12 12, 12 18 Q 12 23, 16 24 Q 20 23, 20 18 Q 20 12, 16 8 Z"
          fill={G.roseDustSoft}
          stroke={c}
          strokeWidth="0.8"
        />
        <path d="M16 10 Q 14 14, 15 19" stroke={c} strokeWidth="0.5" opacity="0.6" />
        <path d="M16 24 L 16 28" stroke={c} strokeWidth="0.6" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path
        d="M16 7 Q 10 10, 9 16 Q 9 22, 16 24 Q 23 22, 23 16 Q 22 10, 16 7 Z"
        fill={G.rose2}
        stroke={c}
        strokeWidth="0.8"
      />
      <path
        d="M16 10 Q 12 12, 12 17 Q 13 21, 16 22 Q 19 21, 20 17 Q 20 12, 16 10 Z"
        fill={G.rose1}
        stroke={c}
        strokeWidth="0.5"
        opacity="0.9"
      />
      <circle cx="16" cy="16" r="1.5" fill={a} />
      <path
        d="M16 24 L 16 28 M 14 27 Q 12 28, 10 26"
        stroke={c}
        strokeWidth="0.6"
      />
    </svg>
  );
}

export function Candle({
  h = 50,
  label,
  G = GOTHIC,
}: {
  h?: number;
  label: string;
  G?: typeof GOTHIC;
}) {
  const wax = Math.max(10, h);
  const flameY = 48 - wax;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24 }}>
      <svg width="24" height="56" viewBox="0 0 24 56">
        <ellipse cx="12" cy={flameY - 2} rx="2.2" ry="4" fill={G.accent} opacity="0.95" />
        <ellipse cx="12" cy={flameY - 1} rx="1" ry="2.5" fill={G.blood} opacity="0.6" />
        <line x1="12" y1={flameY + 2} x2="12" y2={flameY + 5} stroke={G.ink} strokeWidth="0.8" />
        <rect
          x="8"
          y={flameY + 5}
          width="8"
          height={wax}
          fill={G.ink}
          opacity="0.88"
          stroke={G.accent}
          strokeWidth="0.4"
        />
        <path
          d={`M 8 ${flameY + 8} Q 7 ${flameY + 12}, 8 ${flameY + 14}`}
          stroke={G.ink}
          strokeWidth="0.5"
          fill="none"
          opacity="0.6"
        />
        <rect x="6" y="52" width="12" height="3" fill={G.accentDeep} />
        <rect x="4" y="54" width="16" height="2" fill={G.accent} />
      </svg>
      <div
        style={{
          fontSize: 8,
          color: G.mute,
          marginTop: 3,
          fontStyle: "italic",
          fontFamily: 'var(--font-serif)',
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function PetalDrift({ G = GOTHIC }: { G?: typeof GOTHIC } = {}) {
  const petals = [
    { x: 30, y: 180, r: -20, s: 1, c: G.rose2, o: 0.35 },
    { x: 340, y: 220, r: 40, s: 0.7, c: G.roseDust, o: 0.28 },
    { x: 60, y: 460, r: 80, s: 0.8, c: G.rose2, o: 0.22 },
    { x: 320, y: 540, r: -60, s: 0.6, c: G.rose1, o: 0.3 },
    { x: 50, y: 720, r: 30, s: 0.5, c: G.rose2, o: 0.25 },
    { x: 350, y: 760, r: -40, s: 0.9, c: G.roseDust, o: 0.22 },
  ];
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 390 844"
      fill="none"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5 }}
      aria-hidden
    >
      {petals.map((p, i) => (
        <g
          key={i}
          transform={`translate(${p.x},${p.y}) rotate(${p.r}) scale(${p.s})`}
          opacity={p.o}
        >
          <path d="M0 0 Q -8 6, -4 16 Q 0 22, 4 16 Q 8 6, 0 0 Z" fill={p.c} />
        </g>
      ))}
    </svg>
  );
}

export function GothicPage({
  children,
  G = GOTHIC,
}: {
  children: ReactNode;
  G?: typeof GOTHIC;
}) {
  return (
    <main
      className="flex-1 w-full relative overflow-hidden"
      style={{
        background: G.bg,
        color: G.ink,
        fontFamily: 'var(--font-serif)',
        minHeight: "100svh",
      }}
    >
      <PetalDrift G={G} />
      <div className="relative max-w-md mx-auto w-full">{children}</div>
    </main>
  );
}

export function GothicTopNav({
  title,
  sub,
  backHref = "/room",
  G = GOTHIC,
}: {
  title: string;
  sub: string;
  backHref?: string;
  G?: typeof GOTHIC;
}) {
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
          tint={G.navGlass}
          border={G.navBorder}
          style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <span style={{ fontSize: 18, color: G.accent, marginTop: -2 }}>‹</span>
        </Glass>
      </Link>
      <Glass
        radius={22}
        tint={G.navGlass}
        border={G.navBorder}
        style={{ padding: "8px 16px", display: "flex", gap: 8, alignItems: "center" }}
      >
        <span style={{ fontSize: 11, letterSpacing: 3, color: G.accent }}>{title}</span>
        <span style={{ fontSize: 9, color: G.mute, fontStyle: "italic" }}>· {sub}</span>
      </Glass>
      <Glass
        radius={22}
        tint={G.navGlass}
        border={G.navBorder}
        style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span style={{ fontSize: 13, color: G.blood }}>♱</span>
      </Glass>
    </div>
  );
}
