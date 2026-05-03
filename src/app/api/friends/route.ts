import { NextResponse } from "next/server";
import { getRedis, sessionKey } from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const friendsKey = (u: string) => `friends:v1:${u.toLowerCase()}`;

async function authedUser(req: Request): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const sessRaw = await redis.get<string | { username: string }>(sessionKey(token));
  if (!sessRaw) return null;
  const sess = typeof sessRaw === "string" ? JSON.parse(sessRaw) : sessRaw;
  return sess?.username || null;
}

/**
 * GET /api/friends → list of friend usernames + their lb summaries
 *   (call without an "action" body)
 * POST /api/friends with body {action:"add"|"remove", target} → mutate
 */
export async function GET(req: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ friends: [] });
  const me = await authedUser(req);
  if (!me) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const list = (await redis.smembers(friendsKey(me))) || [];
  if (list.length === 0) return NextResponse.json({ friends: [] });

  const summaries = await redis.mget<Array<string | object | null>>(
    ...list.map((u) => `lb:summary:v1:${u.toLowerCase()}`)
  );
  const onlines = await redis.mget<Array<string | null>>(
    ...list.map((u) => `online:v1:${u.toLowerCase()}`)
  );

  const friends = list.map((u, i) => {
    const raw = summaries[i];
    const obj = raw && typeof raw === "string" ? JSON.parse(raw) : raw || {};
    return {
      username: u,
      online: !!onlines[i],
      elo: (obj as { elo?: number }).elo || 0,
      faceDataUrl: (obj as { faceDataUrl?: string }).faceDataUrl || null,
      countryCode: (obj as { countryCode?: string }).countryCode || null
    };
  });
  return NextResponse.json({ friends });
}

export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "kv_off" }, { status: 503 });
  const me = await authedUser(req);
  if (!me) return NextResponse.json({ error: "unauth" }, { status: 401 });

  let body: { action?: string; target?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const target = (body.target || "").trim();
  if (!target || target.toLowerCase() === me.toLowerCase()) {
    return NextResponse.json({ error: "bad_target" }, { status: 400 });
  }

  // Verify target is a real user
  const exists = await redis.hget(`user:${target.toLowerCase()}`, "passwordHash");
  if (!exists) return NextResponse.json({ error: "no_such_user" }, { status: 404 });

  if (body.action === "add") {
    await redis.sadd(friendsKey(me), target);
  } else if (body.action === "remove") {
    await redis.srem(friendsKey(me), target);
  } else {
    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
