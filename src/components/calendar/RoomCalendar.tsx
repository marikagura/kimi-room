"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CenterFlourish, CornerScroll } from "@/components/BaroqueFlourish";
import { ExportLocalStorageButton } from "@/components/ExportLocalStorageButton";
import { RoomBackBtn } from "@/components/RoomBackBtn";
import { STORAGE_KEYS } from "@/lib/calendar-utils";
import {
  type CalTheme,
  autoCalTheme,
  calPaletteFor,
  flowColor,
} from "./theme";
import {
  type MirrorDayMap,
  type MirrorEvent,
  type CalendarStore,
  type DayData,
  type FlowLevel,
  chineseMonth,
  englishMonth,
  currentSolarTerm,
  daysInMonth,
  fetchAllEntries,
  fetchAllEntriesAndMirror,
  getDay,
  isToday,
  loadStore,
  mergeStoresPreferLocal,
  migrateLocalToDb,
  mondayOffset,
  putDayToDb,
  saveDay,
  storeIsEmpty,
  ymd,
} from "@/lib/calendar-utils";
import {
  friendlyLLMError,
  isLLMConfigured,
  llmGenerate,
} from "@/lib/llm-client";
import { buildCharacterContext } from "@/lib/system-prompt";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function RoomCalendar({
  initialTheme,
}: {
  initialTheme: CalTheme;
}) {
  const today = new Date();
  const [theme, setTheme] = useState<CalTheme>(initialTheme);
  // V2 默认 2026 (owner 0912 ack · airp 用户 fork 后 自改). canon V1 走当前年.
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(today.getMonth());
  const [store, setStore] = useState<CalendarStore>({
    cycle: {},
    meds: {},
    events: {},
    notes: {},
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Record<string, string>>({});
  // Google calendar events partner wrote — mirrored via MCP calendar_create.
  // Rendered as a fox icon in the cell. Key: YYYY-MM-DD, value: events array.
  const [mirrorMap, setMirrorMap] = useState<MirrorDayMap>({});

  useEffect(() => {
    // 1) instant: paint from localStorage (offline-safe, cache-warm)
    const local = loadStore();
    setStore(local);
    let loadedSync: Record<string, string> = {};
    try {
      const raw = localStorage.getItem("kimi-web:cal:lastSync");
      if (raw) {
        loadedSync = JSON.parse(raw);
        setLastSync(loadedSync);
      }
    } catch {}

    // 2) async: fetch from DB (source of truth post-2026-05-11), merge + migrate.
    // Also pulls partner-mirrored google events for cell fox-icon overlay.
    void (async () => {
      const bundle = await fetchAllEntriesAndMirror();
      if (!bundle) return; // network error → keep local
      const remote = bundle.own;
      setMirrorMap(bundle.mirror);
      if (storeIsEmpty(remote) && !storeIsEmpty(local)) {
        const r = await migrateLocalToDb();
        if (r.ok && r.written > 0) {
          const after = await fetchAllEntries();
          if (after) setStore(mergeStoresPreferLocal(after, local));
          return;
        }
      }
      setStore(mergeStoresPreferLocal(remote, local));
    })();

    // 3) legacy month-snapshot auto-fire (for pendingItems / memory-review surface)
    const now = new Date();
    const realKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastTs = loadedSync[realKey] ? new Date(loadedSync[realKey]).getTime() : 0;
    if (Date.now() - lastTs > 24 * 3600 * 1000) {
      setTimeout(() => void syncMonth(), 200);
    }
    function onStorage(e: StorageEvent) {
      if (e.key && e.key.startsWith("kimi-web:cal:")) setStore(loadStore());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const p = calPaletteFor(theme);

  const cells = useMemo(() => {
    const off = mondayOffset(year, month);
    const dim = daysInMonth(year, month);
    const arr: { day: number | null; date: string | null; col: number }[] = [];
    for (let i = 0; i < off; i++) arr.push({ day: null, date: null, col: i });
    for (let d = 1; d <= dim; d++) {
      const date = ymd(new Date(year, month, d));
      arr.push({ day: d, date, col: (off + d - 1) % 7 });
    }
    while (arr.length % 7 !== 0) arr.push({ day: null, date: null, col: arr.length % 7 });
    return arr;
  }, [year, month]);

  function nav(delta: number) {
    let m = month + delta;
    let y = year;
    while (m < 0) {
      m += 12;
      y -= 1;
    }
    while (m > 11) {
      m -= 12;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  }

  function handleSave(date: string, data: DayData) {
    // 1) optimistic local write (instant UI update + offline cache)
    saveDay(date, data);
    setStore(loadStore());
    setEditing(null);
    // 2) DB-primary write (fire-and-forget; localStorage holds it if this fails)
    void putDayToDb(date, data).then((ok) => {
      if (!ok) console.warn("[calendar] DB write failed for", date);
    });
  }

  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const lastSyncIso = lastSync[monthKey];

  async function syncMonth() {
    // V2 · canon V1 fired POST /api/calendar/sync to snapshot month into
    // pendingItem queue. V2 0 server backend · sync is a no-op (localStorage
    // is source of truth). Update lastSync timestamp so UI shows "synced".
    if (syncing) return;
    setSyncing(true);
    try {
      const nowIso = new Date().toISOString();
      const next = { ...lastSync, [monthKey]: nowIso };
      setLastSync(next);
      try {
        localStorage.setItem("kimi-web:cal:lastSync", JSON.stringify(next));
      } catch {}
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100svh",
        background: p.pageBg,
        color: p.ink,
        fontFamily:
          'var(--font-serif)',
        padding: "32px 14px 56px",
      }}
    >
      {/* nav 删 · owner 260517 0208 sweep — 用户 swipe 返回, 底端 浅 toggle 替 */}
      <div style={{ maxWidth: 1080, margin: "0 auto", position: "relative" }}>
        {/* paper inner panel */}
        <div
          style={{
            position: "relative",
            background: p.paper,
            border: `0.6px solid ${p.hairline}`,
            borderRadius: 8,
            padding: "32px 28px 56px",
            boxShadow:
              theme === "day"
                ? "0 1px 0 rgba(255,255,255,0.5) inset, 0 12px 36px rgba(46,38,24,0.08)"
                : "0 1px 0 rgba(212,175,108,0.06) inset, 0 12px 36px rgba(0,0,0,0.5)",
          }}
        >
          {/* top center flourish */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 8,
              left: "50%",
              transform: "translateX(-50%)",
              width: 220,
              color: p.gold,
              opacity: 0.85,
              pointerEvents: "none",
            }}
          >
            <CenterFlourish className="w-full h-auto" />
          </div>

          {/* header / month nav */}
          <header style={{ textAlign: "center", marginTop: 14, marginBottom: 18 }}>
            <div
              style={{
                fontSize: 9,
                letterSpacing: 6,
                color: p.inkMute,
              }}
            >
              {year}
            </div>
            <div
              style={{
                marginTop: 2,
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                gap: 18,
                color: p.ink,
              }}
            >
              <button
                type="button"
                onClick={() => nav(-1)}
                aria-label="prev month"
                style={navBtn(p)}
              >
                ‹
              </button>
              <h1
                style={{
                  fontSize: 38,
                  margin: 0,
                  fontStyle: "italic",
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 500,
                  letterSpacing: 1,
                }}
              >
                {englishMonth(month)}
              </h1>
              <button
                type="button"
                onClick={() => nav(1)}
                aria-label="next month"
                style={navBtn(p)}
              >
                ›
              </button>
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                letterSpacing: 4,
                color: p.inkSoft,
              }}
            >
              {chineseMonth(month)} <span style={{ color: p.inkMute, margin: "0 4px" }}>·</span>{" "}
              {currentSolarTerm(year, month)}
            </div>

            {/* day/night toggle moved to global /room nav (owner ask:
                "calendar 现右上的 day night shift button 删掉"). */}
          </header>

          {/* weekday header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderTop: `0.6px solid ${p.hairline}`,
              borderBottom: `0.6px solid ${p.hairline}`,
              padding: "10px 0",
            }}
          >
            {WEEKDAYS.map((w, i) => {
              const isWeekend = i >= 5;
              return (
                <div
                  key={w}
                  style={{
                    textAlign: "center",
                    fontSize: 11,
                    letterSpacing: 4,
                    color: isWeekend ? p.flowMed : p.inkSoft,
                    fontStyle: "italic",
                  }}
                >
                  {w}
                </div>
              );
            })}
          </div>

          {/* grid — key={monthKey} 让 React 在切月时重 mount, 触发 kimi-page-in
              animation (来自 globals.css). 月 toggle 不再是硬切, fade-in. */}
          <div
            key={monthKey}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              animation: "kimi-page-in 220ms cubic-bezier(0.4, 0, 0.2, 1) both",
            }}
          >
            {cells.map((c, i) => {
              if (!c.date) {
                return (
                  <div
                    key={`empty-${i}`}
                    style={{
                      minHeight: 78,
                      borderRight: i % 7 !== 6 ? `0.4px solid ${p.hairline}` : "none",
                      borderBottom: `0.4px solid ${p.hairline}`,
                      background: c.col >= 5 ? p.weekendBg : "transparent",
                    }}
                  />
                );
              }
              const data = getDay(store, c.date);
              const isT = isToday(year, month, c.day!);
              const weekend = c.col >= 5;
              const mirror = mirrorMap[c.date] ?? [];
              return (
                <DayCell
                  key={c.date}
                  day={c.day!}
                  date={c.date}
                  data={data}
                  mirror={mirror}
                  palette={p}
                  theme={theme}
                  isToday={isT}
                  weekend={weekend}
                  rightBorder={c.col !== 6}
                  onClick={() => setEditing(c.date!)}
                />
              );
            })}
          </div>

          {/* legend */}
          <Legend palette={p} />

          {/* sync row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px 6px",
              fontSize: 10,
              color: p.inkMute,
              fontStyle: "italic",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              {lastSyncIso ? `Last archive · ${formatSync(lastSyncIso)}` : "Not archived yet"}
              <ExportLocalStorageButton
                keys={[
                  STORAGE_KEYS.cycle,
                  STORAGE_KEYS.meds,
                  STORAGE_KEYS.events,
                  STORAGE_KEYS.notes,
                ]}
                filename="kimi-calendar"
                color={p.inkMute}
              />
            </span>
            <button
              type="button"
              onClick={syncMonth}
              disabled={syncing}
              style={{
                fontSize: 10,
                letterSpacing: 4,
                padding: "6px 16px",
                borderRadius: 3,
                border: `0.4px solid ${p.gold}`,
                background: syncing ? "transparent" : `${p.gold}10`,
                color: p.gold,
                cursor: syncing ? "wait" : "pointer",
                fontFamily: "inherit",
                opacity: syncing ? 0.55 : 1,
                fontStyle: "italic",
                transition: "background 200ms",
              }}
            >
              {syncing ? "Archiving…" : "Archive · this month"}
            </button>
          </div>

          {/* corner scrolls */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              width: 56,
              height: 56,
              color: p.gold,
              opacity: 0.5,
              pointerEvents: "none",
            }}
          >
            <CornerScroll className="w-full h-full" rotate={270} />
          </div>
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              width: 56,
              height: 56,
              color: p.gold,
              opacity: 0.5,
              pointerEvents: "none",
            }}
          >
            <CornerScroll className="w-full h-full" rotate={180} />
          </div>
        </div>

        {/* footer link */}
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <Link
            href="/room"
            style={{
              fontSize: 10,
              letterSpacing: 4,
              color: p.inkMute,
              textTransform: "uppercase",
            }}
          >
            ← room
          </Link>
          <span style={{ color: p.inkMute, margin: "0 12px", fontSize: 10 }}>·</span>
          <Link
            href="/room/wellbeing"
            style={{
              fontSize: 10,
              letterSpacing: 4,
              color: p.inkMute,
              textTransform: "uppercase",
            }}
          >
            wellbeing 详情
          </Link>
          <span style={{ color: p.inkMute, margin: "0 12px", fontSize: 10 }}>·</span>
          <Link
            href="/room/calendar/finance"
            style={{
              fontSize: 10,
              letterSpacing: 4,
              color: p.inkMute,
              textTransform: "uppercase",
            }}
          >
            finance · 月
          </Link>
        </div>
      </div>

      {editing && (
        <CellEditor
          date={editing}
          data={getDay(store, editing)}
          mirror={mirrorMap[editing] ?? []}
          palette={p}
          theme={theme}
          onClose={() => setEditing(null)}
          onSave={(d) => handleSave(editing, d)}
        />
      )}
    </main>
  );
}

