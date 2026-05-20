"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { KimiPalette } from "@/lib/kimi-palettes";
import { bookStore } from "@/lib/stores";
import type { BookEntry } from "@/lib/stores/types";
import { BOOKS as STATIC_SEED } from "@/lib/reading-data";
import { friendlyLLMError, isLLMConfigured, llmGenerate } from "@/lib/llm-client";
import { buildCharacterContext } from "@/lib/system-prompt";
import { getCharName, tmpl } from "@/lib/template";

// V2 book detail · IDB-backed · canon long-form reading + pagination + LLM
// 读后感 (owner 0518 共读). 一页 ~700 字 · prev/next 翻页 · tap 小狐狸 expand
// 读后感 inline · retry button regen.

const FONT_STACK =
  '"Cormorant Garamond", "Noto Serif SC", "Songti SC", "STSong", serif';

const STATUS_LABEL: Record<string, string> = {
  reading: "READING",
  want: "WISHLIST",
  read: "READ",
  abandoned: "ABANDONED",
};

const PAGE_SIZE = 700; // 500-1000 字 default · owner 0518 pick

type View = {
  id: string;
  title: string;
  author?: string;
  status: string;
  spineColor: string;
  spineLabel: string;
  height: number;
  notes: string;
  aiReflections: Record<string, string>;
  fromSeed: boolean;
};

function mapSeedStatus(s: string): string {
  if (s === "reading") return "reading";
  if (s === "wishlist") return "want";
  return "read";
}

function seedView(slug: string): View | null {
  const s = STATIC_SEED.find((b) => b.slug === slug);
  if (!s) return null;
  return {
    id: s.slug,
    title: s.title || "",
    author: s.author,
    status: mapSeedStatus(s.status),
    spineColor: s.spineColor,
    spineLabel: s.spineLabel,
    height: s.height,
    notes: "",
    aiReflections: {},
    fromSeed: true,
  };
}

function entryView(e: BookEntry): View {
  return {
    id: e.id,
    title: e.title,
    author: e.author,
    status: e.status,
    spineColor: e.spineColor ?? "#8a6558",
    spineLabel: e.spineLabel ?? "",
    height: e.height ?? 110,
    notes: e.notes ?? "",
    aiReflections: e.aiReflections ?? {},
    fromSeed: false,
  };
}

function paginate(text: string, size: number): string[] {
  if (!text || !text.trim()) return [];
  const pages: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(text.length, i + size);
    // round to nearest sentence/paragraph boundary backward (up to 100 chars)
    if (end < text.length) {
      const slice = text.slice(i, end);
      const match = slice.match(/[。！？\n.!?][^。！？\n.!?]{0,80}$/);
      if (match && match.index !== undefined && match.index > size * 0.6) {
        end = i + match.index + 1;
      }
    }
    pages.push(text.slice(i, end).trim());
    i = end;
  }
  return pages;
}

