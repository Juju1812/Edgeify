import { NextResponse } from "next/server";
import { getRedis } from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const ALLOWED = ["fire", "crown", "skull", "goat", "clown"] as const;
type Emoji = (typeof ALLOWED)[number];

const reactionsKey = (u: string) => `reactions:v1:${u.toLowerCase()}`;
// Per-actor cooldown so we can't infinitely spam a single profile.
const cooldownKey = (target: string, actor: string) =>
  `reactions:cd:v1:${target.toLowerCase()}:${actor.toLowerCase()}`;
const COOLDOWN_SEC = 60;

/**
 * GET /api/reactions/USERNAME
 *   → { fire: 12, crown: 4, ... }
 *
 * POST /api/reactions/USERNAME { emoji: "fire", actor: "JRUBSKI" }
 *   Increments the counter. `actor` is best-effort (client-supplied,
 *   we don't validate against a session) so spamming is mitigated by
 *   the per-(target, actor) 60s cooldown.
 */
export async function GET(
  _req: Request,
  { params }: { params: { username: string } }
) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ counts: {} });
  const username = (params.username || "").trim();
  if (!username) return NextResponse.json({ counts: {} });
  const raw = await redis.hgetall<Record<string, string>>(reactionsKey(username));
  const counts: Record<string, number> = {};
  if (raw) {
    for (const [k, v] of Object.entries(raw)) {
      const n = Number(v);
      if (Number.isFinite(n)) counts[k] = n;
    }
  }
  return NextResponse.json({ counts });
}

export async function POST(
  req: Request,
  { params }: { params: { username: string } }
) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "kv_off" }, { status: 503 });
  const username = (params.username || "").trim();
  if (!username) return NextResponse.json({ error: "bad_username" }, { status: 400 });

  let body: { emoji?: string; actor?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const emoji = (body.emoji || "").toLowerCase() as Emoji;
  if (!ALLOWED.includes(emoji)) {
    return NextResponse.json({ error: "bad_emoji" }, { status: 400 });
  }
  const actor = (body.actor || "anon").slice(0, 24);

  // Cooldown — silently allow if the same actor reacts again within
  // 60s, but DON'T increment, so the count is meaningful.
  const cd = await redis.get(cooldownKey(username, actor));
  if (!cd) {
    await redis.hincrby(reactionsKey(username), emoji, 1);
    await redis.set(cooldownKey(username, actor), "1", { ex: COOLDOWN_SEC });
  }
  const counts = (await redis.hgetall<Record<string, string>>(
    reactionsKey(username)
  )) || {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return NextResponse.json({ counts: out });
}
