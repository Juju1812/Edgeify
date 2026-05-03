import { Redis } from "@upstash/redis";

let _redis: Redis | null | undefined;
export function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    _redis = null;
    return null;
  }
  _redis = Redis.fromEnv();
  return _redis;
}

export const tourneyKey = (code: string) => `tourney:v1:${code}`;
export const TOURNEY_TTL_SEC = 60 * 60 * 6; // 6 hours

export type TourneyPlayer = { username: string; peerId: string };

export type TourneyMatch = {
  /** Indices into Tourney.players. */
  a: number;
  b: number;
  /** Index of winner (a or b), or null if not yet decided. */
  winner: number | null;
};

export type TourneyState = "lobby" | "running" | "done";

export type Tourney = {
  code: string;
  host: string;
  size: 4;
  state: TourneyState;
  players: TourneyPlayer[];
  /**
   * Bracket layout (4-player single-elim):
   *   matches[0] = SF1: player[0] vs player[1]
   *   matches[1] = SF2: player[2] vs player[3]
   *   matches[2] = Final: winner(SF1) vs winner(SF2)
   */
  matches: TourneyMatch[];
  currentMatch: number; // 0..2 while running, -1 in lobby, 3 when done
  champion: number | null; // index into players
  createdAt: number;
};

export function generateCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function emptyBracket(): TourneyMatch[] {
  return [
    { a: 0, b: 1, winner: null },
    { a: 2, b: 3, winner: null },
    { a: -1, b: -1, winner: null } // resolved when SF1 + SF2 finish
  ];
}
