"use client";

import { useState } from "react";
import { useUser } from "@/lib/user-context";
import { dayOfYearUtc } from "@/lib/season";

/**
 * Streak heat-map — derives "active days" from match history
 * timestamps. Surfaces the daily-streak count alongside a visual
 * pattern so the user can see how consistently they show up.
 *
 * Toggleable between 14-day (compact) and 30-day (deeper history)
 * views. Active-cell intensity is now a 4-step ramp based on how
 * many matches were played that day, not a binary on/off.
 */
export function StreakCalendar() {
  const { user, status } = useUser();
  const [span, setSpan] = useState<14 | 30>(14);
  if (status === "guest") return null;

  const today = dayOfYearUtc();
  const dayCounts = new Map<number, number>();
  for (const m of user.matchHistory) {
    const d = dayOfYearUtc(m.playedAt);
    dayCounts.set(d, (dayCounts.get(d) || 0) + 1);
  }

  const days: { day: number; count: number; isToday: boolean }[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const d = today - i;
    days.push({ day: d, count: dayCounts.get(d) || 0, isToday: d === today });
  }

  // 4-step intensity ramp based on per-day match count.
  function intensityClass(count: number): string {
    if (count === 0) return "bg-white/[0.04] ring-1 ring-white/[0.04]";
    if (count === 1) return "bg-edge-cyan/25 ring-1 ring-edge-cyan/30";
    if (count <= 3) return "bg-edge-cyan/45 ring-1 ring-edge-cyan/50";
    if (count <= 6) return "bg-edge-cyan/65 ring-1 ring-edge-cyan/70";
    return "bg-edge-cyan/85 ring-1 ring-edge-cyan/90";
  }

  const activeCount = days.filter((d) => d.count > 0).length;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="label-xs">Streak · {span}d</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSpan(14)}
            className={
              "rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] transition " +
              (span === 14
                ? "bg-edge-cyan/20 text-edge-cyan"
                : "text-white/35 hover:text-white/65")
            }
          >
            14d
          </button>
          <button
            onClick={() => setSpan(30)}
            className={
              "rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] transition " +
              (span === 30
                ? "bg-edge-cyan/20 text-edge-cyan"
                : "text-white/35 hover:text-white/65")
            }
          >
            30d
          </button>
          <p className="stat-mono text-edge-coral">🔥 {user.dailyStreak}-day</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {days.map((d) => (
          <div
            key={d.day}
            title={
              d.isToday
                ? `Today · ${d.count} match${d.count === 1 ? "" : "es"}`
                : `${d.count} match${d.count === 1 ? "" : "es"}`
            }
            className={
              "rounded-md transition " +
              (span === 14 ? "h-6 w-6 " : "h-5 w-5 ") +
              intensityClass(d.count) +
              (d.isToday ? " outline outline-1 outline-edge-coral" : "")
            }
          />
        ))}
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-[0.32em] text-white/35">
        {activeCount} active of {span} · today {dayCounts.has(today) ? "✓" : "—"}
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
