// Iron-tracery arched window — the signature frame of the Atlas room.
// An arched opening holds an image (or a placeholder); a veil dims it when the
// window is "closed" and lifts to 0 when "opened". Gold tracery + a dark surround
// mask sit on top. Day/night colors come in via the `gold` / `surround` props.
// Everything lives in one viewBox 168×252 SVG (preserveAspectRatio none): opening,
// image and veil all share the same clipPath, so it scales to any width×height
// without the px drift you'd get from a div clip-path.
const OP = "M30 96 A54 54 0 0 1 138 96 V204 H30 Z"; // arched opening
const SURROUND = `M0 0H168V252H0Z ${OP}`; // dark mask, evenodd hole = opening

const FAN = Array.from({ length: 7 }, (_, k) => {
  const a = Math.PI * ((k + 1) / 8);
  return `M84 96 L ${(84 - 54 * Math.cos(a)).toFixed(1)} ${(96 - 54 * Math.sin(a)).toFixed(1)}`;
}).join(" ");

export function ArchWindow({
  gold = "#b8a070",
  surround = "#0a0806",
  image,
  placeholderLabel,
  veil = 0,
  width = 168,
  height = 252,
  showSurround = true,
  className,
  style,
}: {
  gold?: string;
  surround?: string;
  image?: string | null;
  placeholderLabel?: string | null;
  veil?: number; // 0 = open (no dim), 0.85 = closed (dark dim)
  width?: number;
  height?: number;
  showSurround?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const uid = `${width}x${height}-${Math.round((width * 31 + height) % 9973)}`;
  const clipId = `arch-op-${uid}`;
  const gradId = `arch-ph-${uid}`;
  return (
    <div style={{ position: "relative", width, height, ...style }} className={className}>
      <svg width={width} height={height} viewBox="0 0 168 252" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id={clipId}>
            <path d={OP} />
          </clipPath>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={gold} stopOpacity="0.12" />
            <stop offset="0.55" stopColor={surround} stopOpacity="0.3" />
            <stop offset="1" stopColor={surround} stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* scene/image + veil — all clipped to the arch opening */}
        <g clipPath={`url(#${clipId})`}>
          {image ? (
            <image href={image} x="0" y="0" width="168" height="252" preserveAspectRatio="xMidYMid slice" />
          ) : (
            <>
              <rect x="0" y="0" width="168" height="252" fill={`url(#${gradId})`} />
              {placeholderLabel && (
                <text x="84" y="120" textAnchor="middle" fontFamily="'Cormorant Garamond',serif" fontStyle="italic" fontSize="8" fill={gold} opacity="0.55" letterSpacing="2">
                  {placeholderLabel}
                </text>
              )}
            </>
          )}
          {/* veil — dark dim when closed (opacity driven by `veil`, smooth transition) */}
          <rect x="0" y="0" width="168" height="252" fill={surround} opacity={veil} style={{ transition: "opacity 0.8s ease" }} />
        </g>

        {/* surround mask (dark, hole = opening) */}
        {showSurround && <path d={SURROUND} fillRule="evenodd" fill={surround} />}

        {/* iron tracery (gold) */}
        <g style={{ color: gold }}>
          <path d={OP} fill="none" stroke="currentColor" strokeWidth="0.9" />
          <path d="M22 96 A62 62 0 0 1 146 96 V212 H22 Z" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <line x1="84" y1="44" x2="84" y2="204" stroke="currentColor" strokeWidth="0.6" />
          <path d={FAN} fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.65" />
          <g stroke="currentColor" strokeWidth="0.7" fill="none">
            <line x1="64" y1="104" x2="64" y2="204" />
            <line x1="104" y1="104" x2="104" y2="204" />
            <line x1="30" y1="150" x2="138" y2="150" />
          </g>
          <g fill="currentColor" opacity="0.95">
            {[124, 152, 180].map((y) => (
              <g key={y}>
                <circle cx="64" cy={y} r="1.5" />
                <circle cx="104" cy={y} r="1.5" />
              </g>
            ))}
          </g>
          {/* finial cluster */}
          <g fill="currentColor" opacity="0.9">
            <circle cx="84" cy="40" r="2.6" />
            <circle cx="76" cy="46" r="1.6" />
            <circle cx="92" cy="46" r="1.6" />
            <circle cx="69" cy="52" r="1.1" />
            <circle cx="99" cy="52" r="1.1" />
          </g>
          <g stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.8">
            <path d="M70 56 Q60 74 56 96" />
            <path d="M98 56 Q108 74 112 96" />
            <path d="M84 44 V40" />
          </g>
          {/* side leaf bosses */}
          <g fill="currentColor" opacity="0.55">
            <ellipse cx="36" cy="104" rx="2" ry="5.5" transform="rotate(-32 36 104)" />
            <ellipse cx="132" cy="104" rx="2" ry="5.5" transform="rotate(32 132 104)" />
          </g>
          {/* sill */}
          <path d="M16 204 H152 M20 204 V224 H148 V204" fill="none" stroke="currentColor" strokeWidth="0.9" />
          <g fill="currentColor" opacity="0.7">
            <circle cx="20" cy="204" r="1.2" />
            <circle cx="148" cy="204" r="1.2" />
          </g>
        </g>
      </svg>
    </div>
  );
}