export function BookDetailClient({
  P,
  bookId,
}: {
  P: KimiPalette;
  bookId: string;
}) {
  const [view, setView] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageIdx, setPageIdx] = useState(0);
  const [foxOpen, setFoxOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const e = await bookStore().get(bookId);
      if (e) {
        setView(entryView(e as BookEntry));
      } else {
        setView(seedView(bookId));
      }
      setLoading(false);
    })();
  }, [bookId]);

  const pages = useMemo(
    () => paginate(view?.notes ?? "", PAGE_SIZE),
    [view?.notes],
  );
  const currentPage = pages[pageIdx] ?? "";
  const totalPages = pages.length;
  const reflection = view?.aiReflections?.[String(pageIdx)] ?? "";

  async function generateReflection(force = false) {
    if (busy || !view || !currentPage) return;
    if (reflection && !force) return; // already have one · use retry to force
    if (!isLLMConfigured()) {
      alert("LLM 未配 · settings 填 endpoint + key");
      return;
    }
    setBusy(true);
    try {
      const cn = getCharName();
      // Uses /backstage/settings SP + memory injection as base · adds
      // book-reading-together specific instruction on top.
      const system = await buildCharacterContext(
        "你跟用户在一起读这本书. 你刚读完这一页, 用 200-400 字, 第一人称, 你的视角/性格, 写一段读后感. 不客观总结 · 不列要点 · 不 emoji · 不 markdown header · 一段 prose.",
      );
      const prompt = `[书名] ${view.title}\n${view.author ? `[作者] ${view.author}\n` : ""}[第 ${pageIdx + 1} / ${totalPages} 页 内容]\n${currentPage}\n\n请用 ${cn} 的视角写一段读后感.`;
      const text = await llmGenerate(prompt, system, {
        temperature: 0.85,
        maxTokens: 600,
      });
      if (text) {
        const nextRefs = { ...(view.aiReflections ?? {}), [String(pageIdx)]: text };
        const updated = { ...view, aiReflections: nextRefs };
        setView(updated);
        // persist
        if (!view.fromSeed) {
          await bookStore().put({
            id: view.id,
            aiReflections: nextRefs,
          });
        }
      }
    } catch (e) {
      const fe = friendlyLLMError(e);
      alert(`${fe.title} · ${fe.hint}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          padding: "60px 24px",
          textAlign: "center",
          fontSize: 11,
          color: P.mute,
          fontStyle: "italic",
        }}
      >
        loading…
      </div>
    );
  }

  if (!view) {
    return (
      <div
        style={{
          padding: "60px 24px",
          textAlign: "center",
          fontSize: 11,
          color: P.mute,
          fontFamily: FONT_STACK,
        }}
      >
        <div style={{ fontSize: 22, color: P.ink, marginBottom: 10, fontStyle: "italic" }}>
          (找不到)
        </div>
        <Link
          href="/room/study"
          style={{ color: P.accent, fontStyle: "italic", textDecoration: "none" }}
        >
          ← 书桌
        </Link>
      </div>
    );
  }

  const titleText = view.title || view.spineLabel || "(无标题)";

  return (
    <>
      <div style={{ padding: "12px 24px 0" }}>
        {/* spine + meta */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-end" }}>
          <div
            style={{
              width: 52,
              height: Math.max(160, view.height * 1.6),
              background: view.spineColor,
              color: "#fff",
              writingMode: "vertical-rl",
              textOrientation: "upright",
              fontSize: 12,
              letterSpacing: 2,
              padding: "14px 8px",
              fontFamily: FONT_STACK,
              fontStyle: "italic",
              boxShadow:
                "inset 1px 0 rgba(255,255,255,0.18), inset -1px 0 rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            {view.spineLabel}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 9,
                letterSpacing: 3,
                color: P.accent,
                fontStyle: "italic",
              }}
            >
              {STATUS_LABEL[view.status] ?? view.status.toUpperCase()}
            </div>
            <div
              style={{
                fontSize: 22,
                color: P.ink,
                fontFamily: FONT_STACK,
                marginTop: 6,
                lineHeight: 1.25,
              }}
            >
              {titleText}
            </div>
            {view.author && (
              <div
                style={{
                  fontSize: 11,
                  color: P.accent,
                  fontStyle: "italic",
                  marginTop: 8,
                  fontFamily: FONT_STACK,
                }}
              >
                {view.author}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* paginated content */}
      {totalPages > 0 ? (
        <div style={{ padding: "22px 24px 0" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 9, letterSpacing: 3, color: P.accent }}>
              · 内容
            </div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: P.mute, fontStyle: "italic" }}>
              {pageIdx + 1} / {totalPages}
            </div>
          </div>

          <pre
            style={{
              fontSize: 13,
              color: P.ink,
              fontFamily: FONT_STACK,
              lineHeight: 1.85,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
              padding: "10px 0 0",
              maxWidth: "36em",
            }}
          >
            {currentPage}
          </pre>

          {/* fox 小狐狸 inline · tap expand reflection */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 18,
              paddingTop: 14,
              borderTop: `0.4px solid ${P.hair}`,
            }}
          >
            <button
              type="button"
              onClick={() => setFoxOpen((v) => !v)}
              aria-label="toggle reflection"
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/fox-bw-sit.png"
                alt="fox"
                width={20}
                height={20}
                style={{
                  objectFit: "contain",
                  flexShrink: 0,
                  opacity: foxOpen ? 1 : 0.6,
                  filter: P.ink.startsWith("#1") ? "none" : "invert(1)",
                  transition: "opacity 200ms",
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: 2,
                  color: foxOpen ? P.accent : P.mute,
                  fontStyle: "italic",
                  fontFamily: FONT_STACK,
                  textTransform: "uppercase",
                }}
              >
                {foxOpen ? "▼ 收起" : "▶ 听听他在想什么"}
              </span>
            </button>
          </div>

          {foxOpen && (
            <div
              style={{
                marginTop: 10,
                padding: "14px 16px",
                background: P.softAccent,
                borderLeft: `2px solid ${P.accent}`,
                fontFamily: FONT_STACK,
              }}
            >
              {busy && !reflection ? (
                <div style={{ fontSize: 11, color: P.mute, fontStyle: "italic" }}>
                  · 读着 …
                </div>
              ) : reflection ? (
                <>
                  <div
                    style={{
                      fontSize: 13,
                      color: P.ink,
                      lineHeight: 1.8,
                      fontStyle: "italic",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {reflection}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 14,
                      paddingTop: 8,
                      borderTop: `0.3px solid ${P.hair}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        color: P.mute,
                        fontStyle: "italic",
                        letterSpacing: 1,
                      }}
                    >
                      (点击 retry 听听他在想什么)
                    </span>
                    <button
                      type="button"
                      onClick={() => void generateReflection(true)}
                      disabled={busy}
                      style={{
                        fontSize: 9,
                        letterSpacing: 3,
                        padding: "4px 12px",
                        border: `0.5px solid ${P.accent}`,
                        background: "transparent",
                        color: P.accent,
                        cursor: busy ? "wait" : "pointer",
                        fontFamily: "inherit",
                        fontStyle: "italic",
                        textTransform: "uppercase",
                        opacity: busy ? 0.5 : 1,
                      }}
                    >
                      ↻ retry
                    </button>
                  </div>
                </>
              ) : isLLMConfigured() ? (
                <button
                  type="button"
                  onClick={() => void generateReflection(true)}
                  disabled={busy}
                  style={{
                    fontSize: 10,
                    letterSpacing: 3,
                    padding: "6px 14px",
                    border: `0.5px solid ${P.accent}`,
                    background: `${P.accent}1a`,
                    color: P.accent,
                    cursor: busy ? "wait" : "pointer",
                    fontFamily: FONT_STACK,
                    fontStyle: "italic",
                    textTransform: "uppercase",
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  {busy ? "· 读着 ..." : "✨ ask"}
                </button>
              ) : (
                <div
                  style={{
                    fontSize: 11,
                    color: P.mute,
                    fontStyle: "italic",
                  }}
                >
                  · LLM 未配 · settings 填 endpoint + key
                </div>
              )}
            </div>
          )}

          {/* prev / next */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 22,
              paddingBottom: 30,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setPageIdx((p) => Math.max(0, p - 1));
                setFoxOpen(false);
              }}
              disabled={pageIdx === 0}
              style={pagerBtn(P, pageIdx === 0)}
            >
              ‹ prev
            </button>
            <button
              type="button"
              onClick={() => {
                setPageIdx((p) => Math.min(totalPages - 1, p + 1));
                setFoxOpen(false);
              }}
              disabled={pageIdx >= totalPages - 1}
              style={pagerBtn(P, pageIdx >= totalPages - 1)}
            >
              next ›
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            margin: "30px 24px 0",
            padding: "16px 16px",
            background: P.softAccent,
            borderLeft: `2px solid ${P.accent}`,
            fontSize: 11,
            color: P.mute,
            fontStyle: "italic",
            fontFamily: FONT_STACK,
            lineHeight: 1.6,
          }}
        >
          (空 · 没 import 全文 · 回 study tap shelf import TXT/MD/JSON)
        </div>
      )}

      <div
        style={{
          padding: "0 24px 60px",
          textAlign: "center",
        }}
      >
        <Link
          href="/room/study"
          style={{
            fontSize: 10,
            color: P.mute,
            fontStyle: "italic",
            textDecoration: "none",
            letterSpacing: 3,
          }}
        >
          ← 书桌
        </Link>
      </div>
    </>
  );
}

function pagerBtn(P: KimiPalette, disabled: boolean): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: 3,
    padding: "6px 14px",
    border: `0.5px solid ${disabled ? P.hair : P.accent}`,
    background: "transparent",
    color: disabled ? P.mute : P.accent,
    cursor: disabled ? "default" : "pointer",
    fontFamily: FONT_STACK,
    fontStyle: "italic",
    opacity: disabled ? 0.4 : 1,
  };
}
