"use client";

import { useEffect, useState } from "react";
import type { KimiPalette } from "@/lib/kimi-palettes";
import { keepsakeStore, blobStore } from "@/lib/stores";
import type { KeepsakeEntry } from "@/lib/stores/types";

// V2 keepsakes debug · IDB-driven · canon TasteDebug (localStorage) ported.
// 显示 keepsakeStore 内全 entry · per-entry photoBlob 大小 + 总大小.
// 配 KeepsakesSyncButton bottom-of-page collapsed debug surface.

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

type Row = {
  id: string;
  title?: string;
  place?: string;
  record?: string;
  note?: string;
  photoSize: number;
  totalSize: number;
};

export function KeepsakesDebug({ P }: { P: KimiPalette }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [totalSize, setTotalSize] = useState(0);

  async function reload() {
    try {
      const entries = await keepsakeStore().list();
      const out: Row[] = [];
      let sum = 0;
      for (const e of entries as KeepsakeEntry[]) {
        let photoSize = 0;
        if (e.photoBlobId) {
          const b = await blobStore().get(e.photoBlobId);
          if (b?.base64) photoSize = b.base64.length;
        } else if (e.photo) {
          photoSize = new Blob([e.photo]).size;
        }
        const meta = new Blob([JSON.stringify(e)]).size;
        const total = photoSize + meta;
        sum += total;
        out.push({
          id: e.id,
          title: e.title ?? undefined,
          place: e.place ?? undefined,
          record: e.record ?? undefined,
          note: e.note ?? undefined,
          photoSize,
          totalSize: total,
        });
      }
      out.sort((a, b) => a.id.localeCompare(b.id));
      setRows(out);
      setTotalSize(sum);
    } catch {
      setRows([]);
      setTotalSize(0);
    }
  }

  useEffect(() => {
    if (open) void reload();
  }, [open]);

  async function clearAll() {
    if (!confirm("清空所有 keepsakes? 这步不可撤销.")) return;
    const entries = await keepsakeStore().list();
    for (const e of entries) await keepsakeStore().delete(e.id);
    await reload();
  }

  return (
    <div style={{ padding: "20px 16px 0" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "8px 12px",
          fontSize: 10,
          letterSpacing: 3,
          color: P.mute,
          background: "transparent",
          border: `0.4px solid ${P.hair}`,
          fontStyle: "italic",
          fontFamily: 'var(--font-serif)',
          cursor: "pointer",
        }}
      >
        {open ? "▼" : "▶"} debug · IDB 状态
      </button>

      {open && (
        <div
          style={{
            marginTop: 8,
            padding: "12px 14px",
            background: P.softAccent,
            border: `0.4px solid ${P.hair}`,
            fontSize: 10,
            color: P.ink,
            fontFamily: 'var(--font-mono)',
            lineHeight: 1.5,
          }}
        >
          <div style={{ marginBottom: 6, color: P.accent, fontStyle: "italic" }}>
            keepsake · 总大小 {fmtBytes(totalSize)} · {rows.length} 条
          </div>
          {rows.length === 0 ? (
            <div style={{ color: P.mute, fontStyle: "italic" }}>
              (空 — IDB 没数据)
            </div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                style={{
                  paddingTop: 6,
                  borderTop: `0.3px solid ${P.hair}`,
                  marginTop: 6,
                }}
              >
                <div style={{ color: P.accent }}>{r.id}</div>
                <div style={{ color: P.mute }}>
                  photo: {r.photoSize ? `✓ ${fmtBytes(r.photoSize)}` : "—"} ·{" "}
                  title: {r.title ? `"${r.title.slice(0, 20)}"` : "—"} ·{" "}
                  place: {r.place ? `"${r.place.slice(0, 20)}"` : "—"}
                </div>
                <div style={{ color: P.mute }}>
                  record: {r.record ? `"${r.record.slice(0, 30)}"` : "—"} ·{" "}
                  note: {r.note ? `"${r.note.slice(0, 30)}"` : "—"}
                </div>
              </div>
            ))
          )}
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => void reload()}
              style={{
                fontSize: 9,
                padding: "4px 10px",
                border: `0.4px solid ${P.accent}`,
                background: "transparent",
                color: P.accent,
                fontFamily: "inherit",
                cursor: "pointer",
                letterSpacing: 1,
              }}
            >
              ↻ refresh
            </button>
            <button
              type="button"
              onClick={() => void clearAll()}
              style={{
                fontSize: 9,
                padding: "4px 10px",
                border: `0.4px solid ${P.mute}`,
                background: "transparent",
                color: P.mute,
                fontFamily: "inherit",
                cursor: "pointer",
                letterSpacing: 1,
              }}
            >
              ✕ clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
