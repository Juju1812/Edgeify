import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  generateSessionToken,
  getRedis,
  isValidPassword,
  isValidUsername,
  sessionKey,
  SESSION_TTL_SEC,
  userKey
} from "@/lib/auth-server";

export const runtime = "nodejs"; // bcryptjs needs Node, not Edge
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "auth_disabled", message: "Auth is not configured on this server." },
      { status: 503 }
    );
  }

  let body: { username?: string; password?: string; isOver18?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { username, password, isOver18 } = body;
  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "invalid_username", message: "Username must be 2–16 chars, letters/numbers/_/-." },
      { status: 400 }
    );
  }
  if (!isValidPassword(password)) {
    return NextResponse.json(
      { error: "weak_password", message: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }
  if (!isOver18) {
    return NextResponse.json(
      { error: "underage", message: "You must be 18 or older to play." },
      { status: 400 }
    );
  }

  const existing = await redis.hget(userKey(username), "passwordHash");
  if (existing) {
    return NextResponse.json(
      { error: "username_taken", message: "That callsign is already in use." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await redis.hset(userKey(username), {
    username,
    passwordHash,
    createdAt: String(Date.now())
  });

  const token = generateSessionToken();
  await redis.set(
    sessionKey(token),
    JSON.stringify({ username, expiresAt: Date.now() + SESSION_TTL_SEC * 1000 }),
    { ex: SESSION_TTL_SEC }
  );

  return NextResponse.json({ token, username });
}
