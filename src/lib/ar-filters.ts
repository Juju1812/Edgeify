/**
 * Cosmetic AR filters drawn on top of the landmark overlay during a
 * live match. Pure canvas — no images. Each filter takes the 68-point
 * landmark array and the canvas dimensions and renders directly.
 *
 * Coordinates are in source-video pixel space (not mirrored). Caller
 * passes `mirror=true` to flip horizontally so the visible video
 * (CSS-mirrored) and overlay align.
 */

import type { Pt } from "./edge-score";
import type { ArFilterId } from "./types";

export const AR_FILTERS: Array<{ id: ArFilterId; label: string; emoji: string }> = [
  { id: "none", label: "No filter", emoji: "✨" },
  { id: "crown", label: "Crown", emoji: "👑" },
  { id: "mustache", label: "Mustache", emoji: "🥸" },
  { id: "shades", label: "Shades", emoji: "🕶️" },
  { id: "horns", label: "Horns", emoji: "😈" },
  { id: "halo", label: "Halo", emoji: "😇" }
];

export function drawArFilter(
  ctx: CanvasRenderingContext2D,
  filter: ArFilterId,
  points: Pt[],
  W: number,
  mirror: boolean
) {
  if (filter === "none") return;
  if (points.length !== 68) return;

  // Mirror x to match the CSS-mirrored video.
  const mx = (p: Pt) => ({ x: mirror ? W - p.x : p.x, y: p.y });

  switch (filter) {
    case "crown":
      drawCrown(ctx, points, mx);
      break;
    case "mustache":
      drawMustache(ctx, points, mx);
      break;
    case "shades":
      drawShades(ctx, points, mx);
      break;
    case "horns":
      drawHorns(ctx, points, mx);
      break;
    case "halo":
      drawHalo(ctx, points, mx);
      break;
  }
}

