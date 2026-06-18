"use client";
// Atlas — a travel log. The entry view is an "open window" (an iron arched window
// over an image, with a narration and a fragment). Three hand-drawn SVG icons in
// the top-right switch between three indexes: timeline / cabinet / old map.
// Tapping a place from any index returns to its open-window entry.
// All colors come from the room day/night palette (props.p); fonts match the rest
// of the app (Cormorant Garamond + Noto Serif SC).
import { useState } from "react";
import { ArchWindow } from "./ArchWindow";
import { FragmentCard, type FragmentColors } from "./glyphs";
import type { TravelPlace } from "@/lib/atlas-demo";

export type AtlasPalette = {
  bg: string; // page background (may be a gradient — only used as a div background)
  bgSolid: string; // solid color — used as SVG fill / nested gradient (a gradient string as fill renders black)
  paper: string;
  ink: string;
  accent: string;
  accent2: string;
  mute: string;
  hair: string;
};

type View = "entry" | "timeline" | "cabinet" | "carte";

// Latin → Cormorant Garamond; CJK → Noto Serif SC (the same web font as body text,
// so a title like "临安" stays consistent with the body instead of dropping to a
// system serif fallback).
const FONT_DISPLAY = '"Cormorant Garamond","EB Garamond","Noto Serif SC","Songti SC",serif';
const FONT_BODY = 'var(--font-noto-serif-sc),"Noto Serif SC","Songti SC",serif';

export function AtlasClient({ places, p, isDay }: { places: TravelPlace[]; p: AtlasPalette; isDay: boolean }) {
  const [view, setView] = useState<View>("entry");
  const [selId, setSelId] = useState<string | null>(places[0]?.id ?? null);
  const sel = places.find((x) => x.id === selId) ?? places[0] ?? null;

  const fc: FragmentColors = {
    card: p.paper,
    cardHi: isDay ? "#ffffff" : "rgba(255,255,255,0.04)",
    body: p.ink,
    mute: p.mute,
    roseSub: p.accent2,
    accent: p.accent,
    hair: p.hair,
  };
  const openPlace = (id: string) => {
    setSelId(id);
    setView("entry");
  };

  return (
    <div style={{ position: "relative", maxWidth: 440, margin: "0 auto", width: "100%", padding: "0 0 40px" }}>
      {/* ── header: title + count + 3 switch icons ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "8px 24px 0" }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 40, color: p.ink, letterSpacing: 0.5, lineHeight: 1 }}>
            Atlas
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 10, color: p.mute, letterSpacing: 4, marginTop: 4 }}>
            & PASSAGE · 去过的地方
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 12, color: p.accent2, letterSpacing: 1 }}>
            {places.length} lieux
          </span>
          <SwitchIcons view={view} setView={setView} accent={p.accent} mute={p.mute} />
        </div>
      </div>

      <div style={{ height: 0.5, background: p.hair, margin: "14px 24px 0" }} />

      {/* ── body ── */}
      {places.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 24px", fontFamily: FONT_DISPLAY, fontStyle: "italic", color: p.mute, fontSize: 14 }}>
          还没有去过的地方。
          <div style={{ fontSize: 11, marginTop: 8, letterSpacing: 2 }}>窗台还空着 · the windowsill is still empty</div>
        </div>
      ) : view === "entry" && sel ? (
        <EntryView place={sel} p={p} fc={fc} />
      ) : view === "timeline" ? (
        <TimelineView places={places} p={p} onOpen={openPlace} />
      ) : view === "cabinet" ? (
        <CabinetView places={places} p={p} fc={fc} onOpen={openPlace} />
      ) : (
        <CarteView places={places} p={p} selId={selId} onOpen={openPlace} />
      )}
    </div>
  );
}

