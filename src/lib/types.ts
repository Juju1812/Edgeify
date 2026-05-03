export type EdgeScoreBreakdown = {
  symmetry: number;          // 0..1
  jawlineDefinition: number; // 0..1
  canthalTilt: number;       // -1..1 (signed)
  cheekboneProm: number;     // 0..1
  goldenRatio: number;       // 0..1
  faceFat: number;           // 0..1 — facial fullness; higher = more fat
  composite: number;         // 0..100 weighted
};

export type GameMode = "bo3" | "bo5" | "sudden-death" | "rapid-fire";

export type MatchRecord = {
  id: string;
  opponentName: string;
  opponentElo: number;
  myScore: number;        // round-wins
  oppScore: number;
  won: boolean;
  eloDelta: number;
  playedAt: number;       // epoch ms
  /** Round-by-round breakdown so the replay viewer can show details. */
  rounds?: Array<{
    criterion: string;
    me: number;
    opp: number;
  }>;
  mode?: GameMode;
  /** True if this match was played in practice (no ELO impact). */
  practice?: boolean;
};

export type SeasonInfo = {
  number: number;
  startsAt: number;
  endsAt: number;
};

/** Tracks promotion series at tier breakpoints (best-of-5 to advance). */
export type PromoSeries = {
  /** ELO floor of the tier we're trying to enter. */
  toTier: number;
  wins: number;
  losses: number;
};

export type UserState = {
  // Identity
  username: string | null;
  authedAt: number | null;
  isOver18: boolean;
  consentedAt: number | null;

  // Calibration / face
  hasScanned: boolean;
  faceDataUrl: string | null;            // base64 of best capture (local-only for now)
  edgeScore: EdgeScoreBreakdown | null;
  hideFromBoard: boolean;

  // Ranking
  elo: number;
  peakElo: number;
  wins: number;
  losses: number;
  streak: number;
  placementsLeft: number;                // 5 → 0
  matchHistory: MatchRecord[];

  // ─── Season Pass ─────────────────────────────────────────────
  /** Season number this user is currently progressing in. */
  seasonNumber: number;
  /** Total XP earned this season. Resets when seasonNumber rolls over. */
  seasonXp: number;
  /** Highest level claimed (level rewards are auto-claimed up to this). */
  claimedLevel: number;

  // ─── Edge Boost (consumable power-up) ────────────────────────
  /** Inventory of unactivated boosts. Earned via the season pass. */
  edgeBoosts: number;

  // ─── Daily streak ─────────────────────────────────────────────
  /** Current consecutive-day login streak. */
  dailyStreak: number;
  /** Last day-of-year (UTC) the streak ticked, so we know when to advance. */
  dailyStreakDay: number;
  /** Timestamp of last seen activity (used for inactivity decay). */
  lastActiveAt: number;

  // ─── Promotion series ────────────────────────────────────────
  promo: PromoSeries | null;

  // ─── Social / safety ─────────────────────────────────────────
  blockedUsers: string[];
  friends: string[];
};

export const DEFAULT_USER: UserState = {
  username: null,
  authedAt: null,
  isOver18: false,
  consentedAt: null,
  hasScanned: false,
  faceDataUrl: null,
  edgeScore: null,
  hideFromBoard: false,
  elo: 800,
  peakElo: 800,
  wins: 0,
  losses: 0,
  streak: 0,
  placementsLeft: 5,
  matchHistory: [],
  seasonNumber: 1,
  seasonXp: 0,
  claimedLevel: 0,
  edgeBoosts: 0,
  dailyStreak: 0,
  dailyStreakDay: 0,
  lastActiveAt: 0,
  promo: null,
  blockedUsers: [],
  friends: []
};

export type UserStatus = "guest" | "auth-no-scan" | "calibrating" | "ranked";

export function getStatus(u: UserState): UserStatus {
  if (!u.username) return "guest";
  if (!u.hasScanned) return "auth-no-scan";
  if (u.placementsLeft > 0) return "calibrating";
  return "ranked";
}
