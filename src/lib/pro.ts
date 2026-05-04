import type { UserState } from "./types";

/**
 * Single source of truth for "is this user currently Pro?". The Stripe
 * webhook sets proUntil to the period_end timestamp of the active
 * subscription; we just compare to now. If proUntil is null or in the
 * past → free tier.
 */
export function isPro(user: UserState | null | undefined): boolean {
  if (!user) return false;
  return !!user.proUntil && user.proUntil > Date.now();
}

/** Daily / monthly Deep Analysis quotas. */
export const FREE_DEEP_ANALYSES_PER_MONTH = 3;

/** AR filters available on the free tier. All cosmetic filters are
 *  free — the AR engine itself is part of the core game loop. */
export const FREE_AR_FILTERS = [
  "none",
  "crown",
  "mustache",
  "shades",
  "horns",
  "halo"
] as const;

/** Free emote loadouts. The rest are Pro. */
export const FREE_LOADOUTS = ["classic", "friendly"] as const;
