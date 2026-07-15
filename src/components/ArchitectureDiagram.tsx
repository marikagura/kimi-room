// V2 architecture diagram · props-driven · 0 maintainer canon system data.
//
// canon V1 (376 line) 硬 inline 5 层 SVG (Surfaces / Vercel Edge / VPS Gateway /
// Data / External) with maintainer-specific node names (xhs / openrouter / 等).
// V2 ship · 用户 fork 后 fill `nodes` + `edges` props 自渲. 默认 empty 显示 hint.

type Node = {
  id: string;
  label: string;
  sub?: string;
  layer: number;       // y-band
  col: number;         // x position 0-3
  fill?: string;
  stroke?: string;
};

type Edge = {
  from: string;        // node id
  to: string;          // node id
  color?: string;
  dashed?: boolean;
  label?: string;
};

const LAYER_LABELS = ["surface", "edge", "service", "data", "external"];
const LAYER_Y = [50, 130, 210, 290, 370];
const COL_X = [60, 270, 480, 690];
const BOX_W = 180;
const BOX_H = 56;
const SVG_W = 920;
const SVG_H = 460;

export function ArchitectureDiagram({
  nodes = [],
  edges = [],
  layerLabels = LAYER_LABELS,
}: {
  nodes?: Node[];
  edges?: Edge[];
  layerLabels?: string[];
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  if (nodes.length === 0) {
    return (
      <div
        style={{
          minHeight: 360,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
          fontFamily: 'var(--font-serif)',
          color: "rgba(232,220,180,0.5)",
          fontStyle: "italic",
          textAlign: "center",
          padding: 48,
        }}
      >
        <div style={{ fontSize: 16 }}>no architecture configured</div>
        <div style={{ fontSize: 11, opacity: 0.7, maxWidth: 480, lineHeight: 1.7 }}>
          ArchitectureDiagram 是 props-driven · pass `nodes` + `edges` 自渲 own
          system map. canon V1 是 5 layer (surface / edge / service / data /
          external) Mucha ivory configuration · fork 后 自 define.
        </div>
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ width: "100%", height: "auto", background: "#fbf6ea" }}
    >
      {layerLabels.map((label, i) => (
        <text
          key={label}
          x={20}
          y={LAYER_Y[i] + BOX_H / 2 + 4}
          fontFamily="var(--font-serif)"
          fontSize={10}
          fontStyle="italic"
          letterSpacing="3"
          fill="#8a7a4a"
        >
          {label.toUpperCase()}
        </text>
      ))}
      {edges.map((e, i) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        const x1 = COL_X[a.col] + BOX_W / 2;
        const y1 = LAYER_Y[a.layer] + BOX_H;
        const x2 = COL_X[b.col] + BOX_W / 2;
        const y2 = LAYER_Y[b.layer];
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={e.color ?? "#8a7a4a"}
            strokeWidth={1.2}
            strokeDasharray={e.dashed ? "4 3" : undefined}
          />
        );
      })}
      {nodes.map((n) => (
        <g key={n.id}>
          <rect
            x={COL_X[n.col]}
            y={LAYER_Y[n.layer]}
            width={BOX_W}
            height={BOX_H}
            rx={6}
            ry={6}
            fill={n.fill ?? "#fff9ed"}
            stroke={n.stroke ?? "#c9a64a"}
            strokeWidth={1.2}
          />
          <text
            x={COL_X[n.col] + 12}
            y={LAYER_Y[n.layer] + 22}
            fontFamily="var(--font-serif)"
            fontSize={13}
            fontWeight={600}
            fill="#1d150d"
            letterSpacing="0.5"
          >
            {n.label}
          </text>
          {n.sub && (
            <text
              x={COL_X[n.col] + 12}
              y={LAYER_Y[n.layer] + 38}
              fontFamily="var(--font-serif)"
              fontSize={9.5}
              fontStyle="italic"
              fill="#1d150d"
              opacity={0.65}
              letterSpacing="0.6"
            >
              {n.sub}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export type { Node as ArchitectureNode, Edge as ArchitectureEdge };
