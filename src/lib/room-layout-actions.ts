"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ROOM_LAYOUT_COOKIE } from "./room-blocks";

/**
 * Server Action: persist the room layout choice + revalidate.
 * The settings editor calls this with a plain "id:slot,..." string; we
 * URL-encode it (cookie values reject commas) and store it for a year. Every
 * server render of /room reads it back via resolveRoom().
 */
export async function setRoomLayout(plainValue: string) {
  const store = await cookies();
  store.set(ROOM_LAYOUT_COOKIE, encodeURIComponent(plainValue), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  revalidatePath("/", "layout");
}
