"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { DOT_INDICES, MESH_EDGES, TRAIT_ANCHORS, type Pt } from "@/lib/client/face-mesh";
import { DEFAULT_OVERLAY_COLOR, formatPsl, TRAIT_KEYS, TRAIT_LABELS, type TraitKey, type Traits } from "@/lib/shared/types";

const FONT = "-apple-system, BlinkMacSystemFont, Inter, 'Segoe UI', sans-serif";

/** Compact names so chips stay small on the face. */
const SHORT_LABELS: Record<TraitKey, string> = { ...TRAIT_LABELS, jaw: "Jaw" };

/** Chip text sizes relative to the layout's base font size. */
const LABEL_EM = 0.82;
const VALUE_EM = 1.05;

// ─── Shared layout ─────────────────────────────────────────────────────

type Callout = { key: TraitKey; ax: number; ay: number; lx: number; ly: number; side: "left" | "right" };

export type OverlayLayout = {
  unit: number;
  chipW: number;
  chipH: number;
  fs: number;
  callouts: Callout[];
  total: { x: number; y: number; w: number; h: number };
};

/** Spread labels vertically so chips never overlap. */
function spread(items: Callout[], gap: number, top: number, bottom: number) {
  items.sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < items.length; i++) if (items[i].ly - items[i - 1].ly < gap) items[i].ly = items[i - 1].ly + gap;
  const over = items.length ? items[items.length - 1].ly - bottom : 0;
  if (over > 0) items.forEach((it) => (it.ly -= over));
  for (let i = items.length - 2; i >= 0; i--) if (items[i + 1].ly - items[i].ly < gap) items[i].ly = items[i + 1].ly - gap;
  items.forEach((it) => (it.ly = Math.max(top, it.ly)));
}

/**
 * Where every chip, leader line and the overall pill go, given face points
 * in PIXEL coordinates of a W×H surface. Used by the live canvas and the
 * still SVG so both look identical.
 */
export function layoutOverlay(px: Pt[], W: number, H: number): OverlayLayout {
  const unit = Math.min(W, H) / 100;
  const roomy = W / H > 1.2;
  const chipH = unit * (roomy ? 7.6 : 6.6);
  const fs = unit * (roomy ? 3.5 : 2.75);
  // Size chips from the longest label so names never run into their number.
  // ~0.6em per character is a safe upper bound for the system UI font at
  // weight 500; two bold digits are ~0.64em each.
  const longest = Math.max(...TRAIT_KEYS.map((k) => SHORT_LABELS[k].length));
  const needed = unit * 2.6 * 2 + longest * 0.6 * fs * LABEL_EM + unit * 2 + 2 * 0.64 * fs * VALUE_EM;
  const chipW = Math.max(unit * (roomy ? 27 : 23), needed);

  const xs = DOT_INDICES.map((i) => px[i]?.x ?? W / 2);
  const ys = DOT_INDICES.map((i) => px[i]?.y ?? H / 2);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const faceTop = Math.min(...ys);

  const totalW = unit * 30;
  const totalH = unit * 18;
  const totalY = Math.max(unit * 2.5, Math.min(faceTop - totalH - unit * 3, unit * 5));

  const edge = unit * 2.2;
  const callouts: Callout[] = TRAIT_KEYS.map((key) => {
    const a = TRAIT_ANCHORS[key];
    const p = px[a.i] ?? { x: W / 2, y: H / 2 };
    const side = a.side;
    const lx = roomy
      ? side === "left"
        ? Math.max(edge, minX - unit * 7 - chipW)
        : Math.min(W - edge - chipW, maxX + unit * 7)
      : side === "left"
        ? edge
        : W - edge - chipW;
    return { key, ax: p.x, ay: p.y, lx, ly: p.y - chipH / 2, side };
  });
  const gap = chipH + unit * 1.6;
  const top = totalY + totalH + unit * 2;
  const bottom = H - chipH - unit * 3;
  spread(callouts.filter((c) => c.side === "left"), gap, top, bottom);
  spread(callouts.filter((c) => c.side === "right"), gap, top, bottom);

  return { unit, chipW, chipH, fs, callouts, total: { x: W / 2 - totalW / 2, y: totalY, w: totalW, h: totalH } };
}

// ─── 3D face mesh ──────────────────────────────────────────────────────
// The full 468-point mesh, shaded by MediaPipe's per-point depth: points
// nearer the camera are bigger and brighter, points curving away round the
// sides shrink and fade, and faint triangle edges show the surface — so the
// dots read as wrapped around the face instead of stuck on the screen.

const MESH_N = 468;
const LINE_BUCKETS = 4;

