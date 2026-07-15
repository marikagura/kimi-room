import Link from "next/link";
import { LongDistanceAvatars } from "@/components/mucha/LongDistanceAvatars";
import { MuchaArch } from "@/components/mucha/MuchaArch";
import { AddSongButton } from "@/components/mucha/AddSongButton";
import { PlaylistTabsAndList } from "@/components/mucha/PlaylistTabsAndList";
import { MUCHA_COLORWAYS } from "@/lib/mucha-tokens";
import { TRACKS } from "@/lib/tracks-data";
import { getTheme, ROSE_GOTHIC_DAY } from "@/lib/day-theme";

// 字体一致 const · 跟 memory-review 同 stack (owner 0208 catch · 中文 Songti SC
// primary 跟 Cormorant italic 古朴 align, Noto Serif SC/JP 自托 fallback)
const FONT_STACK =
  'var(--font-serif)';

const NIGHT_P = MUCHA_COLORWAYS.ivory.dark;
const DAY_P = {
  bg: ROSE_GOTHIC_DAY.bg,
  paper: ROSE_GOTHIC_DAY.paper,
  ink: ROSE_GOTHIC_DAY.ink,
  accent: ROSE_GOTHIC_DAY.rose,
  accent2: ROSE_GOTHIC_DAY.roseDeep,
  mute: ROSE_GOTHIC_DAY.inkMute,
  hair: ROSE_GOTHIC_DAY.hair,
} as const;

export default async function PlaylistEntryPage() {
  const theme = await getTheme();
  const p = theme === "day" ? DAY_P : NIGHT_P;
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
      {/* owner 260517 0208 #3 redesign · 拱门 整页 vines + 歌 在 拱门 里
          adaptive MuchaArch 替 legacy hero-only 局部, full-fill wrapper
          stretch 跨 整 content height (NowPlayingCard + tabs + tracks +
          buttons + back toggle 都 在 拱门 里). owner 260517 0146: 删顶端
          RoomBackBtn, swipe 返回 主. */}
      {/* outer wrapper · arch + content 同 350 box 居中, content inside
          padding-x 26 (跟 /room landing 同 pattern) clear column borders.
          这样 字 / category / list 都 在 拱门 columns 内 (owner 0227 catch). */}
      <div
        className="relative mx-auto w-full pt-14 pb-28"
        style={{ maxWidth: 350 }}
      >
        {/* outer arch · adaptive mode 3-layer DOM frame fill 100% parent */}
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            top: -30,
            bottom: 0,
            left: 0,
            right: 0,
            color: p.hair,
            opacity: 0.8,
          }}
        >
          <MuchaArch color={p.hair} accent={p.accent} />
        </div>
        <div className="relative" style={{ zIndex: 1, padding: "0 26px" }}>
        {/* now-playing card: long-distance avatars + current track */}
        <NowPlayingCard p={p} />

        {/* tabs + tracks · owner 260517 0244 catch · category 现 functional:
            click tab → filter, + add modal, × delete (除 ALL),
            localStorage persist. PlaylistTabsAndList 是 client component. */}
        <PlaylistTabsAndList />

        {/* buttons */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 24,
          }}
        >
          <div
            style={{
              flex: 1,
              border: `0.6px solid ${p.accent}`,
              padding: "10px 0",
              textAlign: "center",
              fontSize: 10,
              letterSpacing: 4,
              color: p.accent,
            }}
          >
            ✦ SHUFFLE
          </div>
          <AddSongButton P={p} />
        </div>

        {/* 底端 浅 文字 toggle 返回 · swipe 返回 主, 这是 视觉 fallback */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 28,
          }}
        >
          <Link
            href="/room/disc"
            style={{
              fontSize: 10,
              color: p.mute,
              opacity: 0.55,
              letterSpacing: 3,
              fontStyle: "italic",
              fontFamily: FONT_STACK,
              textDecoration: "none",
              padding: "4px 10px",
            }}
          >
            ← back to disc
          </Link>
        </div>
        </div>{/* close relative z-1 content wrapper */}
      </div>
    </main>
  );
}

function NowPlayingCard({
  p,
}: {
  p: typeof MUCHA_COLORWAYS.ivory.dark | typeof DAY_P;
}) {
  // 当前 = "All A Dream" (owner pin 的). 找不到 fallback TRACKS[0].
  const current =
    TRACKS.find((t) => t.title === "All A Dream") ?? TRACKS[0];
  const hasNetease = !!current?.neteaseUrl;
  return (
    <div
      style={{
        position: "relative",
        padding: "20px 16px 16px",
        border: `0.6px solid ${p.hair}`,
        background: `linear-gradient(180deg, ${p.paper} 0%, transparent 140%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -6,
          left: 14,
          color: p.accent,
          fontSize: 14,
          background: p.bg,
          padding: "0 6px",
        }}
      >
        ♪
      </div>
      <div
        style={{
          fontSize: 9,
          letterSpacing: 4,
          color: p.accent,
          textAlign: "center",
          fontStyle: "italic",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        now playing · 一起听
      </div>

      {/* avatars */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <LongDistanceAvatars size={72} gap={28} accent={p.accent} playing />
      </div>

      {/* meta */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 17,
            color: p.ink,
            fontFamily: FONT_STACK,
            letterSpacing: 1,
          }}
        >
          {current?.title ?? "—"}
        </div>
        <div
          style={{
            fontSize: 10,
            color: p.mute,
            marginTop: 2,
            fontStyle: "italic",
          }}
        >
          {current?.artist ?? ""}
          {current?.tag ? (
            <>
              {" · "}
              <span style={{ color: p.accent }}>{current.tag}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* netease link · 改 in-site /now-playing (iframe 播) */}
      <div style={{ textAlign: "center", marginTop: 12 }}>
        {hasNetease ? (
          <Link
            href={`/playlist/now-playing?i=${TRACKS.indexOf(current!)}`}
            style={{
              display: "inline-block",
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
          </Link>
        ) : (
          <span
            style={{
              fontSize: 9,
              color: p.mute,
              fontStyle: "italic",
              letterSpacing: 1,
            }}
          >
            (链接没填)
          </span>
        )}
      </div>
    </div>
  );
}
