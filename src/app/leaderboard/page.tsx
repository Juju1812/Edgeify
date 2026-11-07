"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { api } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import { formatPsl, type LeaderboardRow } from "@/lib/shared/types";
import { Avatar, ButtonLink, Card, Empty, Flag, PageTitle } from "@/components/ui";

export default function LeaderboardPage() {
  const { me } = useSession();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    api<{ rows: LeaderboardRow[] }>("/api/leaderboard")
      .then((r) => setRows(r.rows))
      .catch(() => setRows([]));
  }, []);

  const mine = rows?.find((r) => me && r.username.toLowerCase() === me.username.toLowerCase());

  return (
    <main className="page">
      <PageTitle
        title="Leaderboard"
        subtitle="The top 100 players, ranked by ELO from live face-offs."
        right={
          me && !mine ? (
            <ButtonLink href="/play" variant="secondary">
              {me.placementsLeft > 0 ? `Play ${me.placementsLeft} placement${me.placementsLeft === 1 ? "" : "s"} to rank` : "Play to climb"}
            </ButtonLink>
          ) : undefined
        }
      />

      {rows && rows.length >= 3 && (
        <div className="mb-5 grid grid-cols-3 gap-3 md:gap-5">
          {[rows[1], rows[0], rows[2]].map((r, i) => (
            <Link key={r.username} href={`/u/${r.username}`}>
              <Card className={clsx("flex flex-col items-center px-3 py-6 text-center transition-shadow hover:shadow-lift", i === 1 && "md:-translate-y-3")}>
                <span className="eyebrow">#{r.rank}</span>
                <Avatar username={r.username} hasFace={r.hasFace} size={i === 1 ? 84 : 68} className="mt-3" />
                <span className="mt-3 max-w-full truncate text-[16px] font-semibold md:text-[18px]">{r.username}</span>
                <span className="text-[14px] tabular-nums text-ink-3">{r.elo} ELO</span>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[44px_1fr_64px_72px] items-center gap-3 border-b border-line px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-4 md:grid-cols-[56px_1fr_90px_90px_100px] md:px-7">
          <span>Rank</span>
          <span>Player</span>
          <span className="text-right">Score</span>
          <span className="hidden text-right md:block">Record</span>
          <span className="text-right">ELO</span>
        </div>
        {rows === null &&
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0 md:px-7">
              <span className="h-4 w-6 animate-pulse rounded-full bg-fill" />
              <span className="h-10 w-10 animate-pulse rounded-full bg-fill" />
              <span className="h-4 w-32 animate-pulse rounded-full bg-fill" />
            </div>
          ))}
        {rows?.length === 0 && (
          <Empty
            title="No ranked players yet"
            body="Finish three placement matches to appear here."
            action={<ButtonLink href="/play">Play now</ButtonLink>}
          />
        )}
        {rows?.map((r) => {
          const isMe = me && r.username.toLowerCase() === me.username.toLowerCase();
          return (
            <Link
              key={r.username}
              href={`/u/${r.username}`}
              className={clsx(
                "grid grid-cols-[44px_1fr_64px_72px] items-center gap-3 border-b border-line px-5 py-3 transition-colors last:border-0 hover:bg-[#fafafc] md:grid-cols-[56px_1fr_90px_90px_100px] md:px-7",
                isMe && "bg-accent-soft/60"
              )}
            >
              <span className="text-[15px] font-semibold tabular-nums text-ink-3">{r.rank}</span>
              <span className="flex min-w-0 items-center gap-3">
                <Avatar username={r.username} hasFace={r.hasFace} size={40} />
                <span className="truncate text-[16px] text-ink">
                  {r.username} {r.country && <Flag code={r.country} />}
                </span>
              </span>
              <span className="flex flex-col items-end text-right leading-tight">
                <span className="text-[16px] tabular-nums text-ink-2">{r.overall ?? "–"}</span>
                {r.overall !== null && (
                  <span className="text-[11px] tabular-nums text-ink-4">{formatPsl(r.overall)}</span>
                )}
              </span>
              <span className="hidden text-right text-[15px] tabular-nums text-ink-3 md:block">
                {r.wins}–{r.losses}
              </span>
              <span className="text-right text-[16px] font-semibold tabular-nums text-ink">{r.elo}</span>
            </Link>
          );
        })}
      </Card>
    </main>
  );
}
