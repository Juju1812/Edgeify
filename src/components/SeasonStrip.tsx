"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { currentSeason, levelFromXp, xpForLevel } from "@/lib/season";
import { useUser } from "@/lib/user-context";

export function SeasonStrip() {
  const { user, status } = useUser();
  const season = currentSeason();
  const level = levelFromXp(user.seasonXp);
  const xpThis = user.seasonXp - xpForLevel(level);
  const xpNext = xpForLevel(level + 1) - xpForLevel(level);
  const pct = Math.min(100, (xpThis / xpNext) * 100);
  const daysLeft = Math.max(0, Math.ceil((season.endsAt - Date.now()) / 86400000));

  return (
    <Link
      href="/season"
      className="glass glass-hover flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
          style={{
            background:
              "linear-gradient(135deg, rgba(34,233,255,0.55), rgba(255,93,143,0.55))"
          }}
        >
          S{season.number}
        </div>
        <div>
          <p className="label-xs text-edge-cyan">Season {season.number} · Level {level}</p>
          <p className="mt-1 text-xs text-white/50">
            {status === "guest"
              ? "Sign in to track season XP"
              : `${user.edgeBoosts} ⚡ Edge Boost${user.edgeBoosts === 1 ? "" : "s"} · ${daysLeft}d left · 🔥 ${user.dailyStreak}-day streak`}
          </p>
        </div>
      </div>
      <div className="flex flex-1 items-center gap-3 sm:max-w-md">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="h-full"
            style={{
              background: "linear-gradient(90deg, #22e9ff 0%, #ff5d8f 100%)"
            }}
          />
        </div>
        <span className="stat-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
          {xpThis}/{xpNext}
        </span>
      </div>
    </Link>
  );
}
