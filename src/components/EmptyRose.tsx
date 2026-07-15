// Empty state — small rose SVG + italic Cormorant 文案. Used wherever a list
// has no items (chat history, tastes with no photos, playlist empty etc.).

type Props = {
  message: string;
  /** "ivory" (light page) | "gothic" (dark page) */
  palette?: "ivory" | "gothic";
  size?: number;
};

export function EmptyRose({ message, palette = "ivory", size = 28 }: Props) {
  const rose = palette === "gothic" ? "#b35268" : "#b35268";
  const accent = palette === "gothic" ? "#c4a060" : "#b8814a";
  const ink = palette === "gothic" ? "#9a8a72" : "#9a7a4a";
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 20px",
        opacity: 0.8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        {/* outer petals */}
        <path
          d="M12 4 Q15 6 15 10 Q15 13 12 13 Q9 13 9 10 Q9 6 12 4 Z"
          fill={rose}
          opacity="0.55"
        />
        <path
          d="M20 12 Q17 15 13 15 Q10 15 10 12 Q10 9 13 9 Q17 9 20 12 Z"
          fill={rose}
          opacity="0.55"
        />
        <path
          d="M12 20 Q9 17 9 13 Q9 10 12 10 Q15 10 15 13 Q15 17 12 20 Z"
          fill={rose}
          opacity="0.55"
        />
        <path
          d="M4 12 Q7 9 11 9 Q14 9 14 12 Q14 15 11 15 Q7 15 4 12 Z"
          fill={rose}
          opacity="0.55"
        />
        {/* core */}
        <circle cx="12" cy="12" r="3" fill={rose} />
        <circle cx="12" cy="12" r="1.4" fill={accent} />
      </svg>
      <div
        style={{
          fontSize: 11,
          color: ink,
          fontStyle: "italic",
          letterSpacing: 2,
          fontFamily: 'var(--font-serif)',
        }}
      >
        {message}
      </div>
    </div>
  );
}
