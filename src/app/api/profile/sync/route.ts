import { NextResponse } from "next/server";
import { getRedis, profileKey, sessionKey } from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const PROFILE_TTL_SEC = 60 * 60 * 24 * 365; // 1 year

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

  // Strip the saved face data URL if it's huge — KV has size limits and
  // there's no need to round-trip megabytes of base64 jpeg per save.
  const sanitized = { ...(body as Record<string, unknown>) };
  if (typeof sanitized.faceDataUrl === "string" && sanitized.faceDataUrl.length > 500_000) {
    sanitized.faceDataUrl = null;
  }

  await redis.set(profileKey(sess.username), JSON.stringify(sanitized), {
    ex: PROFILE_TTL_SEC
  });

  return NextResponse.json({ ok: true });
}