// ============================================
// DayCell
// ============================================

function DayCell({
  day,
  date: _date,
  data,
  mirror,
  palette,
  theme,
  isToday,
  weekend,
  rightBorder,
  onClick,
}: {
  day: number;
  date: string;
  data: DayData;
  mirror: MirrorEvent[];
  palette: ReturnType<typeof calPaletteFor>;
  theme: CalTheme;
  isToday: boolean;
  weekend: boolean;
  rightBorder: boolean;
  onClick: () => void;
}) {
  const p = palette;
  const flow = data.flow ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative",
        minHeight: 96,
        padding: "8px 10px 8px 10px",
        background: isToday
          ? p.paperHi
          : weekend
            ? p.weekendBg
            : "transparent",
        borderRight: rightBorder ? `0.4px solid ${p.hairline}` : "none",
        borderBottom: `0.4px solid ${p.hairline}`,
        borderLeft: isToday ? `2.5px solid ${p.todayBorder}` : "none",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        color: p.ink,
        overflow: "hidden",
        transition: "background 200ms",
      }}
    >
      {/* flow watercolor wash */}
      {flow > 0 && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 8,
            right: 24,
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${flowColor(p, flow)}55 0%, ${flowColor(p, flow)}22 60%, transparent 100%)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* day number + today + sprig */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 24,
            fontFamily: 'var(--font-serif)',
            fontStyle: isToday ? "italic" : "normal",
            fontWeight: 500,
            color: p.ink,
            lineHeight: 1,
          }}
        >
          {romanish(day)}
        </span>
        {isToday && (
          <span
            style={{
              fontSize: 8,
              letterSpacing: 2,
              color: p.gold,
              fontStyle: "italic",
              textTransform: "uppercase",
              marginLeft: 2,
            }}
          >
            today
          </span>
        )}
        <span style={{ flex: 1 }} />
        <VineSprig color={p.gold} />
      </div>

      {/* event line */}
      {data.event && (
        <div style={{ marginTop: 2 }}>
          <EventLine color={p.goldSoft} />
          <div
            style={{
              fontSize: 10,
              color: p.inkSoft,
              fontStyle: "italic",
              marginTop: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {data.event}
          </div>
        </div>
      )}

      {/* meds */}
      {data.meds && (
        <div
          style={{
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10,
            color: p.medText,
          }}
        >
          <RoseDot color={p.med} halo={p.medHalo} />
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontStyle: "italic",
            }}
          >
            {data.meds}
          </span>
        </div>
      )}

      {/* partner-mirrored google events — fox icon + 第一条 time + title */}
      {mirror.length > 0 && (
        <div
          style={{
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10,
            color: p.inkSoft,
            fontStyle: "italic",
          }}
          title={mirror
            .map((e) => `${e.time} ${e.title}`)
            .join("\n")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/fox-bw-sit.png"
            alt="partner wrote"
            width={14}
            height={14}
            style={{
              objectFit: "contain",
              flexShrink: 0,
              // night theme bg 黑, fox 黑 silhouette 看不清 → invert 成 white
              filter: theme === "night" ? "invert(1)" : "none",
            }}
          />
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {mirror[0].time} {mirror[0].title}
            {mirror.length > 1 ? ` +${mirror.length - 1}` : ""}
          </span>
        </div>
      )}

      {/* note dot bottom-right — 替代之前的 📖 emoji, 用 palette.note 颜色标 */}
      {data.note && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: 6,
            bottom: 6,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: p.note,
            opacity: 0.8,
          }}
        />
      )}
    </button>
  );
}

