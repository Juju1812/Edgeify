"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Footer } from "@/components/Footer";
import {
  currentSeason,
  levelFromXp,
  rewardAtLevel,
  xpForLevel
} from "@/lib/season";
import { weeklyChallenges } from "@/lib/challenges";
import { useUser } from "@/lib/user-context";

export default function SeasonPage() {
  const { user, status } = useUser();
  const season = currentSeason();
  const level = levelFromXp(user.seasonXp);
  const xpThis = user.seasonXp - xpForLevel(level);
  const xpNext = xpForLevel(level + 1) - xpForLevel(level);
  const pct = Math.min(100, (xpThis / xpNext) * 100);
  const daysLeft = Math.max(0, Math.ceil((season.endsAt - Date.now()) / 86400000));

  // Show levels around current with ±10 visible
  const start = Math.max(1, level - 5);
  const end = level + 25;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 transition hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-xs">Season Pass</p>
          <h1 className="heading-card mt-2 text-3xl">Season {season.number}</h1>
          <p className="mt-1 text-sm text-white/50">
            Ends in {daysLeft} day{daysLeft === 1 ? "" : "s"} · ELO will soft-reset
          </p>
        </div>
        <div className="glass rounded-xl px-5 py-3 text-right">
          <p className="label-xs text-white/40">Inventory</p>
          <p className="mt-1 text-base font-semibold text-mog-pink">
            ⚡ {user.edgeBoosts} Edge Boost{user.edgeBoosts === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {status === "guest" ? (
        <div className="glass mt-8 rounded-2xl px-8 py-12 text-center">
          <p className="label-xs">Locked</p>
          <h2 className="heading-card mt-2 text-2xl">Sign in to track season progress</h2>
        </div>
      ) : (
        <>
          {/* Current level + XP bar */}
          <div className="glass mt-8 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="label-xs">Current Level</p>
                <p className="mt-1 text-5xl font-bold tracking-tight text-white">
                  {level}
                </p>
              </div>
              <div className="text-right">
                <p className="label-xs">Total XP</p>
                <p className="mt-1 font-mono text-2xl text-cyan-300">
                  {user.seasonXp.toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/40">
                  +{xpForLevel(level + 1) - user.seasonXp} to L{level + 1}
                </p>
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="h-full bg-gradient-to-r from-mog-violet to-mog-pink"
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs uppercase tracking-[0.18em]">
              <div className="glass rounded-md px-2 py-2">
                <p className="text-white/40">Daily streak</p>
                <p className="text-white">🔥 {user.dailyStreak}</p>
              </div>
              <div className="glass rounded-md px-2 py-2">
                <p className="text-white/40">Win streak</p>
                <p className="text-white">⚔️ {user.streak}</p>
              </div>
              <div className="glass rounded-md px-2 py-2">
                <p className="text-white/40">Boosts</p>
                <p className="text-mog-pink">⚡ {user.edgeBoosts}</p>
              </div>
            </div>
          </div>

          {/* Levels rail */}
          <div className="mt-8">
            <h2 className="label-xs mb-3">Rewards Track</h2>
            <div className="flex gap-2 overflow-x-auto pb-3">
              {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(
                (l) => {
                  const reward = rewardAtLevel(l);
                  const reached = l <= level;
                  const isCurrent = l === level;
                  return (
                    <div
                      key={l}
                      className={
                        "glass relative flex min-w-[88px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-center text-[10px] uppercase tracking-[0.18em] " +
                        (reached
                          ? "border-emerald-400/40 bg-emerald-500/5 text-emerald-200"
                          : isCurrent
                            ? "border-mog-pink/60 bg-mog-pink/5 text-white"
                            : "text-white/40")
                      }
                    >
                      <p>L{l}</p>
                      {reward ? (
                        <RewardChip reward={reward} reached={reached} />
                      ) : (
                        <span className="text-[18px] opacity-30">•</span>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Weekly challenges */}
          <div className="mt-8">
            <h2 className="label-xs mb-3">Weekly Challenges · Rotate Mondays UTC</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {weeklyChallenges().map((c) => {
                const p = c.progress(user);
                const done = c.done(user);
                return (
                  <div
                    key={c.id}
                    className={
                      "glass rounded-xl p-4 transition " +
                      (done ? "border-emerald-400/40 bg-emerald-500/5" : "")
                    }
                  >
                    <div className="flex items-start justify-between">
                      <div className="text-2xl">{c.emoji}</div>
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] " +
                          (done
                            ? "bg-emerald-500/20 text-emerald-200"
                            : "bg-mog-pink/10 text-mog-pink")
                        }
                      >
                        +{c.reward} XP
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-white">
                      {c.title}
                    </p>
                    <p className="mt-1 text-xs text-white/50">{c.description}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-mog-violet to-mog-pink transition-all"
                        style={{ width: `${p * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* What is Edge Boost */}
          <div className="glass mt-8 rounded-2xl p-6">
            <h2 className="label-xs mb-2 text-mog-pink">⚡ Edge Boost</h2>
            <p className="text-sm text-white/70">
              Activate a boost from the Arena lobby before queueing. It adds{" "}
              <span className="font-semibold text-mog-pink">+10% to your score</span>{" "}
              for every round of your next match. One-shot consumable — earn more
              by leveling up.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-white/50">
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                Earned: every 3 levels
              </span>
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                Consumed on activation
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/arena"
              className="rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30"
            >
              Earn XP in Arena →
            </Link>
            <Link
              href="/profile"
              className="rounded-lg border border-white/10 bg-white/[0.02] px-6 py-3 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
            >
              Profile
            </Link>
          </div>
        </>
      )}

      <Footer />
    </main>
  );
}

function RewardChip({
  reward,
  reached
}: {
  reward: ReturnType<typeof rewardAtLevel>;
  reached: boolean;
}) {
  if (!reward) return null;
  if (reward.kind === "edgeBoost") {
    return (
      <span className="text-[18px]" title="Edge Boost">
        ⚡
      </span>
    );
  }
  if (reward.kind === "title") {
    return (
      <span className="block px-1 text-[9px] uppercase tracking-[0.18em] text-white/80">
        “{reward.title}”
      </span>
    );
  }
  return (
    <span
      className="text-[18px]"
      style={{ color: reached ? reward.color : "currentColor" }}
      title={`${reward.frame} frame`}
    >
      ◆
    </span>
  );
}
