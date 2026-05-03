import { NextResponse } from "next/server";
import { getRedis, sessionKey } from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ ok: true });

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token) {
    await redis.del(sessionKey(token));
  }
  return NextResponse.json({ ok: true });
}