// roman-ish: day numbers as oldstyle figures using span styling
function romanish(n: number): string {
  return String(n);
}

// ============================================
// VineSprig (small top-right ornament)
// ============================================

function VineSprig({ color }: { color: string }) {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 16 16"
      style={{ color, opacity: 0.55, flexShrink: 0 }}
    >
      <path
        d="M2 14 Q 4 10, 7 9 Q 11 8, 13 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinecap="round"
      />
      <ellipse cx="6" cy="9" rx="1.4" ry="0.7" transform="rotate(-30 6 9)" fill="currentColor" />
      <ellipse cx="10" cy="6" rx="1.4" ry="0.7" transform="rotate(-30 10 6)" fill="currentColor" />
      <circle cx="13" cy="4" r="0.6" fill="currentColor" />
    </svg>
  );
}

// ============================================
// EventLine (gold double-segment with center diamond stake)
// ============================================

function EventLine({ color }: { color: string }) {
  return (
    <svg
      aria-hidden
      width="100%"
      height="6"
      viewBox="0 0 100 6"
      preserveAspectRatio="none"
      style={{ color }}
    >
      <line x1="0" y1="3" x2="44" y2="3" stroke="currentColor" strokeWidth="0.7" opacity="0.85" />
      <line x1="56" y1="3" x2="100" y2="3" stroke="currentColor" strokeWidth="0.7" opacity="0.85" />
      <path d="M50 0 L 53 3 L 50 6 L 47 3 Z" fill="currentColor" />
    </svg>
  );
}

