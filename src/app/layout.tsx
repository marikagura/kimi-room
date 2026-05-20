import type { Metadata } from "next";
import "./globals.css";
import { EntryMotion } from "@/components/EntryMotion";
import { GrainOverlay } from "@/components/GrainOverlay";
import { PageTransition } from "@/components/PageTransition";
import { PullToRefresh } from "@/components/PullToRefresh";
import { RegisterSW } from "@/components/RegisterSW";
import { SwipeBack } from "@/components/SwipeBack";

// Fonts self-hosted at /fonts/*.woff2; @font-face declarations in
// /fonts/kimi-fonts.css. Replaced `next/font/google` so the build doesn't
// hit Google Fonts API — required for 大陆 self-host / 开源 builds.
// font-family stacks are declared in globals.css (:root vars).

// V2 generic metadata · fork 后 改成 own title/description.
export const metadata: Metadata = {
  title: "kimi · room",
  description: "private companion room",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "kimi",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "kimi · room",
    description: "private companion room",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "kimi · room",
    description: "private companion room",
  },
};

// themeColor handled by inline <meta> + client script below — needs to follow
// cookie-driven day/night and survive iOS Safari bfcache restore.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

const THEME_COLOR_DAY = "#ebdfd4";
const THEME_COLOR_NIGHT = "#0a0506";

// Inline script: runs synchronously before paint. Re-sync data-theme/theme-color
// from cookie on every navigation. On bfcache restore (back button on iOS PWA),
// if cookie says day but the restored snapshot was night, reload — otherwise
// /room shows stale night HTML even though the cookie has been flipped.
const THEME_SYNC_SCRIPT = `
(function(){
  function readCookieTheme(){
    var m = document.cookie.match(/(?:^|;\\s*)kimi-theme=([^;]+)/);
    return (m && m[1] === 'day') ? 'day' : 'night';
  }
  function apply(t){
    var html = document.documentElement;
    if (html.dataset.theme !== t) html.dataset.theme = t;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'day' ? '${THEME_COLOR_DAY}' : '${THEME_COLOR_NIGHT}');
  }
  apply(readCookieTheme());
  window.addEventListener('pageshow', function(e){
    var t = readCookieTheme();
    if (e.persisted && document.documentElement.dataset.theme !== t) {
      location.reload();
      return;
    }
    apply(t);
  });
})();
`;

// FOUC prevention for EntryMotion. inline script runs sync before paint;
// if EntryMotion 未看过, add html class so CSS hides body content until
// EntryMotion takes over. 否则 /room 内容 一闪 then 被 overlay cover (老婆
// 260517 0034 catch "闪一下眼睛痛"). EntryMotion timeline 完后 remove class.
const ENTRY_GATE_SCRIPT = `
(function(){
  try {
    if (!localStorage.getItem('kimi-entry-seen')) {
      document.documentElement.classList.add('kimi-entry-pending');
    }
  } catch(e) {}
})();
`;

async function readTheme(): Promise<"day" | "night"> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const v = store.get("kimi-theme")?.value;
  if (v && v.trim().toLowerCase() === "day") return "day";
  return "night";
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = await readTheme();
  return (
    <html
      lang="ja"
      data-theme={theme}
      className="h-full antialiased"
    >
      <head>
        {/* Inline bg style — 浏览器第一帧 paint 之前就 apply, 避开
            globals.css fetch + parse 期间 默认 white 闪 (老婆 260517 0043
            catch). day mode 通过 data-theme attr + globals.css rule
            override, 不 react 这条 inline. */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              'html,body{background:#0c0c0c;color:#d8d0c8;margin:0}html[data-theme="day"],html[data-theme="day"] body{background:#ebdfd4;color:#1a0e0a}',
          }}
        />
        <meta
          name="theme-color"
          content={theme === "day" ? THEME_COLOR_DAY : THEME_COLOR_NIGHT}
        />
        <script dangerouslySetInnerHTML={{ __html: ENTRY_GATE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SYNC_SCRIPT }} />
        {/* Preload critical fonts BEFORE fonts.css fetch — 避开 first-paint
            用 fallback 字体, woff2 load 完后 swap reflow 闪 (老婆 260517 0055
            catch "闪了之后字体好像有改变"). 3 个 chunk cover 99% first-paint
            visible text: Cormorant Garamond italic+regular latin (page title
            + module label) + Noto Serif JP latin (中文/日文 body). */}
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtImSqn7B6D.woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqXtKky2F7g.woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/xn7mYHs72GKoTvER4Gn3b5eMbNmuY2Q3X88.woff2"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href="/fonts/kimi-fonts.css" />
        {/* iOS PWA splash · 纯 #0c0c0c 黑底 PNG (no image, just dark bg).
            iOS 默认 splash 是 white, 不 ship link 用户 launch 见白屏闪一下
            (老婆 260517 0039 catch). 仅作 bg 填充, EntryMotion React-level
            overlay 之后接管 entry 视觉. 全 9 size 同一纯黑 PNG. */}
        <link rel="apple-touch-startup-image" media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/apple-splash-1320x2868.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/apple-splash-1290x2796.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/apple-splash-1284x2778.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/apple-splash-1242x2688.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/apple-splash-1206x2622.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/apple-splash-1179x2556.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/apple-splash-1170x2532.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/apple-splash-1125x2436.png" />
        <link rel="apple-touch-startup-image" media="(min-device-width: 768px)" href="/apple-splash-2048x2732-ipad.png" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1179x2556.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <EntryMotion />
        <GrainOverlay />
        <RegisterSW />
        <PullToRefresh />
        <SwipeBack />
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
