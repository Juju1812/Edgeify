"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useUser } from "@/lib/user-context";
import { rankFromElo } from "@/lib/rank";
import { OwnerBadge } from "./OwnerBadge";

export function HeroBadge({ onSignIn }: { onSignIn: () => void }) {
  const { user, status, ready, playAsGuest } = useUser();
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
    <div className="flex flex-col items-start gap-6">
      {/* Eyebrow + season tag */}
      <div className="flex items-center gap-3">
        <span className="label-xs text-edge-cyan">Season 1 · Live</span>
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.32em] text-white/45">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-pulse-dot rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          {stats
            ? `${formatCount(stats.onlineCount)} online${
                stats.inQueueCount > 0 ? ` · ${stats.inQueueCount} queued` : ""
              }`
            : "Live"}
        </span>
      </div>

      {/* Big headline — sans-serif display, breaks the monospace-everywhere
          look entirely. */}
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="heading-display text-5xl sm:text-6xl lg:text-7xl"
      >
        Sharper than the <span className="brand-edge">edge</span>.
        <br />
        Higher on the board.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-xl text-base leading-relaxed text-white/55"
      >
        Live 1v1 face-offs, scored by AI on geometric facial measurements.
        Climb the seasonal ranked ladder against real opponents — no bots,
        no filters.
      </motion.p>

      {/* Identity row — username + rank, always shown, with sign-in CTA
          when guest. */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.18 }}
        className="flex flex-wrap items-center gap-3"
      >
        {!ready ? (
          <div className="h-12 w-72 animate-pulse rounded-2xl bg-white/[0.04]" />
        ) : status === "guest" ? (
          <>
            {/* Primary CTA: instant guest play (no friction). */}
            <button
              onClick={playAsGuest}
              className="group relative overflow-hidden rounded-xl border border-edge-cyan/60 bg-edge-cyan/15 px-6 py-3.5 text-[12px] font-bold uppercase tracking-[0.22em] text-white shadow-glow transition hover:border-edge-cyan hover:bg-edge-cyan/25"
            >
              <span className="relative z-10">Play instantly →</span>
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
            </button>
            {/* Secondary: claim a real account so progress saves across
                devices. Subdued styling so the guest path stays primary. */}
            <button
              onClick={onSignIn}
              className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-white/65 transition hover:border-edge-cyan/30 hover:bg-edge-cyan/[0.04] hover:text-edge-cyan"
            >
              Sign in / Sign up
            </button>
            <p className="basis-full text-[10px] uppercase tracking-[0.32em] text-white/30">
              No account required · saves to this device · claim anytime
            </p>
          </>
        ) : status === "auth-no-scan" ? (
          <Link
            href="/lab"
            className="rounded-xl border border-edge-cyan/40 bg-edge-cyan/10 px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:border-edge-cyan hover:bg-edge-cyan/20 hover:text-white"
          >
            {user.username} · scan to begin →
          </Link>
        ) : (
          <RankPill
            username={user.username!}
            elo={user.elo}
            placementsLeft={user.placementsLeft}
          />
        )}
      </motion.div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
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
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 backdrop-blur">
      <span className="text-[12px] font-semibold uppercase tracking-[0.22em] text-white">
        {username}
        <OwnerBadge name={username} size="xs" />
      </span>
      <span className="h-3 w-px bg-white/15" />
      {isCalibrating ? (
        <span className="text-[12px] font-semibold uppercase tracking-[0.22em] text-edge-cyan">
          Placement {5 - placementsLeft}/5
        </span>
      ) : (
        <>
          <span
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: rank.color }}
          >
            <span aria-hidden>{rank.emoji}</span> {rank.label}
          </span>
          <span className="h-3 w-px bg-white/15" />
          <span className="stat-mono text-[12px] text-edge-cyan">{elo} ELO</span>
        </>
      )}
    </div>
  );
}
