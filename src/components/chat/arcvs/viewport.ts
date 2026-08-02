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

import { useEffect, useLayoutEffect } from "react";

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
