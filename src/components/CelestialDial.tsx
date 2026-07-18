// 星盘环 — 把月相 / 玫瑰当圆心, 外面套双层环包裹 + 一道「读数 / 装饰」环.
//
// 层 (viewBox 200×200):
//   1. 外层环 (静止): 夜 = 60 格刻度 (天文); 昼 = 24 珠珠链 (花环)
//   2. 内层虚线环 (缓缓逆转 110s): r=80 dash 2 7 + 四正方位点
//   3. r=72 环 —— 按「流光修法」分昼夜:
//        · 夜 = 流光: 整环连续底 rgba(201,167,104,.5) + spin 16s 旋转组里五层
//          嵌套高光 (透明度渐进到白芯 #FFF3D0), 居中对齐 → 一颗光巡游, 纯装饰.
//        · 昼 = 仪表: 底轨 .28 + 圆头亮面弧 (illumination%) + 终点读数点 (最深一点).
//      —— 一根线别又当读数又当装饰; 夜里加最亮的一点, 白天减最深的一点.
//
// 圆心保持原样 (children): 夜 = MoonPhaseSvg 两弧月, 昼 = RoseBloomDial 玫瑰.
// 环是装饰 (aria-hidden); 点击目标是外面的 <Link> (见调用处).
//
// size 接受 number | string: 传 clamp() 字符串让星盘随区高缩放 (开源版禁写死).
// 内部 svg 用 100% 填满外框, viewBox 定内几何, 缩放不失真.

type DialColors = {
  ring: string;
  tick: string;
  dash: string;
  dot: string;
  /** 昼仪表弧色 (夜用流光, 此值忽略) */
  arc: string;
  /** 昼仪表底轨 */
  arcTrack: string;
  /** 昼仪表终点读数点 — 白天那「最深的一点」 */
  readDot: string;
};

export const DIAL_NIGHT: DialColors = {
  ring: "#8A6C3C",
  tick: "#C9A768",
  dash: "#C9A768",
  dot: "#C9A768",
  arc: "rgba(201,167,104,.9)",
  arcTrack: "rgba(201,167,104,.5)",
  readDot: "#E6CD96",
};

export const DIAL_DAY: DialColors = {
  ring: "#A8927E",
  tick: "#B4527E",
  dash: "#C77A9B",
  dot: "#B4527E",
  arc: "rgba(178,58,110,.7)",
  arcTrack: "rgba(150,110,90,.28)",
  readDot: "#B23A6E",
};

const TAU = Math.PI * 2;
const ARC_R = 72;
const ARC_C = TAU * ARC_R;

/** 夜 · 60 格刻度 — 每 5 格粗一根 (刻度是天文 / 仪表语汇, 只配月相).
    坐标 toFixed 定精度: 裸浮点在 server / client 的字符串化尾位不同 →
    hydration mismatch (console 刷错). */
function ticks(color: string, r1 = 88, r2 = 92, opacity = 0.45) {
  return Array.from({ length: 60 }, (_, i) => {
    const a = (i * TAU) / 60;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return (
      <line
        key={i}
        x1={(100 + c * r1).toFixed(3)}
        y1={(100 + s * r1).toFixed(3)}
        x2={(100 + c * r2).toFixed(3)}
        y2={(100 + s * r2).toFixed(3)}
        stroke={color}
        strokeWidth={i % 5 === 0 ? 1.1 : 0.6}
        opacity={opacity}
      />
    );
  });
}

/** 昼 · 珠链环 (方案 A) — 玫瑰不拿来读数, 60 格锯齿换成 Mucha 珠链:
    24 颗圆珠 (dash 0.1 + round cap = 珠), 错开半步让四正位只落 4 颗加深大珠.
    呼应花瓣圆润, 读数仍归 r72 仪表弧. */
function PearlRing({ colors }: { colors: DialColors }) {
  const R = 88;
  const step = (TAU * R) / 24; // 23.04
  return (
    <>
      <circle
        cx="100"
        cy="100"
        r={R}
        stroke={colors.dash}
        opacity="0.55"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`0.1 ${(step - 0.1).toFixed(2)}`}
        strokeDashoffset={(step / 2).toFixed(2)}
      />
      <circle cx="100" cy="12" r="2.6" fill={colors.dot} />
      <circle cx="100" cy="188" r="2.6" fill={colors.dot} />
      <circle cx="12" cy="100" r="2.6" fill={colors.dot} />
      <circle cx="188" cy="100" r="2.6" fill={colors.dot} />
    </>
  );
}

/** 夜 · 流光: 连续底环 + spin 16s 旋转组里五层嵌套高光 (居中对齐 → 一颗光).
    五层透明度渐进 (.16→白芯) — 亮度剖面成彗尾, 看不出层的台阶. */
