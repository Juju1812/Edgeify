"use client";

import { rankFromElo } from "@/lib/rank";

export function HeroBadge({
  username = "GUEST",
  elo = 337,
  online = 3400
}: {
  username?: string;
  elo?: number;
  online?: number;
}) {
  const rank = rankFromElo(elo);
  const onlineDisplay =
    online >= 1000 ? `${(online / 1000).toFixed(1)}K` : online.toString();

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="label-xs">Season 1</p>

      <div
        className="glass relative flex items-center gap-3 rounded-2xl px-6 py-3"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 60px -10px rgba(168, 85, 247, 0.5)"
        }}
      >
        <span className="font-semibold uppercase tracking-[0.22em] text-white/95">
          {username}
        </span>
        <span className="text-white/20">•</span>
        <span
          className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.22em]"
          style={{ color: rank.color }}
        >
          <span aria-hidden>{rank.emoji}</span>
          {rank.label}
        </span>
        <span className="text-white/20">•</span>
        <span className="font-semibold uppercase tracking-[0.22em] text-cyan-300">
          {elo} ELO
        </span>
      </div>

      <div className="pill text-white/70">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inset-0 animate-pulse-dot rounded-full bg-emerald-400/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[11px] tracking-[0.22em]">
          {onlineDisplay} Online
        </span>
      </div>
    </div>
  );
}
