import { NextResponse } from "next/server";
import { getRedis, LEADERBOARD_KEY, lbSummaryKey } from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * GET /api/users/search?q=jru → { results: [...] }
 *
 * Best-effort prefix/contains match against leaderboard summaries.
 * Doesn't index — just scans the top N entries. Fine for the current
 * scale; would want a proper search index past 10k users.
 */
export async function GET(req: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ results: [] });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").toLowerCase().trim();
  if (q.length < 1) return NextResponse.json({ results: [] });

  // Pull top 200 ranked usernames; we'll scan client-side. Past 200
  // users we'd need a real search index.
  const usernames = ((await redis.zrange(LEADERBOARD_KEY, 0, 199, {
    rev: true
  })) as string[]) || [];

  // Match: starts-with first, then contains.
  const starts = usernames.filter((u) => u.toLowerCase().startsWith(q));
  const contains = usernames.filter(
    (u) => !u.toLowerCase().startsWith(q) && u.toLowerCase().includes(q)
  );
  const matched = [...starts, ...contains].slice(0, 10);

  const summaries = await Promise.all(
    matched.map(async (u) => {
      const raw = await redis.get<string | object>(lbSummaryKey(u));
      if (!raw) return null;
      const obj = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);
      return {
        username: String(obj.username || u),
        elo: Number(obj.elo) || 0,
        faceDataUrl: typeof obj.faceDataUrl === "string" ? obj.faceDataUrl : null,
        countryCode:
          typeof obj.countryCode === "string" ? obj.countryCode : null
      };
    })
  );

  return NextResponse.json({ results: summaries.filter(Boolean) });
}
