// Room block registry — the assemblable set of windows on the /room landing.
//
// The landing is always SIX rooms ("六个房间"). Each block ships its own route
// under src/app/room/<id>/; this registry decides how it *presents*:
//   - "tile" → one of the 6 cards in the showcase grid. Hard cap: MAX_TILES = 6.
//   - "link" → a small backstage-style text link at the bottom. Anything the user
//              doesn't pick as a card lands here automatically (addons start here).
//
// To add a new window later: ship its route, add one entry here. An addon gives
// defaultSlot "link", so it appears at the bottom until the user swaps it into
// the six. The user's choice is stored in the `kimi-room-layout` cookie and
// edited from /backstage/settings.
//
// This module is client-safe (no next/headers) so both the server page and the
// client editor can import it.

export type Slot = "tile" | "link";

// The landing grid is fixed at six cards. Everything else falls to the bottom.
export const MAX_TILES = 6;

export type RoomBlock = {
  id: string;
  href: string;
  name: string;
  sub: string;
  defaultSlot: Slot;
};

export const ROOM_BLOCKS: RoomBlock[] = [
  { id: "heartbeat", href: "/room/heartbeat", name: "Heartbeat", sub: "& PULSE", defaultSlot: "tile" },
  { id: "keepsakes", href: "/room/keepsakes", name: "Keepsakes", sub: "& POSTCARDS", defaultSlot: "tile" },
  { id: "study", href: "/room/study", name: "Study", sub: "& READING", defaultSlot: "tile" },
  { id: "calendar", href: "/room/calendar", name: "Calendar", sub: "& WELLBEING", defaultSlot: "tile" },
  { id: "memory-review", href: "/room/memory-review", name: "Memory", sub: "& REVIEW", defaultSlot: "tile" },
  { id: "disc", href: "/room/disc", name: "Disc", sub: "& MUSIC", defaultSlot: "tile" },
  { id: "atlas", href: "/room/atlas", name: "Atlas", sub: "& PASSAGE", defaultSlot: "link" },
  { id: "graph", href: "/room/graph", name: "Graph", sub: "& CONSTELLATION", defaultSlot: "link" },
  { id: "ephemera", href: "/room/ephemera", name: "Ephemera", sub: "& OCCASIONS", defaultSlot: "link" },
];

export const ROOM_LAYOUT_COOKIE = "kimi-room-layout";

export const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV"];

const SLOT_CODE: Record<Slot, string> = { tile: "t", link: "l" };
const CODE_SLOT: Record<string, Slot> = { t: "tile", l: "link" };

const byId = (id: string | undefined) => ROOM_BLOCKS.find((b) => b.id === id);

// Plain (already URL-decoded) cookie value → ordered slot list. Cookie order is
// preserved; any registered block missing from the cookie is appended using its
// defaultSlot, so newly shipped blocks show up automatically without a reset.
export function resolveLayout(plainCookie?: string | null): Array<{ block: RoomBlock; slot: Slot }> {
  const order: Array<{ block: RoomBlock; slot: Slot }> = [];
  const seen = new Set<string>();
  if (plainCookie) {
    for (const tok of plainCookie.split(",")) {
      const [id, code] = tok.split(":");
      const block = byId(id?.trim());
      const slot = CODE_SLOT[(code ?? "").trim()];
      if (block && slot && !seen.has(block.id)) {
        order.push({ block, slot });
        seen.add(block.id);
      }
    }
  }
  for (const block of ROOM_BLOCKS) {
    if (!seen.has(block.id)) order.push({ block, slot: block.defaultSlot });
  }
  return order;
}

export function resolveRoom(plainCookie?: string | null): { tiles: RoomBlock[]; links: RoomBlock[] } {
  const order = resolveLayout(plainCookie);
  const tiles: RoomBlock[] = [];
  const links: RoomBlock[] = [];
  // Hard cap: only the first 6 "tile" blocks become cards; everything else
  // (extra tiles from a stale cookie + all "link" blocks) falls to the bottom.
  for (const { block, slot } of order) {
    if (slot === "tile" && tiles.length < MAX_TILES) tiles.push(block);
    else links.push(block);
  }
  return { tiles, links };
}

export function serializeLayout(items: Array<{ id: string; slot: Slot }>): string {
  return items.map((i) => `${i.id}:${SLOT_CODE[i.slot]}`).join(",");
}
