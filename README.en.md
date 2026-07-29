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

---

## Generation backends: direct and -p

Chat generation goes through one `ChatProvider` interface (`src/lib/chat-provider.ts`) with two
implementations behind it:

```
ChatProvider.send(turns, opts) → streaming deltas
  ├─ direct   the browser calls a model endpoint with a key kept in the browser (default)
  └─ -p       the browser calls this deployment's /api/p, which runs the local Claude CLI
```

kimi-core memory retrieval (RAG) is orthogonal to both: it only adds retrieved memory to the
prompt, and either backend can be used with or without it.

The interface does not distinguish the two. Picking a profile in the model switcher picks the
backend.

### -p mode

`-p` hands the reply to **the Claude CLI on the machine hosting this deployment**. The reply then
carries whatever that environment already has: its CLAUDE.md, its MCP servers, its subscription
quota. This repository ships no Claude configuration of its own; everything in the harness comes
from the deployer's environment.

Turning it on (`.env`):

```
CLAUDE_P_ENABLED=1
CLAUDE_P_BIN=claude              # path to the CLI, if not on PATH (Claude's only — see below)
CLAUDE_P_CWD=/home/you           # working directory (default: home)
CLAUDE_P_PERMISSION_MODE=default # default | acceptEdits | bypassPermissions | plan
CLAUDE_P_ALLOWED_TOOLS=          # empty = text only
```

Without `CLAUDE_P_ENABLED`, or with no CLI on the machine, the option is **absent** from the model
switcher — not greyed out, not there.

Multi-turn: the `session_id` from the first response is stored on the thread and passed as
`--resume` afterwards. One room thread maps to one CLI session; a branch does not inherit its
parent's session, and a rewind drops the session handle so the next send matches what is on screen.

Models: seven pinned ids are passed to `--model` — `claude-opus-5` / `-4-8` / `-4-7` / `-4-6`,
`claude-sonnet-5` / `-4-5`, `claude-fable-5`. Pinned rather than floating aliases like `opus`, so
that generations coexist: an alias always means the newest one, and the older ones lose their entry
the moment a release lands. The cost is that this list goes stale — it is one array, and an id the
installed CLI does not know fails loudly instead of quietly running something else.

**Boundary.** `-p` spends the deployer's subscription, so:

- `/api/p` checks the owner session first (the same gate `/api/core` and `/api/tts` use); without
  it, 401. A visitor who finds the deployment URL never reaches the CLI.
- Nothing from the browser enters a shell. There is no shell: `spawn()` takes an argv array and the
  prompt goes over stdin. `model` is matched against a fixed id set and `resume` against a UUID
  shape; anything else is rejected rather than sanitized and passed along.
- The route writes no transcript to disk. The CLI keeps its own session store on the deployer's
  machine — that is what `--resume` reads, and it is a feature rather than an export.
- With `CLAUDE_P_ALLOWED_TOOLS` empty the reply is text only. Opening it up lets the chat read and
  write real files; weigh that yourself.

### The cost bar

A row of three at the head of the page: cache hit rate (`MEMORIA`), context used against the window
(`CONTEXTVS`), and today's spend (`IMPENSA`). Cache share and price appear only when the backend
reports them — `-p` does, most raw API endpoints do not — and a missing reading is left out rather
than shown as zero. The context gauge turns amber past 85% and red past 95%.

