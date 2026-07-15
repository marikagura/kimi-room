import Link from "next/link";
import { KimiPage, KimiTopNav } from "@/components/mucha/KimiPage";
import { palGold } from "@/lib/kimi-palettes";
import { getTheme } from "@/lib/day-theme";
import { MEMOS } from "@/lib/memo-data";

export default async function MemoPage() {
  const P = palGold(await getTheme());
  return (
    <KimiPage P={P} vines={false}>
      <KimiTopNav title="MEMO" sub="notes" P={P} backHref="/room/study" />

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
          反应留痕 — 不是 memory 的副本.
        </p>

        <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
          {MEMOS.map((m) => (
            <li key={m.slug} style={{ marginBottom: 10 }}>
              <Link
                href={`/room/study/memo/${m.slug}`}
                className="block"
                style={{
                  padding: "14px 16px",
                  background: P.softAccent,
                  borderLeft: `2px solid ${P.accent}`,
                  color: P.ink,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: 3,
                    color: P.accent,
                    fontStyle: "italic",
                  }}
                >
                  {m.date}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontFamily: 'var(--font-serif)',
                    color: P.ink,
                    marginTop: 4,
                  }}
                >
                  {m.title}
                </div>
                {m.subtitle && (
                  <div
                    style={{
                      fontSize: 10,
                      color: P.mute,
                      fontStyle: "italic",
                      marginTop: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    {m.subtitle}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 11,
                    color: P.ink,
                    lineHeight: 1.55,
                    marginTop: 6,
                  }}
                >
                  {m.topic}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </KimiPage>
  );
}
