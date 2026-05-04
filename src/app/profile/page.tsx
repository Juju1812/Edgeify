"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Footer } from "@/components/Footer";
import { OwnerBadge } from "@/components/OwnerBadge";
import { rankFromElo, RANKS } from "@/lib/rank";
import { flagFor } from "@/lib/flag";
import { useUser } from "@/lib/user-context";
import { ACHIEVEMENTS, unlockedAchievements } from "@/lib/achievements";
import type { MatchRecord } from "@/lib/types";

export default function ProfilePage() {
  const { user, status, ready, update, deleteAccount } = useUser();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [replay, setReplay] = useState<MatchRecord | null>(null);

  if (!ready)
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-6 pt-10">
        <div className="glass h-64 animate-pulse rounded-2xl" />
      </main>
    );

  if (status === "guest")
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
        <Link
          href="/"
          className="label-xs inline-flex items-center gap-2 text-white/40 transition hover:text-white"
        >
          ← Back to Lobby
        </Link>
        <div className="glass mt-8 rounded-2xl px-8 py-12 text-center">
          <h2 className="heading-card text-2xl">No profile yet</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/50">
            Sign in to start a profile.
          </p>
        </div>
      </main>
    );

  const rank = rankFromElo(user.elo);
  const totalGames = user.wins + user.losses;
  const winRate = totalGames > 0 ? Math.round((user.wins / totalGames) * 100) : 0;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 transition hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6 grid gap-6 md:grid-cols-[260px_1fr]">
        <div className="glass overflow-hidden rounded-2xl">
          <div className="aspect-square w-full bg-black/40">
            {user.faceDataUrl && !user.hideFromBoard ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.faceDataUrl}
                alt=""
                className="h-full w-full -scale-x-100 object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl">
                {rank.emoji}
              </div>
            )}
          </div>
          <div className="border-t border-white/[0.04] px-4 py-4 text-center">
            <p className="text-base font-semibold uppercase tracking-[0.22em] text-white">
              {user.username}
              <OwnerBadge name={user.username} size="sm" />
              {user.countryCode && (
                <span className="ml-2 text-base" title={user.countryCode}>
                  {flagFor(user.countryCode)}
                </span>
              )}
            </p>
            <p
              className="mt-1 text-[11px] uppercase tracking-[0.32em]"
              style={{ color: rank.color }}
            >
              {user.placementsLeft > 0
                ? `Placement ${5 - user.placementsLeft}/5`
                : `${rank.emoji} ${rank.label}`}
            </p>
            <p className="mt-2 font-mono text-cyan-300">{user.elo} ELO</p>
          </div>
        </div>

        <div className="space-y-4">
          <Stat label="Wins" value={user.wins} />
          <Stat label="Losses" value={user.losses} />
          <Stat label="Win rate" value={`${winRate}%`} />
          <Stat label="Win streak" value={user.streak} />
          <Stat label="Peak ELO" value={user.peakElo} />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="label-xs mb-3">
          Achievements ({unlockedAchievements(user).length}/{ACHIEVEMENTS.length})
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = a.check(user);
            return (
              <div
                key={a.id}
                title={`${a.name}\n${a.description}`}
                className={
                  "glass flex aspect-square flex-col items-center justify-center rounded-xl p-2 text-center transition " +
                  (unlocked ? "" : "opacity-25 grayscale")
                }
              >
                <span className="text-2xl">{a.emoji}</span>
                <p className="mt-1 truncate text-[9px] uppercase tracking-[0.2em] text-white/70">
                  {a.name}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="label-xs mb-3">Match History</h2>
        {user.matchHistory.length === 0 ? (
          <div className="glass rounded-2xl px-6 py-10 text-center text-sm text-white/40">
            No matches yet. Head to{" "}
            <Link href="/arena" className="text-mog-violet hover:underline">
              the Arena
            </Link>{" "}
            to start.
          </div>
        ) : (
          <div className="glass overflow-hidden rounded-2xl">
            {user.matchHistory.map((m) => (
              <button
                key={m.id}
                onClick={() => setReplay(m)}
                disabled={!m.rounds || m.rounds.length === 0}
                className="grid w-full grid-cols-[5rem_1fr_4rem_5rem] gap-3 border-b border-white/[0.02] px-5 py-3 text-left text-sm transition last:border-b-0 enabled:hover:bg-white/[0.02] disabled:cursor-default"
              >
                <span
                  className="text-xs font-bold uppercase tracking-[0.22em]"
                  style={{ color: m.won ? "#34d399" : "#f43f5e" }}
                >
                  {m.won ? "WIN" : "LOSS"}
                </span>
                <span className="truncate uppercase tracking-[0.18em] text-white/80">
                  vs {m.opponentName}
                  {m.practice && (
                    <span className="ml-2 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[8px] tracking-[0.22em] text-cyan-300">
                      PRACTICE
                    </span>
                  )}
                  {m.mode && m.mode !== "bo3" && (
                    <span className="ml-2 rounded-full bg-mog-violet/10 px-2 py-0.5 text-[8px] tracking-[0.22em] text-mog-violet">
                      {m.mode.toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="text-right font-mono text-xs text-white/60">
                  {m.myScore}–{m.oppScore}
                </span>
                <span
                  className="text-right font-mono text-xs"
                  style={{ color: m.eloDelta >= 0 ? "#22d3ee" : "#f43f5e" }}
                >
                  {m.eloDelta >= 0 ? "+" : ""}
                  {m.eloDelta}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ELO progression chart */}
      {user.matchHistory.length >= 2 && (
        <EloChart history={user.matchHistory} currentElo={user.elo} />
      )}

      {/* H2H rivals — top 3 most-played opponents */}
      {user.matchHistory.length >= 3 && <RivalsCard history={user.matchHistory} />}

      {/* Replay modal */}
      <ReplayModal match={replay} onClose={() => setReplay(null)} />

      <div className="mt-10">
        <h2 className="label-xs mb-3">Privacy</h2>
        <div className="glass rounded-2xl p-5 text-sm text-white/70">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={user.hideFromBoard}
              onChange={(e) => update({ hideFromBoard: e.target.checked })}
              className="mt-1 h-4 w-4 accent-mog-violet"
            />
            <span>
              <span className="block text-white">Hide my face from the leaderboard</span>
              <span className="text-xs text-white/50">
                Stats still show; the photo is replaced with your rank emblem.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* Blocked users */}
      <div className="mt-10">
        <h2 className="label-xs mb-3">Block List</h2>
        <div className="glass rounded-2xl p-5">
          {user.blockedUsers.length === 0 ? (
            <p className="text-xs text-white/40">
              You haven&apos;t blocked anyone. Block someone from a match to
              never be matched with them again.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {user.blockedUsers.map((u) => (
                <li
                  key={u}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/70"
                >
                  {u}
                  <button
                    onClick={() =>
                      update((prev) => ({
                        blockedUsers: prev.blockedUsers.filter((x) => x !== u)
                      }))
                    }
                    className="text-white/40 hover:text-white"
                    title={`Unblock ${u}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="label-xs mb-3 text-rose-300">Danger zone</h2>
        <div className="glass rounded-2xl p-5">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-xs uppercase tracking-[0.22em] text-rose-200 transition hover:border-rose-500/50 hover:bg-rose-500/10"
            >
              Delete my account & all face data
            </button>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-white">
                This wipes your callsign, scan, EdgeScore, and match history from
                this device. Cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteAccount}
                  className="flex-1 rounded-lg border border-rose-500/50 bg-rose-500/20 px-4 py-2.5 text-xs uppercase tracking-[0.22em] text-rose-100 transition hover:bg-rose-500/30"
                >
                  Yes, delete everything
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  );
}

function Stat({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="glass flex items-center justify-between rounded-xl px-5 py-3">
      <span className="text-[11px] uppercase tracking-[0.32em] text-white/40">
        {label}
      </span>
      <span className="font-mono text-base text-white">{value}</span>
    </div>
  );
}

/**
 * Compact line chart of ELO over the last N matches. Pure SVG, no
 * external charting dep. Tier band colors shaded behind the line.
 */
function EloChart({
  history,
  currentElo
}: {
  history: MatchRecord[];
  currentElo: number;
}) {
  // Reconstruct ELO over time: start with currentElo, walk back applying
  // -delta to recover the pre-match value at each step.
  const ranked = [...history].filter((m) => !m.practice).slice(0, 40);
  if (ranked.length < 2) return null;
  const series: number[] = [currentElo];
  let cur = currentElo;
  for (const m of ranked) {
    cur -= m.eloDelta;
    series.unshift(cur);
  }
  const W = 800;
  const H = 200;
  const PAD = 24;
  const minE = Math.max(0, Math.min(...series) - 50);
  const maxE = Math.max(...series) + 50;
  const xStep = (W - 2 * PAD) / Math.max(1, series.length - 1);
  const y = (e: number) => H - PAD - ((e - minE) / (maxE - minE)) * (H - 2 * PAD);

  const linePath = series
    .map((e, i) => `${i === 0 ? "M" : "L"} ${PAD + i * xStep} ${y(e)}`)
    .join(" ");
  const areaPath = `${linePath} L ${PAD + (series.length - 1) * xStep} ${H - PAD} L ${PAD} ${H - PAD} Z`;

  return (
    <div className="mt-10">
      <h2 className="label-xs mb-3">ELO Progression</h2>
      <div className="glass rounded-2xl p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          preserveAspectRatio="none"
        >
          {/* Tier band shading */}
          {RANKS.map((r, i) => {
            const next = RANKS[i + 1];
            const top = next ? Math.min(maxE, next.floor) : maxE;
            const bot = Math.max(minE, r.floor);
            if (bot >= top) return null;
            return (
              <rect
                key={r.tier}
                x={PAD}
                y={y(top)}
                width={W - 2 * PAD}
                height={y(bot) - y(top)}
                fill={r.color}
                opacity={0.06}
              />
            );
          })}
          <path d={areaPath} fill="url(#eloFill)" opacity={0.45} />
          <path d={linePath} stroke="#22e9ff" strokeWidth={2} fill="none" />
          {series.map((e, i) => (
            <circle
              key={i}
              cx={PAD + i * xStep}
              cy={y(e)}
              r={i === series.length - 1 ? 5 : 2}
              fill={i === series.length - 1 ? "#ff5d8f" : "#22e9ff"}
            />
          ))}
          <defs>
            <linearGradient id="eloFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22e9ff" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#22e9ff" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-white/40">
          <span>{ranked.length} matches</span>
          <span>peak {Math.max(...series)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Rivals card — surfaces your top 3 most-played opponents with the
 * head-to-head record. A small social hook that gives the long match
 * history a narrative feel.
 */
function RivalsCard({ history }: { history: MatchRecord[] }) {
  const tally = new Map<
    string,
    { name: string; wins: number; losses: number; lastPlayed: number }
  >();
  for (const m of history) {
    const t = tally.get(m.opponentName) || {
      name: m.opponentName,
      wins: 0,
      losses: 0,
      lastPlayed: 0
    };
    if (m.won) t.wins += 1;
    else t.losses += 1;
    t.lastPlayed = Math.max(t.lastPlayed, m.playedAt);
    tally.set(m.opponentName, t);
  }
  const ranked = [...tally.values()]
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses))
    .slice(0, 3);
  if (ranked.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="label-xs mb-3">Top Rivals</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {ranked.map((r) => {
          const total = r.wins + r.losses;
          const wr = total > 0 ? Math.round((r.wins / total) * 100) : 0;
          return (
            <div key={r.name} className="glass rounded-2xl p-5">
              <p className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-white">
                {r.name}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.32em] text-white/40">
                {total} match{total === 1 ? "" : "es"}
              </p>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="stat-mono text-2xl text-emerald-300">
                  {r.wins}
                </span>
                <span className="text-white/30">·</span>
                <span className="stat-mono text-2xl text-rose-300">
                  {r.losses}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rose-500/20">
                <div
                  className="h-full bg-emerald-500/70"
                  style={{ width: `${wr}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/40">
                {wr}% W
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReplayModal({
  match,
  onClose
}: {
  match: MatchRecord | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {match && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
            className="glass relative w-full max-w-md p-6"
          >
            <p className="label-xs">Match Replay</p>
            <h2 className="heading-card mt-2 text-2xl">
              vs {match.opponentName}
            </h2>
            <p className="mt-1 text-xs text-white/50">
              {new Date(match.playedAt).toLocaleString()}
              {match.mode && match.mode !== "bo3" ? ` · ${match.mode.toUpperCase()}` : ""}
            </p>

            <div className="mt-4 flex items-center justify-between">
              <span
                className="text-2xl font-bold tracking-wider"
                style={{ color: match.won ? "#34d399" : "#f43f5e" }}
              >
                {match.myScore} – {match.oppScore}
              </span>
              <span
                className="font-mono text-lg"
                style={{ color: match.eloDelta >= 0 ? "#22d3ee" : "#f43f5e" }}
              >
                {match.eloDelta >= 0 ? "+" : ""}
                {match.eloDelta} ELO
              </span>
            </div>

            {match.rounds && match.rounds.length > 0 && (
              <div className="mt-5 space-y-3">
                {match.rounds.map((r, i) => {
                  const won = r.me > r.opp;
                  const tied = r.me === r.opp;
                  const total = r.me + r.opp || 1;
                  const myPct = (r.me / total) * 100;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/60">
                        <span>
                          R{i + 1} · {r.criterion}
                        </span>
                        <span
                          style={{
                            color: tied ? "#fff" : won ? "#34d399" : "#f43f5e"
                          }}
                        >
                          {tied ? "TIED" : won ? "WON" : "LOST"}
                        </span>
                      </div>
                      <div className="flex h-6 overflow-hidden rounded-md">
                        <div
                          className="flex items-center justify-end bg-emerald-500/30 pr-2 text-[10px] font-bold text-emerald-100"
                          style={{ width: `${myPct}%` }}
                        >
                          {r.me}
                        </div>
                        <div
                          className="flex items-center justify-start bg-rose-500/30 pl-2 text-[10px] font-bold text-rose-100"
                          style={{ width: `${100 - myPct}%` }}
                        >
                          {r.opp}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={onClose}
              className="mt-6 w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