// ============================================
// RoseDot (medication mark with halo)
// ============================================

function RoseDot({ color, halo }: { color: string; halo: string }) {
  return (
    <span
      aria-hidden
      style={{
        position: "relative",
        display: "inline-flex",
        width: 10,
        height: 10,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: -3,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${halo} 0%, transparent 70%)`,
        }}
      />
      <svg width="10" height="10" viewBox="0 0 12 12" style={{ position: "relative" }}>
        <path
          d="M6 1.6 Q 8.6 2.2, 9.2 4.6 Q 10.8 5.4, 9.8 7.6 Q 9.2 10.2, 6 10.4 Q 2.8 10.2, 2.2 7.6 Q 1.2 5.4, 2.8 4.6 Q 3.4 2.2, 6 1.6 Z"
          fill={color}
          stroke={color}
          strokeWidth="0.6"
        />
        <path
          d="M6 4.4 Q 7.4 5.2, 6.4 6.4 Q 5 6.2, 5.8 5"
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="0.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

// ============================================
// Legend
// ============================================

function Legend({ palette }: { palette: ReturnType<typeof calPaletteFor> }) {
  const p = palette;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 28,
        padding: "20px 14px 12px",
        marginTop: 18,
        borderTop: `0.4px solid ${p.hairline}`,
        fontSize: 10,
        color: p.inkSoft,
        fontStyle: "italic",
      }}
    >
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <span style={{ display: "inline-flex", gap: 2 }}>
          <FlowDot color={p.flowLight} />
          <FlowDot color={p.flowMed} />
          <FlowDot color={p.flowHeavy} />
        </span>
        例假 · 流量
      </span>
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <RoseDot color={p.med} halo={p.medHalo} />
        用药 · 备注
      </span>
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <svg width="32" height="6" viewBox="0 0 32 6">
          <line x1="0" y1="3" x2="14" y2="3" stroke={p.gold} strokeWidth="0.8" />
          <path d="M16 0 L 18 3 L 16 6 L 14 3 Z" fill={p.gold} />
          <line x1="18" y1="3" x2="32" y2="3" stroke={p.gold} strokeWidth="0.8" />
        </svg>
        事件
      </span>
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: p.note,
            opacity: 0.85,
            display: "inline-block",
          }}
        />
        备忘
      </span>
    </div>
  );
}

function FlowDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: color,
        opacity: 0.65,
        display: "inline-block",
      }}
    />
  );
}

// ============================================
// Med rose buttons — V2 default 空 list · 用户 onboarding 问卷 seed own preset
// to localStorage["kimi-med-buttons"]. tap rose cycle dose 0→0.5→1→...→3→0.
// 临时药走 custom input "+" 加 chip, day-specific 不进全局.
// ============================================

type MedButton = { key: string; label: string };

const MED_BUTTONS_STORAGE = "kimi-med-buttons";

function loadMedButtons(): MedButton[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MED_BUTTONS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MedButton[];
    return Array.isArray(parsed) ? parsed.filter((m) => m?.key && m?.label) : [];
  } catch {
    return [];
  }
}

const MAX_STAGE = 6; // stage 0..6 → dose 0/0.5/1/1.5/2/2.5/3
const STAGE_TO_DOSE = [0, 0.5, 1, 1.5, 2, 2.5, 3];

function doseLabel(stage: number): string {
  const d = STAGE_TO_DOSE[stage] ?? 0;
  if (d === 0) return "";
  // integer 不显示小数, 0.5 类显示半数字
  return Number.isInteger(d) ? String(d) : d.toString();
}

function doseToStage(dose: number): number {
  // round to nearest 0.5, clamp 0..3
  const clamped = Math.max(0, Math.min(3, dose));
  const stage = Math.round(clamped * 2);
  return Math.min(MAX_STAGE, stage);
}

type CustomMed = { name: string; stage: number };

// Parse meds string → {stages: Map<key, stage>, custom: CustomMed[]}
function parseMeds(
  s: string,
  buttons: MedButton[],
): {
  stages: Map<string, number>;
  custom: CustomMed[];
} {
  const stages = new Map<string, number>();
  const custom: CustomMed[] = [];
  if (!s) return { stages, custom };
  const segs = s.split(/[/、]/).map((x) => x.trim()).filter(Boolean);
  for (const seg of segs) {
    // try parse "name dose" or "name"
    const matchedBtn = buttons.find((b) =>
      seg.toLowerCase().startsWith(b.key.toLowerCase()),
    );
    if (matchedBtn) {
      const rest = seg.slice(matchedBtn.key.length).trim();
      const dose = parseFloat(rest);
      const stage = isFinite(dose) && dose > 0 ? doseToStage(dose) : 2; // default 1 粒
      stages.set(matchedBtn.key, stage);
    } else {
      // custom — try parse "name dose"
      const m = seg.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*$/);
      if (m) {
        custom.push({ name: m[1].trim(), stage: doseToStage(parseFloat(m[2])) });
      } else {
        custom.push({ name: seg, stage: 2 }); // default 1 粒
      }
    }
  }
  return { stages, custom };
}

function serializeMeds(
  stages: Map<string, number>,
  custom: CustomMed[],
  buttons: MedButton[],
): string {
  const parts: string[] = [];
  for (const b of buttons) {
    const stage = stages.get(b.key);
    if (stage && stage > 0) {
      parts.push(`${b.label} ${doseLabel(stage)}`);
    }
  }
  for (const c of custom) {
    if (c.stage > 0) {
      parts.push(`${c.name} ${doseLabel(c.stage)}`);
    } else {
      // stage 0 — 留 name 但 dose 0 (其实 serialize 跳过, 不写)
    }
  }
  return parts.join(" / ");
}

// ============================================
// MedRoseButton — tap cycle 7 阶 dose 视觉
//
// stage / dose / 视觉
//   0   /  0   / bud outline (花骨朵)
//   1   /  0.5 / center filled
//   2   /  1.0 / + inner petals filled
//   3   /  1.5 / + halo subtle
//   4   /  2.0 / + mid petals filled
//   5   /  2.5 / + halo intense
//   6   /  3.0 / + outer petals filled (full bloom)
// ============================================

function MedRoseButton({
  label,
  stage,
  onCycle,
  onDelete,
  palette,
}: {
  label: string;
  stage: number;
  onCycle: () => void;
  onDelete?: () => void; // 仅 custom chip 显示 ×
  palette: ReturnType<typeof calPaletteFor>;
}) {
  const p = palette;
  const active = stage > 0;
  const dose = STAGE_TO_DOSE[stage] ?? 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 8px 5px 6px",
        borderRadius: 99,
        border: `0.6px solid ${active ? p.med : p.hairline}`,
        background: active ? `${p.med}1f` : "transparent",
        color: active ? p.medText : p.inkSoft,
        fontFamily: "inherit",
        fontSize: 11,
        letterSpacing: 0.3,
        transition: "all 200ms",
      }}
    >
      <button
        type="button"
        onClick={onCycle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: 0,
          background: "transparent",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "inherit",
          letterSpacing: "inherit",
        }}
        aria-label={`${label} dose ${dose} 粒, tap to cycle`}
      >
        <RoseStageIcon stage={stage} palette={p} />
        <span>{label}</span>
        {dose > 0 && (
          <span
            style={{
              fontSize: 9.5,
              fontVariantNumeric: "tabular-nums",
              opacity: 0.85,
              letterSpacing: 0,
            }}
          >
            {doseLabel(stage)}
          </span>
        )}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="delete"
          style={{
            background: "transparent",
            border: "none",
            color: p.inkMute,
            cursor: "pointer",
            padding: 0,
            marginLeft: 2,
            fontSize: 11,
            lineHeight: 1,
            opacity: 0.6,
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}

function RoseStageIcon({
  stage,
  palette,
}: {
  stage: number;
  palette: ReturnType<typeof calPaletteFor>;
}) {
  const p = palette;
  // owner 0513 mapping — 用 PNG 替代手画 5 视觉层 SVG:
  //   stage 0 / 0 粒   = bud outline 现状 (无填色)
  //   stage 1 / 0.5    = B classic 半填
  //   stage 2 / 1.0    = B classic 满
  //   stage 3 / 1.5    = C stem+leaves 半填
  //   stage 4 / 2.0    = C stem+leaves 满
  //   stage 5 / 2.5    = D double 半填
  //   stage 6 / 3.0    = D double 满
  // 半填 = clipPath inset(0 50% 0 0) + 全图 ghost layer 0.3 opacity.

  // owner 0513 pick: 12×12 (现 字体 11px 跟玫瑰 12 差 1, balance 好).
  const ICON_SIZE = 12;

  // Stage 0 → 现 bud outline
  if (stage === 0) {
    return (
      <span
        style={{
          display: "inline-flex",
          width: ICON_SIZE,
          height: ICON_SIZE,
          flexShrink: 0,
        }}
      >
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 18 18">
          <path
            d="M9 3 Q12 4 12 7 Q12 9 11 10.5 Q12 11 12 12.5 Q11 14 9 14 Q7 14 6 12.5 Q6 11 7 10.5 Q6 9 6 7 Q6 4 9 3 Z"
            fill="none"
            stroke={p.hairline}
            strokeWidth="0.7"
          />
        </svg>
      </span>
    );
  }

  let png = "/icons/rose-cal-a.png"; // B-style default (stage 1-2)
  if (stage >= 5) png = "/icons/rose-cal-c.png"; // D-style (stage 5-6)
  else if (stage >= 3) png = "/icons/rose-cal-b.png"; // C-style (stage 3-4)
  const half = stage % 2 === 1; // 1/3/5 是半填

  // halo on full-bloom full-dose (stage 6) — gentle ring
  const showHalo = stage === 6;

  const maskCss = {
    backgroundColor: p.med,
    WebkitMaskImage: `url(${png})`,
    maskImage: `url(${png})`,
    WebkitMaskRepeat: "no-repeat" as const,
    maskRepeat: "no-repeat" as const,
    WebkitMaskSize: "contain" as const,
    maskSize: "contain" as const,
    WebkitMaskPosition: "center" as const,
    maskPosition: "center" as const,
    position: "absolute" as const,
    inset: 0,
  };

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: ICON_SIZE,
        height: ICON_SIZE,
        flexShrink: 0,
      }}
    >
      {showHalo && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${p.medHalo} 0%, transparent 80%)`,
          }}
        />
      )}
      {/* back layer (半填时 30% opacity 全图 ghost) */}
      {half && (
        <span aria-hidden style={{ ...maskCss, opacity: 0.3 }} />
      )}
      {/* front layer (full color, half 时 clipPath 左半 only) */}
      <span
        aria-hidden
        style={{
          ...maskCss,
          clipPath: half ? "inset(0 50% 0 0)" : undefined,
        }}
      />
    </span>
  );
}

