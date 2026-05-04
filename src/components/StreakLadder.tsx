"use client";

import { useUser } from "@/lib/user-context";

/**
 * Visual reward ladder for the daily login streak. Shows what you'll
 * earn at each milestone day (1, 3, 7, 14, 30) — gives the streak
 * counter context beyond just the number.
 */
const MILESTONES = [
  { day: 1, reward: "+25 XP", emoji: "✨" },
  { day: 3, reward: "Edge Boost", emoji: "⚡" },
  { day: 7, reward: "Bronze frame", emoji: "🥉" },
  { day: 14, reward: '"Edger" title', emoji: "🏷️" },
  { day: 30, reward: "Silver frame", emoji: "🥈" }
];

export function StreakLadder() {
  const { user, status } = useUser();
  if (status === "guest") return null;
  const streak = user.dailyStreak;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <p className="label-xs">Streak Rewards</p>
        <p className="stat-mono text-edge-coral">🔥 {streak}-day</p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        {MILESTONES.map((m, i) => {
          const reached = streak >= m.day;
          const isNext =
            !reached && (i === 0 || streak >= MILESTONES[i - 1].day);
          return (
            <div
              key={m.day}
              className="flex flex-1 flex-col items-center gap-1 text-center"
            >
              <div
                className={
                  "flex h-10 w-10 items-center justify-center rounded-full text-base transition " +
                  (reached
                    ? "border-2 border-edge-cyan bg-edge-cyan/15"
                    : isNext
                      ? "border-2 border-edge-coral/60 bg-edge-coral/[0.06] animate-pulse"
                      : "border border-white/10 bg-white/[0.02] grayscale opacity-50")
                }
              >
                {m.emoji}
              </div>
              <p
                className={
                  "stat-mono text-[10px] uppercase tracking-[0.22em] " +
                  (reached
                    ? "text-edge-cyan"
                    : isNext
                      ? "text-edge-coral"
                      : "text-white/35")
                }
              >
                D{m.day}
              </p>
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/45">
                {m.reward}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
