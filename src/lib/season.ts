import type {
  GameMode,
  MatchRecord,
  PromoSeries,
  SeasonInfo,
  UserState
} from "./types";

/**
 * Current season configuration. Each season runs ~90 days. When the
 * end date passes, the user state's seasonNumber is bumped on next
 * sync and seasonXp + claimedLevel are reset (with a soft ELO reset
 * applied separately).
 *
 * Season 1 starts at the project's launch date. Subsequent seasons
 * start exactly 90 days after the previous one ended.
 */
const SEASON_DURATION_MS = 90 * 24 * 60 * 60 * 1000;
const SEASON_1_START = Date.UTC(2026, 4, 1); // 2026-05-01

export function currentSeason(): SeasonInfo {
  const now = Date.now();
  const diff = now - SEASON_1_START;
  const number = Math.max(1, Math.floor(diff / SEASON_DURATION_MS) + 1);
  const startsAt = SEASON_1_START + (number - 1) * SEASON_DURATION_MS;
  return { number, startsAt, endsAt: startsAt + SEASON_DURATION_MS };
}

/**
 * XP curve — level N requires 150 * N XP cumulatively. So:
 *   L1: 0  -> 150
 *   L2: 150 -> 300
 *   L5: 600 -> 750
 *   L10: 1350 -> 1500
 *   L25: 3600 -> 3750
 *   L50: 7350 -> 7500
 * One match win is 100xp. So L25 ≈ 38 wins, L50 ≈ 75 wins.
 */
export function xpForLevel(level: number): number {
  // Cumulative XP needed to BEGIN this level (i.e. complete level-1).
  if (level <= 1) return 0;
  return Math.floor((level - 1) * level * 75);
}

export function levelFromXp(xp: number): number {
  // Inverse of xpForLevel using quadratic formula.
  // xp = (level-1) * level * 75
  // 75*level^2 - 75*level - xp = 0
  // level = (75 + sqrt(75^2 + 4*75*xp)) / (2*75)
  const a = 75;
  const disc = a * a + 4 * a * xp;
  const lvl = (a + Math.sqrt(disc)) / (2 * a);
  return Math.max(1, Math.floor(lvl));
}

/** XP earned for a match outcome. */
export function xpForMatch(
  won: boolean,
  streakAfter: number,
  practice: boolean,
  mode: GameMode = "bo3"
): number {
  if (practice) return 15; // practice still gives token XP
  const base = won ? 100 : 30;
  const streakBonus = won ? Math.min(50, Math.max(0, streakAfter - 1) * 10) : 0;
  const modeMult: Record<GameMode, number> = {
    "bo3": 1.0,
    "bo5": 1.4,        // longer match, more XP
    "sudden-death": 0.6, // shorter, less XP
    "rapid-fire": 0.8
  };
  return Math.round((base + streakBonus) * modeMult[mode]);
}

// ─── Season-pass rewards ──────────────────────────────────────────────

export type Reward =
  | { kind: "edgeBoost"; count: number }
  | { kind: "title"; title: string }
  | { kind: "frame"; frame: string; color: string };

/** Reward at level N (1-indexed). Levels with no special reward give nothing. */
export function rewardAtLevel(level: number): Reward | null {
  // Edge Boost every 3 levels.
  if (level % 3 === 0) return { kind: "edgeBoost", count: 1 };
  // Title milestones
  const titles: Record<number, string> = {
    5: "Climber",
    10: "Edger",
    20: "Mogger",
    35: "True Adam",
    50: "Living Legend"
  };
  if (titles[level]) return { kind: "title", title: titles[level] };
  // Profile frame milestones
  const frames: Record<number, { frame: string; color: string }> = {
    7: { frame: "bronze", color: "#a16207" },
    15: { frame: "silver", color: "#94a3b8" },
    25: { frame: "gold", color: "#facc15" },
    40: { frame: "violet", color: "#a855f7" },
    100: { frame: "rainbow", color: "#d946ef" }
  };
  if (frames[level]) return { kind: "frame", ...frames[level] };
  return null;
}

/**
 * Apply unclaimed level-up rewards into the user state. Called whenever
 * XP changes; idempotent — only claims levels above prev.claimedLevel.
 */
export function applyLevelRewards(prev: UserState): Partial<UserState> {
  const lvl = levelFromXp(prev.seasonXp);
  if (lvl <= prev.claimedLevel) return {};
  let edgeBoosts = prev.edgeBoosts;
  for (let l = prev.claimedLevel + 1; l <= lvl; l++) {
    const reward = rewardAtLevel(l);
    if (reward?.kind === "edgeBoost") edgeBoosts += reward.count;
  }
  return { claimedLevel: lvl, edgeBoosts };
}

// ─── Daily streak ─────────────────────────────────────────────────────

export function dayOfYearUtc(ts = Date.now()): number {
  const d = new Date(ts);
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000
  );
}

/** Returns updated streak fields after a presence-tick. */
export function tickDailyStreak(prev: UserState): Partial<UserState> {
  const today = dayOfYearUtc();
  if (prev.dailyStreakDay === today) return {}; // already ticked today
  const isContinuation = today === prev.dailyStreakDay + 1;
  const newStreak = isContinuation ? prev.dailyStreak + 1 : 1;
  // Daily login bonus XP: 25 base + 10 per consecutive day, capped at 100
  const bonusXp = Math.min(100, 25 + (newStreak - 1) * 10);
  return {
    dailyStreak: newStreak,
    dailyStreakDay: today,
    seasonXp: prev.seasonXp + bonusXp
  };
}

