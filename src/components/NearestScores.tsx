"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/user-context";
import { rankFromElo } from "@/lib/rank";

type Entry = {
  username: string;
  elo: number;
  edgeScore: number;
  faceDataUrl: string | null;
};

/**
 * "Nearest score" CTA — shown right after the user's first scan, on
 * the Saved Scan view. Loads the public leaderboard and surfaces the
 * 3 ranked players whose EdgeScore is closest to the user's.
 *
 * Each row links to /vs/[me]/[them] so the user can see a head-to-head
 * preview before queueing a match.
 */
export function NearestScores() {
  const { user } = useUser();
  const myScore = Math.round(user.edgeScore?.composite ?? 0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setEntries(data.entries || []);
      } catch {
        /* network blip */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="glass h-32 animate-pulse rounded-2xl" />;
  }
  const me = (user.username || "").toLowerCase();
  const candidates = entries
    .filter((e) => e.username.toLowerCase() !== me)
    .map((e) => ({ ...e, gap: Math.abs(e.edgeScore - myScore) }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 3);

  if (candidates.length === 0) return null;

  return (
    <div className="rounded-2xl border border-edge-cyan/20 bg-edge-cyan/[0.03] p-4">
      <p className="label-xs text-edge-cyan">Closest to your score</p>
      <p className="mt-1 text-xs text-white/55">
        Three real players within reach of your {myScore} EdgeScore. Tap
        any of them to preview a head-to-head.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {candidates.map((e) => {
          const r = rankFromElo(e.elo);
          return (
            <Link
              key={e.username}
              href={
                user.username
                  ? `/vs/${encodeURIComponent(user.username)}/${encodeURIComponent(e.username)}`
                  : `/u/${encodeURIComponent(e.username)}`
              }
              className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 transition hover:border-edge-cyan/40 hover:bg-edge-cyan/[0.06]"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/40">
                {e.faceDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.faceDataUrl}
                    alt=""
                    className="h-full w-full -scale-x-100 object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full items-center justify-center text-xl"
                    style={{ color: r.color }}
                  >
                    {r.emoji}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-white">
                  {e.username}
                </p>
                <p
                  className="text-[10px] uppercase tracking-[0.32em]"
                  style={{ color: r.color }}
                >
                  {r.label}
                </p>
                <p className="stat-mono mt-0.5 text-xs text-edge-cyan">
                  {e.edgeScore}{" "}
                  <span className="text-white/35">
                    ({e.gap === 0 ? "same" : `${e.gap > 0 ? "+" : ""}${e.edgeScore - myScore}`})
                  </span>
                </p>
              </div>
              <span className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-edge-cyan">
                →
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
