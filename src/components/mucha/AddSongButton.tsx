"use client";

import { useEffect, useState } from "react";
import type { KimiPalette } from "@/lib/kimi-palettes";

export type PendingSong = {
  id: string;
  title: string;
  artist?: string;
  note?: string;
  who: "self" | "other";
  neteaseUrl?: string;
  addedAt: string;
};

const STORAGE_KEY = "kimi-web:playlist:pending";

function readQueue(): PendingSong[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingSong[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(next: PendingSong[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function AddSongButton({
  P,
}: {
  P: { ink: string; mute: string; hair: string; accent: string; paper?: string; bg?: string };
}) {
  const modalBg = P.paper ?? P.bg ?? "#0f0a08";
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<PendingSong[]>([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [note, setNote] = useState("");
  const [neteaseUrl, setNeteaseUrl] = useState("");
  const [who, setWho] = useState<"self" | "other">("other");

  useEffect(() => setQueue(readQueue()), []);

  function add() {
    if (!title.trim()) return;
    const entry: PendingSong = {
      id: crypto.randomUUID(),
      title: title.trim(),
      artist: artist.trim() || undefined,
      note: note.trim() || undefined,
      neteaseUrl: neteaseUrl.trim() || undefined,
      who,
      addedAt: new Date().toISOString(),
    };
    const next = [entry, ...queue].slice(0, 50);
    setQueue(next);
    writeQueue(next);
    setTitle("");
    setArtist("");
    setNote("");
    setNeteaseUrl("");
  }

  function remove(id: string) {
    const next = queue.filter((q) => q.id !== id);
    setQueue(next);
    writeQueue(next);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          flex: 1,
          border: `0.6px solid ${P.hair}`,
          padding: "10px 0",
          textAlign: "center",
          fontSize: 10,
          letterSpacing: 4,
          color: P.mute,
          background: "transparent",
          cursor: "pointer",
          fontFamily: 'var(--font-serif)',
        }}
      >
        ＋ 加歌{queue.length > 0 && ` (${queue.length})`}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 440,
              maxHeight: "80vh",
              overflowY: "auto",
              background: modalBg,
              color: P.ink,
              padding: "28px 20px 40px",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              fontFamily: 'var(--font-serif)',
              borderTop: `0.5px solid ${P.hair}`,
            }}
          >
            <div style={{ textAlign: "center", fontSize: 11, letterSpacing: 4, color: P.accent, marginBottom: 18 }}>
              加一首 · pending
            </div>

            {/* form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="歌名"
                style={fieldStyle(P)}
              />
              <input
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="歌手 (optional)"
                style={fieldStyle(P)}
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="一句话 (optional)"
                style={fieldStyle(P)}
              />
              <input
                value={neteaseUrl}
                onChange={(e) => setNeteaseUrl(e.target.value)}
                placeholder="网易云分享链接 (optional)"
                inputMode="url"
                style={fieldStyle(P)}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11 }}>
                <span style={{ color: P.mute, fontStyle: "italic" }}>by</span>
                {(["self", "other"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWho(w)}
                    style={{
                      padding: "4px 12px",
                      border: `0.5px solid ${who === w ? P.accent : P.hair}`,
                      color: who === w ? P.accent : P.mute,
                      background: "transparent",
                      fontSize: 10,
                      letterSpacing: 2,
                      cursor: "pointer",
                      fontStyle: "italic",
                    }}
                  >
                    {w === "self" ? "我" : "他"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={add}
                disabled={!title.trim()}
                style={{
                  padding: "10px",
                  border: `0.6px solid ${P.accent}`,
                  background: title.trim() ? `${P.accent}1c` : "transparent",
                  color: title.trim() ? P.accent : P.mute,
                  fontSize: 11,
                  letterSpacing: 3,
                  cursor: title.trim() ? "pointer" : "default",
                  fontFamily: 'var(--font-serif)',
                }}
              >
                ✦ 加
              </button>
            </div>

            {/* queue */}
            {queue.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: 3,
                    color: P.accent,
                    paddingBottom: 6,
                    borderBottom: `0.3px solid ${P.hair}`,
                  }}
                >
                  等待 · {queue.length}
                </div>
                {queue.map((q) => (
                  <div
                    key={q.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 0",
                      borderBottom: `0.3px solid ${P.hair}`,
                    }}
                  >
                    <div style={{ fontSize: 9, color: P.accent, width: 20 }}>
                      {q.who === "self" ? "我" : "他"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontFamily: 'var(--font-serif)',
                          color: P.ink,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {q.title}
                      </div>
                      <div style={{ fontSize: 9, color: P.mute, fontStyle: "italic" }}>
                        {q.artist}
                        {q.note ? ` · ${q.note}` : ""}
                        {q.neteaseUrl ? " · ♪" : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(q.id)}
                      aria-label="remove"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: P.mute,
                        fontSize: 14,
                        cursor: "pointer",
                        padding: 4,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function fieldStyle(P: { ink: string; hair: string; mute: string }): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    borderBottom: `0.5px solid ${P.hair}`,
    padding: "8px 2px",
    color: P.ink,
    fontSize: 13,
    fontFamily: 'var(--font-serif)',
    outline: "none",
  };
}
