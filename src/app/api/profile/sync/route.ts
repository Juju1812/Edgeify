import { NextResponse } from "next/server";
import {
  getRedis,
  LEADERBOARD_KEY,
  lbSummaryKey,
  onlineKey,
  ONLINE_TTL_SEC,
  profileKey,
  sessionKey
} from "@/lib/auth-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const PROFILE_TTL_SEC = 60 * 60 * 24 * 365; // 1 year
const SUMMARY_TTL_SEC = 60 * 60 * 24 * 365;

// ─── Anti-cheat thresholds ──────────────────────────────────────────
// These are the max plausible deltas between two consecutive syncs of
// the same user. Sync fires on every state change (debounced 1.5s),
// so within a single sync we only ever expect AT MOST one match's
// worth of progression. Anything bigger is treated as tampering.
const MAX_MATCHES_PER_SYNC = 2; // wins + losses delta
const MAX_ELO_DELTA_PER_SYNC = 80;
const MAX_ELO_VALUE = 3000;
const MAX_WINS_VALUE = 100_000;
const MAX_LOSSES_VALUE = 100_000;

type ServerProfile = Record<string, unknown>;

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Validate the incoming profile against the previously persisted one.
 * Returns null if accepted, or { reason, repaired } where `repaired`
 * is the patched-in-place version we'll store instead of rejecting
 * outright (so the user doesn't see a hard error toast for routine
 * tampering — the suspicious fields just get clamped back).
 */
