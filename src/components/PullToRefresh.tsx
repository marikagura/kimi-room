"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Pull-to-refresh for PWA standalone mode (iOS Safari doesn't supply native
// PTR when display-mode is standalone). Listens on window scroll + touch:
// only triggers when scroll is at 0 and finger drags down past threshold.
// Visual: a thin gold line at top with a subtle rose dot that grows + fades.
// On release past threshold, location.reload() — full re-fetch (incl. SW).

const THRESHOLD = 70; // px finger drag to trigger refresh
const MAX_PULL = 110;  // visual cap (no further movement past)

export function PullToRefresh() {
  const pathname = usePathname();
  // /chat is a position:fixed full-screen layout, so the window never scrolls
  // (window.scrollY stays 0) and PTR mis-detects "at top" on every touchstart —
  // dragging to scroll the message log would trigger a reload. Disable PTR there.
  const disabled = pathname?.startsWith("/chat") || false;
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (disabled) return;
    function onTouchStart(e: TouchEvent) {
      // arm only if scrolled to top — otherwise allow normal scrolling
      if (window.scrollY > 0) {
        armed.current = false;
        startY.current = null;
        return;
      }
      armed.current = true;
      startY.current = e.touches[0]?.clientY ?? null;
    }
    function onTouchMove(e: TouchEvent) {
      if (!armed.current || startY.current == null || refreshing) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      // resistance: feels heavier past threshold
      const eased = dy < THRESHOLD ? dy : THRESHOLD + (dy - THRESHOLD) * 0.35;
      setPull(Math.min(MAX_PULL, eased));
    }
    function onTouchEnd() {
      if (!armed.current || refreshing) {
        setPull(0);
        startY.current = null;
        armed.current = false;
        return;
      }
      if (pull >= THRESHOLD) {
        setRefreshing(true);
        // small delay so user sees the "armed" visual before reload
        setTimeout(() => {
          window.location.reload();
        }, 220);
      } else {
        setPull(0);
      }
      startY.current = null;
      armed.current = false;
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pull, refreshing, disabled]);

  if (disabled) return null;

  const armed_ = pull >= THRESHOLD;
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: Math.max(0, pull),
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 9998,
        background:
          pull > 0
            ? "linear-gradient(180deg, var(--kimi-ptr-bg-tint) 0%, transparent 100%)"
            : "transparent",
        transition: refreshing ? "none" : pull === 0 ? "height 260ms ease" : "none",
      }}
    >
      {pull > 8 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            paddingBottom: 8,
            opacity: Math.min(1, pull / THRESHOLD),
          }}
        >
          <div
            style={{
              width: armed_ ? 10 : 6,
              height: armed_ ? 10 : 6,
              borderRadius: "50%",
              background: armed_
                ? "var(--kimi-ptr-color-armed)"
                : "var(--kimi-ptr-color)",
              transition: "width 120ms, height 120ms, background 120ms",
              boxShadow: armed_ ? "0 0 6px var(--kimi-ptr-glow)" : "none",
            }}
          />
          <span
            style={{
              fontSize: 9,
              letterSpacing: 2,
              fontStyle: "italic",
              color: armed_
                ? "var(--kimi-ptr-color-armed)"
                : "var(--kimi-ptr-color)",
              fontFamily: 'var(--font-serif)',
            }}
          >
            {refreshing ? "refreshing…" : armed_ ? "release" : "pull"}
          </span>
        </div>
      )}
    </div>
  );
}
