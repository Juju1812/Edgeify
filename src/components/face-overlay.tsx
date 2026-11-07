"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { DOT_INDICES, TRAIT_ANCHORS, type Pt } from "@/lib/client/face-mesh";
import { DEFAULT_OVERLAY_COLOR, TRAIT_KEYS, TRAIT_LABELS, type TraitKey, type Traits } from "@/lib/shared/types";

const FONT = "-apple-system, BlinkMacSystemFont, Inter, 'Segoe UI', sans-serif";

/** Compact names so chips stay small on the face. */
const SHORT_LABELS: Record<TraitKey, string> = { ...TRAIT_LABELS, structure: "Structure", jaw: "Jaw" };

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
  const chipW = unit * (roomy ? 27 : 23);
  const chipH = unit * (roomy ? 7.6 : 6.8);
  const fs = unit * (roomy ? 3.5 : 3.15);

  const xs = DOT_INDICES.map((i) => px[i]?.x ?? W / 2);
  const ys = DOT_INDICES.map((i) => px[i]?.y ?? H / 2);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const faceTop = Math.min(...ys);

  const totalW = unit * 30;
  const totalH = unit * 15;
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
      const px = norm.map((p) => ({ x: ox + p.x * dw, y: oy + p.y * dh }));

      const m = modeRef.current;
      const L = layoutOverlay(px, W, H);
      const u = L.unit;

      // Dots
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 3;
      const r = Math.max(1.6, u * 0.55);
      for (const i of DOT_INDICES) {
        const p = px[i];
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

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
      ctx.font = `500 ${L.fs * 0.82}px ${FONT}`;
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
          ctx.font = `500 ${L.fs * 0.82}px ${FONT}`;
          ctx.fillText(SHORT_LABELS[cl.key], cx + u * 2.6, cy + ch / 2);
          ctx.textAlign = "right";
          ctx.font = `700 ${L.fs * (1.05 + pop * 0.25)}px ${FONT}`;
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
      ctx.font = `600 ${u * 2.5}px ${FONT}`;
      ctx.fillText(overallLocked ? "OVERALL" : "READING…", W / 2, ty + th * 0.27);
      ctx.fillStyle = color;
      ctx.globalAlpha = tGrow * (overallLocked ? 1 : 0.55);
      ctx.font = `800 ${u * (7.6 + pop * 1.5)}px ${FONT}`;
      ctx.fillText(String(overallVal), W / 2, ty + th * 0.64);
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
  const px = points ? points.map((p) => ({ x: p.x * W, y: p.y * H })) : null;
  const L = px ? layoutOverlay(px, W, H) : null;
  const u = L?.unit ?? Math.min(W, H) / 100;
  const T = L?.total ?? { x: W / 2 - u * 15, y: u * 5, w: u * 30, h: u * 15 };

  return (
    <div className="relative w-full overflow-hidden rounded-[22px] bg-black">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Overall score ${overall} out of 100`}>
        <image href={image} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice" />
        <defs>
          <radialGradient id="vig" cx="50%" cy="45%" r="75%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
          </radialGradient>
          <filter id="ds" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation={u * 0.35} floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#vig)" />

        {px && (
          <g filter="url(#ds)">
            {DOT_INDICES.map((i, n) => {
              const p = px[i];
              if (!p) return null;
              return (
                <motion.circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={u * 0.62}
                  fill={color}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + n * 0.006, duration: 0.3 }}
                />
              );
            })}
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
              <text x={c.lx + u * 2.6} y={endY} dominantBaseline="central" fontSize={L.fs * 0.82} fontWeight={500} fill="#fff" fillOpacity="0.88" fontFamily={FONT}>
                {SHORT_LABELS[c.key]}
              </text>
              <text x={c.lx + L.chipW - u * 2.6} y={endY} dominantBaseline="central" textAnchor="end" fontSize={L.fs * 1.05} fontWeight={700} fill={color} fontFamily={FONT}>
                {traits[c.key]}
              </text>
            </motion.g>
          );
        })}

        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4 }}>
          <rect x={T.x} y={T.y} width={T.w} height={T.h} rx={T.h / 2} fill="rgba(0,0,0,0.6)" />
          <rect x={T.x} y={T.y} width={T.w} height={T.h} rx={T.h / 2} fill="none" stroke={color} strokeOpacity="0.85" strokeWidth={u * 0.28} />
          <text x={W / 2} y={T.y + T.h * 0.27} dominantBaseline="central" textAnchor="middle" fontSize={u * 2.5} fontWeight={600} fill="#fff" fillOpacity="0.8" fontFamily={FONT} letterSpacing={u * 0.15}>
            OVERALL
          </text>
          <text x={W / 2} y={T.y + T.h * 0.64} dominantBaseline="central" textAnchor="middle" fontSize={u * 7.6} fontWeight={800} fill={color} fontFamily={FONT}>
            {overall}
          </text>
        </motion.g>
      </svg>
    </div>
  );
}
