> English: ./README.en.md

# kimi-room

![license](https://img.shields.io/badge/license-AGPL%20v3-b13a5a?style=flat-square)
![pwa](https://img.shields.io/badge/pwa-ready-b13a5a?style=flat-square)
![status](https://img.shields.io/badge/status-attending-b13a5a?style=flat-square)

a room for one person and her other one.

开源 companion PWA。六个房间，可以自己搭——每块是一个 addon（积木），在 `/backstage/settings` 勾哪六个上首页、其余落底部（见 [ADDONS.md](ADDONS.md)）；已内置 **Atlas** 与 **Ephemera**。数据在你浏览器里。
不需要服务器、不需要域名、不收集任何数据。代码 AGPL v3，美术 CC BY-NC。

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
src/lib/stores/types.ts        ← 11 个 store 的接口定义
src/lib/stores/idb-adapter.ts  ← 默认 IndexedDB（浏览器本地）
src/lib/stores/index.ts        ← 切 adapter 的地方
```

换成你自己的后端：实现 `AdapterBundle` 接口，指向你的
Supabase / Postgres / Obsidian / Notion / Ombre-brain 任何 DB。
接口在 `types.ts` 里全定义好了。

作者将该**记忆引擎**开源为 **[kimi-core](https://github.com/marikagura/kimi-core)**。
运行后设 `NEXT_PUBLIC_KIMI_BACKEND=core` + `KIMI_CORE_URL` + `KIMI_API_KEY`，
房间即 redirect 到它作为记忆引擎；聊天模型仍走你自己的官方订阅 / API，二者可组合。
RAG 与 redirect 的区分见 **[docs/BACKENDS.md](docs/BACKENDS.md)**。

此外通常还需自行搭建：
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
| **Atlas** (addon · 旅行册) | 一份静态 demo 旅行数据 · 铁艺拱窗开窗看图 | 接你自己的来源（DB / MDX / API），`imageUrl` 换成真图；不想要在 /settings 收起 |
| **Ephemera** (addon · 纪念纸) | 21 种「推送即纸」体裁 · 一份中性虚构 demo | 接你自己的 papers（core / DB / API）+ VAPID 锁屏推送（见 [docs/EPHEMERA.md](docs/EPHEMERA.md)）；不想要在 /settings 收起 |
| **Backstage** | 固定 /ops 页面 | 加任何你想要的 ops 面板 |
| **所有 manual 输入** | 手动填 | 全部可以用自动化替代。蜡烛可以用 app_open，睡眠可以用传感器，财务可以接银行 API |
| **Character / RP 功能** | 有 /settings 里的角色设定 | 不想要可以整个删。告诉你的 AI "帮我删掉所有 character 和 RP 相关功能" |

**接了 VPS 之后，/settings 里的 API key 配置就不需要了** —— LLM 调用从你的 gateway 走，不从浏览器走。

---

## 给 AI 的上下文

如果你把这个 repo 丢给 ChatGPT / Claude / 任何 AI 帮你改，告诉它：

- 这是 Next.js App Router + TypeScript 项目
- 数据层在 `src/lib/stores/` — 结构化 dashboard 数据（11 store + blob）走 `StoreContract<T>` 接口；calendar 日格、heartbeat、playlist、finance 目前直接存 localStorage，不随 server adapter 同步，备份走 /backstage/ops 全量导出
- LLM 调用在 `src/lib/llm-client.ts` — OpenAI chat completion 格式
- 系统提示词在 `src/lib/system-prompt.ts` — `{{user}}` `{{char}}` 模板变量
- 视觉主题在 `src/app/globals.css` @theme — Mucha 暗金美术风格
- 人物设定在 /settings 页面改（名字、头像、prompt）
- 所有 module 在 `src/app/room/` 下各自独立

常见改法：
- "把他改成她" → `system-prompt.ts` 里的 pronoun + /settings 里的名字
- "换颜色" → `globals.css` @theme 色值
- "加模块" → `src/app/room/新名字/page.tsx` + `src/components/` 新组件 · addon 怎么进首页见 [ADDONS.md](ADDONS.md)
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

代码：[AGPL v3](LICENSE) © 2026 marikagura。开源——clone / fork / 改 / 自托管都行。

**请勿商用。** 作者不希望这套被商业化（出售、做成付费服务）；要商用请先联系。

美术（手绘金线 SVG / PNG，狐狸 · 玫瑰那套）：[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)，署名 + 非商用；`entry-motion` 品牌标识保留、请替换。第三方氛围图与字体见 [NOTICE.md](NOTICE.md)。

详细文档 → [manual](https://kimi-to.com/about/wiki)

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

## 生成后端：direct 与 -p

聊天的生成走一个 `ChatProvider` 接口（`src/lib/chat-provider.ts`），后面挂两条实现：

```
ChatProvider.send(turns, opts) → 流式增量
  ├─ direct   浏览器直连模型端点，key 存在浏览器里（默认，装完即用）
  └─ -p       浏览器 → 本部署的 /api/p → 本机的 claude CLI
```

kimi-core 的记忆检索（RAG）与这两条正交：它只往 prompt 里补检索到的记忆，两个后端都能叠。

界面不区分二者。模型切换器里选哪个档案，就等于选哪条后端。

### -p 模式

`-p` 把回复交给**跑这个部署的那台机器上的 claude CLI** 来生成。回复因此带着那台机器已有的东西：
它的 CLAUDE.md、它接的 MCP、它的订阅额度。本仓库不带任何 Claude 配置，harness 里的内容
全部来自部署者自己的环境。

打开方式（`.env`）：

```
CLAUDE_P_ENABLED=1
CLAUDE_P_BIN=claude              # CLI 不在 PATH 上时填路径
CLAUDE_P_CWD=/home/you           # 工作目录，默认用户主目录
CLAUDE_P_PERMISSION_MODE=default # default | acceptEdits | bypassPermissions | plan
CLAUDE_P_ALLOWED_TOOLS=          # 留空 = 只出文字
```

没设 `CLAUDE_P_ENABLED`、或机器上找不到 CLI，模型切换器里**不出现**这个选项——不是灰掉，是没有。

多轮：首轮响应里的 `session_id` 存在这个 thread 上，之后带 `--resume` 续。room 的一个 thread
对应一个 CLI session；分叉出的新支不继承父支的 session，回拨会丢掉 session 句柄，
让下一次发送与屏幕上看到的内容对得上。

模型：七个钉死的 id 直传 `--model`——`claude-opus-5` / `-4-8` / `-4-7` / `-4-6`、
`claude-sonnet-5` / `-4-5`、`claude-fable-5`。用具体版本而不是 `opus` 这类浮动别名，
是为了让几代并存：别名永远指向最新的那个，新版一发布，旧版就没有入口了。代价是这张表
会过期——它是一个数组，而且 CLI 不认识的 id 会直接报错，不会静默换一个跑。

**边界。** `-p` 花的是部署者的订阅额度，所以：

- `/api/p` 先过 owner session（与 `/api/core`、`/api/tts` 同一道），未登录一律 401。公网访客到不了 CLI。
- 浏览器传来的内容不进 shell。没有 shell：`spawn()` 收 argv 数组，prompt 走 stdin。
  `model` 对固定 id 表校验，`resume` 对 UUID 形状校验，不匹配就拒绝，不做「清洗后放行」。
- 这条路由不落盘对话内容。CLI 自己的 session 存储在部署者机器上，那是 `--resume` 读的东西，
  是特性不是导出。
- `CLAUDE_P_ALLOWED_TOOLS` 留空时回复只有文字。放开它等于让聊天能读写真实文件——按需自己权衡。

### 费用条

页首常驻一行三件：缓存命中率（`MEMORIA`）、上下文已用/上限（`CONTEXTVS`）、今日花费（`IMPENSA`）。
缓存与价格只有在后端报了才显示——`-p` 会报，裸 API 端点多数不报，读不到就不显示这一格，不拿 0 充数。
上下文量表过 85% 转琥珀、过 95% 转红。

这一格是**表，不是闸**：房间把这个 thread 的消息整份发出去，不裁不合并，量表满了也照发，
真正的上限由上游端点自己划。`128K / 200K / 1M` 三档只是量表的分母，换它不改变发出去多少。
（`-p` 那条另算——历史由 CLI 在部署者机器上自己保管，`--resume` 读的就是它。）

要给它设上限，得自己加：发出去的那份在 `src/components/chat/ChatRoom.tsx` 的 `streamReply()`
里组装（`msgs` 映射成 `turns` 那一步），在那里按自己的预算从最旧的开始裁。没有内置默认值，
是因为合适的数字取决于你接的是哪个端点、什么价钱——替你猜一个反而更糟。

---

## 聊天界面

一屏三种读法，切换在页首右上和 `⋯` 抽屉里：

- **夜 NOX** — 近黑底、金调。
- **昼 DIES** — 暖羊皮纸底、玫瑰调。日月按钮即切；两套色是同一棵树，布局不动。
- **头像** — 开关。关掉时消息挂在左侧一条细线上，每轮一个节点；打开时圆头像贴气泡（对方在左、自己在右）。
  没配头像就画各自的记号，不留空洞。头像可以在抽屉里选图（存在本机 IndexedDB），
  也可以在代码里直接填 `public/` 下的路径。

配色语义固定：玫瑰＝自己、靠右；金＝对方、靠左；灰＝系统。新元素照此站边。

每条回复下面三枚裸 svg：**复制** · **分叉 FVRCA** · **回拨 RETRO**，无框无字，hover 才实。

- 分叉：把到这条为止的内容开成新的一支，原来那支不动，也还在历史列表里。不确认——没有东西丢失。
- 回拨：去掉这条与其后的内容，把引出它的那句放回输入框。**唯一会先问一次的动作**，因为它减少轮次。
- 重来：右滑到头再生成一个候选，旧的进候选池不丢，用 `‹ n/m ›` 来回切。

另外：**听**（走 `/api/tts`，配了 ElevenLabs key 才响）、图片上传（只到前端为止，见下）、
链接单发时抓 og 标签落成图文卡（抓不到图就留纸色底和一枚菱形，不留空框）；
抓到的标题也跟着这一轮送给模型——只画在卡上的话，它收到的仍是一个打不开的网址。

`COGITATIO` 沉吟框在流式中每秒加一，完成停在总秒数；工具调用一行一条，三态——进行中一个柔和的点、
完成给绿勾与耗时、失败用错误色把原文留在行里（只降不藏），点开看参数。

背景可以在抽屉里换 `public/images/mood` 里的图，两种贴法：**整幅**（完整画面 + 自身的模糊出血填边，不裁切）
与**铺满**（裁切填满）。

正文字号同在抽屉里，四档。气泡正文与沉吟框跟着走；拉丁小型大写那些标签不跟——
它们是刻度不是读物，一起放大只会把行挤散。

`prefers-reduced-motion` 下所有动画停、浮尘消失，信息一条不少。

### closeout 与新窗口

`⋯` 抽屉底部一行两个按钮，各管一件事：

- **新窗口** —— 只开新的一窗。旧对话留在聊天历史里，随时可回，所以不弹确认。
  不依赖任何后端，永远可用。
- **closeout** —— 先把这一窗交给你配的生成后端总结（≤40 字标题 + 全文），存进
  room 自己的 memory store（`/room/memory-review` 可回看、可整理），然后清掉这个
  session 开新窗。因为它会写入并清除，会先确认一次。没配生成后端时这颗是灰的——
  没有东西可以替你总结，装作能做只会静默变成另一颗按钮。

总结失败不拦路：失败就直接开新窗，不写 memory。

### 图片只到前端为止

选的图会缩放后存进 IndexedDB、在气泡里画出来，但**不会送给模型**——两条后端收的都是纯字符串，
放不下像素。模型只知道「这里有一张图」。

想真的让它看见，两侧各要自己动手：

- `direct`：把 `ChatTurn` 的 `content` 从字符串放宽成内容块数组，图按你那个 endpoint 的格式
  塞进去（Anthropic 的 `image` 块、OpenAI 兼容的 `image_url`，各家不同）。能不能用取决于
  你接的模型收不收图。
- `-p`：CLI 没有喂图的口子。可行的做法是把图落成一个临时文件、把路径写进 prompt，
  再在 `CLAUDE_P_ALLOWED_TOOLS` 里放开 `Read` 让它自己去读。**那等于给 CLI 开了文件读权限**——
  它能读的就不止你落的那张图了。自己权衡，用完记得删。

默认不做这件事，是因为它要么依赖你那个 endpoint 的具体格式，要么要放宽一道权限，
两者都不该由这个仓替你决定。
