"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Footer } from "@/components/Footer";
import { LiveMatch } from "@/components/Arena/LiveMatch";
import { eloDelta } from "@/lib/elo";
import { rankFromElo } from "@/lib/rank";
import { applyMatchResult, POWERUP_META } from "@/lib/season";
import { findOpponent, type SeedUser } from "@/lib/seed-users";
import { useUser } from "@/lib/user-context";
import type { EdgeScoreBreakdown, GameMode, MatchRecord, PowerUpId } from "@/lib/types";

type Mode = "select" | "quick" | "live";

type Phase =
  | "lobby"
  | "searching"
  | "versus"
  | "round"
  | "between-rounds"
  | "result";

const ROUND_CRITERIA = [
  { key: "symmetry", label: "Symmetry" },
  { key: "jawlineDefinition", label: "Jawline" },
  { key: "composite", label: "Overall" }
] as const;

type CriterionKey = (typeof ROUND_CRITERIA)[number]["key"];

function scoreFor(s: EdgeScoreBreakdown, k: CriterionKey): number {
  if (k === "composite") return s.composite;
  // Other keys are 0..1 in the breakdown — scale to 0..100.
  return (s[k as keyof EdgeScoreBreakdown] as number) * 100;
}

function syntheticBreakdownFromElo(elo: number, edgeScore: number): EdgeScoreBreakdown {
  // Deterministic-ish bot breakdown so each opponent has consistent stats.
  const seed = elo + edgeScore * 31;
  const r = (k: number) => {
    const v = Math.sin(seed + k) * 10000;
    return v - Math.floor(v);
  };
  const center = edgeScore / 100;
  return {
    symmetry: clamp01(center + (r(1) - 0.5) * 0.2),
    jawlineDefinition: clamp01(center + (r(2) - 0.5) * 0.25),
    canthalTilt: (r(3) - 0.5) * 1.4,
    cheekboneProm: clamp01(center + (r(4) - 0.5) * 0.2),
    goldenRatio: clamp01(center + (r(5) - 0.5) * 0.2),
    faceFat: clamp01(0.5 - (center - 0.5) * 0.6 + (r(6) - 0.5) * 0.2),
    composite: edgeScore
  };
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export default function ArenaPage() {
  const { user, status, ready, update } = useUser();
  const [mode, setMode] = useState<Mode>("select");
  const [phase, setPhase] = useState<Phase>("lobby");
  const [searchBand, setSearchBand] = useState(100);
  const [boostActive, setBoostActive] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>("bo3");
  const [armedPowerUps, setArmedPowerUps] = useState<Set<PowerUpId>>(new Set());

  function togglePowerUp(id: PowerUpId) {
    setArmedPowerUps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const [opponent, setOpponent] = useState<SeedUser | null>(null);
  const [oppBreakdown, setOppBreakdown] = useState<EdgeScoreBreakdown | null>(null);
  const [round, setRound] = useState(0);
  const [scores, setScores] = useState<{ me: number; opp: number }[]>([]);
  const [matchResult, setMatchResult] = useState<{
    won: boolean;
    delta: number;
    rounds: { me: number; opp: number }[];
  } | null>(null);
  const searchTimerRef = useRef<number | null>(null);

  // ─── Matchmaking ────────────────────────────────────────────────────
  function startSearch() {
    setPhase("searching");
    setSearchBand(100);
    setRound(0);
    setScores([]);
    setMatchResult(null);

    // Widen band every 1.2s, then "find" opponent at ~3s.
    let band = 100;
    const tick = window.setInterval(() => {
      band = Math.min(800, band + 100);
      setSearchBand(band);
    }, 1200);
    searchTimerRef.current = tick;

    window.setTimeout(() => {
      window.clearInterval(tick);
      const opp = findOpponent(user.elo);
      setOpponent(opp);
      setOppBreakdown(syntheticBreakdownFromElo(opp.elo, opp.edgeScore));
      setPhase("versus");
    }, 2800);
  }

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    };
  }, []);

  function cancelSearch() {
    if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    setPhase("lobby");
  }

  // ─── Round flow ─────────────────────────────────────────────────────
  function startRound(idx: number) {
    setRound(idx);
    setPhase("round");
  }

  useEffect(() => {
    if (phase !== "versus") return;
    const t = window.setTimeout(() => startRound(0), 2200);
    return () => window.clearTimeout(t);
  }, [phase]);

  function evalRound() {
    if (!user.edgeScore || !oppBreakdown) return;
    const k = ROUND_CRITERIA[round].key;
    let me = Math.round(scoreFor(user.edgeScore, k));
    const opp = Math.round(scoreFor(oppBreakdown, k));
    if (boostActive) me = Math.min(100, Math.round(me * 1.1));
    const next = [...scores, { me, opp }];
    setScores(next);

    // Bo3: end early if someone has 2 wins
    const wins = next.reduce(
      (acc, r) => ({
        me: acc.me + (r.me > r.opp ? 1 : 0),
        opp: acc.opp + (r.opp > r.me ? 1 : 0)
      }),
      { me: 0, opp: 0 }
    );

    if (wins.me >= 2 || wins.opp >= 2 || next.length === 3) {
      finishMatch(next, wins.me >= wins.opp);
    } else {
      setPhase("between-rounds");
      window.setTimeout(() => startRound(round + 1), 1800);
    }
  }

  function finishMatch(rounds: { me: number; opp: number }[], won: boolean) {
    if (!opponent) return;
    const isPlacement = user.placementsLeft > 0;
    const delta = practiceMode
      ? 0
      : eloDelta(user.elo, opponent.elo, won ? 1 : 0, isPlacement);

    const record: MatchRecord = {
      id: `${Date.now()}-${opponent.id}`,
      opponentName: opponent.username,
      opponentElo: opponent.elo,
      myScore: rounds.reduce((s, r) => s + (r.me > r.opp ? 1 : 0), 0),
      oppScore: rounds.reduce((s, r) => s + (r.opp > r.me ? 1 : 0), 0),
      won,
      eloDelta: delta,
      playedAt: Date.now(),
      rounds: rounds.map((r, i) => ({
        criterion: ROUND_CRITERIA[i]?.label || "?",
        me: r.me,
        opp: r.opp
      })),
      mode: "bo3",
      practice: practiceMode
    };

    update((prev) =>
      applyMatchResult(prev, {
        won,
        rawEloDelta: delta,
        record,
        practice: practiceMode,
        mode: "bo3"
      })
    );

    // Consume the activated edge boost (if any) — one-shot.
    if (boostActive) {
      update((prev) => ({ edgeBoosts: Math.max(0, prev.edgeBoosts - 1) }));
      setBoostActive(false);
    }

    setMatchResult({ won, delta, rounds });
    setPhase("result");
  }

  // ─── Gates ──────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10">
        <div className="glass h-64 animate-pulse rounded-2xl" />
      </main>
    );
  }

  if (status === "guest" || status === "auth-no-scan") {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
        <Link
          href="/"
          className="label-xs inline-flex items-center gap-2 text-white/40 transition hover:text-white"
        >
          ← Back to Lobby
        </Link>
        <div className="glass mt-8 rounded-2xl px-8 py-12 text-center">
          <p className="label-xs">Locked</p>
          <h2 className="heading-card mt-2 text-2xl">
            {status === "guest" ? "Sign in to enter the Arena" : "Calibrate first"}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/50">
            {status === "guest"
              ? "Ranked matchmaking requires a callsign and an EdgeScore."
              : "Complete a face scan in The Lab before queuing for ranked."}
          </p>
          <Link
            href={status === "guest" ? "/" : "/lab"}
            className="mt-6 inline-block rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30"
          >
            {status === "guest" ? "Back to Lobby →" : "Open The Lab →"}
          </Link>
        </div>
        <Footer />
      </main>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────
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
          <p className="label-xs">1V1 Arena</p>
          <h1 className="heading-card mt-2 text-3xl">Ranked Matchmaking</h1>
        </div>
        {mode !== "select" && (
          <button
            onClick={() => {
              setMode("select");
              setPhase("lobby");
            }}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
          >
            ← Change mode
          </button>
        )}
      </div>

      <div className="mt-8">
        {mode === "select" && (
          <ModeSelect onPick={(m) => setMode(m)} />
        )}

        {mode === "live" && (
          <LiveMatch onClose={() => setMode("select")} />
        )}

        {mode === "quick" && (
        <AnimatePresence mode="wait">
          {phase === "lobby" && (
            <Lobby
              key="lobby"
              onStart={startSearch}
              boostActive={boostActive}
              setBoostActive={setBoostActive}
              practiceMode={practiceMode}
              setPracticeMode={setPracticeMode}
              gameMode={gameMode}
              setGameMode={setGameMode}
              armedPowerUps={armedPowerUps}
              togglePowerUp={togglePowerUp}
            />
          )}
          {phase === "searching" && (
            <Searching key="search" band={searchBand} onCancel={cancelSearch} />
          )}
          {phase === "versus" && opponent && oppBreakdown && (
            <Versus key="vs" opponent={opponent} />
          )}
          {(phase === "round" || phase === "between-rounds") && opponent && oppBreakdown && (
            <Round
              key={`r${round}-${phase}`}
              round={round}
              criterion={ROUND_CRITERIA[round]}
              myScore={Math.round(scoreFor(user.edgeScore!, ROUND_CRITERIA[round].key))}
              oppScore={Math.round(scoreFor(oppBreakdown, ROUND_CRITERIA[round].key))}
              opponent={opponent}
              waiting={phase === "between-rounds"}
              priorScores={scores}
              onComplete={evalRound}
            />
          )}
          {phase === "result" && matchResult && opponent && (
            <Result
              key="result"
              result={matchResult}
              opponent={opponent}
              onAgain={startSearch}
            />
          )}
        </AnimatePresence>
        )}
      </div>

      <Footer />
    </main>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function ModeSelect({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => onPick("live")}
        className="glass glass-hover rounded-2xl p-8 text-left"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inset-0 animate-pulse-dot rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <p className="label-xs text-emerald-300">Live · WebRTC</p>
        </div>
        <h3 className="heading-card text-xl">Live Match</h3>
        <p className="mt-2 text-sm text-white/60">
          Real face-off against another Edgify player. You see each other&apos;s
          camera, the AI scans both faces in real time, and the winner is
          declared at the end.
        </p>
        <p className="mt-4 text-[10px] uppercase tracking-[0.32em] text-white/40">
          Generate code or join one →
        </p>
      </motion.button>

      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        onClick={() => onPick("quick")}
        className="glass glass-hover rounded-2xl p-8 text-left"
      >
        <p className="label-xs">Solo · AI Bot</p>
        <h3 className="heading-card mt-2 text-xl">Quick Match</h3>
        <p className="mt-2 text-sm text-white/60">
          Get matched against an ELO-ranked AI opponent immediately. No friend
          required — best for testing your placement and grinding ELO solo.
        </p>
        <p className="mt-4 text-[10px] uppercase tracking-[0.32em] text-white/40">
          Find Match →
        </p>
      </motion.button>
    </div>
  );
}

