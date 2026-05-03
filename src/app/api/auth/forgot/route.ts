import { NextResponse } from "next/server";
import { generateSessionToken, getRedis, userKey } from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const resetKey = (token: string) => `pwreset:v1:${token}`;
const RESET_TTL_SEC = 60 * 60; // 1 hour

/**
 * POST /api/auth/forgot { username }
 *
 * Generates a one-time reset token tied to the username, valid for 1
 * hour. In production this would be emailed; for now we log it to the
 * server console (visible in `vercel logs`) so the project owner can
 * relay it manually if a user emails them. Returns 200 either way to
 * avoid leaking which usernames exist.
 */
export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ ok: true });

  let body: { username?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  const username = (body.username || "").trim();
  if (!username) return NextResponse.json({ ok: true });

  // Verify user exists; if not, succeed silently.
  const exists = await redis.hget(userKey(username), "passwordHash");
  if (!exists) return NextResponse.json({ ok: true });

  const token = generateSessionToken();
  await redis.set(resetKey(token), JSON.stringify({ username }), {
    ex: RESET_TTL_SEC
  });

  // In a production deploy with an email provider configured, this would
  // be a render+send call. For now, log so the project owner can pluck
  // it from server logs and DM/email it manually.
  // eslint-disable-next-line no-console
  console.log(`[edgify:forgot] reset token for ${username}: ${token}`);

  return NextResponse.json({ ok: true });
}
