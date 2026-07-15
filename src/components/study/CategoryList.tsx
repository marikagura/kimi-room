"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { KimiPalette } from "@/lib/kimi-palettes";
import { pieceStore } from "@/lib/stores";
import type { PieceEntry } from "@/lib/stores/types";

// V2 study generic user-named categories · owner 0518 ack '全 custom · 自由起名'.
// localStorage["kimi-study-categories"] = string[] persist user-added category
// names (canon V1 hardcode '短篇合集 / 思想锚 / 反应留痕', V2 全 user choose).
// 每条 → /room/study/c/<encoded> sub-page (CategoryClient · pieceStore filter).

const STORAGE_KEY = "kimi-study-categories";
const FOX_KEY = "kimi-study-fox-categories";

const FONT_STACK =
  'var(--font-serif)';

function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveCategories(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

function loadFoxCategories(): string[] {
  try {
    const raw = localStorage.getItem(FOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveFoxCategories(list: string[]) {
  try {
    localStorage.setItem(FOX_KEY, JSON.stringify(list));
  } catch {}
}

export function CategoryList({ P }: { P: KimiPalette }) {
  const [cats, setCats] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [foxCats, setFoxCats] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  async function refreshCounts(list: string[]) {
    const all = (await pieceStore().list()) as PieceEntry[];
    const next: Record<string, number> = {};
    for (const c of list) {
      next[c] = all.filter((p) => p.tags?.[0] === c).length;
    }
    setCounts(next);
  }

  function toggleFox(name: string) {
    const next = foxCats.includes(name)
      ? foxCats.filter((c) => c !== name)
      : [...foxCats, name];
    setFoxCats(next);
    saveFoxCategories(next);
  }

  useEffect(() => {
    const list = loadCategories();
    setCats(list);
    setFoxCats(loadFoxCategories());
    void refreshCounts(list);
  }, []);

  function addCategory() {
    const name = draft.trim();
    if (!name) return;
    if (cats.includes(name)) {
      alert(`「${name}」已存在`);
      return;
    }
    const next = [...cats, name];
    setCats(next);
    saveCategories(next);
    setDraft("");
    setAdding(false);
    void refreshCounts(next);
  }

  async function removeCategory(name: string) {
    if (
      !confirm(`删除分类「${name}」? (条目不删, 标签 orphan)`)
    )
      return;
    const next = cats.filter((c) => c !== name);
    setCats(next);
    saveCategories(next);
    void refreshCounts(next);
  }

  return (
    <div style={{ padding: "22px 22px 40px" }}>
      <div
        style={{
          fontSize: 9,
          letterSpacing: 3,
          color: P.accent,
          marginBottom: 10,
        }}
      >
        · CATEGORIES
      </div>

      {cats.length === 0 ? null : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cats.map((c) => {
            const count = counts[c] ?? 0;
            const slug = encodeURIComponent(c);
            return (
              <div
                key={c}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                }}
              >
                <Link
                  href={`/room/study/c/${slug}`}
                  style={{
                    flex: 1,
                    padding: "14px 16px",
                    background: P.softAccent,
                    borderLeft: `2px solid ${P.accent}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    color: P.ink,
                    textDecoration: "none",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 17,
                        fontFamily: FONT_STACK,
                        color: P.ink,
                        letterSpacing: 1,
                      }}
                    >
                      {c}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: P.mute,
                        fontStyle: "italic",
                        marginTop: 3,
                      }}
                    >
                      {count} 条 →
                      {foxCats.includes(c) && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 9,
                            letterSpacing: 2,
                            color: P.accent,
                            fontStyle: "italic",
                            textTransform: "uppercase",
                          }}
                        >
                          · 共读 on
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      color: P.accent,
                      fontStyle: "italic",
                    }}
                  >
                    →
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => toggleFox(c)}
                  aria-label={`toggle fox · ${c}`}
                  title={
                    foxCats.includes(c)
                      ? "关闭 共读 · LLM 读后感"
                      : "开启 共读 · 每条 entry 可 tap 小狐狸 听 LLM 想法"
                  }
                  style={{
                    width: 30,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: foxCats.includes(c) ? 1 : 0.3,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/icons/fox-bw-sit.png"
                    alt=""
                    width={16}
                    height={16}
                    style={{
                      objectFit: "contain",
                      filter: P.ink.startsWith("#1") ? "none" : "invert(1)",
                    }}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => removeCategory(c)}
                  aria-label={`delete ${c}`}
                  style={{
                    width: 24,
                    fontSize: 10,
                    background: "transparent",
                    border: "none",
                    color: P.mute,
                    cursor: "pointer",
                    opacity: 0.4,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <input
            type="text"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              } else if (e.key === "Escape") {
                setAdding(false);
                setDraft("");
              }
            }}
            placeholder="category name"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              borderBottom: `0.5px solid ${P.accent}`,
              padding: "6px 2px",
              color: P.ink,
              fontSize: 14,
              fontFamily: FONT_STACK,
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={addCategory}
            disabled={!draft.trim()}
            style={{
              fontSize: 10,
              letterSpacing: 3,
              padding: "6px 14px",
              border: `0.5px solid ${P.accent}`,
              background: `${P.accent}1a`,
              color: P.accent,
              cursor: "pointer",
              fontFamily: FONT_STACK,
              fontStyle: "italic",
              opacity: draft.trim() ? 1 : 0.4,
            }}
          >
            add
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            marginTop: 14,
            fontSize: 10,
            letterSpacing: 3,
            padding: "8px 14px",
            border: `0.4px solid ${P.hair}`,
            background: "transparent",
            color: P.mute,
            cursor: "pointer",
            fontFamily: FONT_STACK,
            fontStyle: "italic",
          }}
        >
          ＋ category
        </button>
      )}
    </div>
  );
}
