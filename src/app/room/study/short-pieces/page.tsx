import Link from "next/link";
import { KimiPage, KimiTopNav } from "@/components/mucha/KimiPage";
import { palGold, type KimiPalette } from "@/lib/kimi-palettes";
import { getTheme } from "@/lib/day-theme";
import { SHORT_PIECES } from "@/lib/short-pieces-data";

const KIND_LABEL: Record<string, string> = {
  "xhs-short": "短帖 · XHS",
  "xhs-long": "长文 · XHS",
  snippet: "摘抄 · SNIPPET",
};

export default async function ShortPiecesPage() {
  const P = palGold(await getTheme());
  // group by kind
  const longs = SHORT_PIECES.filter((p) => p.kind === "xhs-long");
  const shorts = SHORT_PIECES.filter((p) => p.kind === "xhs-short");

  return (
    <KimiPage P={P} vines={false}>
      <KimiTopNav title="SHORTS" sub="essays" P={P} backHref="/room/study" />

      <div style={{ padding: "12px 24px 0" }}>
        <p
          style={{
            fontSize: 11,
            color: P.mute,
            fontStyle: "italic",
            textAlign: "center",
            lineHeight: 1.65,
            margin: "8px 0 24px",
          }}
        >
          essays + 短文摘抄
        </p>

        {longs.length > 0 && <SectionTitle label="LONG · 长文" P={P} />}
        <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
          {longs.map((p) => (
            <PieceItem key={p.slug} piece={p} P={P} />
          ))}
        </ul>

        {shorts.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <SectionTitle label="SHORT · 短帖" P={P} />
          </div>
        )}
        <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
          {shorts.map((p) => (
            <PieceItem key={p.slug} piece={p} P={P} />
          ))}
        </ul>
      </div>

      <div style={{ height: 60 }} />
    </KimiPage>
  );
}

function SectionTitle({ label, P }: { label: string; P: KimiPalette }) {
  return (
    <div
      style={{
        fontSize: 9,
        letterSpacing: 4,
        color: P.accent,
        marginBottom: 10,
        fontStyle: "italic",
      }}
    >
      · {label}
    </div>
  );
}

function PieceItem({
  piece,
  P,
}: {
  piece: { slug: string; title: string; subtitle?: string; kind: string; date: string };
  P: KimiPalette;
}) {
  return (
    <li style={{ marginBottom: 8 }}>
      <Link
        href={`/room/study/short-pieces/${piece.slug}`}
        className="block"
        style={{
          padding: "12px 14px",
          background: P.softAccent,
          borderLeft: `2px solid ${P.accent}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          color: P.ink,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontFamily: 'var(--font-serif)',
              color: P.ink,
            }}
          >
            {piece.title}
          </div>
          {piece.subtitle && (
            <div
              style={{
                fontSize: 10,
                color: P.mute,
                fontStyle: "italic",
                marginTop: 3,
                lineHeight: 1.4,
              }}
            >
              {piece.subtitle}
            </div>
          )}
          <div
            style={{
              fontSize: 9,
              color: P.accent,
              fontStyle: "italic",
              marginTop: 4,
              letterSpacing: 1,
            }}
          >
            {piece.date}
          </div>
        </div>
        <span style={{ fontSize: 14, color: P.accent }}>→</span>
      </Link>
    </li>
  );
}
