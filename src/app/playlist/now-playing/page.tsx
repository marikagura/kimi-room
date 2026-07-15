import Link from "next/link";
import { Glass } from "@/components/mucha/Glass";
import { LongDistanceAvatars } from "@/components/mucha/LongDistanceAvatars";
import { MuchaLilyIris } from "@/components/mucha/MuchaLilyIris";
import { MuchaVine } from "@/components/mucha/MuchaVine";
import { TrackTagEditor } from "@/components/mucha/TrackTagEditor";
import { MUCHA_COLORWAYS } from "@/lib/mucha-tokens";
import { TRACKS, extractNeteaseId } from "@/lib/tracks-data";
import { getTheme, ROSE_GOTHIC_DAY } from "@/lib/day-theme";

const FONT_STACK =
  'var(--font-serif)';

// V2 owner 0518 2203 catch · 之前 hardcoded ivory.light 不响应 cookie ·
// 改 theme-aware (day 玫瑰哥特 ivory · night ivory.dark obsidian).
const DAY_P = {
  bg: ROSE_GOTHIC_DAY.bg,
  paper: ROSE_GOTHIC_DAY.paper,
  ink: ROSE_GOTHIC_DAY.ink,
  accent: ROSE_GOTHIC_DAY.rose,
  mute: ROSE_GOTHIC_DAY.inkMute,
  hair: ROSE_GOTHIC_DAY.hair,
} as const;

