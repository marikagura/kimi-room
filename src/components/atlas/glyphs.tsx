// Atlas fragment elements — LeafGlyph / CloudDoodle / FragmentCard.
// All colors come in via props (the room day/night palette is injected), nothing
// is hard-coded.
import type { CSSProperties } from "react";

// Leaf / petal glyph — the marker on a "brought back" fragment.
export function LeafGlyph({ size = 22, color = "#b8a070", strokeW = 1.4 }: { size?: number; color?: string; strokeW?: number }) {
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 24 27" fill="none" style={{ display: "block" }}>
      <path d="M12 2 C 5.5 8, 5.5 18.5, 12 25 C 18.5 18.5, 18.5 8, 12 2 Z" stroke={color} strokeWidth={strokeW} fill="none" />
      <path d="M12 5 L 12 22" stroke={color} strokeWidth={strokeW * 0.7} />
      <path d="M12 11 L 8.5 9 M12 11 L 15.5 9 M12 16 L 9 14 M12 16 L 15 14" stroke={color} strokeWidth={strokeW * 0.6} opacity="0.8" />
    </svg>
  );
}

// Hand-drawn cloud doodle — a weather mark.
export function CloudDoodle({ w = 44, color = "#8AA6C0", rain = false }: { w?: number; color?: string; rain?: boolean }) {
  return (
    <svg width={w} height={w * 0.62} viewBox="0 0 46 28" fill="none" style={{ display: "block" }}>
      <path
        d="M8 20 Q 2 20 3 14 Q 4 9 10 10 Q 11 3 19 4 Q 27 4 28 11 Q 36 9 38 16 Q 40 21 33 21 Z"
        stroke={color}
        strokeWidth="1.1"
        fill="none"
        strokeLinejoin="round"
        opacity="0.75"
      />
      {rain &&
        [13, 21, 29].map((x, i) => (
          <line key={i} x1={x} y1="23" x2={x - 1.5} y2="27" stroke={color} strokeWidth="1" opacity="0.6" />
        ))}
    </svg>
  );
}

export type FragmentColors = {
  card: string; // card background
  cardHi: string; // leaf-slot background
  body: string; // body text
  mute: string; // place label
  roseSub: string; // tag / emphasis
  accent: string; // leaf glyph
  hair: string; // 0.5px line
};

const FONT_DISPLAY = '"Cormorant Garamond","EB Garamond","Noto Serif SC","Songti SC",serif';
const FONT_BODY = 'var(--font-noto-serif-sc),"Noto Serif SC","Songti SC",serif';

// Fragment card — one "brought back" relic (leaf glyph + a line of sensory text
// + place name + optional tag).
export function FragmentCard({
  text,
  place,
  tag,
  c,
  compact = false,
  style,
}: {
  text: string;
  place?: string | null;
  tag?: string | null;
  c: FragmentColors;
  compact?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: c.card,
        borderRadius: 14,
        boxShadow: "0 2px 10px rgba(40,24,20,0.18)",
        padding: compact ? "12px 14px" : "16px 16px 14px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        ...style,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 10,
          background: c.cardHi,
          boxShadow: `inset 0 0 0 0.5px ${c.hair}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LeafGlyph size={22} color={c.accent} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: c.body, lineHeight: 1.5, letterSpacing: 0.2 }}>
          {text}
          {tag && (
            <span style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", color: c.roseSub, fontSize: 11, marginLeft: 6 }}>
              {tag}
            </span>
          )}
        </div>
        {place && (
          <div style={{ marginTop: 6, fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 10, color: c.mute, letterSpacing: 2 }}>
            {place}
          </div>
        )}
      </div>
    </div>
  );
}
