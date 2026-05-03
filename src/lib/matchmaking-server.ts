/**
 * Server-side matchmaking helpers — used only from API routes.
 *
 * Uses Upstash Redis (auto-injected by Vercel KV) to maintain a queue of
 * peers looking for an opponent. When a new peer enqueues:
 *   1. Take the oldest waiting peer from the queue (atomic ZREM).
 *   2. Notify the waiting peer via a `pair:{peerId}` key (read by /poll).
 *   3. Return the match info to the new peer immediately.
 *
 * Race conditions are bounded by the atomic ZREM — if two peers try to
 * claim the same waiter, only one ZREM returns 1. The other re-tries.
 *
 * KV missing? `getRedis()` returns null and the API routes return a 503
 * with a clear message so the UI can prompt the user to provision KV.
 */

import { Redis } from "@upstash/redis";

export const QUEUE_KEY = "edgeify:queue:v1";
export const peerKey = (id: string) => `edgeify:peer:v1:${id}`;
export const pairKey = (id: string) => `edgeify:pair:v1:${id}`;

/** Time a queued peer is allowed to wait before its peer hash expires. */
export const WAIT_TTL_SEC = 60;
/** Time a `pair` notification lives before the waiting peer must poll for it. */
export const PAIR_TTL_SEC = 30;

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

export type PeerInfo = {
  elo: number;
  placementsLeft: number;
  ts: number;
};

export type PairPayload = {
  opponentPeerId: string;
  opponentElo: number;
  iAmHost: boolean;
};
