import type { UserState } from "./types";

export type Challenge = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  /** XP awarded when completed. */
  reward: number;
  /** Reads progress from user state in [0..1]. */
  progress: (u: UserState) => number;
  /** True when complete. */
  done: (u: UserState) => boolean;
};

/**
 * Weekly challenges rotate every Monday UTC. We pick 3 from the pool
 * deterministically by seeding from the ISO week number, so all users
 * see the same set.
 */
const POOL: Challenge[] = [
  {
    id: "win3",
    title: "Win 3 matches",
    description: "Take any 3 ranked wins this week.",
    emoji: "⚔️",
    reward: 200,
    progress: (u) => Math.min(1, weeklyWins(u) / 3),
    done: (u) => weeklyWins(u) >= 3
  },
  {
    id: "winstreak3",
    title: "3-win streak",
    description: "Win 3 in a row.",
    emoji: "🔥",
    reward: 150,
    progress: (u) => Math.min(1, u.streak / 3),
    done: (u) => u.streak >= 3
  },
  {
    id: "score80",
    title: "Score 80+ on Symmetry",
    description: "Hit 80 or higher on a Symmetry round.",
    emoji: "🎯",
    reward: 150,
    progress: (u) => {
      const best = bestRoundScore(u, "Symmetry");
      return Math.min(1, best / 80);
    },
    done: (u) => bestRoundScore(u, "Symmetry") >= 80
  },
  {
    id: "upset",
    title: "Slay above your rank",
    description: "Beat someone with 100+ ELO over you.",
    emoji: "🗡️",
    reward: 250,
    progress: (u) =>
      u.matchHistory.some((m) => m.won && m.opponentElo - (u.elo - m.eloDelta) >= 100)
        ? 1
        : 0,
    done: (u) =>
      u.matchHistory.some((m) => m.won && m.opponentElo - (u.elo - m.eloDelta) >= 100)
  },
  {
    id: "play5",
    title: "Play 5 matches",
    description: "Any 5 ranked matches this week.",
    emoji: "🎮",
    reward: 100,
    progress: (u) => Math.min(1, weeklyMatches(u) / 5),
    done: (u) => weeklyMatches(u) >= 5
  },
  {
    id: "jaw80",
    title: "Score 80+ on Jawline",
    description: "Hit 80 or higher on a Jawline round.",
    emoji: "💪",
    reward: 150,
    progress: (u) => {
      const best = bestRoundScore(u, "Jawline");
      return Math.min(1, best / 80);
    },
    done: (u) => bestRoundScore(u, "Jawline") >= 80
  },
  {
    id: "sweep",
    title: "Sweep a match 2-0",
    description: "Win without dropping a round.",
    emoji: "🧹",
    reward: 200,
    progress: (u) =>
      u.matchHistory.some((m) => m.won && m.oppScore === 0) ? 1 : 0,
    done: (u) => u.matchHistory.some((m) => m.won && m.oppScore === 0)
  }
];

function weekStart(): number {
  const d = new Date();
  const day = d.getUTCDay() || 7; // Sunday=0 → 7
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (day - 1))
  );
  return monday.getTime();
}

function weeklyMatches(u: UserState): number {
  const since = weekStart();
  return u.matchHistory.filter((m) => !m.practice && m.playedAt >= since).length;
}

function weeklyWins(u: UserState): number {
  const since = weekStart();
  return u.matchHistory.filter((m) => !m.practice && m.won && m.playedAt >= since).length;
}

function bestRoundScore(u: UserState, criterion: string): number {
  let best = 0;
  for (const m of u.matchHistory) {
    if (!m.rounds) continue;
    for (const r of m.rounds) {
      if (r.criterion === criterion && r.me > best) best = r.me;
    }
  }
  return best;
}

/** ISO week number used as the deterministic seed. */
function isoWeek(): number {
  const d = new Date();
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

/** Deterministically pick 3 challenges for the current week. */
export function weeklyChallenges(): Challenge[] {
  const seed = isoWeek();
  const indices: number[] = [];
  let s = seed;
  while (indices.length < 3 && indices.length < POOL.length) {
    s = (s * 9301 + 49297) % 233280;
    const idx = s % POOL.length;
    if (!indices.includes(idx)) indices.push(idx);
  }
  return indices.map((i) => POOL[i]);
}
