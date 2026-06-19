"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { KimiTopNav } from "@/components/mucha/KimiPage";
import type { GOTHIC } from "@/lib/kimi-palettes";
import type { KimiTheme } from "@/lib/day-theme-client";
import { setKimiTheme } from "@/lib/theme-actions";
import type { GraphData, GraphNode, GraphNodeKind } from "@/lib/graph-data";
import { SCORE_FONT_BODY } from "@/lib/score-colors";

// /room/graph — her mind as a galaxy enshrined under a glass bell (Le Petit
// Prince's rose, kept under glass). The static KG is a turning 3D point-cloud;
// each memory is a small sun coloured by valence, the rose breathes at centre,
// last night's dream walk lights up rose-pink. Painting style switches between
// galaxy / ink / silk; the bell frame and rose stay fixed. Ported from the
// canon (Downloads/kimi-rose-zip/her-mind-canon.html) — pure canvas 2D, a
// hand-rolled projection, no 3D lib.

// ── canon palette (approved look) — kept verbatim so the rose-pink reads true ──
const GRAPH_NIGHT = {
  bg: "#0a0806", bgSoft: "#14110d",
  ink: "#efe5d3", inkMid: "rgba(239,229,211,0.60)", inkLow: "rgba(239,229,211,0.30)",
  gold: "#c9a76a", goldBright: "#ead29a",
  rose: "#b04063", roseDeep: "#7a1f3a", rosePale: "#d28aa1",
  glass: "#fff7e6",
  line: "rgba(201,167,106,0.30)",
  calm: "#8a9c84", warmth: "#c9a76a", brooding: "#9488b8", toward: "#b04063",
  cobalt: "#6f86ab", obs: "#a9adb5",
};
const GRAPH_DAY: typeof GRAPH_NIGHT = {
  bg: "#ece2d2", bgSoft: "#f1e8d8",
  ink: "#2a201b", inkMid: "rgba(42,32,27,0.60)", inkLow: "rgba(42,32,27,0.34)",
  gold: "#9a7a3a", goldBright: "#b08c4a",
  rose: "#a83a5d", roseDeep: "#6f1d34", rosePale: "#c98aa1",
  glass: "#ffffff",
  line: "rgba(110,40,55,0.30)",
  calm: "#7a8a72", warmth: "#a8843a", brooding: "#5a708a", toward: "#a83a5d",
  cobalt: "#5a708a", obs: "#8f939b",
};
type GraphTheme = typeof GRAPH_NIGHT;
type Mode = "galaxy" | "ink" | "silk";

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
// deterministic hash → two values in [0,1)
function hash01(str: string): { a: number; b: number } {
  let h1 = 2166136261, h2 = 5381;
  for (let i = 0; i < str.length; i++) {
    h1 ^= str.charCodeAt(i); h1 = Math.imul(h1, 16777619);
    h2 = ((h2 << 5) + h2) + str.charCodeAt(i);
  }
  return { a: ((h1 >>> 0) % 100000) / 100000, b: ((h2 >>> 0) % 100000) / 100000 };
}
function vColor(v: number | null, T: GraphTheme): string {
  if (v == null) return T.gold;
  if (v < -0.15) return T.brooding;
  if (v < 0.12) return T.calm;
  if (v < 0.45) return T.warmth;
  return T.toward;
}
function edgeColor(rel: string, T: GraphTheme): string {
  return ({ similar: T.calm, mentions: T.warmth, tagged: T.cobalt, co_mentioned: T.rose } as Record<string, string>)[rel] ?? T.line;
}
function nodeColor(node: GraphNode, T: GraphTheme): string {
  if (node.kind === "memory") return vColor(node.valence, T);
  if (node.kind === "entity") return T.gold;
  if (node.kind === "topic") return T.cobalt;
  return T.obs; // observation — soft cool gray, not the dark inkMid brown
}

type P3 = { x: number; y: number; z: number; node: GraphNode };
type Proj = { x: number; y: number; z: number; s: number };

const SHELL: Record<GraphNodeKind, number> = { topic: 0.2, entity: 0.46, memory: 0.72, observation: 1.04 };
const KIND_ORDER: GraphNodeKind[] = ["topic", "entity", "memory", "observation"];

