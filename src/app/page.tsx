"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { LeaderboardRow, MeProfile } from "@/lib/shared/types";
import { Avatar, ButtonLink, Card, Spinner } from "@/components/ui";
import { ScoreRing, TraitBars, tierLabel } from "@/components/score";
import { Logo } from "@/components/nav";

export default function HomePage() {
  const { me, loading } = useSession();
  if (loading) {
    return (
      <main className="page flex justify-center pt-24">
        <Spinner />
      </main>
    );
  }
  return me ? <Dashboard me={me} /> : <Landing />;
}

function Dashboard({ me }: { me: MeProfile }) {
  const [top, setTop] = useState<LeaderboardRow[] | null>(null);
  useEffect(() => {
    api<{ rows: LeaderboardRow[] }>("/api/leaderboard")
      .then((r) => setTop(r.rows.slice(0, 5)))
      .catch(() => setTop([]));
  }, []);

  const s = me.score;
  return (
    <main className="page">
      <div className="mb-6 md:mb-8">
        <h1 className="display text-[34px] md:text-[48px]">Welcome back, {me.username}.</h1>
        <p className="mt-1 text-[17px] text-ink-3">{s ? "Your latest look, at a glance." : "Let's get your first score."}</p>
      </div>

      <Card className="animate-fade-up p-7 md:p-10">
        {s ? (
          <div className="flex flex-col items-center gap-8 md:flex-row md:gap-14">
            <ScoreRing value={s.overall} size={224} />
            <div className="text-center md:text-left">
              <p className="eyebrow">Your score · {tierLabel(s.overall)}</p>
              <h2 className="display mt-2 text-[30px] leading-[1.1] md:text-[44px]">{s.headline}</h2>
              <p className="mt-3 text-[16px] text-ink-3">
                Based on {s.readings} {s.readings === 1 ? "reading" : "readings"}
                {me.placementsLeft > 0
                  ? ` · ${me.placementsLeft} placement ${me.placementsLeft === 1 ? "match" : "matches"} until you're ranked`
                  : ` · ${me.elo} ELO`}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
                <ButtonLink href="/scan" size="lg">
                  Scan again
                </ButtonLink>
                <ButtonLink href="/play" variant="secondary" size="lg">
                  Play 1v1
                </ButtonLink>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8 md:flex-row md:gap-14">
            <ScoreRing value={null} size={224} label="not scanned" />
            <div className="text-center md:text-left">
              <p className="eyebrow">Step one</p>
              <h2 className="display mt-2 text-[30px] leading-[1.1] md:text-[44px]">Scan your face.</h2>
              <p className="mt-3 max-w-md text-[16px] text-ink-3">
                Our AI rates your symmetry, proportions, jawline, cheekbones, eyes, leanness, skin and hair — honestly — in about ten seconds.
              </p>
              <div className="mt-6 flex justify-center md:justify-start">
                <ButtonLink href="/scan" size="lg">
                  Start your scan
                </ButtonLink>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <Card className="animate-fade-up p-7 [animation-delay:100ms]">
          <h2 className="text-[22px] font-semibold tracking-tight">Trait breakdown</h2>
          {s ? (
            <div className="mt-5">
              <TraitBars traits={s.traits} />
            </div>
          ) : (
            <p className="mt-3 text-[15px] text-ink-3">Your eight trait scores appear here after your first scan.</p>
          )}
        </Card>

        <Card className="animate-fade-up p-7 [animation-delay:180ms]">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[22px] font-semibold tracking-tight">Top players</h2>
            <span className="eyebrow">ELO</span>
          </div>
          <ul className="mt-3">
            {top === null &&
              Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                  <span className="h-10 w-10 animate-pulse rounded-full bg-fill" />
                  <span className="h-4 w-28 animate-pulse rounded-full bg-fill" />
                </li>
              ))}
            {top?.length === 0 && <li className="py-4 text-[15px] text-ink-3">Nobody's ranked yet — be the first.</li>}
            {top?.map((r) => (
              <li key={r.username} className="border-b border-line last:border-0">
                <Link href={`/u/${r.username}`} className="flex items-center gap-3 py-3">
                  <Avatar username={r.username} hasFace={r.hasFace} size={40} />
                  <span className="flex-1 truncate text-[17px] text-ink">{r.username}</span>
                  <span className="text-[17px] tabular-nums text-ink">{r.elo}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/leaderboard" className="mt-3 inline-block text-[15px] font-medium text-accent-ink hover:underline">
            View leaderboard
          </Link>
        </Card>
      </div>
    </main>
  );
}

function Landing() {
  return (
    <main className="page">
      <section className="flex flex-col items-center pt-8 text-center md:pt-16">
        <Logo size={56} />
        <h1 className="display mt-7 max-w-[860px] text-[46px] leading-[1.03] md:text-[80px]">
          Your face.
          <br />
          <span className="text-ink-4">Scored honestly.</span>
        </h1>
        <p className="mt-6 max-w-[560px] text-[19px] text-ink-3 md:text-[21px]">
          An AI looks score with a trait-by-trait breakdown. Then face off live, 1v1, and climb the leaderboard.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/signup" size="lg">
            Get your score
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" size="lg">
            Sign in
          </ButtonLink>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-[920px] md:mt-20">
        <Card className="p-7 md:p-10">
          <div className="flex flex-col items-center gap-8 md:flex-row md:gap-14">
            <ScoreRing value={74} size={220} />
            <div className="w-full flex-1">
              <p className="eyebrow">Example result</p>
              <p className="display mt-2 text-[28px] leading-[1.1] md:text-[34px]">Strong harmony. Clear presence.</p>
              <div className="mt-5">
                <TraitBars
                  compact
                  traits={{ symmetry: 81, proportions: 78, jaw: 72, cheekbones: 76, eyes: 80, leanness: 74, skin: 70, hair: 73 }}
                />
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="mx-auto mt-5 grid max-w-[920px] gap-5 md:grid-cols-3">
        {[
          ["Scan", "A few quick frames from your webcam. The AI reads eight traits and gives you a 0–100 score."],
          ["Face off", "Get matched with someone near your level. Both faces are scored live — higher score wins."],
          ["Climb", "Win to gain ELO and rise up the global leaderboard. Challenge friends in private rooms."]
        ].map(([t, b], i) => (
          <Card key={t} className="p-7">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-[15px] font-semibold text-accent-ink">
              {i + 1}
            </span>
            <h3 className="mt-4 text-[21px] font-semibold tracking-tight">{t}</h3>
            <p className="mt-1.5 text-[15px] text-ink-3">{b}</p>
          </Card>
        ))}
      </section>

      <p className="mx-auto mt-10 max-w-[560px] text-center text-[13px] text-ink-4">
        18+ only. Scores are an AI&apos;s opinion for entertainment and don&apos;t define anyone&apos;s worth.
      </p>
    </main>
  );
}
