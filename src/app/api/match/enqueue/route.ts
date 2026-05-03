import { NextResponse } from "next/server";
import {
  getRedis,
  pairKey,
  peerKey,
  QUEUE_KEY,
  WAIT_TTL_SEC,
  PAIR_TTL_SEC,
  type PeerInfo
} from "@/lib/matchmaking-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      {
        error: "matchmaking_disabled",
        message:
          "Matchmaking isn't configured on the server. Provision Vercel KV in the project's Storage tab to enable random matches."
      },
      { status: 503 }
    );
  }

  let body: { peerId?: string; elo?: number; placementsLeft?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const peerId = body.peerId;
  const elo = Number.isFinite(body.elo) ? Number(body.elo) : 1000;
  const placementsLeft = Number.isFinite(body.placementsLeft)
    ? Number(body.placementsLeft)
    : 0;

  if (!peerId || typeof peerId !== "string" || peerId.length > 80) {
    return NextResponse.json({ error: "invalid_peerId" }, { status: 400 });
  }

  // Look at up to a small batch of oldest waiters and try to claim one.
  // The atomic ZREM ensures only one claimer wins each waiter.
  const candidates = (await redis.zrange<string[]>(QUEUE_KEY, 0, 4)) || [];
  for (const oppId of candidates) {
    if (oppId === peerId) continue;
    const removed = await redis.zrem(QUEUE_KEY, oppId);
    if (removed > 0) {
      const oppData = (await redis.hgetall<Record<string, string>>(
        peerKey(oppId)
      )) || {};
      await redis.del(peerKey(oppId));

      const oppElo = parseInt(oppData.elo || "1000", 10) || 1000;

      // Notify the waiting peer via their pair key.
      await redis.set(
        pairKey(oppId),
        JSON.stringify({
          opponentPeerId: peerId,
          opponentElo: elo,
          iAmHost: true
        }),
        { ex: PAIR_TTL_SEC }
      );

      return NextResponse.json({
        matched: true,
        opponentPeerId: oppId,
        opponentElo: oppElo,
        iAmHost: false
      });
    }
  }

  // No claimable opponent — enqueue self.
  const now = Date.now();
  const info: PeerInfo = { elo, placementsLeft, ts: now };
  await redis.zadd(QUEUE_KEY, { score: now, member: peerId });
  await redis.hset(peerKey(peerId), {
    elo: String(info.elo),
    placementsLeft: String(info.placementsLeft),
    ts: String(info.ts)
  });
  await redis.expire(peerKey(peerId), WAIT_TTL_SEC);

  return NextResponse.json({ matched: false });
}
