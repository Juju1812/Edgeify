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

// "Mog of the day" — global ZSET of replays keyed by |eloDelta|.
// Trimmed to top 100 per day so the index can't grow unbounded.
// The /today page reads from this to surface biggest daily swings.
function utcDateKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  return `moments:v1:${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

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

  // Index by ELO swing. Practice / 0-delta matches are skipped.
  const eloDelta = Math.abs(Number(body?.eloDelta) || 0);
  if (eloDelta > 0) {
    const key = utcDateKey(Number(body?.playedAt) || Date.now());
    try {
      await redis.zadd(key, { score: eloDelta, member: id });
      // Keep only top 100 entries.
      await redis.zremrangebyrank(key, 0, -101);
      // 48h TTL so /today still has yesterday for a few hours past UTC midnight.
      await redis.expire(key, 60 * 60 * 48);
    } catch {
      /* indexing is best-effort */
    }
  }

  return NextResponse.json({ ok: true });
}
