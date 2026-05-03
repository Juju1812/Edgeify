/**
 * Renders a 1200x630 share card to a Blob/PNG. Used by the live match
 * Result screen to produce a tweet-sized image of the match outcome.
 */

export type ShareCardData = {
  myName: string;
  oppName: string;
  myScore: number; // round wins, 0-2
  oppScore: number;
  myFace: string | null; // data URL or external URL
  oppFace: string | null;
  won: boolean;
  eloDelta: number;
  rankLabel: string;
  rankColor: string;
  rankEmoji: string;
};

const W = 1200;
const H = 630;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function renderShareCard(d: ShareCardData): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background gradient: edgify dark purple
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0618");
  bg.addColorStop(0.5, "#15113d");
  bg.addColorStop(1, "#070512");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial accent
  const radial = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, W);
  radial.addColorStop(0, "rgba(168, 85, 247, 0.18)");
  radial.addColorStop(1, "rgba(168, 85, 247, 0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);

  // Brand
  ctx.font = "700 28px ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("EDGIFY", W / 2, 36);

  // Outcome banner
  ctx.font = "900 92px ui-monospace, monospace";
  ctx.fillStyle = d.won ? "#34d399" : "#f43f5e";
  ctx.fillText(d.won ? "MOGGED" : "MOGGED ON", W / 2, 88);

  // Player face panels (260x260 each, centered with VS in middle)
  const PANEL = 260;
  const PANEL_Y = 260;
  const LEFT_X = W / 2 - PANEL - 60;
  const RIGHT_X = W / 2 + 60;

  await drawFacePanel(ctx, LEFT_X, PANEL_Y, PANEL, d.myName, d.myFace, d.won);
  await drawFacePanel(ctx, RIGHT_X, PANEL_Y, PANEL, d.oppName, d.oppFace, !d.won);

  // VS divider
  ctx.fillStyle = "#a855f7";
  ctx.shadowColor = "#a855f7";
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(W / 2, PANEL_Y + PANEL / 2, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#000";
  ctx.font = "900 36px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VS", W / 2, PANEL_Y + PANEL / 2);

  // Score line
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "600 26px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("BEST OF 3", W / 2, PANEL_Y + PANEL + 16);

  ctx.font = "900 60px ui-monospace, monospace";
  ctx.fillStyle = "#fff";
  ctx.fillText(`${d.myScore} – ${d.oppScore}`, W / 2, PANEL_Y + PANEL + 50);

  // ELO delta
  ctx.font = "700 32px ui-monospace, monospace";
  ctx.fillStyle = d.eloDelta >= 0 ? "#22d3ee" : "#f43f5e";
  ctx.fillText(
    `${d.eloDelta >= 0 ? "+" : ""}${d.eloDelta} ELO`,
    W / 2,
    PANEL_Y + PANEL + 124
  );

  // Footer
  ctx.font = "500 18px ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText("edgify.cc · entertainment metric, not a beauty judgment", W / 2, H - 40);

  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png", 0.92)
  );
}

async function drawFacePanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  name: string,
  faceUrl: string | null,
  isWinner: boolean
) {
  // Border ring
  ctx.fillStyle = isWinner ? "rgba(52, 211, 153, 0.3)" : "rgba(255,255,255,0.05)";
  ctx.fillRect(x - 6, y - 6, size + 12, size + 12 + 56);

  // Face area
  ctx.fillStyle = "#000";
  ctx.fillRect(x, y, size, size);
  if (faceUrl) {
    try {
      const img = await loadImage(faceUrl);
      // mirror so it matches what the user saw on screen
      ctx.save();
      ctx.translate(x + size, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, size, size);
      ctx.restore();
    } catch {
      drawSilhouette(ctx, x, y, size);
    }
  } else {
    drawSilhouette(ctx, x, y, size);
  }

  // Name strip
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(x, y + size, size, 56);
  ctx.fillStyle = "#fff";
  ctx.font = "700 28px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, x + size / 2, y + size + 28);
}

function drawSilhouette(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) {
  ctx.fillStyle = "#7c3aed";
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size * 0.38, size * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + size * 0.2, y + size);
  ctx.lineTo(x + size * 0.2, y + size * 0.85);
  ctx.bezierCurveTo(
    x + size * 0.3, y + size * 0.55,
    x + size * 0.7, y + size * 0.55,
    x + size * 0.8, y + size * 0.85
  );
  ctx.lineTo(x + size * 0.8, y + size);
  ctx.fill();
  ctx.globalAlpha = 1;
}