function Lobby({
  onStart,
  boostActive,
  setBoostActive,
  practiceMode,
  setPracticeMode,
  gameMode,
  setGameMode,
  armedPowerUps,
  togglePowerUp
}: {
  onStart: () => void;
  boostActive: boolean;
  setBoostActive: (b: boolean) => void;
  practiceMode: boolean;
  setPracticeMode: (b: boolean) => void;
  gameMode: GameMode;
  setGameMode: (m: GameMode) => void;
  armedPowerUps: Set<PowerUpId>;
  togglePowerUp: (id: PowerUpId) => void;
}) {
  const { user } = useUser();
  const rank = rankFromElo(user.elo);
  const modes: { id: GameMode; label: string; sub: string }[] = [
    { id: "bo3", label: "Best of 3", sub: "Standard" },
    { id: "bo5", label: "Best of 5", sub: "Long form (+40% XP)" },
    { id: "sudden-death", label: "Sudden Death", sub: "1 round, all metrics (-40% XP)" },
    { id: "rapid-fire", label: "Rapid Fire", sub: "60s, highest avg" }
  ];

  const powerUpInventory: { id: PowerUpId; count: number }[] = [
    { id: "boost", count: user.edgeBoosts },
    { id: "shield", count: user.powerUps.shield || 0 },
    { id: "mulligan", count: user.powerUps.mulligan || 0 },
    { id: "timeStop", count: user.powerUps.timeStop || 0 },
    { id: "critical", count: user.powerUps.critical || 0 }
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="glass rounded-2xl px-8 py-12 text-center"
    >
      <p className="label-xs text-white/40">Your standing</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-base">
        <span className="font-semibold uppercase tracking-[0.22em] text-white">
          {user.username}
        </span>
        <span className="text-white/20">•</span>
        {user.placementsLeft > 0 ? (
          <span className="text-cyan-300">
            Placement {5 - user.placementsLeft}/5
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.22em]"
            style={{ color: rank.color }}
          >
            <span aria-hidden>{rank.emoji}</span> {rank.label}
          </span>
        )}
        <span className="text-white/20">•</span>
        <span className="font-semibold uppercase tracking-[0.22em] text-cyan-300">
          {user.elo} ELO
        </span>
      </div>
      <p className="mx-auto mt-6 max-w-md text-sm text-white/50">
        Best-of-3 rounds. Each round picks a different criterion (Symmetry,
        Jawline, Overall). Winner is whoever takes 2 rounds.
      </p>

      {/* Game mode selector */}
      <div className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setGameMode(m.id)}
            className={
              "rounded-lg border px-3 py-2 text-[11px] uppercase tracking-[0.18em] transition " +
              (gameMode === m.id
                ? "border-mog-violet/60 bg-mog-violet/15 text-white"
                : "border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20")
            }
          >
            <div>{m.label}</div>
            <div className="mt-0.5 text-[9px] tracking-[0.16em] text-white/40">
              {m.sub}
            </div>
          </button>
        ))}
      </div>

      {/* Power-up arming */}
      <div className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-2">
        {powerUpInventory.map(({ id, count }) => {
          const meta = POWERUP_META[id];
          const armed =
            id === "boost" ? boostActive : armedPowerUps.has(id);
          const ownedHandled = id === "boost" ? user.edgeBoosts > 0 : count > 0;
          return (
            <button
              key={id}
              onClick={() => {
                if (!ownedHandled) return;
                if (id === "boost") setBoostActive(!boostActive);
                else togglePowerUp(id);
              }}
              disabled={!ownedHandled}
              title={meta.description}
              className={
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition " +
                (armed
                  ? "border-mog-pink bg-mog-pink/20 text-white"
                  : ownedHandled
                    ? "border-mog-pink/30 bg-mog-pink/5 text-mog-pink hover:border-mog-pink/60"
                    : "border-white/10 bg-white/[0.02] text-white/30")
              }
            >
              <span className="text-base">{meta.emoji}</span>
              <span>{meta.name}</span>
              <span className="opacity-60">×{count}</span>
            </button>
          );
        })}
      </div>

      {/* Practice toggle */}
      <div className="mx-auto mt-3 flex max-w-sm justify-center">
        <button
          onClick={() => setPracticeMode(!practiceMode)}
          className={
            "rounded-lg border px-4 py-2 text-[11px] uppercase tracking-[0.22em] transition " +
            (practiceMode
              ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
              : "border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20")
          }
          title="No ELO impact, but you still earn token XP"
        >
          {practiceMode ? "Practice ✓" : "Practice Mode"}
        </button>
      </div>

      <button
        onClick={onStart}
        className="mt-5 rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-8 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30"
      >
        Find Match →
      </button>
    </motion.div>
  );
}