function validateProgression(
  prior: ServerProfile | null,
  next: ServerProfile
): { ok: true } | { ok: false; reason: string; repaired: ServerProfile } {
  const repaired = { ...next };

  // 1) Hard caps on values (defends against straight-up bogus inputs).
  const elo = num(next.elo, 800);
  if (elo > MAX_ELO_VALUE || elo < 0) {
    repaired.elo = Math.max(0, Math.min(MAX_ELO_VALUE, elo));
  }
  const wins = num(next.wins, 0);
  if (wins < 0 || wins > MAX_WINS_VALUE) {
    repaired.wins = Math.max(0, Math.min(MAX_WINS_VALUE, wins));
  }
  const losses = num(next.losses, 0);
  if (losses < 0 || losses > MAX_LOSSES_VALUE) {
    repaired.losses = Math.max(0, Math.min(MAX_LOSSES_VALUE, losses));
  }
  const peakElo = num(next.peakElo, repaired.elo as number);
  if (peakElo > MAX_ELO_VALUE) {
    repaired.peakElo = MAX_ELO_VALUE;
  }

  if (!prior) {
    // First sync for this user — no baseline to compare against. We
    // still apply hard caps but allow any starting state up to MAX_*.
    return { ok: true };
  }

  // 2) Wins / losses can only go UP, never down (no season-rollover
  //    resets either of these counters, so monotonic is correct).
  const priorWins = num(prior.wins, 0);
  const priorLosses = num(prior.losses, 0);
  const priorElo = num(prior.elo, 800);

  if (wins < priorWins) {
    repaired.wins = priorWins;
  }
  if (losses < priorLosses) {
    repaired.losses = priorLosses;
  }

  // 3) Per-sync match-count delta cap.
  const winDelta = wins - priorWins;
  const lossDelta = losses - priorLosses;
  const matchDelta = winDelta + lossDelta;
  if (matchDelta > MAX_MATCHES_PER_SYNC) {
    return {
      ok: false,
      reason: `match_delta_too_high (${matchDelta} > ${MAX_MATCHES_PER_SYNC})`,
      repaired: {
        ...repaired,
        wins: priorWins,
        losses: priorLosses,
        elo: priorElo
      }
    };
  }

  // 4) ELO can move by at most ~50 per ranked match, with placement
  //    matches up to ~80. Cap the per-sync delta accordingly.
  const eloDelta = Math.abs(elo - priorElo);
  const eloBudget =
    matchDelta * MAX_ELO_DELTA_PER_SYNC + (matchDelta === 0 ? 5 : 0);
  if (eloDelta > eloBudget) {
    return {
      ok: false,
      reason: `elo_delta_too_high (Δ${eloDelta} > budget ${eloBudget})`,
      repaired: {
        ...repaired,
        elo: priorElo
      }
    };
  }

  return { ok: true };
}

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

  const profile = body as ServerProfile;
  const username = String(sess.username);

  // Read the previously-stored profile so we can validate progression.
  const priorRaw = await redis.get<string | ServerProfile>(profileKey(username));
  const prior: ServerProfile | null = priorRaw
    ? typeof priorRaw === "string"
      ? JSON.parse(priorRaw)
      : (priorRaw as ServerProfile)
    : null;

  // Anti-cheat — check the delta against the prior persisted state.
  const verdict = validateProgression(prior, profile);
  let toStore: ServerProfile;
  let antiCheatRejected = false;
  if (verdict.ok) {
    toStore = profile;
  } else {
    // Soft-reject: log the reason, persist the repaired version, and
    // return 422 so the client can refetch authoritative state.
    // eslint-disable-next-line no-console
    console.warn(
      `[edgify:sync] anti-cheat rejected for ${username}: ${verdict.reason}`
    );
    toStore = verdict.repaired;
    antiCheatRejected = true;
  }

  // Keep the face thumbnail if it's <= ~80KB (resized 200x150 jpeg @0.7
  // is typically 8-15KB). Anything bigger we'd be wasting KV bandwidth.
  if (typeof toStore.faceDataUrl === "string" && (toStore.faceDataUrl as string).length > 80_000) {
    toStore.faceDataUrl = null;
  }

  await redis.set(profileKey(username), JSON.stringify(toStore), {
    ex: PROFILE_TTL_SEC
  });

  // Leaderboard ZSET + condensed summary for the public list.
  const elo = Number(toStore.elo) || 800;
  const placementsLeft = Number(toStore.placementsLeft) || 0;
  const hasScanned = Boolean(toStore.hasScanned);
  const hideFromBoard = Boolean(toStore.hideFromBoard);

  // Only ranked, scanned, non-hidden users are on the leaderboard.
  if (hasScanned && placementsLeft === 0 && !hideFromBoard) {
    await redis.zadd(LEADERBOARD_KEY, { score: elo, member: username });
    const summary = {
      username,
      elo,
      wins: Number(toStore.wins) || 0,
      losses: Number(toStore.losses) || 0,
      edgeScore:
        toStore.edgeScore && typeof toStore.edgeScore === "object"
          ? Math.round(Number((toStore.edgeScore as { composite?: number }).composite) || 50)
          : 50,
      faceDataUrl:
        typeof toStore.faceDataUrl === "string" ? toStore.faceDataUrl : null,
      countryCode: typeof toStore.countryCode === "string" ? toStore.countryCode : null,
      bio: typeof toStore.bio === "string" ? toStore.bio.slice(0, 140) : "",
      updatedAt: Date.now()
    };
    await redis.set(lbSummaryKey(username), JSON.stringify(summary), {
      ex: SUMMARY_TTL_SEC
    });
  } else {
    // Pulled out of leaderboard (un-ranked, hidden, or face-data deleted).
    await redis.zrem(LEADERBOARD_KEY, username);
    await redis.del(lbSummaryKey(username));
  }

  // Heartbeat — mark this user online for ~1 minute.
  await redis.set(onlineKey(username), String(Date.now()), { ex: ONLINE_TTL_SEC });

  if (antiCheatRejected) {
    // 422 = unprocessable. Client can re-fetch from /api/auth/me to get
    // the authoritative state and reconcile.
    return NextResponse.json(
      { error: "anti_cheat_rejected", profile: toStore },
      { status: 422 }
    );
  }
  return NextResponse.json({ ok: true });
}
