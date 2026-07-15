import Link from "next/link";
import { KimiPage, KimiTopNav } from "@/components/mucha/KimiPage";
import { palGold } from "@/lib/kimi-palettes";
import { getTheme } from "@/lib/day-theme";
import { CONCEPTS } from "@/lib/philosophy-data";

export default async function ConceptsPage() {
  const P = palGold(await getTheme());
  return (
    <KimiPage P={P} vines={false}>
      <KimiTopNav title="CONCEPTS" sub="tools" P={P} backHref="/room/study" />

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
          思想锚 — 不是引用, 是工具.
        </p>

        <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
          {CONCEPTS.map((c) => (
            <li key={c.slug} style={{ marginBottom: 10 }}>
              <Link
                href={`/room/study/concepts/${c.slug}`}
                className="block"
                style={{
                  padding: "14px 16px",
                  background: P.softAccent,
                  borderLeft: `2px solid ${P.accent}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  color: P.ink,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 15,
                        fontFamily: 'var(--font-serif)',
                        color: P.ink,
                        fontWeight: 500,
                      }}
                    >
                      {c.cn}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontStyle: "italic",
                        color: P.accent,
                        letterSpacing: 1,
                      }}
                    >
                      {c.en}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: P.mute,
                      fontStyle: "italic",
                      marginTop: 3,
                      letterSpacing: 1,
                    }}
                  >
                    {c.thinker}
                    {c.thinkerEn ? ` · ${c.thinkerEn}` : ""}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: P.ink,
                      lineHeight: 1.55,
                      marginTop: 6,
                    }}
                  >
                    {c.blurb}
                  </div>
                </div>
                <span style={{ fontSize: 16, color: P.accent, fontStyle: "italic" }}>→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </KimiPage>
  );
}