function Searching({
  band,
  onCancel
}: {
  band: number;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="glass rounded-2xl px-8 py-14 text-center"
    >
      <div className="mx-auto flex w-fit gap-1.5">
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-mog-violet" />
        <span
          className="h-2 w-2 animate-pulse-dot rounded-full bg-mog-violet"
          style={{ animationDelay: "0.15s" }}
        />
        <span
          className="h-2 w-2 animate-pulse-dot rounded-full bg-mog-violet"
          style={{ animationDelay: "0.3s" }}
        />
      </div>
      <p className="mt-5 text-sm uppercase tracking-[0.32em] text-white/60">
        Searching for opponent…
      </p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-white/30">
        ±{band} ELO band
      </p>
      <button
        onClick={onCancel}
        className="mt-7 rounded-lg border border-white/10 bg-white/[0.02] px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
      >
        Cancel
      </button>
    </motion.div>
  );
}

function Versus({ opponent }: { opponent: SeedUser }) {
  const { user } = useUser();
  const myRank = rankFromElo(user.elo);
  const oppRank = rankFromElo(opponent.elo);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8"
    >
      <PlayerCard
        side="left"
        name={user.username!}
        elo={user.elo}
        rankLabel={myRank.label}
        rankColor={myRank.color}
        rankEmoji={myRank.emoji}
        photoDataUrl={user.faceDataUrl}
      />
      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}
        className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-mog-violet bg-black text-base font-bold tracking-[0.18em] text-mog-violet shadow-glow sm:h-20 sm:w-20 sm:text-xl"
      >
        VS
      </motion.div>
      <PlayerCard
        side="right"
        name={opponent.username}
        elo={opponent.elo}
        rankLabel={oppRank.label}
        rankColor={oppRank.color}
        rankEmoji={oppRank.emoji}
      />
    </motion.div>
  );
}

