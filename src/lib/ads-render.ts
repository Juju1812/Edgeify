/**
 * Canvas renderers for the /ads page. Each template draws into a
 * caller-supplied canvas (already sized to the template's output
 * dimensions). Pure functions — no React.
 *
 * Style notes:
 *   - Edgify palette: cyan #22e9ff, coral #ff5d8f, ink #04060c
 *   - Inter (sans) for headlines, JetBrains Mono for stat-style copy
 *   - Asymmetric corner glows match the home page background
 */

export const CYAN = "#22e9ff";
export const CORAL = "#ff5d8f";
export const INK = "#04060c";

// Render the shared backdrop (radial cyan + coral glows + diagonal grid).
// Every template starts with this so the brand is visually consistent.
export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Base ink
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, "#04060c");
  base.addColorStop(1, "#0b1124");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Cyan corner glow (top-left)
  const cyan = ctx.createRadialGradient(w * 0.18, h * 0.1, 0, w * 0.18, h * 0.1, w * 0.7);
  cyan.addColorStop(0, "rgba(34, 233, 255, 0.28)");
  cyan.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = cyan;
  ctx.fillRect(0, 0, w, h);

  // Coral corner glow (bottom-right)
  const coral = ctx.createRadialGradient(w * 0.82, h * 0.92, 0, w * 0.82, h * 0.92, w * 0.7);
  coral.addColorStop(0, "rgba(255, 93, 143, 0.20)");
  coral.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = coral;
  ctx.fillRect(0, 0, w, h);

  // Top edge accent stripe
  const top = ctx.createLinearGradient(0, 0, w, 0);
  top.addColorStop(0, "rgba(34, 233, 255, 0)");
  top.addColorStop(0.4, "rgba(34, 233, 255, 0.7)");
  top.addColorStop(0.7, "rgba(255, 93, 143, 0.5)");
  top.addColorStop(1, "rgba(255, 93, 143, 0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, Math.max(2, h * 0.002));

  // Faint diagonal grid (very subtle texture)
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 1;
  const step = w * 0.04;
  for (let x = -h; x < w + h; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h, h);
    ctx.stroke();
  }
  ctx.restore();
}

// Brand wordmark — cyan→coral gradient. Scaled to caller-supplied size.
export function drawBrandWordmark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign = "center"
) {
  ctx.save();
  ctx.font = `900 ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  const text = "EDGIFY";
  const metrics = ctx.measureText(text);
  const startX =
    align === "left"
      ? x
      : align === "right"
        ? x - metrics.width
        : x - metrics.width / 2;
  const grad = ctx.createLinearGradient(startX, y, startX + metrics.width, y);
  grad.addColorStop(0, CYAN);
  grad.addColorStop(0.5, "#b9f8ff");
  grad.addColorStop(1, CORAL);
  ctx.fillStyle = grad;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Tagline / URL row — small monospaced caption near the bottom of the
// frame. Used on every template as a consistent footer.
export function drawFooterURL(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  url = "EDGIFY.APP"
) {
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.font = `600 ${Math.round(w * 0.024)}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(url, w / 2, h - h * 0.04);
  ctx.restore();
}

// Hexagonal EdgeMark — geometric brand mark. Drawn solid with the
// gradient. Used as a small accent in some templates.
export function drawEdgeMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
) {
  ctx.save();
  const grad = ctx.createLinearGradient(
    cx - radius,
    cy - radius,
    cx + radius,
    cy + radius
  );
  grad.addColorStop(0, CYAN);
  grad.addColorStop(1, CORAL);
  ctx.strokeStyle = grad;
  ctx.lineWidth = radius * 0.13;
  ctx.lineJoin = "round";
  // Hex
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + radius * Math.cos(a);
    const y = cy + radius * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  // Inner E
  ctx.lineCap = "round";
  ctx.lineWidth = radius * 0.16;
  const inset = radius * 0.42;
  for (let i = 0; i < 3; i++) {
    const yy = cy - inset + (i * inset);
    const len = i === 1 ? inset * 0.8 : inset * 1.05;
    ctx.beginPath();
    ctx.moveTo(cx - inset * 0.6, yy);
    ctx.lineTo(cx - inset * 0.6 + len, yy);
    ctx.stroke();
  }
  ctx.restore();
}

// Helper: word-wrap a string to fit a max width at the given font.
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

