"use client";

import { useEffect, useState } from "react";
import { ExportLocalStorageButton } from "@/components/ExportLocalStorageButton";
import type { KimiPalette } from "@/lib/kimi-palettes";
import { getAdapter, keepsakeStore } from "@/lib/stores";

// V2 keepsakes sync · canon TasteSyncButton (POST /api/taste/sync to Prisma)
// adapted for V2. V2 ship IDB-default · "sync" semantics:
//   - 默认 IDB local · "synced" = IDB write success (timestamp 标 last sync)
//   - 用户 fork 接 NotionAdapter / SupabaseAdapter / 等 · "sync" 走 adapter
// localStorage["kimi-web:keepsakes:lastSync"] persist timestamp 给 UI show.
//
// future: adapter contract 加 `pushAll()` hook · 自动 sync to cloud.

const LAST_SYNC_KEY = "kimi-web:keepsakes:lastSync";

function formatSync(iso: string): string {
  try {
    const d = new Date(iso);
    const jst = new Date(d.getTime() + 9 * 3600 * 1000);
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const day = String(jst.getUTCDate()).padStart(2, "0");
    const hh = String(jst.getUTCHours()).padStart(2, "0");
    const mm = String(jst.getUTCMinutes()).padStart(2, "0");
    return `${m}.${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

export function KeepsakesSyncButton({ P }: { P: KimiPalette }) {
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_SYNC_KEY);
      if (last) setLastSync(last);
    } catch {}
  }, []);

  async function sync() {
    if (busy) return;
    setBusy(true);
    try {
      // Force a list call on adapter — for cloud adapter (Notion/Supabase) this
      // re-flushes pending writes; for IDB this is essentially a no-op verify.
      await keepsakeStore().list();
      // Adapter-level export for snapshot baseline (cheap for IDB, also acts
      // as 'pull' for cloud adapter implementations that re-cache locally).
      await getAdapter().exportJSON();
      const iso = new Date().toISOString();
      setLastSync(iso);
      try {
        localStorage.setItem(LAST_SYNC_KEY, iso);
      } catch {}
    } catch (e) {
      console.error("[keepsakes-sync]", e);
      alert("Archive failed, try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        padding: "16px 16px 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: P.mute,
          fontStyle: "italic",
          fontFamily: 'var(--font-serif)',
          letterSpacing: 1,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {lastSync ? `Last archive · ${formatSync(lastSync)}` : "Not archived yet"}
        <ExportLocalStorageButton
          keys={[LAST_SYNC_KEY]}
          filename="kimi-keepsakes-sync"
          color={P.mute}
          fontFamily='var(--font-serif)'
        />
      </span>
      <button
        type="button"
        onClick={() => void sync()}
        disabled={busy}
        style={{
          fontSize: 10,
          letterSpacing: 3,
          padding: "6px 16px",
          borderRadius: 4,
          border: `0.6px solid ${P.accent}`,
          background: `${P.accent}1a`,
          color: P.accent,
          cursor: busy ? "wait" : "pointer",
          fontFamily: 'var(--font-serif)',
          textTransform: "uppercase",
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy ? "Syncing…" : "↓ Archive to db"}
      </button>
    </div>
  );
}
