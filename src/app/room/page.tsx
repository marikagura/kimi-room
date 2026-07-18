import Link from "next/link";
import { cookies } from "next/headers";
import { DualAvatarsClient } from "@/components/mucha/DualAvatarsClient";
import { MuchaVine } from "@/components/mucha/MuchaVine";
import { MuchaMosaic } from "@/components/mucha/MuchaMosaic";
import { MoonPhaseSvg } from "@/components/MoonPhaseSvg";
import { RoseBloomDial } from "@/components/RoseBloomDial";
import { CelestialDial, DIAL_DAY, DIAL_NIGHT } from "@/components/CelestialDial";
import { getMoonPhase } from "@/lib/moon-phase";
import { getTheme } from "@/lib/day-theme";
import { ThemeToggleLink } from "@/components/ThemeToggle";
import { resolveRoom, ROOM_LAYOUT_COOKIE, ROMAN } from "@/lib/room-blocks";

// 强制每次访问拿最新月相 (server-rendered 用当下 date — 不要 build time 静态化)
export const dynamic = "force-dynamic";

type Mode = "day" | "night";

// 中庭配色 — 色值抄 canon 的 THEME 常量 (夜金系 / 昼米底玫瑰系). 这里两套
// 齐, 昼夜由 getTheme() (cookie) 决定, 全站 theme 机制不动.
const THEME = {
  day: {
    bg: "radial-gradient(130% 90% at 50% 0%, #F7F0E6 0%, #EFE7DB 55%, #EAE0D2 100%)",
    ink: "#3A2D24",
    hair: "rgba(106,74,72,0.32)",
    accent: "#A42B5E",
    mute: "rgba(26,14,10,0.55)",
    paper: "#dccfc2",
    avRing: "#B23A6E",
    // 三档 (昼反转): 结构线 #A8927E; 流光在米底上几乎不可见, 不跑粉珠 —
    // 「光」由拱顶最深一点 #B23A6E 极缓呼吸来演 (每屏 1 处).
    bow: "#A8927E", // 结构线
    apex: "#B23A6E", // 拱顶最深点
    apexMid: "#C98BA5",
    apexSmall: "#D9B8C4",
    medStroke: "#A8927E",
    medFill: "#ECD3DC",
    medFillOp: 0.85,
    petal: "#C98BA5",
    cardShadow: "0 8px 20px rgba(60,38,20,0.16), 0 2px 6px rgba(60,38,20,0.10)",
    dial: DIAL_DAY,
    starfield: false,
  },
  night: {
    bg: "radial-gradient(130% 90% at 50% 0%, #181208 0%, #0E0B07 55%, #0A0805 100%)",
    ink: "#f3e6cd",
    hair: "rgba(193,154,86,0.38)",
    accent: "#c19a56",
    mute: "rgba(243,230,205,0.55)",
    paper: "#100c08",
    avRing: "#c19a56",
    // 三档: 弓拱全是暗结构线 #8A6C3C, 亮只两处 — 拱顶点 #C9A768 (强调) +
    // 沿弧跑的 glint 白芯 #FFF3D0 (唯一高光). 不做全金渐变 (全亮=全不亮).
    bow: "#8A6C3C", // 结构线
    apex: "#C9A768", // 拱顶强调点
    apexMid: "#8F7343",
    apexSmall: "#6E5732",
    medStroke: "#8A6C3C",
    medFill: "#171207",
    medFillOp: 0.8,
    petal: "#6E5732",
    cardShadow: "0 10px 26px rgba(4,2,1,0.55), 0 2px 8px rgba(4,2,1,0.35)",
    dial: DIAL_NIGHT,
    starfield: true,
  },
} as const;

type ThemeT = (typeof THEME)[Mode];

const BOW_D = "M28 162 C70 46 332 46 374 162";

