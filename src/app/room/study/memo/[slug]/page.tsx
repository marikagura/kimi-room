import { notFound } from "next/navigation";
import { KimiPage, KimiTopNav } from "@/components/mucha/KimiPage";
import { palGold } from "@/lib/kimi-palettes";
import { getTheme } from "@/lib/day-theme";
import { MEMOS, findMemo } from "@/lib/memo-data";

export function generateStaticParams() {
  return MEMOS.map((m) => ({ slug: m.slug }));
}

export default async function MemoDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const P = palGold(await getTheme());
  const { slug } = await params;
  const memo = findMemo(slug);
  if (!memo) notFound();

  return (
    <KimiPage P={P} vines={false}>
      <KimiTopNav title="MEMO" sub={memo.date} P={P} backHref="/room/study/memo" />

      <div style={{ padding: "12px 24px 0" }}>
        <div
          style={{
            fontSize: 9,
            letterSpacing: 3,
            color: P.accent,
            fontStyle: "italic",
          }}
        >
          {memo.date}
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
          {memo.title}
        </h1>
        {memo.subtitle && (
          <div
            style={{
              fontSize: 11,
              color: P.mute,
              fontStyle: "italic",
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            {memo.subtitle}
          </div>
        )}
      </div>

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
            marginBottom: 22,
          }}
        >
          「{memo.topic}」
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
            paddingBottom: 60,
          }}
        >
          {memo.body}
        </pre>
      </div>
    </KimiPage>
  );
}
