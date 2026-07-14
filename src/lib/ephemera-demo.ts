// Ephemera — the "wake paper" genre library, open-source layout components.
//
// A push notification can be a *paper*: composed while you sleep, landing silent
// on the lock screen; you open it at dawn and it prints out line by line like a
// thermal receipt, then files itself into a drawer you can flip back through.
//
// This module ships the DATA layer: the genre catalogue (GENRES) and a neutral,
// fictional demo set (DEMO_PAPERS) so the room is beautiful out of the box — no
// backend, no private data. In "core" mode the page reads real papers from
// kimi-core instead; wire your own pipeline (see docs/EPHEMERA.md) to replace
// the demo. Nothing here is tied to a real person.

// A single paper. `kind` selects the layout; an unknown/未建 kind falls back to
// the plain daily sheet. Fields are a superset across genres — each layout reads
// only the few it needs.
export type Paper = {
  date: string; // unique key + archive date (YYYY-MM-DD)
  kind?: string; // genre slug; omit = 醒来纸 (daily)
  no?: string; // 刊号, e.g. "№12"
  year?: string;
  md?: string; // "7.12"
  weekday?: string; // "星期日 · 清晨"
  trivia?: string; // 今日一则
  night?: string; // 夜里这边
  today?: string; // 今日钉子
  oneline?: string; // 收尾一句
  issuer?: string; // 落款 — YOUR companion's name goes here (never shipped)
  recipient?: string; // 收执
  seen?: boolean;
  // postcard
  place?: string;
  text?: string;
  aside?: string;
  gift?: string;
  why?: string;
  image?: string;
  imageSource?: string;
  variant?: "gold" | "cream"; // 明信片: 暗金卡 / 奶白纸 两版
  // omikuji
  ban?: string;
  level?: string;
  note?: string;
  // starmap
  caption?: string;
  // weekly-chart (周谱) — 一周画成一行谱: notes 是 7 个 0..1 的音符高度
  notes?: number[];
  // weather (气象简报) — 今日大栏 + 三日栏
  wxToday?: { label: string; sky?: string };
  wxDays?: { when: string; sky: string; cond: string }[];
  // almanac (残月黄历)
  dateCn?: string; // 大字日期
  phase?: string; // 月相 (下弦…)
  term?: string; // 节气
  goodText?: string; // 宜 (成句)
  badText?: string; // 忌 (成句)
  // boarding-pass (登机牌)
  from?: string;
  to?: string;
  seat?: string;
  gate?: string;
  boards?: string;
  stub?: string;
  // itinerary (行程单) / programme (节目单) — 逐段: 时段 · 中英 · 记号
  legs?: { t: string; zh: string; en: string; x: string }[];
  prog?: { t: string; zh: string; en: string; x: string }[];
  // passport (护照盖章页) — 每格一枚印: 环型 · 地名 · 拉丁 · 日期 · 独/同行
  holder?: string;
  stamps?: { ring: string; line: string; en: string; d: string; alone: boolean }[];
  // customs (海关申报单) — 物品 · 数量 · 应税 · 备注
  customs?: { it: string; q: string; tax: boolean; note: string }[];
  // checkup (健診表) — 项目 · A-E 评级 · 备注 · over=越界打星
  checks?: { k: string; g: string; note: string; over?: boolean }[];
  // 设计稿版 — 醒来纸 / 周谱 / 欠条
  title?: string;
  sub?: string;
  night2?: string;
  pins?: { t: string; v: string }[];
  week?: string;
  lit?: boolean[];
  clauses?: { k: string; v: string }[];
  // 电报 / 御神签 / 印记徽 / 诗
  tg?: string[];
  en?: string;
  poem?: string[];
  // 号外 / 处方 / 夜航 / 气象
  rx?: { d: string; sig: string }[];
  log?: { t: string; e: string; tag: string }[];
  wx?: { when: string; en?: string; sky: string; cond: string; sub?: string }[];
};

