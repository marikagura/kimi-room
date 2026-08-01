> English: ./BACKENDS.en.md

# 后端

kimi-room 以呈现为主，是一个自给自足的界面层。它不提供记忆后端，也不意在充当
记忆后端。它支持两种部署模式，二者刻意区分。

---

## 1. 本地（默认）

默认模式，无需配置。

- **存储。** 浏览器 IndexedDB。日历、纪念、书房、睡眠与记忆世界书均保存在本机，
  不向外传输。
- **聊天。** 自带凭据。端点与密钥在 Settings 中配置（官方订阅，或任一 OpenAI
  兼容端点）。聊天以 transcript 形式运行，检索范围限于本地世界书。

此模式刻意保持最小化；该界面不意在充当记录系统。已维护一套结构化记忆库的部署，
应自行提供持久化层（见模式 2）。

---

## 2. Core — 将记忆 redirect 至一个在运行的 kimi-core

运行结构化记忆引擎的部署，可将 kimi-room 用作其前端——与参考（canon）部署同构：
一个网页前端置于记忆网关之上。该引擎以开源形式提供：

> https://github.com/marikagura/kimi-core

此模式下，两项关注点清晰分离且可组合：

- **记忆**由 kimi-core 提供（检索与落库）。
- **生成**仍使用部署者自身的订阅或 API——与本地模式相同的自带凭据聊天。

因此，接入 kimi-core 并不将生成委托给它。模型由部署者提供，kimi-core 仅提供检索，
二者相互独立。

### 机制

```
浏览器  ──{ name, arguments }──▶  /api/core  ──MCP──▶  kimi-core 网关
(不持 key)                        (服务端持 key)        (memory_search …)
```

- 设 `NEXT_PUBLIC_KIMI_BACKEND=core`。
- 设 `KIMI_CORE_URL` 与 `KIMI_API_KEY`（仅服务端；浏览器不接收密钥——`/api/core`
  路由以 Bearer token 转发调用）。
- `src/lib/kimi-core-client.ts` 暴露 `fetchCoreMemoryContext(query)`（检索）与
  `persistCoreMemory(key, content)`。检索由 `src/lib/core-context.ts` 接进聊天
  （见下一节），落库仍是留给部署者的接线点。出厂接好的另一项 core 能力是
  transcript 的跨设备同步（`chat_write` / `chat_read` / `chat_threads` /
  `chat_delete`）。

### 需要 owner 登录

/api/core 带着部署者的 `KIMI_API_KEY` 转发工具调用，是一道信任边界。除
`KIMI_CORE_URL` + `KIMI_API_KEY` 外，还必须设 `KIMI_OWNER_PASSWORD`，然后在
**/backstage/login** 登录一次（cookie 30 天）——否则每个 /api/core 调用返回
401，同步会静默退化成纯本地行为。/api/tts 走同一道闸。

### 检索，而非替换为 CRUD

kimi-core 暴露的是 agent-text 接口：`memory_search` 与 `reentry` 返回供插入模型
prompt 的人类可读文本，而非结构化记录。故 kimi-room 将 kimi-core 用于检索增强
聊天（文本输入、文本注入 prompt），而不作为 dashboard 背后的结构化存储。结构化
dashboard（纪念、书房、睡眠等）在两种模式下默认保留在本地 IndexedDB；其可选的
服务端持久化走参考 adapter（supabase / prisma / core），见 docs/SELF-HOST.md。

### 一轮聊天带上什么上下文

kimi-core 把上下文定义成层——profile、register、anchors、states、observations、
episodes、topics、events、persona、跨 surface 合并的对话——各层独立加载，任一
surface 只组合它需要的切片；注入分两处：新窗口开始时一次冷启动，之后每轮补该轮
需要的。层的清单与注入方式见 kimi-core 的 `docs/CONTEXT-LAYERS.md`。

房间取其中三样，拼在 system message 后面：

| 层 | 来源 | 频率 |
| --- | --- | --- |
| 时间 | 本机时钟 + `NEXT_PUBLIC_KIMI_TZ` | 每轮一行 |
| persona / 常驻上下文 | kimi-core 的 `reentry` | 每条对话一次，缓存 30 分钟 |
| 记忆 | `memory_search_safe`，查询就是这一轮的消息 | 每轮 |

时间那一行不是凑数：模型没有钟，不给它这一行，它答「今天」用的是权重冻结那天。

开关（`.env`）：

```
NEXT_PUBLIC_KIMI_CORE_CONTEXT=rag   # off | rag（默认）| full
NEXT_PUBLIC_KIMI_TZ=Asia/Tokyo      # 留空 = 用设备自己的时区
```

- `rag`（默认）——时间 + 每轮检索。一次查询的成本。
- `full`——再加冷启动那一整块。它是整份常驻上下文，可以是几万字；direct 那条路
  每轮都要重发一遍、每轮都要付一次，所以它是个选项而不是默认。
- `off`——什么都不带。没跑 kimi-core 的部署本来就走这条，无需设置。

**只作用在 direct 那条路。** CLI 那条（`-p` / `codex`）不注入：它在部署者自己的
harness 里生成，那台机器已经带着它自己的配置，再从 system prompt 塞第二份进去，
等于同一批材料付两次钱，还让一个窗口里出现两个版本的它。

**不 import `@kimi/context-core`。** 那个包用 Prisma 直接从 Postgres 读层，import
它就等于把数据库凭据放进一个谁都能打开的前端里。房间选择问 kimi-core，而不是绕过
它自己去读——所以这条路走的是 `/api/core` 那道已经存在的信任边界：浏览器不持 key，
服务端有一张写死的工具白名单，且全部是读。

其中 `reentry` 有一个值得点名的副作用：kimi-core 每次调用会记一条 boot 锚点（它自己
的增量读靠这个知道窗口从哪开始）。所以它每条对话调一次，不是每轮调一次。

---

## 一览

|                | 本地（默认）             | core                                  |
| -------------- | ------------------------ | ------------------------------------- |
| dashboard      | IndexedDB（本机）        | IndexedDB（本机）                     |
| 聊天记忆       | 本地世界书               | kimi-core（`memory_search_safe`，可选加 `reentry` 冷启动）|
| 聊天 transcript | 本地（IDB / localStorage） | kimi-core（`chat_write`/`chat_read`，跨设备合并同步） |
| 聊天模型       | 部署者订阅 / API         | 部署者订阅 / API（相同）              |
| 配置           | 无                       | `NEXT_PUBLIC_KIMI_BACKEND=core` + `KIMI_CORE_URL` + `KIMI_API_KEY` + `KIMI_OWNER_PASSWORD`（登录见上） |
| 是否需要后端   | 否                       | 是——一个在运行的 kimi-core            |

kimi-room 是界面层。如确需记忆引擎，则为
[kimi-core](https://github.com/marikagura/kimi-core)。
