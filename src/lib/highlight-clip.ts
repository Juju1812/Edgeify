/**
 * Renders a 1080x1920 vertical highlight clip of a finished match. Used
 * by the Share-to-TikTok flow on the result screen. The clip is plain
 * canvas → MediaRecorder → Blob, no third-party dependency.
 *
 * Frame sequence (durations in ms):
 *   0–1000   intro title  ("EDGIFY · 1V1")
 *   1000–4000 round breakdown bars (Round 1, 2, 3 progressive reveal)
 *   4000–5500 verdict + ELO delta
 *   5500–6500 brand outro
 *
 * Total: 6.5s. Output is webm (vp9 if available, vp8 fallback) — every
 * modern mobile browser plays this; TikTok and Instagram both accept it
 * directly via the share sheet (they transcode).
 */

export type HighlightOpts = {
  myName: string;
  oppName: string;
  myFace: string | null; // dataURL
  oppFace: string | null; // dataURL
  rounds: { criterion: string; me: number; opp: number }[];
  won: boolean;
  eloDelta: number;
  rankLabel: string;
  rankColor: string;
  rankEmoji: string;
};

const W = 1080;
const H = 1920;
const FPS = 30;

export async function renderHighlightClip(opts: HighlightOpts): Promise<Blob | null> {
  if (typeof window === "undefined") return null;
  if (typeof MediaRecorder === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Pre-load both faces so drawImage is instant during the recording.
  const myImg = await loadImage(opts.myFace);
  const oppImg = await loadImage(opts.oppFace);

  // captureStream gives us a video MediaStream tied to the canvas.
  const stream = (canvas as HTMLCanvasElement & {
    captureStream: (fps: number) => MediaStream;
  }).captureStream(FPS);

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
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };

    recorder.start();
    const startTs = performance.now();

    // Cinematic timing: 9s instead of 6.5s. Each phase stretched
    // proportionally so rounds linger and the verdict has weight.
    const TOTAL_MS = 9000;
    const tick = () => {
      const t = performance.now() - startTs;
      drawFrame(ctx, t, opts, myImg, oppImg);
      if (t < TOTAL_MS) {
        requestAnimationFrame(tick);
      } else {
        // Stop with a small grace before the recorder flushes.
        setTimeout(() => recorder.stop(), 150);
      }
    };
    tick();
  });
}

function pickMimeType(): string | null {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
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

function drawFrame(
  ctx: CanvasRenderingContext2D,
  t: number,
  opts: HighlightOpts,
  myImg: HTMLImageElement | null,
  oppImg: HTMLImageElement | null
) {
  // ─── Background ──────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#04060c");
  bg.addColorStop(1, "#0b1124");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Asymmetric edge glow
  const cyan = ctx.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, W * 0.7);
  cyan.addColorStop(0, "rgba(34, 233, 255, 0.22)");
  cyan.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = cyan;
  ctx.fillRect(0, 0, W, H);
  const coral = ctx.createRadialGradient(W * 0.85, H * 0.95, 0, W * 0.85, H * 0.95, W * 0.6);
  coral.addColorStop(0, "rgba(255, 93, 143, 0.18)");
  coral.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = coral;
  ctx.fillRect(0, 0, W, H);

  // Top edge accent
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "rgba(34, 233, 255, 0)");
  grad.addColorStop(0.5, "rgba(34, 233, 255, 0.7)");
  grad.addColorStop(1, "rgba(255, 93, 143, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 4);

  // Brand wordmark top-left
  ctx.fillStyle = "#22e9ff";
  ctx.font = "bold 36px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("EDGIFY", 60, 90);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "500 24px ui-monospace, monospace";
  ctx.fillText("· 1V1 RANKED", 220, 90);

  // ─── Faces row (always visible, gets dimmed during outro) ────────
  drawFaceTile(ctx, 60, 200, 460, 620, opts.myName, myImg, true, "#22e9ff");
  drawFaceTile(
    ctx,
    W - 60 - 460,
    200,
    460,
    620,
    opts.oppName,
    oppImg,
    false,
    "#ff5d8f"
  );

  // VS badge between
  ctx.save();
  ctx.translate(W / 2, 510);
  ctx.fillStyle = "#04060c";
  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#22e9ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#22e9ff";
  ctx.font = "bold 38px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VS", 0, 4);
  ctx.restore();

  // ─── Phase-driven content (cinematic timing) ──────────────────
  // 0-1.2s   intro
  // 1.2-5.4s rounds (1.4s/round × 3)
  // 5.4-7.5s verdict (2.1s — bigger linger)
  // 7.5-9s   outro
  if (t < 1200) {
    drawIntro(ctx, t);
  } else if (t < 5400) {
    drawRounds(ctx, t - 1200, opts.rounds);
  } else if (t < 7500) {
    drawVerdict(ctx, t - 5400, opts);
  } else {
    drawOutro(ctx, t - 7500);
  }
}

