"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Footer } from "@/components/Footer";
import { rankFromElo } from "@/lib/rank";
import type { SeedUser } from "@/lib/seed-users";
import { useUser } from "@/lib/user-context";

export default function LeaderboardPage() {
  const { user, status } = useUser();
  const [query, setQuery] = useState("");

  // No more seed-user padding — the leaderboard now reflects real
  // EdgeIfy users only. Until we wire up server-side ranking storage,
  // that means just the current device's user (when ranked + visible).
  // Bots are kept out of the public board on purpose.
  const all = useMemo<SeedUser[]>(() => {
    const list: SeedUser[] = [];
    if (status === "ranked" && user.username && !user.hideFromBoard) {
      list.push({
        id: "me",
        username: user.username,
        countryCode: "??",
        elo: user.elo,
        wins: user.wins,
        losses: user.losses,
        edgeScore: user.edgeScore?.composite ?? 50
      });
    }
    return list.sort((a, b) => b.elo - a.elo);
  }, [user, status]);

  const filtered = useMemo(() => {
    return all.filter((u) => {
      if (query && !u.username.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });
  }, [all, query]);

  const myIndex = all.findIndex((u) => u.id === "me");
  const myRank = myIndex >= 0 ? myIndex + 1 : null;

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
          <p className="label-xs">Season 1</p>
          <h1 className="heading-card mt-2 text-3xl">Global Rank</h1>
          <p className="mt-1 text-sm text-white/50">
            Top {filtered.length} Adams
          </p>
        </div>
        {myRank !== null && (
          <div className="glass rounded-xl px-4 py-3 text-right">
            <p className="label-xs text-white/40">Your position</p>
            <p className="text-xl font-bold text-cyan-300">#{myRank}</p>
          </div>
        )}
      </div>

      {all.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search username…"
            className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm uppercase tracking-[0.18em] text-white placeholder:text-white/30 outline-none focus:border-mog-violet"
          />
        </div>
      )}

      {all.length === 0 ? (
        <div className="glass mt-6 rounded-2xl px-6 py-16 text-center">
          <div className="text-5xl">👑</div>
          <h2 className="heading-card mt-4 text-2xl">No ranked players yet</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/50">
            Be the first to climb the EdgeIfy leaderboard. Calibrate in The Lab,
            finish your 5 placement matches, and you&apos;ll appear here.
          </p>
          <Link
            href="/lab"
            className="mt-6 inline-block rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30"
          >
            Open The Lab →
          </Link>
        </div>
      ) : (
        <div className="glass mt-6 overflow-hidden rounded-2xl">
          <div className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-4 border-b border-white/[0.04] px-5 py-3 text-[10px] uppercase tracking-[0.32em] text-white/40">
            <span>#</span>
            <span>User</span>
            <span className="text-right">W/L</span>
            <span className="text-right">Score</span>
            <span className="text-right">ELO</span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-white/40">
              No matches.
            </div>
          ) : (
            filtered.map((u, i) => {
              const rank = rankFromElo(u.elo);
              const isMe = u.id === "me";
              return (
                <div
                  key={u.id}
                  className={
                    "grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-4 border-b border-white/[0.02] px-5 py-3 text-sm transition " +
                    (isMe ? "bg-mog-violet/10" : "hover:bg-white/[0.02]")
                  }
                >
                  <span className="font-mono text-white/40">#{i + 1}</span>
                  <div className="flex items-center gap-3 truncate">
                    <Avatar name={u.username} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold uppercase tracking-[0.16em] text-white">
                        {u.username}
                        {isMe && (
                          <span className="ml-2 rounded-full bg-mog-violet/20 px-2 py-0.5 text-[9px] tracking-[0.22em] text-mog-violet">
                            YOU
                          </span>
                        )}
                      </p>
                      <p
                        className="text-[10px] uppercase tracking-[0.22em]"
                        style={{ color: rank.color }}
                      >
                        <span aria-hidden>{rank.emoji}</span> {rank.label}
                      </p>
                    </div>
                  </div>
                  <span className="text-right text-xs text-white/60">
                    {u.wins}/{u.losses}
                  </span>
                  <span className="text-right font-mono text-xs text-white/80">
                    {Math.round(u.edgeScore)}
                  </span>
                  <span className="text-right font-semibold text-cyan-300">
                    {u.elo}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      <Footer />
    </main>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.replace(/[0-9]+$/g, "").slice(0, 2).toUpperCase();
  // Stable color from name hash
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[11px] font-semibold uppercase tracking-wider"
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 22%), hsl(${(hue + 40) % 360}, 60%, 12%))`,
        color: `hsl(${hue}, 70%, 80%)`
      }}
    >
      {initials}
    </div>
  );
}