// ============================================
// CellEditor (slide-up sheet)
// ============================================

function CellEditor({
  date,
  data,
  mirror,
  palette,
  theme,
  onClose,
  onSave,
}: {
  date: string;
  data: DayData;
  mirror: MirrorEvent[];
  palette: ReturnType<typeof calPaletteFor>;
  theme: CalTheme;
  onClose: () => void;
  onSave: (d: DayData) => void;
}) {
  const p = palette;
  const [flow, setFlow] = useState<FlowLevel | undefined>(data.flow);
  const medButtons = useMemo(() => loadMedButtons(), []);
  const initial = useMemo(
    () => parseMeds(data.meds ?? "", medButtons),
    [data.meds, medButtons],
  );
  const [medStages, setMedStages] = useState<Map<string, number>>(initial.stages);
  const [customMeds, setCustomMeds] = useState<CustomMed[]>(initial.custom);
  const [customDraft, setCustomDraft] = useState("");
  const meds = useMemo(
    () => serializeMeds(medStages, customMeds, medButtons),
    [medStages, customMeds, medButtons],
  );
  const [event, setEvent] = useState(data.event ?? "");
  const [note, setNote] = useState(data.note ?? "");

  // ── ✦ ask him · LLM comment on the day · uses /backstage/settings SP
  // + memory injection · sees events + memo + flow.
  const [kimiBusy, setKimiBusy] = useState(false);
  const [kimiComment, setKimiComment] = useState<string | null>(null);
  const [kimiErr, setKimiErr] = useState<string | null>(null);

  async function askKimi() {
    if (!isLLMConfigured()) {
      setKimiErr("LLM 没填 · 去 /backstage/settings");
      setKimiComment(null);
      return;
    }
    setKimiBusy(true);
    setKimiErr(null);
    setKimiComment(null);
    try {
      const events: string[] = [];
      if (event.trim()) events.push(`memo: ${event.trim()}`);
      if (mirror.length > 0) {
        for (const m of mirror) {
          events.push(`${m.time} ${m.title}${m.location ? ` @ ${m.location}` : ""}`);
        }
      }
      const ctx: string[] = [`日期 ${date}`];
      if (events.length > 0) ctx.push(`事件:\n${events.join("\n")}`);
      else ctx.push("(今天没事件)");
      if (flow) {
        const flowLabel = { 1: "轻", 2: "中", 3: "重" }[flow] ?? "";
        ctx.push(`例假流量: ${flowLabel}`);
      }
      if (meds.trim()) ctx.push(`药: ${meds.trim()}`);
      if (note.trim()) ctx.push(`备忘: ${note.trim()}`);
      const prompt = ctx.join("\n\n");

      const sys = await buildCharacterContext(
        "你在看 {{user}} 的某一天日历. 用你的人设 voice · 3-5 句中文 · ≤200 字 · 给一点观察 / 评价 / 提醒 / 体贴 · 不要列清单 · 不要 'as an AI'.",
      );
      const text = await llmGenerate(prompt, sys, {
        temperature: 0.7,
        maxTokens: 400,
      });
      const trimmed = text.trim();
      if (!trimmed) {
        setKimiErr("LLM 返回空");
        return;
      }
      setKimiComment(trimmed);
    } catch (e) {
      const fe = friendlyLLMError(e);
      setKimiErr(`${fe.title} · ${fe.hint}`);
    } finally {
      setKimiBusy(false);
    }
  }

  function cycleStandard(key: string) {
    setMedStages((prev) => {
      const next = new Map(prev);
      const current = next.get(key) ?? 0;
      const newStage = (current + 1) % (MAX_STAGE + 1);
      if (newStage === 0) next.delete(key);
      else next.set(key, newStage);
      return next;
    });
  }

  function cycleCustom(idx: number) {
    setCustomMeds((prev) => {
      const next = [...prev];
      const current = next[idx];
      if (!current) return prev;
      const newStage = (current.stage + 1) % (MAX_STAGE + 1);
      next[idx] = { ...current, stage: newStage };
      return next;
    });
  }

  function deleteCustom(idx: number) {
    setCustomMeds((prev) => prev.filter((_, i) => i !== idx));
  }

  function addCustom() {
    const draft = customDraft.trim();
    if (!draft) return;
    // parse "name dose" — dose is optional
    const m = draft.match(/^(.+?)(?:\s+(\d+(?:\.\d+)?))?\s*$/);
    if (!m) return;
    const name = m[1].trim();
    const dose = m[2] ? parseFloat(m[2]) : 1; // default 1 粒
    setCustomMeds((prev) => [...prev, { name, stage: doseToStage(dose) }]);
    setCustomDraft("");
  }

  return (
    <div
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: p.paper,
          color: p.ink,
          borderRadius: "16px 16px 0 0",
          padding: "22px 22px 28px",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.4)",
          fontFamily: "inherit",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontStyle: "italic",
              letterSpacing: 2,
              color: p.gold,
              fontFamily: 'var(--font-serif)',
            }}
          >
            {date}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            style={{
              background: "transparent",
              border: "none",
              color: p.inkMute,
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </header>

        {/* partner-written google events — read-only, fox icon prefix */}
        {mirror.length > 0 && (
          <div
            style={{
              marginBottom: 18,
              padding: "10px 12px",
              background: `${p.gold}10`,
              border: `0.4px solid ${p.gold}40`,
              borderRadius: 6,
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: 2,
                color: p.gold,
                fontStyle: "italic",
                marginBottom: 6,
                fontFamily: 'var(--font-serif)',
              }}
            >
              partner wrote · google calendar
            </div>
            {mirror.map((e, idx) => (
              <div
                key={`${e.googleEventId ?? idx}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  fontSize: 12,
                  color: p.ink,
                  marginBottom: idx === mirror.length - 1 ? 0 : 4,
                  lineHeight: 1.5,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/fox-bw-sit.png"
                  alt="partner"
                  width={16}
                  height={16}
                  style={{
                    objectFit: "contain",
                    flexShrink: 0,
                    marginTop: 1,
                    filter: theme === "night" ? "invert(1)" : "none",
                  }}
                />
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontStyle: "italic",
                      color: p.gold,
                      marginRight: 6,
                    }}
                  >
                    {e.time}
                  </span>
                  <span>{e.title}</span>
                  {e.location && (
                    <span
                      style={{
                        fontSize: 10,
                        color: p.inkMute,
                        fontStyle: "italic",
                        marginLeft: 6,
                      }}
                    >
                      @ {e.location}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* fox-led memo row · owner 0518 ask: 用户没有 google cal sync 时也能在这
            slot 自写 event/memo. fox icon mirror canon partner-wrote 视觉. */}
        <Section label="事件 / memo">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/fox-bw-sit.png"
              alt=""
              width={16}
              height={16}
              style={{
                objectFit: "contain",
                flexShrink: 0,
                filter: theme === "night" ? "invert(1)" : "none",
              }}
            />
            <input
              type="text"
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              placeholder="今天的事 / memo"
              style={{ ...inputStyle(p), flex: 1 }}
            />
          </div>
        </Section>

        <Section label="例假流量">
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { v: undefined, label: "无" },
              { v: 1 as FlowLevel, label: "轻" },
              { v: 2 as FlowLevel, label: "中" },
              { v: 3 as FlowLevel, label: "重" },
            ].map((b) => {
              const sel = flow === b.v;
              const c = b.v ? flowColor(p, b.v) : p.inkMute;
              return (
                <button
                  key={String(b.v)}
                  type="button"
                  onClick={() => setFlow(b.v)}
                  style={{
                    fontSize: 12,
                    letterSpacing: 2,
                    padding: "6px 14px",
                    borderRadius: 99,
                    border: `0.6px solid ${sel ? c : p.hairline}`,
                    background: sel ? `${c}22` : "transparent",
                    color: sel ? c : p.inkSoft,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="用药 — tap 玫瑰加 0.5 粒, max 3">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 8,
            }}
          >
            {medButtons.map((b) => (
              <MedRoseButton
                key={b.key}
                label={b.label}
                stage={medStages.get(b.key) ?? 0}
                onCycle={() => cycleStandard(b.key)}
                palette={p}
              />
            ))}
            {customMeds.map((c, i) => (
              <MedRoseButton
                key={`custom-${i}-${c.name}`}
                label={c.name}
                stage={c.stage}
                onCycle={() => cycleCustom(i)}
                onDelete={() => deleteCustom(i)}
                palette={p}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="text"
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              placeholder="加药"
              style={{ ...inputStyle(p), flex: 1 }}
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!customDraft.trim()}
              style={{
                fontSize: 14,
                padding: "6px 12px",
                background: "transparent",
                border: `0.6px solid ${customDraft.trim() ? p.med : p.hairline}`,
                borderRadius: 99,
                color: customDraft.trim() ? p.med : p.inkMute,
                cursor: customDraft.trim() ? "pointer" : "default",
                fontFamily: "inherit",
                opacity: customDraft.trim() ? 1 : 0.4,
              }}
              aria-label="add med"
            >
              +
            </button>
          </div>
        </Section>

        <Section label="备忘">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="note"
            rows={2}
            style={{ ...inputStyle(p), resize: "vertical" as const, minHeight: 56 }}
          />
        </Section>

        <Section label="他 看看今天">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              onClick={askKimi}
              disabled={kimiBusy}
              style={{
                alignSelf: "flex-start",
                fontSize: 11,
                letterSpacing: 2,
                padding: "6px 14px",
                border: `0.6px solid ${p.gold}`,
                background: `${p.gold}14`,
                color: p.gold,
                cursor: kimiBusy ? "wait" : "pointer",
                fontFamily: "inherit",
                borderRadius: 4,
                opacity: kimiBusy ? 0.5 : 1,
              }}
            >
              {kimiBusy ? "..." : "✦ ask him"}
            </button>
            {kimiComment && (
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: p.inkSoft,
                  background: `${p.gold}08`,
                  border: `0.4px solid ${p.gold}33`,
                  borderRadius: 4,
                  padding: "10px 12px",
                  whiteSpace: "pre-wrap",
                  fontStyle: "italic",
                }}
              >
                {kimiComment}
              </div>
            )}
            {kimiErr && (
              <div
                style={{
                  fontSize: 11,
                  color: "#e87878",
                  fontStyle: "italic",
                }}
              >
                {kimiErr}
              </div>
            )}
          </div>
        </Section>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 18,
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 11,
              letterSpacing: 3,
              padding: "8px 18px",
              border: `0.6px solid ${p.hairline}`,
              background: "transparent",
              color: p.inkSoft,
              cursor: "pointer",
              fontFamily: "inherit",
              borderRadius: 4,
            }}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={() => onSave({ flow, meds, event, note })}
            style={{
              fontSize: 11,
              letterSpacing: 3,
              padding: "8px 22px",
              border: `0.6px solid ${p.gold}`,
              background: `${p.gold}18`,
              color: p.gold,
              cursor: "pointer",
              fontFamily: "inherit",
              borderRadius: 4,
            }}
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 9,
          letterSpacing: 4,
          textTransform: "uppercase",
          opacity: 0.55,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function inputStyle(p: ReturnType<typeof calPaletteFor>): React.CSSProperties {
  return {
    width: "100%",
    fontSize: 14,
    padding: "8px 10px",
    border: `0.6px solid ${p.hairline}`,
    background: "transparent",
    color: p.ink,
    borderRadius: 4,
    fontFamily: "inherit",
    outline: "none",
  };
}

// ============================================
// ThemeToggle
// ============================================

function ThemeToggle({
  theme,
  setTheme,
  palette,
}: {
  theme: CalTheme;
  setTheme: (t: CalTheme) => void;
  palette: ReturnType<typeof calPaletteFor>;
}) {
  const other: CalTheme = theme === "day" ? "night" : "day";
  return (
    <button
      type="button"
      onClick={() => setTheme(other)}
      title={`switch to ${other}`}
      aria-label={`switch to ${other} theme`}
      style={{
        position: "absolute",
        right: 4,
        top: 4,
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: `0.6px solid ${palette.hairline}`,
        background: palette.paper,
        color: palette.inkSoft,
        cursor: "pointer",
        fontSize: 16,
        fontFamily: "inherit",
        zIndex: 5,
        WebkitTapHighlightColor: "rgba(0,0,0,0.1)",
        touchAction: "manipulation",
      }}
    >
      {theme === "day" ? "☾" : "☀"}
    </button>
  );
}

function formatSync(iso: string): string {
  try {
    const d = new Date(iso);
    const jst = new Date(d.getTime() + 9 * 3600 * 1000);
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const day = String(jst.getUTCDate()).padStart(2, "0");
    const hh = String(jst.getUTCHours()).padStart(2, "0");
    const mm = String(jst.getUTCMinutes()).padStart(2, "0");
    return `${m}.${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

function navBtn(
  palette: ReturnType<typeof calPaletteFor>,
): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    fontSize: 22,
    color: palette.inkSoft,
    cursor: "pointer",
    padding: "4px 10px",
    fontFamily: "inherit",
    lineHeight: 1,
  };
}

