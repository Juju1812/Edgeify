import type { UserState } from "./types";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  /** Returns true if the user has unlocked this. */
  check: (u: UserState) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "scanned",
    name: "Calibrated",
    description: "Complete your first face scan",
    emoji: "🧪",
    check: (u) => u.hasScanned
  },
  {
    id: "ranked",
    name: "Ranked Up",
    description: "Finish your 5 placement matches",
    emoji: "🎖️",
    check: (u) => u.hasScanned && u.placementsLeft === 0
  },
  {
    id: "first-win",
    name: "First Blood",
    description: "Win your first match",
    emoji: "🩸",
    check: (u) => u.wins >= 1
  },
  {
    id: "five-wins",
    name: "Hitting Stride",
    description: "Win 5 matches",
    emoji: "🔥",
    check: (u) => u.wins >= 5
  },
  {
    id: "ten-wins",
    name: "Veteran",
    description: "Win 10 matches",
    emoji: "⚔️",
    check: (u) => u.wins >= 10
  },
  {
    id: "streak-3",
    name: "Heating Up",
    description: "Win 3 matches in a row",
    emoji: "♨️",
    check: (u) => u.streak >= 3
  },
  {
    id: "streak-5",
    name: "On Fire",
    description: "Win 5 matches in a row",
    emoji: "🚀",
    check: (u) => u.streak >= 5
  },
  {
    id: "htn",
    name: "High Tier",
    description: "Climb to HTN (1250 ELO)",
    emoji: "🔥",
    check: (u) => u.peakElo >= 1250
  },
  {
    id: "chad",
    name: "Chad",
    description: "Climb to CHAD (1500 ELO)",
    emoji: "💪",
    check: (u) => u.peakElo >= 1500
  },
  {
    id: "true-adam",
    name: "True Adam",
    description: "Reach the peak — 1800 ELO",
    emoji: "👑",
    check: (u) => u.peakElo >= 1800
  },
  {
    id: "upset",
    name: "Slayer",
    description: "Beat someone 200+ ELO above you",
    emoji: "🗡️",
    check: (u) =>
      u.matchHistory.some((m) => m.won && m.opponentElo - (u.elo - m.eloDelta) >= 200)
  },
  {
    id: "mogger",
    name: "Big Mogger",
    description: "Win a match with +30 ELO gained",
    emoji: "🗿",
    check: (u) => u.matchHistory.some((m) => m.won && m.eloDelta >= 30)
  }
];

export function unlockedAchievements(user: UserState): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.check(user));
}
