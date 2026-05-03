/**
 * Server-side helpers for KV-backed username/password auth.
 *
 * Storage shape:
 *   user:{usernameLower}    HASH { passwordHash, createdAt }
 *   session:{token}         JSON { username, expiresAt }
 *   profile:{usernameLower} JSON (full UserState — saved app state)
 *
 * Session tokens are random 32-byte hex strings, valid for 30 days.
 */

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

export const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export const userKey = (u: string) => `user:${u.toLowerCase()}`;
export const sessionKey = (t: string) => `session:${t}`;
export const profileKey = (u: string) => `profile:${u.toLowerCase()}`;

// Leaderboard infrastructure
export const LEADERBOARD_KEY = "lb:elo:v1";
export const lbSummaryKey = (u: string) => `lb:summary:v1:${u.toLowerCase()}`;
export const onlineKey = (u: string) => `online:v1:${u.toLowerCase()}`;
export const ONLINE_TTL_SEC = 60;

/** Generate a random 32-byte hex token (~256 bits of entropy). */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isValidUsername(u: unknown): u is string {
  return typeof u === "string" && /^[A-Za-z0-9_-]{2,16}$/.test(u);
}

export function isValidPassword(p: unknown): p is string {
  return typeof p === "string" && p.length >= 6 && p.length <= 200;
}
