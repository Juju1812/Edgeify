import { NextResponse } from "next/server";
import {
  getRedis,
  tourneyKey,
  TOURNEY_TTL_SEC,
  type Tourney
} from "@/lib/tournament-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Report the winner of the current match. Idempotent — re-reporting the
 * same winner for the same match is fine; reporting a different one
 * gets ignored (whoever's report lands first wins). Once both
 * semifinals are done, the third match is automatically populated.
 */
export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "tournaments_disabled" }, { status: 503 });
  }

  let body: { code?: string; matchIdx?: number; winnerIdx?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { code, matchIdx, winnerIdx } = body;
  if (
    !code ||
    typeof matchIdx !== "number" ||
    typeof winnerIdx !== "number"
  ) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const raw = await redis.get<string | Tourney>(tourneyKey(code));
  if (!raw) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const tourney: Tourney =
    typeof raw === "string" ? JSON.parse(raw) : (raw as Tourney);

  if (matchIdx < 0 || matchIdx >= tourney.matches.length) {
    return NextResponse.json({ error: "bad_match" }, { status: 400 });
  }
  const match = tourney.matches[matchIdx];

  // First report wins. Subsequent (re)reports of same winner are idempotent.
  if (match.winner === null) {
    match.winner = winnerIdx;

    // Advance the bracket. Once both semis are decided, populate final.
    if (
      matchIdx < 2 &&
      tourney.matches[0].winner !== null &&
      tourney.matches[1].winner !== null
    ) {
      tourney.matches[2].a = tourney.matches[0].winner;
      tourney.matches[2].b = tourney.matches[1].winner;
    }

    // Advance current match pointer.
    if (matchIdx === 0) tourney.currentMatch = 1;
    else if (matchIdx === 1) tourney.currentMatch = 2;
    else if (matchIdx === 2) {
      tourney.state = "done";
      tourney.currentMatch = 3;
      tourney.champion = winnerIdx;
    }

    await redis.set(tourneyKey(code), JSON.stringify(tourney), {
      ex: TOURNEY_TTL_SEC
    });
  }

  return NextResponse.json({ tourney });
}
