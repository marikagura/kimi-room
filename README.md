# kimi-room

![license](https://img.shields.io/badge/license-AGPL%20v3-b13a5a?style=flat-square)
![pwa](https://img.shields.io/badge/pwa-ready-b13a5a?style=flat-square)
![status](https://img.shields.io/badge/status-attending-b13a5a?style=flat-square)

a room for one person and her other one.

开源 companion PWA。六个房间。数据在你浏览器里。
不需要服务器、不需要域名、不收集任何数据。AGPL v3。

> **只想用？** → [QUICKSTART.md](QUICKSTART.md) · 5 分钟 · 一键部署
> **想改？** 把这个 README 整个丢给你的 AI，它会帮你。

---

## 两条路

### 路 A：我只有一个 API key

走 [QUICKSTART](QUICKSTART.md)：
1. 一键 Vercel 部署
2. /settings 填你的 LLM endpoint + key
3. DONE。数据在你浏览器 IndexedDB 里，换电脑会丢。

### 路 B：我有 VPS，想做完整系统

你要的不只是 shell。你要后端持久化、自主循环、TG、ops。

kimi-room 是**前端壳**。它的数据层是可插拔的：

```
src/lib/stores/types.ts        ← 9 个 store 的接口定义
src/lib/stores/idb-adapter.ts  ← 默认 IndexedDB（浏览器本地）
src/lib/stores/index.ts        ← 切 adapter 的地方
```

换成你自己的后端：实现 `AdapterBundle` 接口，指向你的
Supabase / Postgres / Obsidian / Notion / Ombre-brain 任何 DB。
接口在 `types.ts` 里全定义好了。

你还需要自己搭：
- **Gateway**（VPS 上跑的 API server，接 TG bot / LLM proxy / MCP）
- **自主循环**（dream / intel / scheduler — 让系统自己醒来、自己处理邮件、自己写日记）
- **域名**（Vercel 自带 .vercel.app，自定义域名在 dashboard 设）

作者的 canon 版本 → [kimi-to.com/about](https://kimi-to.com/about)

---

## 每个模块都可以改

这是 shell。每个房间都可以接你自己的后端、改逻辑、或者删掉。
把这段连同你想改的东西一起告诉你的 AI：

| 模块 | 默认 | 可以改成 |
|------|------|---------|
| **Heartbeat** (score/sky) | 本地打分，手动 | 接你的 VPS 自动打分、同步到云。打分逻辑完全你定 |
| **Keepsakes** | IndexedDB 存照片+文字 | 同步到云（Supabase / S3 / 任何） |
| **Study** | 本地书架 + "一起读"LLM 功能 | 同步到云。"一起读"不想要可以删 |
| **Calendar** | 手动输入 + 本地存储 | 接任何日历 API（不限 Google）。wellbeing 数据可以从 app 使用记录自动采集 |
| **Memory** | 本地 IndexedDB | 接你的 DB。审核流程可改可删 |
| **Disc** | 本地对话截图 + 歌单 | 归档到云 |
| **Backstage** | 固定 /ops 页面 | 加任何你想要的 ops 面板 |
| **所有 manual 输入** | 手动填 | 全部可以用自动化替代。蜡烛可以用 app_open，睡眠可以用传感器，财务可以接银行 API |
| **Character / RP 功能** | 有 /settings 里的角色设定 | 不想要可以整个删。告诉你的 AI "帮我删掉所有 character 和 RP 相关功能" |

**接了 VPS 之后，/settings 里的 API key 配置就不需要了** —— LLM 调用从你的 gateway 走，不从浏览器走。

---

## 给 AI 的上下文

如果你把这个 repo 丢给 ChatGPT / Claude / 任何 AI 帮你改，告诉它：

- 这是 Next.js App Router + TypeScript 项目
- 数据层在 `src/lib/stores/` — 所有 CRUD 走 `StoreContract<T>` 接口
- LLM 调用在 `src/lib/llm-client.ts` — OpenAI chat completion 格式
- 系统提示词在 `src/lib/system-prompt.ts` — `{{user}}` `{{char}}` 模板变量
- 视觉主题在 `src/app/globals.css` @theme — Mucha 暗金美术风格
- 人物设定在 /settings 页面改（名字、头像、prompt）
- 所有 module 在 `src/app/room/` 下各自独立

常见改法：
- "把他改成她" → `system-prompt.ts` 里的 pronoun + /settings 里的名字
- "换颜色" → `globals.css` @theme 色值
- "加模块" → `src/app/room/新名字/page.tsx` + `src/components/` 新组件
- "接我的后端" → 写一个新 adapter 实现 `AdapterBundle`
- "删掉 RP 功能" → 删 /settings 里 character 相关 + system-prompt.ts 里的 persona 模板

---

## 六个房间

| # | 房间 | 内容 |
|---|------|------|
| I | Heartbeat | 记忆星图 + 情绪谱 |
| II | Keepsakes | 一行一句的纪念 + 照片 |
| III | Study | 书架 + 陪你读书 |
| IV | Calendar | 日历 + 财务 + 睡眠 |
| V | Memory | 记忆审核 |
| VI | Disc | 过往对话记录 + 歌单 |

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

AGPL v3 — fork 随意，闭源不行。

详细文档 → [wiki](https://kimi-to.com/about/wiki) · [FAQ](https://kimi-to.com/about/faq)

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
