> English: ./ADDONS.en.md

# Addons

首页永远是**六个房间**。第七个、第八个……不挤进格子——它们是 **addon**，
以 backstage 那样的小字链接出现在底部，用户想要的时候在 `/backstage/settings`
里勾进那六个、把某个旧房间换出去。

> 一句话：六个卡片是展现，其余都是底部文字。卡片硬上限 6。

---

## 怎么运作

三个文件就是全部：

```
src/lib/room-blocks.ts            ← 注册表 + slot 解析（client-safe）
src/lib/room-layout-actions.ts    ← 写 kimi-room-layout cookie 的 server action
src/components/backstage/RoomLayoutEditor.tsx  ← /settings 里的勾选面板
```

- **注册表** `ROOM_BLOCKS`：每个窗口一行 `{ id, href, name, sub, defaultSlot }`。
  `defaultSlot` 是 `"tile"`（默认进六格）或 `"link"`（默认在底部 = addon）。
- **slot 只有两种**：`tile`（卡片，最多 `MAX_TILES = 6`）/ `link`（底部文字）。
  没被勾成卡片的窗口，自动是 `link`，不存在“隐藏”。
- **持久化**：用户的选择存进 `kimi-room-layout` cookie（`id:slot` 列表，
  server 端读，**不闪**——跟主题切换同一套）。注册表里有、cookie 里没有的
  新窗口，按它的 `defaultSlot` 自动归位，不需要清 cookie。
- **6 的硬上限**在两处都挡：面板里第 7 个勾不动；`resolveRoom()` 里就算 cookie
  被手改成 7 个 tile，也只取前 6 个当卡片，多的掉到底部。

`/room/page.tsx` 调 `resolveRoom(cookie)` 拿 `{ tiles, links }`：tiles 渲染成卡片
（罗马数字按顺序动态重编），links 渲染成底部小字。

---

## 写一个 addon

1. 建路由：`src/app/room/<id>/page.tsx`（画法/组件放 `src/components/<id>/`）。
2. 数据别连私有 DB——给一份 demo 数据（参考 `src/lib/atlas-demo.ts`），
   或接 `src/lib/stores/` 的可插拔 adapter。
3. 往 `ROOM_BLOCKS` 加一行，addon 用 `defaultSlot: "link"`：

   ```ts
   { id: "atlas", href: "/room/atlas", name: "Atlas", sub: "& PASSAGE", defaultSlot: "link" },
   ```

完事。它自动出现在底部小字里；用户想要就在 /settings 勾进六格、换掉一个旧房间。

> Next 的 route 是文件系统静态的，所以 addon = “代码随仓发出去、用户自己拼”，
> 不是运行时去装第三方包。要真正的第三方插件得另搭一套 plugin 约定，这个仓不做。

---

## 内置 addon：Atlas

`/room/atlas` —— travel log 的“开窗”画法。首屏是一扇铁艺拱窗（中心玫瑰 latch，
点开窗看图），右上三个手绘图标切换 时间线 / 碎片柜 / 古地图。

- 画法（纯 SVG，颜色全走房间昼夜 palette）：
  `src/components/atlas/ArchWindow.tsx`（拱窗）、`glyphs.tsx`（叶/云/碎片卡）、
  `AtlasClient.tsx`（四视图 + 玫瑰）。
- 数据：`src/lib/atlas-demo.ts` 一份静态 demo（五个虚构地点）。
  换成你自己的源（DB / MDX / API），画法不用动——把 `imageUrl` 填成任意图
  （比如 Wikimedia 公有领域画作）就能看到“开窗”露出真图。

Atlas 默认是底部链接（addon）。想把它当第七到第六个房间，在 /settings 勾它、
把某个房间挪到底部即可。

---

## 内置 addon：Ephemera

`/room/ephemera` —— 把一张推送通知当成一张会打印出来的纸：趁睡着排版，醒来像热敏
小票一样一行行印出，再归进一个能往回翻的抽屉。21 种体裁（醒来纸 / 周谱 / 明信片 /
护照盖章页 / 某夜星空…），开箱是一份中性虚构 demo。

- 版式（纯 SVG + CSS，颜色走 1-bit 热敏审美）：`src/components/ephemera/EphemeraClient.tsx`
  —— 一个 `switch (paper.kind)` 分发到各 `*Sheet` 组件，未建的 kind 落回醒来纸。
- 数据：`src/lib/ephemera-demo.ts`（`GENRES` 21 种注册表 + `DEMO_PAPERS` 每种一张样张）；
  可选的规则挑选层 `src/lib/ephemera-editor.ts`。
- 换成你自己的 papers（core / DB / API）、接锁屏推送（VAPID）、隐私说明：
  见 [docs/EPHEMERA.md](docs/EPHEMERA.md)。

Ephemera 默认是底部链接（addon）。想上首页在 /settings 勾它、把某个旧房间挪到底部。

---

## 改了什么（this changeset）

新增：

```
src/components/atlas/ArchWindow.tsx          拱窗画法
src/components/atlas/glyphs.tsx              碎片/叶/云 SVG
src/components/atlas/AtlasClient.tsx         四视图客户端
src/lib/atlas-demo.ts                        Atlas demo 数据 + 类型
src/app/room/atlas/page.tsx                  /room/atlas 路由（喂 demo）
src/lib/room-blocks.ts                       窗口注册表 + slot 解析 + 6 上限
src/lib/room-layout-actions.ts               写 layout cookie 的 server action
src/components/backstage/RoomLayoutEditor.tsx  /settings 勾选面板
ADDONS.md                                    本文件
```

改动：

```
src/app/room/page.tsx                        卡片 + 底部链接改成注册表驱动（原来写死 6 行）
src/app/backstage/(protected)/settings/page.tsx  挂上「房间布局」面板
```
