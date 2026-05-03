import { NextResponse } from "next/server";
import {
  getRedis,
  LEADERBOARD_KEY,
  lbSummaryKey,
  onlineKey,
  ONLINE_TTL_SEC,
  profileKey,
  sessionKey
} from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const PROFILE_TTL_SEC = 60 * 60 * 24 * 365; // 1 year
const SUMMARY_TTL_SEC = 60 * 60 * 24 * 365;

export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "auth_disabled" }, { status: 503 });
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "no_token" }, { status: 401 });
  }

  const sessRaw = await redis.get<string | { username: string; expiresAt: number }>(
    sessionKey(token)
  );
  if (!sessRaw) {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }
  const sess = typeof sessRaw === "string" ? JSON.parse(sessRaw) : sessRaw;
  if (!sess?.username) {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const profile = body as Record<string, unknown>;
  const username = String(sess.username);

  // Keep the face thumbnail if it's <= ~80KB (resized 200x150 jpeg @0.7
  // is typically 8-15KB). Anything bigger we'd be wasting KV bandwidth.
  if (typeof profile.faceDataUrl === "string" && profile.faceDataUrl.length > 80_000) {
    profile.faceDataUrl = null;
  }

  await redis.set(profileKey(username), JSON.stringify(profile), {
    ex: PROFILE_TTL_SEC
  });

  // Leaderboard ZSET + condensed summary for the public list.
  const elo = Number(profile.elo) || 800;
  const placementsLeft = Number(profile.placementsLeft) || 0;
  const hasScanned = Boolean(profile.hasScanned);
  const hideFromBoard = Boolean(profile.hideFromBoard);

  // Only ranked, scanned, non-hidden users are on the leaderboard.
  if (hasScanned && placementsLeft === 0 && !hideFromBoard) {
    await redis.zadd(LEADERBOARD_KEY, { score: elo, member: username });
    const summary = {
      username,
      elo,
      wins: Number(profile.wins) || 0,
      losses: Number(profile.losses) || 0,
      edgeScore:
        profile.edgeScore && typeof profile.edgeScore === "object"
          ? Math.round(Number((profile.edgeScore as { composite?: number }).composite) || 50)
          : 50,
      faceDataUrl:
        typeof profile.faceDataUrl === "string" ? profile.faceDataUrl : null,
      countryCode: typeof profile.countryCode === "string" ? profile.countryCode : null,
      bio: typeof profile.bio === "string" ? profile.bio.slice(0, 140) : "",
      updatedAt: Date.now()
    };
    await redis.set(lbSummaryKey(username), JSON.stringify(summary), {
      ex: SUMMARY_TTL_SEC
    });
  } else {
    // Pulled out of leaderboard (un-ranked, hidden, or face-data deleted).
    await redis.zrem(LEADERBOARD_KEY, username);
    await redis.del(lbSummaryKey(username));
  }

  // Heartbeat — mark this user online for ~1 minute.
  await redis.set(onlineKey(username), String(Date.now()), { ex: ONLINE_TTL_SEC });

  return NextResponse.json({ ok: true });
}
