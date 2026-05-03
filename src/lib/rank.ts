export type RankTier =
  | "SUB3"
  | "SUB2"
  | "SUB1"
  | "AVG"
  | "CHAD3"
  | "CHAD2"
  | "CHAD1"
  | "GIGA"
  | "MOGGER"
  | "MYTHIC";

export type RankInfo = {
  tier: RankTier;
  label: string;
  emoji: string;
  color: string; // hex
  /** Inclusive ELO floor */
  floor: number;
};

export const RANKS: RankInfo[] = [
  { tier: "SUB3", label: "SUB3", emoji: "🍂", color: "#f59e0b", floor: 0 },
  { tier: "SUB2", label: "SUB2", emoji: "🍂", color: "#f59e0b", floor: 400 },
  { tier: "SUB1", label: "SUB1", emoji: "🍂", color: "#f59e0b", floor: 600 },
  { tier: "AVG", label: "AVG", emoji: "⚖️", color: "#94a3b8", floor: 800 },
  { tier: "CHAD3", label: "CHAD3", emoji: "💪", color: "#22d3ee", floor: 1000 },
  { tier: "CHAD2", label: "CHAD2", emoji: "💪", color: "#22d3ee", floor: 1200 },
  { tier: "CHAD1", label: "CHAD1", emoji: "💪", color: "#22d3ee", floor: 1400 },
  { tier: "GIGA", label: "GIGA", emoji: "🗿", color: "#a855f7", floor: 1600 },
  { tier: "MOGGER", label: "MOGGER", emoji: "👑", color: "#f43f5e", floor: 1800 }
];

export function rankFromElo(elo: number, globalRank?: number): RankInfo {
  if (globalRank !== undefined && globalRank <= 100) {
    return { tier: "MYTHIC", label: "MYTHIC", emoji: "✨", color: "#fde047", floor: 1800 };
  }
  let current = RANKS[0];
  for (const r of RANKS) {
    if (elo >= r.floor) current = r;
  }
  return current;
}
