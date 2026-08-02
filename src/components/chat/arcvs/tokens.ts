// ARCVS chat · the two palettes.
//
// Day and night are one screen in two colourways, not two screens: the same
// tree renders under either, and the sun/moon control in the header swaps the
// palette object. Nothing about layout changes between them.
//
// Sides are fixed and mean something: rose is me and sits right, gold is the
// other voice and sits left, grey is the system. Every new element takes its
// side from that rule.

export type ChatTheme = "day" | "night";

export type Palette = {
  theme: ChatTheme;
  /** page ground */
  bg: string;
  /** the warm wash at the top of the page */
  glow: string;
  /** body ink */
  ink: string;
  inkSoft: string;
  inkMute: string;
  /** gold — the other voice, left */
  goldHi: string;
  gold: string;
  goldDim: string;
  /** rose — me, right */
  roseHi: string;
  rose: string;
  roseDim: string;
  /** hairlines and card frames */
  rule: string;
  ruleSoft: string;
  /** bubbles */
  bubbleThem: string;
  bubbleThemBorder: string;
  bubbleThemCorner: string;
  bubbleMe: string;
  bubbleMeBorder: string;
  bubbleMeCorner: string;
  /** panels */
  panel: string;
  panelBorder: string;
  panelShadow: string;
  /** status */
  ok: string;
  warn: string;
  bad: string;
  /** composer */
  fieldBg: string;
  fieldBorder: string;
  /** header / composer chrome behind blur */
  chrome: string;
  /** ink on top of a gold fill */
  onGold: string;
};

export const NIGHT: Palette = {
  theme: "night",
  bg: "#060402",
  glow: "radial-gradient(60% 30% at 50% 0%, rgba(240,190,90,.07), transparent 70%)",
  ink: "#EFE5D3",
  inkSoft: "rgba(239,229,211,.62)",
  inkMute: "rgba(239,229,211,.42)",
  goldHi: "#E6CD96",
  gold: "#C9A768",
  goldDim: "#A98A52",
  roseHi: "#E7A9BC",
  rose: "#D28AA1",
  roseDim: "#B04063",
  rule: "rgba(201,167,106,.3)",
  ruleSoft: "rgba(201,167,106,.16)",
  bubbleThem: "rgba(22,16,9,.8)",
  bubbleThemBorder: "rgba(201,167,106,.24)",
  bubbleThemCorner: "rgba(230,205,150,.6)",
  bubbleMe: "rgba(24,13,15,.78)",
  bubbleMeBorder: "rgba(210,138,161,.26)",
  bubbleMeCorner: "rgba(210,138,161,.65)",
  panel: "rgba(14,10,6,.86)",
  panelBorder: "rgba(201,167,106,.3)",
  panelShadow: "0 14px 30px rgba(0,0,0,.55)",
  ok: "#7E9070",
  warn: "#E0A93C",
  bad: "#C0503C",
  fieldBg: "rgba(16,11,7,.66)",
  fieldBorder: "rgba(201,167,106,.28)",
  chrome: "rgba(6,4,2,.82)",
  onGold: "#1B150C",
};

export const DAY: Palette = {
  theme: "day",
  bg: "#F5EDE2",
  glow: "radial-gradient(62% 32% at 50% 0%, rgba(255,243,229,.95), transparent 72%)",
  ink: "#3A2E2E",
  inkSoft: "rgba(58,46,46,.6)",
  inkMute: "rgba(58,46,46,.45)",
  goldHi: "#8C6A34",
  gold: "#A98A52",
  goldDim: "#8C6A34",
  roseHi: "#B04063",
  rose: "#C97F9B",
  roseDim: "#A2405C",
  rule: "rgba(142,79,60,.24)",
  ruleSoft: "rgba(142,79,60,.13)",
  bubbleThem: "rgba(251,245,238,.95)",
  bubbleThemBorder: "rgba(122,94,42,.22)",
  bubbleThemCorner: "rgba(140,106,52,.55)",
  bubbleMe: "rgba(252,246,238,.96)",
  bubbleMeBorder: "rgba(176,64,99,.26)",
  bubbleMeCorner: "rgba(176,64,99,.5)",
  panel: "linear-gradient(180deg, rgba(251,246,237,.97), rgba(246,239,228,.98))",
  panelBorder: "rgba(142,79,60,.22)",
  panelShadow: "0 14px 30px rgba(120,70,70,.12)",
  ok: "#61795A",
  warn: "#C08A2A",
  bad: "#C0503C",
  fieldBg: "rgba(251,246,237,.88)",
  fieldBorder: "rgba(142,79,60,.26)",
  chrome: "rgba(245,237,226,.88)",
  onGold: "#FBF6EE",
};

export function paletteFor(theme: ChatTheme): Palette {
  return theme === "day" ? DAY : NIGHT;
}

/**
 * Artwork for the send key, per colourway. Clear this to `{}` and the key falls
 * back to the drawn star mark — no other change is needed. A deployment that
 * wants its own medallion drops two round PNGs with transparent corners into
 * public/images/chat/ and names them here.
 *
 * `ring` says whether the key keeps a hairline around the picture. Art with its
 * own ground reads better bare; art that fades at the edge needs the line to
 * stay a button.
 */
export type SendArt = { src: string; ring?: "none" | "hairline"; inset?: number; bare?: boolean };
export const SEND_ART: { day?: SendArt; night?: SendArt } = {
  night: { src: "/images/chat/send-night.png", ring: "none" },
  day: { src: "/images/chat/send-day-bow-clean.png", ring: "none", inset: 3, bare: true },
};

/** Latin small caps labels. Never used for Chinese — see FONT_CN. */
export const FONT_LATIN = 'var(--font-serif)';
/** Chinese body text. Kept at 12px and above; the tiny sizes are latin only. */
export const FONT_CN = 'var(--font-serif-cn)';
export const FONT_MONO = 'var(--font-mono)';

/** Old-style figures, on every number in the chrome. */
export const ONUM: React.CSSProperties = { fontFeatureSettings: "'onum' 1" };

/**
 * Keyframes the chat needs. Injected once by the chat page rather than added to
 * globals.css, so the rest of the site does not carry them. Every animation is
 * dropped under prefers-reduced-motion, and the dust disappears entirely.
 */
export const ARCVS_KEYFRAMES = `
@keyframes arcvs-goldbreath { from { opacity: .45 } to { opacity: 1 } }
@keyframes arcvs-sweep { from { transform: translateX(-120%) } to { transform: translateX(320%) } }
@keyframes arcvs-pulsewarn { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
@keyframes arcvs-dustrise {
  from { transform: translateY(0); opacity: 0 }
  12% { opacity: .9 }
  to { transform: translateY(-240px); opacity: 0 }
}
@keyframes arcvs-dustrise2 {
  from { transform: translateY(0) translateX(0); opacity: 0 }
  16% { opacity: .8 }
  to { transform: translateY(-260px) translateX(-14px); opacity: 0 }
}
@media (prefers-reduced-motion: reduce) {
  .arcvs-anim { animation: none !important }
  .arcvs-dust { display: none !important }
}
`;
