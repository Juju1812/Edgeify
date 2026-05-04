"use client";

import { useUser } from "@/lib/user-context";
import { dayOfYearUtc } from "@/lib/season";

/**
 * 14-day streak heatmap — derives "active days" from match history
 * timestamps. Surfaces the daily-streak count alongside a visual
 * pattern so the user can see how consistently they show up.
 */
export function StreakCalendar() {
  const { user, status } = useUser();
  if (status === "guest") return null;

  const today = dayOfYearUtc();
  const activeDays = new Set<number>();
  for (const m of user.matchHistory) {
    activeDays.add(dayOfYearUtc(m.playedAt));
  }

  const days: { day: number; active: boolean; isToday: boolean }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = today - i;
    days.push({ day: d, active: activeDays.has(d), isToday: d === today });
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <p className="label-xs">Streak · 14d</p>
        <p className="stat-mono text-edge-coral">
          🔥 {user.dailyStreak}-day
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {days.map((d) => (
          <div
            key={d.day}
            title={
              d.isToday
                ? "Today"
                : d.active
                  ? "Active"
                  : "Idle"
            }
            className={
              "h-6 w-6 rounded-md transition " +
              (d.active
                ? "bg-edge-cyan/40 ring-1 ring-edge-cyan/40"
                : "bg-white/[0.04] ring-1 ring-white/[0.04]") +
              (d.isToday ? " outline outline-1 outline-edge-coral" : "")
            }
          />
        ))}
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-[0.32em] text-white/35">
        {Array.from(activeDays).filter((d) => d > today - 14).length} active
        of 14 · today {activeDays.has(today) ? "✓" : "—"}
      </p>
    </div>
  );
}
