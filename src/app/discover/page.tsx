"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Footer } from "@/components/Footer";
import { OwnerBadge } from "@/components/OwnerBadge";
import { rankFromElo } from "@/lib/rank";
import { flagFor } from "@/lib/flag";

type Card = {
  username: string;
  elo: number;
  wins: number;
  losses: number;
  edgeScore: number;
  faceDataUrl: string | null;
  countryCode: string | null;
};

const SWIPE_KEY = "edgify:discover:seen:v1";

/**
 * Tinder-style face-discovery feed. Pulls leaderboard summaries and
 * lets the user swipe through them: → challenges (copies invite-link),
 * ← skips. Skipped users are remembered locally so they don't reappear
 * for the rest of this session.
 */
export default function DiscoverPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const [stats, setStats] = useState({ challenged: 0, skipped: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) return;
        const data = await res.json();
        const seen: string[] = JSON.parse(
          localStorage.getItem(SWIPE_KEY) || "[]"
        );
        const seenSet = new Set(seen.map((s) => s.toLowerCase()));
        const filtered = (data.entries || []).filter(
          (e: Card) => !seenSet.has(e.username.toLowerCase()) && e.faceDataUrl
        );
        if (!cancelled) setCards(filtered);
      } catch {
        /* */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function recordSeen(username: string) {
    try {
      const seen: string[] = JSON.parse(
        localStorage.getItem(SWIPE_KEY) || "[]"
      );
      seen.push(username);
      localStorage.setItem(SWIPE_KEY, JSON.stringify(seen.slice(-200)));
    } catch {
      /* */
    }
  }

  function challenge(c: Card) {
    setExitDir("right");
    recordSeen(c.username);
    setStats((s) => ({ ...s, challenged: s.challenged + 1 }));
    // Open challenge in same tab — quick match in their ELO band.
    setTimeout(() => {
      window.location.href = `/u/${encodeURIComponent(c.username)}`;
    }, 350);
  }

  function skip() {
    const cur = cards[idx];
    if (cur) recordSeen(cur.username);
    setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
    setExitDir("left");
    setTimeout(() => {
      setIdx((i) => i + 1);
      setExitDir(null);
    }, 300);
  }

  const cur = cards[idx];

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <p className="label-xs text-edge-coral">Discover</p>
          <h1 className="heading-display mt-2 text-4xl">
            Find your <span className="brand-edge">next opponent</span>
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Swipe right to challenge · left to skip. Skipped players
            don&apos;t reappear today.
          </p>
        </div>
        <div className="text-right text-[10px] uppercase tracking-[0.32em] text-white/35">
          <p>
            <span className="text-edge-cyan">{stats.challenged}</span>{" "}
            challenged
          </p>
          <p className="mt-1">
            <span className="text-white/65">{stats.skipped}</span> skipped
          </p>
        </div>
      </div>

      <div className="relative mt-8 h-[480px]">
        <AnimatePresence>
          {cur ? (
            <DiscoverCard
              key={cur.username}
              card={cur}
              exitDir={exitDir}
              onChallenge={() => challenge(cur)}
              onSkip={skip}
            />
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass flex h-full items-center justify-center rounded-2xl px-8 text-center"
            >
              <div>
                <p className="text-5xl">🌑</p>
                <h2 className="heading-display mt-3 text-2xl">
                  You&apos;re caught up
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">
                  You&apos;ve seen every ranked player online right now.
                  New cards drop in as players come online — refresh
                  later, or invite a friend to fill the queue.
                </p>
                <button
                  onClick={() => {
                    localStorage.removeItem(SWIPE_KEY);
                    window.location.reload();
                  }}
                  className="mt-6 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65 transition hover:border-edge-cyan/40 hover:text-edge-cyan"
                >
                  Reset history
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          onClick={skip}
          disabled={!cur}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/15 bg-black/30 text-2xl text-white/60 transition hover:border-rose-400/60 hover:text-rose-300 active:scale-95 disabled:opacity-30"
          title="Skip"
        >
          ✕
        </button>
        <button
          onClick={() => cur && challenge(cur)}
          disabled={!cur}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-edge-cyan bg-edge-cyan/15 text-3xl shadow-glow transition hover:bg-edge-cyan/25 active:scale-95 disabled:opacity-30"
          title="Challenge"
        >
          ⚔️
        </button>
      </div>

      <Footer />
    </main>
  );
}

function DiscoverCard({
  card,
  exitDir,
  onChallenge,
  onSkip
}: {
  card: Card;
  exitDir: "left" | "right" | null;
  onChallenge: () => void;
  onSkip: () => void;
}) {
  const rank = rankFromElo(card.elo);
  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_e, info) => {
        if (info.offset.x > 100) onChallenge();
        else if (info.offset.x < -100) onSkip();
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: 1,
        x: exitDir === "right" ? 600 : exitDir === "left" ? -600 : 0,
        rotate: exitDir === "right" ? 15 : exitDir === "left" ? -15 : 0
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
    >
      <div className="glass-featured relative h-full overflow-hidden rounded-3xl">
        <div className="aspect-[4/3] w-full bg-black/40">
          {card.faceDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.faceDataUrl}
              alt=""
              className="h-full w-full -scale-x-100 object-cover"
            />
          ) : (
            <div
              className="flex h-full items-center justify-center text-7xl"
              style={{ color: rank.color }}
            >
              {rank.emoji}
            </div>
          )}
        </div>
        <div className="border-t border-white/[0.06] bg-black/60 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="heading-display text-2xl">
              {card.username}
              <OwnerBadge name={card.username} size="sm" />
              {card.countryCode && (
                <span className="ml-2 text-base">
                  {flagFor(card.countryCode)}
                </span>
              )}
            </h3>
            <span
              className="stat-mono text-base"
              style={{ color: rank.color }}
            >
              {card.elo}
            </span>
          </div>
          <p
            className="mt-1 text-[10px] uppercase tracking-[0.32em]"
            style={{ color: rank.color }}
          >
            {rank.emoji} {rank.label}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] uppercase tracking-[0.22em]">
            <div className="rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
              <p className="text-white/40">Wins</p>
              <p className="stat-mono mt-0.5 text-emerald-300">{card.wins}</p>
            </div>
            <div className="rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
              <p className="text-white/40">Losses</p>
              <p className="stat-mono mt-0.5 text-rose-300">{card.losses}</p>
            </div>
            <div className="rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
              <p className="text-white/40">Score</p>
              <p className="stat-mono mt-0.5 text-edge-cyan">
                {card.edgeScore}
              </p>
            </div>
          </div>
        </div>
        <p className="absolute bottom-3 right-3 text-[9px] uppercase tracking-[0.32em] text-white/30">
          Drag → challenge · ← skip
        </p>
      </div>
    </motion.div>
  );
}
