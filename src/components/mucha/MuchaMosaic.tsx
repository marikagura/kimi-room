// Byzantine mosaic corner (Mucha 海报角饰). 对角渐隐 mask 让格阵向页面内
// 「溶」掉 — 没有 mask 时 6×6 等距格在手机上像一块透明 PNG 棋盘底。
// 两个实例共用同名 defs id (内容相同, 引用第一个定义即可); 右上角实例由
// 容器 CSS scaleX(-1) 镜像, mask 跟着整体翻, 溶解方向自动朝内。
export function MuchaMosaic({
  color,
  accent,
  size = 60,
}: {
  color: string;
  accent: string;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} style={{ color }}>
      <defs>
        <linearGradient id="kimi-mosaic-fade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="85%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="kimi-mosaic-mask">
          <rect x="0" y="0" width="60" height="60" fill="url(#kimi-mosaic-fade)" />
        </mask>
      </defs>
      <g mask="url(#kimi-mosaic-mask)">
        {Array.from({ length: 6 }).flatMap((_, r) =>
          Array.from({ length: 6 }).map((_, c) => {
            const d = (r + c) % 3;
            return (
              <rect
                key={`${r}-${c}`}
                x={c * 10}
                y={r * 10}
                width="9"
                height="9"
                fill={d === 0 ? "currentColor" : d === 1 ? accent : "none"}
                stroke="currentColor"
                strokeWidth="0.3"
                opacity={d === 0 ? 0.15 : d === 1 ? 0.3 : 0.6}
              />
            );
          }),
        )}
      </g>
    </svg>
  );
}