/** 顶部弓拱 — 底弧一条细暗结构线 (#8A6C3C / #A8927E), 不做全金.
    夜: 沿弧跑一道 glint 流光 (五层同速嵌套 → 亮度剖面渐进, 彗尾无台阶) +
    拱顶点 #C9A768. 昼: 流光在米底上几乎不可见, 不跑粉珠 —「光」由拱顶最深
    一点 #B23A6E 极缓呼吸来演. */
function Bow({ t, blurId, night }: { t: ThemeT; blurId: string; night: boolean }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 402 190" fill="none" style={{ position: "absolute", inset: 0 }} aria-hidden>
      <defs>
        <filter id={`${blurId}-a`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id={`${blurId}-b`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      {/* 中心徽章圆盘 — 先画 (沉到底下), 弧顶画在盘上面, 连续不断. */}
      <circle cx="201" cy="112" r="50" stroke={t.medStroke} opacity="0.8" fill="none" />
      <circle cx="201" cy="112" r="44" fill={t.medFill} opacity={t.medFillOp} />
      {/* 底弧 — 细暗结构线 */}
      <path d={BOW_D} stroke={t.bow} strokeWidth="1" opacity="0.85" fill="none" />
      {!night && (
        // 昼 · 拱弧呼吸: 同路径叠一道玫粉, 整条缓缓涨落 (9s) — 有生气但
        // 不流动, 与拱顶深点 (6s) 错开成两层呼吸.
        <path d={BOW_D} stroke="#C77A9B" strokeWidth="1.6" fill="none" strokeLinecap="round" style={{ animation: "kimi-archbreath 9s ease-in-out infinite" }} />
      )}
      {night && (
        // 夜 · glint 流光: 五层同速嵌套 (周长 480), offset 各差长度差一半 →
        // 层层居中, 透明度 .16→白芯 渐进 + 外两层高斯糊 → 一颗彗尾状的光巡游.
        <>
          <path d={BOW_D} stroke="rgba(240,205,130,.16)" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeDasharray="70 410" filter={`url(#${blurId}-a)`} style={{ animation: "kimi-gl1 15s linear infinite" }} />
          <path d={BOW_D} stroke="rgba(240,205,130,.28)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeDasharray="56 424" filter={`url(#${blurId}-b)`} style={{ animation: "kimi-gl2 15s linear infinite" }} />
          <path d={BOW_D} stroke="rgba(240,205,130,.42)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeDasharray="44 436" style={{ animation: "kimi-gl3 15s linear infinite" }} />
          <path d={BOW_D} stroke="rgba(245,220,160,.65)" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeDasharray="32 448" style={{ animation: "kimi-gl4 15s linear infinite" }} />
          <path d={BOW_D} stroke="#FFF3D0" strokeWidth="1" fill="none" strokeLinecap="round" strokeDasharray="20 460" style={{ animation: "kimi-gl5 15s linear infinite" }} />
        </>
      )}
      <line x1="28" y1="118" x2="28" y2="162" stroke={t.bow} opacity="0.85" />
      <line x1="374" y1="118" x2="374" y2="162" stroke={t.bow} opacity="0.85" />
      <path d="M28 98 L33 110 L28 122 L23 110 Z" stroke={t.bow} opacity="0.9" />
      <path d="M374 98 L379 110 L374 122 L369 110 Z" stroke={t.bow} opacity="0.9" />
      <circle cx="201" cy="12" r="4" fill={t.apex} style={night ? undefined : { animation: "kimi-rosepoint 6s ease-in-out infinite" }} />
      <circle cx="176" cy="22" r="2.4" fill={t.apexMid} />
      <circle cx="226" cy="22" r="2.4" fill={t.apexMid} />
      <circle cx="154" cy="32" r="1.6" fill={t.apexSmall} />
      <circle cx="248" cy="32" r="1.6" fill={t.apexSmall} />
      <line x1="201" y1="22" x2="201" y2="58" stroke={t.bow} opacity="0.4" />
      <line x1="201" y1="166" x2="201" y2="182" stroke={t.bow} opacity="0.4" />
      {/* 徽章两侧 y=112 横辐线 0718 删 — 合起来是一道横穿弓拱的直线 */}
      <line x1="242" y1="71" x2="253" y2="60" stroke={t.bow} opacity="0.55" />
      <line x1="160" y1="71" x2="149" y2="60" stroke={t.bow} opacity="0.55" />
      <line x1="230" y1="62" x2="238" y2="48" stroke={t.bow} opacity="0.55" />
      <line x1="172" y1="62" x2="164" y2="48" stroke={t.bow} opacity="0.55" />
      <line x1="242" y1="153" x2="253" y2="164" stroke={t.bow} opacity="0.55" />
      <line x1="160" y1="153" x2="149" y2="164" stroke={t.bow} opacity="0.55" />
      <ellipse cx="120" cy="84" rx="3.4" ry="8" fill={t.petal} opacity="0.8" transform="rotate(-40 120 84)" />
      <ellipse cx="282" cy="84" rx="3.4" ry="8" fill={t.petal} opacity="0.8" transform="rotate(40 282 84)" />
      <ellipse cx="100" cy="130" rx="3" ry="7" fill={t.petal} opacity="0.6" transform="rotate(-72 100 130)" />
      <ellipse cx="302" cy="130" rx="3" ry="7" fill={t.petal} opacity="0.6" transform="rotate(72 302 130)" />
    </svg>
  );
}

export default async function RoomPage() {
  const theme = await getTheme();
  const mode: Mode = theme === "day" ? "day" : "night";
  const t = THEME[mode];
  const isDay = mode === "day";

  const moon = getMoonPhase();
  // 照明比 (0..100) — 昼仪表弧用. getMoonPhase 只给 fraction, 标准公式:
  // (1 - cos(2π·frac)) / 2 · 100 → 新月 0% / 满月 100% / 上下弦 50%.
  const illumination = ((1 - Math.cos(2 * Math.PI * moon.fraction)) / 2) * 100;

  // 格子仍来自 registry + 用户存的 layout cookie (addon 机制原样).
  const layoutCookie = (await cookies()).get(ROOM_LAYOUT_COOKIE)?.value;
  const { tiles, links } = resolveRoom(layoutCookie ? decodeURIComponent(layoutCookie) : null);

  const arcGradId = `kimi-6a-arc-${mode}`;

  return (
    <main
      style={{
        // svh 不是 dvh: iOS 工具栏结算时 dvh 反复变 → footer (marginTop auto)
        // 跟着跳. svh 固定用最小视口值.
        minHeight: "100svh",
        background: t.bg,
        color: t.ink,
        fontFamily: "var(--font-serif)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <style>{`
        @keyframes kimi-6a-breath { from { transform: scale(1); opacity:.85 } to { transform: scale(1.06); opacity:1 } }
        @keyframes kimi-6a-twk { 0%,100%{opacity:.12} 50%{opacity:.7} }
        /* 弓弧 glint 流光 — 五层各差长度差一半, 保持嵌套居中 (周长 480) */
        @keyframes kimi-gl1 { from { stroke-dashoffset: 480; } to { stroke-dashoffset: 0; } }
        @keyframes kimi-gl2 { from { stroke-dashoffset: 473; } to { stroke-dashoffset: -7; } }
        @keyframes kimi-gl3 { from { stroke-dashoffset: 467; } to { stroke-dashoffset: -13; } }
        @keyframes kimi-gl4 { from { stroke-dashoffset: 461; } to { stroke-dashoffset: -19; } }
        @keyframes kimi-gl5 { from { stroke-dashoffset: 455; } to { stroke-dashoffset: -25; } }
        /* 昼 · 拱顶最深点呼吸 (白天的光用最深的一点来演) */
        @keyframes kimi-rosepoint { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
        /* 昼 · 拱弧整条玫粉呼吸 — 不流动 (米底不跑流光), 只涨落; 与 apex 6s 错开 */
        @keyframes kimi-archbreath { 0%,100% { opacity: .08 } 50% { opacity: .4 } }
        /* 月相本体自转 + 金晕呼吸 */
        @keyframes kimi-moon-idle {
          0%   { transform: rotate(0deg);   filter: drop-shadow(0 0 8px rgba(212,154,86,0.32)) drop-shadow(0 0 14px rgba(212,154,86,0.18)); }
          50%  { filter: drop-shadow(0 0 11px rgba(212,154,86,0.42)) drop-shadow(0 0 18px rgba(212,154,86,0.24)); }
          100% { transform: rotate(360deg); filter: drop-shadow(0 0 8px rgba(212,154,86,0.32)) drop-shadow(0 0 14px rgba(212,154,86,0.18)); }
        }
        .kimi-moon-idle { animation: kimi-moon-idle 90s linear infinite; display: inline-block; line-height: 0; }
        /* 巴洛克光效 (夜) */
        @keyframes kimi-vitrail { 0%,100%{opacity:.12} 50%{opacity:.8} }
        @keyframes kimi-mote { 0%{transform:translateY(0);opacity:0} 12%{opacity:.8} 82%{opacity:.45} 100%{transform:translateY(290px);opacity:0} }
        @keyframes kimi-flick { 0%,100%{opacity:.85} 50%{opacity:.55} }
        /* 中庭进场阶梯 */
        @keyframes kimi-fadeup { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .kimi-6a-card { transition: border-color .25s, box-shadow .25s; }
        @media (prefers-reduced-motion: reduce){
          .kimi-moon-idle{animation:none}
          [style*="kimi-gl"],[style*="kimi-rosepoint"],[style*="kimi-archbreath"],[style*="kimi-vitrail"],[style*="kimi-mote"],[style*="kimi-flick"],[style*="kimi-fadeup"],[style*="kimi-6a-breath"],[style*="kimi-6a-twk"]{animation:none!important}
        }
        .kimi-6a-card:hover{border-color:${t.accent}66 !important}
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 402,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          // 顶部 padding 随屏高收放 (开源版禁写死 iPhone 预算).
          paddingTop: "clamp(20px, 4svh, 34px)",
          boxSizing: "border-box",
        }}
      >
        {/* 巴洛克光效 (夜) — 彩窗透光呼吸 (screen 混合) + 金尘缓落 + 烛光干涉晕影.
            全在底层, pointer-events 穿透. 与 v0.37 tenebrism 合并为这一层, 不叠两套. */}
        {!isDay && (
          <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
            {/* 烛光干涉 — 中心暖光两周期叠加 (不稳的火苗感) */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(62% 42% at 50% 30%, rgba(240,190,90,.10), transparent 70%)", animation: "kimi-flick 7s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(48% 34% at 50% 32%, rgba(240,190,90,.06), transparent 70%)", animation: "kimi-flick 4.3s ease-in-out -1.7s infinite" }} />
            {/* 彩窗透光呼吸 — 绯红 / 深蓝 / 琥珀, screen 混合, 错相 */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(44% 30% at 33% 36%, rgba(150,40,60,.24), transparent 70%)", mixBlendMode: "screen", animation: "kimi-vitrail 13s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(44% 30% at 67% 33%, rgba(45,75,140,.22), transparent 70%)", mixBlendMode: "screen", animation: "kimi-vitrail 13s ease-in-out -4.3s infinite" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(40% 28% at 50% 30%, rgba(225,150,50,.20), transparent 70%)", mixBlendMode: "screen", animation: "kimi-vitrail 13s ease-in-out -8.6s infinite" }} />
            {/* 深晕影 — 单光源把眼睛收回中心 (兼 tenebrism 光衰减) */}
            <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 130px 36px rgba(3,2,1,.72)" }} />
            {/* 金尘缓落 — 光柱区 4 粒 */}
            {[
              { left: "40%", top: 158, s: 2, dur: "11s", delay: "-2s", o: 0.85 },
              { left: "47%", top: 142, s: 1.5, dur: "14s", delay: "-7s", o: 0.75 },
              { left: "54%", top: 170, s: 2, dur: "9.5s", delay: "-4.5s", o: 0.8 },
              { left: "60%", top: 150, s: 1.5, dur: "12.5s", delay: "-10s", o: 0.7 },
            ].map((m, i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: m.left,
                  top: m.top,
                  width: m.s,
                  height: m.s,
                  borderRadius: "50%",
                  background: `rgba(245,215,150,${m.o})`,
                  boxShadow: "0 0 4px rgba(240,190,90,.55)",
                  animation: `kimi-mote ${m.dur} linear ${m.delay} infinite`,
                }}
              />
            ))}
          </div>
        )}

        {/* 双马赛克角饰对称 */}
        <div aria-hidden style={{ position: "absolute", top: 12, left: 12, color: t.hair, opacity: 0.6, zIndex: 3 }}>
          <MuchaMosaic color={t.hair} accent={t.accent} size={40} />
        </div>
        <div aria-hidden style={{ position: "absolute", top: 12, right: 12, color: t.hair, opacity: 0.6, transform: "scaleX(-1)", zIndex: 3 }}>
          <MuchaMosaic color={t.hair} accent={t.accent} size={40} />
        </div>

        {/* 弓拱 + 双头像徽章 (区高随屏 clamp — meet 缩放下徽章中心恒在 112/190≈59% 处,
            头像贴 59% 追住). 无门厅 seal / EXIRE / 罗马日期行. */}
        <div style={{ position: "relative", height: "clamp(132px, 19svh, 164px)", flex: "none", zIndex: 1, animation: "kimi-fadeup .7s ease .02s both" }}>
          <Bow t={t} blurId={`kimi-bow-blur-${mode}`} night={!isDay} />
          {t.starfield &&
            [
              { left: "13%", top: "24%", s: 2, d: "4s", delay: "0s" },
              { left: "87%", top: "18%", s: 1.5, d: "5s", delay: "1.2s" },
              { left: "68%", top: "78%", s: 1.5, d: "4.5s", delay: "2s" },
              { left: "30%", top: "84%", s: 2, d: "6s", delay: ".6s" },
            ].map((st, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: st.left,
                  top: st.top,
                  width: st.s,
                  height: st.s,
                  borderRadius: "50%",
                  background: "#E6CD96",
                  animation: `kimi-6a-twk ${st.d} ease-in-out ${st.delay} infinite`,
                }}
              />
            ))}
          <div style={{ position: "absolute", left: "50%", top: "59%", transform: "translate(-50%, -50%)", zIndex: 4 }}>
            <DualAvatarsClient size={54} accent={t.avRing} gap={-6} />
          </div>
        </div>

        {/* 星盘 (中心 = 玫瑰 / 月相; 夜月相带 90s 自转) — 点击进 /chat */}
        <div style={{ position: "relative", height: "clamp(124px, 18svh, 154px)", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, animation: "kimi-fadeup .7s ease .12s both" }}>
          <div
            aria-hidden
            style={{
              position: "absolute",
              width: 210,
              height: 210,
              borderRadius: "50%",
              background: isDay
                ? "radial-gradient(circle, rgba(202,122,155,.18) 0%, rgba(202,122,155,0) 62%)"
                : "radial-gradient(circle, rgba(242,222,168,.13) 0%, rgba(242,222,168,0) 62%)",
              animation: "kimi-6a-breath 5.5s ease-in-out infinite alternate",
            }}
          />
          <Link href="/chat" style={{ lineHeight: 0, position: "relative" }} aria-label="open chat">
            <CelestialDial size="clamp(118px, 17svh, 150px)" illumination={illumination} colors={t.dial} mode={mode} spin>
              {isDay ? (
                <RoseBloomDial size={74} />
              ) : (
                // MoonPhaseSvg 不吃 className → 包一层 span 挂 90s 自转 + 金晕呼吸.
                <span className="kimi-moon-idle">
                  <MoonPhaseSvg phase={moon.fraction} size={74} glow={false} />
                </span>
              )}
            </CelestialDial>
          </Link>
        </div>

        {/* 分隔线 — Mucha 藤蔓 */}
        <div style={{ padding: "6px 70px 0", color: t.hair, position: "relative", zIndex: 1, animation: "kimi-fadeup .7s ease .2s both" }}>
          <MuchaVine color={t.hair} accent={t.accent} />
        </div>

        {/* 房间卡 2×3 — 数据来自 resolveRoom() (addon 机制); 画法 = 中庭卡:
            弧顶填充渐变 + 顶心 accent 点 + 半透纸底 + hairline + 体积投影 + →.
            进场阶梯每格 .26 + i·.07. 卡高 / 格间随屏 clamp. */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(8px, 1.2svh, 10px)", padding: "12px 22px 0", flex: "none", position: "relative", zIndex: 1 }}>
          {tiles.map((m, i) => (
            <Link
              key={m.id}
              href={m.href}
              className="kimi-6a-card block"
              style={{
                height: "clamp(84px, 12svh, 104px)",
                position: "relative",
                background: `linear-gradient(180deg, ${t.paper} 0%, transparent 140%)`,
                border: `0.6px solid ${t.hair}`,
                padding: 10,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                overflow: "hidden",
                color: t.ink,
                textDecoration: "none",
                boxShadow: t.cardShadow,
                animation: `kimi-fadeup .7s ease ${(0.26 + i * 0.07).toFixed(2)}s both`,
              }}
            >
              <svg viewBox="0 0 100 20" width="100%" height="14" style={{ color: t.hair, position: "absolute", top: 0, left: 0, right: 0 }} aria-hidden>
                <defs>
                  <linearGradient id={arcGradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.09" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M4 18 Q4 2 50 2 Q96 2 96 18 Z" fill={`url(#${arcGradId})`} />
                <path d="M4 18 Q4 2 50 2 Q96 2 96 18" fill="none" stroke="currentColor" strokeWidth="0.5" />
                <circle cx="50" cy="5" r="1" fill={t.accent} />
              </svg>
              <div style={{ fontSize: 10, letterSpacing: 2, color: t.accent, fontStyle: "italic", marginTop: 5 }}>{ROMAN[i + 1] ?? i + 1}</div>
              <div>
                <div style={{ fontSize: 19, color: t.ink, letterSpacing: 0.5, fontFamily: "var(--font-serif)", fontWeight: 400 }}>
                  {m.name}
                </div>
                <div style={{ fontSize: 8, letterSpacing: 3, color: t.mute, marginTop: 2 }}>{m.sub}</div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 0.5, background: t.hair }} />
                  <div style={{ color: t.accent, fontSize: 12 }}>→</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* 页脚 — 内容不变 (昼夜切换 + addon 链接 + backstage), padding 收紧,
            marginTop auto 吸底, paddingBottom 让 safe-area. */}
        <div
          style={{
            marginTop: "auto",
            flex: "none",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 2,
            padding: "18px 24px max(14px, env(safe-area-inset-bottom))",
            position: "relative",
            zIndex: 1,
            animation: "kimi-fadeup .7s ease .7s both",
          }}
        >
          <ThemeToggleLink current={theme} color={t.mute} />
          {links.map((b) => (
            <Link
              key={b.id}
              href={b.href}
              style={{
                padding: "8px 14px",
                margin: 0,
                fontSize: 14,
                letterSpacing: 3,
                color: t.mute,
                fontStyle: "italic",
                fontFamily: "var(--font-serif)",
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
              color: t.mute,
              fontStyle: "italic",
              fontFamily: "var(--font-serif)",
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
