// Client-safe valence color helper + font stack for ScoreSheet + SkyView.
// 4 色对应 valence 四档 · cobalt / sage / bronze / Mucha pink (canon palette).
//
// V2 owner 0519 ack: palette 不开 vibe-code 改 (美学 anchor) · 用户 fork 想换
// 颜色就 直接 edit 这个 file · 不通过 settings expose.

export const SCORE_FONT_BODY =
  'var(--font-serif)';
export const SCORE_FONT_TITLE_CN =
  'var(--font-serif-cn)';

export const VALENCE_COLORS = {
  brooding: "#2e4a7a", // cobalt 深冷蓝
  calm: "#7a8a6a", // sage 苔绿
  warmth: "#c89548", // bronze gilt 古铜金
  towardHer: "#a42b5e", // Mucha pink 玫瑰
} as const;

export type ValenceTag = keyof typeof VALENCE_COLORS;

export const VALENCE_LABEL: Record<ValenceTag, string> = {
  brooding: "brooding",
  calm: "calm",
  warmth: "warmth",
  towardHer: "向他",
};

export function valenceColor(v: number | ValenceTag | null): string {
  if (v === null || v === undefined) return VALENCE_COLORS.calm;
  if (typeof v === "string") return VALENCE_COLORS[v] ?? VALENCE_COLORS.calm;
  if (v < -0.3) return VALENCE_COLORS.brooding;
  if (v < 0.3) return VALENCE_COLORS.calm;
  if (v < 0.7) return VALENCE_COLORS.warmth;
  return VALENCE_COLORS.towardHer;
}
