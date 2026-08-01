> 中文: ./BACKENDS.md

# Backends

kimi-room is presentation-oriented: a self-contained interface layer. It does not
provide a memory backend, and is not intended to serve as one. It supports two
deployment modes, which are deliberately distinct.

---

## 1. Local (default)

The default mode. It requires no configuration.

- **Storage.** In-browser IndexedDB. Calendar, keepsakes, study, sleep, and the
  memory worldbook are all held on the device; no data is transmitted.
- **Chat.** Bring-your-own-credentials. The endpoint and key are configured in
  Settings (an official subscription, or any OpenAI-compatible endpoint). The
  chat operates as a transcript with retrieval restricted to the local worldbook.

This mode is intentionally minimal; the interface is not intended to function as
a system of record. A deployment that already maintains a structured memory store
should supply its own persistence layer (see mode 2).

---

## 2. Core — redirecting memory to a running kimi-core

A deployment that operates a structured memory engine can use kimi-room as a
frontend over it — the same architecture as the reference (canon) deployment: a
web frontend over a memory gateway. That engine is available as open source:

> https://github.com/marikagura/kimi-core

In this mode the two concerns separate cleanly and remain composable:

- **Memory** is provided by kimi-core (retrieval and persistence).
- **Generation** continues to use the operator's own subscription or API — the
  same bring-your-own-credentials chat as the local mode.

Integrating kimi-core therefore does not delegate generation to it. The model is
supplied by the operator; kimi-core supplies retrieval. The two are independent.

### Mechanism

```
browser  ──{ name, arguments }──▶  /api/core  ──MCP──▶  kimi-core gateway
(no key)                          (holds key)           (memory_search, …)
```

- Set `NEXT_PUBLIC_KIMI_BACKEND=core`.
- Set `KIMI_CORE_URL` and `KIMI_API_KEY` (server-side only; the browser does not
  receive the key — the `/api/core` route forwards calls with the Bearer token).
- `src/lib/kimi-core-client.ts` exposes `fetchCoreMemoryContext(query)` (retrieval)
  and `persistCoreMemory(key, content)`. Retrieval is wired into the chat by
  `src/lib/core-context.ts` (see below); the write is still a wiring point left
  to the operator. What also ships wired is cross-device transcript sync
  (`chat_write` / `chat_read` / `chat_threads` / `chat_delete`).

### Owner sign-in required

/api/core attaches the operator's `KIMI_API_KEY` and forwards tool calls, so it
is a trust boundary. Besides `KIMI_CORE_URL` + `KIMI_API_KEY`, you must also set
`KIMI_OWNER_PASSWORD` and sign in once at **/backstage/login** (the cookie lasts
30 days) — otherwise every /api/core call returns 401 and sync silently degrades
to local-only behavior. /api/tts sits behind the same gate.

### Retrieval, not a CRUD substitution

kimi-core exposes an agent-text interface: `memory_search` and `reentry` return
human-readable text intended for insertion into a model prompt, not structured
records. kimi-room therefore uses kimi-core for retrieval-augmented chat (text
in, text into the prompt), and not as a structured store behind the dashboards.
The structured dashboards (keepsakes, study, sleep, and so on) stay on local
IndexedDB by default in both modes; optional server-side persistence for them is
available via the reference adapters (supabase / prisma / core) — see
docs/SELF-HOST.md.

### What context rides with a turn

kimi-core defines its context as layers — profile, register, anchors, states,
observations, episodes, topics, events, persona, and a conversation merged across
surfaces. They load independently so any surface composes only the slices it
needs, and they are injected in two places: once at the start of a window, then
per turn for whatever that turn needs. Its `docs/CONTEXT-LAYERS.md` is the list.

The room takes three of them and appends them to the system message:

| layer | source | how often |
| --- | --- | --- |
| time | the local clock + `NEXT_PUBLIC_KIMI_TZ` | one line per turn |
| persona / standing context | kimi-core's `reentry` | once per conversation, cached 30 min |
| memory | `memory_search_safe`, queried with this turn's message | every turn |

The clock line is not filler: a model has no clock, and without it "today" means
whenever its weights were frozen.

The switch (`.env`):

```
NEXT_PUBLIC_KIMI_CORE_CONTEXT=rag   # off | rag (default) | full
NEXT_PUBLIC_KIMI_TZ=Asia/Tokyo      # unset = the device's own zone
```

- `rag` (default) — the clock line plus one retrieval per turn. One query.
- `full` — adds the cold-start block. That is the whole standing context and can
  run to tens of thousands of characters; on the direct backend it is re-sent and
  paid for every turn, which is why it is a choice rather than the default.
- `off` — nothing. A deployment not running kimi-core is already here, with
  nothing to set.

**Direct backend only.** A CLI backend (`-p` / `codex`) gets no injection: it
generates inside the operator's own harness, which already brings whatever that
machine is configured with. A second copy through the system prompt would pay for
the same material twice and let two versions of it disagree in one window.

**`@kimi/context-core` is deliberately not imported.** That package loads the
layers straight out of Postgres with a Prisma client, so importing it would mean
putting database credentials in a front end anyone can open. The room asks
kimi-core instead of reaching past it — which is why this goes over `/api/core`,
the trust boundary that already exists: the browser holds no key, the server side
has a hardcoded tool allowlist, and every tool on it is a read.

One of them has a side effect worth naming: kimi-core records a boot anchor on
each `reentry` call (that is how its own incremental reads know where a window
started). Hence once per conversation, not once per turn.

---

## Summary

|                   | local (default)          | core                                  |
| ----------------- | ------------------------ | ------------------------------------- |
| dashboards        | IndexedDB (on device)    | IndexedDB (on device)                 |
| chat memory       | local worldbook          | kimi-core (`memory_search_safe`, optionally plus a `reentry` cold start) |
| chat transcript   | local (IDB / localStorage) | kimi-core (`chat_write`/`chat_read`, synced across devices) |
| chat model        | operator subscription / API | operator subscription / API (same) |
| configuration     | none                     | `NEXT_PUBLIC_KIMI_BACKEND=core` + `KIMI_CORE_URL` + `KIMI_API_KEY` + `KIMI_OWNER_PASSWORD` (sign-in above) |
| requires a backend | no                      | yes — a running kimi-core             |

kimi-room is the interface layer. The memory engine, where one is required, is
[kimi-core](https://github.com/marikagura/kimi-core).