export default async function NowPlayingPage({
  searchParams,
}: {
  searchParams: Promise<{ i?: string }>;
}) {
  const theme = await getTheme();
  const isDay = theme === "day";
  const p = isDay ? DAY_P : MUCHA_COLORWAYS.ivory.dark;
  const { i } = await searchParams;
  const idx = Math.max(0, Math.min(TRACKS.length - 1, Number(i ?? "1")));
  const tr = TRACKS[idx];
  const num = String(idx + 1).padStart(2, "0");
  const total = String(TRACKS.length).padStart(2, "0");
  const neteaseSongId = tr?.neteaseUrl
    ? extractNeteaseId(tr.neteaseUrl)
    : null;

  return (
    <main
      className="flex-1 w-full relative overflow-hidden"
      style={{
        background: p.bg,
        color: p.ink,
        fontFamily: FONT_STACK,
        minHeight: "100svh",
      }}
    >
      {/* nav 删 · owner 260517 0208 — 之前有 2 个 nav (RoomBackBtn + 中央 inline
          Glass), swipe 返回 主, 底端 浅 toggle 替 */}
      {/* vines bg */}
      <div
        aria-hidden
        style={{ position: "absolute", top: "76%", left: 0, right: 0, color: p.hair, opacity: 0.6 }}
      >
        <MuchaVine color={p.hair} accent={p.accent} />
      </div>

      <div className="relative max-w-md mx-auto w-full pt-12 pb-16 px-4">

        {/* lily/iris record */}
        <div className="flex justify-center mt-4 relative">
          <div style={{ position: "relative", width: 260, height: 260 }}>
            <style>{`@keyframes kt-spin-record{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
            <div
              style={{
                position: "absolute",
                inset: 0,
                color: p.hair,
                animation: "kt-spin-record 30s linear infinite",
              }}
            >
              <MuchaLilyIris color={p.hair} accent={p.accent} size={260} />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LongDistanceAvatars size={86} gap={36} accent={p.accent} playing />
            </div>
          </div>
        </div>

        {/* track info */}
        <div className="pt-5">
          <Glass
            radius={22}
            tint={p.paper}
            border="rgba(255,255,255,0.95)"
            style={{ padding: "16px 18px", textAlign: "center" }}
          >
            <div style={{ fontSize: 9, letterSpacing: 4, color: p.accent }}>
              NOW PLAYING · {num} / {total}
            </div>
            <div
              style={{
                fontSize: 22,
                marginTop: 6,
                color: p.ink,
                letterSpacing: 2,
                fontFamily: 'var(--font-serif)',
                fontStyle: "italic",
                fontWeight: 400,
              }}
            >
              {tr.title}
            </div>
            <div style={{ fontSize: 11, color: p.mute, marginTop: 2, fontStyle: "italic" }}>
              {tr.artist}
              {tr.length ? ` · ${tr.length}` : ""}
            </div>
            <TrackTagEditor
              trackTitle={tr.title}
              fallback={tr.tag || "未分类"}
              accent={p.accent}
              mute={p.mute}
            />
            {neteaseSongId ? (
              <div
                style={{
                  marginTop: 14,
                  padding: 8,
                  border: `0.6px solid ${p.accent}`,
                  background: `linear-gradient(180deg, ${p.paper} 0%, ${isDay ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)"} 100%)`,
                  borderRadius: 6,
                  boxShadow: isDay
                    ? `0 0 0 1px rgba(255,255,255,0.6) inset, 0 4px 12px rgba(106,74,72,0.12)`
                    : `0 0 0 1px rgba(212,175,108,0.18) inset, 0 4px 14px rgba(0,0,0,0.55)`,
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    letterSpacing: 4,
                    color: p.mute,
                    fontStyle: "italic",
                    textAlign: "left",
                    paddingLeft: 4,
                    paddingBottom: 4,
                    textTransform: "uppercase",
                  }}
                >
                  ♪ netease
                </div>
                <iframe
                  title={`netease player · ${tr.title}`}
                  src={`https://music.163.com/outchain/player?type=2&id=${neteaseSongId}&auto=0&height=66`}
                  width="100%"
                  height="86"
                  frameBorder="no"
                  scrolling="no"
                  style={{
                    border: "none",
                    borderRadius: 3,
                    background: "#0c0c0c",
                    display: "block",
                  }}
                />
              </div>
            ) : tr.neteaseUrl ? (
              <a
                href={tr.neteaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  marginTop: 10,
                  padding: "6px 16px",
                  border: `0.6px solid ${p.accent}`,
                  fontSize: 10,
                  letterSpacing: 3,
                  color: p.accent,
                  textTransform: "uppercase",
                  fontStyle: "italic",
                  textDecoration: "none",
                }}
              >
                ▶ 播放
              </a>
            ) : null}
            {tr.note && (
              <div style={{ fontSize: 10, color: p.accent, marginTop: 8, letterSpacing: 2 }}>
                {tr.note}
              </div>
            )}
            {tr.quote && (
              <div
                style={{
                  fontSize: 10,
                  fontStyle: "italic",
                  color: p.mute,
                  marginTop: 6,
                  borderTop: `0.4px solid ${p.hair}`,
                  paddingTop: 8,
                }}
              >
                「{tr.quote}」
              </div>
            )}
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 8, color: p.mute }}>1:12</div>
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: p.hair,
                  borderRadius: 2,
                  position: "relative",
                }}
              >
                <div style={{ width: "38%", height: "100%", background: p.accent, borderRadius: 2 }} />
                <div
                  style={{
                    position: "absolute",
                    left: "38%",
                    top: -3,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: p.accent,
                    transform: "translateX(-4px)",
                  }}
                />
              </div>
              <div style={{ fontSize: 8, color: p.mute }}>{tr.length}</div>
            </div>
            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "center",
                gap: 24,
                alignItems: "center",
                color: p.ink,
              }}
            >
              <span style={{ fontSize: 16 }}>⇆</span>
              <Link
                href={`/playlist/now-playing?i=${Math.max(0, idx - 1)}`}
                style={{ fontSize: 20, color: p.ink }}
              >
                ‹‹
              </Link>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: p.ink,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                }}
              >
                ❚❚
              </div>
              <Link
                href={`/playlist/now-playing?i=${Math.min(TRACKS.length - 1, idx + 1)}`}
                style={{ fontSize: 20, color: p.ink }}
              >
                ››
              </Link>
              <span style={{ fontSize: 14 }}>⇄</span>
            </div>
          </Glass>
        </div>

        {/* shuffle/queue pills */}
        <div className="flex gap-[10px] mt-6">
          <Glass
            radius={18}
            tint="rgba(255,255,255,0.6)"
            border={p.accent}
            style={{ flex: 1, padding: "9px 0", textAlign: "center" }}
          >
            <div style={{ fontSize: 10, letterSpacing: 3, color: p.accent }}>✦ SHUFFLE</div>
          </Glass>
          <Glass
            radius={18}
            tint="rgba(255,255,255,0.4)"
            border="rgba(255,255,255,0.9)"
            style={{ flex: 1, padding: "9px 0", textAlign: "center" }}
          >
            <div style={{ fontSize: 10, letterSpacing: 3, color: p.ink }}>＋ QUEUE</div>
          </Glass>
        </div>
      </div>
    </main>
  );
}