// ── three view-switch icons (hand-drawn SVG: timeline / cabinet / old map) ──
function SwitchBtn({ v, view, setView, accent, mute, label, children }: { v: View; view: View; setView: (v: View) => void; accent: string; mute: string; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={() => setView(v)}
      aria-label={label}
      style={{
        width: 26, height: 26, padding: 0, border: "none", background: "transparent", cursor: "pointer",
        color: view === v ? accent : mute, opacity: view === v ? 1 : 0.6, transition: "opacity 150ms,color 150ms",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}

function SwitchIcons({ view, setView, accent, mute }: { view: View; setView: (v: View) => void; accent: string; mute: string }) {
  const shared = { view, setView, accent, mute };
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {/* timeline — stacked rows */}
      <SwitchBtn v="timeline" label="时间线" {...shared}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="3" cy="4" r="1.3" fill="currentColor" /><line x1="7" y1="4" x2="16" y2="4" stroke="currentColor" strokeWidth="1" />
          <circle cx="3" cy="9" r="1.3" fill="currentColor" /><line x1="7" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1" />
          <circle cx="3" cy="14" r="1.3" fill="currentColor" /><line x1="7" y1="14" x2="16" y2="14" stroke="currentColor" strokeWidth="1" />
        </svg>
      </SwitchBtn>
      {/* cabinet — 2x2 cards */}
      <SwitchBtn v="cabinet" label="碎片柜" {...shared}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
          <rect x="10" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
          <rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
          <rect x="10" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
        </svg>
      </SwitchBtn>
      {/* old map — compass star */}
      <SwitchBtn v="carte" label="古地图" {...shared}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1" />
          <path d="M9 3 L11 9 L9 15 L7 9 Z" fill="currentColor" opacity="0.85" />
          <path d="M3 9 L9 7 L15 9 L9 11 Z" stroke="currentColor" strokeWidth="0.6" fill="none" />
        </svg>
      </SwitchBtn>
    </div>
  );
}

// Center latch rose — a curved stem + one leaf + a bloom (outer halo + inner petals).
// `color` is the stem/leaf, `accent` is the bloom.
function RoseGlyph({ color, accent, size = 24 }: { color: string; accent?: string; size?: number }) {
  const a = accent ?? color;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden style={{ display: "block", color }}>
      <path d="M6 38 Q4 24 14 16" fill="none" stroke="currentColor" strokeWidth="0.7" />
      <path d="M9 27 Q3 25 2 19 Q8 21 10 26" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.8" />
      <g transform="translate(15 11)" stroke={a} fill="none" strokeWidth="0.7">
        <circle cx="0" cy="0" r="6.4" opacity="0.5" />
        <path d="M-3.4 1.6 Q0 -4.6 3.4 1.6 Q0 4.2 -3.4 1.6 Z" />
        <path d="M-4.8 -1 Q0 4 4.8 -1" opacity="0.7" />
        <path d="M0 -5 Q3 -2 2.4 1.4" opacity="0.6" />
      </g>
    </svg>
  );
}

// ════ ENTRY — open window (iron arch + center rose latch + title + narration + fragment) ════
function EntryView({ place, p, fc }: { place: TravelPlace; p: AtlasPalette; fc: FragmentColors }) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const body = place.body || "";
  const isLong = body.length > 150;
  const shown = expanded || !isLong ? body : body.slice(0, 150).trim() + "…";
  return (
    <div style={{ padding: "12px 24px 0" }}>
      {/* open window — arch + center rose latch (closed) / ✕ (open) + hint */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 2 }}>
        <div style={{ position: "relative", width: 300, height: 450 }}>
          <ArchWindow
            gold={p.accent}
            surround={p.bgSolid}
            image={place.imageUrl}
            placeholderLabel={place.imageKind === "artwork" ? "ARTWORK" : "ILLUSTRATION"}
            veil={open ? 0 : 0.86}
            width={300}
            height={450}
          />
          {/* center rose latch — shown when closed, tap to open. Round knob (radial
              dark→darker) + accent ring + warm glow, with the rose at the center. */}
          {!open && (
            <button
              onClick={() => setOpen(true)}
              aria-label="开窗"
              style={{
                position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
                width: 78, height: 78, borderRadius: "50%",
                border: `1px solid ${p.accent}`,
                background: `radial-gradient(circle at 40% 34%, ${p.paper}, ${p.bgSolid})`,
                boxShadow: `0 0 22px ${p.accent}40`,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "box-shadow 300ms",
              }}
            >
              <RoseGlyph color={p.accent} size={42} />
            </button>
          )}
          {/* reclose ✕ — shown when open, tap to close. Small corner circle, dark
              semi-transparent + accent ✕. */}
          {open && (
            <button
              onClick={() => setOpen(false)}
              aria-label="闭窗"
              style={{ position: "absolute", right: 12, top: 12, width: 29, height: 29, borderRadius: "50%", border: `0.6px solid ${p.hair}`, background: `${p.bgSolid}cc`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.accent }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 2 L 9 9 M 9 2 L 2 9" stroke="currentColor" strokeWidth="1.2" /></svg>
            </button>
          )}
        </div>
        {/* hint — when closed */}
        {!open && (
          <div style={{ marginTop: 10, fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 11, color: p.mute, letterSpacing: 2, opacity: 0.85 }}>
            push the window · see where it went
          </div>
        )}
      </div>

      {/* title block — vertically stacked editorial title: place name on its own line
          (so it never gets squeezed into a single vertical column), date/era epigraph
          below as a full line that wraps naturally. Holds up on narrow (phone) widths. */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 38, color: p.ink, letterSpacing: 1, lineHeight: 1.12 }}>
          {place.title}
        </div>
        {place.sub && (
          <div style={{ marginTop: 9, fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 13.5, color: p.accent2, lineHeight: 1.6, letterSpacing: 0.3 }}>
            {place.sub}
          </div>
        )}
        {place.era && (
          <div style={{ marginTop: 5, fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 11.5, color: p.mute, letterSpacing: 2, textTransform: "uppercase" }}>
            {place.era}
          </div>
        )}
      </div>

      {/* body — monologue, tap to expand/collapse */}
      {body && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "transparent", padding: 0, cursor: isLong ? "pointer" : "default", marginTop: 16 }}
        >
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flexShrink: 0, width: 2, background: p.accent, opacity: 0.55, borderRadius: 2 }} />
            <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: p.ink, lineHeight: 1.85, letterSpacing: 0.3, textAlign: "justify", opacity: 0.92, whiteSpace: "pre-wrap" }}>
              {shown}
              {isLong && (
                <span style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", color: p.accent2, fontSize: 12, marginLeft: 6, letterSpacing: 1 }}>
                  {expanded ? "收起" : "展开"}
                </span>
              )}
            </div>
          </div>
        </button>
      )}

      {/* fragment — the "brought back" gift */}
      {(place.gift || place.sensory) && (
        <div style={{ marginTop: 22 }}>
          <div style={{ height: 0.5, background: p.hair, marginBottom: 14 }} />
          <FragmentCard text={place.gift || place.sensory || ""} place={place.title.toUpperCase()} tag="on the windowsill" c={fc} compact />
        </div>
      )}

      {/* image source credit */}
      {place.imageSource && (
        <div style={{ marginTop: 14, fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 9.5, color: p.mute, letterSpacing: 0.5, lineHeight: 1.5, opacity: 0.8 }}>
          {place.imageSource}
        </div>
      )}
    </div>
  );
}

