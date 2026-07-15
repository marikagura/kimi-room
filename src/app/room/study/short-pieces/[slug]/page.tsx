import { notFound } from "next/navigation";
import { KimiPage, KimiTopNav } from "@/components/mucha/KimiPage";
import { palGold } from "@/lib/kimi-palettes";
import { getTheme } from "@/lib/day-theme";
import { SHORT_PIECES, findShortPiece } from "@/lib/short-pieces-data";

export function generateStaticParams() {
  return SHORT_PIECES.map((p) => ({ slug: p.slug }));
}

const KIND_LABEL: Record<string, string> = {
  "xhs-short": "短帖 · XHS",
  "xhs-long": "长文 · XHS",
  snippet: "摘抄 · SNIPPET",
};

export default async function ShortPiecePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const P = palGold(await getTheme());
  const { slug } = await params;
  const piece = findShortPiece(slug);
  if (!piece) notFound();

  return (
    <KimiPage P={P} vines={false}>
      <KimiTopNav
        title="PIECE"
        sub={piece.title.slice(0, 12)}
        P={P}
        backHref="/room/study/short-pieces"
      />

      <div style={{ padding: "12px 24px 0" }}>
        <div
          style={{
            fontSize: 9,
            letterSpacing: 3,
            color: P.accent,
            fontStyle: "italic",
          }}
        >
          {KIND_LABEL[piece.kind] ?? piece.kind} · {piece.date}
        </div>
        <h1
          style={{
            marginTop: 6,
            fontSize: 22,
            color: P.ink,
            lineHeight: 1.3,
            fontFamily: 'var(--font-serif)',
            fontWeight: 500,
          }}
        >
          {piece.title}
        </h1>
        {piece.subtitle && (
          <div
            style={{
              fontSize: 11,
              color: P.mute,
              fontStyle: "italic",
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            {piece.subtitle}
          </div>
        )}
      </div>

      {piece.excerpt && (
        <div style={{ padding: "20px 24px 0" }}>
          <div
            style={{
              padding: "14px 18px",
              background: P.softAccent,
              borderTop: `0.6px solid ${P.accent}`,
              borderBottom: `0.6px solid ${P.accent}`,
              fontSize: 13,
              color: P.ink,
              fontFamily: 'var(--font-serif)',
              fontStyle: "italic",
              lineHeight: 1.7,
              textAlign: "center",
            }}
          >
            {piece.excerpt}
          </div>
        </div>
      )}

      {piece.fullText && (
        <div style={{ padding: "22px 24px 0" }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: P.accent, marginBottom: 10 }}>
            · 全文 / FULL
          </div>
          <pre
            style={{
              fontSize: 12,
              color: P.ink,
              fontFamily: 'var(--font-serif)',
              lineHeight: 1.85,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
            }}
          >
            {piece.fullText}
          </pre>
        </div>
      )}

      {piece.note && (
        <div
          style={{
            margin: "24px 24px 60px",
            padding: "12px 14px",
            background: P.softAccent,
            borderLeft: `2px solid ${P.accent}`,
          }}
        >
          <div style={{ fontSize: 9, letterSpacing: 3, color: P.accent, marginBottom: 4 }}>
            · NOTE ·
          </div>
          <div style={{ fontSize: 11, color: P.ink, fontStyle: "italic", lineHeight: 1.55 }}>
            {piece.note}
          </div>
        </div>
      )}
    </KimiPage>
  );
}