/** Per mesh point: 0 = nearest the camera (nose tip) … 1 = farthest (face edge). */
function depths(px: Pt[]): Float32Array {
  const n = Math.min(MESH_N, px.length);
  const t = new Float32Array(n);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const z = px[i].z;
    if (z === undefined) continue;
    if (z < lo) lo = z;
    if (z > hi) hi = z;
  }
  const span = hi - lo;
  for (let i = 0; i < n; i++) {
    const z = px[i].z;
    t[i] = z === undefined || !(span > 0) ? 0.35 : Math.pow((z - lo) / span, 0.85);
  }
  return t;
}
const dotScale = (t: number) => 1.3 - 0.75 * t;
const dotAlpha = (t: number) => 1 - 0.72 * t;
const lineAlpha = (t: number) => 0.34 - 0.28 * t;
const meshDotR = (u: number) => Math.max(1.1, u * 0.36);

/** Mesh edges grouped into depth buckets (so each bucket is one stroke). */
function edgeBuckets(t: Float32Array): number[][] {
  const out: number[][] = Array.from({ length: LINE_BUCKETS }, () => []);
  const e = MESH_EDGES;
  if (!e) return out;
  for (let k = 0; k < e.length; k += 2) {
    const a = e[k];
    const b = e[k + 1];
    if (a >= t.length || b >= t.length) continue;
    const d = (t[a] + t[b]) / 2;
    out[Math.min(LINE_BUCKETS - 1, Math.floor(d * LINE_BUCKETS))].push(a, b);
  }
  return out;
}

/**
 * Which mesh points get a dot. The raw mesh bunches up around the lips, eyes
 * and nostrils, so keep an evenly spaced subset (feature points first). It's
 * picked once from the first frame and then reused, so dots don't flicker.
 */
let dotSet: number[] | null = null;
function evenDots(px: Pt[]): number[] {
  if (dotSet) return dotSet;
  const fw = Math.hypot(px[454].x - px[234].x, px[454].y - px[234].y);
  const min2 = (fw * 0.043) ** 2;
  const order = [...DOT_INDICES, ...Array.from({ length: MESH_N }, (_, i) => i)];
  const kept: number[] = [];
  const seen = new Set<number>();
  for (const i of order) {
    if (seen.has(i)) continue;
    seen.add(i);
    const p = px[i];
    if (kept.every((j) => (px[j].x - p.x) ** 2 + (px[j].y - p.y) ** 2 >= min2)) kept.push(i);
  }
  if (fw > 0) dotSet = kept;
  return kept;
}

/** Dots drawn back-to-front so nearer ones sit on top. */
function backToFront(px: Pt[], t: Float32Array): number[] {
  return evenDots(px).slice().sort((a, b) => t[b] - t[a]);
}

/** A shaded "bead": soft dark halo, coloured core, highlight and rim — looks round on any colour. */
function makeDotSprite(color: string, size = 48): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const m = size / 2;
  const core = size * SPRITE_CORE;
  const halo = g.createRadialGradient(m, m, core * 0.6, m, m, m);
  halo.addColorStop(0, "rgba(0,0,0,0.45)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);
  g.beginPath();
  g.arc(m, m, core, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  const shade = g.createRadialGradient(m - core * 0.35, m - core * 0.4, 0, m, m, core);
  shade.addColorStop(0, "rgba(255,255,255,0.7)");
  shade.addColorStop(0.45, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.38)");
  g.fillStyle = shade;
  g.fill();
  return c;
}
const SPRITE_CORE = 0.25;

function drawMeshCanvas(ctx: CanvasRenderingContext2D, px: Pt[], u: number, color: string, sprite: HTMLCanvasElement) {
  const t = depths(px);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, u * 0.11);
  edgeBuckets(t).forEach((pairs, b) => {
    if (!pairs.length) return;
    ctx.beginPath();
    for (let k = 0; k < pairs.length; k += 2) {
      const a = px[pairs[k]];
      const c = px[pairs[k + 1]];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
    }
    ctx.globalAlpha = lineAlpha((b + 0.5) / LINE_BUCKETS);
    ctx.stroke();
  });
  const base = meshDotR(u);
  for (const i of backToFront(px, t)) {
    const p = px[i];
    const S = (base * dotScale(t[i])) / SPRITE_CORE;
    ctx.globalAlpha = dotAlpha(t[i]);
    ctx.drawImage(sprite, p.x - S / 2, p.y - S / 2, S, S);
  }
  ctx.restore();
}

// ─── Live canvas overlay ───────────────────────────────────────────────