export function GraphView({ G, data, theme }: { G: typeof GOTHIC; data: GraphData; theme: KimiTheme }) {
  const { nodes, edges, dream, counts } = data;
  const dark = theme === "night";
  const T = dark ? GRAPH_NIGHT : GRAPH_DAY;

  const [mode, setMode] = useState<Mode>("galaxy");
  const [spin, setSpin] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  // restore persisted mode / spin
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("kimiRoomGraph") || "{}");
      if (s.mode === "galaxy" || s.mode === "ink" || s.mode === "silk") setMode(s.mode);
      if (typeof s.spin === "boolean") setSpin(s.spin);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("kimiRoomGraph", JSON.stringify({ mode, spin })); } catch { /* ignore */ }
  }, [mode, spin]);

  // /room/graph: disable pull-to-refresh (overscroll) while this page is mounted —
  // the canvas owns vertical drag, an accidental pull shouldn't reload the route.
  useEffect(() => {
    const root = document.documentElement, body = document.body;
    const pr = root.style.overscrollBehaviorY, pb = body.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = "contain";
    body.style.overscrollBehaviorY = "contain";
    return () => { root.style.overscrollBehaviorY = pr; body.style.overscrollBehaviorY = pb; };
  }, []);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const dreamSurfaced = useMemo(() => new Set(dream?.surfacedIds ?? []), [dream]);
  const dreamLinked = useMemo(() => new Set(dream?.linkedIds ?? []), [dream]);
  const nextTheme: KimiTheme = theme === "day" ? "night" : "day";

  // refs the rAF loop reads (so mode/spin/selected/theme update without re-mounting)
  const modeRef = useRef(mode); modeRef.current = mode;
  const spinRef = useRef(spin); spinRef.current = spin;
  const selRef = useRef(selected); selRef.current = selected;
  const TRef = useRef(T); TRef.current = T;
  const darkRef = useRef(dark); darkRef.current = dark;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── the engine ──
  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 3D layout — nested shells by kind, fibonacci sphere, hash jitter
    const node3d = new Map<string, P3>();
    for (const kind of KIND_ORDER) {
      const list = nodes.filter((n) => n.kind === kind);
      const n = list.length;
      list.forEach((node, i) => {
        const { a, b } = hash01("z3" + node.id);
        const y = 1 - (i / Math.max(1, n - 1)) * 2;
        const rr = Math.sqrt(Math.max(0, 1 - y * y));
        const phi = Math.PI * (3 - Math.sqrt(5));
        const thetaA = phi * i + a * 0.9;
        let radius = SHELL[kind];
        if (kind === "memory") radius = 0.52 + b * 0.28;
        if (kind === "observation") radius = 0.82 + b * 0.1;
        node3d.set(node.id, { x: Math.cos(thetaA) * rr * radius, y: y * radius, z: Math.sin(thetaA) * rr * radius, node });
      });
    }

    // dream walked edges (similar edge bridging a surfaced + a linked memory)
    const walked = new Set<string>();
    for (const e of edges) {
      if (e.relationType === "similar" &&
        ((dreamSurfaced.has(e.fromId) && dreamLinked.has(e.toId)) ||
         (dreamSurfaced.has(e.toId) && dreamLinked.has(e.fromId)))) {
        walked.add(e.fromId + ">" + e.toId); walked.add(e.toId + ">" + e.fromId);
      }
    }

    // nebula anchors (parallax with spin)
    const NEB = [
      { x: -0.5, y: 0.3, z: -0.2, c: "toward" as const, r: 0.9 },
      { x: 0.6, y: -0.2, z: 0.3, c: "calm" as const, r: 1.0 },
      { x: 0.1, y: 0.5, z: 0.5, c: "warmth" as const, r: 0.8 },
      { x: -0.3, y: -0.5, z: 0.1, c: "brooding" as const, r: 0.85 },
    ];
    const petals = Array.from({ length: 7 }, (_, i) => { const { a, b } = hash01("pet" + i); return { seed: i, ph: a, sp: 0.5 + b * 0.7, sway: a * 6 }; });
    const settled = Array.from({ length: 5 }, (_, i) => { const { a, b } = hash01("rest" + i); return { dx: (a - 0.5) * 1.5, rot: b * Math.PI, sz: 0.85 + a * 0.4 }; });

    // rose lineart — deep rose (玫红), both day & night
    const roseDeep = new Image(); roseDeep.src = "/icons/graph-rose-deep.png";
    const ROSE = { h: 0.34, dy: 0.12 };

    const view = { rotX: -0.4, rotY: 0.4, zoom: 1 };
    let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = 1, M = 1, t = 0;
    const proj = new Map<string, Proj>();

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, rect.width); H = Math.max(1, rect.height);
      canvas!.width = Math.round(W * DPR); canvas!.height = Math.round(H * DPR);
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = W / 2; cy = H / 2; M = Math.min(W, H); R = M * 0.17 * view.zoom;
    }
    const F = 3.0;
    function project(p: { x: number; y: number; z: number }): Proj {
      const cosY = Math.cos(view.rotY), sinY = Math.sin(view.rotY);
      const x1 = p.x * cosY - p.z * sinY, z1 = p.x * sinY + p.z * cosY;
      const cosX = Math.cos(view.rotX), sinX = Math.sin(view.rotX);
      const y1 = p.y * cosX - z1 * sinX, z2 = p.y * sinX + z1 * cosX;
      const persp = F / (F - z2);
      return { x: cx + x1 * persp * R, y: cy + y1 * persp * R, z: z2, s: persp };
    }
    const baseSize = (node: GraphNode) => 1.1 + node.weight * 2.1;

    function draw() {
      const c = ctx!; if (W < 2 || H < 2) { resize(); if (W < 2 || H < 2) return; }
      t += 1;
      const Th = TRef.current, dk = darkRef.current, md = modeRef.current;

      // background wash
      c.fillStyle = Th.bg; c.fillRect(0, 0, W, H);
      if (md === "ink" && !dk) {
        const g = c.createRadialGradient(cx, cy, 0, cx, cy, M * 0.9);
        g.addColorStop(0, hexA(Th.bgSoft, 0)); g.addColorStop(1, hexA(Th.roseDeep, 0.06));
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      }
      // night/galaxy bg = the solid Th.bg fill above only. The rose-wash radial
      // gradient was removed: on near-black it banded into two faint horizontal
      // rings (the "两排星点" — a radial color-stop contour crosses each side at
      // two y's). The rose's own halo carries the atmosphere now.

      // clip nebula + galaxy to the glass interior — every star stays inside the bell, no overflow
      c.save();
      {
        const w = M * 0.30, bY = cy + M * 0.40, fY = bY - M * 0.015, sY = cy - M * 0.16, tY = cy - M * 0.42, nW = M * 0.052;
        c.beginPath(); c.moveTo(cx - w, bY); c.lineTo(cx - w, fY);
        c.quadraticCurveTo(cx - w * 1.02, (fY + sY) / 2, cx - w * 0.99, sY);
        c.quadraticCurveTo(cx - w, tY, cx - nW, tY + M * 0.012);
        c.quadraticCurveTo(cx, tY - M * 0.018, cx + nW, tY + M * 0.012);
        c.quadraticCurveTo(cx + w, tY, cx + w * 0.99, sY);
        c.quadraticCurveTo(cx + w * 1.02, (fY + sY) / 2, cx + w, fY);
        c.lineTo(cx + w, bY); c.closePath();
      }
      c.clip();

      // nebula
      if (md !== "ink") {
        c.save(); c.globalCompositeOperation = dk ? "lighter" : "source-over";
        for (const nb of NEB) {
          const p = project(nb); const rad = M * nb.r * 0.5 * p.s; const col = (Th as Record<string, string>)[nb.c];
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
          g.addColorStop(0, hexA(col, dk ? 0.06 : 0.05)); g.addColorStop(0.5, hexA(col, dk ? 0.025 : 0.02)); g.addColorStop(1, hexA(col, 0));
          c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, rad, 0, 7); c.fill();
        }
        c.restore();
      }

      // project
      proj.clear();
      node3d.forEach((p, id) => proj.set(id, project(p)));

      // edges
      const E = edges.map((e) => {
        const a = proj.get(e.fromId), b = proj.get(e.toId);
        if (!a || !b) return null;
        return { e, a, b, depth: (a.z + b.z) / 2, walked: walked.has(e.fromId + ">" + e.toId) };
      }).filter(Boolean) as { e: typeof edges[number]; a: Proj; b: Proj; depth: number; walked: boolean }[];
      E.sort((x, y) => x.depth - y.depth);

      if (md === "galaxy") drawEdgesGalaxy(E, Th, dk);
      else if (md === "ink") drawEdgesInk(E, Th, dk);
      else drawEdgesSilk(E, Th, dk);

      // dream walked edges, luminous
      for (const { a, b, walked: wk } of E) {
        if (!wk) continue;
        c.save(); c.globalCompositeOperation = dk ? "lighter" : "source-over";
        c.strokeStyle = hexA(Th.rose, 0.85); c.lineWidth = 1.4; c.setLineDash([4, 4]); c.lineDashOffset = -t * 0.15;
        const mx = (a.x + b.x) / 2 + (cx - (a.x + b.x) / 2) * 0.18, my = (a.y + b.y) / 2 + (cy - (a.y + b.y) / 2) * 0.18;
        c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(mx, my, b.x, b.y); c.stroke(); c.restore();
      }

      // nodes back→front
      const order = [...proj.entries()].map(([id, p]) => ({ id, p, node: node3d.get(id)!.node })).sort((x, y) => x.p.z - y.p.z);
      for (const { id, p, node } of order) {
        const depthA = 0.32 + ((p.z + 1.1) / 2.2) * 0.68;
        const col = nodeColor(node, Th), sz = baseSize(node) * p.s;
        const isSurf = dreamSurfaced.has(id), isLink = dreamLinked.has(id), isSel = selRef.current === id;
        const pulse = isSurf ? 0.6 + 0.4 * Math.sin(t * 0.08) : 1;
        if (md === "galaxy") drawNodeGalaxy(p, node, col, sz, depthA, isSurf, isLink, pulse, Th, dk);
        else if (md === "ink") drawNodeInk(p, node, col, sz, depthA, isSurf, pulse, Th);
        else drawNodeSilk(p, node, col, sz, depthA, isSurf, pulse, Th, dk);
        if (isSel) {
          c.save(); c.globalAlpha = 1; c.strokeStyle = hexA(Th.rose, 0.95); c.lineWidth = 1.4;
          c.beginPath(); c.arc(p.x, p.y, sz + 6, 0, 7); c.stroke(); c.restore();
        }
      }

      c.restore(); // end glass clip — bell + rose draw on top, unclipped
      drawBell(Th, dk);
    }

    /* GALAXY */
    function drawEdgesGalaxy(E: { e: typeof edges[number]; a: Proj; b: Proj; depth: number }[], Th: GraphTheme, dk: boolean) {
      const c = ctx!; c.save(); c.globalCompositeOperation = dk ? "lighter" : "source-over";
      for (const { e, a, b, depth } of E) {
        const col = edgeColor(e.relationType, Th);
        const alpha = Math.min(0.34, e.confidence * 0.42) * (0.4 + (depth + 1.1) / 2.2 * 0.6);
        const grad = c.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, hexA(col, alpha * 0.2)); grad.addColorStop(0.5, hexA(col, alpha)); grad.addColorStop(1, hexA(col, alpha * 0.2));
        c.strokeStyle = grad; c.lineWidth = 0.5;
        const mx = (a.x + b.x) / 2 + (cx - (a.x + b.x) / 2) * 0.16, my = (a.y + b.y) / 2 + (cy - (a.y + b.y) / 2) * 0.16;
        c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(mx, my, b.x, b.y); c.stroke();
      }
      c.restore();
    }
    function drawNodeGalaxy(p: Proj, node: GraphNode, col: string, sz: number, depthA: number, isSurf: boolean, isLink: boolean, pulse: number, Th: GraphTheme, dk: boolean) {
      const c = ctx!; c.save(); c.globalCompositeOperation = dk ? "lighter" : "source-over";
      if (isSurf) { const h = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30 * pulse); h.addColorStop(0, hexA(Th.rose, 0.4 * pulse)); h.addColorStop(1, hexA(Th.rose, 0)); c.fillStyle = h; c.beginPath(); c.arc(p.x, p.y, 30 * pulse, 0, 7); c.fill(); }
      else if (isLink) { const h = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18); h.addColorStop(0, hexA(Th.warmth, 0.3)); h.addColorStop(1, hexA(Th.warmth, 0)); c.fillStyle = h; c.beginPath(); c.arc(p.x, p.y, 18, 0, 7); c.fill(); }
      const bloom = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 2.8);
      bloom.addColorStop(0, hexA(col, (dk ? 0.24 : 0.38) * depthA)); bloom.addColorStop(1, hexA(col, 0));
      c.fillStyle = bloom; c.beginPath(); c.arc(p.x, p.y, sz * 2.8, 0, 7); c.fill();
      c.globalAlpha = depthA; c.fillStyle = node.kind === "entity" ? Th.goldBright : col;
      if (node.kind === "entity") { c.beginPath(); c.moveTo(p.x, p.y - sz); c.lineTo(p.x + sz, p.y); c.lineTo(p.x, p.y + sz); c.lineTo(p.x - sz, p.y); c.closePath(); c.fill(); }
      else if (node.kind === "topic") { c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath(); c.arc(p.x, p.y, sz + 0.5, 0, 7); c.stroke(); }
      else { c.beginPath(); c.arc(p.x, p.y, sz, 0, 7); c.fill(); c.fillStyle = hexA("#ffffff", 0.5 * depthA); c.beginPath(); c.arc(p.x - sz * 0.3, p.y - sz * 0.3, sz * 0.4, 0, 7); c.fill(); }
      if (isSurf) { c.globalAlpha = 1; c.strokeStyle = hexA(Th.rose, 0.9); c.lineWidth = 1.2; c.beginPath(); c.arc(p.x, p.y, sz + 4, 0, 7); c.stroke(); }
      c.restore();
    }

    /* INK */
    function drawEdgesInk(E: { e: typeof edges[number]; a: Proj; b: Proj; depth: number }[], Th: GraphTheme, _dk: boolean) {
      const c = ctx!; c.save();
      for (const { e, a, b, depth } of E) {
        const col = edgeColor(e.relationType, Th); const dA = 0.4 + (depth + 1.1) / 2.2 * 0.6;
        const alpha = Math.min(0.3, e.confidence * 0.4) * dA;
        const mx = (a.x + b.x) / 2 + (cx - (a.x + b.x) / 2) * 0.2, my = (a.y + b.y) / 2 + (cy - (a.y + b.y) / 2) * 0.2;
        for (let k = 0; k < 3; k++) { c.strokeStyle = hexA(col, alpha * (k === 1 ? 1 : 0.4)); c.lineWidth = (3 - k) * (0.6 + e.confidence * 0.7) * dA; c.lineCap = "round"; c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(mx, my, b.x, b.y); c.stroke(); }
      }
      c.restore();
    }
    function drawNodeInk(p: Proj, node: GraphNode, col: string, sz: number, depthA: number, isSurf: boolean, pulse: number, Th: GraphTheme) {
      const c = ctx!; c.save();
      if (isSurf) { const h = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26 * pulse); h.addColorStop(0, hexA(Th.rose, 0.32 * pulse)); h.addColorStop(1, hexA(Th.rose, 0)); c.fillStyle = h; c.beginPath(); c.arc(p.x, p.y, 26 * pulse, 0, 7); c.fill(); }
      if (node.kind === "memory" || node.kind === "observation") {
        const r = sz * (node.kind === "memory" ? 2.4 : 1.4);
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, hexA(col, 0.85 * depthA)); g.addColorStop(0.55, hexA(col, 0.4 * depthA)); g.addColorStop(1, hexA(col, 0));
        c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
        c.fillStyle = hexA(col, 0.9 * depthA); c.beginPath(); c.arc(p.x, p.y, sz * 0.7, 0, 7); c.fill();
      } else if (node.kind === "entity") { c.fillStyle = hexA(Th.gold, depthA); c.beginPath(); c.moveTo(p.x, p.y - sz); c.lineTo(p.x + sz, p.y); c.lineTo(p.x, p.y + sz); c.lineTo(p.x - sz, p.y); c.closePath(); c.fill(); }
      else { c.strokeStyle = hexA(col, depthA); c.lineWidth = 1.6; c.beginPath(); c.arc(p.x, p.y, sz + 1, 0, 7); c.stroke(); }
      if (isSurf) { c.strokeStyle = hexA(Th.rose, 0.85); c.lineWidth = 1.3; c.beginPath(); c.arc(p.x, p.y, sz + 5, 0, 7); c.stroke(); }
      c.restore();
    }

    /* SILK */
    function drawEdgesSilk(E: { e: typeof edges[number]; a: Proj; b: Proj; depth: number }[], Th: GraphTheme, dk: boolean) {
      const c = ctx!; c.save();
      for (const { e, a, b, depth } of E) {
        const c1 = nodeColor(node3d.get(e.fromId)!.node, Th), c2 = nodeColor(node3d.get(e.toId)!.node, Th);
        const dA = 0.35 + (depth + 1.1) / 2.2 * 0.65;
        const alpha = Math.min(0.5, 0.2 + e.confidence * 0.4) * dA;
        const mx = (a.x + b.x) / 2 + (cx - (a.x + b.x) / 2) * 0.28, my = (a.y + b.y) / 2 + (cy - (a.y + b.y) / 2) * 0.28;
        const grad = c.createLinearGradient(a.x, a.y, b.x, b.y); grad.addColorStop(0, hexA(c1, alpha)); grad.addColorStop(1, hexA(c2, alpha));
        c.strokeStyle = grad; c.lineWidth = 1.1 * dA; c.lineCap = "round"; c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(mx, my, b.x, b.y); c.stroke();
        c.save(); c.globalCompositeOperation = dk ? "lighter" : "source-over"; c.strokeStyle = hexA(dk ? "#fff7e6" : "#ffffff", alpha * 0.5); c.lineWidth = 0.4 * dA; c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(mx, my, b.x, b.y); c.stroke(); c.restore();
      }
      c.restore();
    }
    function drawNodeSilk(p: Proj, node: GraphNode, col: string, sz: number, depthA: number, isSurf: boolean, pulse: number, Th: GraphTheme, dk: boolean) {
      const c = ctx!; c.save();
      if (isSurf) { const h = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 22 * pulse); h.addColorStop(0, hexA(Th.rose, 0.34 * pulse)); h.addColorStop(1, hexA(Th.rose, 0)); c.fillStyle = h; c.beginPath(); c.arc(p.x, p.y, 22 * pulse, 0, 7); c.fill(); }
      const r = sz * 0.9;
      const g = c.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, 0, p.x, p.y, r * 1.6);
      g.addColorStop(0, hexA(dk ? "#fff7e6" : "#ffffff", 0.85 * depthA)); g.addColorStop(0.4, hexA(col, depthA)); g.addColorStop(1, hexA(col, 0.15 * depthA));
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r * 1.5, 0, 7); c.fill();
      if (node.kind === "entity") { c.strokeStyle = hexA(Th.goldBright, depthA); c.lineWidth = 0.8; c.beginPath(); c.arc(p.x, p.y, r * 1.5, 0, 7); c.stroke(); }
      if (isSurf) { c.globalCompositeOperation = dk ? "lighter" : "source-over"; c.strokeStyle = hexA(Th.rose, 0.85); c.lineWidth = 1.2; c.beginPath(); c.arc(p.x, p.y, sz + 4, 0, 7); c.stroke(); }
      c.restore();
    }

    /* THE GLASS BELL */
    function drawRose(x: number, y: number, h: number, Th: GraphTheme, dk: boolean, alpha: number) {
      const c = ctx!; const img = roseDeep; const pulse = 0.78 + 0.22 * Math.sin(t * 0.05);
      c.save(); c.globalCompositeOperation = dk ? "lighter" : "source-over";
      const gr = h * (0.85 + 0.12 * Math.sin(t * 0.05));
      const g = c.createRadialGradient(x, y, 0, x, y, gr);
      g.addColorStop(0, hexA(Th.rose, (dk ? 0.26 : 0.24) * pulse));
      g.addColorStop(0.55, hexA(Th.roseDeep, (dk ? 0.14 : 0.07) * pulse));
      g.addColorStop(1, hexA(Th.rose, 0));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, gr, 0, 7); c.fill();
      c.globalCompositeOperation = "source-over";
      if (img.complete && img.naturalWidth) {
        const w = h * (img.naturalWidth / img.naturalHeight);
        c.save(); c.globalCompositeOperation = dk ? "multiply" : "source-over";
        const sh = c.createRadialGradient(x, y + h * 0.46, 0, x, y + h * 0.46, w * 0.42);
        sh.addColorStop(0, hexA("#000000", dk ? 0.35 : 0.12)); sh.addColorStop(1, hexA("#000000", 0));
        c.fillStyle = sh; c.beginPath(); c.ellipse(x, y + h * 0.46, w * 0.42, h * 0.05, 0, 0, 7); c.fill(); c.restore();
        c.globalAlpha = alpha; c.drawImage(img, x - w / 2, y - h / 2, w, h);
      } else { c.fillStyle = Th.rose; c.beginPath(); c.arc(x, y, h * 0.12, 0, 7); c.fill(); }
      c.restore();
    }
    function drawBell(Th: GraphTheme, dk: boolean) {
      const c = ctx!;
      const halfW = M * 0.30, baseY = cy + M * 0.40, footY = baseY - M * 0.015;
      const shoulderY = cy - M * 0.16, domeTopY = cy - M * 0.42, neckW = M * 0.052;
      const gold = (a: number) => hexA(Th.gold, a);
      const bodyPath = (w: number, fY: number, sY: number, tY: number, nW: number) => {
        c.beginPath(); c.moveTo(cx - w, baseY); c.lineTo(cx - w, fY);
        c.quadraticCurveTo(cx - w * 1.02, (fY + sY) / 2, cx - w * 0.99, sY);
        c.quadraticCurveTo(cx - w, tY, cx - nW, tY + M * 0.012);
        c.quadraticCurveTo(cx, tY - M * 0.018, cx + nW, tY + M * 0.012);
        c.quadraticCurveTo(cx + w, tY, cx + w * 0.99, sY);
        c.quadraticCurveTo(cx + w * 1.02, (fY + sY) / 2, cx + w, fY);
        c.lineTo(cx + w, baseY); c.closePath();
      };
      // inner glass tint
      c.save(); c.globalCompositeOperation = dk ? "lighter" : "source-over";
      bodyPath(halfW, footY, shoulderY, domeTopY, neckW);
      const tint = c.createLinearGradient(cx - halfW, domeTopY, cx + halfW, baseY);
      tint.addColorStop(0, hexA(Th.glass, dk ? 0.05 : 0.10)); tint.addColorStop(0.5, hexA(Th.glass, 0));
      c.fillStyle = tint; c.fill(); c.restore();
      // refraction caustic
      c.save(); c.globalCompositeOperation = dk ? "lighter" : "source-over";
      bodyPath(halfW, footY, shoulderY, domeTopY, neckW); c.clip();
      const caustic = c.createLinearGradient(cx - halfW, shoulderY - M * 0.05, cx + halfW, shoulderY + M * 0.10);
      caustic.addColorStop(0, hexA(Th.glass, 0)); caustic.addColorStop(0.5, hexA(Th.glass, dk ? 0.07 : 0.10)); caustic.addColorStop(1, hexA(Th.glass, 0));
      c.fillStyle = caustic; c.fillRect(cx - halfW, shoulderY - M * 0.06, halfW * 2, M * 0.18); c.restore();
      // glass outline (double)
      c.strokeStyle = gold(0.6); c.lineWidth = 1.3; c.lineJoin = "round"; bodyPath(halfW, footY, shoulderY, domeTopY, neckW); c.stroke();
      c.strokeStyle = gold(0.22); c.lineWidth = 0.6; bodyPath(halfW - 7, footY, shoulderY + 4, domeTopY + 8, neckW - 2); c.stroke();
      // soft rim light pooled upper-left
      c.save(); c.globalCompositeOperation = dk ? "lighter" : "source-over";
      bodyPath(halfW, footY, shoulderY, domeTopY, neckW); c.clip();
      const rim = c.createRadialGradient(cx - halfW * 0.5, domeTopY + M * 0.10, 0, cx - halfW * 0.5, domeTopY + M * 0.10, M * 0.26);
      rim.addColorStop(0, hexA(Th.glass, dk ? 0.10 : 0.14)); rim.addColorStop(1, hexA(Th.glass, 0));
      c.fillStyle = rim; c.fillRect(cx - halfW, domeTopY, halfW, M * 0.4); c.restore();
      // crown finial + star
      const knobY = domeTopY - M * 0.028;
      c.strokeStyle = gold(0.6); c.lineWidth = 1.4; c.beginPath(); c.moveTo(cx, domeTopY - M * 0.004); c.lineTo(cx, knobY + 4); c.stroke();
      c.fillStyle = gold(0.85); c.beginPath(); c.arc(cx, knobY, M * 0.012, 0, 7); c.fill();
      c.strokeStyle = gold(0.5); c.lineWidth = 0.7; c.beginPath(); c.ellipse(cx, knobY + M * 0.013, M * 0.017, M * 0.006, 0, 0, 7); c.stroke();
      { const sy = knobY - M * 0.028, r = M * 0.012, tw = 0.55 + 0.45 * Math.sin(t * 0.06);
        c.save(); c.globalCompositeOperation = dk ? "lighter" : "source-over"; c.strokeStyle = hexA(Th.goldBright, 0.4 + tw * 0.5); c.lineWidth = 1;
        c.beginPath(); c.moveTo(cx - r, sy); c.lineTo(cx + r, sy); c.moveTo(cx, sy - r * 1.5); c.lineTo(cx, sy + r * 1.5);
        c.moveTo(cx - r * 0.5, sy - r * 0.5); c.lineTo(cx + r * 0.5, sy + r * 0.5); c.moveTo(cx - r * 0.5, sy + r * 0.5); c.lineTo(cx + r * 0.5, sy - r * 0.5); c.stroke(); c.restore(); }
      // reflection streaks
      c.save(); c.globalCompositeOperation = dk ? "lighter" : "source-over";
      c.strokeStyle = hexA(Th.glass, dk ? 0.16 : 0.22); c.lineWidth = 1.4; c.lineCap = "round";
      c.beginPath(); c.moveTo(cx - halfW * 0.55, domeTopY + M * 0.08); c.quadraticCurveTo(cx - halfW * 0.78, cy, cx - halfW * 0.66, baseY - M * 0.10); c.stroke();
      c.lineWidth = 0.8; c.strokeStyle = hexA(Th.glass, dk ? 0.10 : 0.16);
      c.beginPath(); c.moveTo(cx - halfW * 0.40, domeTopY + M * 0.10); c.quadraticCurveTo(cx - halfW * 0.58, cy, cx - halfW * 0.50, baseY - M * 0.12); c.stroke(); c.restore();
      // base plate
      c.strokeStyle = gold(0.6); c.lineWidth = 1; c.beginPath(); c.ellipse(cx, baseY, halfW * 1.06, M * 0.016, 0, 0, 7); c.stroke();
      const plateH = M * 0.03, plateW = halfW * 1.34;
      c.fillStyle = dk ? hexA(Th.bgSoft, 0.92) : hexA("#d8c39a", 0.55);
      c.beginPath(); c.ellipse(cx, baseY + M * 0.02, plateW, M * 0.018, 0, 0, Math.PI); c.lineTo(cx - plateW, baseY + M * 0.02); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(cx - plateW, baseY + M * 0.02); c.lineTo(cx - plateW, baseY + M * 0.02 + plateH);
      c.ellipse(cx, baseY + M * 0.02 + plateH, plateW, M * 0.018, 0, Math.PI, 0, true); c.lineTo(cx + plateW, baseY + M * 0.02); c.stroke();
      c.beginPath(); c.ellipse(cx, baseY + M * 0.02, plateW, M * 0.018, 0, 0, 7); c.stroke();
      c.strokeStyle = gold(0.35); c.lineWidth = 0.6; c.beginPath(); c.ellipse(cx, baseY + M * 0.02 + plateH * 0.55, plateW * 0.92, M * 0.013, 0, 0, 7); c.stroke();
      // settled petals
      for (const s of settled) {
        const px = cx + s.dx * halfW * 0.5, py = baseY + M * 0.006;
        c.save(); c.translate(px, py); c.rotate(s.rot * 0.4); c.fillStyle = hexA(Th.roseDeep, dk ? 0.7 : 0.5);
        c.beginPath(); c.ellipse(0, 0, M * 0.013 * s.sz, M * 0.006 * s.sz, 0, 0, 7); c.fill(); c.restore();
      }
      // the rose, enshrined
      drawRose(cx, cy + M * ROSE.dy, M * ROSE.h, Th, dk, 0.97);
      // gold-dust motes
      const rx = cx, ry = cy + M * ROSE.dy;
      c.save(); c.globalCompositeOperation = dk ? "lighter" : "source-over";
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + t * 0.012;
        const rr = M * 0.085 * (0.65 + 0.35 * Math.sin(t * 0.04 + k * 1.3));
        const sxp = rx + Math.cos(a) * rr, syp = ry + Math.sin(a) * rr * 0.82;
        const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.07 + k * 1.7));
        c.fillStyle = hexA(Th.goldBright, tw * (dk ? 0.6 : 0.4)); c.beginPath(); c.arc(sxp, syp, 0.9 + tw, 0, 7); c.fill();
        if (tw > 0.82) { c.strokeStyle = hexA(Th.goldBright, (tw - 0.82) * 2.5); c.lineWidth = 0.5; c.beginPath(); c.moveTo(sxp - 4, syp); c.lineTo(sxp + 4, syp); c.moveTo(sxp, syp - 4); c.lineTo(sxp, syp + 4); c.stroke(); }
      }
      c.restore();
      // drifting petals
      const fallTop = domeTopY + M * 0.06, fallBot = baseY - M * 0.03, span = fallBot - fallTop;
      for (const p of petals) {
        const prog = ((t * 0.0014 * p.sp + p.ph) % 1 + 1) % 1;
        const py = fallTop + prog * span;
        const px = cx + Math.sin(t * 0.018 * p.sp + p.sway) * M * 0.11 * (0.5 + p.ph * 0.5);
        const rot = t * 0.03 * p.sp + p.seed * 1.4; const fade = Math.sin(prog * Math.PI);
        c.save(); c.translate(px, py); c.rotate(rot); c.fillStyle = hexA(Th.roseDeep, fade * (dk ? 0.85 : 0.6));
        c.beginPath(); c.moveTo(0, -M * 0.011); c.quadraticCurveTo(M * 0.009, -M * 0.004, 0, M * 0.011); c.quadraticCurveTo(-M * 0.009, -M * 0.004, 0, -M * 0.011); c.fill();
        if (fade > 0.7) { c.globalCompositeOperation = dk ? "lighter" : "source-over"; c.fillStyle = hexA(Th.rosePale, (fade - 0.7) * 1.5); c.beginPath(); c.arc(-M * 0.002, -M * 0.002, M * 0.0025, 0, 7); c.fill(); }
        c.restore();
      }
    }

    // ── interaction ──
    const drag = { active: false, x: 0, y: 0, moved: 0, mouse: false };
    const onDown = (e: PointerEvent) => { drag.active = true; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; drag.mouse = e.pointerType === "mouse"; canvas.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!drag.active) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      view.rotY += dx * 0.006;
      if (drag.mouse) view.rotX = Math.max(-1.3, Math.min(1.3, view.rotX + dy * 0.006)); // touch keeps vertical scroll
    };
    const onUp = (e: PointerEvent) => {
      drag.active = false;
      if (drag.moved < 6) {
        // hit-test nearest projected node
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        let best: string | null = null, bestD = 16 * 16;
        proj.forEach((p, id) => { const dx = p.x - mx, dy = p.y - my; const d = dx * dx + dy * dy; if (d < bestD) { bestD = d; best = id; } });
        setSelected(best);
      }
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); view.zoom = Math.max(0.6, Math.min(2.2, view.zoom * (1 - e.deltaY * 0.0012))); resize(); };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    let raf = 0;
    const tick = () => { if (spinRef.current && !drag.active) view.rotY += 0.0020; draw(); raf = requestAnimationFrame(tick); };
    const ro = new ResizeObserver(() => { resize(); });
    ro.observe(wrap);
    const onLoad = () => { resize(); };
    roseDeep.addEventListener("load", onLoad);
    resize(); tick();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("wheel", onWheel);
      roseDeep.removeEventListener("load", onLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, dreamSurfaced, dreamLinked]);

  const selectedNode = selected ? nodeById.get(selected) ?? null : null;

  return (
    <>
      <KimiTopNav title="HEARTBEAT" sub="graph · 图谱" P={G} icon="✦" iconColor={G.rose1} backHref="/room/heartbeat" />

      {/* counts — small data line, no prose title */}
      <div style={{ textAlign: "center", marginTop: 14, color: G.mute, fontSize: 10, letterSpacing: 3, fontFamily: SCORE_FONT_BODY, fontStyle: "italic" }}>
        {counts.memory} mem · {counts.entity} ent · {counts.topic} topic · {counts.observation} obs · {counts.edges} edges
      </div>

      {/* the bell-jar galaxy */}
      <div
        ref={wrapRef}
        style={{ position: "relative", width: "100%", height: "clamp(420px, 70vh, 640px)", marginTop: 8, touchAction: "pan-y" }}
      >
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }} aria-label="her mind — a turning galaxy of memories under glass" />
      </div>

      {/* controls — a quiet hairline row, kept light so the bell stays the focus */}
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        {(["galaxy", "ink", "silk"] as Mode[]).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} style={pillStyle(mode === m, G)}>
            {m === "galaxy" ? "河 " : m === "ink" ? "墨 " : "丝 "}{m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
        <span style={{ width: 1, height: 10, background: G.hair, display: "inline-block", opacity: 0.5 }} />
        <button type="button" onClick={() => setSpin((s) => !s)} style={pillStyle(spin, G)}>Auto-spin</button>
        <form action={setKimiTheme.bind(null, nextTheme)} style={{ margin: 0, display: "inline-flex" }}>
          <button
            type="submit"
            aria-label={theme === "day" ? "switch to night" : "switch to day"}
            title={theme === "day" ? "夜" : "昼"}
            style={{ padding: "2px 4px", border: "none", cursor: "pointer", background: "transparent", color: G.mute, opacity: 0.6, display: "inline-flex", alignItems: "center" }}
          >
            {theme === "day" ? <MoonGlyph /> : <SunGlyph />}
          </button>
        </form>
      </div>

      <div style={{ textAlign: "center", marginTop: 8, color: G.mute, fontSize: 9, fontStyle: "italic", letterSpacing: 1, opacity: 0.7 }}>
        drag to turn · scroll to zoom · tap a star
      </div>

      <Legend G={G} T={T} />

      {selectedNode && (
        <NodeCard G={G} node={selectedNode} isDreamSurfaced={dreamSurfaced.has(selectedNode.id)} isDreamLinked={dreamLinked.has(selectedNode.id)} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

// hand-drawn gold-line crescent (残月 = brand signature) / sun — no emoji.
function MoonGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden style={{ display: "block" }}>
      <path d="M12.6 3.4A6.3 6.3 0 1 0 12.6 14.6 5 5 0 0 1 12.6 3.4Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}
function SunGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="9" cy="9" r="3.1" stroke="currentColor" strokeWidth="1.1" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1="9" y1="1.8" x2="9" y2="3.8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" transform={`rotate(${a} 9 9)`} />
      ))}
    </svg>
  );
}

