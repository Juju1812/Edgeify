import { NextResponse } from "next/server";
import {
  getRedis,
  pairKey,
  peerKey,
  QUEUE_KEY,
  PAIR_TTL_SEC
} from "@/lib/matchmaking-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * /api/match/poll
 *
 * Two-step check, both halves are necessary:
 *
 *   1. Read this peer's pair key. If set, the other side already
 *      claimed us — return matched.
 *
 *   2. Otherwise, scan the queue for any other waiter and try to claim
 *      them ourselves. This is the symmetric backstop for the case
 *      where two clients self-enqueued in the same instant (eventually-
 *      consistent reads on Upstash can let both see "queue empty" at
 *      the same time and both write themselves in). Without step 2 they
 *      sit forever — step 2 means whichever side polls first claims the
 *      other and both proceed in <=1.5s.
 *
 * The atomic primitive that prevents double-claims is `zrem` — if two
 * pollers race for the same waiter, only one zrem returns 1; the other
 * gets 0 and falls through.
 */
export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "matchmaking_disabled" },
      { status: 503 }
    );
  }

  let body: { peerId?: string; elo?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const peerId = body.peerId;
  const myElo = Number.isFinite(body.elo) ? Number(body.elo) : 1000;
  if (!peerId || typeof peerId !== "string") {
    return NextResponse.json({ error: "invalid_peerId" }, { status: 400 });
  }

  // ── Step 1: pair key set by another peer's enqueue / poll? ────────
  const raw = await redis.get<
    string | { opponentPeerId: string; opponentElo: number; iAmHost: boolean }
  >(pairKey(peerId));
  if (raw) {
    await redis.del(pairKey(peerId));
    const payload =
      typeof raw === "string"
        ? (JSON.parse(raw) as {
            opponentPeerId: string;
            opponentElo: number;
            iAmHost: boolean;
          })
        : raw;
    return NextResponse.json({ matched: true, ...payload });
  }

  // ── Step 2: try to claim a waiter ourselves. ──────────────────────
  const candidates = (await redis.zrange<string[]>(QUEUE_KEY, 0, 15)) || [];
  for (const oppId of candidates) {
    if (oppId === peerId) continue;
    // Probe peerKey FIRST — if it expired, the ZSET row is a phantom
    // and a claim would just create a dead-pair. zrem the phantom and
    // skip without claiming.
    const probe =
      (await redis.hgetall<Record<string, string>>(peerKey(oppId))) || {};
    if (Object.keys(probe).length === 0) {
      await redis.zrem(QUEUE_KEY, oppId);
      continue;
    }
    const removed = await redis.zrem(QUEUE_KEY, oppId);
    if (removed > 0) {
      const oppElo = parseInt(probe.elo || "1000", 10) || 1000;
      await redis.del(peerKey(oppId));

      // Tell the claimed peer who claimed them.
      await redis.set(
        pairKey(oppId),
        JSON.stringify({
          opponentPeerId: peerId,
          opponentElo: myElo,
          iAmHost: true
        }),
        { ex: PAIR_TTL_SEC }
      );

      // Pull ourselves out of the queue too — we're matched now.
      await redis.zrem(QUEUE_KEY, peerId);
      await redis.del(peerKey(peerId));

      return NextResponse.json({
        matched: true,
        opponentPeerId: oppId,
        opponentElo: oppElo,
        iAmHost: false
      });
    }
  }

  return NextResponse.json({ matched: false });
}
