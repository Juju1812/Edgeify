import { Redis } from "@upstash/redis";
import { rankFromElo } from "@/lib/rank";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type ProfileSummary = {
  username: string;
  elo: number;
  wins: number;
  losses: number;
  edgeScore: number;
};

async function getProfile(username: string): Promise<ProfileSummary | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const redis = Redis.fromEnv();
  const raw = await redis.get<string | object>(
    `lb:summary:v1:${username.toLowerCase()}`
  );
  if (!raw) return null;
  return typeof raw === "string"
    ? (JSON.parse(raw) as ProfileSummary)
    : (raw as ProfileSummary);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === "<"
      ? "&lt;"
      : c === ">"
        ? "&gt;"
        : c === "&"
          ? "&amp;"
          : c === '"'
            ? "&quot;"
            : "&apos;"
  );
}

/**
 * GET /api/badge/[username]
 *
 * Returns a 220x60 SVG live-rendering the user's EdgeScore + ELO. Drop
 * this URL into an <img> in any bio link / blog / forum signature.
 *
 *   <img src="https://edgify.cc/api/badge/jrubski"
 *        alt="Edgify EdgeScore" width="220" height="60" />
 *
 * Cached on the edge for 5 minutes so the badge stays fresh-ish without
 * hammering Redis on every page-impression.
 */
export async function GET(
  _req: Request,
  { params }: { params: { username: string } }
) {
  const username = (params.username || "").toLowerCase().slice(0, 32);
  const profile = await getProfile(username);

  const display = profile?.username || username || "anon";
  const elo = profile?.elo ?? 0;
  const score = profile?.edgeScore ?? 0;
  const rank = rankFromElo(elo);
  const found = !!profile;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="60" viewBox="0 0 220 60">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0618"/>
      <stop offset="100%" stop-color="#15113d"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22e9ff"/>
      <stop offset="100%" stop-color="#ff5d8f"/>
    </linearGradient>
  </defs>
  <rect width="220" height="60" rx="10" fill="url(#bg)"/>
  <rect width="220" height="60" rx="10" fill="none" stroke="url(#brand)" stroke-opacity="0.45"/>
  <text x="14" y="20" font-family="ui-monospace, Menlo, monospace" font-size="9" letter-spacing="2" fill="#22e9ff" font-weight="700">EDGIFY</text>
  <text x="14" y="40" font-family="ui-sans-serif, system-ui" font-size="14" font-weight="700" fill="white">${escapeXml(display)}</text>
  <text x="14" y="52" font-family="ui-monospace, Menlo, monospace" font-size="9" letter-spacing="2" fill="${rank.color}">${escapeXml(rank.label.toUpperCase())} · ${elo} ELO</text>
  <g transform="translate(160, 12)">
    <circle cx="20" cy="18" r="18" fill="${rank.color}" fill-opacity="0.12" stroke="${rank.color}" stroke-opacity="0.55"/>
    <text x="20" y="23" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="14" font-weight="700" fill="white">${found ? score : "?"}</text>
    <text x="20" y="48" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="7" letter-spacing="2" fill="white" fill-opacity="0.45">EDGE</text>
  </g>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600"
    }
  });
}
