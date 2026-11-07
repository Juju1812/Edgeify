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

// ─── PSL scale ─────────────────────────────────────────────────────────
// Scores are aligned to the PSL scale: score = PSL × 10 + 10, so 50 = PSL 4
// (dead average), 60 = PSL 5 (~84th percentile), 70 = PSL 6 (model tier,
// ~97th), 80 = PSL 7 (~99.9th).
export const SCORE_SCALE_VERSION = 2;

export type Sex = "male" | "female" | "unclear";

export function pslFromScore(overall: number) {
  return Math.max(0, Math.min(9, (overall - 10) / 10));
}

export function formatPsl(overall: number) {
  return `PSL ${pslFromScore(overall).toFixed(1)}`;
}

/** Community tier name for a score. "Subhuman" is deliberately not used. */
export function tierName(overall: number, sex: Sex | null | undefined = "male") {
  const psl = pslFromScore(overall);
  const f = sex === "female";
  if (psl >= 7) return f ? "Stacy" : "Chad";
  if (psl >= 6) return f ? "Stacylite" : "Chadlite";
  if (psl >= 5) return f ? "HTB" : "HTN";
  if (psl >= 4) return f ? "MTB" : "MTN";
  if (psl >= 3) return f ? "LTB" : "LTN";
  return "Below average";
}

export type Reading = {
  overall: number;
  traits: Traits;
  at: number;
  source: "scan" | "match";
  /** Scoring scale the reading was made on (2 = PSL-aligned). */
  v?: number;
};

/** The user's current score: exactly what their most recent scan said. */
export type Score = {
  overall: number;
  traits: Traits;
  headline: string;
  strengths: string[];
  improvements: string[];
  confidence: "low" | "medium" | "high";
  readings: number;
  updatedAt: number;
  /** Facial ratios measured on the most recent scan (if face tracking ran). */
  ratios?: Partial<Record<string, number>> | null;
  ratioScore?: number | null;
  /** Apparent sex from the latest scan — only used to pick tier names. */
  sex?: Sex;
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
  /** When the profile photo was last replaced (busts avatar caches). */
  faceAt?: number;
  bio: string;
  country: string;
  showOnBoard: boolean;
  /** Colour of the face-scan dots and callouts (hex). */
  overlayColor: string;
};

export const DEFAULT_OVERLAY_COLOR = "#ffffff";

export type PublicProfile = Pick<
  MeProfile,
  "username" | "elo" | "peakElo" | "wins" | "losses" | "draws" | "bio" | "country" | "hasFace" | "faceAt"
> & {
  overall: number | null;
  traits: Traits | null;
  headline: string | null;
  sex: Sex | null;
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
  faceAt?: number;
};

export const PLACEMENT_MATCHES = 3;
export const START_ELO = 1000;
