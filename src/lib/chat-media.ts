// Images sent in chat.
//
// A picked file is downscaled in the browser and stored as a blob in IndexedDB;
// the message only carries the blob id plus its dimensions. Keeping pixels out
// of the message means the session (which is mirrored into localStorage, a few
// megabytes total) does not blow its quota after two photos, and the thumbnail
// still survives a reload.
//
// Nothing is uploaded. The picture stays on the device unless the operator has
// wired a backend that syncs it.

import { idbDelete, idbGet, idbPut, newId, nowISO } from "@/lib/idb";

export type ChatImage = {
  id: string;
  w: number;
  h: number;
  /** Object URL for the current page; re-created on load, never persisted. */
  url?: string;
};

type StoredImage = {
  id: string;
  createdAt: string;
  updatedAt: string;
  blob: Blob;
  w: number;
  h: number;
};

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/** Downscale to fit MAX_EDGE, re-encode as JPEG unless it is a PNG with alpha. */
async function downscale(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  // An untouched small image is left exactly as it is — no generation loss on a
  // screenshot that was already the right size.
  if (scale === 1 && file.size < 900_000) {
    bitmap.close();
    return { blob: file, w, h };
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return { blob: file, w: bitmap.width, h: bitmap.height };
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, JPEG_QUALITY),
  );
  return { blob: blob ?? file, w, h };
}

/**
 * Store a picked file and hand back what a message should carry. `onProgress`
 * reports 0–1 so the composer can draw the ring gauge; the work here is local
 * so it moves in a few steps rather than continuously.
 */
export async function putChatImage(
  file: File,
  onProgress?: (frac: number) => void,
): Promise<ChatImage> {
  onProgress?.(0.15);
  const { blob, w, h } = await downscale(file);
  onProgress?.(0.7);
  const id = newId();
  const rec: StoredImage = {
    id,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    blob,
    w,
    h,
  };
  await idbPut("blob", rec);
  onProgress?.(1);
  return { id, w, h, url: URL.createObjectURL(blob) };
}

const urlCache = new Map<string, string>();

/** Object URL for a stored image, cached so a re-render does not re-read IDB. */
export async function chatImageUrl(id: string): Promise<string | null> {
  const hit = urlCache.get(id);
  if (hit) return hit;
  const rec = await idbGet<StoredImage>("blob", id).catch(() => null);
  if (!rec?.blob) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(id, url);
  return url;
}

export async function deleteChatImage(id: string): Promise<void> {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
  await idbDelete("blob", id).catch(() => {});
}

// ============================================
// links
// ============================================

export type LinkPreview = {
  url: string;
  title: string;
  image?: string;
  site?: string;
  type?: string;
};

/** First bare URL in a message, if the message is essentially just that link. */
export function detectLink(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/);
  if (!m) return null;
  // A link buried in a paragraph stays inline text; a link that is the message
  // (possibly with a few words around it) becomes a card.
  return text.trim().length <= m[0].length + 24 ? m[0] : null;
}

const previewCache = new Map<string, LinkPreview | null>();

export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  if (previewCache.has(url)) return previewCache.get(url) ?? null;
  try {
    const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as LinkPreview;
    previewCache.set(url, data);
    return data;
  } catch {
    // A site that blocks scraping still gets a card, just without the picture.
    const fallback: LinkPreview = {
      url,
      title: url,
      site: safeHost(url),
      type: "链接",
    };
    previewCache.set(url, fallback);
    return fallback;
  }
}

export function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
