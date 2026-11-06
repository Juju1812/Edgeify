import "server-only";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

/** Shared Upstash client. Throws if KV env vars are missing. */
export function redis(): Redis {
  if (_redis) return _redis;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error("KV_REST_API_URL / KV_REST_API_TOKEN are not set");
  }
  _redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
    // Values are stored as JSON strings by us; let Upstash parse them back.
    automaticDeserialization: true
  });
  return _redis;
}

/**
 * Key layout.
 *
 * `user:*` and `session:*` are SHARED with the old (v1) site so existing
 * accounts keep working. Everything else lives under `e2:` so local dev
 * and preview deployments can never clobber the live v1 data — dev and
 * prod share the same Upstash database.
 */
const lc = (u: string) => u.toLowerCase();
export const K = {
  // shared with v1
  user: (u: string) => `user:${lc(u)}`,
  session: (t: string) => `session:${t}`,
  legacyProfile: (u: string) => `profile:${lc(u)}`,

  // v2
  profile: (u: string) => `e2:profile:${lc(u)}`,
  face: (u: string) => `e2:face:${lc(u)}`,
  leaderboard: "e2:lb",
  online: (u: string) => `e2:online:${lc(u)}`,
  rate: (bucket: string, id: string, window: string) => `e2:rate:${bucket}:${lc(id)}:${window}`,
  aiDaily: (day: string) => `e2:ai:${day}`,

  friends: (u: string) => `e2:friends:${lc(u)}`,
  friendReqIn: (u: string) => `e2:freq:${lc(u)}`,
  dm: (a: string, b: string) => `e2:dm:${[lc(a), lc(b)].sort().join(":")}`,
  dmIndex: (u: string) => `e2:dmidx:${lc(u)}`,
  dmRead: (u: string, other: string) => `e2:dmread:${lc(u)}:${lc(other)}`,

  queue: "e2:queue",
  queueEntry: (u: string) => `e2:qe:${lc(u)}`,
  activeMatch: (u: string) => `e2:am:${lc(u)}`,
  match: (id: string) => `e2:match:${id}`,
  matchLock: (id: string) => `e2:mlock:${id}`,
  signal: (id: string, kind: "offer" | "answer") => `e2:sig:${id}:${kind}`,
  room: (code: string) => `e2:room:${code.toUpperCase()}`,
  tourney: (code: string) => `e2:tourney:${code.toUpperCase()}`
};