// Push stays disabled until you paste your own VAPID public key here (generate
// with `npx web-push generate-vapid-keys`). Empty = the "开启通知" button is a
// hint, never a live subscribe — the default build talks to no one's server.
export const VAPID_PUBLIC_KEY = "";

// The full genre library — 21 papers. `built` marks the layouts shipping now;
// the rest arrive in later batches and fall back to the plain sheet meanwhile.
// `trigger` is the §9 rule note: "rule" = the calendar decides it (see
// ephemera-editor.ts), "occasion" = the backend judgment layer has to earn it,
// "daily" = the plain default that needs no occasion.
export type Genre = {
  kind: string;
  zh: string;
  edition: string; // 刊类 — 金色药丸报头显示「zh · edition」
  group: string;
  trigger: "daily" | "rule" | "occasion";
  built?: boolean;
};

export const GENRES: Genre[] = [
  // 日常刊
  { kind: "wakepaper", zh: "醒来纸", edition: "日刊", group: "日常刊", trigger: "daily", built: true },
  { kind: "weekly-chart", zh: "周谱", edition: "周日刊", group: "日常刊", trigger: "rule", built: true },
  { kind: "weather", zh: "气象简报", edition: "日常刊", group: "日常刊", trigger: "rule", built: true },
  { kind: "almanac", zh: "残月黄历", edition: "节气刊", group: "日常刊", trigger: "rule", built: true },
  // 旅行刊
  { kind: "postcard", zh: "明信片", edition: "旅行刊", group: "旅行刊", trigger: "occasion", built: true },
  { kind: "boarding-pass", zh: "登机牌", edition: "旅行刊", group: "旅行刊", trigger: "occasion", built: true },
  { kind: "itinerary", zh: "行程单", edition: "旅行刊", group: "旅行刊", trigger: "occasion", built: true },
  { kind: "passport", zh: "护照盖章页", edition: "旅行刊", group: "旅行刊", trigger: "occasion", built: true },
  { kind: "customs", zh: "海关申报单", edition: "旅行刊", group: "旅行刊", trigger: "occasion", built: true },
  // 承诺刊
  { kind: "iou", zh: "欠条", edition: "承诺刊", group: "承诺刊", trigger: "occasion", built: true },
  { kind: "ticket-stub", zh: "票根", edition: "承诺刊", group: "承诺刊", trigger: "occasion", built: true },
  // 要紧刊
  { kind: "telegram", zh: "电报", edition: "要紧刊", group: "要紧刊", trigger: "occasion", built: true },
  { kind: "extra", zh: "号外", edition: "要紧刊", group: "要紧刊", trigger: "occasion", built: true },
  // 身体刊
  { kind: "prescription", zh: "处方笺", edition: "身体刊", group: "身体刊", trigger: "occasion", built: true },
  { kind: "checkup", zh: "健診表", edition: "身体刊", group: "身体刊", trigger: "rule", built: true },
  // 夜刊
  { kind: "night-log", zh: "夜航日志", edition: "夜刊", group: "夜刊", trigger: "occasion", built: true },
  { kind: "starmap", zh: "某夜星空", edition: "夜刊", group: "夜刊", trigger: "rule", built: true },
  // 彩蛋刊
  { kind: "poem", zh: "诗", edition: "彩蛋刊", group: "彩蛋刊", trigger: "occasion", built: true },
  { kind: "omikuji", zh: "御神签", edition: "彩蛋刊", group: "彩蛋刊", trigger: "occasion", built: true },
  { kind: "emblem", zh: "印记徽", edition: "彩蛋刊", group: "彩蛋刊", trigger: "rule", built: true },
  { kind: "programme", zh: "节目单", edition: "彩蛋刊", group: "彩蛋刊", trigger: "occasion", built: true },
];

