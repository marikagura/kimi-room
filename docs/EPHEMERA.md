> English: ./EPHEMERA.en.md

# Ephemera

`/room/ephemera` —— 一张推送通知，也可以是一张**纸**：趁人睡着时排版，静静落在锁屏上；醒来打开，它像热敏小票一样一行行印出来，然后归进一个可以往回翻的抽屉。

这是一个 addon（默认底部链接，见 [ADDONS.md](../ADDONS.md)）。开源版喂的是一份中性、虚构的 demo 数据，开箱即用；不接后端、不含任何私人内容。

---

## 一张纸是什么

数据层就是一个 `Paper`：`kind` 选版式，其余字段是所有体裁的并集，每个版式只读它用得上的几个。

```ts
type Paper = {
  date: string;      // 归档主键 + 日期 (YYYY-MM-DD)
  kind?: string;     // 体裁 slug；省略 = 醒来纸 (日常默认)
  oneline?: string;  // 收尾一句
  issuer?: string;   // 落款 —— 你的 companion 的名字落在这里（demo 里是占位「—」）
  recipient?: string;
  // …各体裁自己的字段（星图 / 印戳 / 申报表 / 评级…）
};
```

- 版式在 `src/components/ephemera/EphemeraClient.tsx` 里，一个 `switch (paper.kind)` 分发到对应的 `*Sheet` 组件；未建的 `kind` 落回醒来纸。
- 目录与 demo 数据在 `src/lib/ephemera-demo.ts`（`GENRES` 是 21 种体裁的注册表，`DEMO_PAPERS` 是每种一张的虚构样张）。
- 出纸动画是纯 CSS `clip-path`（`@keyframes pp-print`，从报头往署名揭开，与热敏机吐纸同向），不依赖任何 state。

---

## 体裁目录（21 种）

`trigger` 是给接后端时的一个提示：`daily` = 每天的默认；`rule` = 日历或规则触发（见 `ephemera-editor.ts`）；`occasion` = 由后端的判断层挣得，不是每天都有。

| 刊组 | 体裁 | 触发 | 版式要点 |
|---|---|---|---|
| 日常刊 | 醒来纸 | daily | 报头 + 夜里这边 / 今日钉子 / 一句话 |
| 日常刊 | 周谱 | rule | 一周画成一行五线谱，音符高度 = 每天的调子 |
| 日常刊 | 气象简报 | rule | 今日大栏 + 三日栏，天气图标纯线描 |
| 日常刊 | 残月黄历 | rule | 大字日期 + 残月 + 宜 / 忌双栏 |
| 旅行刊 | 明信片 | occasion | 留言 + 玫瑰邮票 + 罩印邮戳；奶白 / 暗金两版纸色 |
| 旅行刊 | 登机牌 | occasion | 票据横头 + 字段格 + 条码 |
| 旅行刊 | 行程单 | occasion | 拱门报头 + 逐段中英 |
| 旅行刊 | 护照盖章页 | occasion | 印戳网格（多种环型）+ 今日新章 |
| 旅行刊 | 海关申报单 | occasion | 申报表 + 勾选框 + 放行章 |
| 承诺刊 | 欠条 | occasion | 条款体，逐条列明 |
| 承诺刊 | 票根 | occasion | 主联 + 齿孔 + 竖排存根 |
| 要紧刊 | 电报 | occasion | 全大写等宽 + STOP 断句 |
| 要紧刊 | 号外 | occasion | 反白大标题 + 印鉴 |
| 身体刊 | 处方笺 | occasion | ℞ + 剂量体 |
| 身体刊 | 健診表 | rule | A–E 评级圈 + 审讫印 |
| 夜刊 | 夜航日志 | occasion | 逐条时间戳 + 值夜签 |
| 夜刊 | 某夜星空 | rule | 星图 + 命名星座 + 当夜的记忆星 |
| 彩蛋刊 | 诗 | occasion | 竖排自由手排 + 残月 |
| 彩蛋刊 | 御神签 | occasion | 大吉 / 签解 |
| 彩蛋刊 | 印记徽 | rule | 徽章报头，纪念日用 |
| 彩蛋刊 | 节目单 | occasion | 拱门报头 + 幕次 + 行星 |

图案母题（狐狸、玫瑰、B-612、日落、点灯人）取自《小王子》。美术资产在 `public/ephemera/assets/`，走 1-bit 热敏审美（除明信片两版保留暖纸色外，无灰阶、无金）。

---

## 接上你自己的数据

`src/app/room/ephemera/page.tsx` 默认把 `DEMO_PAPERS` 喂给 `EphemeraClient`。要换成真数据：

1. **只读渲染**：把 `DEMO_PAPERS` 换成你的来源返回的 `Paper[]`（core 模式下从 kimi-core 读，或你自己的 DB / API）。版式不用动。
2. **规则层**：`src/lib/ephemera-editor.ts` 的 `pickPaper` 是一个可选的挑选层——给它日历 / 纪念日等信号，它决定今天出哪一种（黄道吉日→黄历、纪念日→印记徽之类）。要不要用随你。
3. **落款**：`issuer` / `recipient` 来自你自己的数据（即你自己的 prompt），demo 里一律是占位「—」，不硬编码任何名字。

`GENRES` 里 `built: true` 的都是已实现的版式；`kind` 对不上任何版式时安全落回醒来纸。

---

## 推送

锁屏推送默认关闭，直到你填上自己的 VAPID 公钥（`ephemera-demo.ts` 里的 `VAPID_PUBLIC_KEY`，用 `npx web-push generate-vapid-keys` 生成）。留空时「开启通知」只是一个提示，不会真的订阅——默认构建不与任何服务器通信。

Service worker（`public/sw.js`）带了 `push` / `notificationclick` 处理：通知点开后深链到 `/room/ephemera?d=<date>`，直接打开那一张纸。订阅端点 `/api/push/subscribe` 需要你自己接后端才生效。

---

## 隐私

demo 数据是虚构、中性的：没有真人、没有真事、没有「历史上的今天」式的日期断言。`issuer` / `recipient` 是占位签名。这个 addon 随仓发出去的一切，都不指向任何真实的人。
