"use client";

import { dayOfYearUtc } from "@/lib/season";
import type { MatchRecord } from "@/lib/types";

/**
 * 30-day activity heatmap. Each cell's intensity reflects how many
 * matches were played that day. Inspired by GitHub's contribution
 * graph but compressed to a single row of 30 cells.
 */
export function ActivityHeatmap({ history }: { history: MatchRecord[] }) {
  const today = dayOfYearUtc();
  const counts = new Map<number, number>();
  for (const m of history) {
    const d = dayOfYearUtc(m.playedAt);
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  const max = Math.max(1, ...Array.from(counts.values()));

  const cells: { day: number; count: number; isToday: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = today - i;
    cells.push({
      day: d,
      count: counts.get(d) || 0,
      isToday: d === today
    });
  }

  function bg(count: number, isToday: boolean): string {
    if (count === 0)
      return isToday ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)";
    const frac = count / max;
    const r = Math.round(34 + (255 - 34) * frac);
    const g = Math.round(233 - (233 - 93) * frac);
    const b = Math.round(255 - (255 - 143) * frac);
    return `rgba(${r}, ${g}, ${b}, ${0.25 + frac * 0.5})`;
  }

  const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
  const activeDays = counts.size;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-center justify-between">
        <p className="label-xs">Last 30 days</p>
        <p className="stat-mono text-[10px] uppercase tracking-[0.32em] text-white/40">
          {total} matches · {activeDays} active days
        </p>
      </div>
      <div className="mt-4 flex gap-1">
        {cells.map((c) => (
          <div
            key={c.day}
            title={
              c.isToday
                ? `Today · ${c.count} matches`
                : `${c.count} match${c.count === 1 ? "" : "es"}`
            }
            className={
              "h-8 flex-1 rounded-sm " +
              (c.isToday ? "ring-1 ring-edge-coral" : "")
            }
            style={{ background: bg(c.count, c.isToday) }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-white/35">
        <span>30d ago</span>
        <span className="flex-1" />
        <span>Today</span>
      </div>
    </div>
  );
}
