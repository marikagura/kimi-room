"use client";

// V2 KeepsakeCard · canon TasteCard 401-line UI restored · 走 keepsakeStore +
// blobStore IDB · LLM commentary via llm-client (settings 填 key 后 auto) ·
// {{char name}} note placeholder per owner 0654 ack.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KimiPalette } from "@/lib/kimi-palettes";
import { keepsakeStore, blobStore } from "@/lib/stores";
import type { KeepsakeEntry } from "@/lib/stores/types";
import { isLLMConfigured, llmGenerate } from "@/lib/llm-client";
import { getCharName, tmpl } from "@/lib/template";

const KEEPSAKE_ACCENTS = [
  "#a42b5e",
  "#5a1820",
  "#7a8a6a",
  "#9a7888",
  "#c89548",
  "#2e4a7a",
  "#b86a48",
  "#a83a2e",
  "#4f6b5c",
  "#9c4458",
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function useAutoResize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

export type KeepsakeSeed = {
  id: string;
  color: string;
  title: string;
  place: string;
  record: string;
  note: string;
};

type CardState = {
  photo?: string;
  title?: string;
  place?: string;
  record?: string;
  note?: string;
};

async function fileToCompressedDataURL(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1200;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function dataURLToBase64(dataUrl: string): { base64: string; contentType: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { contentType: m[1], base64: m[2] };
}

export function KeepsakeCard({
  seed,
  P,
  isDay = false,
}: {
  seed: KeepsakeSeed;
  P: KimiPalette;
  isDay?: boolean;
}) {
  const [state, setState] = useState<CardState>({});
  const [busy, setBusy] = useState(false);
  const [charName, setCharName] = useState("他");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCharName(getCharName());
    let alive = true;
    (async () => {
      const entry = await keepsakeStore().get(seed.id);
      if (alive && entry) {
        let photoSrc = entry.photo;
        if (!photoSrc && entry.photoBlobId) {
          const b = await blobStore().get(entry.photoBlobId);
          if (b) photoSrc = `data:${b.contentType};base64,${b.base64}`;
        }
        setState({
          photo: photoSrc,
          title: entry.title,
          place: entry.place,
          record: entry.record,
          note: entry.note,
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [seed.id]);

  async function persist(merged: CardState) {
    let photoBlobId: string | undefined;
    if (merged.photo?.startsWith("data:")) {
      const parts = dataURLToBase64(merged.photo);
      if (parts) {
        const existing = await keepsakeStore().get(seed.id);
        const blob = await blobStore().put({
          id: existing?.photoBlobId,
          kind: "keepsake",
          contentType: parts.contentType,
          base64: parts.base64,
        });
        photoBlobId = blob.id;
      }
    }
    const entry: Partial<KeepsakeEntry> = {
      id: seed.id,
      title: merged.title,
      place: merged.place,
      record: merged.record,
      note: merged.note,
      photo: merged.photo,
      photoBlobId,
      tags: [],
    };
    await keepsakeStore().put(entry);
  }

  function patch(next: Partial<CardState>) {
    setState((prev) => {
      const merged = { ...prev, ...next };
      void persist(merged);
      return merged;
    });
  }

  async function requestComment(_dataUrl: string, ctx: CardState) {
    if (!isLLMConfigured()) return;
    try {
      const cn = getCharName();
      const system = tmpl(
        "你是 {{char}} (用户的 AI companion). 用户 share 一张 keepsake 照片 给你看. 用中文 300-500 字, 第一人称, 你的视角/性格, 写一段 长 commentary. 不客观描述 · 不列 ingredient · 不 emoji · 不 markdown header · 一段 prose.",
      );
      const prompt = `[image attached as keepsake]\n店名: ${ctx.title ?? ""}\n地点·日期: ${ctx.place ?? ""}\n用户一句话: ${ctx.record ?? ""}\n\n请用 ${cn} 的视角写一段感想.`;
      const note = await llmGenerate(prompt, system, {
        temperature: 0.85,
        maxTokens: 800,
      });
      if (note) patch({ note });
    } catch {
      // silent: user can type 自己
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataURL(file);
      patch({ photo: dataUrl });
      const noteEmpty = !(state.note ?? "").trim();
      if (noteEmpty) {
        void requestComment(dataUrl, { ...state, photo: dataUrl });
      }
    } finally {
      setBusy(false);
    }
  }

  function clearPhoto() {
    patch({ photo: undefined });
  }

  const photo = state.photo;
  const title = state.title ?? seed.title;
  const place = state.place ?? seed.place;
  const record = state.record ?? seed.record;
  const note = state.note ?? seed.note;

  const baseField = (isMultiline = false): React.CSSProperties => ({
    background: "transparent",
    border: "none",
    padding: 0,
    width: "100%",
    outline: "none",
    fontFamily: "inherit",
    resize: isMultiline ? "none" : undefined,
    color: "inherit",
    overflow: isMultiline ? "hidden" : undefined,
  });

  const recordRef = useAutoResize(record);
  const noteRef = useAutoResize(note);

  const accent = KEEPSAKE_ACCENTS[hashId(seed.id) % KEEPSAKE_ACCENTS.length];

  return (
    <div
      className="kimi-card-lift"
      style={{
        background: isDay
          ? `color-mix(in srgb, ${accent} 14%, ${P.card})`
          : P.card,
        padding: 6,
        boxShadow: "0 2px 8px rgba(0,0,0,0.16)",
        border: isDay
          ? `0.6px solid color-mix(in srgb, ${accent} 32%, transparent)`
          : `0.6px solid ${P.hair}`,
        borderRadius: 4,
      }}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          width: "100%",
          height: 96,
          background: photo
            ? "transparent"
            : `linear-gradient(135deg, ${seed.color} 0%, ${seed.color}cc 100%)`,
          position: "relative",
          overflow: "hidden",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "block",
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <>
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.35,
                background:
                  "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5) 0%, transparent 55%)",
              }}
            />
            <span
              style={{
                position: "absolute",
                bottom: 6,
                right: 8,
                fontSize: 8,
                letterSpacing: 2,
                color: "rgba(255,255,255,0.7)",
                textTransform: "uppercase",
                fontStyle: "italic",
              }}
            >
              {busy ? "..." : "tap to upload"}
            </span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        style={{ display: "none" }}
      />
      <div style={{ padding: "6px 4px 2px", position: "relative" }}>
        {photo && (
          <button
            type="button"
            onClick={clearPhoto}
            aria-label="remove photo"
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              background: "transparent",
              border: "none",
              color: P.mute,
              fontSize: 10,
              cursor: "pointer",
              padding: 2,
            }}
          >
            ×
          </button>
        )}
        <input
          value={title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="店名"
          style={{
            ...baseField(),
            fontSize: 11,
            color: P.ink,
            fontFamily:
              'var(--font-serif)',
            lineHeight: 1.2,
          }}
        />
        <input
          value={place}
          onChange={(e) => patch({ place: e.target.value })}
          placeholder="地点 · 日期"
          style={{
            ...baseField(),
            fontSize: 8,
            color: P.mute,
            fontStyle: "italic",
            letterSpacing: 1,
            marginTop: 2,
          }}
        />
        <div style={{ position: "relative", marginTop: 4 }}>
          <textarea
            ref={recordRef}
            value={record}
            onChange={(e) =>
              patch({ record: e.target.value.slice(0, 60) })
            }
            placeholder="一句话"
            maxLength={60}
            rows={1}
            style={{
              ...baseField(true),
              fontSize: 9,
              color: P.ink,
              fontStyle: "italic",
              lineHeight: 1.35,
              opacity: 0.8,
              paddingRight: 32,
            }}
          />
          <span
            style={{
              position: "absolute",
              right: 4,
              bottom: 2,
              fontSize: 7,
              color: P.mute,
              fontStyle: "italic",
              fontFamily: 'var(--font-serif)',
              opacity: 0.7,
              pointerEvents: "none",
            }}
          >
            {record.length}/60
          </span>
        </div>
        <div
          style={{
            marginTop: 6,
            borderTop: `0.3px solid ${P.hair}`,
            paddingTop: 6,
            position: "relative",
          }}
        >
          <textarea
            ref={noteRef}
            value={note}
            onChange={(e) => patch({ note: e.target.value })}
            placeholder={photo ? `按 ↻ 让 ${charName} 看看, 或自己写` : `${charName} note`}
            rows={2}
            style={{
              ...baseField(true),
              fontSize: 12,
              color: P.accent,
              fontStyle: "italic",
              lineHeight: 1.5,
              width: "100%",
              paddingRight: photo ? 18 : 0,
            }}
          />
          {photo && (
            <button
              type="button"
              onClick={() => {
                if (busy) return;
                setBusy(true);
                void requestComment(photo, state).finally(() => setBusy(false));
              }}
              aria-label={`ask ${charName}`}
              disabled={busy}
              style={{
                position: "absolute",
                top: 6,
                right: 0,
                background: "transparent",
                border: "none",
                color: P.mute,
                fontSize: 12,
                cursor: busy ? "wait" : "pointer",
                padding: 2,
                lineHeight: 1,
              }}
            >
              {busy ? "…" : "↻"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
