import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/stores/owner-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Open Graph metadata for the link cards in chat.
//
// The browser cannot read another origin's <head>, so the fetch happens here.
// Owner-gated like the other server routes: this makes outbound requests from
// the deployment's IP, and an open version of it is a general-purpose proxy that
// anyone who finds the URL could aim at an internal address.
//
// Only public HTTP(S) is fetched: private and loopback ranges are refused
// (SSRF), redirects are followed but re-checked, the response is capped, and
// only the four fields a card renders are returned.

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 6000;

const PRIVATE_V4 =
  /^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal")) return true;
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:")) return true;
  if (PRIVATE_V4.test(h)) return true;
  // AWS/GCP/Azure instance metadata.
  if (h === "169.254.169.254" || h === "metadata.google.internal") return true;
  return false;
}

function checkUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (isBlockedHost(u.hostname)) return null;
  return u;
}

function metaBy(html: string, attr: "property" | "name", key: string): string {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*content=["']([^"']*)["']`, "i");
  const m = html.match(re);
  if (m?.[1]) return decodeEntities(m[1]);
  // content before the attribute, which is just as legal
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`, "i");
  const m2 = html.match(re2);
  if (m2?.[1]) return decodeEntities(m2[1]);
  return "";
}

/**
 * When a key is written both ways, `property` wins.
 *
 * Open Graph specifies `property`; `name` is what a site adds on its own.
 * Twitter's tags conventionally go the other way, so both are read — the order
 * is what matters. It is not a nicety: a page can carry a platform logo under
 * `name="og:image"` and the article's own pictures under `property="og:image"`,
 * sometimes on a stricter host that will not serve them to us at all. Taking
 * whichever came first in the document then pins the card to a logo it cannot
 * even fetch.
 */
function pickMeta(html: string, keys: string[]): string {
  for (const key of keys) {
    const v = metaBy(html, "property", key) || metaBy(html, "name", key);
    if (v) return v;
  }
  return "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export async function GET(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const target = new URL(req.url).searchParams.get("url") ?? "";
  const u = checkUrl(target);
  if (!u) {
    return NextResponse.json({ error: "bad_url" }, { status: 400 });
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), {
      signal: ac.signal,
      redirect: "follow",
      headers: {
        // Sites serve their OG tags to crawlers; a browser UA gets an app shell
        // with no metadata at all on several of them.
        "User-Agent": "Mozilla/5.0 (compatible; kimi-room link preview)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    // A redirect chain that lands somewhere private is the same attack as
    // asking for it directly.
    const finalUrl = checkUrl(res.url || u.toString());
    if (!finalUrl) return NextResponse.json({ error: "blocked_redirect" }, { status: 400 });
    if (!res.ok) {
      return NextResponse.json(
        { url: u.toString(), title: u.toString(), site: u.hostname.replace(/^www\./, ""), type: "链接" },
        { status: 200 },
      );
    }

    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        html += decoder.decode(value, { stream: true });
        // The tags live in <head>; there is no reason to pull a whole page.
        if (total > MAX_BYTES || /<\/head>/i.test(html)) {
          void reader.cancel();
          break;
        }
      }
    }

    const title =
      pickMeta(html, ["og:title", "twitter:title"]) ||
      decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "") ||
      u.hostname;
    let image = pickMeta(html, ["og:image", "twitter:image", "twitter:image:src"]);
    if (image) {
      try {
        const abs = new URL(image, finalUrl);
        // An http picture on an https card is blocked as mixed content before
        // the request is even made. Try the same host over https; if it will
        // not answer there, the card falls back to its diamond.
        if (abs.protocol === "http:") abs.protocol = "https:";
        image = checkUrl(abs.toString()) ? abs.toString() : "";
      } catch {
        image = "";
      }
    }
    const site = pickMeta(html, ["og:site_name"]) || u.hostname.replace(/^www\./, "");
    const ogType = pickMeta(html, ["og:type"]);
    const type = ogType === "video" || ogType === "video.other" ? "视频" : "图文";

    return NextResponse.json(
      { url: u.toString(), title: title.slice(0, 200), image, site, type },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    );
  } catch {
    return NextResponse.json(
      { url: u.toString(), title: u.toString(), site: u.hostname.replace(/^www\./, ""), type: "链接" },
      { status: 200 },
    );
  } finally {
    clearTimeout(timer);
  }
}
