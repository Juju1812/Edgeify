import { NextResponse } from "next/server";
import { getRedis } from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const replayKey = (id: string) => `replay:v1:${id}`;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ replay: null });
  const raw = await redis.get<string | object>(replayKey(params.id));
  if (!raw) return NextResponse.json({ replay: null });
  const replay = typeof raw === "string" ? JSON.parse(raw) : raw;
  return NextResponse.json({ replay });
}

const REPLAY_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "kv_off" }, { status: 503 });
  const body = await req.json();
  const id = String(body?.id || "");
  if (!id || id.length > 80) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }
  // Idempotent: if already saved, just return the URL.
  await redis.set(replayKey(id), JSON.stringify(body), { ex: REPLAY_TTL_SEC });
  return NextResponse.json({ ok: true });
}
