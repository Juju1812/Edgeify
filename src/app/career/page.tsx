"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { AskCoachButton } from "@/components/AskCoachButton";
import { EdgeScoreRadar } from "@/components/EdgeScoreRadar";
import { useUser } from "@/lib/user-context";

export default function CareerPage() {
  const { user, status } = useUser();

  if (status === "guest") {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 pt-10">
        <p className="text-sm text-white/40">Sign in to view career stats.</p>
      </main>
    );
  }

  const lt = user.lifetime;
  const wr = user.wins + user.losses > 0
    ? Math.round((user.wins / (user.wins + user.losses)) * 100)
    : 0;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link href="/" className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white">
        ← Back to Lobby
      </Link>
      <div className="mt-6">
        <p className="label-xs">Career</p>
        <h1 className="heading-card mt-2 text-3xl">Lifetime Stats</h1>
        <p className="mt-1 text-sm text-white/50">
          Persists across all seasons.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <BigStat label="Matches Played" value={lt.matchesPlayed} />
        <BigStat label="Total XP" value={lt.totalXp.toLocaleString()} />
        <BigStat label="Peak ELO Ever" value={lt.peakEloEver} />
        <BigStat label="Longest Streak" value={lt.longestStreak} accent="🔥" />
        <BigStat label="Faces Scanned" value={lt.facesScanned} accent="🧪" />
        <BigStat label="Boosts Used" value={lt.totalBoostsUsed} accent="⚡" />
      </div>

      <h2 className="label-xs mt-10 mb-3">Ranked Standing</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <BigStat label="Wins" value={user.wins} />
        <BigStat label="Losses" value={user.losses} />
        <BigStat label="Win Rate" value={`${wr}%`} />
        <BigStat label="ELO" value={user.elo} />
        <BigStat label="Peak ELO" value={user.peakElo} />
        <BigStat label="Current Streak" value={user.streak} />
      </div>

      <div className="mt-10 grid gap-3 lg:grid-cols-2">
        {user.edgeScore && <EdgeScoreRadar score={user.edgeScore} />}
        <AskCoachButton />
      </div>

      <Footer />
    </main>
  );
}

function BigStat({
  label,
  value,
  accent
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="glass rounded-xl px-4 py-5">
      <p className="text-[10px] uppercase tracking-[0.32em] text-white/40">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">
        {accent && <span className="mr-2 text-base">{accent}</span>}
        {value}
      </p>
    </div>
  );
}