// ─── Inactivity ELO decay ─────────────────────────────────────────────

/**
 * Lose 5 ELO per day after a 7-day idle period, capped at -200 from
 * peak. Runs idempotently — safe to call on every page load.
 */
export function applyInactivityDecay(prev: UserState): Partial<UserState> {
  if (!prev.lastActiveAt) return { lastActiveAt: Date.now() };
  const idleDays = (Date.now() - prev.lastActiveAt) / (24 * 60 * 60 * 1000);
  if (idleDays < 7) return { lastActiveAt: Date.now() };
  const decayDays = Math.floor(idleDays - 7);
  const decay = Math.min(200, decayDays * 5);
  return {
    elo: Math.max(0, prev.elo - decay),
    lastActiveAt: Date.now()
  };
}

// ─── Season rollover ──────────────────────────────────────────────────

export function checkSeasonRollover(prev: UserState): Partial<UserState> {
  const cur = currentSeason();
  if (prev.seasonNumber === cur.number) return {};
  // Soft-reset ELO toward 1000 — multiply distance from 1000 by 0.5.
  const decayedElo = Math.round(1000 + (prev.elo - 1000) * 0.5);
  return {
    seasonNumber: cur.number,
    seasonXp: 0,
    claimedLevel: 0,
    elo: decayedElo,
    placementsLeft: 3, // shorter placement re-calibration each new season
    promo: null
  };
}

// ─── Promotion series ─────────────────────────────────────────────────

import { RANKS } from "./rank";

/**
 * After applying a normal ELO delta, see whether the user is at a
 * tier-up boundary that requires a promotion series. Returns updated
 * elo / promo / matchHistory adjustments.
 */
export function applyPromoSeriesRules(
  prev: UserState,
  newElo: number,
  won: boolean
): Partial<UserState> {
  // Tier floors above the user's PRE-match tier.
  const prevTier = highestTierAtOrBelow(prev.elo);
  const wouldEnterTier = highestTierAtOrBelow(newElo);

  // No tier change and no active promo → just update ELO.
  if (!prev.promo && wouldEnterTier === prevTier) return { elo: newElo };

  // Trying to cross into a new tier: start a promo series instead of
  // letting the ELO actually cross. Pin them just below the floor and
  // start tracking the series.
  if (!prev.promo && wouldEnterTier > prevTier) {
    const tier = RANKS.find((r) => r.floor === wouldEnterTier);
    if (!tier) return { elo: newElo };
    return {
      elo: Math.min(newElo, tier.floor - 1),
      promo: { toTier: tier.floor, wins: won ? 1 : 0, losses: won ? 0 : 1 }
    };
  }

  // Active promo series — record the result.
  if (prev.promo) {
    const wins = prev.promo.wins + (won ? 1 : 0);
    const losses = prev.promo.losses + (won ? 0 : 1);
    if (wins >= 3) {
      // Promoted!
      return {
        elo: prev.promo.toTier + 25, // bump just inside the new tier
        promo: null
      };
    }
    if (losses >= 3) {
      // Failed series — drop a bit, reset.
      return {
        elo: Math.max(0, prev.promo.toTier - 60),
        promo: null
      };
    }
    // Still in series. Don't shift ELO during the series.
    return {
      elo: prev.elo,
      promo: { ...prev.promo, wins, losses }
    };
  }

  return { elo: newElo };
}

function highestTierAtOrBelow(elo: number): number {
  let floor = RANKS[0].floor;
  for (const r of RANKS) if (elo >= r.floor) floor = r.floor;
  return floor;
}

// ─── Match-result aggregator ──────────────────────────────────────────

/**
 * Single helper that takes everything a match-completion needs and
 * returns the unified UserState patch. Used by both Quick Match and
 * Live Match so the rules stay consistent.
 */
export function applyMatchResult(
  prev: UserState,
  args: {
    won: boolean;
    rawEloDelta: number; // computed from ELO formula
    record: MatchRecord;
    practice?: boolean;
    mode?: GameMode;
  }
): Partial<UserState> {
  const { won, rawEloDelta, record } = args;
  const practice = !!args.practice;
  const mode = args.mode || "bo3";

  // Practice doesn't move ELO or fill placement matches.
  if (practice) {
    const xpGain = xpForMatch(won, prev.streak, true, mode);
    const next = {
      seasonXp: prev.seasonXp + xpGain,
      matchHistory: [{ ...record, practice: true }, ...prev.matchHistory].slice(0, 50)
    };
    const lvl = applyLevelRewards({ ...prev, ...next });
    return { ...next, ...lvl };
  }

  const newEloRaw = Math.max(0, prev.elo + rawEloDelta);
  const promoPatch = applyPromoSeriesRules(prev, newEloRaw, won);
  const newElo = (promoPatch.elo as number | undefined) ?? newEloRaw;
  const newStreak = won ? prev.streak + 1 : 0;
  const xpGain = xpForMatch(won, newStreak, false, mode);

  const base: Partial<UserState> = {
    elo: newElo,
    peakElo: Math.max(prev.peakElo, newElo),
    wins: prev.wins + (won ? 1 : 0),
    losses: prev.losses + (won ? 0 : 1),
    streak: newStreak,
    placementsLeft: Math.max(0, prev.placementsLeft - 1),
    seasonXp: prev.seasonXp + xpGain,
    matchHistory: [record, ...prev.matchHistory].slice(0, 50),
    promo: promoPatch.promo as PromoSeries | null | undefined ?? prev.promo
  };

  const lvl = applyLevelRewards({ ...prev, ...base });
  return { ...base, ...lvl };
}
