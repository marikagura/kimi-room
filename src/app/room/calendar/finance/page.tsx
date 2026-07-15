import Link from "next/link";
import { KimiPage, KimiTopNav } from "@/components/mucha/KimiPage";
import { palGold } from "@/lib/kimi-palettes";
import { getTheme } from "@/lib/day-theme";
import { MoonPhaseSvg } from "@/components/MoonPhaseSvg";
import { getMoonPhase } from "@/lib/moon-phase";
import { FinanceEditOverlay } from "@/components/finance/FinanceEditOverlay";
import { FinanceLocalOverride } from "@/components/finance/FinanceLocalOverride";

export const dynamic = "force-dynamic";

// /room/calendar/finance — 月支出 visual (owner 0833 + 0841).
// tab: 信 (envelope cards) / 园 (rose garden). 不做 "年" (owner 0841).
// query ?tab=envelope|garden, default garden.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// 自然月视图 · canon 0606 "月支出从滚动累计改自然月" 的 demo 版.
// ?month=YYYY-MM, 默认本月 (JST). 月份 chip 选择器列最近 12 个自然月.
function monthKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function currentJstYM(): { year: number; month: number } {
  const jst = new Date(Date.now() + 9 * 3600 * 1000);
  return { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1 };
}

function parseMonthParam(raw?: string): { year: number; month: number } {
  const cur = currentJstYM();
  const m = raw?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return cur;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return cur;
  return { year: Number(m[1]), month };
}

function monthOptions(): { key: string; label: string }[] {
  const cur = currentJstYM();
  const base = cur.year * 12 + (cur.month - 1);
  const out: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const idx = base - i;
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    out.push({ key: monthKey(y, m), label: MONTH_NAMES[m - 1].slice(0, 3) });
  }
  return out;
}

type Cat = { cat: string; amt: number; color: string };

function dayCats(): Cat[] {
  return [
    { cat: "吃", amt: 98, color: "#A42B5E" },
    { cat: "订阅", amt: 24, color: "#8A6428" },
    { cat: "旅行", amt: 142, color: "#C7547E" },
    { cat: "房租", amt: 165, color: "#5A1820" },
    { cat: "买", amt: 76, color: "#8A2840" },
    { cat: "交通", amt: 31, color: "#C89548" },
  ];
}

function nightCats(): Cat[] {
  return [
    { cat: "吃", amt: 98, color: "#c8576f" },
    { cat: "订阅", amt: 24, color: "#b8a070" },
    { cat: "旅行", amt: 142, color: "#9a7a7a" },
    { cat: "房租", amt: 165, color: "#a08a6c" },
    { cat: "买", amt: 76, color: "#c8576f" },
    { cat: "交通", amt: 31, color: "#b8a070" },
  ];
}

type Envelope = {
  kind: "bank" | "jpy" | "usd" | "cny" | "card";
  label: string;
  amount: string;
  count: number;
  transactions: { date: string; name: string; amt: string }[];
};

