import { setKimiTheme } from "@/lib/theme-actions";
import type { KimiTheme } from "@/lib/day-theme-client";

/**
 * Subtle "·昼" / "·夜" toggle — Server Action backed.
 * Renders as a form so the click POSTs to the action which sets the
 * kimi-theme cookie and revalidates the layout, refreshing all routes.
 */
export function ThemeToggleLink({
  current,
  color,
}: {
  current: KimiTheme;
  color: string;
}) {
  const next: KimiTheme = current === "day" ? "night" : "day";
  const setNext = async () => {
    "use server";
    await setKimiTheme(next);
  };
  return (
    <form
      action={setNext}
      style={{ display: "inline-flex", margin: 0, padding: 0 }}
    >
      <button
        type="submit"
        aria-label={
          current === "day" ? "switch to night mode" : "switch to day mode"
        }
        title={current === "day" ? "夜" : "昼"}
        style={{
          background: "none",
          border: "none",
          padding: "8px 14px",
          margin: 0,
          fontSize: 14,
          letterSpacing: 3,
          color,
          opacity: 0.65,
          fontStyle: "italic",
          fontFamily: 'var(--font-serif)',
          cursor: "pointer",
        }}
      >
        {current === "day" ? "夜" : "昼"}
      </button>
    </form>
  );
}
