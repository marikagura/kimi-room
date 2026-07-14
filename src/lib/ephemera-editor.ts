// Ephemera editor — the "which paper today?" rule layer (§9 of the wakepaper
// tutorial), realized client-side. No LLM, no new infrastructure: the calendar
// alone decides the rule-driven genres. Occasion-driven genres (postcard / iou /
// telegram …) are the backend judgment layer's job — they arrive already
// carrying their own `kind`, and this function never invents them.
//
// Phase 1 skeleton: weekday + anniversary + clear-sky rules are live. 节气/黄历
// need a small solar-term table (or an almanac API) — left as a documented hook
// on `solarTerm` below, so wiring it later changes nothing else. The moon phase
// for 残月黄历 can be computed from lib/moon-phase.ts.
//
// Design rule from the tutorial: 没挣到场合，不硬穿体裁 — the default is always
// the plainest daily sheet; a genre's weight comes from its rarity.

export type GenrePick = { kind: string; reason: string };

export type EditorContext = {
  anniversaries?: string[]; // "MM-DD" or "M-D" dates that are anniversaries
  clearSky?: boolean; // tonight was clear enough to see stars
  solarTerm?: boolean; // today is a 节气 — wire a table/API to flip this on
};

export function pickPaper(date: Date, ctx: EditorContext = {}): GenrePick {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const md = `${m}-${d}`;
  const mmdd = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  // 纪念日 → 邀请函 (印记徽 is the alternate crest; swap the kind if you prefer it)
  if (ctx.anniversaries?.some((a) => a === md || a === mmdd)) {
    return { kind: "invitation", reason: "纪念日" };
  }
  // 晴夜 → 某夜星空
  if (ctx.clearSky) {
    return { kind: "starmap", reason: "晴夜" };
  }
  // 节气 → 残月黄历 (needs a solar-term source; see the hook above)
  if (ctx.solarTerm) {
    return { kind: "almanac", reason: "节气" };
  }
  // 周日 → 周谱
  if (date.getDay() === 0) {
    return { kind: "weekly-chart", reason: "周日" };
  }
  // 默认永远是最朴素的那张日刊
  return { kind: "wakepaper", reason: "日刊" };
}
