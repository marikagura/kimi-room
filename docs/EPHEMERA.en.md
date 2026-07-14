> 中文：./EPHEMERA.md

# Ephemera

`/room/ephemera` — a push notification can also be a **paper**: typeset while you sleep, landing silent on the lock screen; you open it at dawn and it prints out line by line like a thermal receipt, then files itself into a drawer you can flip back through.

It is an addon (a bottom link by default; see [ADDONS.en.md](../ADDONS.en.md)). The open-source build is fed a neutral, fictional demo set — beautiful out of the box, no backend, no private data.

---

## What a paper is

The data layer is one `Paper`: `kind` selects the layout, and the rest of the fields are a superset across genres — each layout reads only the few it needs.

```ts
type Paper = {
  date: string;      // archive key + date (YYYY-MM-DD)
  kind?: string;     // genre slug; omit = the daily sheet
  oneline?: string;  // closing line
  issuer?: string;   // signature — your companion's name goes here (a placeholder "—" in the demo)
  recipient?: string;
  // …each genre's own fields (star chart / stamps / declaration table / grades…)
};
```

- Layouts live in `src/components/ephemera/EphemeraClient.tsx`; a `switch (paper.kind)` dispatches to the matching `*Sheet` component. An unbuilt `kind` falls back to the daily sheet.
- The catalogue and demo data are in `src/lib/ephemera-demo.ts` (`GENRES` is the 21-genre registry, `DEMO_PAPERS` one fictional sample per genre).
- The print animation is pure CSS `clip-path` (`@keyframes pp-print`, unveiling from masthead to signature, the same direction a thermal printer feeds paper) — no state involved.

---

## Genre catalogue (21)

`trigger` is a hint for when you wire a backend: `daily` = the default each day; `rule` = decided by a calendar or rule (see `ephemera-editor.ts`); `occasion` = earned by the backend's judgment layer, not an everyday thing.

| Group | Genre | Trigger | Layout |
|---|---|---|---|
| Daily | 醒来纸 wake paper | daily | masthead + last night / today's pins / one line |
| Daily | 周谱 week score | rule | a week drawn as one staff of music; note height = each day's key |
| Daily | 气象简报 forecast | rule | today's headline + three-day strip, line-drawn weather icons |
| Daily | 残月黄历 almanac | rule | large date + waning moon + do / don't columns |
| Travel | 明信片 postcard | occasion | message + rose stamp + sealed postmark; cream / antique-gold paper |
| Travel | 登机牌 boarding pass | occasion | ticket header + field grid + barcode |
| Travel | 行程单 itinerary | occasion | arch masthead + bilingual legs |
| Travel | 护照盖章页 passport | occasion | stamp grid (assorted rings) + today's new stamp |
| Travel | 海关申报单 customs | occasion | declaration table + checkboxes + cleared stamp |
| Promise | 欠条 IOU | occasion | clause layout, itemized |
| Promise | 票根 ticket stub | occasion | main + perforation + vertical stub |
| Urgent | 电报 telegram | occasion | all-caps monospace + STOP breaks |
| Urgent | 号外 extra | occasion | reverse-black headline + seal |
| Body | 处方笺 prescription | occasion | ℞ + dosage layout |
| Body | 健診表 check-up | rule | A–E grade rings + reviewed seal |
| Night | 夜航日志 night log | occasion | timestamped rows + night-watch sign |
| Night | 某夜星空 star chart | rule | star map + named constellations + that night's memory star |
| Extra | 诗 poem | occasion | free vertical setting + waning moon |
| Extra | 御神签 fortune | occasion | 大吉 (great fortune) + reading |
| Extra | 印记徽 emblem | rule | crest masthead, for anniversaries |
| Extra | 节目单 programme | occasion | arch masthead + acts + a planet |

The visual motifs (fox, rose, B-612, sunset, lamplighter) are drawn from *The Little Prince*. Art assets are in `public/ephemera/assets/`, in a 1-bit thermal aesthetic (no grayscale, no gold — except the two warm paper tones the postcard keeps).

---

## Wire your own data

`src/app/room/ephemera/page.tsx` feeds `DEMO_PAPERS` to `EphemeraClient` by default. To swap in real data:

1. **Read-only render**: replace `DEMO_PAPERS` with the `Paper[]` your source returns (read from kimi-core in core mode, or your own DB / API). The layouts don't change.
2. **Rule layer**: `pickPaper` in `src/lib/ephemera-editor.ts` is an optional selection layer — give it signals like the calendar or an anniversary and it decides which genre today gets (an auspicious date → almanac, an anniversary → emblem, and so on). Use it or not.
3. **Signatures**: `issuer` / `recipient` come from your own data (i.e. your own prompt); the demo uses the placeholder "—" and hardcodes no name.

Every genre marked `built: true` in `GENRES` has a real layout; a `kind` that matches none falls back safely to the daily sheet.

---

## Push

Lock-screen push stays off until you paste your own VAPID public key (`VAPID_PUBLIC_KEY` in `ephemera-demo.ts`, generated with `npx web-push generate-vapid-keys`). While empty, "开启通知 (enable notifications)" is only a hint and never actually subscribes — the default build talks to no server.

The service worker (`public/sw.js`) carries `push` / `notificationclick` handlers: opening a notification deep-links to `/room/ephemera?d=<date>`, straight to that paper. The subscribe endpoint `/api/push/subscribe` only does anything once you wire a backend of your own.

---

## Privacy

The demo data is fictional and neutral: no real person, no real event, no "on this day" claim. `issuer` / `recipient` are placeholder signatures. Nothing this addon ships points to a real person.
