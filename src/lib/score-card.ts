/**
 * Renders a 1080x1920 vertical "EdgeScore card" PNG. Used as the
 * primary viral-share asset right after a first scan and from the
 * /profile share button. Stickerable on TikTok / Insta / X.
 *
 * No third-party image deps — pure canvas. Fonts fall back gracefully
 * if Inter isn't available.
 */

import {
  drawBackground,
  drawBrandWordmark,
  drawEdgeMark,
  drawFooterURL,
  roundRectPath,
  CYAN,
  CORAL,
  INK
} from "./ads-render";
import type { EdgeScoreBreakdown } from "./types";

const W = 1080;
const H = 1920;

type ScoreCardOpts = {
  username: string;
  faceDataUrl: string | null;
  edgeScore: EdgeScoreBreakdown;
  rankLabel: string;
  rankEmoji: string;
  rankColor: string;
  elo?: number;
};

export async function renderScoreCard(opts: ScoreCardOpts): Promise<Blob | null> {
  if (typeof window === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Pre-load face if present.
  const face = await loadImage(opts.faceDataUrl);

  drawBackground(ctx, W, H);

  // Top brand row
  drawEdgeMark(ctx, W * 0.5 - W * 0.085, H * 0.07, W * 0.045);
  drawBrandWordmark(ctx, W * 0.5 + W * 0.04, H * 0.07, W * 0.06, "left");

  // Hero face card centered, with composite score badge in the corner.
  const cardW = W * 0.66;
  const cardH = cardW * (4 / 3);
  const cardX = (W - cardW) / 2;
  const cardY = H * 0.13;

  ctx.save();
  roundRectPath(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fill();
  ctx.strokeStyle = opts.rankColor + "55";
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.clip();
  if (face) {
    // Mirror to match the live-match selfie convention.
    ctx.save();
    ctx.translate(cardX + cardW, cardY);
    ctx.scale(-1, 1);
    ctx.drawImage(face, 0, 0, cardW, cardH);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.font = `${Math.round(cardH * 0.35)}px sans-serif`;
    ctx.fillStyle = opts.rankColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.rankEmoji, cardX + cardW / 2, cardY + cardH / 2);
  }
  ctx.restore();

  // Composite score badge — pill in the top-right of the card.
  const badgeW = W * 0.30;
  const badgeH = W * 0.085;
  const badgeX = cardX + cardW - badgeW - 24;
  const badgeY = cardY + 24;
  ctx.save();
  roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  const grad = ctx.createLinearGradient(badgeX, 0, badgeX + badgeW, 0);
  grad.addColorStop(0, CYAN);
  grad.addColorStop(1, CORAL);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = `900 ${Math.round(badgeH * 0.55)}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    String(Math.round(opts.edgeScore.composite)),
    badgeX + badgeW / 2,
    badgeY + badgeH / 2 + 2
  );
  ctx.restore();

  // Username + rank below the card
  const usernameY = cardY + cardH + 80;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.round(W * 0.075)}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(opts.username.toUpperCase(), W / 2, usernameY);
  ctx.fillStyle = opts.rankColor;
  ctx.font = `700 ${Math.round(W * 0.04)}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.fillText(
    `${opts.rankEmoji} ${opts.rankLabel.toUpperCase()}${opts.elo ? ` · ${opts.elo} ELO` : ""}`,
    W / 2,
    usernameY + W * 0.06
  );
  ctx.restore();

  // Radar chart of the 6 metrics
  drawRadar(ctx, W / 2, H * 0.74, W * 0.30, opts.edgeScore);

  // Tagline
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `600 ${Math.round(W * 0.028)}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.fillText(
    "RANKED 1V1 FACE-OFFS · AI-SCORED",
    W / 2,
    H * 0.93
  );
  ctx.restore();

  drawFooterURL(ctx, W, H);

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
}

// ─── Helpers ───────────────────────────────────────────────────────

function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRadar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  s: EdgeScoreBreakdown
) {
  const axes: { key: keyof EdgeScoreBreakdown; label: string }[] = [
    { key: "symmetry", label: "SYM" },
    { key: "jawlineDefinition", label: "JAW" },
    { key: "cheekboneProm", label: "CHK" },
    { key: "goldenRatio", label: "PROP" },
    { key: "canthalTilt", label: "TILT" },
    { key: "faceFat", label: "LEAN" }
  ];

  const norm = (k: keyof EdgeScoreBreakdown, v: number) => {
    if (k === "canthalTilt") return Math.max(0, 1 - Math.abs(v - 0.4));
    if (k === "faceFat") return Math.max(0, 1 - v);
    return Math.max(0, Math.min(1, v));
  };

  function pt(i: number, frac: number) {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return { x: cx + Math.cos(a) * r * frac, y: cy + Math.sin(a) * r * frac };
  }

  // Background rings
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  for (const f of [0.25, 0.5, 0.75, 1]) {
    ctx.beginPath();
    for (let i = 0; i < axes.length; i++) {
      const p = pt(i, f);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  // Axis spokes
  for (let i = 0; i < axes.length; i++) {
    const p = pt(i, 1);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.restore();

  // Data polygon
  ctx.save();
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, "rgba(34,233,255,0.55)");
  grad.addColorStop(1, "rgba(255,93,143,0.40)");
  ctx.fillStyle = grad;
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 4;
  ctx.beginPath();
  axes.forEach((a, i) => {
    const v = norm(a.key, s[a.key] as number);
    const p = pt(i, v);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Data dots
  ctx.fillStyle = CORAL;
  axes.forEach((a, i) => {
    const v = norm(a.key, s[a.key] as number);
    const p = pt(i, v);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // Axis labels
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = `700 ${Math.round(r * 0.13)}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  axes.forEach((a, i) => {
    const p = pt(i, 1.18);
    ctx.fillText(a.label, p.x, p.y);
  });
  ctx.restore();
}
