"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { OwnerBadge } from "@/components/OwnerBadge";
import { rankFromElo } from "@/lib/rank";
import { flagFor } from "@/lib/flag";

type Entry = {
  username: string;
  elo: number;
  wins: number;
  losses: number;
  edgeScore: number;
  faceDataUrl: string | null;
  countryCode: string | null;
  updatedAt: number;
};

export default function LivePage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await fetch("/api/live");
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6">
        <p className="label-xs text-edge-cyan">Live</p>
        <h1 className="heading-display mt-2 text-4xl">
          Active <span className="brand-edge">now</span>
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Players whose stats moved in the last 10 minutes. Refreshes every
          15 seconds.
        </p>
      </div>

      {loading ? (
        <div className="glass mt-6 h-64 animate-pulse rounded-2xl" />
      ) : entries.length === 0 ? (
        <div className="glass mt-6 rounded-2xl px-6 py-12 text-center">
          <div className="text-5xl">💤</div>
          <h2 className="heading-display mt-3 text-2xl">Quiet right now</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">
            No one&apos;s active in the last 10 minutes. Check back, or queue
            up to be the first.
          </p>
          <Link
            href="/arena"
            className="mt-5 inline-block rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-cyan/25"
          >
            Find match →
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {entries.map((e) => {
            const rank = rankFromElo(e.elo);
            const ago = secsAgo(e.updatedAt);
            return (
              <li
                key={e.username}
                className="glass flex items-center gap-3 rounded-xl px-4 py-3"
              >
                <Link
                  href={`/u/${encodeURIComponent(e.username)}`}
                  className="flex flex-1 items-center gap-3 truncate"
                >
                  {e.faceDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.faceDataUrl}
                      alt=""
                      className="h-10 w-10 rounded-lg border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-base">
                      {rank.emoji}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold uppercase tracking-[0.16em] text-white">
                      {e.countryCode && (
                        <span className="mr-2">{flagFor(e.countryCode)}</span>
                      )}
                      {e.username}
                      <OwnerBadge name={e.username} size="xs" />
                    </p>
                    <p
                      className="text-[10px] uppercase tracking-[0.22em]"
                      style={{ color: rank.color }}
                    >
                      {rank.emoji} {rank.label} · {e.elo} ELO
                    </p>
                  </div>
                </Link>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
                    <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-emerald-400" />
                    {ago}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Footer />
    </main>
  );
}

function secsAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}
