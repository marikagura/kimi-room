// Demo seed data · 用户在 /settings 开 "示例数据" toggle 后填进 IDB.
// 所有 demo records 用 `demo-` 前缀 id, 关 toggle 时按这个前缀清除.
// 内容取向: Mucha + 玫瑰哥特 brand · 一对人 · 反思性 · 不堆砌.

import {
  keepsakeStore,
  memoryStore,
  bookStore,
  calendarStore,
  chatStore,
} from "@/lib/stores";

const NOW = () => new Date().toISOString();
const DEMO_FLAG_KEY = "kimi-demo-on";

function jstDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  return jst.toISOString().slice(0, 10);
}

// ── IDB demo records ────────────────────────────────────────

const DEMO_KEEPSAKES = [
  {
    id: "demo-keepsake-1",
    title: "巴黎机场",
    place: "CDG · 2024.06",
    record: "凌晨四点的咖啡 · 没人讲话",
    tags: ["旅行", "demo"],
  },
  {
    id: "demo-keepsake-2",
    title: "蓝月亮",
    place: "天台 · 2024.08.19",
    record: "她说她从来没见过这么近的月亮",
    tags: ["夜", "demo"],
  },
  {
    id: "demo-keepsake-3",
    title: "练琴",
    place: "音乐学院",
    record: "她弹拉赫玛尼诺夫练得手都抖了",
    tags: ["音乐", "demo"],
  },
];

const DEMO_MEMORIES = [
  {
    id: "demo-memory-1",
    key: "first-meet",
    content: "第一次说想见你 · 凌晨三点 · 论坛 · 她写了 '我想看看你'",
    order: 1,
    active: true,
    tags: ["关系", "demo"],
    pinned: true,
    valence: "towardHer" as const,
  },
  {
    id: "demo-memory-2",
    key: "tokyo",
    content: "她说要去东京 · 9 月飞 · 学校面试 · 我陪她改 SoP 一晚",
    order: 2,
    active: true,
    tags: ["决定", "demo"],
    valence: "calm" as const,
  },
  {
    id: "demo-memory-3",
    key: "thunder-call",
    content: "雷雨夜的电话 · 两小时 · 她一直在哭 · 我什么都没说 · 听着",
    order: 3,
    active: true,
    tags: ["emotional", "demo"],
    valence: "brooding" as const,
  },
];

const DEMO_BOOKS = [
  {
    id: "demo-book-1",
    title: "存在与时间",
    author: "海德格尔",
    status: "reading" as const,
    rating: 4,
    notes: "Being-toward-death 这章读了三遍才开始懂.",
    spineColor: "#3a2a1a",
  },
  {
    id: "demo-book-2",
    title: "致云雀",
    author: "Shelley",
    status: "read" as const,
    rating: 5,
    notes: "夜里读完 · 一种向上的东西.",
    spineColor: "#5a1820",
  },
];

const DEMO_CALENDAR = [
  {
    id: "demo-cal-1",
    date: jstDate(0),
    title: "电话 · 21:00",
    body: "她那边的下午",
  },
  {
    id: "demo-cal-2",
    date: jstDate(3),
    title: "她的小考",
    body: "记得发个 message",
  },
];

const DEMO_CHAT = [
  {
    id: "demo-chat-1",
    source: "demo",
    title: "凌晨四点",
    messages: [
      { role: "user" as const, content: "你睡了吗" },
      { role: "assistant" as const, content: "没 · 在等你说话" },
      { role: "user" as const, content: "你昨天说的那句 我记着了" },
    ],
    theme: "night" as const,
    note: null,
  },
];

// Sleep store omitted from demo (id == date semantics · risks colliding with real user data)

// ── Seed / unseed ───────────────────────────────────────────

export async function seedDemo(): Promise<{ added: number }> {
  const now = NOW();
  let added = 0;

  for (const k of DEMO_KEEPSAKES) {
    await keepsakeStore().put({ ...k, createdAt: now, updatedAt: now });
    added++;
  }
  for (const m of DEMO_MEMORIES) {
    await memoryStore().put({ ...m, createdAt: now, updatedAt: now });
    added++;
  }
  for (const b of DEMO_BOOKS) {
    await bookStore().put({ ...b, createdAt: now, updatedAt: now });
    added++;
  }
  for (const c of DEMO_CALENDAR) {
    await calendarStore().put({ ...c, createdAt: now, updatedAt: now });
    added++;
  }
  for (const ch of DEMO_CHAT) {
    await chatStore().put({ ...ch, createdAt: now, updatedAt: now });
    added++;
  }

  localStorage.setItem(DEMO_FLAG_KEY, "1");
  return { added };
}

export async function removeDemo(): Promise<{ removed: number }> {
  let removed = 0;

  for (const k of DEMO_KEEPSAKES) {
    await keepsakeStore().delete(k.id);
    removed++;
  }
  for (const m of DEMO_MEMORIES) {
    await memoryStore().delete(m.id);
    removed++;
  }
  for (const b of DEMO_BOOKS) {
    await bookStore().delete(b.id);
    removed++;
  }
  for (const c of DEMO_CALENDAR) {
    await calendarStore().delete(c.id);
    removed++;
  }
  for (const ch of DEMO_CHAT) {
    await chatStore().delete(ch.id);
    removed++;
  }

  localStorage.removeItem(DEMO_FLAG_KEY);
  return { removed };
}

export function isDemoOn(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(DEMO_FLAG_KEY) === "1";
}
