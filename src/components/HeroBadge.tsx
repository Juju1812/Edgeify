"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/user-context";
import { rankFromElo } from "@/lib/rank";

export function HeroBadge({ onSignIn }: { onSignIn: () => void }) {
  const { user, status, ready } = useUser();
  const [stats, setStats] = useState<{ onlineCount: number; inQueueCount: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        /* */
      }
    };
    fetchStats();
    const t = window.setInterval(fetchStats, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="label-xs">Season 1</p>

      {!ready ? (
        <div className="glass h-[52px] w-[280px] animate-pulse rounded-2xl" />
      ) : status === "guest" ? (
        <button
          onClick={onSignIn}
          className="glass glass-hover relative flex items-center gap-3 rounded-2xl px-6 py-3 transition"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 60px -10px rgba(168, 85, 247, 0.5)"
          }}
        >
          <span className="font-semibold uppercase tracking-[0.22em] text-white/80">
            Guest
          </span>
          <span className="text-white/20">•</span>
          <span className="font-semibold uppercase tracking-[0.22em] text-mog-violet">
            Claim your rank →
          </span>
        </button>
      ) : status === "auth-no-scan" ? (
        <div
          className="glass relative flex items-center gap-3 rounded-2xl px-6 py-3"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 60px -10px rgba(168, 85, 247, 0.5)"
          }}
        >
          <span className="font-semibold uppercase tracking-[0.22em] text-white/95">
            {user.username}
          </span>
          <span className="text-white/20">•</span>
          <span className="font-semibold uppercase tracking-[0.22em] text-mog-violet">
            Unscanned
          </span>
        </div>
      ) : (
        <RankPill
          username={user.username!}
          elo={user.elo}
          placementsLeft={user.placementsLeft}
        />
      )}

      <div className="pill text-white/70">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inset-0 animate-pulse-dot rounded-full bg-emerald-400/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[11px] tracking-[0.22em]">
          {stats
            ? `${stats.onlineCount} Online${
                stats.inQueueCount > 0 ? ` · ${stats.inQueueCount} Queued` : ""
              }`
            : "Online"}
        </span>
      </div>
    </div>
  );
}

function RankPill({
  username,
  elo,
  placementsLeft
}: {
  username: string;
  elo: number;
  placementsLeft: number;
}) {
  const rank = rankFromElo(elo);
  const isCalibrating = placementsLeft > 0;

  return (
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
      {isCalibrating ? (
        <span className="font-semibold uppercase tracking-[0.22em] text-cyan-300">
          Placement {5 - placementsLeft}/5
        </span>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
