import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  getRedis,
  isValidPassword,
  sessionKey,
  generateSessionToken,
  SESSION_TTL_SEC,
  userKey
} from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resetKey = (token: string) => `pwreset:v1:${token}`;

/**
 * POST /api/auth/reset { token, newPassword }
 *
 * Consumes a reset token, sets a new password, and returns a fresh
 * session token so the user is signed in immediately.
 */
export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "auth_disabled" }, { status: 503 });
  }

  let body: { token?: string; newPassword?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { token, newPassword } = body;
  if (!token || !isValidPassword(newPassword)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const raw = await redis.get<string | { username: string }>(resetKey(token));
  if (!raw) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const username = parsed.username as string;

  // Single-use token.
  await redis.del(resetKey(token));

  const hash = await bcrypt.hash(newPassword!, 10);
  await redis.hset(userKey(username), { passwordHash: hash });

  // Issue a new session.
  const session = generateSessionToken();
  await redis.set(
    sessionKey(session),
    JSON.stringify({ username, expiresAt: Date.now() + SESSION_TTL_SEC * 1000 }),
    { ex: SESSION_TTL_SEC }
  );

  return NextResponse.json({ token: session, username });
}
