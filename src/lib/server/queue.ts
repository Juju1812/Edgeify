import "server-only";
import { redis, K } from "./redis";
import { HttpError } from "./http";
import { activeMatchOf, createMatch } from "./matches";
import { getProfile } from "./profile";
import { assertNotSuspended, blockedBy } from "./safety";

type Entry = { username: string; elo: number; joinedAt: number };

const ENTRY_TTL = 12; // seconds — clients poll every ~1.5s, so a closed tab drops out fast
const lc = (s: string) => s.toLowerCase();

/** ELO window widens the longer either player has waited; anyone goes after 20s. */
function bandFor(waitMs: number) {
  if (waitMs > 20_000) return Infinity;
  return 150 + (waitMs / 1000) * 30;
}

function parse(raw: unknown): Entry | null {
  if (!raw) return null;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as Entry;
}

/**
 * Join or poll the ranked queue. Returns a match id once paired.
 *
 * Pairing is made race-safe by claiming both players' `activeMatch` keys
 * with SET NX: whoever wins the claim owns the pairing; a loser rolls back.
 */
export async function pollQueue(me: string): Promise<{ matchId: string | null; waitingSince: number }> {
  const existing = await activeMatchOf(me);
  if (existing) {
    await leaveQueue(me);
    return { matchId: existing, waitingSince: Date.now() };
  }

  await assertNotSuspended(me);
  const p = await getProfile(me);
  if (!p.score) throw new HttpError(409, "needs_scan", "Scan your face before playing ranked.");
  const myBlocks = new Set(await blockedBy(me));

  const prev = parse(await redis().get(K.queueEntry(me)));
  const entry: Entry = { username: p.username, elo: p.elo, joinedAt: prev?.joinedAt ?? Date.now() };
  await redis().set(K.queueEntry(me), JSON.stringify(entry), { ex: ENTRY_TTL });
  await redis().zadd(K.queue, { score: entry.joinedAt, member: lc(me) });

  const now = Date.now();
  const candidates = await redis().zrange<string[]>(K.queue, 0, 24);
  for (const c of candidates) {
    if (c === lc(me) || myBlocks.has(c)) continue;
    if (await redis().sismember(K.blocks(c), lc(me))) continue;
    const ce = parse(await redis().get(K.queueEntry(c)));
    if (!ce) {
      await redis().zrem(K.queue, c); // stale
      continue;
    }
    const band = Math.max(bandFor(now - ce.joinedAt), bandFor(now - entry.joinedAt));
    if (Math.abs(ce.elo - entry.elo) > band) continue;
    if (await redis().get(K.activeMatch(c))) continue;

    // Claim the opponent, then myself.
    const placeholder = `pending:${me}`;
    if (!(await redis().set(K.activeMatch(c), placeholder, { nx: true, ex: 10 }))) continue;
    if (!(await redis().set(K.activeMatch(me), placeholder, { nx: true, ex: 10 }))) {
      if ((await redis().get(K.activeMatch(c))) === placeholder) await redis().del(K.activeMatch(c));
      break;
    }
    // The longer-waiting player hosts (creates the WebRTC offer).
    const m = await createMatch("ranked", ce.username, p.username);
    await Promise.all([leaveQueue(c), leaveQueue(me)]);
    return { matchId: m.id, waitingSince: entry.joinedAt };
  }
  return { matchId: null, waitingSince: entry.joinedAt };
}

export async function leaveQueue(u: string) {
  await Promise.all([redis().zrem(K.queue, lc(u)), redis().del(K.queueEntry(u))]);
}

export async function queueSize() {
  return redis().zcard(K.queue);
}
