import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getRedis, sessionKey } from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const REPORTS_KEY = "moderation:reports:v1";
const REPORTS_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const ALLOWED_REASONS = [
  "harassment",
  "filter",
  "minor",
  "impersonation",
  "spam",
  "other"
] as const;

type Report = {
  id: string;
  reporter: string;
  target: string;
  reason: (typeof ALLOWED_REASONS)[number];
  note?: string;
  ts: number;
  status: "open" | "actioned" | "dismissed";
};

const ADMIN_ALLOWLIST = new Set<string>(["jrubski"]);

function adminGate(redis: Redis, token: string): Promise<string | null> {
  return redis
    .get<string | { username: string }>(sessionKey(token))
    .then((raw) => {
      if (!raw) return null;
      const sess = typeof raw === "string" ? JSON.parse(raw) : raw;
      const u = String(sess?.username || "").toLowerCase();
      return ADMIN_ALLOWLIST.has(u) ? u : null;
    })
    .catch(() => null);
}

/**
 * POST /api/report  { target, reason, note? }
 *   File a moderation report against another user. Anyone signed in
 *   can submit; rate-limited to one per 60s per (reporter, target).
 *
 * GET /api/report?admin=1
 *   Admin-only view of the open queue. Allowlisted by username.
 *
 * PATCH /api/report  { id, status }
 *   Admin-only — mark a report as actioned / dismissed.
 */
export async function POST(req: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "moderation_disabled" }, { status: 503 });
  }
  const token = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return NextResponse.json({ error: "no_token" }, { status: 401 });
  const sessRaw = await redis.get<string | { username: string }>(
    sessionKey(token)
  );
  if (!sessRaw) {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }
  const sess = typeof sessRaw === "string" ? JSON.parse(sessRaw) : sessRaw;
  const reporter = String(sess.username).toLowerCase();

  let body: { target?: string; reason?: string; note?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const target = (body.target || "").toLowerCase().slice(0, 32);
  const reason = body.reason as (typeof ALLOWED_REASONS)[number];
  if (!target || target === reporter) {
    return NextResponse.json({ error: "bad_target" }, { status: 400 });
  }
  if (!ALLOWED_REASONS.includes(reason)) {
    return NextResponse.json({ error: "bad_reason" }, { status: 400 });
  }

  // Rate-limit: 1 report per (reporter, target) per 60s.
  const rateKey = `moderation:rl:v1:${reporter}:${target}`;
  const recent = await redis.get(rateKey);
  if (recent) {
    return NextResponse.json(
      { error: "too_many", message: "You already reported this user recently." },
      { status: 429 }
    );
  }
  await redis.set(rateKey, "1", { ex: 60 });

  const id = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const report: Report = {
    id,
    reporter,
    target,
    reason,
    note: typeof body.note === "string" ? body.note.slice(0, 240) : undefined,
    ts: Date.now(),
    status: "open"
  };
  await redis.lpush(REPORTS_KEY, JSON.stringify(report));
  await redis.expire(REPORTS_KEY, REPORTS_TTL_SEC);
  return NextResponse.json({ ok: true, id });
}

export async function GET(req: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "moderation_disabled" }, { status: 503 });
  }
  const token = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return NextResponse.json({ error: "no_token" }, { status: 401 });
  const admin = await adminGate(redis, token);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const raw = (await redis.lrange<string>(REPORTS_KEY, 0, 99)) || [];
  const reports: Report[] = raw
    .map((r) => {
      try {
        return JSON.parse(r) as Report;
      } catch {
        return null;
      }
    })
    .filter((r): r is Report => !!r);
  return NextResponse.json({ reports });
}

export async function PATCH(req: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "moderation_disabled" }, { status: 503 });
  }
  const token = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return NextResponse.json({ error: "no_token" }, { status: 401 });
  const admin = await adminGate(redis, token);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { id?: string; status?: "actioned" | "dismissed" } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!body.id || (body.status !== "actioned" && body.status !== "dismissed")) {
    return NextResponse.json({ error: "bad_input" }, { status: 400 });
  }

  // Linear scan + rewrite: small dataset (< 100), simpler than indexing.
  const raw = (await redis.lrange<string>(REPORTS_KEY, 0, -1)) || [];
  let found = false;
  const updated = raw.map((r) => {
    try {
      const rep = JSON.parse(r) as Report;
      if (rep.id === body.id) {
        rep.status = body.status as "actioned" | "dismissed";
        found = true;
        return JSON.stringify(rep);
      }
      return r;
    } catch {
      return r;
    }
  });
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await redis.del(REPORTS_KEY);
  if (updated.length > 0) {
    await redis.lpush(REPORTS_KEY, ...updated.reverse());
    await redis.expire(REPORTS_KEY, REPORTS_TTL_SEC);
  }
  return NextResponse.json({ ok: true });
}
