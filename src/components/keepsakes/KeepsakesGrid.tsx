"use client";

// V2 KeepsakesGrid · canon TasteGrid 156-line restored ·
// 走 keepsakeStore IDB 替 canon /api/taste/cards. 6 default seed (canon)
// 渲 colored gradient blocks placeholder → 用户 tap upload 后 photo 替.
// add "+ add postcard" button 加 第 7+ card.

import { useCallback, useEffect, useState } from "react";
import { KeepsakeCard, type KeepsakeSeed } from "@/components/keepsakes/KeepsakeCard";
import { keepsakeStore } from "@/lib/stores";
import type { KimiPalette } from "@/lib/kimi-palettes";

const COLORS = [
  "#b8814a",
  "#c9a37a",
  "#e8c9a6",
  "#d9a57a",
  "#8fa388",
  "#9a7652",
  "#a87c5a",
  "#cdb38a",
];

const DEFAULT_SEEDS: KeepsakeSeed[] = [
  { id: "keepsake-1", color: COLORS[0], title: "", place: "", record: "", note: "" },
  { id: "keepsake-2", color: COLORS[1], title: "", place: "", record: "", note: "" },
  { id: "keepsake-3", color: COLORS[2], title: "", place: "", record: "", note: "" },
  { id: "keepsake-4", color: COLORS[3], title: "", place: "", record: "", note: "" },
  { id: "keepsake-5", color: COLORS[4], title: "", place: "", record: "", note: "" },
  { id: "keepsake-6", color: COLORS[5], title: "", place: "", record: "", note: "" },
];

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `keepsake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function KeepsakesGrid({ P, isDay = false }: { P: KimiPalette; isDay?: boolean }) {
  const [seeds, setSeeds] = useState<KeepsakeSeed[]>(DEFAULT_SEEDS);

  const hydrate = useCallback(async () => {
    const rows = await keepsakeStore().list();
    if (rows.length === 0) {
      setSeeds(DEFAULT_SEEDS);
      return;
    }
    const ids = rows.map((r) => r.id);
    // 保 default 6 seed 顺序 + 后续 user-added 顺序
    const knownIds = new Set(DEFAULT_SEEDS.map((s) => s.id));
    const extra = ids.filter((id) => !knownIds.has(id));
    const merged: KeepsakeSeed[] = [
      ...DEFAULT_SEEDS,
      ...extra.map((id, i) => ({
        id,
        color: COLORS[(DEFAULT_SEEDS.length + i) % COLORS.length],
        title: "",
        place: "",
        record: "",
        note: "",
      })),
    ];
    setSeeds(merged);
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  function addCard() {
    const id = makeId();
    const color = COLORS[seeds.length % COLORS.length];
    const next: KeepsakeSeed = { id, color, title: "", place: "", record: "", note: "" };
    setSeeds((prev) => [...prev, next]);
    void keepsakeStore().put({ id, tags: [] });
  }

  return (
    <>
      <div
        style={{
          padding: "14px 16px 0",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {seeds.map((s) => (
          <KeepsakeCard key={s.id} seed={s} P={P} isDay={isDay} />
        ))}
      </div>

      <div
        style={{
          padding: "20px 16px 0",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={addCard}
          aria-label="Add a new postcard"
          style={{
            background: "transparent",
            border: `0.6px dashed ${P.accent}`,
            color: P.accent,
            fontFamily: 'var(--font-serif)',
            fontStyle: "italic",
            letterSpacing: 3,
            fontSize: 11,
            padding: "8px 26px",
            borderRadius: 4,
            cursor: "pointer",
            opacity: 0.85,
          }}
        >
          + add postcard
        </button>
      </div>
    </>
  );
}
