import "server-only";
import { redis, K } from "./redis";
import { HttpError } from "./http";
import { roomCode, withLock } from "./lock";
import { activeMatchOf, createMatch } from "./matches";

export const TOURNEY_SIZE = 4;

export type Bracket = { id: string | null; a: string | null; b: string | null; winner: string | null };

export type Tourney = {
  code: string;
  host: string;
  createdAt: number;
  state: "lobby" | "running" | "done";
  players: string[];
  /** [semi 1, semi 2, final] */
  bracket: Bracket[];
  champion: string | null;
};

const TTL = 60 * 60 * 6;

function parse(raw: unknown): Tourney | null {
  if (!raw) return null;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as Tourney;
}

async function save(t: Tourney) {
  await redis().set(K.tourney(t.code), JSON.stringify(t), { ex: TTL });
}

export async function getTourney(code: string): Promise<Tourney> {
  const t = parse(await redis().get(K.tourney(code)));
  if (!t) throw new HttpError(404, "no_tourney", "That tournament code doesn't exist or has expired.");
  return t;
}

export async function createTourney(host: string): Promise<Tourney> {
  for (let i = 0; i < 5; i++) {
    const t: Tourney = {
      code: roomCode(),
      host,
      createdAt: Date.now(),
      state: "lobby",
      players: [host],
      bracket: [],
      champion: null
    };
    if (await redis().set(K.tourney(t.code), JSON.stringify(t), { nx: true, ex: TTL })) return t;
  }
  throw new HttpError(503, "busy", "Couldn't create a tournament, try again.");
}

const has = (t: Tourney, u: string) => t.players.some((p) => p.toLowerCase() === u.toLowerCase());

export async function tourneyAction(code: string, me: string, action: string): Promise<Tourney> {
  return withLock(K.tourney(code), async () => {
    const t = await getTourney(code);
    if (action === "join") {
      if (has(t, me)) return t;
      if (t.state !== "lobby") throw new HttpError(409, "started", "That tournament already started.");
      if (t.players.length >= TOURNEY_SIZE) throw new HttpError(409, "full", "That tournament is full.");
      t.players.push(me);
    } else if (action === "leave") {
      if (t.state !== "lobby") throw new HttpError(409, "started", "You can't leave once it's started.");
      t.players = t.players.filter((p) => p.toLowerCase() !== me.toLowerCase());
      if (t.host.toLowerCase() === me.toLowerCase()) t.host = t.players[0] ?? me;
    } else if (action === "start") {
      if (t.host.toLowerCase() !== me.toLowerCase()) throw new HttpError(403, "not_host", "Only the host can start.");
      if (t.state !== "lobby") return t;
      if (t.players.length !== TOURNEY_SIZE) throw new HttpError(409, "need_players", `Need ${TOURNEY_SIZE} players to start.`);
      for (const p of t.players) {
        if (await activeMatchOf(p)) throw new HttpError(409, "busy", `${p} is in another match.`);
      }
      const seeded = [...t.players].sort(() => Math.random() - 0.5);
      const semi1 = await createMatch("tourney", seeded[0], seeded[1], t.code);
      const semi2 = await createMatch("tourney", seeded[2], seeded[3], t.code);
      t.bracket = [
        { id: semi1.id, a: seeded[0], b: seeded[1], winner: null },
        { id: semi2.id, a: seeded[2], b: seeded[3], winner: null },
        { id: null, a: null, b: null, winner: null }
      ];
      t.state = "running";
    } else {
      throw new HttpError(400, "bad_action");
    }
    await save(t);
    return t;
  });
}

/** Called by the match engine when a tournament match finishes. */
export async function onTourneyMatchDone(code: string, matchId: string, winner: string) {
  await withLock(K.tourney(code), async () => {
    const t = await getTourney(code);
    const slot = t.bracket.findIndex((b) => b.id === matchId);
    if (slot < 0 || t.bracket[slot].winner) return;
    t.bracket[slot].winner = winner;

    if (slot === 2) {
      t.champion = winner;
      t.state = "done";
    } else {
      const [s1, s2, final] = t.bracket;
      if (s1.winner && s2.winner && !final.id) {
        const m = await createMatch("tourney", s1.winner, s2.winner, t.code);
        t.bracket[2] = { id: m.id, a: s1.winner, b: s2.winner, winner: null };
      }
    }
    await save(t);
  });
}

/** The match this player should be in right now, if any. */
export function currentMatchFor(t: Tourney, u: string): string | null {
  const lu = u.toLowerCase();
  const b = t.bracket.find(
    (x) => x.id && !x.winner && (x.a?.toLowerCase() === lu || x.b?.toLowerCase() === lu)
  );
  return b?.id ?? null;
}
