"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Glass } from "@/components/mucha/Glass";
import { GothicPage, RoseBud } from "@/components/mucha/Gothic";
import { KimiTopNav } from "@/components/mucha/KimiPage";
import { SleepCandlesEditable } from "@/components/sleep/SleepCandlesEditable";
import { sleepStore } from "@/lib/stores";
import type { SleepEntry } from "@/lib/stores/types";
import { GOTHIC, gothicFor } from "@/lib/kimi-palettes";
import { lastNCandles } from "@/lib/sleep-utils";
import { getThemeFromCookieValue } from "@/lib/day-theme-client";

// V2 wellbeing · sleep manual tracker. canon V1 走 Prisma APP_OPEN 推断
// + 健康 report grid + doctor comment (个人医疗 data 不进 V2). V2 strip 到
// 仅 sleep · 用户 fork 后自添 own metrics.

export default function WellbeingPage() {
  const [G, setG] = useState(GOTHIC);
  const [entries, setEntries] = useState<SleepEntry[]>([]);

  async function reload() {
    const all = await sleepStore().list();
    setEntries(all);
  }

  useEffect(() => {
    const theme = getThemeFromCookieValue(document.cookie);
    setG(gothicFor(theme));
    void reload();
  }, []);

  const candles = lastNCandles(entries, 7);
  const last = candles[candles.length - 1];
  const lastDur =
    last && last.durationHrs > 0 ? last.durationHrs.toFixed(1) : "—";
  const lastLabel = last ? last.label : "—";

  return (
    <GothicPage G={G}>
      <KimiTopNav title="WELLBEING" sub="body" P={G} icon="♱" iconColor={G.blood} />

      <div style={{ textAlign: "center", marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div style={{ width: 40, height: 0.5, background: G.accent, opacity: 0.6 }} />
          <RoseBud G={G} state="bloom" size={20} />
          <div style={{ width: 40, height: 0.5, background: G.accent, opacity: 0.6 }} />
        </div>
        <div
          style={{
            fontSize: 28,
            color: G.ink,
            letterSpacing: 4,
            fontFamily: "var(--font-serif)",
            marginTop: 6,
            fontStyle: "italic",
          }}
        >
          the body
        </div>
        <div
          style={{
            fontSize: 9,
            color: G.mute,
            letterSpacing: 4,
            marginTop: 2,
            fontStyle: "italic",
          }}
        >
          sleep · manual
        </div>
      </div>

      {/* widen candle row · owner 0518 ask · 没 health report panel 时 sleep
          panel 横拉满 (8px 边距). */}
      <div style={{ padding: "20px 8px 0" }}>
        <Glass
          radius={18}
          style={{ padding: "20px 16px 18px", position: "relative" }}
          tint={G.paper}
          border={G.navBorder}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
              paddingLeft: 4,
              paddingRight: 4,
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.accent }}>
              SLEEP · 睡眠
            </div>
            <div style={{ fontSize: 9, color: G.mute, fontStyle: "italic" }}>
              last 7 days
            </div>
          </div>
          <SleepCandlesEditable G={G} windows={candles} onChange={reload} />
          <div
            style={{
              marginTop: 12,
              textAlign: "center",
              fontSize: 10,
              color: G.mute,
              fontStyle: "italic",
              letterSpacing: 2,
            }}
          >
            {lastDur === "—"
              ? "点 candle 填入入睡 + 时长"
              : `${lastLabel} · ${lastDur} 小时`}
          </div>
        </Glass>
      </div>

      {/* sample dashboard 入口 — 演示如何加一块 report */}
      <div style={{ textAlign: "center", marginTop: 18 }}>
        <Link
          href="/room/wellbeing/report"
          style={{
            fontSize: 12,
            letterSpacing: 3,
            color: G.accent,
            fontStyle: "italic",
            fontFamily: "var(--font-serif)",
            textDecoration: "none",
            opacity: 0.85,
          }}
        >
          示例报告 · sample report →
        </Link>
      </div>
    </GothicPage>
  );
}
