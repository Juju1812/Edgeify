import { NextResponse } from "next/server";
import { getRedis, LEADERBOARD_KEY, lbSummaryKey } from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * GET /api/live → returns the most recently active ranked players,
 * used as a proxy for "currently in-game" until we have a real
 * live-match registry. Reads the leaderboard ZSET, fetches each
 * summary, sorts by updatedAt desc, and returns the top 30 with
 * activity within the last 10 minutes.
 *
 * Note: this is engagement signal, not literal live status. To show
 * actual in-progress matches we'd need to write to a live-matches KV
 * key when a match starts and clear on match end — TODO.
 */
export async function GET() {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ entries: [] });

  // Pull the top 100 by ELO; this is an enriched feed.
  const usernames = ((await redis.zrange(LEADERBOARD_KEY, 0, 99, {
    rev: true
  })) as string[]) || [];

  if (usernames.length === 0) return NextResponse.json({ entries: [] });

  const summaries = await Promise.all(
    usernames.map(async (u) => {
      const raw = await redis.get<string | object>(lbSummaryKey(u));
      if (!raw) return null;
      const obj =
        typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);
      return {
        username: String(obj.username || u),
        elo: Number(obj.elo) || 0,
        wins: Number(obj.wins) || 0,
        losses: Number(obj.losses) || 0,
        edgeScore: Number(obj.edgeScore) || 0,
        faceDataUrl: typeof obj.faceDataUrl === "string" ? obj.faceDataUrl : null,
        countryCode:
          typeof obj.countryCode === "string" ? obj.countryCode : null,
        updatedAt: Number(obj.updatedAt) || 0
      };
    })
  );

  const now = Date.now();
  const recent = (summaries.filter(Boolean) as Exclude<typeof summaries[0], null>[])
    .filter((s) => s.updatedAt && now - s.updatedAt < 10 * 60 * 1000)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 30);

  return NextResponse.json({ entries: recent });
}
