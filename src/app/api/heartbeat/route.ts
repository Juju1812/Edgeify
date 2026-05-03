import { NextResponse } from "next/server";
import {
  getRedis,
  onlineKey,
  ONLINE_TTL_SEC,
  sessionKey
} from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Authed clients ping this every ~30 seconds. We bump a key keyed by
 * username with a 60s TTL so /api/stats can count active users by
 * scanning that key prefix.
 */
export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ ok: true });

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ ok: true });

  const sessRaw = await redis.get<string | { username: string }>(sessionKey(token));
  if (!sessRaw) return NextResponse.json({ ok: true });
  const sess = typeof sessRaw === "string" ? JSON.parse(sessRaw) : sessRaw;
  if (!sess?.username) return NextResponse.json({ ok: true });

  await redis.set(onlineKey(sess.username), String(Date.now()), {
    ex: ONLINE_TTL_SEC
  });

  return NextResponse.json({ ok: true });
}
