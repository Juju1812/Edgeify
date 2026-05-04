"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/user-context";
import type { MatchRecord } from "@/lib/types";

/**
 * Recent-match ticker pulled from the user's own match history. We
 * don't have a global cross-user feed yet (would need a Redis sub
 * pattern), so this surfaces YOUR last 5 matches as a "What's been
 * happening" rail. Reads as fresh and keeps the home page alive.
 */
export function ActivityTicker() {
  const { user, ready, status } = useUser();
  const [tick, setTick] = useState(0);

  // Re-tick every 4s to advance the visible match.
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 4000);
    return () => window.clearInterval(t);
  }, []);

  if (!ready || status === "guest") return null;
  const recent = user.matchHistory.slice(0, 5);
  if (recent.length === 0) return null;

  const visible = recent[tick % recent.length];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <span className="label-xs text-edge-cyan shrink-0">Recent</span>
        <AnimatePresence mode="wait">
          <motion.div
            key={visible.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="flex flex-1 items-center gap-2 overflow-hidden text-xs"
          >
            <Verdict m={visible} />
            <span className="truncate text-white/60">
              vs <span className="text-white/85">{visible.opponentName}</span>
            </span>
            <span className="text-white/30">·</span>
            <span className="stat-mono text-white/70">
              {visible.myScore}–{visible.oppScore}
            </span>
            <span
              className="stat-mono"
              style={{
                color: visible.eloDelta >= 0 ? "#22e9ff" : "#ff5d8f"
              }}
            >
              {visible.eloDelta >= 0 ? "+" : ""}
              {visible.eloDelta}
            </span>
            <span className="ml-auto hidden text-[10px] uppercase tracking-[0.22em] text-white/30 sm:inline">
              {timeAgo(visible.playedAt)}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Verdict({ m }: { m: MatchRecord }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em]"
      style={{
        background: m.won ? "rgba(34, 197, 94, 0.15)" : "rgba(244, 63, 94, 0.15)",
        color: m.won ? "#34d399" : "#f87171"
      }}
    >
      {m.won ? "W" : "L"}
    </span>
  );
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
