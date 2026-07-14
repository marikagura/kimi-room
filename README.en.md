> 中文: ./README.md

# kimi-room

![license](https://img.shields.io/badge/license-AGPL%20v3-b13a5a?style=flat-square)
![pwa](https://img.shields.io/badge/pwa-ready-b13a5a?style=flat-square)
![status](https://img.shields.io/badge/status-attending-b13a5a?style=flat-square)

a room for one person and her other one.

An open-source companion PWA. Six rooms — assemble them yourself: each is an
addon (a building block); pick which six sit on the home grid in
`/backstage/settings`, the rest fall to the bottom (see [ADDONS.en.md](ADDONS.en.md)).
**Atlas** and **Ephemera** ship built-in. Your data lives in your browser. No server, no domain,
no data collection. Code AGPL v3, artwork CC BY-NC.

> **Just want to use it?** → [QUICKSTART.en.md](QUICKSTART.en.md) · 5 minutes · one-click deploy
> **Want to change it?** Hand this whole README to your AI — it'll help.

---

## Two paths

### Path A: I just have an API key

Take [QUICKSTART](QUICKSTART.en.md):
1. One-click Vercel deploy
2. Fill your LLM endpoint + key in /settings
3. DONE. Data lives in your browser's IndexedDB; switching machines loses it.

### Path B: I have a VPS and want a full system

You want more than a shell. You want server-side persistence, an autonomous
loop, Telegram, ops.

kimi-room is the **frontend shell**. Its data layer is pluggable:

```
src/lib/stores/types.ts        ← the 11 store interfaces (+ blob)
src/lib/stores/idb-adapter.ts  ← default IndexedDB (browser-local)
src/lib/stores/index.ts        ← where you swap the adapter
```

Swap in your own backend: implement the `AdapterBundle` interface, point it at
your Supabase / Postgres / Obsidian / Notion / whatever DB. The interface is
fully defined in `types.ts`.

The author has open-sourced that **memory engine** as
**[kimi-core](https://github.com/marikagura/kimi-core)**. Once it is running, set
`NEXT_PUBLIC_KIMI_BACKEND=core` + `KIMI_CORE_URL` + `KIMI_API_KEY`, and the room
redirects to it as its memory engine; chat generation continues to use your own
official subscription / API. The two compose. The distinction between RAG and
redirect is documented in **[docs/BACKENDS.en.md](docs/BACKENDS.en.md)**.

Beyond this, a full deployment typically also builds:
- **An autonomous loop** (dream / intel / scheduler — let the system wake on its
  own, process mail on its own, write its own diary)
- **A domain** (Vercel gives you .vercel.app; set a custom domain in the dashboard)

The author's canon version → [kimi-to.com/about](https://kimi-to.com/about)

---

## Every module is changeable

This is a shell. Every room can wire to your own backend, change its logic, or be
deleted. Hand this section, plus what you want changed, to your AI:

| module | default | can become |
|--------|---------|------------|
| **Heartbeat** (score/sky) | local scoring, manual | your VPS auto-scoring, cloud sync. Scoring logic entirely yours |
| **Keepsakes** | IndexedDB photos + text | cloud sync (Supabase / S3 / anything) |
| **Study** | local bookshelf + "read-together" LLM feature | cloud sync. Drop "read-together" if you don't want it |
| **Calendar** | manual input + local storage | any calendar API (not just Google). Wellbeing data can be auto-collected from app usage |
| **Memory** | local IndexedDB | your DB. Review flow editable or removable |
| **Disc** | local chat screenshots + playlist | archive to cloud |
| **Atlas** (addon · travel log) | one static demo trip · iron-tracery window opens to reveal the image | wire your own source (DB / MDX / API), set `imageUrl` to a real image; or tuck it away in /settings |
| **Ephemera** (addon · keepsake papers) | 21 "push-as-paper" genres · one neutral fictional demo | wire your own papers (core / DB / API) + VAPID lock-screen push (see [docs/EPHEMERA.en.md](docs/EPHEMERA.en.md)); or tuck it away in /settings |
| **Backstage** | fixed /ops page | add any ops panel you want |
| **All manual inputs** | hand-filled | all replaceable with automation. Candles via app_open, sleep via sensors, finance via bank API |
| **Character / RP features** | character config in /settings | deletable wholesale. Tell your AI "remove all character and RP features" |

**Once you wire a VPS, the API-key config in /settings isn't needed** — LLM calls
go through your gateway, not the browser.

---

## Context for the AI

If you hand this repo to ChatGPT / Claude / any AI to change it, tell it:

- This is a Next.js App Router + TypeScript project
- The data layer is in `src/lib/stores/` — structured dashboard data (11 stores + blob) goes through the `StoreContract<T>` interface; calendar day-grid, heartbeat, playlist, and finance currently live in raw localStorage and do not sync through the server adapters (back up via the /backstage/ops full export)
- LLM calls are in `src/lib/llm-client.ts` — OpenAI chat-completion format
- The system prompt is in `src/lib/system-prompt.ts` — `{{user}}` `{{char}}` template vars
- The visual theme is in `src/app/globals.css` @theme — Mucha dark-gilt art style
- Persona is edited on the /settings page (name, avatar, prompt)
- Every module lives independently under `src/app/room/`

Common changes:
- "Change him to her" → pronoun in `system-prompt.ts` + the name in /settings
- "Change colors" → `globals.css` @theme values
- "Add a module" → `src/app/room/<new>/page.tsx` + a new `src/components/` component · how an addon reaches the home grid: [ADDONS.en.md](ADDONS.en.md)
- "Wire my backend" → write a new adapter implementing `AdapterBundle`
- "Remove RP features" → delete the character bits in /settings + the persona template in system-prompt.ts

---

## Six rooms

| # | room | content |
|---|------|---------|
| I | Heartbeat | memory star-chart + emotion score |
| II | Keepsakes | one-line keepsakes + photos |
| III | Study | bookshelf + reading with you |
| IV | Calendar | calendar + finance + sleep |
| V | Memory | memory review |
| VI | Disc | past conversations + playlist |

---

## Dev

```bash
npm install
npm run dev
# http://localhost:3000
```

## Structure

```
src/app/          routes (/room/* + /chat + /backstage + /playlist + /settings)
src/components/   UI (mucha / heartbeat / calendar / study / disc / ...)
src/lib/          stores (IDB) + LLM client + palettes + utils
public/icons/     41 SVG icons (rose / fox / etc.)
public/fonts/     Cormorant Garamond + Noto Serif SC/JP
public/images/
├── mood/         ambient vibe (ships with ~30 default JPGs · NOTICE.md)
├── portraits/    drop your own (self + companion JPG)
├── scenes/       drop your own (chat scene backgrounds)
└── timeline/     drop your own (anniversary imagery)
```

## License

Code: [AGPL v3](LICENSE) © 2026 marikagura. Open source — clone / fork / modify /
self-host freely; derivatives and network services must **stay open** (copyleft).

**Please don't use it commercially.** The author would rather this not be
commercialized (sold, run as a paid service); for commercial use, ask first.

Artwork (the hand-drawn gold-line SVG / PNG — fox, roses, …):
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), attribution +
non-commercial; `entry-motion` is a brand mark, reserved — replace it. Third-party
ambient images and fonts are covered in [NOTICE.md](NOTICE.md).

Full docs → [manual](https://kimi-to.com/about/wiki)

## Images

- Drop compressed JPG/PNG into the right subdir.
- Each file **<500KB**. Use [squoosh.app](https://squoosh.app) or ImageOptim.
- Filenames: lowercase + hyphens only. `mood-vienna-piano.jpg`, no spaces / CJK / caps.
- MJ originals live elsewhere (iCloud / Dropbox); commit the compressed web-size copy only.
- Commit in batches: `add: mood images batch 1 (vienna + ocean)`.

## Design system

Colors (see `src/app/globals.css` `@theme`):

- `base` `#0c0c0c` · `deep-charcoal` `#1a1a1a` · `text` `#d8d0c8`
- `muted-gold` `#b8a070` · `accent-warm` `#c4a060`
- `muted-rose` `#9a7a7a` · `deep-red` `#8b3a3a` · `silver` `#b8b0a8`

Fonts: Cormorant Garamond (serif) / Noto Serif JP / Noto Sans JP (body).

Global treatment: `filter: saturate(0.85) brightness(0.92)` on all `<img>`, SVG grain overlay at ~4% opacity `mixBlendMode: overlay`.

## Deploy

```bash
vercel login
vercel           # .vercel.app preview URL
```

Set `NEXT_PUBLIC_KIMI_GATEWAY` env var to your own MCP/backend URL if wiring beyond client-side IDB + LLM proxy. Custom domain optional — point any owned domain at the Vercel project.
