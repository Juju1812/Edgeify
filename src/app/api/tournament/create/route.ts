import { NextResponse } from "next/server";
import {
  emptyBracket,
  generateCode,
  getRedis,
  tourneyKey,
  TOURNEY_TTL_SEC,
  type Tourney
} from "@/lib/tournament-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "tournaments_disabled" }, { status: 503 });
  }

  let body: { username?: string; peerId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { username, peerId } = body;
  if (!username || !peerId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Find a unique code (collisions are extremely unlikely with 6-char A-Z2-9).
  let code = generateCode();
  for (let i = 0; i < 5; i++) {
    const exists = await redis.get(tourneyKey(code));
    if (!exists) break;
    code = generateCode();
  }

  const tourney: Tourney = {
    code,
    host: username,
    size: 4,
    state: "lobby",
    players: [{ username, peerId }],
    matches: emptyBracket(),
    currentMatch: -1,
    champion: null,
    createdAt: Date.now()
  };

  await redis.set(tourneyKey(code), JSON.stringify(tourney), {
    ex: TOURNEY_TTL_SEC
  });

  return NextResponse.json({ tourney });
}