// V2 dummy · 全中文 + 人民币 · owner 0912 ack ("用中文和人民币计数"). 用户
// fork 后 connect own CalendarStore + financeCategory aggregate to replace
// these placeholders (Phase 5 community wire).
function mockEnvelopes(): Envelope[] {
  return [
    {
      kind: "bank",
      label: "信用卡 · 自动扣款",
      amount: "¥13,420",
      count: 3,
      transactions: [
        { date: "05/01", name: "房租", amt: "¥12,800" },
        { date: "05/12", name: "水电燃气", amt: "¥420" },
        { date: "05/27", name: "宽带", amt: "¥200" },
      ],
    },
    {
      kind: "cny",
      label: "餐饮 · 日常",
      amount: "¥1,860",
      count: 6,
      transactions: [
        { date: "05/02", name: "外食", amt: "¥260" },
        { date: "05/09", name: "咖啡", amt: "¥48" },
        { date: "05/11", name: "便利店", amt: "¥36" },
        { date: "05/13", name: "书店", amt: "¥126" },
        { date: "05/18", name: "外食", amt: "¥318" },
        { date: "05/22", name: "咖啡", amt: "¥58" },
      ],
    },
    {
      kind: "cny",
      label: "订阅 · 服务",
      amount: "¥860",
      count: 4,
      transactions: [
        { date: "05/05", name: "云存储", amt: "¥80" },
        { date: "05/15", name: "音乐 vip", amt: "¥30" },
        { date: "05/20", name: "学习 app", amt: "¥168" },
        { date: "05/28", name: "视频 vip", amt: "¥48" },
      ],
    },
    {
      kind: "cny",
      label: "其他 · 杂项",
      amount: "¥640",
      count: 5,
      transactions: [
        { date: "05/04", name: "礼物", amt: "¥220" },
        { date: "05/18", name: "网购", amt: "¥140" },
        { date: "05/22", name: "出行", amt: "¥80" },
      ],
    },
  ];
}

