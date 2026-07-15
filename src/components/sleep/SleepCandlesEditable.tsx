"use client";

import { useState } from "react";
import { Candle } from "@/components/mucha/Gothic";
import { GOTHIC } from "@/lib/kimi-palettes";
import { sleepStore } from "@/lib/stores";
import { endDateKeyOf, jstDateKey, type SleepCandle } from "@/lib/sleep-utils";

// V2: 点蜡烛 → modal 改 入睡时间 + 睡了几小时 · sync IDB SleepStore.
// canon V1 走 /api/sleep/window (Prisma pwa_kv). V2 IDB-only.
// payload: SleepEntry { date, startISO, durationHrs } · id = date (1/night).

function jstHM(iso: string): { hh: string; mm: string } {
  const d = new Date(iso);
  const j = new Date(d.getTime() + 9 * 3600000);
  return {
    hh: String(j.getUTCHours()).padStart(2, "0"),
    mm: String(j.getUTCMinutes()).padStart(2, "0"),
  };
}

export function SleepCandlesEditable({
  G = GOTHIC,
  windows,
  onChange,
}: {
  G?: typeof GOTHIC;
  windows: SleepCandle[];
  onChange?: () => void;
}) {
  const [editing, setEditing] = useState<SleepCandle | null>(null);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end" }}>
        {windows.map((s) => (
          <button
            key={s.date}
            type="button"
            onClick={() => setEditing(s)}
            aria-label={`edit ${s.label} sleep`}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Candle G={G} h={s.h} label={s.label} />
          </button>
        ))}
      </div>
      {editing && (
        <EditModal
          G={G}
          candle={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange?.();
          }}
        />
      )}
    </>
  );
}

function EditModal({
  G,
  candle,
  onClose,
  onSaved,
}: {
  G: typeof GOTHIC;
  candle: SleepCandle;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial =
    candle.durationHrs > 0
      ? jstHM(candle.startISO)
      : { hh: "23", mm: "00" }; // blank candle default
  const [hh, setHh] = useState(initial.hh);
  const [mm, setMm] = useState(initial.mm);
  const [hours, setHours] = useState(
    candle.durationHrs > 0 ? candle.durationHrs.toFixed(1) : "7.5",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    const hN = parseInt(hh, 10);
    const mN = parseInt(mm, 10);
    const dN = parseFloat(hours);
    if (
      isNaN(hN) || hN < 0 || hN > 23 ||
      isNaN(mN) || mN < 0 || mN > 59 ||
      isNaN(dN) || dN <= 0 || dN > 24
    ) {
      setErr("时间/小时数 不合理");
      return;
    }
    // user 输入的 JST 入睡 HH:MM apply 到 candle.date 前一晚 (start 在 end-date
    // 的前一天 PM 区, e.g. end-date 2026-05-18 → start 2026-05-17 23:00 JST).
    // 简化: assume start same JST date as end if HH < 12 (e.g. 凌晨 2 点起夜
    // 算 same date end), else previous day (e.g. 23 点入睡算 end-date 前一天).
    const endDate = candle.date;
    const startDateJst =
      hN < 12 ? endDate : prevDay(endDate);
    const startUTC = new Date(`${startDateJst}T${pad(hN)}:${pad(mN)}:00+09:00`);
    const endDateKey = endDateKeyOf(startUTC.toISOString(), dN);
    setBusy(true);
    setErr(null);
    try {
      await sleepStore().put({
        id: endDateKey,
        date: endDateKey,
        startISO: startUTC.toISOString(),
        durationHrs: dN,
      });
      onSaved();
    } catch (e) {
      setErr((e as Error).message || "save 失败");
      setBusy(false);
    }
  }

  async function removeManual() {
    if (busy) return;
    if (!window.confirm("移除 manual 记录?")) return;
    setBusy(true);
    try {
      await sleepStore().delete(candle.date);
      onSaved();
    } catch {
      setErr("delete err");
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 360,
          background: G.bg,
          color: G.ink,
          border: `0.6px solid ${G.navBorder}`,
          padding: "22px 24px 20px",
          fontFamily: 'var(--font-serif)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: 4,
            color: G.accent,
            marginBottom: 14,
            fontStyle: "italic",
          }}
        >
          SLEEP · {jstDateKey(candle.endISO)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: G.mute, letterSpacing: 2, width: 60 }}>
            入睡
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={23}
            value={hh}
            onChange={(e) => setHh(e.target.value.padStart(2, "0").slice(-2))}
            style={inputStyle(G)}
          />
          <span style={{ color: G.mute }}>:</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            value={mm}
            onChange={(e) => setMm(e.target.value.padStart(2, "0").slice(-2))}
            style={inputStyle(G)}
          />
          <span style={{ fontSize: 9, color: G.mute, marginLeft: 6, fontStyle: "italic" }}>
            JST
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: G.mute, letterSpacing: 2, width: 60 }}>
            睡了
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={24}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            style={{ ...inputStyle(G), width: 70 }}
          />
          <span style={{ fontSize: 11, color: G.mute, marginLeft: 4 }}>小时</span>
        </div>
        {err && (
          <div style={{ fontSize: 10, color: G.blood, marginBottom: 10, fontStyle: "italic" }}>
            {err}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <button
            type="button"
            onClick={removeManual}
            disabled={busy || candle.durationHrs === 0}
            style={{
              background: "transparent",
              border: "none",
              color: G.mute,
              opacity: candle.durationHrs === 0 ? 0.2 : 0.55,
              fontSize: 10,
              fontStyle: "italic",
              letterSpacing: 2,
              cursor: busy ? "default" : "pointer",
              padding: "6px 0",
            }}
          >
            移除
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={btnGhost(G, busy)}
            >
              取消
            </button>
            <button type="button" onClick={save} disabled={busy} style={btnSolid(G, busy)}>
              {busy ? "..." : "存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function prevDay(yyyymmdd: string): string {
  // 直接 string-level minus 1 day on YYYY-MM-DD, 避开 tz round-trip bug.
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function inputStyle(G: typeof GOTHIC): React.CSSProperties {
  return {
    width: 50,
    padding: "6px 8px",
    border: `0.5px solid ${G.hair}`,
    background: "transparent",
    color: G.ink,
    fontSize: 14,
    fontFamily: "inherit",
    textAlign: "center",
    borderRadius: 0,
  };
}

function btnGhost(G: typeof GOTHIC, busy: boolean): React.CSSProperties {
  return {
    background: "transparent",
    border: `0.4px solid ${G.hair}`,
    color: G.mute,
    fontSize: 10,
    letterSpacing: 3,
    padding: "6px 14px",
    cursor: busy ? "default" : "pointer",
    fontFamily: "inherit",
    fontStyle: "italic",
  };
}

function btnSolid(G: typeof GOTHIC, busy: boolean): React.CSSProperties {
  return {
    background: "transparent",
    border: `0.5px solid ${G.accent}`,
    color: G.accent,
    fontSize: 10,
    letterSpacing: 3,
    padding: "6px 14px",
    cursor: busy ? "default" : "pointer",
    fontFamily: "inherit",
    fontStyle: "italic",
  };
}