function drawIntro(ctx: CanvasRenderingContext2D, t: number) {
  // TikTok-native hook: front-load a question + tag to lock the
  // viewer past the 0.5s skip window. The big bold "WHO WINS??" is
  // the actual scroll-stopper; everything else is decoration.
  const a = Math.min(1, t / 200);
  ctx.save();
  ctx.globalAlpha = a;

  // Bouncy scale on the headline for the first 600ms — micro-motion
  // signals "this is going to pay off in a second."
  const bounce =
    t < 600 ? 1 + Math.sin((t / 600) * Math.PI) * 0.05 : 1;
  ctx.translate(W / 2, 1080);
  ctx.scale(bounce, bounce);

  ctx.fillStyle = "#fff";
  ctx.font = "900 132px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("WHO WINS??", 0, 0);

  // Subhead under the hook
  ctx.scale(1 / bounce, 1 / bounce);
  ctx.fillStyle = "rgba(255, 93, 143, 0.9)";
  ctx.font = "800 38px ui-monospace, monospace";
  ctx.fillText("⚡ EDGIFY 1V1 · AI-SCORED", 0, 110);
  ctx.restore();
}

function drawRounds(
  ctx: CanvasRenderingContext2D,
  t: number,
  rounds: HighlightOpts["rounds"]
) {
  // Cinematic: ~1.4s per round (was 1s). The decisive round (last
  // one) gets an extra beat from the calling-site phase budget.
  const slot = 1400;
  for (let i = 0; i < rounds.length; i++) {
    const startT = i * slot;
    if (t < startT) continue;
    const localT = t - startT;
    const r = rounds[i];
    const alpha = Math.min(1, localT / 250);
    drawRoundBar(ctx, 60, 1080 + i * 200, W - 120, 130, r, alpha, localT);
  }
}

function drawRoundBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: { criterion: string; me: number; opp: number },
  alpha: number,
  localT: number
) {
  const won = r.me > r.opp;
  const tied = r.me === r.opp;
  const total = r.me + r.opp || 1;
  const myPct = r.me / total;
  const fill = Math.min(1, localT / 600);

  ctx.save();
  ctx.globalAlpha = alpha;
  // Frame
  roundRectPath(ctx, x, y, w, h, 18);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "600 20px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(r.criterion.toUpperCase(), x + 26, y + 36);

  ctx.fillStyle = tied ? "#fff" : won ? "#34d399" : "#f43f5e";
  ctx.textAlign = "right";
  ctx.fillText(
    tied ? "TIED" : won ? "ROUND WON" : "ROUND LOST",
    x + w - 26,
    y + 36
  );

  // Bar
  const barX = x + 26;
  const barY = y + 60;
  const barW = w - 52;
  const barH = 50;
  const myW = barW * myPct * fill;
  const oppW = barW * (1 - myPct) * fill;

  ctx.fillStyle = "rgba(34,233,255,0.35)";
  roundRectPath(ctx, barX, barY, myW, barH, 10);
  ctx.fill();
  ctx.fillStyle = "rgba(255,93,143,0.30)";
  roundRectPath(ctx, barX + myW, barY, oppW, barH, 10);
  ctx.fill();

  // Numbers
  ctx.font = "800 28px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#22e9ff";
  ctx.textAlign = "right";
  if (myW > 60) ctx.fillText(`${r.me}`, barX + myW - 14, barY + 35);
  ctx.fillStyle = "#ff5d8f";
  ctx.textAlign = "left";
  if (oppW > 60) ctx.fillText(`${r.opp}`, barX + myW + 14, barY + 35);

  ctx.restore();
}

