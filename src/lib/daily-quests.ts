/**
 * Daily quests — three rotating objectives per UTC day, with seeded
 * randomness so all players see the same set on the same day. Progress
 * tracking lives in localStorage; rewards are claimed via the existing
 * UserState patches (XP, edge boost, etc).
 */

import type { UserState } from "./types";
import { dayOfYearUtc } from "./season";

export type Quest = {
  id: string;
  label: string;
  emoji: string;
  /** Returns 0..1 progress for the user. */
  progress: (u: UserState) => number;
  /** Reward delta applied via update() once. */
  reward: { kind: "xp"; amount: number } | { kind: "boost"; amount: number };
};

const POOL: Quest[] = [
  {
    id: "play-1",
    label: "Play one ranked match",
    emoji: "⚔️",
    progress: (u) => Math.min(1, u.matchHistory.filter((m) => !m.practice).length / 1),
    reward: { kind: "xp", amount: 50 }
  },
  {
    id: "play-3",
    label: "Play three matches",
    emoji: "🎯",
    progress: (u) => Math.min(1, u.matchHistory.length / 3),
    reward: { kind: "xp", amount: 100 }
  },
  {
    id: "win-2",
    label: "Win two matches",
    emoji: "🔥",
    progress: (u) => Math.min(1, u.matchHistory.filter((m) => m.won).length / 2),
    reward: { kind: "xp", amount: 75 }
  },
  {
    id: "win-clean",
    label: "Win a 2-0 sweep",
    emoji: "🧹",
    progress: (u) =>
      u.matchHistory.some((m) => m.won && m.myScore >= 2 && m.oppScore === 0) ? 1 : 0,
    reward: { kind: "xp", amount: 80 }
  },
  {
    id: "streak-2",
    label: "Hit a 2-win streak",
    emoji: "♨️",
    progress: (u) => Math.min(1, u.streak / 2),
    reward: { kind: "xp", amount: 60 }
  },
  {
    id: "elo-up",
    label: "Gain +20 ELO today",
    emoji: "📈",
    progress: (u) => {
      const today = dayOfYearUtc();
      const todayMs = today * 86400000;
      const gained = u.matchHistory
        .filter((m) => m.playedAt >= todayMs && m.eloDelta > 0)
        .reduce((s, m) => s + m.eloDelta, 0);
      return Math.min(1, gained / 20);
    },
    reward: { kind: "boost", amount: 1 }
  },
  {
    id: "scan",
    label: "Scan your face",
    emoji: "🧪",
    progress: (u) => (u.hasScanned ? 1 : 0),
    reward: { kind: "xp", amount: 40 }
  },
  {
    id: "befriend",
    label: "Add a friend",
    emoji: "🤝",
    progress: (u) => Math.min(1, u.friends.length / 1),
    reward: { kind: "xp", amount: 50 }
  },
  {
    id: "boss",
    label: "Beat today's daily boss",
    emoji: "👹",
    progress: (u) => {
      const today = dayOfYearUtc();
      const todayMs = today * 86400000;
      return u.matchHistory.some((m) => m.playedAt >= todayMs && m.won) ? 0.5 : 0;
    },
    reward: { kind: "xp", amount: 120 }
  }
];

/**
 * Returns the 3 quests for the given UTC day. Deterministic — the same
 * day always returns the same set across all players.
 */
export function questsForDay(day: number = dayOfYearUtc()): Quest[] {
  // Seeded shuffle based on the day-of-year.
  const seed = day * 9301 + 49297;
  const indices = POOL.map((_, i) => i);
  // Simple Fisher-Yates with seeded RNG.
  let s = seed;
  for (let i = indices.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, 3).map((i) => POOL[i]);
}

const CLAIMED_KEY = "edgify:quests:claimed:v1";

type ClaimedMap = Record<string, string[]>; // dayKey → list of quest ids

function loadClaimed(): ClaimedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CLAIMED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveClaimed(c: ClaimedMap) {
  if (typeof window === "undefined") return;
  try {
    // Trim old day entries (keep last 7 days).
    const today = dayOfYearUtc();
    const trimmed: ClaimedMap = {};
    for (const [k, v] of Object.entries(c)) {
      if (Number(k) >= today - 7) trimmed[k] = v;
    }
    window.localStorage.setItem(CLAIMED_KEY, JSON.stringify(trimmed));
  } catch {
    /* */
  }
}

export function isClaimed(questId: string, day: number = dayOfYearUtc()): boolean {
  const c = loadClaimed();
  return (c[String(day)] || []).includes(questId);
}

export function markClaimed(questId: string, day: number = dayOfYearUtc()) {
  const c = loadClaimed();
  const k = String(day);
  c[k] = c[k] || [];
  if (!c[k].includes(questId)) c[k].push(questId);
  saveClaimed(c);
}
