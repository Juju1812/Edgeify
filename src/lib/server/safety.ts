import "server-only";
import { redis, K } from "./redis";
import { HttpError } from "./http";
import { removeFriend } from "./social";

const lc = (s: string) => s.toLowerCase();

export const REPORT_REASONS = ["nudity", "harassment", "underage", "cheating", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Distinct reporters within the window that trigger an automatic ranked suspension. */
const AUTO_SUSPEND_REPORTERS = 3;
const REPORT_WINDOW_SEC = 60 * 60 * 24 * 7;

// ─── Blocks ────────────────────────────────────────────────────────────

export async function block(me: string, other: string) {
  if (lc(me) === lc(other)) throw new HttpError(400, "self", "You can't block yourself.");
  await redis().sadd(K.blocks(me), lc(other));
  await removeFriend(me, other);
}

export async function unblock(me: string, other: string) {
  await redis().srem(K.blocks(me), lc(other));
}

export async function blockedBy(me: string): Promise<string[]> {
  return redis().smembers(K.blocks(me));
}

/** True if either player has blocked the other. */
export async function eitherBlocked(a: string, b: string) {
  const [x, y] = await Promise.all([
    redis().sismember(K.blocks(a), lc(b)),
    redis().sismember(K.blocks(b), lc(a))
  ]);
  return x === 1 || y === 1;
}

// ─── Reports & suspensions ─────────────────────────────────────────────

export type Report = {
  target: string;
  by: string; // "system" for automatic AI flags
  reason: ReportReason;
  note: string;
  matchId: string | null;
  at: number;
};

/**
 * Log a report. Only `verified` reports — from someone who actually played a
 * match against the target — count toward an automatic suspension, so a few
 * throwaway accounts can't get anyone suspended.
 */
export async function fileReport(r: Report, verified = false) {
  await redis().lpush(K.reports, JSON.stringify({ ...r, verified }));
  await redis().ltrim(K.reports, 0, 4999);
  if (r.by === "system" || !verified) return;

  const key = K.reportedBy(r.target);
  await redis().sadd(key, lc(r.by));
  await redis().expire(key, REPORT_WINDOW_SEC);
  const n = await redis().scard(key);
  if (n >= AUTO_SUSPEND_REPORTERS) await suspend(r.target, 60 * 60 * 24 * 3, "Several players reported you.");
}

export async function suspend(u: string, seconds: number, reason: string) {
  await redis().set(K.suspended(u), JSON.stringify({ reason, until: Date.now() + seconds * 1000 }), { ex: seconds });
}

export async function suspension(u: string): Promise<{ reason: string; until: number } | null> {
  const raw = await redis().get<{ reason: string; until: number } | string>(K.suspended(u));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function assertNotSuspended(u: string) {
  const s = await suspension(u);
  if (s) {
    const hours = Math.max(1, Math.ceil((s.until - Date.now()) / 3_600_000));
    throw new HttpError(403, "suspended", `You're suspended from matches for ${hours} more hour${hours === 1 ? "" : "s"}. ${s.reason}`);
  }
}
