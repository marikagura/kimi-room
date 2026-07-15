/** @deprecated 2026-05-16 dead-tag — 0 imports as of nav-sweep. 之后若仍未引用可删. */
export function CelestialMap({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 400"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* outer rings */}
      <circle cx="200" cy="200" r="195" stroke="currentColor" strokeWidth="0.6" opacity="0.35" />
      <circle cx="200" cy="200" r="178" stroke="currentColor" strokeWidth="0.4" opacity="0.25" />
      <circle cx="200" cy="200" r="140" stroke="currentColor" strokeWidth="0.3" opacity="0.2" strokeDasharray="2 4" />
      <circle cx="200" cy="200" r="95" stroke="currentColor" strokeWidth="0.3" opacity="0.2" strokeDasharray="1 3" />

      {/* hour/zodiac ticks on outer ring */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const x1 = 200 + Math.cos(a) * 178;
        const y1 = 200 + Math.sin(a) * 178;
        const x2 = 200 + Math.cos(a) * 195;
        const y2 = 200 + Math.sin(a) * 195;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={i % 6 === 0 ? "0.9" : "0.4"}
            opacity={i % 6 === 0 ? "0.6" : "0.3"}
          />
        );
      })}

      {/* crescent moon */}
      <g transform="translate(200 200)">
        <circle r="38" fill="currentColor" opacity="0.12" />
        <circle r="38" cx="14" cy="-4" fill="#0c0c0c" opacity="1" />
        <circle r="38" cx="16" cy="-6" fill="currentColor" opacity="0.08" />
      </g>

      {/* scattered stars */}
      {[
        [80, 70, 1.4],
        [320, 90, 1.1],
        [60, 260, 1.2],
        [350, 300, 1.6],
        [290, 50, 0.9],
        [120, 340, 1.0],
        [260, 360, 1.3],
        [340, 220, 0.8],
        [50, 180, 0.9],
        [160, 80, 0.7],
        [230, 70, 1.1],
        [80, 340, 0.8],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="currentColor" opacity="0.7" />
      ))}

      {/* constellation lines */}
      <polyline
        points="80,70 120,120 165,100 200,150 245,115"
        stroke="currentColor"
        strokeWidth="0.4"
        opacity="0.35"
        fill="none"
      />
      <polyline
        points="290,320 320,290 350,300 340,340"
        stroke="currentColor"
        strokeWidth="0.4"
        opacity="0.35"
        fill="none"
      />

      {/* cardinal marks */}
      <g fontSize="9" fontFamily="var(--font-serif)" fontStyle="italic" fill="currentColor" opacity="0.55">
        <text x="200" y="14" textAnchor="middle">N</text>
        <text x="200" y="392" textAnchor="middle">S</text>
        <text x="8" y="204" textAnchor="start">W</text>
        <text x="392" y="204" textAnchor="end">E</text>
      </g>
    </svg>
  );
}