// ════ TIMELINE — list of arched-window thumbnails ════
function TimelineView({ places, p, onOpen }: { places: TravelPlace[]; p: AtlasPalette; onOpen: (id: string) => void }) {
  return (
    <div style={{ padding: "8px 24px 0" }}>
      {places.map((pl, i) => (
        <div key={pl.id}>
          <button
            onClick={() => onOpen(pl.id)}
            style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", display: "flex", gap: 14, padding: "16px 0", alignItems: "center", color: p.ink }}
          >
            <div style={{ flexShrink: 0 }}>
              <ArchWindow gold={p.accent} surround={p.bgSolid} image={pl.imageUrl} width={48} height={72} showSurround={false} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 21, color: p.ink, letterSpacing: 0.3 }}>{pl.title}</span>
                {pl.sub && <span style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 10.5, color: p.accent2 }}>{pl.sub}</span>}
              </div>
              <div style={{ marginTop: 3, fontFamily: FONT_BODY, fontSize: 12, color: p.ink, opacity: 0.8, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {pl.first}
              </div>
            </div>
            {pl.era && <span style={{ flexShrink: 0, fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 12, color: p.mute, letterSpacing: 1 }}>{pl.era}</span>}
          </button>
          {i < places.length - 1 && <div style={{ height: 0.5, background: p.hair }} />}
        </div>
      ))}
    </div>
  );
}

