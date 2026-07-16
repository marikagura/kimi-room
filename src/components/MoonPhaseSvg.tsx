// SVG moon phase — connect with /room/page.tsx 中间的 chat 入口.
// 输入 phase 0..1, 输出对应月相 SVG. 比 emoji 跨平台一致 + 可调色 + 加 glow.
//
// 算法 (经典 two-arc SVG moon phase):
//   - 圆 disc 用 light gradient 当亮面
//   - shadow path = outer disc arc + inner ellipse arc 闭合
//   - cosVal = cos(2π * phase) 控 inner ellipse rx
//   - sweep flags 控 shadow 在左 (waxing 时) 还是右 (waning 时)
//
// phase 0=新月 (shadow 全) → 0.25 上弦 (右半亮) → 0.5 满月 (no shadow)
// → 0.75 下弦 (左半亮) → 1.0 回新月.

type Props = {
  /** 0..1 fractional phase */
  phase: number;
  /** pixel size */
  size?: number;
  /** 亮面颜色 (gradient 中间), 默认 Mucha gold */
  light?: string;
  /** 阴影颜色, 默认 obsidian 半透 */
  dark?: string;
  /** 是否加金色 outer glow */
  glow?: boolean;
};

export function MoonPhaseSvg({
  phase,
  size = 44,
  light = "#e4d3ad",
  dark = "rgba(14, 8, 4, 0.94)",
  glow = true,
}: Props) {
  const r = 12;
  const cx = 12;
  const cy = 12;
  const cosVal = Math.cos(2 * Math.PI * phase);
  const rx = Math.abs(cosVal) * r;
  const isWaxing = phase < 0.5;
  const sweepOuter = isWaxing ? 0 : 1;
  // 内弧凸向: 月牙相 (|cos| 大) 时 shadow 要盖大半盘面 → 内弧凸向亮牙的反侧;
  // 凸凹相 (cos<0) 时 shadow 只剩边缘细牙 → 内弧凸向 shadow 同侧.
  // 之前 1:0 写反, 月牙相全被画成近满月 (新月当天渲染成圆月).
  const sweepInner = cosVal >= 0 === isWaxing ? 0 : 1;
  const shadowPath = `M ${cx},${cy - r} A ${r},${r} 0 0 ${sweepOuter} ${cx},${cy + r} A ${rx},${r} 0 0 ${sweepInner} ${cx},${cy - r} Z`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{
        display: "inline-block",
        filter: glow
          ? "drop-shadow(0 0 8px rgba(212,154,86,0.32)) drop-shadow(0 0 14px rgba(212,154,86,0.18))"
          : undefined,
      }}
    >
      <defs>
        <radialGradient id="kimi-moon-light" cx="38%" cy="36%" r="70%">
          <stop offset="0%" stopColor="#fff6e0" />
          <stop offset="55%" stopColor={light} />
          <stop offset="100%" stopColor="#9b7c50" />
        </radialGradient>
        {/* subtle texture overlay 给月面一点 mucha craters 感觉, optional */}
        <radialGradient id="kimi-moon-craters" cx="65%" cy="68%" r="38%">
          <stop offset="0%" stopColor="rgba(120, 90, 50, 0.18)" />
          <stop offset="100%" stopColor="rgba(120, 90, 50, 0)" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="url(#kimi-moon-light)" />
      <circle cx={cx} cy={cy} r={r} fill="url(#kimi-moon-craters)" />
      {/* 满月时 path degenerate 不渲染. 但保留调用以防 phase 边界值: */}
      <path d={shadowPath} fill={dark} />
    </svg>
  );
}
