"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { KimiPalette } from "@/lib/kimi-palettes";
import { bookStore } from "@/lib/stores";
import type { BookEntry } from "@/lib/stores/types";
import { BOOKS as STATIC_SEED } from "@/lib/reading-data";

// V2 study bookshelf · owner 0518 ack:
//   - tap spine → inline edit (title / author / status / spineColor / height)
//   - tap '8 本·在读 N' count → 加新书 form
//   - 首次 launch IDB 空 → render canon-palette static seed (8 colored
//     placeholders) · 用户 tap 后 first-edit hydrate seed → IDB persist
//
// owner 0517 1116 catch: study CONCEPTS + MEMO sub-page link 删 · 留 READING
// only · 加 inline edit (manual input toggle) 替 sub-page link 流.

const FONT_STACK =
  'var(--font-serif)';

const STATUS_OPTIONS: BookEntry["status"][] = ["want", "reading", "read", "abandoned"];

type RenderBook = {
  id: string;        // IDB id OR static slug
  title?: string;
  author?: string;
  status: BookEntry["status"];
  spineColor: string;
  spineLabel: string;
  height: number;
  fromSeed: boolean; // true if not yet IDB-persisted
};

function statusToReadingFlag(s: BookEntry["status"]): boolean {
  return s === "reading";
}

function seedToRender(b: (typeof STATIC_SEED)[number]): RenderBook {
  return {
    id: b.slug,
    title: b.title || undefined,
    author: b.author || undefined,
    status: (b.status === "reading" ? "reading" : "want") as BookEntry["status"],
    spineColor: b.spineColor,
    spineLabel: b.spineLabel,
    height: b.height,
    fromSeed: true,
  };
}

function entryToRender(e: BookEntry, seedIdx: number): RenderBook {
  const seed = STATIC_SEED[seedIdx];
  return {
    id: e.id,
    title: e.title,
    author: e.author,
    status: e.status,
    spineColor: e.spineColor ?? seed?.spineColor ?? "#8a6558",
    spineLabel: e.spineLabel ?? "",
    height: e.height ?? seed?.height ?? 110,
    fromSeed: false,
  };
}