// ─── Template 1: HOOK QUESTION ─────────────────────────────────────
// Big text question, small brand mark above. Optimized for TikTok
// vertical 1080x1920.
function drawHookTemplate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  hook: string
) {
  drawBackground(ctx, w, h);

  // Top: brand row
  drawEdgeMark(ctx, w * 0.5 - w * 0.08, h * 0.10, w * 0.045);
  drawBrandWordmark(ctx, w * 0.5 + w * 0.04, h * 0.10, w * 0.06, "left");

  // Main hook — big, gradient, centered, wrapped
  const hookSize = Math.round(w * 0.13);
  ctx.save();
  ctx.font = `900 ${hookSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrapLines(ctx, hook.toUpperCase(), w * 0.85);
  const lineHeight = hookSize * 1.0;
  const totalH = lines.length * lineHeight;
  const startY = h * 0.5 - totalH / 2 + lineHeight / 2;
  lines.forEach((line, i) => {
    // Last line gets the gradient highlight
    if (i === lines.length - 1) {
      const metrics = ctx.measureText(line);
      const lx = w / 2 - metrics.width / 2;
      const grad = ctx.createLinearGradient(lx, 0, lx + metrics.width, 0);
      grad.addColorStop(0, CYAN);
      grad.addColorStop(1, CORAL);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.fillText(line, w / 2, startY + i * lineHeight);
  });
  ctx.restore();

  // Sub-tagline
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `500 ${Math.round(w * 0.032)}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("RANKED 1V1 · AI-SCORED · LIVE OPPONENTS", w / 2, h * 0.78);
  ctx.restore();

  drawFooterURL(ctx, w, h);
}

// ─── Template 2: BIG BRAND ─────────────────────────────────────────
// The wordmark is the entire visual. Strongest brand recall play.
function drawBrandTemplate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  drawBackground(ctx, w, h);

  // Eyebrow
  ctx.save();
  ctx.fillStyle = "rgba(34, 233, 255, 0.85)";
  ctx.font = `600 ${Math.round(w * 0.028)}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("ENTER THE", w / 2, h * 0.40);
  ctx.restore();

  // Massive wordmark
  drawBrandWordmark(ctx, w / 2, h * 0.50, w * 0.21, "center");

  // Subhead
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `700 ${Math.round(w * 0.035)}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("RANKED 1V1 FACE-OFFS", w / 2, h * 0.60);
  ctx.restore();

  // Small CTA pill
  const pillW = w * 0.34;
  const pillH = w * 0.07;
  const pillX = w / 2 - pillW / 2;
  const pillY = h * 0.69;
  ctx.save();
  ctx.fillStyle = "rgba(34, 233, 255, 0.15)";
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 3;
  roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.round(pillH * 0.42)}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PLAY INSTANTLY  →", w / 2, pillY + pillH / 2);
  ctx.restore();

  drawFooterURL(ctx, w, h);
}

