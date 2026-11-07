"use client";

import { motion } from "framer-motion";
import { clsx } from "clsx";
import { ButtonLink, Card } from "@/components/ui";
import { ScoreRing, TraitBars } from "@/components/score";
import type { MatchScore, MatchView } from "@/lib/shared/match-types";

function scoreOf(s: MatchScore | undefined) {
  return s && s.ok ? s : null;
}

export function MatchResult({ match }: { match: MatchView }) {
  const me = match.me;
  const opp = match.opponent;
  const mine = scoreOf(match.scores[me]);
  const theirs = scoreOf(match.scores[opp]);
  const result = match.result;
  const winner = result?.winner ?? null;
  const iWon = !!winner && winner.toLowerCase() === me.toLowerCase();
  const draw = !winner;
  const forfeit = result?.reason === "forfeit";

  const title = draw ? "It's a draw" : iWon ? "You win" : `${opp} wins`;
  const margin = mine && theirs ? Math.abs(mine.overall - theirs.overall) : null;
  const sub = forfeit
    ? iWon
      ? `${opp} left or didn't scan in time.`
      : "You left or didn't get scanned in time."
    : draw
      ? "Dead even — not a point between you."
      : margin !== null && margin <= 3
        ? iWon
          ? "By a hair. The AI gave you the edge."
          : "Close one. Run it back."
        : margin !== null && margin <= 10
          ? iWon
            ? "A clear win."
            : "Not this time — check your easy wins and go again."
          : iWon
            ? "A decisive win."
            : "Tough one. Check your easy wins and run it back.";

  const elo = result?.elo?.[me];
  const playAgain =
    match.kind === "ranked" ? "/play?search=1" : match.kind === "tourney" && match.tourney ? `/play/tourney/${match.tourney}` : "/play";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="p-7 text-center md:p-10">
        <p className="eyebrow">{match.kind === "ranked" ? "Ranked 1v1" : match.kind === "tourney" ? "Tournament" : "Private room"}</p>
        <h1 className={clsx("display mt-2 text-[40px] leading-tight md:text-[52px]", iWon && "text-accent")}>{title}</h1>
        <p className="mt-2 text-[16px] text-ink-3">{sub}</p>

        {elo && (
          <div
            className={clsx(
              "mx-auto mt-5 w-fit rounded-full px-4 py-1.5 text-[15px] font-semibold tabular-nums",
              elo.delta > 0 ? "bg-[#e9f7ee] text-good" : elo.delta < 0 ? "bg-fill text-ink-2" : "bg-fill text-ink-3"
            )}
          >
            {elo.delta > 0 ? "+" : ""}
            {elo.delta} ELO · {elo.after}
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 items-start gap-4 sm:gap-10 md:mx-auto md:max-w-xl">
          <Side name={me} label="You" overall={mine?.overall ?? null} winner={iWon} />
          <Side name={opp} label={opp} overall={theirs?.overall ?? null} winner={!draw && !iWon} />
        </div>

        {mine?.headline && <p className="mx-auto mt-6 max-w-md text-[17px] font-medium text-ink">“{mine.headline}”</p>}
      </Card>

      {mine && theirs && (
        <Card className="mt-5 p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[20px] font-semibold tracking-tight">Trait by trait</h2>
            <div className="flex items-center gap-4 text-[13px] text-ink-3">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-5 rounded-full bg-accent" /> You
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-5 rounded-full bg-[#c7c7cc]" /> {opp}
              </span>
            </div>
          </div>
          <TraitBars traits={mine.traits} compare={theirs.traits} />
        </Card>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href={playAgain} size="lg">
          {match.kind === "tourney" ? "Back to tournament" : match.kind === "ranked" ? "Play again" : "Back to Play"}
        </ButtonLink>
        <ButtonLink href="/" size="lg" variant="plain">
          Home
        </ButtonLink>
      </div>
    </motion.div>
  );
}

function Side({ name, label, overall, winner }: { name: string; label: string; overall: number | null; winner: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="hidden sm:block">
        <ScoreRing value={overall} size={160} label="" muted={!winner} />
      </div>
      <div className="sm:hidden">
        <ScoreRing value={overall} size={128} label="" muted={!winner} />
      </div>
      <p className="mt-3 max-w-full truncate text-[16px] font-semibold">{label}</p>
      {overall === null && <p className="text-[13px] text-ink-4">No score</p>}
      {winner && <p className="text-[13px] font-medium text-accent-ink">Winner</p>}
      <span className="sr-only">{name}</span>
    </div>
  );
}
