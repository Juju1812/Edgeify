import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  generateSessionToken,
  getRedis,
  isValidPassword,
  isValidUsername,
  profileKey,
  sessionKey,
  SESSION_TTL_SEC,
  userKey
} from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "auth_disabled" },
      { status: 503 }
    );
  }

  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { username, password } = body;
  if (!isValidUsername(username) || !isValidPassword(password)) {
    return NextResponse.json(
      { error: "invalid_credentials" },
      { status: 400 }
    );
  }

  const stored = (await redis.hgetall<Record<string, string>>(userKey(username))) || {};
  const passwordHash = stored.passwordHash;
  if (!passwordHash) {
    return NextResponse.json(
      { error: "invalid_credentials", message: "Wrong callsign or password." },
      { status: 401 }
    );
  }

  const ok = await bcrypt.compare(password, passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "invalid_credentials", message: "Wrong callsign or password." },
      { status: 401 }
    );
  }

  const token = generateSessionToken();
  await redis.set(
    sessionKey(token),
    JSON.stringify({ username, expiresAt: Date.now() + SESSION_TTL_SEC * 1000 }),
    { ex: SESSION_TTL_SEC }
  );

  // Return the saved profile (if any) so the client can rehydrate state.
  const rawProfile = await redis.get<string | object>(profileKey(username));
  const profile =
    typeof rawProfile === "string" ? JSON.parse(rawProfile) : rawProfile || null;

  return NextResponse.json({ token, username, profile });
}
