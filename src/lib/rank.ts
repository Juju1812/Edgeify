/**
 * 7-tier rank system, looksmaxxing slang, worst → best:
 *   sub3 → sub5 → ltn → mtn → htn → chad → true adam
 *
 * ELO bands chosen so a randomly seeded population (mean ~1100) lands
 * roughly in mtn/htn, with chad and true adam being aspirational tiers.
 */

export type RankTier = "SUB3" | "SUB5" | "LTN" | "MTN" | "HTN" | "CHAD" | "TRUE_ADAM";

export type RankInfo = {
  tier: RankTier;
  label: string;
  emoji: string;
  color: string; // hex
  /** Inclusive ELO floor */
  floor: number;
};

export const RANKS: RankInfo[] = [
  { tier: "SUB3",      label: "SUB3",       emoji: "🥀", color: "#6b7280", floor: 0 },    // gray-500
  { tier: "SUB5",      label: "SUB5",       emoji: "🍂", color: "#a16207", floor: 500 },  // amber-700
  { tier: "LTN",       label: "LTN",        emoji: "💧", color: "#0891b2", floor: 800 },  // cyan-600
  { tier: "MTN",       label: "MTN",        emoji: "⚖️", color: "#22d3ee", floor: 1000 }, // cyan-400
  { tier: "HTN",       label: "HTN",        emoji: "🔥", color: "#a855f7", floor: 1250 }, // violet-500
  { tier: "CHAD",      label: "CHAD",       emoji: "💪", color: "#f43f5e", floor: 1500 }, // rose-500
  { tier: "TRUE_ADAM", label: "TRUE ADAM",  emoji: "👑", color: "#fde047", floor: 1800 }  // yellow-300
];

/**
 * Map an ELO to a rank tier. The optional `globalRank` parameter is kept
 * for API compatibility but no longer special-cases the top of the
 * board — TRUE ADAM is the natural top tier now.
 */
export function rankFromElo(elo: number, _globalRank?: number): RankInfo {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (elo >= r.floor) current = r;
  }
  return current;
}
