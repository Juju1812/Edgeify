/**
 * Animated video ad templates. Each template provides a per-frame
 * renderer keyed off elapsed-ms `t`. Used both for live canvas preview
 * (raf loop) and for recording (canvas → MediaRecorder → webm blob).
 *
 * Output is 1080x1920 webm at 30fps. TikTok and Instagram both accept
 * webm uploads and transcode to their native format server-side.
 */

import {
  CORAL,
  CYAN,
  drawBackground,
  drawBrandWordmark,
  drawEdgeMark,
  drawFooterURL,
  INK,
  roundRectPath
} from "./ads-render";

// ─── Easing helpers ────────────────────────────────────────────────

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// Returns 0..1 for the given ms within [start, end]; 0 before, 1 after.
const window01 = (t: number, start: number, end: number) => {
  if (t <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
};

// ─── Template 1: HOOK PUNCH ────────────────────────────────────────
// 5s. Brand mark slides in, big hook reveals word-by-word, sub
// tagline + CTA chip pulse. Cyan→coral gradient sweep across hook.
function drawHookPunch(
  ctx: CanvasRenderingContext2D,
  t: number,
  w: number,
  h: number,
  hook: string
) {
  drawBackground(ctx, w, h);

  // Brand row slides down (0-700ms)
  const brandT = easeOut(window01(t, 0, 700));
  ctx.save();
  ctx.globalAlpha = brandT;
  ctx.translate(0, -40 * (1 - brandT));
  drawEdgeMark(ctx, w * 0.5 - w * 0.08, h * 0.10, w * 0.045);
  drawBrandWordmark(ctx, w * 0.5 + w * 0.04, h * 0.10, w * 0.06, "left");
  ctx.restore();

  // Hook reveals word-by-word (700ms - 2300ms)
  const hookSize = Math.round(w * 0.13);
  ctx.font = `900 ${hookSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const upper = hook.toUpperCase();
  const lines = wrapLines(ctx, upper, w * 0.85);
  const lineHeight = hookSize * 1.0;
  const totalH = lines.length * lineHeight;
  const startY = h * 0.5 - totalH / 2 + lineHeight / 2;

  // Total chars across all lines
  const totalChars = lines.reduce((s, l) => s + l.length, 0);
  const revealT = window01(t, 700, 2300);
  const visibleChars = Math.floor(totalChars * easeOut(revealT));

  let charsConsumed = 0;
  lines.forEach((line, i) => {
    const lineLen = line.length;
    const remaining = visibleChars - charsConsumed;
    const showLen = Math.max(0, Math.min(lineLen, remaining));
    if (showLen <= 0) {
      charsConsumed += lineLen;
      return;
    }
    const visiblePart = line.slice(0, showLen);
    const isLastLine = i === lines.length - 1;

    ctx.save();
    if (isLastLine && showLen === lineLen) {
      // Sweep gradient across the last line once it's fully revealed.
      const sweepT = window01(t, 2200, 4000);
      const m = ctx.measureText(line);
      const lx = w / 2 - m.width / 2;
      const grad = ctx.createLinearGradient(lx, 0, lx + m.width, 0);
      const phase = sweepT;
      grad.addColorStop(Math.max(0, phase - 0.3), CYAN);
      grad.addColorStop(phase, "#ffffff");
      grad.addColorStop(Math.min(1, phase + 0.3), CORAL);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.fillText(visiblePart, w / 2, startY + i * lineHeight);
    ctx.restore();
    charsConsumed += lineLen;
  });

  // Sub tagline (2400ms+)
  const subA = easeOut(window01(t, 2400, 3000));
  ctx.save();
  ctx.globalAlpha = subA;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = `500 ${Math.round(w * 0.032)}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.fillText(
    "RANKED 1V1 · AI-SCORED · LIVE OPPONENTS",
    w / 2,
    h * 0.78 - 20 * (1 - subA)
  );
  ctx.restore();

  // CTA pill bouncing in (3300ms+)
  const ctaT = easeOutBack(window01(t, 3300, 4100));
  if (ctaT > 0) {
    const pillW = w * 0.42;
    const pillH = w * 0.085;
    const pillX = w / 2 - pillW / 2;
    const pillY = h * 0.85;
    ctx.save();
    ctx.globalAlpha = Math.min(1, ctaT);
    ctx.translate(0, 30 * (1 - ctaT));
    const cg = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
    cg.addColorStop(0, CYAN);
    cg.addColorStop(1, CORAL);
    ctx.fillStyle = cg;
    roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `900 ${Math.round(pillH * 0.46)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EDGIFY.APP →", w / 2, pillY + pillH / 2);
    ctx.restore();
  }
}

// ─── Template 2: RANK CLIMB ────────────────────────────────────────
// 6s. Headline → ladder cascades up from sub3 to true adam → arrow
// climbs through tiers → CTA.
function drawRankClimb(
  ctx: CanvasRenderingContext2D,
  t: number,
  w: number,
  h: number
) {
  drawBackground(ctx, w, h);

  // Headline (0-800ms)
  const hT = easeOut(window01(t, 0, 800));
  ctx.save();
  ctx.globalAlpha = hT;
  ctx.translate(0, -40 * (1 - hT));
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.round(w * 0.085)}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("HOW HIGH", w / 2, h * 0.18);
  // Gradient tail
  const tail = "DO YOU CLIMB?";
  const m = ctx.measureText(tail);
  const grad = ctx.createLinearGradient(
    w / 2 - m.width / 2,
    0,
    w / 2 + m.width / 2,
    0
  );
  grad.addColorStop(0, CYAN);
  grad.addColorStop(1, CORAL);
  ctx.fillStyle = grad;
  ctx.fillText(tail, w / 2, h * 0.27);
  ctx.restore();

  // Tier ladder (cascades 800ms-3300ms, 250ms per tier)
  const ranks = [
    { emoji: "🥀", label: "SUB3", color: "#6b7280" },
    { emoji: "🍂", label: "SUB5", color: "#a16207" },
    { emoji: "💧", label: "LTN", color: "#0891b2" },
    { emoji: "⚖️", label: "MTN", color: "#22d3ee" },
    { emoji: "🔥", label: "HTN", color: "#a855f7" },
    { emoji: "💪", label: "CHAD", color: "#f43f5e" },
    { emoji: "👑", label: "TRUE ADAM", color: "#fde047" }
  ];
  const ladderTop = h * 0.35;
  const rowH = h * 0.07;
  ranks.forEach((r, i) => {
    const start = 800 + i * 250;
    const a = easeOut(window01(t, start, start + 600));
    if (a <= 0) return;
    const x = w * 0.18 - 80 * (1 - a);
    const y = ladderTop + i * rowH;
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    // Emoji
    ctx.font = `${Math.round(w * 0.045)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(r.emoji, x, y);
    // Label
    ctx.font = `700 ${Math.round(w * 0.035)}px ui-monospace, "JetBrains Mono", monospace`;
    ctx.fillStyle = r.color;
    ctx.fillText(r.label, x + w * 0.10, y);
    ctx.restore();
  });

  // Glowing arrow climbs from bottom tier to top (3500ms-5200ms)
  const climbT = easeInOut(window01(t, 3500, 5200));
  if (climbT > 0) {
    const startY = ladderTop + (ranks.length - 1) * rowH;
    const endY = ladderTop;
    const ay = startY + (endY - startY) * climbT;
    const ax = w * 0.74;
    ctx.save();
    ctx.fillStyle = "#22e9ff";
    ctx.shadowColor = "#22e9ff";
    ctx.shadowBlur = 30;
    // Arrow up
    ctx.beginPath();
    ctx.moveTo(ax, ay - w * 0.04);
    ctx.lineTo(ax + w * 0.025, ay + w * 0.01);
    ctx.lineTo(ax + w * 0.012, ay + w * 0.01);
    ctx.lineTo(ax + w * 0.012, ay + w * 0.04);
    ctx.lineTo(ax - w * 0.012, ay + w * 0.04);
    ctx.lineTo(ax - w * 0.012, ay + w * 0.01);
    ctx.lineTo(ax - w * 0.025, ay + w * 0.01);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // CTA (5300ms+)
  const ctaT = easeOutBack(window01(t, 5300, 5900));
  if (ctaT > 0) {
    const pillW = w * 0.46;
    const pillH = w * 0.085;
    const pillX = w / 2 - pillW / 2;
    const pillY = h * 0.86;
    ctx.save();
    ctx.globalAlpha = Math.min(1, ctaT);
    ctx.translate(0, 30 * (1 - ctaT));
    const cg = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
    cg.addColorStop(0, CYAN);
    cg.addColorStop(1, CORAL);
    ctx.fillStyle = cg;
    roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `900 ${Math.round(pillH * 0.45)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("FIND OUT  →", w / 2, pillY + pillH / 2);
    ctx.restore();
  }
}

// ─── Template 3: BRAND STINGER ─────────────────────────────────────
// 4s. Hex mark draws itself, wordmark types in, sub-tagline pops, edgify.app fades.
function drawBrandStinger(
  ctx: CanvasRenderingContext2D,
  t: number,
  w: number,
  h: number
) {
  drawBackground(ctx, w, h);

  // EdgeMark draws itself (0-700ms)
  const markT = easeOut(window01(t, 0, 700));
  if (markT > 0) {
    ctx.save();
    ctx.globalAlpha = markT;
    drawEdgeMark(ctx, w / 2, h * 0.30, w * 0.10 * markT);
    ctx.restore();
  }

  // Wordmark "types" in letter by letter (700-1700ms)
  const wmT = window01(t, 700, 1700);
  const word = "EDGIFY";
  const visible = Math.floor(word.length * easeOut(wmT));
  if (visible > 0) {
    const partial = word.slice(0, visible);
    ctx.save();
    ctx.font = `900 ${Math.round(w * 0.20)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const m = ctx.measureText(word);
    const x = w / 2;
    const y = h * 0.50;
    const grad = ctx.createLinearGradient(x - m.width / 2, 0, x + m.width / 2, 0);
    grad.addColorStop(0, CYAN);
    grad.addColorStop(0.5, "#b9f8ff");
    grad.addColorStop(1, CORAL);
    ctx.fillStyle = grad;
    ctx.fillText(partial, x, y);
    // Type cursor
    if (wmT < 1) {
      const partialW = ctx.measureText(partial).width;
      ctx.fillStyle = CYAN;
      ctx.fillRect(
        x - m.width / 2 + partialW + 8,
        y - h * 0.06,
        w * 0.012,
        h * 0.12
      );
    }
    ctx.restore();
  }

  // Subhead pops in (1800ms+)
  const sT = easeOutBack(window01(t, 1800, 2400));
  if (sT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, sT);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `700 ${Math.round(w * 0.035)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("RANKED 1V1 FACE-OFFS", w / 2, h * 0.62);
    ctx.restore();
  }

  // PLAY pulse (2700ms+)
  const pT = window01(t, 2700, 3400);
  if (pT > 0) {
    const pulse = 1 + 0.06 * Math.sin(t * 0.012);
    const pillW = w * 0.42 * pulse;
    const pillH = w * 0.085;
    const pillX = w / 2 - pillW / 2;
    const pillY = h * 0.74;
    ctx.save();
    ctx.globalAlpha = easeOut(pT);
    const cg = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
    cg.addColorStop(0, CYAN);
    cg.addColorStop(1, CORAL);
    ctx.fillStyle = cg;
    roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `900 ${Math.round(pillH * 0.48)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PLAY  →", w / 2, pillY + pillH / 2);
    ctx.restore();
  }

  // URL fades in (3400ms+)
  const uT = window01(t, 3400, 4000);
  if (uT > 0) {
    ctx.save();
    ctx.globalAlpha = uT;
    drawFooterURL(ctx, w, h);
    ctx.restore();
  }
}

// ─── Template 4: FEATURE CASCADE ───────────────────────────────────
// 6s. 4 feature chips slide in one at a time, then a final CTA.
function drawFeatureCascade(
  ctx: CanvasRenderingContext2D,
  t: number,
  w: number,
  h: number
) {
  drawBackground(ctx, w, h);

  // Headline
  const hT = easeOut(window01(t, 0, 700));
  ctx.save();
  ctx.globalAlpha = hT;
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.round(w * 0.075)}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("BUILT FOR", w / 2, h * 0.16);
  const tail = "MOGGING.";
  const m = ctx.measureText(tail);
  const grad = ctx.createLinearGradient(
    w / 2 - m.width / 2,
    0,
    w / 2 + m.width / 2,
    0
  );
  grad.addColorStop(0, CYAN);
  grad.addColorStop(1, CORAL);
  ctx.fillStyle = grad;
  ctx.fillText(tail, w / 2, h * 0.24);
  ctx.restore();

  // Feature rows cascade
  const features = [
    { c: "AR", label: "Real-time face tracking" },
    { c: "1V1", label: "Live opponents · no bots" },
    { c: "ELO", label: "Ranked ladder · seasons" },
    { c: "AI", label: "Claude vision analysis" }
  ];
  const startTimes = [800, 1700, 2600, 3500];
  const rowTopY = h * 0.36;
  const rowH = h * 0.10;
  features.forEach((f, i) => {
    const a = easeOut(window01(t, startTimes[i], startTimes[i] + 700));
    if (a <= 0) return;
    const x = w * 0.08 - 60 * (1 - a);
    const y = rowTopY + i * rowH;
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    // Chip
    const chipSize = w * 0.085;
    const cg = ctx.createLinearGradient(
      x,
      y - chipSize / 2,
      x + chipSize,
      y + chipSize / 2
    );
    cg.addColorStop(0, CYAN);
    cg.addColorStop(1, CORAL);
    ctx.fillStyle = cg;
    roundRectPath(ctx, x, y - chipSize / 2, chipSize, chipSize, chipSize * 0.18);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `900 ${Math.round(chipSize * 0.45)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(f.c, x + chipSize / 2, y);
    // Label
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `600 ${Math.round(w * 0.035)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(f.label, x + chipSize + w * 0.03, y);
    ctx.restore();
  });

  // Big CTA at end
  const ctaT = easeOutBack(window01(t, 4600, 5400));
  if (ctaT > 0) {
    const pillW = w * 0.50;
    const pillH = w * 0.085;
    const pillX = w / 2 - pillW / 2;
    const pillY = h * 0.86;
    ctx.save();
    ctx.globalAlpha = Math.min(1, ctaT);
    ctx.translate(0, 40 * (1 - ctaT));
    const cg = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
    cg.addColorStop(0, CYAN);
    cg.addColorStop(1, CORAL);
    ctx.fillStyle = cg;
    roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `900 ${Math.round(pillH * 0.45)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EDGIFY.APP  →", w / 2, pillY + pillH / 2);
    ctx.restore();
  }
}

// ─── Template 5: COMPARISON SLAM ───────────────────────────────────
// 6s. "OTHERS:" with ✗ rows tinted red, then flips to "EDGIFY:" with ✓ green rows, CTA.
function drawComparisonSlam(
  ctx: CanvasRenderingContext2D,
  t: number,
  w: number,
  h: number
) {
  drawBackground(ctx, w, h);

  const rows = [
    { e: "Live opponents", o: "Bots / nothing" },
    { e: "AI scoring", o: "Vague vibes" },
    { e: "ELO ladder", o: "No ranking" },
    { e: "Free + instant", o: "Paywall" }
  ];

  // Phase 1: "OTHER FACE APPS:" + bad rows (0 - 2700ms)
  const phase1Out = easeInOut(window01(t, 2700, 3300));
  const phase1Alpha = 1 - phase1Out;

  // Phase 2: "EDGIFY DOES IT:" + good rows (3300ms onward)
  const phase2In = easeInOut(window01(t, 3300, 3900));

  // Phase 1 rendering
  if (phase1Alpha > 0) {
    ctx.save();
    ctx.globalAlpha = phase1Alpha;
    ctx.fillStyle = "rgba(255,93,143,0.85)";
    ctx.font = `900 ${Math.round(w * 0.075)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("OTHER APPS:", w / 2, h * 0.20);

    rows.forEach((r, i) => {
      const start = 500 + i * 400;
      const a = easeOut(window01(t, start, start + 500));
      if (a <= 0) return;
      const y = h * 0.34 + i * h * 0.10;
      ctx.save();
      ctx.globalAlpha = phase1Alpha * Math.min(1, a);
      ctx.translate(-60 * (1 - a), 0);
      ctx.fillStyle = "rgba(255,93,143,0.85)";
      ctx.font = `700 ${Math.round(w * 0.045)}px Inter, ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✗  " + r.o, w / 2, y);
      ctx.restore();
    });
    ctx.restore();
  }

  // Phase 2 rendering
  if (phase2In > 0) {
    ctx.save();
    ctx.globalAlpha = phase2In;
    ctx.fillStyle = "rgba(34,233,255,0.92)";
    ctx.font = `900 ${Math.round(w * 0.075)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("EDGIFY DOES IT:", w / 2, h * 0.20);

    rows.forEach((r, i) => {
      const start = 3700 + i * 350;
      const a = easeOut(window01(t, start, start + 500));
      if (a <= 0) return;
      const y = h * 0.34 + i * h * 0.10;
      ctx.save();
      ctx.globalAlpha = phase2In * Math.min(1, a);
      ctx.translate(60 * (1 - a), 0);
      ctx.fillStyle = "rgba(52,211,153,0.95)";
      ctx.font = `700 ${Math.round(w * 0.045)}px Inter, ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✓  " + r.e, w / 2, y);
      ctx.restore();
    });
    ctx.restore();
  }

  // Final CTA
  const ctaT = easeOutBack(window01(t, 5400, 5900));
  if (ctaT > 0) {
    const pillW = w * 0.50;
    const pillH = w * 0.085;
    const pillX = w / 2 - pillW / 2;
    const pillY = h * 0.86;
    ctx.save();
    ctx.globalAlpha = Math.min(1, ctaT);
    ctx.translate(0, 40 * (1 - ctaT));
    const cg = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
    cg.addColorStop(0, CYAN);
    cg.addColorStop(1, CORAL);
    ctx.fillStyle = cg;
    roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `900 ${Math.round(pillH * 0.45)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EDGIFY.APP  →", w / 2, pillY + pillH / 2);
    ctx.restore();
  }
}

// ─── Word-wrap helper (local copy, sized for these templates) ─────
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ─── Public API ────────────────────────────────────────────────────

export type VideoAdId =
  | "hook-punch"
  | "rank-climb"
  | "brand-stinger"
  | "feature-cascade"
  | "comparison-slam";

export type VideoAdTemplate = {
  id: VideoAdId;
  label: string;
  width: number;
  height: number;
  durationMs: number;
  hint: string;
  acceptsHook: boolean;
};

export const VIDEO_TEMPLATES: VideoAdTemplate[] = [
  {
    id: "hook-punch",
    label: "Hook punch · 5s",
    width: 1080,
    height: 1920,
    durationMs: 5000,
    hint: "TikTok / Reels · 9:16",
    acceptsHook: true
  },
  {
    id: "rank-climb",
    label: "Rank climb · 6s",
    width: 1080,
    height: 1920,
    durationMs: 6000,
    hint: "TikTok / Reels · 9:16",
    acceptsHook: false
  },
  {
    id: "brand-stinger",
    label: "Brand stinger · 4s",
    width: 1080,
    height: 1920,
    durationMs: 4000,
    hint: "TikTok / Reels · 9:16",
    acceptsHook: false
  },
  {
    id: "feature-cascade",
    label: "Feature cascade · 6s",
    width: 1080,
    height: 1920,
    durationMs: 6000,
    hint: "TikTok / Reels · 9:16",
    acceptsHook: false
  },
  {
    id: "comparison-slam",
    label: "Comparison slam · 6s",
    width: 1080,
    height: 1920,
    durationMs: 6000,
    hint: "TikTok / Reels · 9:16",
    acceptsHook: false
  }
];

export function renderVideoFrame(
  ctx: CanvasRenderingContext2D,
  templateId: VideoAdId,
  t: number,
  width: number,
  height: number,
  options: { hook?: string }
) {
  const hook = options.hook || "Mogged or mogged on?";
  switch (templateId) {
    case "hook-punch":
      return drawHookPunch(ctx, t, width, height, hook);
    case "rank-climb":
      return drawRankClimb(ctx, t, width, height);
    case "brand-stinger":
      return drawBrandStinger(ctx, t, width, height);
    case "feature-cascade":
      return drawFeatureCascade(ctx, t, width, height);
    case "comparison-slam":
      return drawComparisonSlam(ctx, t, width, height);
  }
}

/**
 * Record the entire animation to a webm blob via canvas.captureStream
 * + MediaRecorder. Returns null if unsupported. The caller is
 * responsible for showing UI during the ~durationMs render window.
 */
export async function recordVideoAd(
  templateId: VideoAdId,
  options: { hook?: string },
  onProgress?: (frac: number) => void
): Promise<Blob | null> {
  if (typeof window === "undefined") return null;
  if (typeof MediaRecorder === "undefined") return null;

  const tpl = VIDEO_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return null;
  const { width: w, height: h, durationMs } = tpl;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const stream = (canvas as HTMLCanvasElement & {
    captureStream: (fps: number) => MediaStream;
  }).captureStream(30);

  const mimeType = pickMimeType();
  if (!mimeType) return null;

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<Blob | null>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
    recorder.start();
    const startTs = performance.now();
    const tick = () => {
      const t = performance.now() - startTs;
      renderVideoFrame(ctx, templateId, t, w, h, options);
      onProgress?.(Math.min(1, t / durationMs));
      if (t < durationMs) {
        requestAnimationFrame(tick);
      } else {
        // Brief grace so the recorder flushes the last frames.
        setTimeout(() => recorder.stop(), 200);
      }
    };
    tick();
  });
}

function pickMimeType(): string | null {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* */
    }
  }
  return null;
}