// quiet text-link control — no filled chip, so the bar doesn't steal focus
// from the bell. Active = accent + hairline underline; inactive = dimmed.
function pillStyle(on: boolean, G: typeof GOTHIC): React.CSSProperties {
  return {
    padding: "2px 4px", border: "none", background: "transparent", cursor: "pointer",
    fontFamily: SCORE_FONT_BODY, fontStyle: "italic", fontSize: 11.5, whiteSpace: "nowrap",
    letterSpacing: 0.4, lineHeight: 1.2,
    color: on ? G.accent : G.mute, opacity: on ? 0.95 : 0.5,
    borderBottom: `1px solid ${on ? G.accent : "transparent"}`,
    transition: "color .2s ease, opacity .2s ease, border-color .2s ease",
  };
}

function Legend({ G, T }: { G: typeof GOTHIC; T: GraphTheme }) {
  const items: Array<{ label: string; color: string }> = [
    { label: "memory · valence", color: T.toward },
    { label: "entity · 金", color: T.gold },
    { label: "topic · 钴", color: T.cobalt },
    { label: "dream · 玫瑰", color: T.rose },
  ];
  return (
    <div style={{ margin: "12px 18px 0", display: "flex", flexWrap: "wrap", gap: "6px 16px", justifyContent: "center", fontFamily: SCORE_FONT_BODY, fontSize: 9, color: G.mute, fontStyle: "italic", letterSpacing: 1 }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: it.color, display: "inline-block" }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function NodeCard({ G, node, isDreamSurfaced, isDreamLinked, onClose }: {
  G: typeof GOTHIC; node: GraphNode; isDreamSurfaced: boolean; isDreamLinked: boolean; onClose: () => void;
}) {
  const dreamTag = isDreamSurfaced ? "✦ 昨夜浮现" : isDreamLinked ? "✦ 昨夜沿边走到" : null;
  return (
    <div style={{ margin: "16px 18px 36px", padding: "14px 16px", border: `0.5px solid ${G.hair}`, borderRadius: 6, background: G.paper, position: "relative" }}>
      <button type="button" onClick={onClose} aria-label="close detail" style={{ position: "absolute", top: 6, right: 8, background: "transparent", border: "none", color: G.mute, fontSize: 14, cursor: "pointer", opacity: 0.6, lineHeight: 1 }}>×</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", color: G.mute, fontSize: 9.5, letterSpacing: 2, fontFamily: SCORE_FONT_BODY }}>
        <span>{node.kind.toUpperCase()}{node.subtype ? ` · ${node.subtype}` : ""}</span>
        {dreamTag && <span style={{ fontStyle: "italic", color: G.rose1 }}>{dreamTag}</span>}
      </div>
      <div style={{ marginTop: 6, fontFamily: SCORE_FONT_BODY, fontStyle: "italic", fontSize: 14, lineHeight: 1.45, color: G.ink }}>{node.label}</div>
      <div style={{ marginTop: 6, fontSize: 8, color: G.mute, letterSpacing: 1, fontStyle: "italic" }}>
        weight {node.weight.toFixed(2)}{typeof node.valence === "number" && ` · valence ${node.valence >= 0 ? "+" : ""}${node.valence.toFixed(2)}`}
      </div>
    </div>
  );
}
