import "server-only";
import { redis, K } from "./redis";
import { HttpError } from "./http";

/**
 * Fixed-window counter. Throws 429 once `limit` hits within the window.
 * Used to cap paid AI calls per user and globally.
 */
export async function rateLimit(
  bucket: string,
  id: string,
  limit: number,
  windowSec: number,
  message = "You're doing that too often. Try again later."
) {
  const window = String(Math.floor(Date.now() / 1000 / windowSec));
  const key = K.rate(bucket, id, window);
  const n = await redis().incr(key);
  if (n === 1) await redis().expire(key, windowSec + 5);
  if (n > limit) throw new HttpError(429, "rate_limited", message);
}

const num = (v: string | undefined, d: number) => (v && Number.isFinite(+v) ? +v : d);

export const LIMITS = {
  scansPerDay: num(process.env.SCANS_PER_DAY, 8),
  matchScoresPerDay: num(process.env.MATCH_SCORES_PER_DAY, 60),
  // Hard ceiling on Claude calls across the whole site per UTC day — a
  // safety net so a bug or abuse can't run up the bill.
  aiCallsPerDay: num(process.env.AI_CALLS_PER_DAY, 3000)
};

export async function reserveAiCall() {
  const day = new Date().toISOString().slice(0, 10);
  const key = K.aiDaily(day);
  const n = await redis().incr(key);
  if (n === 1) await redis().expire(key, 60 * 60 * 30);
  if (n > LIMITS.aiCallsPerDay) {
    throw new HttpError(503, "ai_capacity", "Scoring is at capacity for today. Try again tomorrow.");
  }
}
