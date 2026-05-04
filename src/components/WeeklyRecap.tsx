"use client";

import { useMemo } from "react";
import { useUser } from "@/lib/user-context";

/**
 * Auto-generated weekly recap card — shows wins/losses/ELO change
 * over the last 7 days, plus your most-played opponent. No server
 * round trip; computed locally from match history.
 */
export function WeeklyRecap() {
  const { user, status } = useUser();
  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const recent = user.matchHistory.filter((m) => m.playedAt >= weekAgo);
    if (recent.length === 0) return null;

    const wins = recent.filter((m) => m.won).length;
    const losses = recent.length - wins;
    const eloDelta = recent.reduce((s, m) => s + m.eloDelta, 0);

    const opps = new Map<string, number>();
    for (const m of recent) {
      opps.set(m.opponentName, (opps.get(m.opponentName) || 0) + 1);
    }
    const topOpp = [...opps.entries()].sort((a, b) => b[1] - a[1])[0];

    return { count: recent.length, wins, losses, eloDelta, topOpp };
  }, [user.matchHistory]);

  if (status === "guest") return null;
  if (!stats) return null;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <p className="label-xs text-edge-cyan">Last 7 days</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Matches" value={stats.count} />
        <Stat
          label="W / L"
          value={`${stats.wins}–${stats.losses}`}
          color={stats.wins >= stats.losses ? "#34d399" : "#f87171"}
        />
        <Stat
          label="ELO Δ"
          value={`${stats.eloDelta >= 0 ? "+" : ""}${stats.eloDelta}`}
          color={stats.eloDelta >= 0 ? "#22e9ff" : "#ff5d8f"}
        />
        {stats.topOpp && (
          <Stat
            label="Most played"
            value={`${stats.topOpp[0]} ×${stats.topOpp[1]}`}
            small
          />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  small
}: {
  label: string;
  value: string | number;
  color?: string;
  small?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.32em] text-white/40">
        {label}
      </p>
      <p
        className={
          "stat-mono font-bold " +
          (small ? "mt-1 truncate text-sm" : "mt-1 text-2xl")
        }
        style={{ color: color || "#fff" }}
      >
        {value}
      </p>
    </div>
  );
}
