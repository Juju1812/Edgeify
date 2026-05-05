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

      {/* Streak insurance — spend 3 Edge Boosts to bank one saver. The
          saver auto-consumes if the user misses exactly one day. */}
      <StreakInsurance />
    </div>
  );
}

function StreakInsurance() {
  const { user, update } = useUser();
  const have = user.streakSavers || 0;
  const COST = 3;
  function buy() {
    if (user.edgeBoosts < COST) return;
    if (have >= 1) return;
    update({
      edgeBoosts: user.edgeBoosts - COST,
      streakSavers: have + 1
    });
  }
  if (have >= 1) {
    return (
      <div className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.05] px-3 py-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-300">
          🛟 Streak saver armed — auto-rescues one missed day
        </p>
      </div>
    );
  }
  const canAfford = user.edgeBoosts >= COST;
  return (
    <button
      onClick={buy}
      disabled={!canAfford}
      className={
        "mt-3 w-full rounded-lg border px-3 py-2 text-[10px] uppercase tracking-[0.22em] transition " +
        (canAfford
          ? "border-edge-coral/35 bg-edge-coral/[0.05] text-edge-coral hover:border-edge-coral/60 hover:bg-edge-coral/15"
          : "cursor-not-allowed border-white/10 bg-white/[0.02] text-white/35")
      }
    >
      🛟 Buy streak saver · {COST} ⚡ ({user.edgeBoosts} owned)
    </button>
  );
}
