import "server-only";
import { redis, K } from "./redis";
import { HttpError } from "./http";
import { randomToken } from "./auth";
import { addReading, getProfile, saveProfile } from "./profile";
import { eloDelta } from "@/lib/shared/elo";
import {
  CAPTURE_WINDOW_MS,
  CONNECT_WINDOW_MS,
  COUNTDOWN_MS,
  type MatchKind,
  type MatchResult,
  type MatchScore,
  type MatchState,
  type MatchView
} from "@/lib/shared/match-types";
import { SCORE_SCALE_VERSION, TRAIT_KEYS } from "@/lib/shared/types";

export type Match = {
  id: string;
  kind: MatchKind;
  players: [string, string]; // [host, guest] — canonical usernames
  createdAt: number;
  state: MatchState;
  ready: string[]; // lowercased
  startAt: number | null;
  scores: Record<string, MatchScore>; // keyed lowercased
  attempts: Record<string, number>;
  result: MatchResult | null;
  tourney: string | null;
};

const MATCH_TTL = 60 * 60 * 6;
const ACTIVE_TTL = 60 * 15;
const lc = (s: string) => s.toLowerCase();

function parse(raw: unknown): Match | null {
  if (!raw) return null;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as Match;
}

export async function loadMatch(id: string): Promise<Match> {
  if (!/^[0-9a-f]{20}$/.test(id)) throw new HttpError(404, "no_match", "Match not found.");
  const m = parse(await redis().get(K.match(id)));
  if (!m) throw new HttpError(404, "no_match", "Match not found.");
  return m;
}

async function save(m: Match) {
  await redis().set(K.match(m.id), JSON.stringify(m), { ex: MATCH_TTL });
}

/**
 * Serialize mutations per match with a short Redis lock. Upstash has no
 * MULTI/WATCH over REST, so a lock + reload is the simplest correct option.
 */