function StreakRing() {
  // 每层 dashoffset = len/2 - 周长/2 → 各层 dash 中心对齐, 读成一颗连续的光.
  const off = (len: number) => (len / 2 - ARC_C / 2).toFixed(2);
  const layers: [number, number, string][] = [
    [64, 3.2, "rgba(240,205,130,.16)"], // 外晕
    [52, 2.4, "rgba(240,205,130,.28)"],
    [40, 1.8, "rgba(240,205,130,.42)"], // 中层
    [28, 1.3, "rgba(245,220,160,.65)"],
    [16, 1, "#FFF3D0"], // 白芯
  ];
  return (
    <>
      {/* 连续底环 */}
      <circle cx="100" cy="100" r={ARC_R} stroke="rgba(201,167,104,.5)" strokeWidth="1.5" fill="none" />
      {/* 高光巡游 — 整组自转 */}
      <g className="kimi-dial-glow">
        {layers.map(([len, w, col]) => (
          <circle
            key={len}
            cx="100"
            cy="100"
            r={ARC_R}
            stroke={col}
            strokeWidth={w}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${len} ${(ARC_C - len).toFixed(2)}`}
            strokeDashoffset={off(len)}
          />
        ))}
      </g>
    </>
  );
}

/** 昼 · 仪表: 底轨 + 圆头亮面弧 + 终点读数点. */
function GaugeRing({ illumination, colors }: { illumination: number; colors: DialColors }) {
  const frac = Math.max(0, Math.min(100, illumination)) / 100;
  const dash = frac * ARC_C;
  // 终点角度 — 从正上 (12 点) 顺时针走 frac 圈.
  const ang = -Math.PI / 2 + frac * TAU;
  const ex = (100 + ARC_R * Math.cos(ang)).toFixed(2);
  const ey = (100 + ARC_R * Math.sin(ang)).toFixed(2);
  return (
    <>
      <circle cx="100" cy="100" r={ARC_R} stroke={colors.arcTrack} strokeWidth="1.5" fill="none" />
      <circle
        cx="100"
        cy="100"
        r={ARC_R}
        stroke={colors.arc}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dash.toFixed(1)} ${(ARC_C - dash).toFixed(1)}`}
        transform="rotate(-90 100 100)"
      />
      {/* 终点读数点 — 白天那「最深的一点」 */}
      <circle cx={ex} cy={ey} r="2.4" fill={colors.readDot} />
    </>
  );
}

export function CelestialDial({
  size = 150,
  illumination,
  colors,
  mode,
  spin = false,
  children,
}: {
  size?: number | string;
  illumination: number;
  colors: DialColors;
  mode: "day" | "night";
  /** true=内虚线环 idle 逆转. */
  spin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-block", lineHeight: 0 }}>
      <style>{`
        @keyframes kimi-dial-ring { to { transform: rotate(-360deg); } }
        @keyframes kimi-dial-glow { to { transform: rotate(360deg); } }
        /* transform-box: view-box 定原点 (0 0 200 200 → center=(100,100)=真圆心).
           will-change: transform 把旋转组提到独立合成层 —— 否则留在 SVG 主层,
           自转时 iOS Safari 反复重绘同层的静止外环 (r=92), 静止环跟着上下抖.
           月相靠自带 drop-shadow 滤镜天然提层从不抖; 双环无滤镜, will-change 补. */
        .kimi-dial-ring { transform-box: view-box; transform-origin: center; will-change: transform; animation: kimi-dial-ring 110s linear infinite; }
        .kimi-dial-glow { transform-box: view-box; transform-origin: center; will-change: transform; animation: kimi-dial-glow 16s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .kimi-dial-ring, .kimi-dial-glow { animation: none; } }
      `}</style>
      <svg width="100%" height="100%" viewBox="0 0 200 200" aria-hidden style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {/* 外层环 (静止): 夜 = 60 格刻度 (天文), 昼 = 24 珠珠链 (花环) */}
        <circle cx="100" cy="100" r="92" stroke={colors.ring} opacity="0.5" fill="none" />
        {mode === "night" ? ticks(colors.tick) : <PearlRing colors={colors} />}

        {/* 内层虚线环 (缓缓逆转) + 四正方位点 */}
        <g className={spin ? "kimi-dial-ring" : undefined}>
          <circle cx="100" cy="100" r="80" stroke={colors.dash} opacity="0.42" strokeDasharray="2 7" fill="none" />
          <circle cx="100" cy="20" r="2.2" fill={colors.dot} />
          <circle cx="100" cy="180" r="2.2" fill={colors.dot} />
          <circle cx="20" cy="100" r="2.2" fill={colors.dot} />
          <circle cx="180" cy="100" r="2.2" fill={colors.dot} />
        </g>

        {/* r=72 环 — 夜流光 / 昼仪表 */}
        {mode === "night" ? <StreakRing /> : <GaugeRing illumination={illumination} colors={colors} />}
      </svg>

      {/* 圆心 */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}
