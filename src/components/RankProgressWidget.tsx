"use client";

import Link from "next/link";
import { rankFromElo, RANKS } from "@/lib/rank";
import { useUser } from "@/lib/user-context";

/**
 * Compact widget showing how close the user is to the next tier and
 * the ELO gap to it. Lives on the home page beside the season strip.
 */
export function RankProgressWidget() {
  const { user, status } = useUser();
  if (status !== "ranked") return null;

  const cur = rankFromElo(user.elo);
  const curIdx = RANKS.findIndex((r) => r.tier === cur.tier);
  const next = RANKS[curIdx + 1];

  // Already at peak tier — show a celebratory variant.
  if (!next) {
    return (
      <div className="glass rounded-2xl p-5">
        <p className="label-xs text-edge-amber">Top tier</p>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          You&apos;re in <span style={{ color: cur.color }}>{cur.label}</span>.
          Defend the crown.
        </p>
      </div>
    );
  }

  const span = next.floor - cur.floor;
  const into = Math.max(0, user.elo - cur.floor);
  const pct = Math.min(100, (into / span) * 100);
  const gap = next.floor - user.elo;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-xs">Climb</p>
          <p className="mt-1 text-sm text-white/65">
            <span style={{ color: cur.color }}>{cur.emoji} {cur.label}</span>
            <span className="mx-2 text-white/25">→</span>
            <span style={{ color: next.color }}>
              {next.emoji} {next.label}
            </span>
          </p>
        </div>
        <p className="stat-mono text-right text-2xl text-edge-cyan">
          {gap}
          <span className="ml-1 text-[10px] uppercase tracking-[0.32em] text-white/40">
            ELO
          </span>
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full transition-all"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${cur.color} 0%, ${next.color} 100%)`
          }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">
          {Math.round(pct)}% of the way
        </p>
        <Link
          href="/arena"
          className="text-[10px] uppercase tracking-[0.22em] text-edge-cyan hover:text-white"
        >
          Queue match →
        </Link>
      </div>
    </div>
  );
}
