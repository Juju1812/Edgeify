import { NextResponse } from "next/server";
import { getRedis, peerKey, QUEUE_KEY } from "@/lib/matchmaking-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Lightweight live-stats endpoint:
 *   onlineCount   = number of online:v1:* keys (~60s heartbeat window)
 *   inQueueCount  = how many peers are waiting in matchmaking
 *
 * SCAN over online:v1:* in chunks. For a small user base (<10k) this is
 * fast enough. We don't expose the actual list of usernames.
 */
export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ onlineCount: 0, inQueueCount: 0 });
  }

  let onlineCount = 0;
  let cursor: string = "0";
  let safety = 20; // hard cap on scan iterations
  do {
    const res = (await redis.scan(cursor, {
      match: "online:v1:*",
      count: 200
    })) as [string, string[]];
    cursor = String(res[0]);
    onlineCount += (res[1] || []).length;
    safety -= 1;
  } while (cursor !== "0" && safety > 0);

  // Raw ZSET membership over-counts because closed tabs leave phantom
  // entries whose peerKey hash has already expired. Take the top 30
  // queue IDs and only count those whose peerKey still exists.
  let inQueueCount = 0;
  try {
    const ids = (await redis.zrange<string[]>(QUEUE_KEY, 0, 29)) || [];
    if (ids.length > 0) {
      const probes = await Promise.all(
        ids.map((id) => redis.exists(peerKey(id)))
      );
      inQueueCount = probes.filter((p) => p === 1).length;
    }
  } catch {
    /* */
  }

  return NextResponse.json({ onlineCount, inQueueCount });
}