function PlayerCard({
  side,
  name,
  elo,
  rankLabel,
  rankColor,
  rankEmoji,
  photoDataUrl
}: {
  side: "left" | "right";
  name: string;
  elo: number;
  rankLabel: string;
  rankColor: string;
  rankEmoji: string;
  photoDataUrl?: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -40 : 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass overflow-hidden rounded-2xl"
    >
      <div className="aspect-[4/3] w-full bg-black/40">
        {photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoDataUrl}
            alt=""
            className="h-full w-full -scale-x-100 object-cover"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center text-5xl"
            style={{ color: rankColor }}
          >
            {rankEmoji}
          </div>
        )}
      </div>
      <div className="border-t border-white/[0.04] px-3 py-3 text-center sm:px-4">
        <p className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-white">
          {name}
        </p>
        <p
          className="text-[10px] uppercase tracking-[0.32em]"
          style={{ color: rankColor }}
        >
          {rankLabel}
        </p>
        <p className="mt-1 font-mono text-xs text-cyan-300">{elo} ELO</p>
      </div>
    </motion.div>
  );
}

function Round({
  round,
  criterion,
  myScore,
  oppScore,
  opponent,
  waiting,
  priorScores,
  onComplete
}: {
  round: number;
  criterion: { key: CriterionKey; label: string };
  myScore: number;
  oppScore: number;
  opponent: SeedUser;
  waiting: boolean;
  priorScores: { me: number; opp: number }[];
  onComplete: () => void;
}) {
  const { user } = useUser();
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (waiting) return;
    setReveal(false);
    const t1 = window.setTimeout(() => setReveal(true), 600);
    const t2 = window.setTimeout(onComplete, 3000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, waiting]);

  const wins = priorScores.reduce(
    (acc, r) => ({
      me: acc.me + (r.me > r.opp ? 1 : 0),
      opp: acc.opp + (r.opp > r.me ? 1 : 0)
    }),
    { me: 0, opp: 0 }
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6"
    >
      <div className="text-center">
        <p className="label-xs">Round {round + 1} of 3</p>
        <h2 className="heading-card mt-1 text-2xl">{criterion.label}</h2>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
        <ScoreBar
          side="left"
          name={user.username!}
          score={reveal ? myScore : 0}
          target={myScore}
        />
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black text-[10px] font-semibold tracking-[0.18em] text-white/60">
          {wins.me}–{wins.opp}
        </div>
        <ScoreBar
          side="right"
          name={opponent.username}
          score={reveal ? oppScore : 0}
          target={oppScore}
        />
      </div>

      {reveal && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs uppercase tracking-[0.32em] text-white/50"
        >
          {myScore > oppScore
            ? "Round to you →"
            : myScore < oppScore
              ? "← Round to opponent"
              : "Tie"}
        </motion.p>
      )}
    </motion.div>
  );
}

