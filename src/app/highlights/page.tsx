"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Footer } from "@/components/Footer";
import { useUser } from "@/lib/user-context";
import type { MatchRecord } from "@/lib/types";

/**
 * /highlights — gallery of your best matches by ELO impact + clean
 * sweeps. Built locally from match history. Each card links to the
 * full Replay Theatre and shows a quick round-by-round visual.
 */
export default function HighlightsPage() {
  const { user, status } = useUser();

  const top = useMemo(() => {
    if (status === "guest") return [];
    const ranked = user.matchHistory.filter((m) => !m.practice);
    // Score each match by "highlight value" = abs(eloDelta) * 1 + sweep bonus + own-win bias
    const scored = ranked.map((m) => {
      let v = Math.abs(m.eloDelta);
      const sweep =
        (m.won && m.myScore >= 2 && m.oppScore === 0) ||
        (!m.won && m.oppScore >= 2 && m.myScore === 0);
      if (sweep) v += 15;
      if (m.won) v += 5;
      return { m, v };
    });
    scored.sort((a, b) => b.v - a.v);
    return scored.slice(0, 12).map((s) => s.m);
  }, [user.matchHistory, status]);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6">
        <p className="label-xs text-edge-cyan">Highlights</p>
        <h1 className="heading-display mt-2 text-4xl">
          Your <span className="brand-edge">best moments</span>
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Top 12 matches ranked by ELO swing, sweeps, and wins. Click any
          card to open the Replay Theatre.
        </p>
      </div>

      {status === "guest" || top.length === 0 ? (
        <div className="glass mt-8 rounded-2xl px-6 py-12 text-center">
          <div className="text-5xl">🎬</div>
          <h2 className="heading-display mt-3 text-2xl">No highlights yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">
            Play some matches and the best ones will surface here automatically.
          </p>
          <Link
            href="/arena"
            className="mt-5 inline-block rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-cyan/25"
          >
            Find a match →
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {top.map((m) => (
            <HighlightCard key={m.id} m={m} />
          ))}
        </div>
      )}

      <Footer />
    </main>
  );
}

function HighlightCard({ m }: { m: MatchRecord }) {
  const sweep =
    (m.won && m.myScore >= 2 && m.oppScore === 0) ||
    (!m.won && m.oppScore >= 2 && m.myScore === 0);
  const upset = m.won && m.eloDelta >= 25;
  return (
    <Link
      href={`/replay/${encodeURIComponent(m.id)}`}
      className={
        "glass glass-hover relative rounded-2xl p-5 transition " +
        (m.won ? "border-emerald-400/25" : "border-rose-400/25")
      }
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/85">
          vs {m.opponentName}
        </p>
        <span
          className="stat-mono text-2xl font-bold"
          style={{ color: m.eloDelta >= 0 ? "#22e9ff" : "#ff5d8f" }}
        >
          {m.eloDelta >= 0 ? "+" : ""}
          {m.eloDelta}
        </span>
      </div>
      <p
        className="mt-1 text-[10px] uppercase tracking-[0.32em]"
        style={{ color: m.won ? "#34d399" : "#f87171" }}
      >
        {m.won ? "WIN" : "LOSS"} · {m.myScore}–{m.oppScore}
      </p>

      {m.rounds && m.rounds.length > 0 && (
        <div className="mt-3 space-y-1">
          {m.rounds.map((r, i) => {
            const won = r.me > r.opp;
            const total = r.me + r.opp || 1;
            const myPct = (r.me / total) * 100;
            return (
              <div key={i} className="flex h-3 overflow-hidden rounded-sm">
                <div
                  className="bg-emerald-500/40"
                  style={{ width: `${myPct}%` }}
                  title={`${r.criterion}: ${r.me}`}
                />
                <div
                  className="bg-rose-500/30"
                  style={{ width: `${100 - myPct}%` }}
                  title={`${r.criterion}: ${r.opp}`}
                />
                <div className="ml-1 self-center text-[8px] uppercase tracking-[0.22em] text-white/40">
                  {won ? "W" : "L"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(sweep || upset) && (
        <div className="mt-3 flex flex-wrap gap-1">
          {sweep && (
            <span className="rounded-full bg-edge-cyan/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-edge-cyan">
              SWEEP
            </span>
          )}
          {upset && (
            <span className="rounded-full bg-edge-coral/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-edge-coral">
              BIG MOG
            </span>
          )}
        </div>
      )}
      <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-white/30">
        {new Date(m.playedAt).toLocaleDateString()} · Tap to replay →
      </p>
    </Link>
  );
}
