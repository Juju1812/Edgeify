"use client";

import Link from "next/link";
import { useState } from "react";
import { Footer } from "@/components/Footer";
import { rankFromElo } from "@/lib/rank";
import { useUser } from "@/lib/user-context";

export default function ProfilePage() {
  const { user, status, ready, update, deleteAccount } = useUser();
  const [confirmDelete, setConfirmDelete] = useState(false);

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
              <div
                key={m.id}
                className="grid grid-cols-[5rem_1fr_4rem_5rem] gap-3 border-b border-white/[0.02] px-5 py-3 text-sm last:border-b-0"
              >
                <span
                  className="text-xs font-bold uppercase tracking-[0.22em]"
                  style={{ color: m.won ? "#34d399" : "#f43f5e" }}
                >
                  {m.won ? "WIN" : "LOSS"}
                </span>
                <span className="truncate uppercase tracking-[0.18em] text-white/80">
                  vs {m.opponentName}
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
              </div>
            ))}
          </div>
        )}
      </div>

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
