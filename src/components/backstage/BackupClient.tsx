"use client";

// /backstage/ops backup panel · advanced 用户区 · 3 个 action:
//   export · 下载全部数据 (IDB + localStorage) 为 JSON
//   import · 加载 JSON 走 merge-skip (同 id 跳过 · 不覆盖)
//   empty  · 清空 IDB (不删 settings)

import { useState } from "react";
import {
  keepsakeStore,
  pieceStore,
  bookStore,
  conceptStore,
  memoStore,
  calendarStore,
  memoryStore,
  chatStore,
  trackStore,
  activeStateStore,
  sleepStore,
  blobStore,
  getAdapter,
} from "@/lib/stores";

const PAYLOAD_VERSION = "kimi-room-v0.6";

type StoreMap = Record<string, () => { get: (id: string) => Promise<unknown>; put: (entry: any) => Promise<any> }>;

const IDB_STORES: StoreMap = {
  keepsake: keepsakeStore,
  piece: pieceStore,
  book: bookStore,
  concept: conceptStore,
  memo: memoStore,
  calendar: calendarStore,
  memory: memoryStore,
  chat: chatStore,
  track: trackStore,
  activeState: activeStateStore,
  sleep: sleepStore,
};

function dumpLocalStorage(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("kimi-")) {
      out[k] = localStorage.getItem(k) ?? "";
    }
  }
  return out;
}

async function buildPayload() {
  const idbRaw = JSON.parse(await getAdapter().exportJSON());
  return {
    version: PAYLOAD_VERSION,
    exportedAt: new Date().toISOString(),
    idb: idbRaw,
    localStorage: dumpLocalStorage(),
  };
}

async function importMergeSkip(payload: {
  idb?: Record<string, unknown[]>;
  localStorage?: Record<string, string>;
}): Promise<{ added: number; skipped: number; lsAdded: number; lsSkipped: number }> {
  let added = 0;
  let skipped = 0;
  let lsAdded = 0;
  let lsSkipped = 0;

  if (payload.idb) {
    for (const [name, items] of Object.entries(payload.idb)) {
      const getStore = IDB_STORES[name];
      if (!getStore || !Array.isArray(items)) continue;
      const store = getStore();
      for (const item of items as Array<{ id?: string }>) {
        if (!item?.id) continue;
        const existing = await store.get(item.id);
        if (existing) {
          skipped++;
          continue;
        }
        await store.put(item);
        added++;
      }
    }

    // Blob store separately (different shape)
    const blobs = (payload.idb as Record<string, unknown>).blob;
    if (Array.isArray(blobs)) {
      const b = blobStore();
      for (const blob of blobs as Array<{ id?: string }>) {
        if (!blob?.id) continue;
        const existing = await b.get(blob.id);
        if (existing) {
          skipped++;
          continue;
        }
        await b.put(blob as Parameters<typeof b.put>[0]);
        added++;
      }
    }
  }

  if (payload.localStorage && typeof localStorage !== "undefined") {
    for (const [k, v] of Object.entries(payload.localStorage)) {
      if (localStorage.getItem(k) === null) {
        localStorage.setItem(k, v);
        lsAdded++;
      } else {
        lsSkipped++;
      }
    }
  }

  return { added, skipped, lsAdded, lsSkipped };
}

export function BackupClient() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  function flash(text: string, tone: "ok" | "err" = "ok") {
    setMsg({ text, tone });
    setTimeout(() => setMsg(null), 4000);
  }

  async function onExport() {
    setBusy(true);
    try {
      const payload = await buildPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kimi-room-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flash("exported · full backup downloaded");
    } catch (err) {
      flash(`export failed · ${(err as Error).message}`, "err");
    } finally {
      setBusy(false);
    }
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const r = await importMergeSkip(payload);
      flash(
        `imported · IDB +${r.added} (skip ${r.skipped}) · localStorage +${r.lsAdded} (skip ${r.lsSkipped})`,
      );
    } catch (err) {
      flash(`import failed · ${(err as Error).message}`, "err");
    } finally {
      setBusy(false);
    }
  }

  async function onEmpty() {
    if (
      !confirm(
        "清空 IDB · 所有 keepsakes / memory / calendar / 等 删 · 不影响 settings · 不可逆.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await getAdapter().empty();
      flash("emptied · IDB cleared");
    } catch (err) {
      flash(`empty failed · ${(err as Error).message}`, "err");
    } finally {
      setBusy(false);
    }
  }

  const btnCls =
    "px-4 py-2 border border-muted-gold/40 text-[11px] tracking-[0.25em] uppercase text-muted-gold hover:border-muted-gold hover:bg-muted-gold/5 transition disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <section className="border border-muted-gold/20 rounded p-5 bg-black/20">
      <h2 className="text-muted-gold text-xs tracking-[0.3em] uppercase">
        backup
      </h2>
      <p className="mt-2 text-[10px] italic text-muted-grey">
        export / import / empty · IDB + localStorage
      </p>
      <p className="mt-3 text-[10px] text-muted-grey/70 leading-relaxed">
        export 下载 JSON · 含 12 store + 全部 kimi-* localStorage key.
        import 走 merge-skip (同 id 跳过 · 不覆盖). empty 清 IDB · settings 不动.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          className={btnCls}
        >
          export json
        </button>
        <label className={`${btnCls} cursor-pointer ${busy ? "pointer-events-none" : ""}`}>
          <input
            type="file"
            accept="application/json"
            onChange={onImport}
            disabled={busy}
            className="hidden"
          />
          import json
        </label>
        <button
          type="button"
          onClick={onEmpty}
          disabled={busy}
          className={btnCls}
        >
          empty all
        </button>
      </div>
      {msg && (
        <div
          className={`mt-4 text-[10px] tracking-widest ${
            msg.tone === "ok" ? "text-muted-gold" : "text-red-400"
          }`}
        >
          {msg.text}
        </div>
      )}
    </section>
  );
}
