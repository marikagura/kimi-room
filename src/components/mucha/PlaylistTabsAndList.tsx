"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TRACKS, TAB_FILTERS } from "@/lib/tracks-data";
import { MUCHA_COLORWAYS } from "@/lib/mucha-tokens";
import { ROSE_GOTHIC_DAY, getThemeFromCookieValue } from "@/lib/day-theme-client";

// PlaylistTabsAndList · V2 strip 到 ['ALL'] 一个 default tab. 用户 用 "+"
// 加 own tag (e.g. 雨夜 / 清晨 / 周末). client component, state-managed:
// - click tab → filter tracks by tag
// - + button → modal prompt input → push new tag to localStorage
// - - button (各 tab 除 ALL) → confirm 删 tag
// - localStorage `kimi-playlist-tags` persist user-added tags
// - delete tag 后 已 tagged tracks 保 own tag (orphan, 仅 ALL 显)

const STORAGE_KEY = "kimi-playlist-tags";
const TRACK_TAG_STORAGE = "kimi-playlist-track-tags";
// V2 generic · canon V1 用 maintainer own 头像 jpg. V2 用 rose icon
// placeholder, fork 后 用户 上传 own 头像 to BlobStore + swap src.
const SELF_AVATAR = "/icons/rose-bloom-3-full.png";
const FONT_STACK =
  'var(--font-serif)';

const NIGHT_P = MUCHA_COLORWAYS.ivory.dark;
const DAY_P = {
  bg: ROSE_GOTHIC_DAY.bg,
  paper: ROSE_GOTHIC_DAY.paper,
  ink: ROSE_GOTHIC_DAY.ink,
  accent: ROSE_GOTHIC_DAY.rose,
  accent2: ROSE_GOTHIC_DAY.roseDeep,
  mute: ROSE_GOTHIC_DAY.inkMute,
  hair: ROSE_GOTHIC_DAY.hair,
} as const;

const PAGE_SIZE = 5;

export function PlaylistTabsAndList() {
  const [isDay, setIsDay] = useState(false);
  const [tags, setTags] = useState<string[]>(TAB_FILTERS as unknown as string[]);
  const [selected, setSelected] = useState<string>("ALL");
  const [page, setPage] = useState(0);
  const [trackTagOverrides, setTrackTagOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    setIsDay(getThemeFromCookieValue(document.cookie) === "day");
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] === "ALL") {
          setTags(parsed);
        }
      }
      const ov = localStorage.getItem(TRACK_TAG_STORAGE);
      if (ov) {
        const parsedOv = JSON.parse(ov) as Record<string, string>;
        if (parsedOv && typeof parsedOv === "object") {
          setTrackTagOverrides(parsedOv);
        }
      }
    } catch {}
  }, []);

  const effectiveTag = (title: string, fallback: string) =>
    trackTagOverrides[title] ?? fallback;

  const persistTags = (next: string[]) => {
    setTags(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const addTag = () => {
    const input = window.prompt("新分类名 (e.g. 雨夜 / 清晨 / 周末)");
    if (!input) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      window.alert(`「${trimmed}」 已存在`);
      return;
    }
    persistTags([...tags, trimmed]);
  };

  const removeTag = (tag: string) => {
    if (tag === "ALL") return;
    const ok = window.confirm(`删除分类「${tag}」?\n(已 tagged 的歌仍保留, 仅 ALL 可见)`);
    if (!ok) return;
    const next = tags.filter((t) => t !== tag);
    persistTags(next);
    if (selected === tag) setSelected("ALL");
  };

  const p = isDay ? DAY_P : NIGHT_P;
  const filtered =
    selected === "ALL"
      ? TRACKS
      : TRACKS.filter((t) => effectiveTag(t.title, t.tag) === selected);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return (
    <>
      {/* tabs */}
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "10px 0 4px",
          fontSize: 10,
          letterSpacing: 2,
          color: p.mute,
          borderBottom: `0.4px solid ${p.hair}`,
          overflowX: "auto",
          fontFamily: FONT_STACK,
          alignItems: "center",
        }}
      >
        {tags.map((t) => {
          const isSel = t === selected;
          return (
            <span
              key={t}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                paddingBottom: 4,
                whiteSpace: "nowrap",
                color: isSel ? p.accent : p.mute,
                borderBottom: isSel ? `1px solid ${p.accent}` : "none",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelected(t);
                  setPage(0);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  letterSpacing: "inherit",
                  fontSize: "inherit",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {t}
              </button>
              {t !== "ALL" && (
                <button
                  type="button"
                  aria-label={`删除 ${t}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(t);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: p.mute,
                    opacity: 0.45,
                    fontSize: 10,
                    cursor: "pointer",
                    padding: "0 2px",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
        <button
          type="button"
          onClick={addTag}
          aria-label="add category"
          title="add category"
          style={{
            background: "transparent",
            border: "none",
            color: p.mute,
            opacity: 0.6,
            paddingBottom: 4,
            whiteSpace: "nowrap",
            fontSize: 14,
            fontStyle: "italic",
            cursor: "pointer",
          }}
        >
          +
        </button>
      </div>

      {/* tracks */}
      <div style={{ position: "relative", zIndex: 2, padding: "0 4px" }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "32px 0",
              textAlign: "center",
              fontSize: 11,
              color: p.mute,
              fontStyle: "italic",
            }}
          >
            「{selected}」 还 0 首
          </div>
        ) : (
          visible.map((tr) => {
            const idx = TRACKS.indexOf(tr);
            const num = String(idx + 1).padStart(2, "0");
            return (
              <Link
                key={tr.title}
                href={`/playlist/now-playing?i=${idx}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 4px",
                  borderBottom: `0.3px solid ${p.hair}`,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span style={{ fontSize: 9, color: p.mute, letterSpacing: 1 }}>
                  {num}
                </span>
                {/* track avatar · V2 generic rose placeholder, fork 后 swap own */}
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    overflow: "hidden",
                    flexShrink: 0,
                    border: `0.6px solid ${p.hair}`,
                  }}
                >
                  <img
                    src={SELF_AVATAR}
                    alt=""
                    width={28}
                    height={28}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 14,
                      color: p.ink,
                      fontFamily: FONT_STACK,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tr.title}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 10,
                      color: p.mute,
                      fontFamily: FONT_STACK,
                      fontStyle: "italic",
                      marginTop: 2,
                    }}
                  >
                    {tr.artist} ♪
                  </span>
                </span>
              </Link>
            );
          })
        )}
      </div>

      {/* paginator */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 14,
            padding: "16px 0 4px",
            color: p.mute,
          }}
        >
          <button
            type="button"
            onClick={() => setPage(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            style={{
              background: "transparent",
              border: "none",
              color: safePage === 0 ? `${p.mute}55` : p.accent,
              fontSize: 12,
              cursor: safePage === 0 ? "default" : "pointer",
              padding: "4px 6px",
            }}
          >
            ◀
          </button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: i === safePage ? p.accent : `${p.mute}55`,
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
            disabled={safePage === totalPages - 1}
            style={{
              background: "transparent",
              border: "none",
              color: safePage === totalPages - 1 ? `${p.mute}55` : p.accent,
              fontSize: 12,
              cursor: safePage === totalPages - 1 ? "default" : "pointer",
              padding: "4px 6px",
            }}
          >
            ▶
          </button>
        </div>
      )}

    </>
  );
}