export function BookShelf({ P }: { P: KimiPalette }) {
  const [books, setBooks] = useState<RenderBook[]>(STATIC_SEED.map(seedToRender));
  const [editing, setEditing] = useState<RenderBook | null>(null);
  const [adding, setAdding] = useState(false);
  const [busyImport, setBusyImport] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const SEED_PALETTE = STATIC_SEED.map((s) => s.spineColor);
  const SEED_HEIGHTS = STATIC_SEED.map((s) => s.height);

  async function importFile(file: File) {
    setBusyImport(true);
    try {
      const text = await file.text();
      const ext = file.name.toLowerCase().split(".").pop();
      const all = (await bookStore().list()) as BookEntry[];
      const seedIdx = all.length % SEED_PALETTE.length;
      if (ext === "json") {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        for (const [i, item] of arr.entries()) {
          const idx = (seedIdx + i) % SEED_PALETTE.length;
          const it = item as {
            title?: string;
            author?: string;
            notes?: string;
            body?: string;
            content?: string;
            text?: string;
            status?: BookEntry["status"];
            spineColor?: string;
            spineLabel?: string;
            height?: number;
          };
          await bookStore().put({
            title: it.title?.trim() || file.name.replace(/\.\w+$/, ""),
            author: it.author,
            notes: it.notes ?? it.body ?? it.content ?? it.text ?? "",
            status: it.status ?? "want",
            spineColor: it.spineColor ?? SEED_PALETTE[idx],
            spineLabel: it.spineLabel ?? "",
            height: it.height ?? SEED_HEIGHTS[idx],
          });
        }
      } else {
        await bookStore().put({
          title: file.name.replace(/\.\w+$/, ""),
          notes: text,
          status: "want",
          spineColor: SEED_PALETTE[seedIdx],
          spineLabel: "",
          height: SEED_HEIGHTS[seedIdx],
        });
      }
      await reload();
    } catch (e) {
      alert(`import failed · ${(e as Error).message}`);
    } finally {
      setBusyImport(false);
    }
  }

  async function reload() {
    const all = (await bookStore().list()) as BookEntry[];
    if (all.length === 0) {
      setBooks(STATIC_SEED.map(seedToRender));
    } else {
      const sorted = [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      setBooks(sorted.map((e, i) => entryToRender(e, i)));
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const readingCount = books.filter((b) => statusToReadingFlag(b.status)).length;

  async function save(form: Partial<RenderBook> & { id?: string }) {
    const payload: Partial<BookEntry> = {
      title: form.title ?? "",
      author: form.author,
      status: (form.status ?? "want") as BookEntry["status"],
      spineColor: form.spineColor,
      spineLabel: form.spineLabel,
      height: form.height,
    };
    if (form.id && !form.id.startsWith("placeholder-")) {
      payload.id = form.id;
    }
    await bookStore().put(payload);
    await reload();
  }

  async function remove(id: string) {
    if (id.startsWith("placeholder-")) {
      // seed-only entry · 持久化 empty book 让它 disappear (delete fallback
      // doesn't really apply, but easy path: just refresh)
      return;
    }
    if (!confirm("删这本书?")) return;
    await bookStore().delete(id);
    await reload();
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 4,
          alignItems: "flex-end",
          height: 140,
          marginTop: 8,
          flexWrap: "wrap",
        }}
      >
        {books.map((b) => (
          <div
            key={b.id}
            style={{
              position: "relative",
              flexShrink: 0,
            }}
          >
            <Link
              href={`/room/study/reading/${encodeURIComponent(b.id)}`}
              style={{
                display: "block",
                width: 30,
                height: b.height,
                background: b.spineColor,
                color: "#fff",
                writingMode: "vertical-rl",
                textOrientation: "upright",
                fontSize: 10,
                letterSpacing: 2,
                padding: "10px 6px",
                fontFamily: FONT_STACK,
                textAlign: "left",
                boxShadow:
                  "inset 1px 0 rgba(255,255,255,0.18), inset -1px 0 rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.4)",
                textDecoration: "none",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
              aria-label={`read ${b.title || b.spineLabel || b.id}`}
            >
              {b.spineLabel || b.title?.slice(0, 6) || ""}
            </Link>
            <button
              type="button"
              onClick={() => setEditing(b)}
              aria-label={`edit ${b.title || b.id}`}
              style={{
                position: "absolute",
                top: -8,
                right: -4,
                width: 16,
                height: 16,
                borderRadius: 99,
                border: `0.5px solid ${P.hair}`,
                background: P.paper,
                color: P.accent,
                fontSize: 9,
                lineHeight: 1,
                cursor: "pointer",
                fontFamily: FONT_STACK,
              }}
            >
              ✎
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            fontSize: 9,
            color: P.mute,
            fontStyle: "italic",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {books.length} 本 · 在读 {readingCount} · tap 加新书
        </button>
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          disabled={busyImport}
          style={{
            fontSize: 9,
            color: P.accent,
            fontStyle: "italic",
            background: "transparent",
            border: `0.4px solid ${P.accent}`,
            padding: "3px 8px",
            cursor: "pointer",
            fontFamily: "inherit",
            letterSpacing: 1,
          }}
        >
          {busyImport ? "..." : "↑ import txt/md/json"}
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".txt,.md,.json,text/plain,text/markdown,application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void importFile(f);
          }}
        />
      </div>

      {editing && (
        <BookForm
          P={P}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (form) => {
            await save({ ...editing, ...form });
            setEditing(null);
          }}
          onDelete={async () => {
            await remove(editing.id);
            setEditing(null);
          }}
        />
      )}

      {adding && (
        <BookForm
          P={P}
          initial={{
            id: "",
            title: "",
            author: "",
            status: "want",
            spineColor: "#8a6558",
            spineLabel: "",
            height: 110,
            fromSeed: false,
          }}
          onClose={() => setAdding(false)}
          onSave={async (form) => {
            await save(form);
            setAdding(false);
          }}
        />
      )}
    </>
  );
}

function BookForm({
  P,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  P: KimiPalette;
  initial: RenderBook;
  onClose: () => void;
  onSave: (form: Partial<RenderBook>) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [author, setAuthor] = useState(initial.author ?? "");
  const [status, setStatus] = useState<BookEntry["status"]>(initial.status);
  const [spineColor, setSpineColor] = useState(initial.spineColor);
  const [spineLabel, setSpineLabel] = useState(initial.spineLabel);
  const [height, setHeight] = useState(initial.height);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    await onSave({ title, author, status, spineColor, spineLabel, height });
    setBusy(false);
  }

  const inputStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    borderBottom: `0.5px solid ${P.hair}`,
    padding: "6px 2px",
    color: P.ink,
    fontSize: 14,
    fontFamily: FONT_STACK,
    outline: "none",
    width: "100%",
  };

  return (
    <div
      role="dialog"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: P.paper,
          color: P.ink,
          padding: "22px 22px 28px",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          fontFamily: FONT_STACK,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: 4,
            color: P.accent,
            marginBottom: 14,
            fontStyle: "italic",
          }}
        >
          {initial.title ? `edit · ${initial.title.slice(0, 24)}` : "新书"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 9, letterSpacing: 2, color: P.mute }}>书名</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 9, letterSpacing: 2, color: P.mute }}>作者</span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 9, letterSpacing: 2, color: P.mute }}>书脊 label (短)</span>
            <input
              value={spineLabel}
              onChange={(e) => setSpineLabel(e.target.value)}
              maxLength={12}
              style={inputStyle}
            />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 9, letterSpacing: 2, color: P.mute }}>颜色</span>
              <input
                type="color"
                value={spineColor}
                onChange={(e) => setSpineColor(e.target.value)}
                style={{
                  width: "100%",
                  height: 32,
                  border: `0.5px solid ${P.hair}`,
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            </label>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 9, letterSpacing: 2, color: P.mute }}>高度 96-140</span>
              <input
                type="number"
                value={height}
                min={96}
                max={140}
                onChange={(e) => setHeight(parseInt(e.target.value, 10) || 110)}
                style={inputStyle}
              />
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 9, letterSpacing: 2, color: P.mute }}>状态</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {STATUS_OPTIONS.map((s) => {
                const sel = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    style={{
                      fontSize: 10,
                      letterSpacing: 2,
                      padding: "4px 12px",
                      borderRadius: 99,
                      border: `0.6px solid ${sel ? P.accent : P.hair}`,
                      background: sel ? `${P.accent}1c` : "transparent",
                      color: sel ? P.accent : P.mute,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontStyle: "italic",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 20,
          }}
        >
          <div>
            {onDelete && !initial.fromSeed && (
              <button
                type="button"
                onClick={onDelete}
                style={{
                  fontSize: 10,
                  color: P.mute,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontStyle: "italic",
                  letterSpacing: 2,
                }}
              >
                删
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                fontSize: 10,
                letterSpacing: 3,
                padding: "6px 14px",
                border: `0.4px solid ${P.hair}`,
                background: "transparent",
                color: P.mute,
                cursor: "pointer",
                fontFamily: "inherit",
                fontStyle: "italic",
              }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              style={{
                fontSize: 10,
                letterSpacing: 3,
                padding: "6px 14px",
                border: `0.5px solid ${P.accent}`,
                background: `${P.accent}1a`,
                color: P.accent,
                cursor: busy ? "wait" : "pointer",
                fontFamily: "inherit",
                fontStyle: "italic",
              }}
            >
              {busy ? "..." : "存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
