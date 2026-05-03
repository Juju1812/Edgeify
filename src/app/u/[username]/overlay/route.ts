import { Redis } from "@upstash/redis";
import { rankFromElo } from "@/lib/rank";

export const runtime = "edge";

type ProfileSummary = {
  username: string;
  elo: number;
  wins: number;
  losses: number;
  faceDataUrl: string | null;
};

async function getProfile(u: string): Promise<ProfileSummary | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const redis = Redis.fromEnv();
  const raw = await redis.get<string | object>(
    `lb:summary:v1:${u.toLowerCase()}`
  );
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as ProfileSummary);
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c] as string));
}

/**
 * Transparent-bg widget for OBS browser-source. Add as a 480x180 source.
 * Refreshes itself every 30s via meta-refresh.
 */
export async function GET(
  _req: Request,
  { params }: { params: { username: string } }
) {
  const p = await getProfile(params.username);
  const html = !p
    ? renderEmpty(params.username)
    : renderOverlay(p);
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=30, s-maxage=30"
    }
  });
}

function renderOverlay(p: ProfileSummary): string {
  const rank = rankFromElo(p.elo);
  const face = p.faceDataUrl
    ? `<img src="${escape(p.faceDataUrl)}" alt="" width="64" height="64" style="border-radius:12px;object-fit:cover;border:2px solid ${rank.color};transform:scaleX(-1);" />`
    : `<div style="width:64px;height:64px;border-radius:12px;background:#1a1330;display:flex;align-items:center;justify-content:center;font-size:36px;">${rank.emoji}</div>`;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="30" />
<title>${escape(p.username)} · Edgify Overlay</title>
<style>
html, body { margin:0; padding:0; background: transparent !important; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: white; }
.card { display:inline-flex; align-items:center; gap:16px; padding:12px; border-radius:16px; border:1px solid rgba(255,255,255,0.08); background: rgba(7,5,18,0.85); backdrop-filter: blur(10px); }
</style>
</head>
<body>
<div class="card">
  ${face}
  <div>
    <div style="font-size:18px;font-weight:700;letter-spacing:0.18em;">${escape(p.username.toUpperCase())}</div>
    <div style="font-size:12px;margin-top:2px;color:${rank.color};letter-spacing:0.22em;">${rank.emoji} ${rank.label}</div>
    <div style="display:flex;gap:14px;margin-top:6px;">
      <span style="font-size:22px;font-weight:900;color:#22d3ee;">${p.elo}</span>
      <span style="font-size:13px;opacity:0.6;align-self:center;">${p.wins}W · ${p.losses}L</span>
    </div>
  </div>
</div>
</body>
</html>`;
}

function renderEmpty(username: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="30" />
<style>html, body { margin:0; padding:0; background: transparent !important; font-family: ui-monospace, monospace; color: white; }</style>
</head>
<body>
<div style="display:inline-block;padding:12px;border-radius:12px;background:rgba(7,5,18,0.85);">
  <div style="opacity:0.5;letter-spacing:0.22em;font-size:12px;">EDGIFY · ${escape(username.toUpperCase())}</div>
  <div style="margin-top:4px;opacity:0.4;font-size:11px;">Not yet ranked</div>
</div>
</body>
</html>`;
}
