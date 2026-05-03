import { NextResponse } from "next/server";
import {
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

  let body: { code?: string; username?: string; peerId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { code, username, peerId } = body;
  if (!code || !username || !peerId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const raw = await redis.get<string | Tourney>(tourneyKey(code));
  if (!raw) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const tourney: Tourney =
    typeof raw === "string" ? JSON.parse(raw) : (raw as Tourney);

  if (tourney.state !== "lobby") {
    return NextResponse.json({ error: "already_started" }, { status: 409 });
  }

  // Already joined? Update peerId (might have refreshed) and return.
  const existingIdx = tourney.players.findIndex((p) => p.username === username);
  if (existingIdx >= 0) {
    tourney.players[existingIdx].peerId = peerId;
  } else {
    if (tourney.players.length >= tourney.size) {
      return NextResponse.json({ error: "full" }, { status: 409 });
    }
    tourney.players.push({ username, peerId });
  }

  await redis.set(tourneyKey(code), JSON.stringify(tourney), {
    ex: TOURNEY_TTL_SEC
  });

  return NextResponse.json({ tourney });
}
