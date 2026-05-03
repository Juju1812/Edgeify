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

  let body: { code?: string; username?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { code, username } = body;
  if (!code || !username) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const raw = await redis.get<string | Tourney>(tourneyKey(code));
  if (!raw) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const tourney: Tourney =
    typeof raw === "string" ? JSON.parse(raw) : (raw as Tourney);

  if (tourney.host !== username) {
    return NextResponse.json({ error: "not_host" }, { status: 403 });
  }
  if (tourney.players.length !== tourney.size) {
    return NextResponse.json(
      { error: "not_full", message: `Need ${tourney.size} players to start.` },
      { status: 409 }
    );
  }
  if (tourney.state !== "lobby") {
    return NextResponse.json({ error: "already_started" }, { status: 409 });
  }

  tourney.state = "running";
  tourney.currentMatch = 0;

  await redis.set(tourneyKey(code), JSON.stringify(tourney), {
    ex: TOURNEY_TTL_SEC
  });

  return NextResponse.json({ tourney });
}
