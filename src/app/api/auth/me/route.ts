import { NextResponse } from "next/server";
import { getRedis, profileKey, sessionKey } from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

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

  const rawProfile = await redis.get<string | object>(profileKey(sess.username));
  const profile =
    typeof rawProfile === "string" ? JSON.parse(rawProfile) : rawProfile || null;

  return NextResponse.json({ username: sess.username, profile });
}
