/** Types shared between server routes and client components. */

export const TRAIT_KEYS = [
  "symmetry",
  "proportions",
  "jaw",
  "cheekbones",
  "eyes",
  "leanness",
  "skin",
  "hair"
] as const;
export type TraitKey = (typeof TRAIT_KEYS)[number];

export const TRAIT_LABELS: Record<TraitKey, string> = {
  symmetry: "Symmetry",
  proportions: "Proportions",
  jaw: "Jawline",
  cheekbones: "Cheekbones",
  eyes: "Eyes",
  leanness: "Leanness",
  skin: "Skin",
  hair: "Hair"
};

export type Traits = Record<TraitKey, number>;

/**
 * Readings saved before the 8-category update used harmony / structure /
 * presentation. Map them onto the new keys so old scores still display and
 * average cleanly until the player rescans.
 */
export function normalizeTraits(t: Partial<Record<string, number>> | null | undefined): Traits {
  const src = t || {};
  const pick = (...keys: string[]) => {
    for (const k of keys) if (typeof src[k] === "number") return src[k] as number;
    return 50;
  };
  return {
    symmetry: pick("symmetry", "harmony"),
    proportions: pick("proportions", "harmony"),
    jaw: pick("jaw"),
    cheekbones: pick("cheekbones", "structure"),
    eyes: pick("eyes"),
    leanness: pick("leanness", "structure", "jaw"),
    skin: pick("skin"),
    hair: pick("hair")
  };
}

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
  /** Colour of the face-scan dots and callouts (hex). */
  overlayColor: string;
};

export const DEFAULT_OVERLAY_COLOR = "#ffffff";

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
