import { NextResponse } from "next/server";
import {
  getRedis,
  pairKey,
  peerKey,
  QUEUE_KEY
} from "@/lib/matchmaking-server";

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

  await redis.zrem(QUEUE_KEY, peerId);
  await redis.del(peerKey(peerId));
  await redis.del(pairKey(peerId));

  return NextResponse.json({ ok: true });
}
