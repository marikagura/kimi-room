"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { TRACKS } from "@/lib/tracks-data";
import { MUCHA_COLORWAYS } from "@/lib/mucha-tokens";
import { ROSE_GOTHIC_DAY, getThemeFromCookieValue } from "@/lib/day-theme-client";

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

export function TrackListPaginated() {
  const [page, setPage] = useState(0);
  const [isDay, setIsDay] = useState(false);
  useEffect(() => {
    setIsDay(getThemeFromCookieValue(document.cookie) === "day");
  }, []);
  const p = isDay ? DAY_P : NIGHT_P;
  const totalPages = Math.ceil(TRACKS.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const visible = TRACKS.slice(start, start + PAGE_SIZE);

  return (
    <>
      {/* tracks — list 在 arch 内, max-width 跟 arch 内宽匹配 */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "0 4px",
          minHeight: PAGE_SIZE * 56, // 锁高度防翻页 arch 抖动
        }}
      >
        {visible.map((tr) => {
          const idx = TRACKS.indexOf(tr);
          return (
            <Link
              key={tr.n}
              href={`/playlist/now-playing?i=${idx}`}
              className="block"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 0",
                borderBottom: `0.3px solid ${p.hair}`,
                color: p.ink,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: p.mute,
                  fontStyle: "italic",
                  width: 18,
                  textAlign: "right",
                }}
              >
                {String(tr.n).padStart(2, "0")}
              </div>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: `url(/images/portraits/${tr.who}-dark.jpg) center/cover`,
                  border: `0.5px solid ${p.accent}`,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    color: p.ink,
                    fontFamily: 'var(--font-serif)',
                    letterSpacing: 0.5,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {tr.title}
                </div>
                <div style={{ fontSize: 9, color: p.mute, marginTop: 2 }}>
                  {tr.artist}
                  {tr.tag && (
                    <>
                      {" · "}
                      <span style={{ color: p.accent, fontStyle: "italic" }}>
                        {tr.tag}
                      </span>
                    </>
                  )}
                  {tr.neteaseUrl && (
                    <span
                      style={{ color: p.accent, marginLeft: 6, fontSize: 9 }}
                      aria-label="has netease link"
                    >
                      ♪
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 9, color: p.mute, fontStyle: "italic" }}>
                {tr.length}
              </div>
            </Link>
          );
        })}
      </div>

      {/* paginator — 简洁: ◀ · 圆点 · ▶, 无大块 button */}
      {totalPages > 1 && (
        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            marginTop: 14,
            marginBottom: 6,
            color: p.mute,
            fontSize: 12,
            fontFamily: 'var(--font-serif)',
          }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="prev page"
            style={{
              background: "transparent",
              border: "none",
              color: page === 0 ? p.hair : p.accent,
              cursor: page === 0 ? "default" : "pointer",
              fontSize: 14,
              padding: "2px 8px",
              fontFamily: "inherit",
              opacity: page === 0 ? 0.35 : 1,
            }}
          >
            ◀
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                aria-label={`page ${i + 1}`}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: i === page ? p.accent : "transparent",
                  border: `0.6px solid ${p.accent}`,
                  cursor: "pointer",
                  padding: 0,
                  opacity: i === page ? 1 : 0.5,
                  transition: "all 200ms",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            aria-label="next page"
            style={{
              background: "transparent",
              border: "none",
              color: page >= totalPages - 1 ? p.hair : p.accent,
              cursor: page >= totalPages - 1 ? "default" : "pointer",
              fontSize: 14,
              padding: "2px 8px",
              fontFamily: "inherit",
              opacity: page >= totalPages - 1 ? 0.35 : 1,
            }}
          >
            ▶
          </button>
        </div>
      )}
    </>
  );
}
