"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Footer } from "@/components/Footer";
import { rankFromElo } from "@/lib/rank";
import { SEED_USERS } from "@/lib/seed-users";
import { useUser } from "@/lib/user-context";
import { dayOfYearUtc } from "@/lib/season";

/**
 * /daily — a deterministic-seeded "boss of the day" everyone faces. The
 * pick is shared across all players (same UTC day → same opponent), so
 * water-cooler talk works ("did you beat today's boss?"). Replays
 * locally-only; doesn't move ELO. Designed as a daily hook to bring
 * players back.
 */
export default function DailyFaceOffPage() {
  const { user, status } = useUser();
  const day = dayOfYearUtc();

  const boss = useMemo(() => {
    // Seeded pick: walk SEED_USERS sorted by ELO and pick a slot ~70% up
    // the ladder, varied by the day-of-year. Same day → same boss.
    const sorted = [...SEED_USERS].sort((a, b) => b.elo - a.elo);
    const idx = (day * 73 + 11) % sorted.length;
    // Bias toward the upper portion (top 30%).
    const targetIdx = Math.floor(sorted.length * 0.3 * (idx / sorted.length));
    return sorted[Math.max(0, Math.min(sorted.length - 1, targetIdx))];
  }, [day]);

  const rank = rankFromElo(boss.elo);
  const myRank = user.username ? rankFromElo(user.elo) : null;
  const dayLabel = new Date(day * 86400000).toUTCString().slice(0, 16);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6">
        <p className="label-xs text-edge-coral">Daily Boss</p>
        <h1 className="heading-display mt-2 text-5xl">
          Today&apos;s <span className="brand-edge">face-off</span>
        </h1>
        <p className="mt-3 text-sm text-white/55">
          Same opponent for everyone, every UTC day. Beat them and brag.
          Resets at midnight UTC. {dayLabel}.
        </p>
      </div>

      <div className="glass-featured mt-8 grid gap-6 rounded-3xl p-8 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        {myRank && status === "ranked" ? (
          <PlayerSide
            name={user.username!}
            elo={user.elo}
            rankLabel={myRank.label}
            rankColor={myRank.color}
            rankEmoji={myRank.emoji}
            face={user.faceDataUrl}
            side="left"
          />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
            <p className="label-xs">You</p>
            <p className="mt-2 text-sm text-white/60">
              Sign in & calibrate to challenge today&apos;s boss.
            </p>
          </div>
        )}

        <div className="text-center text-2xl font-bold tracking-[0.18em] text-edge-cyan sm:text-3xl">
          VS
        </div>

        <PlayerSide
          name={boss.username}
          elo={boss.elo}
          rankLabel={rank.label}
          rankColor={rank.color}
          rankEmoji={rank.emoji}
          side="right"
        />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/arena"
          className="rounded-xl border border-edge-cyan/50 bg-edge-cyan/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-cyan hover:bg-edge-cyan/25"
        >
          Enter Arena →
        </Link>
        <Link
          href="/lab"
          className="rounded-xl border border-white/10 bg-white/[0.02] px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
        >
          Calibrate first
        </Link>
      </div>

      <p className="mt-10 text-center text-[10px] uppercase tracking-[0.32em] text-white/30">
        The boss rotates every UTC midnight.
      </p>

      <Footer />
    </main>
  );
}

function PlayerSide({
  name,
  elo,
  rankLabel,
  rankColor,
  rankEmoji,
  face,
  side
}: {
  name: string;
  elo: number;
  rankLabel: string;
  rankColor: string;
  rankEmoji: string;
  face?: string | null;
  side: "left" | "right";
}) {
  return (
    <div className={"glass overflow-hidden rounded-2xl"}>
      <div className="aspect-[4/3] w-full bg-black/40">
        {face ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={face}
            alt=""
            className="h-full w-full -scale-x-100 object-cover"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center text-6xl"
            style={{ color: rankColor }}
          >
            {rankEmoji}
          </div>
        )}
      </div>
      <div className="border-t border-white/[0.04] px-4 py-3 text-center">
        <p className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-white">
          {name}
        </p>
        <p
          className="mt-1 text-[10px] uppercase tracking-[0.32em]"
          style={{ color: rankColor }}
        >
          {rankEmoji} {rankLabel}
        </p>
        <p className="stat-mono mt-1 text-edge-cyan">{elo} ELO</p>
        <p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-white/40">
          {side === "left" ? "You" : "Today's Boss"}
        </p>
      </div>
    </div>
  );
}
