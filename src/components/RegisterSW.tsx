"use client";

import { useEffect } from "react";

// Register /sw.js 一次. SW 自己处理 cache 策略 (network-first / cache-first /
// stale-while-revalidate). 升级靠版本 string in sw.js.

export function RegisterSW() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (window.location.hostname === "localhost" && process.env.NODE_ENV !== "production") {
      // dev 时也注册, 方便测试 — 但 next dev 偶尔 conflict, 注释掉就 disable
      // return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        console.warn("[sw] register failed:", err?.message ?? err);
      });
    // Ask the browser to mark this origin's storage persistent: without it, IDB +
    // localStorage (chat sessions, calendar days, memories) are BestEffort and the
    // browser may evict them under pressure — iOS also wipes after 7 days of
    // disuse. Best-effort: denial just leaves the default eviction rules.
    if (navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => {});
    }
  }, []);
  return null;
}
