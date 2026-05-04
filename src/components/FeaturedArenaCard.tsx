"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/user-context";
import { rankFromElo } from "@/lib/rank";
import { ArrowRightIcon, SwordsIcon } from "./icons";

type Stats = { onlineCount: number; inQueueCount: number };

/**
 * Hero tile for 1V1 Arena — the primary call-to-action. Larger and
 * visually denser than the secondary tiles, with live queue stats
 * baked in so the surface tells the player whether matches are
 * actually available right now.
 */
export function FeaturedArenaCard({
  onSignIn
}: {
  onSignIn: () => void;
}) {
  const { user, status, ready, playAsGuest } = useUser();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        /* */
      }
    };
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const canPlay = ready && status !== "guest" && status !== "auth-no-scan";
  const rank = ready && user.username ? rankFromElo(user.elo) : null;

  // Click target — guest fast-path for anonymous users (instant play
  // with a random callsign), scan prompt for unscanned users, /arena
  // for everyone else.
  const cta = !ready
    ? null
    : status === "guest"
      ? {
          label: "Play instantly",
          onClick: playAsGuest,
          kind: "guest" as const
        }
      : status === "auth-no-scan"
        ? { label: "Scan first", href: "/lab" as const, kind: "scan" as const }
        : { label: "Find Match", href: "/arena" as const, kind: "play" as const };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="glass-featured glass-featured-hover group relative overflow-hidden rounded-3xl"
    >
      {/* Click-through link covers the surface — buttons inside override it. */}
      {cta && cta.kind !== "guest" && (
        <Link
          href={cta.href!}
          aria-label={cta.label}
          className="absolute inset-0 z-10"
        />
      )}

      {/* Diagonal accent stripe — small bit of motion in the corner */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(34,233,255,0.5) 0%, transparent 70%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(255,93,143,0.5) 0%, transparent 70%)"
        }}
      />

      <div className="pointer-events-none relative z-20 flex flex-col gap-7 p-7 sm:flex-row sm:items-center sm:gap-10 sm:p-10">
        {/* Left half: title + status */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2">
            <span className="label-xs text-edge-cyan">Primary · Ranked</span>
          </div>
          <h2 className="heading-display text-4xl sm:text-5xl">
            1v1 <span className="brand-edge">Face-off</span>
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-white/55">
            Match against a live opponent in your ELO band. Best-of-3 rounds,
            geometric AI scoring, ELO on the line.
          </p>

          {/* Live stats line */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.22em] text-white/40">
            <span className="inline-flex items-center gap-2">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inset-0 animate-pulse-dot rounded-full bg-emerald-400/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-white/65">
                {stats ? `${stats.onlineCount} online` : "Connecting"}
              </span>
            </span>
            {stats && stats.inQueueCount > 0 && (
              <span className="text-edge-coral">
                {stats.inQueueCount} in queue
              </span>
            )}
            <span className="hidden sm:inline">No bots · Real opponents</span>
          </div>
        </div>

        {/* Right half: CTA + rank rail */}
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          {/* Identity micro-rail */}
          {ready && rank && status !== "guest" && status !== "auth-no-scan" && (
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/45">
              <span style={{ color: rank.color }}>{rank.emoji}</span>
              <span className="text-white/70">{rank.label}</span>
              <span className="text-white/20">·</span>
              <span className="stat-mono text-edge-cyan">{user.elo} ELO</span>
            </div>
          )}

          {!cta ? (
            <div className="h-14 w-44 animate-pulse rounded-xl bg-white/[0.05]" />
          ) : cta.kind === "guest" ? (
            <button
              onClick={cta.onClick}
              className="group/btn pointer-events-auto relative z-30 inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-edge-cyan/60 bg-edge-cyan/15 px-7 py-4 text-sm font-bold uppercase tracking-[0.22em] text-white shadow-glow transition hover:border-edge-cyan hover:bg-edge-cyan/25"
            >
              <SwordsIcon className="h-5 w-5" />
              <span>{cta.label}</span>
              <ArrowRightIcon className="h-4 w-4 transition group-hover/btn:translate-x-0.5" />
            </button>
          ) : (
            <span className="relative z-30 inline-flex items-center justify-center gap-2 rounded-xl border border-edge-cyan/60 bg-edge-cyan/15 px-7 py-4 text-sm font-bold uppercase tracking-[0.22em] text-white shadow-glow transition group-hover:border-edge-cyan group-hover:bg-edge-cyan/25">
              <SwordsIcon className="h-5 w-5" />
              <span>{cta.label}</span>
              <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          )}

          {canPlay && user.placementsLeft === 0 && (
            <span className="text-[10px] uppercase tracking-[0.28em] text-white/30">
              ELO band ±150 · Bo3
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
