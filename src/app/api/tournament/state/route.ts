import { NextResponse } from "next/server";
import { getRedis, tourneyKey, type Tourney } from "@/lib/tournament-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ tourney: null });

  let body: { code?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const code = body.code;
  if (!code) return NextResponse.json({ error: "missing_code" }, { status: 400 });

  const raw = await redis.get<string | Tourney>(tourneyKey(code));
  if (!raw) return NextResponse.json({ tourney: null });
  const tourney: Tourney =
    typeof raw === "string" ? JSON.parse(raw) : (raw as Tourney);

  return NextResponse.json({ tourney });
}