function drawVerdict(
  ctx: CanvasRenderingContext2D,
  t: number,
  opts: HighlightOpts
) {
  // Punch-in scale: verdict drops on screen at 130% then settles to
  // 100% over 250ms. Locks attention on the payoff.
  const a = Math.min(1, t / 200);
  const scale =
    t < 250 ? 1.3 - 0.3 * (t / 250) : 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = opts.won ? "#34d399" : "#f43f5e";

  // Big banner across mid-screen
  ctx.save();
  ctx.translate(W / 2, 1180);
  ctx.scale(scale, scale);
  ctx.font = "900 156px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const word = opts.won ? "MOGGED" : "MOGGED ON";
  ctx.fillText(word, 0, 0);
  ctx.restore();

  // ELO delta — animated count-up from 0 to delta over 700ms.
  const progress = Math.min(1, Math.max(0, (t - 250) / 700));
  const displayDelta = Math.round(opts.eloDelta * progress);
  ctx.fillStyle = opts.eloDelta >= 0 ? "#22e9ff" : "#ff5d8f";
  ctx.font = "900 108px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(
    `${displayDelta >= 0 ? "+" : ""}${displayDelta} ELO`,
    W / 2,
    1330
  );

  // Rank
  ctx.fillStyle = opts.rankColor;
  ctx.font = "700 48px ui-monospace, monospace";
  ctx.fillText(`${opts.rankEmoji} ${opts.rankLabel}`, W / 2, 1410);

  // "Can you beat them?" CTA — only fades in after the count-up settles.
  if (t > 1000) {
    const ctaA = Math.min(1, (t - 1000) / 400);
    ctx.globalAlpha = a * ctaA;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "700 38px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("CAN YOU BEAT THEM?", W / 2, 1500);
  }

  ctx.restore();
}

function drawOutro(ctx: CanvasRenderingContext2D, t: number) {
  const a = Math.min(1, t / 300);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "800 64px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PLAY AT", W / 2, 1660);
  // Brand-edge gradient text
  const grad = ctx.createLinearGradient(W / 2 - 250, 0, W / 2 + 250, 0);
  grad.addColorStop(0, "#22e9ff");
  grad.addColorStop(1, "#ff5d8f");
  ctx.fillStyle = grad;
  ctx.font = "900 96px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("EDGIFY", W / 2, 1770);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "500 28px ui-monospace, monospace";
  ctx.fillText("RANKED 1V1 FACE-OFFS", W / 2, 1820);
  ctx.restore();
}

function drawFaceTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
  img: HTMLImageElement | null,
  mirror: boolean,
  accent: string
) {
  ctx.save();
  // Card frame
  roundRectPath(ctx, x, y, w, h, 24);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fill();
  ctx.strokeStyle = accent + "55";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Image (clipped to card)
  if (img) {
    ctx.save();
    roundRectPath(ctx, x + 4, y + 4, w - 8, h - 100, 20);
    ctx.clip();
    if (mirror) {
      ctx.translate(x + w / 2, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -(w - 8) / 2 - 4, y + 4, w - 8, h - 100);
    } else {
      ctx.drawImage(img, x + 4, y + 4, w - 8, h - 100);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRectPath(ctx, x + 4, y + 4, w - 8, h - 100, 20);
    ctx.fill();
  }

  // Name strip
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRectPath(ctx, x, y + h - 90, w, 90, 0);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "700 36px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name.toUpperCase().slice(0, 14), x + w / 2, y + h - 45);

  ctx.restore();
}

function roundRectPath(
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
