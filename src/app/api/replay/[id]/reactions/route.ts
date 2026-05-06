import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const ALLOWED = ["🔥", "💀", "👑", "😂", "🗿", "🤡", "💎", "💪"];
const TTL_SEC = 60 * 60 * 24 * 30; // 30 days

function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return Redis.fromEnv();
}

const reactKey = (id: string) => `replay:reactions:v1:${id}`;

/**
 * GET /api/replay/[id]/reactions  → { counts: { emoji: count } }
 * POST /api/replay/[id]/reactions { emoji }  → { counts }
 *
 * No auth on POST — these are public reactions (think YouTube "👍").
 * One user dropping multiple reactions is fine; the score isn't
 * load-bearing on game logic. Allowed emoji set is whitelisted.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ counts: {} });
  const id = (params.id || "").slice(0, 64);
  const counts =
    (await redis.hgetall<Record<string, string>>(reactKey(id))) || {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    result[k] = Number(v) || 0;
  }
  return NextResponse.json({ counts: result });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "reactions_disabled" },
      { status: 503 }
    );
  }
  const id = (params.id || "").slice(0, 64);
  let body: { emoji?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const emoji = body.emoji;
  if (!emoji || !ALLOWED.includes(emoji)) {
    return NextResponse.json({ error: "invalid_emoji" }, { status: 400 });
  }
  await redis.hincrby(reactKey(id), emoji, 1);
  await redis.expire(reactKey(id), TTL_SEC);
  const counts =
    (await redis.hgetall<Record<string, string>>(reactKey(id))) || {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    result[k] = Number(v) || 0;
  }
  return NextResponse.json({ counts: result });
}
