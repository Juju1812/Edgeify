"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { useUser } from "@/lib/user-context";

export default function AchievementsPage() {
  const { user, status } = useUser();

  if (status === "guest") {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 pt-10">
        <p className="text-sm text-white/40">Sign in to view achievements.</p>
      </main>
    );
  }

  const unlocked = ACHIEVEMENTS.filter((a) => a.check(user));
  const locked = ACHIEVEMENTS.filter((a) => !a.check(user));
  const pct = Math.round((unlocked.length / ACHIEVEMENTS.length) * 100);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6">
        <p className="label-xs text-edge-cyan">Achievements</p>
        <h1 className="heading-display mt-2 text-4xl">
          {unlocked.length} / {ACHIEVEMENTS.length} Unlocked
        </h1>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full transition-all"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #22e9ff 0%, #ff5d8f 100%)"
            }}
          />
        </div>
        <p className="mt-2 text-xs text-white/40">{pct}% complete</p>
      </div>

      {unlocked.length === 0 && (
        <div className="mt-6 rounded-2xl border border-edge-cyan/20 bg-edge-cyan/[0.03] p-4">
          <p className="text-xs text-white/65">
            💡 Hover any locked card to see what unlocks it. Most early
            achievements come from playing your first ranked match,
            scanning your face, or hitting a 3-day streak.
          </p>
        </div>
      )}

      {unlocked.length > 0 && (
        <>
          <h2 className="label-xs mt-10 mb-3 text-edge-cyan">Unlocked</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {unlocked.map((a) => (
              <AchievementCard key={a.id} a={a} unlocked />
            ))}
          </div>
        </>
      )}

      {locked.length > 0 && (
        <>
          <h2 className="label-xs mt-10 mb-3">Locked</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {locked.map((a) => (
              <AchievementCard key={a.id} a={a} unlocked={false} />
            ))}
          </div>
        </>
      )}

      <Footer />
    </main>
  );
}

function AchievementCard({
  a,
  unlocked
}: {
  a: { name: string; description: string; emoji: string };
  unlocked: boolean;
}) {
  return (
    <div
      className={
        "glass flex items-start gap-4 rounded-2xl p-4 " +
        (unlocked
          ? "border-edge-cyan/25"
          : "border-white/[0.04] opacity-60 grayscale")
      }
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/40 text-2xl">
        {a.emoji}
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
          {a.name}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-white/55">
          {a.description}
        </p>
      </div>
    </div>
  );
}
