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

import { useEffect } from "react";

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
