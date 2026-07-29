// The chat's drawn marks. Traced from the design file — no icon font, no emoji.
//
// The three action marks under a reply (copy · fork · rewind) are bare: no
// frame, no label, no background. They sit at .7 opacity and come up to 1 on
// hover, which is the whole affordance.

import type { CSSProperties } from "react";

type IconProps = { color: string; size?: number; style?: CSSProperties };

export function BackChevron({ color, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14.5 5 L8 12 L14.5 19" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function SunMark({ color, size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="2.7" fill={color} />
      <path
        d="M7 1 V2.4 M7 11.6 V13 M1 7 H2.4 M11.6 7 H13 M2.8 2.8 L3.8 3.8 M10.2 10.2 L11.2 11.2 M11.2 2.8 L10.2 3.8 M3.8 10.2 L2.8 11.2"
        stroke={color}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonMark({ color, size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M10 2.5 A4.7 4.7 0 1 0 10 11.5 A3.5 3.5 0 0 1 10 2.5 Z" fill={color} />
    </svg>
  );
}

/** The diamond badge. Marks a tool row, a panel crown, a thinking beat. */
export function Diamond({ color, size = 9, filled }: IconProps & { filled?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1 L12.4 7 L7 13 L1.6 7 Z" stroke={color} strokeWidth="1" />
      {filled && <circle cx="7" cy="7" r="1" fill={filled} />}
    </svg>
  );
}

export function FourPointStar({ color, size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 0.8 L8.2 5.4 L12.6 7 L8.2 8.6 L7 13.2 L5.8 8.6 L1.4 7 L5.8 5.4 Z"
        fill={color}
      />
    </svg>
  );
}

export function Chevron({ color, size = 9, up }: IconProps & { up?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      style={{ transform: up ? "rotate(180deg)" : undefined }}
      aria-hidden
    >
      <path d="M2.5 4 L6 8 L9.5 4" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

// ── the three action marks ──

export function CopyMark({ color, size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" aria-hidden>
      <rect x="4.4" y="4.2" width="6.6" height="7.2" rx="1.4" stroke={color} strokeWidth=".9" />
      <path
        d="M8.6 4.2 V3 A1.4 1.4 0 0 0 7.2 1.6 H3.2 A1.4 1.4 0 0 0 1.8 3 V7 A1.4 1.4 0 0 0 3.2 8.4 H4.4"
        stroke={color}
        strokeWidth=".9"
      />
    </svg>
  );
}

export function ForkMark({ color, size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="3" cy="2.6" r="1.2" stroke={color} strokeWidth=".9" />
      <circle cx="9" cy="2.6" r="1.2" stroke={color} strokeWidth=".9" />
      <circle cx="6" cy="9.6" r="1.2" stroke={color} strokeWidth=".9" />
      <path
        d="M3 4 C3 6.6 6 5.8 6 8.2 M9 4 C9 6.6 6 5.8 6 8.2"
        stroke={color}
        strokeWidth=".9"
      />
    </svg>
  );
}

export function RewindMark({ color, size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.2 6 A3.8 3.8 0 1 0 3.4 3.2" stroke={color} strokeWidth=".9" fill="none" />
      <path d="M2 1.6 V3.6 H4" stroke={color} strokeWidth=".9" fill="none" />
    </svg>
  );
}

/** Speak this reply. Same weight as the other three so the row stays even. */
export function ListenMark({ color, size = 13, playing }: IconProps & { playing?: boolean }) {
  if (playing) {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
        <rect x="3" y="3" width="6" height="6" rx="1" stroke={color} strokeWidth=".9" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 4.4 H3.6 L6 2.2 V9.8 L3.6 7.6 H2 Z" stroke={color} strokeWidth=".9" strokeLinejoin="round" />
      <path d="M7.8 4.2 A2.4 2.4 0 0 1 7.8 7.8" stroke={color} strokeWidth=".9" strokeLinecap="round" />
      <path d="M9.3 2.8 A4.4 4.4 0 0 1 9.3 9.2" stroke={color} strokeWidth=".9" strokeLinecap="round" opacity=".65" />
    </svg>
  );
}

/** Previous / next variant. Sits with the three marks, same treatment. */
export function SwipeArrow({ color, size = 13, back }: IconProps & { back?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      style={{ transform: back ? "scaleX(-1)" : undefined }}
      aria-hidden
    >
      <path d="M4.4 2.4 L8 6 L4.4 9.6" stroke={color} strokeWidth=".9" strokeLinecap="round" />
    </svg>
  );
}

/** The composer's picture port — mountains inside a frame. */
export function PhotoMark({ color, size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke={color} strokeWidth="1" />
      <circle cx="5.6" cy="6.4" r="1.2" stroke={color} strokeWidth=".9" />
      <path
        d="M2.5 12 L6.5 8.4 L9 10.6 L11.2 8.8 L14 11.4"
        stroke={color}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LinkMark({ color, size = 8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M5 7 L7 5 M4 8 L2.8 9.2 A2 2 0 0 0 5.6 12 L7 10.6 M8 4 L9.2 2.8 A2 2 0 0 0 6.4 0 L5 1.4"
        stroke={color}
        strokeWidth=".9"
      />
    </svg>
  );
}

export function CheckMark({ color, size = 8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M1.4 5.2 L3.8 7.6 L8.6 2.4" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StopMark({ color, size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3.4" y="3.4" width="7.2" height="7.2" rx="1.2" fill={color} />
    </svg>
  );
}

/**
 * Ring gauge. One arc drawn on a fixed 0–1 fraction — used for cache hit rate in
 * the cost bar and for upload progress on a pending image.
 */
export function RingGauge({
  color,
  track,
  frac,
  size = 13,
  width = 1.6,
}: {
  color: string;
  track: string;
  frac: number;
  size?: number;
  width?: number;
}) {
  const pct = Math.max(0, Math.min(1, frac)) * 100;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      style={{ transform: "rotate(-90deg)" }}
      aria-hidden
    >
      <circle cx="7" cy="7" r="5.6" stroke={track} strokeWidth={width} />
      <circle
        cx="7"
        cy="7"
        r="5.6"
        pathLength={100}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={`${pct} 100`}
        fill="none"
      />
    </svg>
  );
}
