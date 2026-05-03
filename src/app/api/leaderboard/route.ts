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

  const entries = (summaries || []).map((raw, i) => {
    if (!raw) return { username: usernames[i], elo: 0, wins: 0, losses: 0, edgeScore: 0, faceDataUrl: null };
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      username: obj.username || usernames[i],
      elo: obj.elo || 0,
      wins: obj.wins || 0,
      losses: obj.losses || 0,
      edgeScore: obj.edgeScore || 0,
      faceDataUrl: obj.faceDataUrl || null
    };
  });

  return NextResponse.json({ entries });
}