export type LiveMode =
  | { k: "dots" }
  | { k: "reading" }
  | { k: "reveal"; traits: Traits; overall: number; startedAt: number };

/** ms between each trait locking in during the reveal. */
export const REVEAL_STEP = 320;
export const REVEAL_TOTAL_MS = REVEAL_STEP * (TRAIT_KEYS.length + 1) + 500;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Everything drawn over the live, mirrored camera preview: tracking dots,
 * and — while the AI reads the face — chips whose numbers spin, then lock in
 * one by one with the overall score last. Drawn on a canvas every frame so
 * it follows the face without React re-renders.
 */
export function LiveScanOverlay({
  landmarks,
  videoRef,
  color = DEFAULT_OVERLAY_COLOR,
  mode
}: {
  landmarks: React.MutableRefObject<Pt[] | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  color?: string;
  mode: LiveMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Smoothed chip positions so labels glide instead of jittering with the face.
  const smooth = useRef<Record<string, { x: number; y: number }>>({});
  const scramble = useRef<{ at: number; vals: Record<string, number> }>({ at: 0, vals: {} });
  const appearedAt = useRef<number | null>(null);
  const sprite = useRef<{ color: string; img: HTMLCanvasElement } | null>(null);

  useEffect(() => {
    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const c = canvasRef.current;
      const v = videoRef.current;
      if (!c || !v || !v.videoWidth) return;
      const dpr = window.devicePixelRatio || 1;
      const W = c.clientWidth;
      const H = c.clientHeight;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const norm = landmarks.current;
      if (!norm) return;

      // object-cover mapping, video space → element space
      const scale = Math.max(W / v.videoWidth, H / v.videoHeight);
      const dw = v.videoWidth * scale;
      const dh = v.videoHeight * scale;
      const ox = (W - dw) / 2;
      const oy = (H - dh) / 2;
      const px = norm.map((p) => ({ x: ox + p.x * dw, y: oy + p.y * dh, z: p.z }));

      const m = modeRef.current;
      const L = layoutOverlay(px, W, H);
      const u = L.unit;

      // 3D mesh of dots
      if (!sprite.current || sprite.current.color !== color) sprite.current = { color, img: makeDotSprite(color) };
      drawMeshCanvas(ctx, px, u, color, sprite.current.img);

      if (m.k === "dots") {
        appearedAt.current = null;
        return;
      }
      if (appearedAt.current === null) appearedAt.current = now;
      const since = now - appearedAt.current;

      // Re-roll the spinning numbers ~12×/s
      if (now - scramble.current.at > 85) {
        scramble.current = {
          at: now,
          vals: Object.fromEntries([...TRAIT_KEYS, "overall"].map((k) => [k, 35 + Math.floor(Math.random() * 60)]))
        };
      }

      ctx.save();
      ctx.font = `500 ${L.fs * LABEL_EM}px ${FONT}`;
      L.callouts.forEach((cl, n) => {
        // Chips grow out of their dot one after another.
        const grow = Math.min(1, Math.max(0, (since - n * 90) / 260));
        if (grow <= 0) return;
        const prev = smooth.current[cl.key];
        const tx = prev ? prev.x + (cl.lx - prev.x) * 0.25 : cl.lx;
        const ty = prev ? prev.y + (cl.ly - prev.y) * 0.25 : cl.ly;
        smooth.current[cl.key] = { x: tx, y: ty };

        let locked = false;
        let pop = 0;
        let value = scramble.current.vals[cl.key];
        if (m.k === "reveal") {
          const lockAt = m.startedAt + n * REVEAL_STEP;
          if (now >= lockAt) {
            locked = true;
            value = m.traits[cl.key];
            pop = Math.max(0, 1 - (now - lockAt) / 260);
          }
        }

        const cw = L.chipW;
        const ch = L.chipH * (1 + pop * 0.12);
        const cx = tx;
        const cy = ty - (ch - L.chipH) / 2;
        const endX = cl.side === "left" ? cx + cw : cx;
        const endY = ty + L.chipH / 2;
        const elbowX = cl.side === "left" ? endX + u * 3 : endX - u * 3;

        ctx.globalAlpha = grow;
        // leader line from the dot
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, u * 0.28);
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.moveTo(cl.ax, cl.ay);
        ctx.lineTo(cl.ax + (elbowX - cl.ax) * grow, cl.ay + (endY - cl.ay) * grow);
        if (grow >= 1) ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cl.ax, cl.ay, Math.max(2.4, u * 1.0), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (grow >= 1) {
          roundRect(ctx, cx, cy, cw, ch, ch / 2);
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.globalAlpha = locked ? 0.75 : 0.4;
          ctx.lineWidth = Math.max(1, u * 0.22);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          // Measure the real text: shrink the label if it would touch the number.
          ctx.font = `700 ${L.fs * VALUE_EM}px ${FONT}`;
          const valueW = ctx.measureText("88").width;
          const room = cw - u * 2.6 * 2 - valueW - u * 1.4;
          let labelPx = L.fs * LABEL_EM;
          ctx.font = `500 ${labelPx}px ${FONT}`;
          const lw = ctx.measureText(SHORT_LABELS[cl.key]).width;
          if (lw > room) {
            labelPx *= room / lw;
            ctx.font = `500 ${labelPx}px ${FONT}`;
          }
          ctx.fillText(SHORT_LABELS[cl.key], cx + u * 2.6, cy + ch / 2);
          ctx.textAlign = "right";
          ctx.font = `700 ${L.fs * (VALUE_EM + pop * 0.25)}px ${FONT}`;
          ctx.fillStyle = color;
          ctx.globalAlpha = locked ? 1 : 0.5;
          ctx.fillText(String(value), cx + cw - u * 2.6, cy + ch / 2);
          ctx.globalAlpha = 1;
        }
      });

      // Overall pill, top centre — spins until everything else has locked.
      const T = L.total;
      let overallLocked = false;
      let overallVal = scramble.current.vals.overall;
      let pop = 0;
      if (m.k === "reveal") {
        const lockAt = m.startedAt + TRAIT_KEYS.length * REVEAL_STEP + 150;
        if (now >= lockAt) {
          overallLocked = true;
          overallVal = m.overall;
          pop = Math.max(0, 1 - (now - lockAt) / 400);
        }
      }
      const tGrow = Math.min(1, since / 300);
      ctx.globalAlpha = tGrow;
      const tw = T.w * (1 + pop * 0.15);
      const th = T.h * (1 + pop * 0.15);
      const tx = W / 2 - tw / 2;
      const ty = T.y - (th - T.h) / 2;
      roundRect(ctx, tx, ty, tw, th, th / 2);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, u * 0.28);
      ctx.globalAlpha = tGrow * (overallLocked ? 0.85 : 0.45);
      ctx.stroke();
      ctx.globalAlpha = tGrow;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = `600 ${u * 2.4}px ${FONT}`;
      ctx.fillText(overallLocked ? "OVERALL" : "READING…", W / 2, ty + th * 0.2);
      ctx.fillStyle = color;
      ctx.globalAlpha = tGrow * (overallLocked ? 1 : 0.55);
      ctx.font = `800 ${u * (7.2 + pop * 1.5)}px ${FONT}`;
      ctx.fillText(String(overallVal), W / 2, ty + th * 0.52);
      ctx.globalAlpha = tGrow * (overallLocked ? 0.9 : 0.4);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `600 ${u * 2.4}px ${FONT}`;
      ctx.fillText(overallLocked ? formatPsl(overallVal) : "PSL –", W / 2, ty + th * 0.83);
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [landmarks, videoRef, color]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}

// ─── Still result graphic ──────────────────────────────────────────────

/**
 * The scanned photo with dots on the face, a leader line from each feature
 * to its trait score, and the overall score at the top.
 */
export function ScanOverlay({
  image,
  width,
  height,
  points,
  traits,
  overall,
  color = DEFAULT_OVERLAY_COLOR
}: {
  image: string;
  width: number;
  height: number;
  points: Pt[] | null;
  traits: Traits;
  overall: number;
  color?: string;
}) {
  const W = width;
  const H = height;
  const px = points ? points.map((p) => ({ x: p.x * W, y: p.y * H, z: p.z })) : null;
  const L = px ? layoutOverlay(px, W, H) : null;
  const u = L?.unit ?? Math.min(W, H) / 100;
  const T = L?.total ?? { x: W / 2 - u * 15, y: u * 5, w: u * 30, h: u * 18 };
  const mesh = px && px.length >= MESH_N ? stillMesh(px, u) : null;

  return (
    <div className="relative w-full overflow-hidden rounded-[22px] bg-black">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Overall score ${overall}, ${formatPsl(overall)}`}>
        <image href={image} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice" />
        <defs>
          <radialGradient id="vig" cx="50%" cy="45%" r="75%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
          </radialGradient>
          <radialGradient id="bead" cx="38%" cy="34%" r="66%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
            <stop offset="45%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.38" />
          </radialGradient>
          <filter id="ds" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation={u * 0.35} floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#vig)" />

        {mesh && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.5 }}>
            {mesh.lines.map((d, n) =>
              d ? (
                <path key={n} d={d} fill="none" stroke={color} strokeWidth={Math.max(0.5, u * 0.11)} strokeOpacity={lineAlpha((n + 0.5) / LINE_BUCKETS)} />
              ) : null
            )}
            <g filter="url(#ds)">
              {mesh.dots.map(({ x, y, r, a }, n) => (
                <g key={n} opacity={a}>
                  <circle cx={x} cy={y} r={r} fill={color} />
                  <circle cx={x} cy={y} r={r} fill="url(#bead)" />
                </g>
              ))}
            </g>
          </motion.g>
        )}
        {px && !mesh && (
          <g filter="url(#ds)">
            {DOT_INDICES.map((i) => (px[i] ? <circle key={i} cx={px[i].x} cy={px[i].y} r={u * 0.62} fill={color} /> : null))}
          </g>
        )}

        {L?.callouts.map((c, n) => {
          const endX = c.side === "left" ? c.lx + L.chipW : c.lx;
          const endY = c.ly + L.chipH / 2;
          const elbowX = c.side === "left" ? endX + u * 3 : endX - u * 3;
          return (
            <motion.g key={c.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + n * 0.06, duration: 0.35 }}>
              <polyline
                points={`${c.ax},${c.ay} ${elbowX},${endY} ${endX},${endY}`}
                fill="none"
                stroke={color}
                strokeWidth={u * 0.28}
                strokeLinejoin="round"
                filter="url(#ds)"
              />
              <circle cx={c.ax} cy={c.ay} r={u * 1.0} fill={color} filter="url(#ds)" />
              <rect x={c.lx} y={c.ly} width={L.chipW} height={L.chipH} rx={L.chipH / 2} fill="rgba(0,0,0,0.55)" />
              <rect x={c.lx} y={c.ly} width={L.chipW} height={L.chipH} rx={L.chipH / 2} fill="none" stroke={color} strokeOpacity="0.7" strokeWidth={u * 0.22} />
              <text x={c.lx + u * 2.6} y={endY} dominantBaseline="central" fontSize={L.fs * LABEL_EM} fontWeight={500} fill="#fff" fillOpacity="0.88" fontFamily={FONT}>
                {SHORT_LABELS[c.key]}
              </text>
              <text x={c.lx + L.chipW - u * 2.6} y={endY} dominantBaseline="central" textAnchor="end" fontSize={L.fs * VALUE_EM} fontWeight={700} fill={color} fontFamily={FONT}>
                {traits[c.key]}
              </text>
            </motion.g>
          );
        })}

        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4 }}>
          <rect x={T.x} y={T.y} width={T.w} height={T.h} rx={T.h / 2} fill="rgba(0,0,0,0.6)" />
          <rect x={T.x} y={T.y} width={T.w} height={T.h} rx={T.h / 2} fill="none" stroke={color} strokeOpacity="0.85" strokeWidth={u * 0.28} />
          <text x={W / 2} y={T.y + T.h * 0.2} dominantBaseline="central" textAnchor="middle" fontSize={u * 2.4} fontWeight={600} fill="#fff" fillOpacity="0.8" fontFamily={FONT} letterSpacing={u * 0.15}>
            OVERALL
          </text>
          <text x={W / 2} y={T.y + T.h * 0.52} dominantBaseline="central" textAnchor="middle" fontSize={u * 7.2} fontWeight={800} fill={color} fontFamily={FONT}>
            {overall}
          </text>
          <text x={W / 2} y={T.y + T.h * 0.83} dominantBaseline="central" textAnchor="middle" fontSize={u * 2.4} fontWeight={600} fill="#fff" fillOpacity="0.9" fontFamily={FONT}>
            {formatPsl(overall)}
          </text>
        </motion.g>
      </svg>
    </div>
  );
}

/** Paths and dot list for the still SVG version of the 3D mesh. */
function stillMesh(px: Pt[], u: number) {
  const t = depths(px);
  const f = (n: number) => n.toFixed(1);
  const lines = edgeBuckets(t).map((pairs) => {
    let d = "";
    for (let k = 0; k < pairs.length; k += 2) {
      const a = px[pairs[k]];
      const c = px[pairs[k + 1]];
      d += "M" + f(a.x) + " " + f(a.y) + "L" + f(c.x) + " " + f(c.y);
    }
    return d;
  });
  const base = meshDotR(u);
  const dots = backToFront(px, t).map((i) => ({ x: px[i].x, y: px[i].y, r: base * dotScale(t[i]), a: dotAlpha(t[i]) }));
  return { lines, dots };
}
