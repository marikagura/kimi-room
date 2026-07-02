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
  `persistCoreMemory(key, content)`。出厂的聊天界面未调用这两个函数——它们是给
  部署者的接线点：在一轮聊天中调用，在请求部署者模型之前将检索到的记忆注入
  prompt。出厂接好的 core 能力是 transcript 的跨设备同步（`chat_write` /
  `chat_read` / `chat_threads` / `chat_delete`）。

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

---

## 一览

|                | 本地（默认）             | core                                  |
| -------------- | ------------------------ | ------------------------------------- |
| dashboard      | IndexedDB（本机）        | IndexedDB（本机）                     |
| 聊天记忆       | 本地世界书               | kimi-core（`memory_search`）          |
| 聊天 transcript | 本地（IDB / localStorage） | kimi-core（`chat_write`/`chat_read`，跨设备合并同步） |
| 聊天模型       | 部署者订阅 / API         | 部署者订阅 / API（相同）              |
| 配置           | 无                       | `NEXT_PUBLIC_KIMI_BACKEND=core` + `KIMI_CORE_URL` + `KIMI_API_KEY` + `KIMI_OWNER_PASSWORD`（登录见上） |
| 是否需要后端   | 否                       | 是——一个在运行的 kimi-core            |

kimi-room 是界面层。如确需记忆引擎，则为
[kimi-core](https://github.com/marikagura/kimi-core)。