export async function withMatch<T>(id: string, fn: (m: Match) => Promise<T> | T): Promise<T> {
  const lockKey = K.matchLock(id);
  const token = randomToken(8);
  for (let i = 0; i < 40; i++) {
    if (await redis().set(lockKey, token, { nx: true, px: 8000 })) {
      try {
        const m = await loadMatch(id);
        const out = await fn(m);
        await save(m);
        return out;
      } finally {
        if ((await redis().get(lockKey)) === token) await redis().del(lockKey);
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new HttpError(503, "busy", "Match is busy, try again.");
}

export async function createMatch(kind: MatchKind, host: string, guest: string, tourney: string | null = null) {
  const m: Match = {
    id: randomToken(10),
    kind,
    players: [host, guest],
    createdAt: Date.now(),
    state: "connecting",
    ready: [],
    startAt: null,
    scores: {},
    attempts: {},
    result: null,
    tourney
  };
  await save(m);
  await Promise.all(
    m.players.map((p) => redis().set(K.activeMatch(p), m.id, { ex: ACTIVE_TTL }))
  );
  return m;
}

export function isPlayer(m: Match, u: string) {
  return m.players.some((p) => lc(p) === lc(u));
}

function other(m: Match, u: string) {
  return m.players.find((p) => lc(p) !== lc(u))!;
}

/**
 * Advance time-based transitions (timeouts → cancel / forfeit). Returns true
 * if the match changed. Called on every read so no cron is needed.
 */
async function tick(m: Match, now = Date.now()): Promise<boolean> {
  if (m.state === "done" || m.state === "cancelled") return false;

  if (m.state === "connecting" && now - m.createdAt > CONNECT_WINDOW_MS) {
    await cancel(m);
    return true;
  }
  if (m.state === "live" && m.startAt && now > m.startAt + CAPTURE_WINDOW_MS) {
    const [a, b] = m.players;
    const okA = m.scores[lc(a)]?.ok === true;
    const okB = m.scores[lc(b)]?.ok === true;
    if (!okA && !okB) await cancel(m);
    else await finalize(m, okA ? a : b, "forfeit");
    return true;
  }
  return false;
}

async function cancel(m: Match) {
  m.state = "cancelled";
  await releasePlayers(m);
}

async function releasePlayers(m: Match) {
  await Promise.all(
    m.players.map(async (p) => {
      if ((await redis().get(K.activeMatch(p))) === m.id) await redis().del(K.activeMatch(p));
    })
  );
}

export async function viewMatch(id: string, me: string): Promise<MatchView> {
  let m = await loadMatch(id);
  if (!isPlayer(m, me)) throw new HttpError(403, "not_your_match", "This isn't your match.");
  if (m.state === "connecting" || m.state === "live") {
    const now = Date.now();
    const due =
      (m.state === "connecting" && now - m.createdAt > CONNECT_WINDOW_MS) ||
      (m.state === "live" && !!m.startAt && now > m.startAt + CAPTURE_WINDOW_MS);
    if (due) m = await withMatch(id, async (mm) => (await tick(mm), mm));
  }
  const profiles = await Promise.all(m.players.map((p) => getProfile(p)));
  const revealScores = m.state === "done";
  return {
    id: m.id,
    kind: m.kind,
    state: m.state,
    me: m.players.find((p) => lc(p) === lc(me))!,
    opponent: other(m, me),
    iAmHost: lc(m.players[0]) === lc(me),
    players: profiles.map((p) => ({ username: p.username, elo: p.elo, hasFace: p.hasFace })),
    ready: m.ready,
    startAt: m.startAt,
    serverNow: Date.now(),
    // Hide the opponent's score until both are in, so nobody waits to see it.
    scores: Object.fromEntries(
      m.players.map((p) => {
        const s = m.scores[lc(p)];
        const visible = revealScores || lc(p) === lc(me);
        return [p, visible ? s : s ? ({ ok: s.ok } as MatchScore) : undefined];
      })
    ),
    result: m.result,
    tourney: m.tourney
  };
}

export async function markReady(id: string, me: string) {
  return withMatch(id, async (m) => {
    if (!isPlayer(m, me)) throw new HttpError(403, "not_your_match");
    await tick(m);
    if (m.state !== "connecting") return;
    if (!m.ready.includes(lc(me))) m.ready.push(lc(me));
    if (m.ready.length === 2) {
      m.state = "live";
      m.startAt = Date.now() + COUNTDOWN_MS;
    }
  });
}

/** Record a player's AI score. Finalizes once both are usable. */
export async function recordScore(id: string, me: string, score: MatchScore) {
  return withMatch(id, async (m) => {
    if (!isPlayer(m, me)) throw new HttpError(403, "not_your_match");
    if (m.state !== "live") return;
    if (m.scores[lc(me)]?.ok) return; // first usable score stands
    m.scores[lc(me)] = score;
    const [a, b] = m.players;
    if (m.scores[lc(a)]?.ok && m.scores[lc(b)]?.ok) await finalize(m, null, "score");
  });
}

/** Gate a frame upload: right phase, within the window, attempt budget. */
export async function claimAttempt(id: string, me: string) {
  return withMatch(id, async (m) => {
    if (!isPlayer(m, me)) throw new HttpError(403, "not_your_match");
    await tick(m);
    if (m.state !== "live" || !m.startAt) throw new HttpError(409, "not_live", "The face-off hasn't started.");
    const now = Date.now();
    if (now < m.startAt - 1500) throw new HttpError(409, "too_early", "Wait for the countdown.");
    if (m.scores[lc(me)]?.ok) throw new HttpError(409, "already_scored", "You're already scored.");
    const n = (m.attempts[lc(me)] || 0) + 1;
    if (n > 4) throw new HttpError(429, "no_attempts", "Out of attempts for this match.");
    m.attempts[lc(me)] = n;
  });
}

/** A player reported their opponent mid-match: call it off with no ELO change. */
export async function cancelForReport(id: string, reporter: string) {
  return withMatch(id, async (m) => {
    if (!isPlayer(m, reporter)) throw new HttpError(403, "not_your_match");
    if (m.state === "connecting" || m.state === "live") await cancel(m);
  });
}

export async function leaveMatch(id: string, me: string) {
  return withMatch(id, async (m) => {
    if (!isPlayer(m, me)) throw new HttpError(403, "not_your_match");
    if (m.state === "connecting") await cancel(m);
    else if (m.state === "live") await finalize(m, other(m, me), "forfeit");
  });
}

function traitSum(s: MatchScore | undefined) {
  return s && s.ok ? TRAIT_KEYS.reduce((t, k) => t + s.traits[k], 0) : -1;
}

/** Decide the winner, apply ELO (ranked only), update both profiles. */
async function finalize(m: Match, forcedWinner: string | null, reason: MatchResult["reason"]) {
  const [a, b] = m.players;
  let winner: string | null = forcedWinner;
  let why = reason;
  if (reason === "score") {
    const sa = m.scores[lc(a)];
    const sb = m.scores[lc(b)];
    const oa = sa?.ok ? sa.overall : -1;
    const ob = sb?.ok ? sb.overall : -1;
    if (oa !== ob) winner = oa > ob ? a : b;
    else if (traitSum(sa) !== traitSum(sb)) winner = traitSum(sa) > traitSum(sb) ? a : b;
    else {
      winner = null;
      why = "draw";
    }
  }

  const [pa, pb] = await Promise.all([getProfile(a), getProfile(b)]);
  let elo: MatchResult["elo"] = null;

  if (m.kind === "ranked") {
    const resA: 0 | 0.5 | 1 = winner === null ? 0.5 : lc(winner) === lc(a) ? 1 : 0;
    const dA = eloDelta(pa.elo, pb.elo, resA, pa.placementsLeft > 0);
    const dB = eloDelta(pb.elo, pa.elo, (1 - resA) as 0 | 0.5 | 1, pb.placementsLeft > 0);
    elo = {
      [pa.username]: { before: pa.elo, after: Math.max(100, pa.elo + dA), delta: dA },
      [pb.username]: { before: pb.elo, after: Math.max(100, pb.elo + dB), delta: dB }
    };
    for (const p of [pa, pb]) {
      const won = winner !== null && lc(winner) === lc(p.username);
      const lost = winner !== null && !won;
      p.elo = elo[p.username].after;
      p.peakElo = Math.max(p.peakElo, p.elo);
      if (won) p.wins++;
      else if (lost) p.losses++;
      else p.draws++;
      p.streak = won ? Math.max(1, p.streak + 1) : lost ? Math.min(-1, p.streak - 1) : 0;
      if (p.placementsLeft > 0) p.placementsLeft--;
    }
  }

  // Every usable match scan also refines the player's rolling score.
  for (const p of [pa, pb]) {
    const s = m.scores[lc(p.username)];
    if (s?.ok) {
      addReading(
        p,
        { overall: s.overall, traits: s.traits, at: Date.now(), source: "match", v: SCORE_SCALE_VERSION },
        p.score
          ? { headline: p.score.headline, strengths: p.score.strengths, improvements: p.score.improvements, confidence: p.score.confidence }
          : { headline: s.headline, strengths: [], improvements: [], confidence: "medium" }
      );
    }
  }
  await Promise.all([saveProfile(pa), saveProfile(pb)]);

  m.state = "done";
  m.result = { winner, reason: why, elo };
  await releasePlayers(m);

  if (m.kind === "tourney" && m.tourney) {
    const { onTourneyMatchDone } = await import("./tourney");
    await onTourneyMatchDone(m.tourney, m.id, winner ?? (traitSum(m.scores[lc(a)]) >= traitSum(m.scores[lc(b)]) ? a : b));
  }
}

export async function activeMatchOf(u: string): Promise<string | null> {
  const id = await redis().get<string>(K.activeMatch(u));
  if (!id || id.startsWith("pending:")) return null; // pairing in flight
  const m = parse(await redis().get(K.match(id)));
  if (!m || m.state === "done" || m.state === "cancelled") {
    await redis().del(K.activeMatch(u));
    return null;
  }
  return id;
}