// ════ CABINET — fragments (the relics brought back) ════
function CabinetView({ places, p, fc, onOpen }: { places: TravelPlace[]; p: AtlasPalette; fc: FragmentColors; onOpen: (id: string) => void }) {
  return (
    <div style={{ padding: "16px 24px 0", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 10.5, color: p.mute, letterSpacing: 4, marginBottom: 2 }}>
        带回来的 · {places.length} 件 relics
      </div>
      {places.map((pl) => (
        <button key={pl.id} onClick={() => onOpen(pl.id)} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", textAlign: "left" }}>
          <FragmentCard text={pl.gift || pl.sensory || pl.first} place={pl.title.toUpperCase()} c={fc} />
        </button>
      ))}
      <div style={{ textAlign: "center", padding: "10px 0 0", fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 10, color: p.mute, letterSpacing: 3 }}>
        ⊹ &nbsp; chaque pièce, un lieu &nbsp; ⊹
      </div>
    </div>
  );
}

// ════ CARTE — old map (nodes + route + compass) ════
function CarteView({ places, p, selId, onOpen }: { places: TravelPlace[]; p: AtlasPalette; selId: string | null; onOpen: (id: string) => void }) {
  const W = 392, H = 480;
  // deterministic pseudo-layout: spread across a graticule by index
  const nodes = places.map((pl, i) => {
    const cols = [80, 300, 150, 285, 95, 250];
    const rows = [120, 90, 220, 290, 360, 200];
    return { pl, x: cols[i % cols.length] + (i >= cols.length ? (i % 3) * 18 : 0), y: rows[i % rows.length] + (i >= rows.length ? 40 : 0) };
  });
  return (
    <div style={{ padding: "12px 16px 0" }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 10.5, color: p.mute, letterSpacing: 4, padding: "0 8px 8px" }}>
        一条路线 · {places.length} waypoints
      </div>
      <div style={{ position: "relative", width: "100%", maxWidth: W, height: H, margin: "0 auto" }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          {/* graticule */}
          {[80, 180, 280, 380].map((y) => <line key={y} x1="16" y1={y} x2={W - 16} y2={y} stroke={p.hair} strokeWidth="0.4" />)}
          {[90, 196, 302].map((x) => <line key={x} x1={x} y1="60" x2={x} y2={H - 40} stroke={p.hair} strokeWidth="0.4" />)}
          {/* dotted route by chronology */}
          {nodes.slice(0, -1).map((n, i) => {
            const a = nodes[i], b = nodes[i + 1];
            const mx = (a.x + b.x) / 2 + (i % 2 ? 28 : -28), my = (a.y + b.y) / 2;
            return <path key={i} d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`} stroke={p.accent} strokeWidth="0.8" strokeDasharray="2 4" fill="none" opacity="0.55" />;
          })}
          {/* compass */}
          <g transform={`translate(${W - 56} ${H - 70})`} opacity="0.7">
            <circle r="20" fill="none" stroke={p.accent} strokeWidth="0.6" />
            {[0, 90, 180, 270].map((d) => {
              const r = (d * Math.PI) / 180;
              return <path key={d} d={`M 0 0 L ${Math.sin(r) * 3.5} ${-Math.cos(r) * 3.5} L ${Math.sin(r) * 20} ${-Math.cos(r) * 20} L ${-Math.sin(r) * 3.5} ${Math.cos(r) * 3.5} Z`} fill={p.accent} opacity="0.65" />;
            })}
            <text x="0" y="-24" textAnchor="middle" fontFamily="Cormorant Garamond" fontStyle="italic" fontSize="9" fill={p.accent}>N</text>
          </g>
        </svg>
        {/* nodes */}
        {nodes.map(({ pl, x, y }) => {
          const cur = pl.id === selId;
          return (
            <button key={pl.id} onClick={() => onOpen(pl.id)}
              style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", border: "none", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 4 }}>
              <span style={{ width: cur ? 13 : 9, height: cur ? 13 : 9, borderRadius: "50%", background: cur ? p.accent : "transparent", border: `1px solid ${cur ? p.accent : p.accent2}`, boxShadow: cur ? `0 0 10px ${p.accent}88` : "none" }} />
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: p.ink, letterSpacing: 0.3, whiteSpace: "nowrap" }}>{pl.title}</span>
              {pl.era && <span style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 8.5, color: p.mute }}>{pl.era}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