// 卡 tab demo · by card · 全假数据 + 泛化卡名 (无真实卡号). canon 0606 第三 tab
// "卡" 的 demo 版. fork 后接 own 交易按 card 聚合替换.
function mockCards(): Envelope[] {
  return [
    {
      kind: "card",
      label: "Card · ••00",
      amount: "¥4,820",
      count: 4,
      transactions: [
        { date: "05/03", name: "网购", amt: "¥1,280" },
        { date: "05/12", name: "外食", amt: "¥640" },
        { date: "05/19", name: "订阅", amt: "¥1,200" },
        { date: "05/26", name: "出行", amt: "¥1,700" },
      ],
    },
    {
      kind: "card",
      label: "信用卡 · 自动扣款",
      amount: "¥13,420",
      count: 3,
      transactions: [
        { date: "05/01", name: "房租", amt: "¥12,800" },
        { date: "05/12", name: "水电燃气", amt: "¥420" },
        { date: "05/27", name: "宽带", amt: "¥200" },
      ],
    },
    {
      kind: "card",
      label: "移动支付 · 日常",
      amount: "¥1,540",
      count: 5,
      transactions: [
        { date: "05/05", name: "便利店", amt: "¥180" },
        { date: "05/09", name: "咖啡", amt: "¥48" },
        { date: "05/15", name: "书店", amt: "¥320" },
        { date: "05/21", name: "外食", amt: "¥492" },
        { date: "05/28", name: "打车", amt: "¥500" },
      ],
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// Garden tab content
// ─────────────────────────────────────────────────────────────
function AlphaRose({
  size,
  color,
  haloColor,
}: {
  size: number;
  color: string;
  haloColor?: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: "url(/icons/rose-finance.png)",
        maskImage: "url(/icons/rose-finance.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        imageRendering: "auto",
        filter: haloColor ? `drop-shadow(0 0 6px ${haloColor}88)` : undefined,
      }}
    />
  );
}

function StandingRoseGarden({
  data,
  w = 360,
  h = 360,
  isDay,
}: {
  data: Cat[];
  w?: number;
  h?: number;
  isDay: boolean;
}) {
  const stemColor = isDay ? "#5A1820" : "rgba(184,160,112,0.55)";
  const leafColor = stemColor;
  const haloColor = isDay ? "#A42B5E" : "#b8a070";
  const labelInk = isDay ? "#3A2418" : "#c4a78a";
  const muteInk = isDay ? "rgba(26,14,10,0.55)" : "rgba(216,208,200,0.5)";

  const max = Math.max(...data.map((d) => d.amt));
  const minH = 70;
  const maxH = 230;
  const colW = w / data.length;
  const groundY = h - 50;

  const tallestIdx = data.reduce(
    (mxI, d, i, arr) => (d.amt > arr[mxI].amt ? i : mxI),
    0,
  );
  const tallestStemH = minH + (maxH - minH) * (data[tallestIdx].amt / max);
  const tallestX = colW * tallestIdx + colW / 2;
  const roseSize = 44;

  return (
    <div style={{ position: "relative", width: w, height: h, margin: "0 auto" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id={`fin-halo-${isDay ? "d" : "n"}`} cx="50%" cy="78%" r="60%">
            <stop offset="0%" stopColor={haloColor} stopOpacity={isDay ? 0.18 : 0.2} />
            <stop offset="100%" stopColor={haloColor} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={w} height={h} fill={`url(#fin-halo-${isDay ? "d" : "n"})`} />

        <line x1="12" y1={groundY} x2={w - 12} y2={groundY} stroke={stemColor} strokeWidth="0.7" opacity="0.7" />
        <line x1="20" y1={groundY + 1.6} x2={w - 20} y2={groundY + 1.6} stroke={stemColor} strokeWidth="0.3" opacity="0.5" />
        {[0.2, 0.5, 0.8].map((t, i) => (
          <circle key={i} cx={12 + (w - 24) * t} cy={groundY + 1} r="1.4" fill={haloColor} opacity="0.7" />
        ))}

        {data.map((d, i) => {
          const stemH = minH + (maxH - minH) * (d.amt / max);
          const x = colW * i + colW / 2;
          const tipY = groundY - stemH;
          const sway = (i % 2 ? -1 : 1) * 4;
          const ctrlY = (groundY + tipY) / 2;
          return (
            <g key={i}>
              <path
                d={`M ${x} ${groundY} Q ${x + sway} ${ctrlY} ${x} ${tipY}`}
                stroke={stemColor} strokeWidth="1.0" strokeLinecap="round" fill="none" opacity="0.92"
              />
              <path
                d={`M ${x + (i % 2 ? -1 : 1)} ${groundY - 2} Q ${x + sway + (i % 2 ? -1.5 : 1.5)} ${ctrlY + 2} ${x + (i % 2 ? -0.5 : 0.5)} ${tipY + 4}`}
                stroke={stemColor} strokeWidth="0.4" strokeLinecap="round" fill="none" opacity="0.45"
              />
              <g transform={`translate(${x + (i % 2 ? -8 : 8)} ${tipY + stemH * 0.32})`}>
                <ellipse cx="0" cy="0" rx="9" ry="3" fill={leafColor} opacity="0.7" transform={`rotate(${i % 2 ? -28 : 28})`} />
              </g>
              <g transform={`translate(${x + (i % 2 ? 7 : -7)} ${tipY + stemH * 0.66})`}>
                <ellipse cx="0" cy="0" rx="7" ry="2.4" fill={leafColor} opacity="0.55" transform={`rotate(${i % 2 ? 22 : -22})`} />
              </g>
              {(i === 0 || i === data.length - 1) && (
                <path
                  d={`M ${x + (i === 0 ? -6 : 6)} ${tipY + stemH * 0.5} q ${i === 0 ? -6 : 6} -4 -3 -7`}
                  stroke={stemColor} strokeWidth="0.45" fill="none" opacity="0.7"
                />
              )}
            </g>
          );
        })}
      </svg>

      {data.map((d, i) => {
        const stemH = minH + (maxH - minH) * (d.amt / max);
        const x = colW * i + colW / 2;
        const tipY = groundY - stemH;
        const sz = roseSize + (i === tallestIdx ? 6 : 0);
        return (
          <div key={i} style={{ position: "absolute", left: x - sz / 2, top: tipY - sz * 0.68, transform: `rotate(${i % 2 ? -4 : 4}deg)` }}>
            <AlphaRose size={sz} color={d.color} haloColor={i === tallestIdx ? haloColor : undefined} />
          </div>
        );
      })}

      <div style={{ position: "absolute", left: tallestX + 8, top: groundY - 34, width: 36, height: 36 }}>
        <span
          style={{
            display: "inline-block", width: 36, height: 36,
            backgroundColor: isDay ? "#1a0e0a" : "#d8d0c8",
            WebkitMaskImage: "url(/icons/fox-bw-sit.png)",
            maskImage: "url(/icons/fox-bw-sit.png)",
            WebkitMaskSize: "contain", maskSize: "contain",
            WebkitMaskPosition: "center", maskPosition: "center",
            WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
            transform: "scaleX(-1)",
          }}
        />
      </div>

      <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "space-between", padding: "0 6px" }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0 }}>
            <div
              data-cat-i={i}
              data-cat-field="name"
              style={{ fontFamily: 'var(--font-serif-cn)', fontSize: 12, color: labelInk, letterSpacing: 0.5, lineHeight: 1.1 }}
            >
              {d.cat}
            </div>
          </div>
        ))}
      </div>

      {data.map((d, i) => {
        const stemH = minH + (maxH - minH) * (d.amt / max);
        const x = colW * i + colW / 2;
        const tipY = groundY - stemH;
        return (
          <div
            key={i}
            data-cat-i={i}
            data-cat-field="amt"
            style={{
              position: "absolute", top: tipY - roseSize * 0.7 - 18, left: x - 28, width: 56,
              textAlign: "center", fontFamily: 'var(--font-serif)', fontStyle: "italic",
              fontSize: 10, color: muteInk, letterSpacing: 0.5,
            }}
          >
            ¥{d.amt}k
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Envelope tab content (owner 0841 spec: 信封 vertical cards)
// ─────────────────────────────────────────────────────────────
function Stamp({ kind, isDay, index }: { kind: Envelope["kind"]; isDay: boolean; index?: number }) {
  const accent = isDay ? "#A42B5E" : "#b8a070";
  const ink = isDay ? "#5A1820" : "#c4a78a";
  return (
    <div
      style={{
        width: 56,
        height: 56,
        border: `0.6px solid ${accent}`,
        padding: 4,
        boxShadow: `inset 0 0 0 1px ${accent}22`,
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          border: `0.4px dashed ${accent}88`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: 'var(--font-serif)',
          fontStyle: "italic",
          fontSize: 9,
          color: ink,
          letterSpacing: 1.5,
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        <span data-env-i={index} data-env-field="kind">
          {kind === "bank"
            ? "BANK"
            : kind === "jpy"
              ? "JPY"
              : kind === "usd"
                ? "USD"
                : kind === "card"
                  ? "CARD"
                  : "CNY"}
        </span>
      </div>
    </div>
  );
}

function EnvelopeCard({ env, isDay, index }: { env: Envelope; isDay: boolean; index: number }) {
  const ink = isDay ? "#1a0e0a" : "#e8e6e0";
  const inkSoft = isDay ? "#3A2418" : "#c4a78a";
  const mute = isDay ? "rgba(26,14,10,0.55)" : "rgba(232,230,224,0.5)";
  const hair = isDay ? "rgba(106,74,72,0.32)" : "rgba(184,160,112,0.22)";
  const accent = isDay ? "#A42B5E" : "#b8a070";
  const bg = isDay
    ? "linear-gradient(180deg, rgba(245,235,222,0.7) 0%, rgba(220,207,194,0.5) 100%)"
    : "linear-gradient(180deg, rgba(50,42,32,0.5) 0%, rgba(20,16,12,0.6) 100%)";

  return (
    <div
      style={{
        position: "relative",
        background: bg,
        border: `0.6px solid ${hair}`,
        padding: "26px 22px 20px",
        marginBottom: 20,
      }}
    >
      {/* envelope flap line top */}
      <svg
        width="100%"
        height="22"
        viewBox="0 0 400 22"
        preserveAspectRatio="none"
        style={{ position: "absolute", top: 0, left: 0, opacity: 0.5 }}
      >
        <path d="M 0 0 L 200 22 L 400 0" stroke={hair} strokeWidth="0.5" fill="none" />
      </svg>

      {/* stamp top-right */}
      <div style={{ position: "absolute", top: 16, right: 16 }} data-env-i={index} data-env-field="kind-wrap">
        <Stamp kind={env.kind} isDay={isDay} index={index} />
      </div>

      {/* label */}
      <div
        data-env-i={index}
        data-env-field="label"
        style={{
          marginTop: 8,
          fontFamily: 'var(--font-serif)',
          fontStyle: "italic",
          fontSize: 11,
          color: accent,
          letterSpacing: 3,
        }}
      >
        {env.label}
      </div>

      {/* amount */}
      <div
        data-env-i={index}
        data-env-field="amount"
        style={{
          marginTop: 14,
          fontFamily: 'var(--font-serif)',
          fontSize: 38,
          color: ink,
          letterSpacing: 0.5,
          lineHeight: 1,
          fontFeatureSettings: '"onum"',
        }}
      >
        {env.amount}
      </div>

      {/* count */}
      <div
        style={{
          marginTop: 4,
          fontFamily: 'var(--font-serif)',
          fontStyle: "italic",
          fontSize: 10,
          color: mute,
          letterSpacing: 1.5,
        }}
      >
        {env.count} 笔
      </div>

      {/* ledger divider */}
      <div style={{ height: 0.5, background: hair, margin: "16px 0 12px" }} />

      {/* transactions */}
      {env.transactions.map((tx, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "5px 0",
            borderBottom: i < env.transactions.length - 1 ? `0.4px solid ${hair}` : "none",
            fontFamily: 'var(--font-serif-cn)',
            fontSize: 11.5,
            color: inkSoft,
          }}
        >
          <div style={{ display: "flex", gap: 10, minWidth: 0, flex: 1 }}>
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: "italic",
                fontSize: 9.5,
                color: mute,
                flexShrink: 0,
              }}
            >
              {tx.date}
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tx.name}
            </span>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              color: ink,
              fontSize: 12,
              flexShrink: 0,
              marginLeft: 8,
            }}
          >
            {tx.amt}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Inline SVG icons (owner 0903: 全 kimi-web 不准 emoji, 自画 SVG)
// ─────────────────────────────────────────────────────────────
function EnvelopeIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={(size * 12) / 16} viewBox="0 0 16 12" aria-hidden>
      <rect
        x="1"
        y="2"
        width="14"
        height="9"
        fill="none"
        stroke={color}
        strokeWidth="0.9"
      />
      <path
        d="M 1.4 2.4 L 8 7 L 14.6 2.4"
        stroke={color}
        strokeWidth="0.9"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlowerIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <ellipse cx="8" cy="3.4" rx="2.2" ry="3.2" fill={color} opacity="0.85" />
      <ellipse cx="8" cy="12.6" rx="2.2" ry="3.2" fill={color} opacity="0.85" />
      <ellipse cx="3.4" cy="8" rx="3.2" ry="2.2" fill={color} opacity="0.85" />
      <ellipse cx="12.6" cy="8" rx="3.2" ry="2.2" fill={color} opacity="0.85" />
      <ellipse
        cx="4.8"
        cy="4.8"
        rx="1.8"
        ry="2.6"
        fill={color}
        opacity="0.7"
        transform="rotate(-45 4.8 4.8)"
      />
      <ellipse
        cx="11.2"
        cy="11.2"
        rx="1.8"
        ry="2.6"
        fill={color}
        opacity="0.7"
        transform="rotate(-45 11.2 11.2)"
      />
      <ellipse
        cx="11.2"
        cy="4.8"
        rx="1.8"
        ry="2.6"
        fill={color}
        opacity="0.7"
        transform="rotate(45 11.2 4.8)"
      />
      <ellipse
        cx="4.8"
        cy="11.2"
        rx="1.8"
        ry="2.6"
        fill={color}
        opacity="0.7"
        transform="rotate(45 4.8 11.2)"
      />
      <circle cx="8" cy="8" r="1.6" fill={color} />
    </svg>
  );
}

// 信用卡 icon · canon CardIcon port (第三 tab 卡).
function CardIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={(size * 10) / 16} viewBox="0 0 16 10" aria-hidden>
      <rect x="1" y="1" width="14" height="8" rx="1" fill="none" stroke={color} strokeWidth="0.9" />
      <rect x="1.5" y="3" width="13" height="1.4" fill={color} opacity="0.6" />
      <rect x="9" y="6.4" width="5" height="1.2" fill="none" stroke={color} strokeWidth="0.5" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Month selector — 自然月切换 chip 行 (canon MonthSelector port)
// ─────────────────────────────────────────────────────────────
function MonthSelector({
  options,
  selectedKey,
  tab,
  isDay,
}: {
  options: { key: string; label: string }[];
  selectedKey: string;
  tab: "envelope" | "garden" | "card";
  isDay: boolean;
}) {
  const accent = isDay ? "#A42B5E" : "#b8a070";
  const mute = isDay ? "rgba(26,14,10,0.5)" : "rgba(232,230,224,0.45)";
  const hair = isDay ? "rgba(106,74,72,0.28)" : "rgba(184,160,112,0.2)";
  const activeBg = isDay ? "rgba(164,43,94,0.1)" : "rgba(184,160,112,0.14)";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 16,
        padding: "0 12px",
      }}
    >
      {options.map((o) => {
        const isActive = o.key === selectedKey;
        return (
          <Link
            key={o.key}
            href={`/room/calendar/finance?tab=${tab}&month=${o.key}`}
            style={{
              padding: "4px 12px",
              borderRadius: 100,
              border: `0.5px solid ${isActive ? accent : hair}`,
              background: isActive ? activeBg : "transparent",
              color: isActive ? accent : mute,
              fontFamily: 'var(--font-serif)',
              fontStyle: "italic",
              fontSize: 12,
              letterSpacing: 1,
              textDecoration: "none",
            }}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab bar (信 / 园 / 卡)
// ─────────────────────────────────────────────────────────────
function TabBar({
  active,
  monthKey: mKey,
  isDay,
}: {
  active: "envelope" | "garden" | "card";
  monthKey: string;
  isDay: boolean;
}) {
  const accent = isDay ? "#A42B5E" : "#b8a070";
  const mute = isDay ? "rgba(26,14,10,0.55)" : "rgba(232,230,224,0.5)";
  const hair = isDay ? "rgba(106,74,72,0.32)" : "rgba(184,160,112,0.22)";
  const bg = isDay ? "rgba(229,215,202,0.85)" : "rgba(20,16,12,0.88)";
  const activeBg = isDay ? "rgba(164,43,94,0.12)" : "rgba(184,160,112,0.16)";

  const tabs = [
    {
      key: "envelope" as const,
      label: "信",
      href: `/room/calendar/finance?tab=envelope&month=${mKey}`,
      Icon: EnvelopeIcon,
    },
    {
      key: "garden" as const,
      label: "园",
      href: `/room/calendar/finance?tab=garden&month=${mKey}`,
      Icon: FlowerIcon,
    },
    {
      key: "card" as const,
      label: "卡",
      href: `/room/calendar/finance?tab=card&month=${mKey}`,
      Icon: CardIcon,
    },
  ];

  return (
    <div
      style={{
        position: "sticky",
        bottom: 16,
        margin: "32px auto 24px",
        maxWidth: 340,
        height: 46,
        background: bg,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: `0.6px solid ${hair}`,
        borderRadius: 100,
        display: "flex",
        alignItems: "center",
        padding: 4,
        boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
      }}
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        const color = isActive ? accent : mute;
        return (
          <Link
            key={t.key}
            href={t.href}
            style={{
              flex: 1,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 100,
              background: isActive ? activeBg : "transparent",
              color,
              fontFamily: 'var(--font-serif-cn)',
              fontSize: 13,
              letterSpacing: 4,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            <t.Icon size={13} color={color} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default async function FinancePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; month?: string }>;
}) {
  // V2 strip canon backstage cookie auth gate · 0 web auth per owner 0429 ack.
  const params = (await searchParams) ?? {};
  const tab: "envelope" | "garden" | "card" =
    params.tab === "envelope"
      ? "envelope"
      : params.tab === "card"
        ? "card"
        : "garden";
  const sel = parseMonthParam(params.month);
  const selKey = monthKey(sel.year, sel.month);
  const monthName = MONTH_NAMES[sel.month - 1];
  const months = monthOptions();

  const theme = await getTheme();
  const isDay = theme === "day";
  const P = palGold(theme);
  const moon = getMoonPhase();
  const cats = isDay ? dayCats() : nightCats();
  const envelopes = mockEnvelopes();
  const cards = mockCards();

  // V2 finance edit overlay seed · owner 0518: tap-edit (minimal v1 = ✎ button
  // → modal edits all roses + envelopes · localStorage persist + reload apply).
  // Per-row inline tap 是 future iter.
  const overlayCats = cats.map((c) => ({ cat: c.cat, amt: c.amt, color: c.color }));
  const overlayEnvs = envelopes.map((e) => ({
    kind: e.kind,
    label: e.label,
    amount: e.amount,
  }));

  return (
    <KimiPage P={P} vines={false}>
      <KimiTopNav title="FINANCE" sub={`${monthName.slice(0, 3)} ${sel.year}`} P={P} backHref="/room/calendar" />
      <FinanceLocalOverride />
      <FinanceEditOverlay P={P} seedCats={overlayCats} seedEnvelopes={overlayEnvs} />

      {/* month name 大字 */}
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: "italic",
            fontSize: 38,
            color: P.ink,
            letterSpacing: 1,
            lineHeight: 1,
          }}
        >
          {monthName}
        </div>
      </div>

      {/* month selector — 自然月切换 (canon 0606) */}
      <MonthSelector options={months} selectedKey={selKey} tab={tab} isDay={isDay} />

      {/* moon backdrop only on garden tab */}
      {tab === "garden" && (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          <MoonPhaseSvg
            phase={moon.fraction}
            size={120}
            light={isDay ? "#f4e8d0" : "#e4d4b0"}
            dark={isDay ? "rgba(220,207,194,0.85)" : "rgba(14,8,4,0.94)"}
            glow={true}
          />
        </div>
      )}

      {/* content */}
      {tab === "garden" ? (
        <div style={{ marginTop: 12, padding: "0 8px" }}>
          <StandingRoseGarden data={cats} w={360} h={360} isDay={isDay} />
        </div>
      ) : tab === "envelope" ? (
        <div style={{ marginTop: 28, padding: "0 18px", maxWidth: 440, margin: "28px auto 0" }}>
          {envelopes.map((env, i) => (
            <EnvelopeCard key={`${env.kind}-${i}`} env={env} isDay={isDay} index={i} />
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 28, padding: "0 18px", maxWidth: 440, margin: "28px auto 0" }}>
          {cards.map((env, i) => (
            <EnvelopeCard key={`${env.label}-${i}`} env={env} isDay={isDay} index={i} />
          ))}
        </div>
      )}

      {/* summary line */}
      <div
        style={{
          margin: "0 auto",
          maxWidth: 360,
          padding: "14px 36px 0",
          borderTop: `0.5px solid ${P.hair}`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: "italic",
            fontSize: 12,
            color: P.mute,
            letterSpacing: 2,
          }}
        >
          共 · ¥268,240 · 538 笔
        </div>
      </div>

      {/* tab bar */}
      <TabBar active={tab} monthKey={selKey} isDay={isDay} />
    </KimiPage>
  );
}
