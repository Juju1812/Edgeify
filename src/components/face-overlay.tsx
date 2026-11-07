"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { DOT_INDICES, TRAIT_ANCHORS, type Pt } from "@/lib/client/face-mesh";
import { DEFAULT_OVERLAY_COLOR, TRAIT_KEYS, TRAIT_LABELS, type Traits } from "@/lib/shared/types";

/**
 * Live dots drawn over the (mirrored) camera preview. Reads landmarks from a
 * ref every animation frame, so React never re-renders per frame. The canvas
 * must be laid over a video using `object-cover`, so we replicate the crop.
 */
export function LiveFaceDots({
  landmarks,
  videoRef,
  color = DEFAULT_OVERLAY_COLOR
}: {
  landmarks: React.MutableRefObject<Pt[] | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  color?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = canvasRef.current;
      const v = videoRef.current;
      if (c && v && v.videoWidth) {
        const dpr = window.devicePixelRatio || 1;
        const w = c.clientWidth;
        const h = c.clientHeight;
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        }
        const ctx = c.getContext("2d")!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const pts = landmarks.current;
        if (pts) {
          // object-cover mapping from video space to element space
          const scale = Math.max(w / v.videoWidth, h / v.videoHeight);
          const dw = v.videoWidth * scale;
          const dh = v.videoHeight * scale;
          const ox = (w - dw) / 2;
          const oy = (h - dh) / 2;
          const r = Math.max(1.6, Math.min(w, h) / 230);
          ctx.fillStyle = color;
          ctx.shadowColor = "rgba(0,0,0,0.45)";
          ctx.shadowBlur = 3;
          for (const i of DOT_INDICES) {
            const p = pts[i];
            if (!p) continue;
            ctx.beginPath();
            ctx.arc(ox + p.x * dw, oy + p.y * dh, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [landmarks, videoRef, color]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}

/** Compact names so chips stay small on the photo. */
const SHORT_LABELS: Record<(typeof TRAIT_KEYS)[number], string> = {
  ...TRAIT_LABELS,
  structure: "Structure",
  jaw: "Jaw"
};

type Callout ={ key: (typeof TRAIT_KEYS)[number]; ax: number; ay: number; lx: number; ly: number; side: "left" | "right" };

/** Spread labels vertically so chips never overlap. */
function spread(items: Callout[], minGap: number, top: number, bottom: number) {
  items.sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < items.length; i++) {
    if (items[i].ly - items[i - 1].ly < minGap) items[i].ly = items[i - 1].ly + minGap;
  }
  const overflow = items.length ? items[items.length - 1].ly - bottom : 0;
  if (overflow > 0) items.forEach((it) => (it.ly -= overflow));
  for (let i = items.length - 2; i >= 0; i--) {
    if (items[i + 1].ly - items[i].ly < minGap) items[i].ly = items[i + 1].ly - minGap;
  }
  items.forEach((it) => (it.ly = Math.max(top, it.ly)));
}

/**
 * The result graphic: the scanned photo with white (or custom) dots on the
 * face, a leader line from each feature to its trait score, and the total
 * score at the top.
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
  const unit = Math.min(W, H) / 100; // scale everything to the image
  // Wide (landscape webcam) frames have room beside the face; tight or
  // portrait frames get slimmer chips pinned to the edges.
  const roomy = W / H > 1.2;
  const chipW = unit * (roomy ? 27 : 22.5);
  const chipH = unit * (roomy ? 7.6 : 6.6);
  const fs = unit * (roomy ? 3.5 : 3.1);

  let callouts: Callout[] = [];
  let faceTop = H * 0.12;
  if (points) {
    const xs = DOT_INDICES.map((i) => points[i]?.x ?? 0.5);
    const ys = DOT_INDICES.map((i) => points[i]?.y ?? 0.5);
    const minX = Math.min(...xs) * W;
    const maxX = Math.max(...xs) * W;
    faceTop = Math.min(...ys) * H;
    callouts = TRAIT_KEYS.map((key) => {
      const a = TRAIT_ANCHORS[key];
      const p = points[a.i] ?? { x: 0.5, y: 0.5 };
      const ax = p.x * W;
      const ay = p.y * H;
      const side = a.side;
      const edge = unit * 2.2;
      const lx = roomy
        ? side === "left"
          ? Math.max(edge, minX - unit * 7 - chipW)
          : Math.min(W - edge - chipW, maxX + unit * 7)
        : side === "left"
          ? edge
          : W - edge - chipW;
      return { key, ax, ay, lx, ly: ay - chipH / 2, side };
    });
    const gap = chipH + unit * 1.6;
    const top = unit * 16;
    const bottom = H - chipH - unit * 3;
    spread(callouts.filter((c) => c.side === "left"), gap, top, bottom);
    spread(callouts.filter((c) => c.side === "right"), gap, top, bottom);
  }

  const totalY = Math.max(unit * 3, Math.min(faceTop - unit * 17, unit * 6));

  return (
    <div className="relative w-full overflow-hidden rounded-[22px] bg-black">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Scan: ${overall} out of 100`}>
        <image href={image} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice" />
        {/* soft vignette so labels read on any background */}
        <defs>
          <radialGradient id="vig" cx="50%" cy="45%" r="75%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
          </radialGradient>
          <filter id="ds" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation={unit * 0.35} floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#vig)" />

        {points && (
          <g filter="url(#ds)">
            {DOT_INDICES.map((i, n) => {
              const p = points[i];
              if (!p) return null;
              return (
                <motion.circle
                  key={i}
                  cx={p.x * W}
                  cy={p.y * H}
                  r={unit * 0.62}
                  fill={color}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + n * 0.008, duration: 0.3 }}
                />
              );
            })}
          </g>
        )}

        {callouts.map((c, n) => {
          const chipX = c.lx;
          const chipY = c.ly;
          const endX = c.side === "left" ? chipX + chipW : chipX;
          const endY = chipY + chipH / 2;
          const elbowX = c.side === "left" ? endX + unit * 3 : endX - unit * 3;
          return (
            <motion.g
              key={c.key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75 + n * 0.09, duration: 0.4 }}
            >
              <polyline
                points={`${c.ax},${c.ay} ${elbowX},${endY} ${endX},${endY}`}
                fill="none"
                stroke={color}
                strokeWidth={unit * 0.28}
                strokeLinejoin="round"
                filter="url(#ds)"
              />
              <circle cx={c.ax} cy={c.ay} r={unit * 1.05} fill={color} filter="url(#ds)" />
              <rect x={chipX} y={chipY} width={chipW} height={chipH} rx={chipH / 2} fill="rgba(0,0,0,0.55)" />
              <rect
                x={chipX}
                y={chipY}
                width={chipW}
                height={chipH}
                rx={chipH / 2}
                fill="none"
                stroke={color}
                strokeOpacity="0.55"
                strokeWidth={unit * 0.2}
              />
              <text
                x={chipX + unit * 2.6}
                y={chipY + chipH / 2}
                dominantBaseline="central"
                fontSize={fs * 0.82}
                fontWeight={500}
                fill="#fff"
                fillOpacity="0.85"
                fontFamily="-apple-system, BlinkMacSystemFont, Inter, sans-serif"
              >
                {SHORT_LABELS[c.key]}
              </text>
              <text
                x={chipX + chipW - unit * 2.6}
                y={chipY + chipH / 2}
                dominantBaseline="central"
                textAnchor="end"
                fontSize={fs * 1.05}
                fontWeight={700}
                fill={color}
                fontFamily="-apple-system, BlinkMacSystemFont, Inter, sans-serif"
              >
                {traits[c.key]}
              </text>
            </motion.g>
          );
        })}

        {/* Total score, top centre */}
        <motion.g initial={{ opacity: 0, y: -unit * 2 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}>
          <rect x={W / 2 - unit * 13} y={totalY} width={unit * 26} height={unit * 13} rx={unit * 6.5} fill="rgba(0,0,0,0.55)" />
          <rect
            x={W / 2 - unit * 13}
            y={totalY}
            width={unit * 26}
            height={unit * 13}
            rx={unit * 6.5}
            fill="none"
            stroke={color}
            strokeOpacity="0.6"
            strokeWidth={unit * 0.25}
          />
          <text
            x={W / 2}
            y={totalY + unit * 6.5}
            dominantBaseline="central"
            textAnchor="middle"
            fontSize={unit * 8.4}
            fontWeight={800}
            fill={color}
            fontFamily="-apple-system, BlinkMacSystemFont, Inter, sans-serif"
            letterSpacing={-unit * 0.2}
          >
            {overall}
          </text>
        </motion.g>
      </svg>
    </div>
  );
}