function drawCrown(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  mx: (p: Pt) => Pt
) {
  // Brow line: midpoint between left brow inner (24) and right brow inner (19),
  // then up by ~50% of inter-ocular distance.
  const browL = mx(points[19]);
  const browR = mx(points[24]);
  const cx = (browL.x + browR.x) / 2;
  const browY = (browL.y + browR.y) / 2;
  const browWidth = Math.hypot(browR.x - browL.x, browR.y - browL.y);
  const w = browWidth * 2.6;
  const h = w * 0.55;
  const top = browY - h * 1.05;

  ctx.save();
  ctx.fillStyle = "#fde047";
  ctx.strokeStyle = "#a16207";
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(253, 224, 71, 0.55)";
  ctx.shadowBlur = 14;
  // Crown body — three-peak silhouette.
  ctx.beginPath();
  const baseY = top + h;
  ctx.moveTo(cx - w / 2, baseY);
  ctx.lineTo(cx - w / 2, top + h * 0.55);
  ctx.lineTo(cx - w * 0.32, top + h * 0.05);
  ctx.lineTo(cx - w * 0.16, top + h * 0.55);
  ctx.lineTo(cx, top - h * 0.05);
  ctx.lineTo(cx + w * 0.16, top + h * 0.55);
  ctx.lineTo(cx + w * 0.32, top + h * 0.05);
  ctx.lineTo(cx + w / 2, top + h * 0.55);
  ctx.lineTo(cx + w / 2, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Gem dots
  ctx.fillStyle = "#f43f5e";
  ctx.shadowBlur = 0;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(cx + i * w * 0.32, top + h * 0.45, w * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMustache(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  mx: (p: Pt) => Pt
) {
  // Center the mustache on the philtrum (point 33 — nose tip is 30, but
  // 33 is the bottom of the nose, closer to the upper lip).
  const noseBase = mx(points[33]);
  const upperLip = mx(points[51]);
  const cy = (noseBase.y + upperLip.y) / 2;
  const cx = noseBase.x;
  // Width based on mouth corners (48 and 54).
  const mL = mx(points[48]);
  const mR = mx(points[54]);
  const mouthW = Math.hypot(mR.x - mL.x, mR.y - mL.y);
  const w = mouthW * 1.4;
  const h = mouthW * 0.4;

  ctx.save();
  ctx.fillStyle = "#1f2937";
  ctx.shadowColor = "#1f2937";
  ctx.shadowBlur = 6;
  // Two arcs forming the wings of a handlebar mustache.
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(
    cx - w * 0.1,
    cy - h * 0.5,
    cx - w * 0.5,
    cy - h * 0.5,
    cx - w / 2,
    cy + h * 0.5
  );
  ctx.bezierCurveTo(
    cx - w * 0.45,
    cy + h * 1.1,
    cx - w * 0.15,
    cy + h * 0.6,
    cx,
    cy + h * 0.3
  );
  ctx.bezierCurveTo(
    cx + w * 0.15,
    cy + h * 0.6,
    cx + w * 0.45,
    cy + h * 1.1,
    cx + w / 2,
    cy + h * 0.5
  );
  ctx.bezierCurveTo(
    cx + w * 0.5,
    cy - h * 0.5,
    cx + w * 0.1,
    cy - h * 0.5,
    cx,
    cy
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawShades(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  mx: (p: Pt) => Pt
) {
  // Two rectangles centered on each eye, joined by a bridge bar.
  const rEyeOuter = mx(points[36]);
  const rEyeInner = mx(points[39]);
  const lEyeInner = mx(points[42]);
  const lEyeOuter = mx(points[45]);

  function rect(o: Pt, i: Pt) {
    const cx = (o.x + i.x) / 2;
    const cy = (o.y + i.y) / 2;
    const w = Math.hypot(i.x - o.x, i.y - o.y) * 1.4;
    const h = w * 0.55;
    const angle = Math.atan2(i.y - o.y, i.x - o.x);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = "rgba(8, 8, 12, 0.92)";
    ctx.strokeStyle = "#22e9ff";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#22e9ff";
    ctx.shadowBlur = 8;
    const r = Math.min(w, h) * 0.18;
    roundRect(ctx, -w / 2, -h / 2, w, h, r);
    ctx.fill();
    ctx.stroke();
    // Cyan glint
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(34, 233, 255, 0.4)";
    ctx.beginPath();
    ctx.ellipse(-w * 0.18, -h * 0.18, w * 0.18, h * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  rect(rEyeOuter, rEyeInner);
  rect(lEyeInner, lEyeOuter);

  // Bridge bar
  ctx.save();
  ctx.strokeStyle = "#22e9ff";
  ctx.lineWidth = 4;
  ctx.shadowColor = "#22e9ff";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(rEyeInner.x, rEyeInner.y);
  ctx.lineTo(lEyeInner.x, lEyeInner.y);
  ctx.stroke();
  ctx.restore();
}

function drawHorns(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  mx: (p: Pt) => Pt
) {
  // Two horns above the temples (points 17 and 26).
  const browL = mx(points[19]);
  const browR = mx(points[24]);
  const browWidth = Math.hypot(browR.x - browL.x, browR.y - browL.y);
  const baseY = (browL.y + browR.y) / 2 - browWidth * 0.4;

  function horn(baseX: number, dir: number) {
    const tipX = baseX + dir * browWidth * 0.4;
    const tipY = baseY - browWidth * 1.0;
    const ctrlX = baseX + dir * browWidth * 0.5;
    const ctrlY = baseY - browWidth * 0.3;

    ctx.save();
    ctx.fillStyle = "#dc2626";
    ctx.strokeStyle = "#7f1d1d";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(220, 38, 38, 0.6)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(baseX - dir * browWidth * 0.18, baseY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
    ctx.quadraticCurveTo(
      baseX + dir * browWidth * 0.05,
      baseY - browWidth * 0.4,
      baseX + dir * browWidth * 0.18,
      baseY
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  horn(browL.x - browWidth * 0.4, -1);
  horn(browR.x + browWidth * 0.4, 1);
}

function drawHalo(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  mx: (p: Pt) => Pt
) {
  const browL = mx(points[19]);
  const browR = mx(points[24]);
  const cx = (browL.x + browR.x) / 2;
  const browWidth = Math.hypot(browR.x - browL.x, browR.y - browL.y);
  const cy = (browL.y + browR.y) / 2 - browWidth * 1.5;
  const rx = browWidth * 1.6;
  const ry = browWidth * 0.45;

  ctx.save();
  ctx.strokeStyle = "#fde047";
  ctx.lineWidth = 6;
  ctx.shadowColor = "#fde047";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Inner highlight
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = 2;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
