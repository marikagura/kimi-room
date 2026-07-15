import { GothicPage } from "@/components/mucha/Gothic";
import { Glass } from "@/components/mucha/Glass";
import { KimiTopNav } from "@/components/mucha/KimiPage";
import { getTheme } from "@/lib/day-theme";
import { gothicFor } from "@/lib/kimi-palettes";
import {
  DEMO_VITALS,
  DEMO_TREND,
  DEMO_SWATCHES,
  DEMO_INTRO,
  DEMO_FOOTNOTE,
  toneHex,
} from "@/lib/health-demo";

// /room/wellbeing/report — a SAMPLE dashboard. Canon has a real medical report
// grid (private); this ships fully synthetic to showcase the aesthetic + show
// fork users how to add a metric/trend/colorway dashboard. All numbers are fake.

export const dynamic = "force-dynamic";

const DOW = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export default async function WellbeingReportPage() {
  const G = gothicFor(await getTheme());

  return (
    <GothicPage G={G}>
      <KimiTopNav
        title="REPORT"
        sub="example"
        P={G}
        icon="❦"
        iconColor={G.accent}
        backHref="/room/wellbeing"
      />

      {/* intro note — 这是范例 */}
      <div style={{ padding: "8px 22px 0", maxWidth: 440, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.7,
            color: G.mute,
            fontStyle: "italic",
            textAlign: "center",
          }}
        >
          {DEMO_INTRO}
        </div>
      </div>

      {/* vitals — 2×2 metric cards */}
      <div
        style={{
          padding: "18px 16px 0",
          maxWidth: 440,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {DEMO_VITALS.map((m) => (
          <Glass key={m.label} radius={14} tint={G.paper} border={G.navBorder} style={{ padding: "14px 16px" }}>
            <div
              style={{
                fontSize: 9,
                letterSpacing: 2,
                color: G.mute,
                fontStyle: "italic",
                textTransform: "uppercase",
              }}
            >
              {m.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
              <div style={{ fontSize: 28, color: G.ink, fontFamily: "var(--font-serif)", lineHeight: 1 }}>
                {m.value}
              </div>
              <div style={{ fontSize: 10, color: G.mute, fontStyle: "italic" }}>{m.unit}</div>
            </div>
            <div style={{ marginTop: 8, height: 3, width: 28, borderRadius: 2, background: toneHex(m.tone) }} />
          </Glass>
        ))}
      </div>

      {/* trend — 周趋势条 */}
      <div style={{ padding: "16px 16px 0", maxWidth: 440, margin: "0 auto" }}>
        <Glass radius={14} tint={G.paper} border={G.navBorder} style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: G.accent, fontStyle: "italic", textTransform: "uppercase" }}>
            {DEMO_TREND.label}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 96, marginTop: 14 }}>
            {DEMO_TREND.points.map((pt, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 22,
                    height: Math.round(pt * 78) + 6,
                    background: G.accent,
                    opacity: 0.32 + pt * 0.5,
                    borderRadius: 2,
                  }}
                />
                <div style={{ fontSize: 8, color: G.mute, fontStyle: "italic" }}>{DOW[i]}</div>
              </div>
            ))}
          </div>
        </Glass>
      </div>

      {/* palette — 配色 showcase */}
      <div style={{ padding: "16px 16px 0", maxWidth: 440, margin: "0 auto" }}>
        <Glass radius={14} tint={G.paper} border={G.navBorder} style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: G.accent, fontStyle: "italic", textTransform: "uppercase" }}>
            palette · 配色
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            {DEMO_SWATCHES.map((s) => (
              <div key={s.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: s.hex, border: `0.5px solid ${G.hair}` }} />
                <div style={{ fontSize: 8, color: G.mute, fontStyle: "italic" }}>{s.name}</div>
              </div>
            ))}
          </div>
        </Glass>
      </div>

      {/* footnote — how to extend */}
      <div style={{ padding: "18px 22px 40px", maxWidth: 440, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 9,
            lineHeight: 1.7,
            color: G.mute,
            fontStyle: "italic",
            textAlign: "center",
            opacity: 0.7,
          }}
        >
          {DEMO_FOOTNOTE}
        </div>
      </div>
    </GothicPage>
  );
}
