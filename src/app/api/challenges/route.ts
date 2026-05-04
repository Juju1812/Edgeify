import { NextResponse } from "next/server";
import {
  getRedis,
  sessionKey,
  userKey,
  isValidUsername
} from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const challengesKey = (target: string) => `challenges:v1:${target.toLowerCase()}`;
const CHALLENGE_TTL_SEC = 60 * 60 * 24; // 1 day

type Challenge = {
  from: string;
  message: string;
  createdAt: number;
};

async function authedUser(req: Request) {
  const redis = getRedis();
  if (!redis) return null;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const sess = await redis.get<string | { username: string }>(sessionKey(token));
  if (!sess) return null;
  const obj = typeof sess === "string" ? JSON.parse(sess) : sess;
  return obj?.username ? String(obj.username) : null;
}

/**
 * GET /api/challenges → list pending challenges for the authed user.
 *
 * POST /api/challenges { target, message } → send a challenge.
 *
 * DELETE /api/challenges?from=USERNAME → dismiss a single challenge.
 */
export async function GET(req: Request) {
  const me = await authedUser(req);
  if (!me) return NextResponse.json({ error: "no_session" }, { status: 401 });
  const redis = getRedis()!;
  const raw = await redis.get<string | Challenge[]>(challengesKey(me));
  const list = !raw ? [] : typeof raw === "string" ? JSON.parse(raw) : raw;
  return NextResponse.json({ challenges: list });
}

export async function POST(req: Request) {
  const me = await authedUser(req);
  if (!me) return NextResponse.json({ error: "no_session" }, { status: 401 });
  const redis = getRedis()!;

  let body: { target?: string; message?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const target = (body.target || "").trim();
  if (!isValidUsername(target)) {
    return NextResponse.json({ error: "bad_target" }, { status: 400 });
  }
  // Confirm target exists.
  const exists = await redis.hget(userKey(target), "passwordHash");
  if (!exists) {
    return NextResponse.json({ error: "no_such_user" }, { status: 404 });
  }
  // Append to target's queue, cap to 30.
  const raw = await redis.get<string | Challenge[]>(challengesKey(target));
  const list: Challenge[] = !raw ? [] : typeof raw === "string" ? JSON.parse(raw) : raw;
  // Drop any prior pending challenge from the same sender.
  const filtered = list.filter((c) => c.from.toLowerCase() !== me.toLowerCase());
  const message = (body.message || "").slice(0, 140);
  filtered.unshift({
    from: me,
    message,
    createdAt: Date.now()
  });
  await redis.set(challengesKey(target), JSON.stringify(filtered.slice(0, 30)), {
    ex: CHALLENGE_TTL_SEC
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const me = await authedUser(req);
  if (!me) return NextResponse.json({ error: "no_session" }, { status: 401 });
  const redis = getRedis()!;
  const url = new URL(req.url);
  const from = (url.searchParams.get("from") || "").trim();
  const raw = await redis.get<string | Challenge[]>(challengesKey(me));
  const list: Challenge[] = !raw ? [] : typeof raw === "string" ? JSON.parse(raw) : raw;
  const filtered = list.filter((c) => c.from.toLowerCase() !== from.toLowerCase());
  await redis.set(challengesKey(me), JSON.stringify(filtered), {
    ex: CHALLENGE_TTL_SEC
  });
  return NextResponse.json({ ok: true });
}