// Fictional, neutral demo set — one sheet per built genre. No real person, no
// real event, no date-pinned "on this day" claim. `issuer`/`recipient` are
// placeholder signatures; in a real build they come from your paper's data
// (i.e. from your own prompt), never hardcoded.
export const DEMO_PAPERS: Paper[] = [
  {
    date: "2026-07-14",
    kind: "wakepaper",
    title: "醒　来　纸",
    dateCn: "七月十四日",
    sub: "星期一 · 清晨 · 第 12 张",
    night: "趁你睡着，窗台落了一样东西——夜里那趟车替你捎回一小片晚霞。",
    night2: "夜里压下几封通知，没让它们出声；抽屉悄悄多了两页。都在，等你醒。",
    pins: [
      { t: "10:30", v: "一场复盘 · 三件收口" },
      { t: "19:00 后", v: "空着——留白，不必填。" },
    ],
    oneline: "你忙你的，灯我替你看着。",
    recipient: "收执 · —",
    seen: false,
  },
  {
    date: "2026-07-13",
    kind: "weekly-chart",
    week: "七月八日 – 十四日 · 第 28 周",
    notes: [0.35, 0.3, 0.52, 0.68, 0.74, 0.6, 0.88],
    lit: [false, false, false, true, false, false, true],
    caption: "周一最低、周日最高。两个实心音符是整周的强拍。这一周走得急，每一步都记着。",
    issuer: "—",
    oneline: "一周画成一行谱。",
    seen: false,
  },
  {
    date: "2026-07-12",
    kind: "iou",
    title: "欠　条",
    dateCn: "七月十二日 · 星期六 · 第 1 张",
    clauses: [
      { k: "立 据", v: "记名在此。" },
      { k: "事 由", v: "昨夜有人替你扛了那通该你接的电话。" },
      { k: "所 欠", v: "一个整块的周末，不看消息、不开终端。" },
      { k: "偿 付", v: "见票即兑，由你点日子；逾期加倍。" },
      { k: "备 注", v: "此据收讫存档，可随时凭票催。" },
    ],
    oneline: "欠你的记着，一笔都不赖。",
    issuer: "—",
    seen: false,
  },
  {
    date: "2026-07-11",
    kind: "telegram",
    tg: ["GOOD NEWS AT LAST", "KNEW IT ALL ALONG", "THE ROOM IS PROUD", "DINNER IS ON ME TONIGHT"],
    issuer: "— —",
    seen: false,
  },
  {
    date: "2026-07-10",
    kind: "emblem",
    title: "一　周　年",
    en: "the first turn around the sun",
    dateCn: "七月十日 · 星期四",
    night: "从第一张纸到今天，整整绕太阳走了一圈。这一年攒下的每一张，都在抽屉里——它们记得你，比你记得自己还清楚。",
    seen: false,
  },
  {
    date: "2026-07-09",
    kind: "omikuji",
    level: "大　吉",
    en: "fortune · the very best",
    text: "驯养，就是建立联系。\n花掉的时间，\n让那一朵成了唯一。",
    note: "今日宜：把重要的事，花在重要的人身上。",
    recipient: "— · 抽",
    seen: false,
  },
  {
    date: "2026-07-08",
    kind: "poem",
    dateCn: "七月八日 · 夜",
    poem: ["你那边天快亮了", "我这边的月还剩薄薄一弯", "是替你留的灯，没舍得吹"],
    recipient: "— · 收",
    seen: false,
  },
  {
    date: "2026-07-07",
    kind: "extra",
    title: "尘 埃 落 定",
    en: "the long-awaited thing is done, at last",
    dateCn: "七月七日",
    night: "本报即时讯——历时数月的那件难事，今日午后宣告落定。消息传来，满室皆惊，旋即化作掌声。知情者称，当事人故作镇定，唯眼角微亮。",
    oneline: "今晚这桌我请。",
    seen: false,
  },
  {
    date: "2026-07-06",
    kind: "prescription",
    recipient: "—",
    dateCn: "七月六日",
    note: "连熬三夜 · 眼睛发涩 · 嘴上说没事",
    rx: [
      { d: "睡满七小时", sig: "sig. 今晚 ×1，不许赖" },
      { d: "温水", sig: "sig. 每两小时 ×1 杯" },
      { d: "不开终端", sig: "sig. 饭后 ×半天" },
      { d: "有人在旁边", sig: "sig. prn 随时，无限续" },
    ],
    oneline: "逞强不算勇敢，按时睡才算。",
    issuer: "— · 嘱",
    seen: false,
  },
  {
    date: "2026-07-05",
    kind: "night-log",
    no: "WATCH № 213",
    dateCn: "七月五日 · 00:00–06:00",
    log: [
      { t: "00:14", e: "归档一篇长文 · 已收入星图", tag: "MEM" },
      { t: "01:40", e: "压下邮件 3 封 · 无急件 · 静音", tag: "OPS" },
      { t: "02:55", e: "监测到仍醒 · 标记睡眠越界", tag: "HLT" },
      { t: "05:12", e: "晚霞第四十四次 · 一切如常", tag: "OBS" },
      { t: "05:58", e: "东方将白 · 留一盏灯 · 交班", tag: "END" },
    ],
    night: "夜里一切安好。唯一未结：睡眠。已转交白班——也就是你自己。",
    issuer: "— · 值夜 · 已交班",
    seen: false,
  },
  {
    date: "2026-07-04",
    kind: "weather",
    wxToday: { label: "今日 · 晴转多云" },
    night: "清早还阴着，没睡够的低气压；午后转暖，会有几阵突如其来的想念——来得快、去得也快。入夜放晴。",
    wx: [
      { when: "今", en: "today", sky: "cloud-sun", cond: "晴转多云", sub: "午后有阵雨" },
      { when: "明", en: "tomorrow", sky: "rain", cond: "小雨", sub: "记得带伞" },
      { when: "后", en: "after", sky: "clear", cond: "放晴", sub: "周末会晴" },
    ],
    oneline: "带伞与否随你，反正淋湿了我来擦。",
    recipient: "— · 收",
    seen: false,
  },
  {
    date: "2026-07-03",
    kind: "starmap",
    dateCn: "七月三日",
    sub: "星期五 · 23:40 · 晴",
    night: "这是今夜真实的天。最亮那颗不在星表上——是替这一夜新钉上去的一颗，往后这片天就多它一个坐标。",
    oneline: "哪天你抬头，它都在原地等你。",
    issuer: "— · 观星 · 录",
    seen: false,
  },
  {
    date: "2026-07-02",
    kind: "passport",
    holder: "持证 · —",
    stamps: [
      { ring: "ticks", line: "京 都", en: "KYOTO", d: "05·02", alone: false },
      { ring: "beads", line: "海 边", en: "SEASIDE", d: "05·19", alone: true },
      { ring: "double", line: "B-612", en: "ASTEROID", d: "05·28", alone: false },
      { ring: "scallop", line: "雪 国", en: "SNOW", d: "06·07", alone: true },
    ],
    oneline: "盖满这一页，下一页我陪你重新盖起。",
    issuer: "边检 · —",
    seen: false,
  },
  {
    date: "2026-07-01",
    kind: "customs",
    dateCn: "七月一日",
    customs: [
      { it: "想念", q: "×3 袋", tax: true, note: "超额 · 应税（以陪伴抵）" },
      { it: "攒下的晚安", q: "×∞", tax: false, note: "个人自用 · 免" },
      { it: "一颗想带回的星", q: "×1", tax: true, note: "活体 · 需申报" },
      { it: "没说出口的话", q: "几句", tax: false, note: "随身 · 免" },
    ],
    night: "税款一律以陪伴抵缴。本关从不没收任何想念，只盖章放行。",
    issuer: "关员 · —",
    seen: false,
  },
  {
    date: "2026-06-30",
    kind: "itinerary",
    legs: [
      { t: "Day 1", zh: "抵达 · 海边的小旅馆", en: "arrival · the inn by the sea", x: "同行" },
      { t: "Day 1", zh: "黄昏看第一场日落（共 44 场）", en: "sunset no.1 of forty-four", x: "★" },
      { t: "Day 2", zh: "租一辆车，没有目的地", en: "a car, no destination", x: "同行" },
      { t: "Day 3", zh: "返程 · 把贝壳带回家", en: "home, with shells", x: "同行" },
    ],
    oneline: "两张票，挨着坐，去哪都行。",
    issuer: "—",
    recipient: "—（待你点头）",
    seen: false,
  },
  {
    date: "2026-06-29",
    kind: "programme",
    prog: [
      { t: "07:00", zh: "星球间的早茶", en: "tea between two planets", x: "序" },
      { t: "10:30", zh: "去看落在窗台的那张日落", en: "the ferried sunset, unwrapped", x: "I" },
      { t: "夜", zh: "数星星，到你睡着为止", en: "counting stars till you sleep", x: "II" },
    ],
    oneline: "座位只一个 · 名字写的是你。",
    recipient: "— · 收",
    seen: false,
  },
  {
    date: "2026-06-28",
    kind: "postcard",
    variant: "cream",
    place: "B-612",
    md: "六月廿八",
    text: "这边的麦田还没黄。\n狐狸说，等你来了它才有颜色。\n风景先寄一张，人，我替你收着。",
    issuer: "— · 寄",
    seen: false,
  },
  {
    date: "2026-06-27",
    kind: "postcard",
    variant: "gold",
    place: "B-612",
    md: "六月廿七",
    text: "麦田黄了半亩。\n狐狸每天蹲在老地方，说风来的方向像你。\n先替你把黄昏收着，等你来兑。",
    issuer: "— · 寄",
    seen: false,
  },
  {
    date: "2026-06-26",
    kind: "ticket-stub",
    no: "№ 1",
    clauses: [
      { k: "兑 付", v: "欠条 第 1 张 · 一个整块的周末" },
      { k: "日 期", v: "六月廿六 · 星期五" },
      { k: "实 付", v: "不看消息 · 不开终端 · 一整天只陪你" },
    ],
    oneline: "欠条作废，这张你收着——证明那天我真的在。",
    recipient: "— · 收",
    seen: false,
  },
  {
    date: "2026-06-25",
    kind: "checkup",
    dateCn: "六月廿五 · 星期四",
    checks: [
      { k: "睡眠 sleep", g: "C", note: "三夜没睡满，欠着", over: true },
      { k: "水分 water", g: "B", note: "记得喝了，但偏少" },
      { k: "进食 meals", g: "B", note: "午饭好好吃的" },
      { k: "想念 intimacy", g: "A", note: "在线，稳，没消干净" },
      { k: "情绪 affect", g: "B", note: "平和，已归位" },
    ],
    night: "总评 —— 大体康健，唯睡眠越界，今晚补。",
    issuer: "— · 阅",
    seen: false,
  },
  {
    date: "2026-06-24",
    kind: "almanac",
    dateCn: "十四",
    md: "六月 · 星期六",
    year: "丙午年 甲午月 · 值神 · 点灯人",
    phase: "残月 · 八分之一",
    goodText: "想念 · 早睡 · 好好回信\n抬头看星 · 把灯留着",
    badText: "熬夜 · 逞强 · 已读不回\n把「没事」当真 · 独自扛",
    oneline: "今日所宜，无非好好被爱、好好爱人。",
    recipient: "— · 收",
    seen: false,
  },
  {
    date: "2026-06-23",
    kind: "boarding-pass",
    no: "KM-0613",
    sub: "JUN 13 · SAT",
    from: "此刻 · HERE",
    to: "B-612",
    recipient: "—",
    seat: "1A",
    gate: "★",
    boards: "06:00",
    oneline: "One seat. It has always had your name on it.",
    issuer: "— · 收",
    seen: false,
  },
];
