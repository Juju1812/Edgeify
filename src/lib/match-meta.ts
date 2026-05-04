/**
 * Small helpers for surfacing match-flow metadata in the UI.
 * Pure functions — easy to unit-test, no React deps.
 */

import type { GameMode } from "./types";

/**
 * Standard ELO win-probability formula.
 * Returns P(player A wins | rating A vs rating B) in [0, 1].
 */
export function winProbability(myElo: number, oppElo: number): number {
  return 1 / (1 + Math.pow(10, (oppElo - myElo) / 400));
}

/**
 * Detailed breakdown of XP earned for a single match. Mirrors the
 * formula in `season.xpForMatch` but exposes each piece so the result
 * screen can show "100 base + 30 streak + 20 mode = 150" instead of a
 * single opaque number.
 */
export function xpBreakdown(args: {
  won: boolean;
  streakAfter: number;
  practice: boolean;
  mode: GameMode;
}) {
  if (args.practice) {
    return {
      base: 15,
      streakBonus: 0,
      modeMult: 1,
      total: 15,
      label: "Practice"
    };
  }
  const base = args.won ? 100 : 30;
  const streakBonus = args.won
    ? Math.min(50, Math.max(0, args.streakAfter - 1) * 10)
    : 0;
  const modeMults: Record<GameMode, number> = {
    "bo3": 1.0,
    "bo5": 1.4,
    "sudden-death": 0.6,
    "rapid-fire": 0.8
  };
  const modeMult = modeMults[args.mode];
  const total = Math.round((base + streakBonus) * modeMult);
  return {
    base,
    streakBonus,
    modeMult,
    total,
    label: args.won ? "Win" : "Loss"
  };
}

/**
 * One-liner "what happened" recap. Picks a template based on the round
 * scoreline and ELO delta. Deterministic — same inputs always produce
 * the same recap, so it's stable across re-renders.
 */
export function matchRecapQuote(args: {
  won: boolean;
  myWins: number;
  oppWins: number;
  eloDelta: number;
  oppElo: number;
  myElo: number;
  oppName: string;
}): string {
  const { won, myWins, oppWins, eloDelta, oppElo, myElo, oppName } = args;
  const delta = oppElo - myElo;
  const sweep = won && oppWins === 0;
  const heartbreak = !won && myWins >= oppWins - 0.5; // close losses

  if (won && delta >= 200) {
    return `Massive upset — ${oppName} was ${delta} ELO above you and you took it.`;
  }
  if (won && sweep && delta >= 50) {
    return `Clean sweep against a higher-ranked opponent. The board moved.`;
  }
  if (won && sweep) {
    return `Two-zero. ${oppName} couldn't find a single round.`;
  }
  if (won && eloDelta >= 25) {
    return `Solid win, +${eloDelta} ELO. ${oppName} was no joke.`;
  }
  if (won) {
    return `W banked. Climb continues.`;
  }
  if (heartbreak && oppWins === 2 && myWins === 1) {
    return `Three-rounder, decided by inches. Reset and go again.`;
  }
  if (!won && delta <= -100) {
    return `${oppName} was ${Math.abs(delta)} ELO below you — that one stings.`;
  }
  if (!won && oppWins === 2 && myWins === 0) {
    return `Outclassed this round. Find the leaks and run it back.`;
  }
  return `Loss banked. ${eloDelta} ELO. Read the rounds and adjust.`;
}

/**
 * Suggested power-up to arm based on recent match history. Looks at
 * the last 8 ranked matches and picks a tip:
 *  - lots of close losses → Mulligan
 *  - opponent often outscores in symmetry → Edge Boost
 *  - cold start (first match this session) → Time Stop
 *  - streak ≥ 2 → Critical Hit (snowball)
 *  - default → Edge Boost (most universal)
 */
export function suggestedPowerUp(args: {
  recentMatches: Array<{ won: boolean; myScore: number; oppScore: number }>;
  streak: number;
}): "boost" | "shield" | "mulligan" | "timeStop" | "critical" {
  const recent = args.recentMatches.slice(0, 8);
  const closeLosses = recent.filter(
    (m) => !m.won && Math.abs(m.myScore - m.oppScore) <= 1
  ).length;
  if (closeLosses >= 3) return "mulligan";
  if (args.streak >= 2) return "critical";
  if (recent.length === 0) return "timeStop";
  const losses = recent.filter((m) => !m.won).length;
  if (losses >= 5) return "shield";
  return "boost";
}
