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

  let body: {
    peerId?: string;
    elo?: number;
    placementsLeft?: number;
    username?: string;
    blocklist?: string[];
  } = {};
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
  const username = (body.username || "").toLowerCase();
  const blocklist = Array.isArray(body.blocklist)
    ? body.blocklist.map((u) => String(u).toLowerCase())
    : [];

  if (!peerId || typeof peerId !== "string" || peerId.length > 80) {
    return NextResponse.json({ error: "invalid_peerId" }, { status: 400 });
  }

  // ELO-band matchmaking: prefer waiters within ±150 ELO of us. Scan up
  // to 16 oldest seekers and pick the first one that's in band (or any
  // candidate if either side is in placements). The band widens
  // implicitly: if nobody matches our tight band, we self-enqueue, and
  // by the time we're polled-against by a later arrival our ts will be
  // older so the new arrival's `prefer oldest` heuristic accepts us.
  const TIGHT_BAND = 150;
  const candidates = (await redis.zrange<string[]>(QUEUE_KEY, 0, 15)) || [];

  for (const oppId of candidates) {
    if (oppId === peerId) continue;

    const oppData =
      (await redis.hgetall<Record<string, string>>(peerKey(oppId))) || {};
    const oppElo = parseInt(oppData.elo || "1000", 10) || 1000;
    const oppPlacements = parseInt(oppData.placementsLeft || "0", 10) || 0;
    const oppUsername = (oppData.username || "").toLowerCase();
    const oppBlocklist: string[] = (() => {
      try {
        return JSON.parse(oppData.blocklist || "[]") as string[];
      } catch {
        return [];
      }
    })();
    const eitherCalibrating = placementsLeft > 0 || oppPlacements > 0;

    // Block-list: never match users who blocked each other.
    if (
      (oppUsername && blocklist.includes(oppUsername)) ||
      (username && oppBlocklist.includes(username))
    ) {
      continue;
    }

    if (!eitherCalibrating && Math.abs(oppElo - elo) > TIGHT_BAND) {
      continue;
    }

    const removed = await redis.zrem(QUEUE_KEY, oppId);
    if (removed > 0) {
      await redis.del(peerKey(oppId));

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
    ts: String(info.ts),
    username,
    blocklist: JSON.stringify(blocklist.slice(0, 50))
  });
  await redis.expire(peerKey(peerId), WAIT_TTL_SEC);

  return NextResponse.json({ matched: false });
}
