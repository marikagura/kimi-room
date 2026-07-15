import Link from "next/link";

// 小回按钮 — 固定 top-left, 44x44 圆.
// variant:
//   "glass"  默认: 透明 backdrop-blur, 跟着背景变化 (Taste 那个样)
//   "cutout" 扣出去: solid 不透, inset shadow 像在纸上压出一个圆窝
// inverse: 适配深色背景的页 (cutout 也支持)
// href: default /room, callers (playlist 从 disc 入口) 可指向 /room/disc
// safe-area-inset 避开 iPhone 动态岛.
export function RoomBackBtn({
  inverse = false,
  variant = "glass",
  href = "/room",
}: {
  inverse?: boolean;
  variant?: "glass" | "cutout";
  href?: string;
}) {
  let bg: string;
  let border: string;
  let ink: string;
  let blur: string;
  let outerShadow: string;
  let innerShadow: string;

  if (variant === "cutout") {
    // "扣出去" — 不透, inset shadow 给出向下凹的感觉.
    if (inverse) {
      bg = "rgba(0,0,0,0.42)";
      border = "rgba(212,175,108,0.18)";
      ink = "#d4af6c";
      innerShadow =
        "inset 0 2px 5px rgba(0,0,0,0.7), inset 0 -1px 0 rgba(212,175,108,0.18)";
    } else {
      bg = "rgba(58,42,28,0.08)";
      border = "rgba(58,42,28,0.18)";
      ink = "#3a2a1c";
      innerShadow =
        "inset 0 2px 5px rgba(58,42,28,0.22), inset 0 -1px 0 rgba(255,255,255,0.7)";
    }
    blur = "none";
    outerShadow = "none";
  } else {
    // "glass" — backdrop-blur 透明 pill (跟随背景).
    bg = inverse ? "rgba(20,12,14,0.35)" : "rgba(255,255,255,0.5)";
    border = inverse ? "rgba(212,175,108,0.5)" : "rgba(255,255,255,0.9)";
    ink = inverse ? "#ece2cc" : "#3a2a1c";
    blur = "blur(12px) saturate(150%)";
    outerShadow = "0 2px 8px rgba(0,0,0,0.08)";
    innerShadow = "none";
  }

  return (
    <Link
      href={href}
      aria-label="back"
      title={`back to ${href}`}
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 10px)",
        left: "calc(env(safe-area-inset-left, 0px) + 10px)",
        zIndex: 50,
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: bg,
        border: `0.6px solid ${border}`,
        color: ink,
        textDecoration: "none",
        backdropFilter: blur,
        WebkitBackdropFilter: blur,
        boxShadow:
          innerShadow !== "none"
            ? innerShadow
            : outerShadow !== "none"
              ? outerShadow
              : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: 'var(--font-serif)',
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>‹</span>
    </Link>
  );
}
