/** Types shared between server routes and client components. */

export const TRAIT_KEYS = [
  "harmony",
  "eyes",
  "jaw",
  "structure",
  "skin",
  "hair",
  "presentation"
] as const;
export type TraitKey = (typeof TRAIT_KEYS)[number];

export const TRAIT_LABELS: Record<TraitKey, string> = {
  harmony: "Harmony",
  eyes: "Eyes",
  jaw: "Jaw & chin",
  structure: "Bone structure",
  skin: "Skin",
  hair: "Hair",
  presentation: "Grooming"
};

export type Traits = Record<TraitKey, number>;

export type Reading = {
  overall: number;
  traits: Traits;
  at: number;
  source: "scan" | "match";
};

/** The user's current score: a rolling average of their recent readings. */
export type Score = {
  overall: number;
  traits: Traits;
  headline: string;
  strengths: string[];
  improvements: string[];
  confidence: "low" | "medium" | "high";
  readings: number;
  updatedAt: number;
};

export type MeProfile = {
  username: string;
  createdAt: number;
  elo: number;
  peakElo: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  placementsLeft: number;
  score: Score | null;
  hasFace: boolean;
  bio: string;
  country: string;
  showOnBoard: boolean;
};

export type PublicProfile = Pick<
  MeProfile,
  "username" | "elo" | "peakElo" | "wins" | "losses" | "draws" | "bio" | "country" | "hasFace"
> & {
  overall: number | null;
  traits: Traits | null;
  headline: string | null;
  rank: number | null;
  online: boolean;
};

export type LeaderboardRow = {
  rank: number;
  username: string;
  elo: number;
  overall: number | null;
  wins: number;
  losses: number;
  country: string;
  hasFace: boolean;
};

export const PLACEMENT_MATCHES = 3;
export const START_ELO = 1000;