That reading is a **gauge, not a governor**: the room sends the thread's messages in full, without
trimming or merging, and keeps sending once the gauge is full — the real ceiling is whatever the
upstream endpoint enforces. The `128K / 200K / 1M` steps only set the gauge's denominator; changing
one does not change what is sent. (`-p` is separate — its history lives in the CLI's own session
store on the deployer's machine, which is what `--resume` reads.)

Putting a ceiling on it is yours to add: what gets sent is assembled in `streamReply()` in
`src/components/chat/ChatRoom.tsx`, at the step mapping `msgs` into `turns` — trim from the oldest
there, to whatever budget you keep. There is no built-in default because the right number depends on
which endpoint you point this at and what it charges; guessing one for you would be worse than
leaving it out.

---

## The chat surface

One screen, three readings — switched from the header and the `⋯` drawer:

- **Night (NOX)** — near-black ground, gold.
- **Day (DIES)** — warm paper ground, rose. The sun/moon control swaps them; the two colourways are
  one tree and the layout does not move.
- **Avatars** — a switch. Off, messages hang from a hairline spine with a node per turn; on, round
  portraits sit beside the bubbles (the other voice left, yours right). With no picture configured
  each side draws its own mark, so turning avatars on never leaves a hole. Portraits can be picked
  in the drawer (stored in IndexedDB) or pointed at a path under `public/` in code.

Colour meanings are fixed: rose is you and sits right, gold is the other voice and sits left, grey
is the system. New elements take their side from that.

Under every reply, three bare marks: **copy** · **fork (FVRCA)** · **rewind (RETRO)** — no frames,
no labels, solid only on hover.

- Fork branches everything up to that message into a new thread. The original is untouched and stays
  in the history list. No confirmation: nothing is lost.
- Rewind drops that message and everything after it, and puts the message that prompted it back in
  the composer. **The one action that asks first**, because it removes turns.
- Regenerate produces another candidate; the old one goes into a pool rather than being lost, and
  `‹ n/m ›` moves between them.

Also: **listen** (via `/api/tts`, quiet without an ElevenLabs key), image upload (front end only,
see below), and link cards built from og tags when a link is
posted on its own (no og:image falls back to a paper ground and a diamond, never an empty frame).
The scraped title travels with the turn as well — drawn only on the card, what reaches the model is
still a URL it cannot open.

The `COGITATIO` box counts up a second at a time while streaming and stops at its total. Tool calls
get one line each with three states — running shows a soft dot, done a tick and the elapsed time,
failed keeps the message in place in the error colour (quieter, never hidden) — and open to show
their arguments.

The background can be swapped for any picture in `public/images/mood` from the drawer, in two fits:
**whole** (the full frame over a blurred bleed of itself, nothing cropped) and **fill** (cropped to
cover).

Body size sits in the same drawer, in four steps. Bubble text and the thinking box follow it; the
latin small-caps labels do not — they are a scale rather than something to read, and enlarging them
only breaks the rows apart.

Under `prefers-reduced-motion` every animation stops and the dust disappears; no information is lost.

### codex (another vendor's CLI)

A third generation backend, alongside `-p`: the reply is produced by the **Codex
CLI** on this machine. Opt-in per deployment; unset, it does not appear at all.

```
CODEX_ENABLED=1
CODEX_BIN=codex                  # path, if not on PATH
CODEX_CWD=                        # defaults to the home directory
CODEX_MODELS=                    # empty = whatever ~/.codex/config.toml says
CODEX_SANDBOX=read-only          # workspace-write | danger-full-access
```

`CODEX_MODELS` is empty on purpose: this repository cannot know which models your
account reaches, and a guessed list would just be a menu of errors. Left empty,
the switcher shows one row and the CLI uses its own configured model.

The sandbox defaults to `read-only` — nobody is at the terminal to approve
anything. Opening it further lets the chat write real files.

**Why a separate route rather than `CLAUDE_P_BIN=codex`.** The two CLIs share
nothing but the idea of running an agent locally: Codex's entry point is `codex
exec`, not `-p` (its own `-p` is `--profile`), and it reports `thread.started` /
`item.completed` / `turn.completed` — none of Claude's `stream_event` /
`text_delta` vocabulary. One route serving both would branch on every line. What
they do share is the trust boundary and the frames sent to the browser: the
interface cannot tell which CLI answered.

Two differences from `-p` are visible in the room:

- **No token-level streaming.** `--json` emits whole items, so a reply lands in
  one piece rather than arriving a character at a time.
- **The cache gauge is actually fed.** Every `turn.completed` reports
  `cached_input_tokens`; most raw API endpoints never report it, leaving that
  reading blank.

One non-obvious trap, found by running it and already worked around: `codex exec
resume` is its own subcommand and **does not take `-s`**, so the sandbox is passed
as `-c sandbox_mode=` instead. With the flag form the first turn works and every
turn after it fails.

Adding another vendor (Gemini, Cursor, …) follows this shape: `ChatProvider` in
`src/lib/chat-provider.ts` is the seam, both CLI backends already share one
`cliProvider`, and a third is a route plus a few table entries — nothing existing
has to move.

### Closeout and the fresh window

Two buttons on one row at the bottom of the `⋯` drawer, one job each:

- **新窗口** (fresh window) — opens a new window and nothing else. The old
  conversation stays in the chat history, reachable any time, so there is no
  confirm. Needs no backend; always available.
- **closeout** — has your configured generation backend summarize the window
  (a title within 40 characters, plus the full text), stores it in the room's
  own memory store (browsable and editable at `/room/memory-review`), then
  clears the session and opens a fresh window. Because it writes and clears, it
  confirms once. Without a generation backend the button sits disabled — there
  is nothing to summarize with, and pretending otherwise would just silently
  turn it into the other button.

A failed summary does not block the door: the fresh window opens anyway,
without the memory write.

### Pictures stop at the front end

A picture you pick is downscaled, stored in IndexedDB and drawn in its bubble — but it is **not sent
to the model**. Both backends here take a plain string, which has nowhere to put pixels. The model
only learns that a picture exists.

Making it actually visible is a change on each side, and yours to make:

- `direct`: widen `ChatTurn`'s `content` from a string to an array of content blocks and put the
  image in whichever shape your endpoint expects (Anthropic's `image` block, an OpenAI-compatible
  `image_url`, and so on). Whether it works at all depends on the model you point this at.
- `-p`: the CLI has no channel for an image. The workable route is to write the picture to a
  temporary file, put that path in the prompt, and allow `Read` via `CLAUDE_P_ALLOWED_TOOLS` so it
  can open the file. **That grants the CLI file-read access** — and not only to the picture you
  wrote. Weigh it yourself, and delete the file afterwards.

It is left undone by default because either path depends on your endpoint's exact format or widens a
permission, and neither is this repository's decision to make for you.