// ─── Template 3: RANK TEASE ────────────────────────────────────────
// "Where do you rank?" with the tier ladder visible. 1080x1080 square.
function drawRankTemplate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  drawBackground(ctx, w, h);

  // Headline (left half)
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.round(w * 0.085)}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("WHERE", w * 0.06, h * 0.27);
  ctx.fillText("DO YOU", w * 0.06, h * 0.40);
  // Last word in gradient
  const tail = "RANK?";
  const tailW = ctx.measureText(tail).width;
  const grad = ctx.createLinearGradient(w * 0.06, 0, w * 0.06 + tailW, 0);
  grad.addColorStop(0, CYAN);
  grad.addColorStop(1, CORAL);
  ctx.fillStyle = grad;
  ctx.fillText(tail, w * 0.06, h * 0.53);
  ctx.restore();

  // Sub-text
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `500 ${Math.round(w * 0.026)}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.textAlign = "left";
  ctx.fillText("AI-SCORED · 7 TIERS · LIVE LADDER", w * 0.06, h * 0.62);
  ctx.restore();

  // Right column: rank ladder
  const ranks = [
    { emoji: "🥀", label: "SUB3", color: "#6b7280" },
    { emoji: "🍂", label: "SUB5", color: "#a16207" },
    { emoji: "💧", label: "LTN", color: "#0891b2" },
    { emoji: "⚖️", label: "MTN", color: "#22d3ee" },
    { emoji: "🔥", label: "HTN", color: "#a855f7" },
    { emoji: "💪", label: "CHAD", color: "#f43f5e" },
    { emoji: "👑", label: "TRUE ADAM", color: "#fde047" }
  ];
  const colX = w * 0.62;
  const startY = h * 0.18;
  const rowH = h * 0.085;
  ctx.save();
  ctx.font = `700 ${Math.round(w * 0.028)}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.textBaseline = "middle";
  ranks.forEach((r, i) => {
    const y = startY + i * rowH;
    // Emoji
    ctx.font = `${Math.round(w * 0.04)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.fillText(r.emoji, colX, y);
    // Label
    ctx.font = `700 ${Math.round(w * 0.028)}px ui-monospace, "JetBrains Mono", monospace`;
    ctx.fillStyle = r.color;
    ctx.fillText(r.label, colX + w * 0.07, y);
  });
  ctx.restore();

  // Footer brand row
  ctx.save();
  drawEdgeMark(ctx, w * 0.06, h * 0.90, w * 0.025);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 ${Math.round(w * 0.022)}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("EDGIFY.APP", w * 0.10, h * 0.90);
  ctx.restore();
}

// ─── Template 4: FEATURE STACK ─────────────────────────────────────
// 4 feature rows with checkmarks. Square 1080x1080.
function drawFeaturesTemplate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  drawBackground(ctx, w, h);

  // Headline
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.round(w * 0.07)}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("FACE-RANKED.", w * 0.06, h * 0.18);
  // Gradient line
  const tail = "PROPERLY.";
  const tailW = ctx.measureText(tail).width;
  const grad = ctx.createLinearGradient(w * 0.06, 0, w * 0.06 + tailW, 0);
  grad.addColorStop(0, CYAN);
  grad.addColorStop(1, CORAL);
  ctx.fillStyle = grad;
  ctx.fillText(tail, w * 0.06, h * 0.27);
  ctx.restore();

  const features = [
    { c: "AR", label: "Real-time face tracking" },
    { c: "1V1", label: "Live opponents · no bots" },
    { c: "ELO", label: "Ranked ladder · 7 tiers · seasons" },
    { c: "AI", label: "Claude vision · post-match analysis" }
  ];
  const startY = h * 0.40;
  const rowH = h * 0.11;
  features.forEach((f, i) => {
    const y = startY + i * rowH;
    // Square chip
    const chipSize = w * 0.08;
    const chipX = w * 0.06;
    ctx.save();
    const cg = ctx.createLinearGradient(
      chipX,
      y - chipSize / 2,
      chipX + chipSize,
      y + chipSize / 2
    );
    cg.addColorStop(0, CYAN);
    cg.addColorStop(1, CORAL);
    ctx.fillStyle = cg;
    roundRectPath(ctx, chipX, y - chipSize / 2, chipSize, chipSize, chipSize * 0.18);
    ctx.fill();
    // Chip text (mode key like "AR")
    ctx.fillStyle = INK;
    ctx.font = `900 ${Math.round(chipSize * 0.45)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(f.c, chipX + chipSize / 2, y);
    ctx.restore();

    // Label
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `600 ${Math.round(w * 0.034)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(f.label, w * 0.18, y);
    ctx.restore();
  });

  // Footer
  ctx.save();
  drawEdgeMark(ctx, w * 0.06, h * 0.90, w * 0.025);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 ${Math.round(w * 0.022)}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("EDGIFY.APP", w * 0.10, h * 0.90);
  ctx.restore();
}

// ─── Template 5: COMPARISON TABLE ──────────────────────────────────
// "Edgify vs other face-rating sites" two-column comparison.
function drawComparisonTemplate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  drawBackground(ctx, w, h);

  // Headline
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.round(w * 0.075)}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("FACE APPS", w / 2, h * 0.13);
  // Gradient subtitle
  const tail = "ARE BORING.";
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
  ctx.fillText(tail, w / 2, h * 0.20);
  ctx.restore();

  // Two columns
  const rows = [
    { e: "Live opponents", o: "Bots / nothing" },
    { e: "AI scoring", o: "Vague vibes" },
    { e: "ELO ladder", o: "No ranking" },
    { e: "AR overlay", o: "Static photo" },
    { e: "Free + instant", o: "Paywall" },
    { e: "Vision analysis", o: "Star ratings" }
  ];

  const tableY = h * 0.30;
  const rowH = h * 0.08;
  // Headers
  ctx.save();
  ctx.font = `800 ${Math.round(w * 0.034)}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = CYAN;
  ctx.fillText("EDGIFY", w * 0.27, tableY);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText("OTHERS", w * 0.73, tableY);
  ctx.restore();

  rows.forEach((r, i) => {
    const y = tableY + (i + 1) * rowH + h * 0.02;
    // Row separator
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.06, y - rowH * 0.5);
    ctx.lineTo(w * 0.94, y - rowH * 0.5);
    ctx.stroke();
    ctx.restore();

    // Edgify side
    ctx.save();
    ctx.font = `600 ${Math.round(w * 0.028)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText("✓ " + r.e, w * 0.27, y);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("✗ " + r.o, w * 0.73, y);
    ctx.restore();
  });

  // CTA pill
  const pillW = w * 0.42;
  const pillH = w * 0.075;
  const pillX = w / 2 - pillW / 2;
  const pillY = h * 0.86;
  ctx.save();
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

// ─── Template 6: BANNER (1600x900) ─────────────────────────────────
// Landscape format for X/Twitter, link previews, YouTube end card.
function drawBannerTemplate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  drawBackground(ctx, w, h);

  // Big wordmark left
  drawBrandWordmark(ctx, w * 0.06, h * 0.42, w * 0.10, "left");

  // Tagline
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `700 ${Math.round(w * 0.027)}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("Ranked 1v1 face-offs.", w * 0.06, h * 0.60);
  ctx.fillText("AI-scored. Live opponents.", w * 0.06, h * 0.70);
  ctx.restore();

  // CTA right
  const pillW = w * 0.20;
  const pillH = h * 0.13;
  const pillX = w * 0.74;
  const pillY = h / 2 - pillH / 2;
  ctx.save();
  ctx.fillStyle = "rgba(34, 233, 255, 0.15)";
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 4;
  roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.round(pillH * 0.32)}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PLAY  →", pillX + pillW / 2, pillY + pillH / 2);
  ctx.restore();

  // URL bottom-left
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 ${Math.round(w * 0.018)}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.textAlign = "left";
  ctx.fillText("EDGIFY.APP", w * 0.06, h * 0.88);
  ctx.restore();
}

export function roundRectPath(
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

// ─── Public dispatcher ─────────────────────────────────────────────

export type AdTemplateId =
  | "hook"
  | "brand"
  | "rank"
  | "features"
  | "comparison"
  | "banner";

export type AdTemplate = {
  id: AdTemplateId;
  label: string;
  width: number;
  height: number;
  /** Recommended platforms / aspect description shown in the picker. */
  hint: string;
  /** Whether this template renders the user-supplied hook text. */
  acceptsHook: boolean;
};

export const AD_TEMPLATES: AdTemplate[] = [
  {
    id: "hook",
    label: "Hook question",
    width: 1080,
    height: 1920,
    hint: "TikTok / Reels · 9:16",
    acceptsHook: true
  },
  {
    id: "brand",
    label: "Big brand",
    width: 1080,
    height: 1920,
    hint: "TikTok / Reels · 9:16",
    acceptsHook: false
  },
  {
    id: "rank",
    label: "Rank ladder",
    width: 1080,
    height: 1080,
    hint: "Instagram post · 1:1",
    acceptsHook: false
  },
  {
    id: "features",
    label: "Feature stack",
    width: 1080,
    height: 1080,
    hint: "Instagram post · 1:1",
    acceptsHook: false
  },
  {
    id: "comparison",
    label: "Vs others",
    width: 1080,
    height: 1920,
    hint: "TikTok / Reels · 9:16",
    acceptsHook: false
  },
  {
    id: "banner",
    label: "Landscape banner",
    width: 1600,
    height: 900,
    hint: "X / Twitter · YouTube end card · 16:9",
    acceptsHook: false
  }
];

export function renderAd(
  ctx: CanvasRenderingContext2D,
  templateId: AdTemplateId,
  width: number,
  height: number,
  options: { hook?: string }
) {
  const hook = options.hook || "Mogged or mogged on?";
  switch (templateId) {
    case "hook":
      return drawHookTemplate(ctx, width, height, hook);
    case "brand":
      return drawBrandTemplate(ctx, width, height);
    case "rank":
      return drawRankTemplate(ctx, width, height);
    case "features":
      return drawFeaturesTemplate(ctx, width, height);
    case "comparison":
      return drawComparisonTemplate(ctx, width, height);
    case "banner":
      return drawBannerTemplate(ctx, width, height);
  }
}
