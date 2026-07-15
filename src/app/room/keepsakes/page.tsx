import { KimiPage, KimiTopNav } from "@/components/mucha/KimiPage";
import { KeepsakesGrid } from "@/components/keepsakes/KeepsakesGrid";
import { KeepsakesSyncButton } from "@/components/keepsakes/KeepsakesSyncButton";
import { KeepsakesDebug } from "@/components/keepsakes/KeepsakesDebug";
import { palGold } from "@/lib/kimi-palettes";
import { getTheme } from "@/lib/day-theme";

// V2 /room/keepsakes · canon TasteGrid → KeepsakesGrid rename · IDB-driven
// (keepsakeStore + blobStore + llm-client). 6 default seed colored gradient
// blocks render even when IDB empty · 用户 tap upload 后 真 photo + {{char}} note.

export default async function KeepsakesPage() {
  const theme = await getTheme();
  const isDay = theme === "day";
  const P = palGold(theme);
  return (
    <KimiPage P={P} vines={false}>
      <KimiTopNav title="KEEPSAKES" sub="postcards" P={P} />

      <div style={{ textAlign: "center", padding: "6px 24px 0" }}>
        <div
          style={{
            fontSize: 26,
            color: P.ink,
            letterSpacing: 2,
            marginTop: 2,
            fontFamily:
              'var(--font-serif)',
          }}
        >
          keepsakes
        </div>
        <div
          style={{
            fontSize: 9,
            letterSpacing: 4,
            color: P.mute,
            fontStyle: "italic",
            marginTop: 2,
            fontFamily: 'var(--font-serif)',
            textTransform: "uppercase",
          }}
        >
          &amp; postcards
        </div>
      </div>

      <KeepsakesGrid P={P} isDay={isDay} />

      <div
        style={{
          padding: "20px 0 8px",
          textAlign: "center",
          fontSize: 9,
          color: P.mute,
          letterSpacing: 3,
          fontStyle: "italic",
        }}
      >
        tap 色块 → 从相册选
      </div>

      <KeepsakesSyncButton P={P} />
      <KeepsakesDebug P={P} />

      <div style={{ height: 40 }} />
    </KimiPage>
  );
}
