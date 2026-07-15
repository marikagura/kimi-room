import { notFound } from "next/navigation";
import { KimiPage, KimiTopNav } from "@/components/mucha/KimiPage";
import { palGold, type KimiPalette } from "@/lib/kimi-palettes";
import { getTheme } from "@/lib/day-theme";
import { CONCEPTS, findConcept } from "@/lib/philosophy-data";

export function generateStaticParams() {
  return CONCEPTS.map((c) => ({ slug: c.slug }));
}

export default async function ConceptPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const P = palGold(await getTheme());
  const { slug } = await params;
  const c = findConcept(slug);
  if (!c) notFound();

  return (
    <KimiPage P={P} vines={false}>
      <KimiTopNav title="CONCEPT" sub={c.cn} P={P} backHref="/room/study/concepts" />

      <div style={{ padding: "12px 24px 0" }}>
        {/* hero */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 4,
              color: P.accent,
              fontStyle: "italic",
              textTransform: "uppercase",
            }}
          >
            {c.domain}
          </div>
          <h1
            style={{
              marginTop: 8,
              fontSize: 30,
              color: P.ink,
              letterSpacing: 4,
              fontFamily: 'var(--font-serif-cn)',
              fontWeight: 700,
            }}
          >
            {c.cn}
          </h1>
          <div
            style={{
              fontSize: 12,
              color: P.accent,
              fontStyle: "italic",
              marginTop: 4,
              letterSpacing: 2,
            }}
          >
            {c.en}
          </div>
          <div
            style={{
              fontSize: 10,
              color: P.mute,
              fontStyle: "italic",
              marginTop: 14,
              letterSpacing: 1,
            }}
          >
            {c.thinker}
            {c.thinkerEn ? ` · ${c.thinkerEn}` : ""}
            {c.yearActive ? ` · ${c.yearActive}` : ""}
          </div>
        </div>

        {/* blurb pull-quote */}
        <div
          style={{
            padding: "16px 18px",
            background: P.softAccent,
            borderTop: `0.6px solid ${P.accent}`,
            borderBottom: `0.6px solid ${P.accent}`,
            fontSize: 13,
            color: P.ink,
            fontFamily: 'var(--font-serif)',
            fontStyle: "italic",
            lineHeight: 1.7,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          「{c.blurb}」
        </div>

        {/* bio */}
        <Section label="思想者 · BIO" P={P}>
          {c.bio}
        </Section>

        {/* main idea */}
        <Section label="核心思想 · IDEA" P={P}>
          {c.ideaMain}
        </Section>

        {/* in kimi */}
        <Section label="在 kimi 里 · IN-USE" P={P}>
          {c.inKimi}
        </Section>
      </div>

      <div style={{ height: 60 }} />
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
  children: string;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 9, letterSpacing: 3, color: P.accent, marginBottom: 10 }}>
        · {label}
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
          padding: 0,
        }}
      >
        {children}
      </pre>
    </div>
  );
}
