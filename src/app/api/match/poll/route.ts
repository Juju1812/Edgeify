import { NextResponse } from "next/server";
import { getRedis, pairKey } from "@/lib/matchmaking-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "matchmaking_disabled" },
      { status: 503 }
    );
  }

  let body: { peerId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const peerId = body.peerId;
  if (!peerId || typeof peerId !== "string") {
    return NextResponse.json({ error: "invalid_peerId" }, { status: 400 });
  }

  const raw = await redis.get<string | { opponentPeerId: string; opponentElo: number; iAmHost: boolean }>(pairKey(peerId));
  if (!raw) {
    return NextResponse.json({ matched: false });
  }

  // Once consumed, remove the pair key so a stale poll can't re-trigger.
  await redis.del(pairKey(peerId));

  const payload =
    typeof raw === "string"
      ? (JSON.parse(raw) as { opponentPeerId: string; opponentElo: number; iAmHost: boolean })
      : raw;

  return NextResponse.json({ matched: true, ...payload });
}
