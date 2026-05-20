"use client";

import { useEffect, useRef, useState } from "react";
import type { KimiPalette } from "@/lib/kimi-palettes";
import { pieceStore } from "@/lib/stores";
import type { PieceEntry } from "@/lib/stores/types";
import { friendlyLLMError, isLLMConfigured, llmGenerate } from "@/lib/llm-client";
import { buildCharacterContext } from "@/lib/system-prompt";
import { getCharName, tmpl } from "@/lib/template";

// User-named study category · entries 在 pieceStore (tags[0] = category name).
// owner 0518 ack: 一 button 加新 entry · 一 button import TXT/MD/JSON · entry
// row tap → 详情 inline expand · canon RowLink format (soft-accent bg · 玫瑰
// accent border · arrow indicator). 共读 fox toggle 来自 CategoryList
// localStorage["kimi-study-fox-categories"].

const FOX_KEY = "kimi-study-fox-categories";

function isCategoryFoxOn(name: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(FOX_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.includes(name);
  } catch {
    return false;
  }
}

const FONT_STACK =
  '"Cormorant Garamond", "Noto Serif SC", "Songti SC", "STSong", serif';

export function CategoryClient({
  P,
  category,
}: {
  P: KimiPalette;
  category: string;
}) {
  const [entries, setEntries] = useState<PieceEntry[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PieceEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [foxOn, setFoxOn] = useState(false);
  const [foxOpenId, setFoxOpenId] = useState<string | null>(null);
  const [foxBusyId, setFoxBusyId] = useState<string | null>(null);

  async function reload() {
    const all = (await pieceStore().list()) as PieceEntry[];
    const filtered = all.filter((p) => p.tags?.[0] === category);
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setEntries(filtered);
  }

  useEffect(() => {
    void reload();
    setFoxOn(isCategoryFoxOn(category));
  }, [category]);

  async function generateReflection(entry: PieceEntry, force = false) {
    if (foxBusyId) return;
    if (entry.aiReflection && !force) return;
    if (!isLLMConfigured()) {
      alert("LLM 未配 · settings 填 endpoint + key");
      return;
    }
    setFoxBusyId(entry.id);
    try {
      const cn = getCharName();
      // Uses /backstage/settings SP + memory injection as base · adds
      // entry-reading-together specific instruction on top.
      const system = await buildCharacterContext(
        "你跟用户在一起读这条 entry. 你刚读完, 用 200-400 字, 第一人称, 你的视角/性格, 写一段读后感. 不客观总结 · 不列要点 · 不 emoji · 不 markdown header · 一段 prose.",
      );
      const prompt = `[标题] ${entry.title || "(无)"}\n[分类] ${category}\n[内容]\n${entry.body.slice(0, 4000)}\n\n请用 ${cn} 的视角写一段读后感.`;
      const text = await llmGenerate(prompt, system, {
        temperature: 0.85,
        maxTokens: 600,
      });
      if (text) {
        await pieceStore().put({ id: entry.id, aiReflection: text });
        await reload();
      }
    } catch (e) {
      const fe = friendlyLLMError(e);
      alert(`${fe.title} · ${fe.hint}`);
    } finally {
      setFoxBusyId(null);
    }
  }

  async function savePiece(form: { id?: string; title: string; body: string }) {
    await pieceStore().put({
      id: form.id,
      title: form.title,
      body: form.body,
      tags: [category],
    });
    await reload();
  }

  async function remove(id: string) {
    if (!confirm("删这条?")) return;
    await pieceStore().delete(id);
    await reload();
  }

  async function onImportFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext === "json") {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of arr) {
          const title =
            (item as { title?: string }).title?.trim() ||
            file.name.replace(/\.\w+$/, "");
          const body =
            (item as { body?: string; content?: string; text?: string }).body ??
            (item as { content?: string }).content ??
            (item as { text?: string }).text ??
            "";
          await pieceStore().put({
            title,
            body: String(body),
            tags: [category],
          });
        }
      } else {
        // txt / md / 其他 raw text → title = filename, body = full content
        const title = file.name.replace(/\.\w+$/, "");
        await pieceStore().put({
          title,
          body: text,
          tags: [category],
        });
      }
      await reload();
    } catch (e) {
      alert(`import failed · ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "16px 22px 40px", fontFamily: FONT_STACK }}>
      <div
        style={{
          fontSize: 9,
          letterSpacing: 3,
          color: P.accent,
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        · {category}
      </div>

      {entries.length === 0 ? null : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {entries.map((e) => {
            const isOpen = openId === e.id;
            const preview = e.body.replace(/\s+/g, " ").slice(0, 80);
            return (
              <div
                key={e.id}
                style={{
                  background: P.softAccent,
                  borderLeft: `2px solid ${P.accent}`,
                  padding: "14px 16px",
                  cursor: "pointer",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : e.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    color: P.ink,
                    fontFamily: FONT_STACK,
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 16,
                        letterSpacing: 1,
                        color: P.ink,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {e.title || "(无标题)"}
                    </span>
                    {foxOn && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src="/icons/fox-bw-sit.png"
                        alt="共读"
                        width={14}
                        height={14}
                        style={{
                          flexShrink: 0,
                          objectFit: "contain",
                          opacity: e.aiReflection ? 1 : 0.5,
                          filter: P.ink.startsWith("#1") ? "none" : "invert(1)",
                        }}
                      />
                    )}
                    <span style={{ fontSize: 14, color: P.accent }}>
                      {isOpen ? "↓" : "→"}
                    </span>
                  </div>
                  {!isOpen && preview && (
                    <div
                      style={{
                        fontSize: 10,
                        color: P.mute,
                        fontStyle: "italic",
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {preview}
                    </div>
                  )}
                </button>
                {isOpen && (
                  <>
                    <div
                      style={{
                        fontSize: 13,
                        color: P.ink,
                        lineHeight: 1.75,
                        marginTop: 10,
                        whiteSpace: "pre-wrap",
                        fontFamily: FONT_STACK,
                      }}
                    >
                      {e.body || <em style={{ color: P.mute }}>(空 body)</em>}
                    </div>

                    {/* 共读 · fox toggle · only when category opted-in */}
                    {foxOn && (
                      <>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 14,
                            paddingTop: 10,
                            borderTop: `0.3px solid ${P.hair}`,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const isFoxOpen = foxOpenId === e.id;
                              setFoxOpenId(isFoxOpen ? null : e.id);
                            }}
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
                              alt=""
                              width={18}
                              height={18}
                              style={{
                                objectFit: "contain",
                                opacity: foxOpenId === e.id ? 1 : 0.6,
                                filter: P.ink.startsWith("#1") ? "none" : "invert(1)",
                              }}
                            />
                            <span
                              style={{
                                fontSize: 9,
                                letterSpacing: 2,
                                color: foxOpenId === e.id ? P.accent : P.mute,
                                fontStyle: "italic",
                                textTransform: "uppercase",
                              }}
                            >
                              {foxOpenId === e.id ? "▼ 收起" : "▶ 听听他在想什么"}
                            </span>
                          </button>
                        </div>
                        {foxOpenId === e.id && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: "12px 14px",
                              background: P.softAccent,
                              borderLeft: `2px solid ${P.accent}`,
                            }}
                          >
                            {foxBusyId === e.id && !e.aiReflection ? (
                              <div style={{ fontSize: 11, color: P.mute, fontStyle: "italic" }}>
                                · 读着 …
                              </div>
                            ) : e.aiReflection ? (
                              <>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: P.ink,
                                    lineHeight: 1.8,
                                    fontStyle: "italic",
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {e.aiReflection}
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginTop: 12,
                                    paddingTop: 8,
                                    borderTop: `0.3px solid ${P.hair}`,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 9,
                                      color: P.mute,
                                      fontStyle: "italic",
                                    }}
                                  >
                                    (点击 retry 听听他在想什么)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void generateReflection(e, true)}
                                    disabled={foxBusyId === e.id}
                                    style={{
                                      fontSize: 9,
                                      letterSpacing: 3,
                                      padding: "4px 12px",
                                      border: `0.5px solid ${P.accent}`,
                                      background: "transparent",
                                      color: P.accent,
                                      cursor: foxBusyId === e.id ? "wait" : "pointer",
                                      fontFamily: "inherit",
                                      fontStyle: "italic",
                                      textTransform: "uppercase",
                                      opacity: foxBusyId === e.id ? 0.5 : 1,
                                    }}
                                  >
                                    ↻ retry
                                  </button>
                                </div>
                              </>
                            ) : isLLMConfigured() ? (
                              <button
                                type="button"
                                onClick={() => void generateReflection(e, true)}
                                disabled={foxBusyId === e.id}
                                style={{
                                  fontSize: 10,
                                  letterSpacing: 3,
                                  padding: "6px 14px",
                                  border: `0.5px solid ${P.accent}`,
                                  background: `${P.accent}1a`,
                                  color: P.accent,
                                  cursor: foxBusyId === e.id ? "wait" : "pointer",
                                  fontFamily: FONT_STACK,
                                  fontStyle: "italic",
                                  textTransform: "uppercase",
                                  opacity: foxBusyId === e.id ? 0.5 : 1,
                                }}
                              >
                                {foxBusyId === e.id ? "· 读着 ..." : "✨ ask"}
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
                      </>
                    )}

                    <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => setEditing(e)}
                        style={ghostBtn(P)}
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(e.id)}
                        style={{
                          ...ghostBtn(P),
                          color: P.mute,
                          borderColor: P.hair,
                        }}
                      >
                        删
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setAdding(true)} style={primaryBtn(P)}>
          ＋ 加一条
        </button>
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          style={primaryBtn(P)}
          disabled={busy}
        >
          {busy ? "..." : "↑ import TXT / MD / JSON"}
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".txt,.md,.json,text/plain,text/markdown,application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onImportFile(f);
          }}
        />
      </div>

      {(adding || editing) && (
        <EntryForm
          P={P}
          initial={editing ?? { title: "", body: "" }}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={async (form) => {
            await savePiece({
              id: editing?.id,
              title: form.title,
              body: form.body,
            });
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EntryForm({
  P,
  initial,
  onClose,
  onSave,
}: {
  P: KimiPalette;
  initial: { title: string; body: string };
  onClose: () => void;
  onSave: (form: { title: string; body: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (!title.trim() && !body.trim()) return;
    setBusy(true);
    await onSave({ title: title.trim(), body });
    setBusy(false);
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
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "85vh",
          overflowY: "auto",
          background: P.paper,
          color: P.ink,
          padding: "22px 22px 28px",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          fontFamily: '"Cormorant Garamond", "Noto Serif SC", serif',
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          style={{
            background: "transparent",
            border: "none",
            borderBottom: `0.5px solid ${P.hair}`,
            padding: "6px 2px",
            color: P.ink,
            fontSize: 18,
            fontFamily: "inherit",
            outline: "none",
            width: "100%",
          }}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="正文"
          rows={12}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: `0.5px solid ${P.hair}`,
            padding: "10px 2px",
            color: P.ink,
            fontSize: 13,
            fontFamily: "inherit",
            lineHeight: 1.7,
            outline: "none",
            width: "100%",
            resize: "vertical",
            marginTop: 12,
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 14,
          }}
        >
          <button type="button" onClick={onClose} style={ghostBtn(P)}>
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            style={primaryBtn(P)}
          >
            {busy ? "..." : "存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function primaryBtn(P: KimiPalette): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: 3,
    padding: "8px 14px",
    border: `0.5px solid ${P.accent}`,
    background: `${P.accent}1a`,
    color: P.accent,
    cursor: "pointer",
    fontFamily: "inherit",
    fontStyle: "italic",
  };
}

function ghostBtn(P: KimiPalette): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: 3,
    padding: "6px 14px",
    border: `0.4px solid ${P.hair}`,
    background: "transparent",
    color: P.mute,
    cursor: "pointer",
    fontFamily: "inherit",
    fontStyle: "italic",
  };
}