function ScoreBar({
  side,
  name,
  score,
  target
}: {
  side: "left" | "right";
  name: string;
  score: number;
  target: number;
}) {
  return (
    <div className={side === "right" ? "text-right" : ""}>
      <p className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-white">
        {name}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${target}%` }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="h-full bg-gradient-to-r from-mog-violet to-mog-pink"
          style={
            side === "right"
              ? { marginLeft: "auto", background: "linear-gradient(to left, #d946ef, #7c3aed)" }
              : undefined
          }
        />
      </div>
      <p className="mt-2 font-mono text-xl text-white/90">
        <CountUpInt to={score} />
      </p>
    </div>
  );
}

function CountUpInt({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setN(Math.round(eased * to));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n}</>;
}

function Result({
  result,
  opponent,
  onAgain
}: {
  result: { won: boolean; delta: number; rounds: { me: number; opp: number }[] };
  opponent: SeedUser;
  onAgain: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="glass rounded-2xl px-8 py-12 text-center"
    >
      <motion.p
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="label-xs"
        style={{ color: result.won ? "#34d399" : "#f43f5e" }}
      >
        {result.won ? "Victory" : "Defeat"}
      </motion.p>
      <motion.h2
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 180 }}
        className="heading-card mt-2 text-5xl"
      >
        {result.won ? "MOGGED" : "MOGGED ON"}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-4 text-xs uppercase tracking-[0.32em] text-white/50"
      >
        vs {opponent.username}
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="mt-6 text-3xl font-bold"
        style={{ color: result.delta >= 0 ? "#22d3ee" : "#f43f5e" }}
      >
        {result.delta >= 0 ? "+" : ""}
        {result.delta} ELO
      </motion.p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button
          onClick={onAgain}
          className="rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30"
        >
          Queue Again →
        </button>
        <Link
          href="/profile"
          className="rounded-lg border border-white/10 bg-white/[0.02] px-6 py-3 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
        >
          View History
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-lg border border-white/10 bg-white/[0.02] px-6 py-3 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
        >
          Leaderboard
        </Link>
      </div>
    </motion.div>
  );
}
