import Link from "next/link";
import { KimiPage, KimiTopNav } from "@/components/mucha/KimiPage";
import { palGold, type KimiPalette } from "@/lib/kimi-palettes";
import { getTheme } from "@/lib/day-theme";
import { BookShelf } from "@/components/study/BookShelf";
import { CategoryList } from "@/components/study/CategoryList";

export default async function StudyPage() {
  const P = palGold(await getTheme());

  return (
    <KimiPage P={P} vines={false}>
      <style>{`.kimi-study-card{transition:border-color .25s} .kimi-study-card:hover{border-color:var(--card-hover)!important}`}</style>
      <KimiTopNav title="STUDY" sub="reading" P={P} />

      <div style={{ textAlign: "center", padding: "6px 24px 0" }}>
        <div
          style={{
            fontSize: 24,
            color: P.ink,
            letterSpacing: 4,
            fontFamily: 'var(--font-serif)',
          }}
        >
          书桌
        </div>
        <div style={{ fontSize: 10, color: P.mute, fontStyle: "italic", marginTop: 2 }}>
          desk
        </div>
      </div>

      <Section label="READING" P={P}>
        <SubLabel P={P}>书架 · BOOKSHELF</SubLabel>
        <BookShelf P={P} />
      </Section>

      <Section label="PAPERS" P={P}>
        <RowLink
          href="/room/study/papers"
          name="论文"
          sub="papers · 自动追踪、月度轮换"
          P={P}
        />
      </Section>

      <CategoryList P={P} />
    </KimiPage>
  );
}

function Section({
  label,
  P,
  children,
}: {
  label: string;
  P: KimiPalette;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: "22px 22px 0" }}>
      <div style={{ fontSize: 9, letterSpacing: 3, color: P.accent, marginBottom: 10 }}>
        · {label}
      </div>
      {children}
    </div>
  );
}

function SubLabel({ P, children }: { P: KimiPalette; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, letterSpacing: 2, color: P.mute, fontStyle: "italic" }}>
      {children}
    </div>
  );
}

// 卡面: 四边 hairline + 顶心 4px accent 点 + 深渐变底 + hover 边亮 + SVG 箭.
// 替代旧「左金条」. 昼夜走 palette token.
function RowLink({
  href,
  name,
  sub,
  P,
}: {
  href: string;
  name: string;
  sub: string;
  P: KimiPalette;
}) {
  return (
    <Link
      href={href}
      className="kimi-study-card block"
      style={
        {
          display: "block",
          position: "relative",
          boxSizing: "border-box",
          border: `1px solid ${P.hair}`,
          background: `linear-gradient(160deg, ${P.card}, ${P.bg})`,
          padding: "13px 16px 12px",
          color: P.ink,
          textDecoration: "none",
          ["--card-hover" as string]: P.accent,
        } as React.CSSProperties
      }
    >
      {/* 顶心 accent 点 */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: -2,
          left: "50%",
          transform: "translateX(-50%)",
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: P.accent,
          opacity: 0.8,
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 500,
            fontFamily: 'var(--font-serif)',
            color: P.ink,
            letterSpacing: 1,
          }}
        >
          {name}
        </div>
        <svg width="24" height="8" viewBox="0 0 26 8" fill="none" aria-hidden>
          <path d="M0 4 H24 M20 1 L24 4 L20 7" stroke={P.accent} strokeWidth="1" />
        </svg>
      </div>
      <div style={{ fontSize: 10, fontStyle: "italic", color: P.mute, marginTop: 3, letterSpacing: 1 }}>
        {sub}
      </div>
    </Link>
  );
}
