import { NextResponse } from "next/server";
import { getRedis, LEADERBOARD_KEY, lbSummaryKey } from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ entries: [] });
  }

  // Top 100 by ELO descending. zrange with rev returns highest first.
  const usernames = (await redis.zrange<string[]>(LEADERBOARD_KEY, 0, 99, {
    rev: true
  })) || [];

  if (usernames.length === 0) {
    return NextResponse.json({ entries: [] });
  }

  const keys = usernames.map((u) => lbSummaryKey(u));
  const summaries = await redis.mget<Array<string | object | null>>(...keys);

  // Drop entries where the per-user summary is missing or has zero
  // ELO — those are stale ZSET rows whose lb:summary was evicted, and
  // showing them as 0/0/0/0 skeletons clutters the board. Also evict
  // the dangling ZSET membership so future loads don't re-fetch them.
  const entries: Array<{
    username: string;
    elo: number;
    wins: number;
    losses: number;
    edgeScore: number;
    faceDataUrl: string | null;
    countryCode: string | null;
    updatedAt: number;
  }> = [];
  const stale: string[] = [];
  (summaries || []).forEach((raw, i) => {
    if (!raw) {
      // No summary at all → genuinely orphaned ZSET membership.
      stale.push(usernames[i]);
      return;
    }
    const obj = (
      typeof raw === "string" ? JSON.parse(raw) : raw
    ) as Record<string, unknown>;
    const elo = Number(obj.elo) || 0;
    entries.push({
      username: String(obj.username || usernames[i]),
      elo,
      wins: Number(obj.wins) || 0,
      losses: Number(obj.losses) || 0,
      edgeScore: Number(obj.edgeScore) || 0,
      faceDataUrl:
        typeof obj.faceDataUrl === "string" ? (obj.faceDataUrl as string) : null,
      countryCode:
        typeof obj.countryCode === "string" ? (obj.countryCode as string) : null,
      updatedAt: Number(obj.updatedAt) || 0
    });
  });
  // Best-effort cleanup of dangling ZSET members. Don't await — the
  // response should ship now, the cleanup runs in the background.
  if (stale.length > 0) {
    Promise.resolve(redis.zrem(LEADERBOARD_KEY, ...stale)).catch(() => {
      /* swallow */
    });
  }

  return NextResponse.json({ entries });
}
