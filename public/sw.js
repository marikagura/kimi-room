// kimi PWA service worker — minimal, hand-written.
// Strategy:
//   - /api/auth/* + /api/chat/* + /api/auth/recovery: network only (auth/SSE 不能 cache)
//   - /api/*: network-first, fall back to cache (read API 离线显示上次)
//   - /_next/static, /icon-*, /apple-touch-icon, /images, /fonts: cache-first
//     (immutable assets, 跨 deploy 用 hash 自动 invalidate)
//   - everything else: stale-while-revalidate (page HTML 离线显示, 同时后台
//     刷新)
//
// Cache 名带版本, 升级 SW 时旧 cache 自动 unregister + 清掉.

const VERSION = "v55-2026-07-02"; // v0.31 · stale since v0.17 — bump per release so activate cleanup reclaims old runtime caches

const APP_SHELL_CACHE = `kimi-shell-${VERSION}`;
const RUNTIME_CACHE = `kimi-runtime-${VERSION}`;
const API_CACHE = `kimi-api-${VERSION}`;

// 安装时预 cache — 仅 public static asset. 之前 ["/", "/room"] 是 auth-
// gated path, SW install 时 fetch 它们 → proxy 302 跳 /backstage/login
// → cache stores follow-redirected response → 后续 /room 请求 SWR 返
// 这个 cached 假 response 给 navigation → browser "served by SW has
// redirections" 报错 (owner Safari 中招).
const APP_SHELL = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {
        /* 失败不阻塞 install — 单条 404 不要 cause 整体 fail */
      }),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("kimi-") && !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // 只 cache GET

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 只本域

  // 不 cache 的: auth + chat + recovery (auth flow / SSE)
  if (
    url.pathname.startsWith("/api/auth/") ||
    url.pathname.startsWith("/api/chat") ||
    url.pathname === "/api/auth/recovery"
  ) {
    return; // network-only, 默认 fallthrough
  }

  // 其他 /api/*: network-first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // immutable assets cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.(png|jpg|jpeg|gif|svg|webp|woff2?|ttf|otf|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // Navigation requests (HTML document loads) — network-first so cookie-driven
  // theme switches show up immediately. Falls back to cache when offline.
  // Without this, stale-while-revalidate would render the previous theme
  // and refresh in background (owner: memory→/room shows night even after
  // theme=day cookie set).
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
    return;
  }

  // RSC / data fetches / other non-static: stale-while-revalidate (fast +
  // offline-tolerant).
  event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
});

// Re-create a Response without the .redirected flag. Navigation requests
// (HTML page loads) cannot consume a redirected response from a service
// worker — browser throws "redirected response served by ServiceWorker".
// Happens when proxy middleware 302s un-authed Safari to /backstage/login.
function cleanRedirect(res) {
  if (!res || !res.redirected) return res;
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res.ok && !res.redirected) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone()).catch(() => {});
    }
    return cleanRedirect(res);
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: "offline", cached: false }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok && !res.redirected) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone()).catch(() => {});
    }
    return cleanRedirect(res);
  } catch {
    return new Response("offline asset", { status: 503 });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cached = await caches.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res.ok && !res.redirected) {
        caches
          .open(cacheName)
          .then((cache) => cache.put(req, res.clone()).catch(() => {}));
      }
      return cleanRedirect(res);
    })
    .catch(() => null);

  return cached ?? (await fetchPromise) ?? new Response("offline", { status: 503 });
}
