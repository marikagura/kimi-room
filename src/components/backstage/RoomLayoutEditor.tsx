"use client";

// Assemble the /room landing. The grid is always six cards ("六个房间"): tick the
// six windows you want as cards. Anything unticked drops to the bottom as a small
// text link (same register as backstage). The choice is saved to the
// kimi-room-layout cookie via a server action and picked up on the next render.

import { useEffect, useState } from "react";
import {
  ROOM_BLOCKS,
  ROOM_LAYOUT_COOKIE,
  MAX_TILES,
  resolveLayout,
  serializeLayout,
  type Slot,
} from "@/lib/room-blocks";
import { setRoomLayout } from "@/lib/room-layout-actions";

function readPlainCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export function RoomLayoutEditor() {
  // start from registry defaults; hydrate from the cookie after mount.
  const [slots, setSlots] = useState<Record<string, Slot>>(() =>
    Object.fromEntries(ROOM_BLOCKS.map((b) => [b.id, b.defaultSlot])),
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const resolved = resolveLayout(readPlainCookie(ROOM_LAYOUT_COOKIE));
    setSlots(Object.fromEntries(resolved.map((r) => [r.block.id, r.slot])));
  }, []);

  const tileCount = ROOM_BLOCKS.filter((b) => (slots[b.id] ?? b.defaultSlot) === "tile").length;

  async function toggle(id: string) {
    const cur = slots[id] ?? ROOM_BLOCKS.find((b) => b.id === id)!.defaultSlot;
    if (cur !== "tile" && tileCount >= MAX_TILES) return; // grid is full
    const next = { ...slots, [id]: cur === "tile" ? ("link" as Slot) : ("tile" as Slot) };
    setSlots(next);
    const value = serializeLayout(ROOM_BLOCKS.map((b) => ({ id: b.id, slot: next[b.id] })));
    await setRoomLayout(value);
    setSaved(true);
  }

  return (
    <section className="mt-24 max-w-md mx-auto flex flex-col gap-4">
      <h2 className="text-xs tracking-widest uppercase text-muted-grey">房间布局</h2>
      <p className="text-xs text-muted-grey">
        首页是<span className="italic">六个房间</span>。勾选要当卡片的窗口（最多 {MAX_TILES} 个）。
        没勾的自动落到底部，变成同 backstage 的小字链接。默认 6 个房间 + Atlas 在底部。
        当前 {tileCount}/{MAX_TILES}{saved ? " · 已保存" : ""}。
      </p>
      <div className="flex flex-col gap-2">
        {ROOM_BLOCKS.map((b) => {
          const isTile = (slots[b.id] ?? b.defaultSlot) === "tile";
          const full = !isTile && tileCount >= MAX_TILES;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b.id)}
              disabled={full}
              aria-pressed={isTile}
              className={`flex items-center justify-between gap-3 border-b border-current/15 py-2 text-left ${
                full ? "opacity-35 cursor-not-allowed" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="font-serif text-lg leading-tight">{b.name}</div>
                <div className="text-[9px] tracking-[3px] text-muted-grey uppercase">{b.sub}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] tracking-widest uppercase text-muted-grey">
                  {isTile ? "卡片" : "底部"}
                </span>
                <span
                  aria-hidden
                  className={`flex h-5 w-5 items-center justify-center border text-[11px] ${
                    isTile ? "border-current" : "border-current/30"
                  }`}
                >
                  {isTile ? "✓" : ""}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
