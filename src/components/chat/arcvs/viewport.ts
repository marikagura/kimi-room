"use client";

// Pin the document while a full-screen surface is on it.
//
// The chat lives entirely inside a `position: fixed` shell, so the document
// itself has nothing to scroll. iOS allows the rubber-band anyway: one drag and
// the fixed shell travels with the finger, exposing html/body underneath, which
// reads as a strip along the bottom of the screen that moves when you pull. It
// looks like a bar the page contains, and it is not.
//
// Both declarations are needed — `overflow: hidden` stops the scroll, and
// `overscroll-behavior: none` stops the bounce; without the second, iOS still
// bounces. The height is pinned too, since `min-height: 100%` on body means a
// stray pixel of content is enough to make the document scrollable again.
//
// Pages that genuinely scroll (the history and thread lists) must not use this:
// their scrolling is real.

import { useEffect, useLayoutEffect, useState } from "react";

const VISUAL_HEIGHT = "--kimi-visual-height";
const VISUAL_TOP = "--kimi-visual-top";
const COMPOSER_BOTTOM = "--kimi-composer-bottom";

export function useVisualViewport(): void {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const previous = {
      height: html.style.getPropertyValue(VISUAL_HEIGHT),
      top: html.style.getPropertyValue(VISUAL_TOP),
      composer: html.style.getPropertyValue(COMPOSER_BOTTOM),
    };
    const sync = () => {
      const viewport = window.visualViewport;
      const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
      const occludedBottom = viewport
        ? Math.max(0, layoutHeight - viewport.height - viewport.offsetTop)
        : 0;
      const active = document.activeElement;
      const editing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      const keyboardOpen = Boolean(viewport && editing && occludedBottom > 80);

      // Installed iOS PWAs may keep VisualViewport shorter than the app window
      // after the keyboard has gone away. If that shorter height drives the
      // fixed shell, html/body shows through as a same-colour bottom strip.
      // Follow VisualViewport only while it represents a real keyboard.
      const height = keyboardOpen && viewport ? viewport.height : layoutHeight;
      const top = keyboardOpen && viewport ? viewport.offsetTop : 0;

      html.style.setProperty(VISUAL_HEIGHT, `${Math.round(height)}px`);
      html.style.setProperty(VISUAL_TOP, `${Math.round(top)}px`);
      html.style.setProperty(
        COMPOSER_BOTTOM,
        keyboardOpen
          ? "8px"
          : "max(calc(env(safe-area-inset-bottom, 0px) - 14px), 8px)",
      );
    };

    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    document.addEventListener("focusin", sync);
    document.addEventListener("focusout", sync);

    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
      document.removeEventListener("focusin", sync);
      document.removeEventListener("focusout", sync);
      for (const [name, value] of [
        [VISUAL_HEIGHT, previous.height],
        [VISUAL_TOP, previous.top],
        [COMPOSER_BOTTOM, previous.composer],
      ] as const) {
        if (value) html.style.setProperty(name, value);
        else html.style.removeProperty(name);
      }
    };
  }, []);
}

/** Query-gated on-device readout for iOS standalone viewport bugs. */
export function useViewportDebug(enabled: boolean): string | null {
  const [readout, setReadout] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    Object.assign(probe.style, {
      position: "fixed",
      inset: "auto 0 0 auto",
      width: "0",
      height: "0",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      pointerEvents: "none",
      visibility: "hidden",
    });
    document.body.appendChild(probe);

    let frame = 0;
    const n = (value: number | undefined) =>
      typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "-";
    const rect = (selector: string) => {
      const value = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
      return value ? `${n(value.top)}..${n(value.bottom)} h${n(value.height)}` : "-";
    };
    const update = () => {
      frame = 0;
      const vv = window.visualViewport;
      const html = document.documentElement;
      const style = getComputedStyle(html);
      const active = document.activeElement;
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setReadout(
        [
          `mode ${standalone ? "standalone" : "browser"} focus ${active?.tagName ?? "-"}`,
          `screen ${n(screen.width)}x${n(screen.height)} availH ${n(screen.availHeight)}`,
          `inner ${n(window.innerWidth)}x${n(window.innerHeight)} outerH ${n(window.outerHeight)}`,
          `client ${n(html.clientWidth)}x${n(html.clientHeight)} bodyH ${n(document.body.clientHeight)}`,
          `vv h${n(vv?.height)} top${n(vv?.offsetTop)} pageTop${n(vv?.pageTop)} scale${n(vv?.scale)}`,
          `safeB ${getComputedStyle(probe).paddingBottom} cssH ${style.getPropertyValue(VISUAL_HEIGHT).trim() || "-"}`,
          `cssTop ${style.getPropertyValue(VISUAL_TOP).trim() || "-"} cssBottom ${style.getPropertyValue(COMPOSER_BOTTOM).trim() || "-"}`,
          `main ${rect("[data-kimi-chat-root]")}`,
          `composer ${rect("[data-kimi-composer]")}`,
          `row ${rect("[data-kimi-composer-row]")}`,
        ].join("\n"),
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    document.addEventListener("visibilitychange", schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      document.removeEventListener("visibilitychange", schedule);
      probe.remove();
    };
  }, [enabled]);

  return enabled ? readout : null;
}

export function useFixedViewport(): void {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlHeight: html.style.height,
      bodyHeight: body.style.height,
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    html.style.height = "100%";
    body.style.height = "100%";

    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      html.style.height = prev.htmlHeight;
      body.style.height = prev.bodyHeight;
    };
  }, []);
}
