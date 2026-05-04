"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OwnerBadge } from "./OwnerBadge";

type Round = { criterion: string; me: number; opp: number };
type Replay = {
  id: string;
  myName: string;
  oppName: string;
  myScore: number;
  oppScore: number;
  won: boolean;
  eloDelta: number;
  rounds: Round[];
  myFace: string | null;
  oppFace: string | null;
  mode?: string;
  playedAt: number;
};

const ROUND_MS = 2500;

/**
 * Animated playback of a saved match. Each round reveals progressively
 * with score-bar fills, matching the live-match cadence. Includes
 * play / pause / restart controls and a final-result reveal.
 */
export function ReplayTheatre({ replay: r }: { replay: Replay }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timerRef = useRef<number | null>(null);
  const totalSteps = r.rounds.length + 1; // +1 for final result

  useEffect(() => {
    if (!playing) return;
    if (step >= totalSteps - 1) return;
    timerRef.current = window.setTimeout(() => {
      setStep((s) => Math.min(totalSteps - 1, s + 1));
    }, ROUND_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [step, playing, totalSteps]);

  function restart() {
    setStep(0);
    setPlaying(true);
  }

  return (
    <div>
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Edgify
      </Link>

      <div className="mt-6 text-center">
        <p className="label-xs text-edge-cyan">
          Replay Theatre {r.mode && r.mode !== "bo3" ? `· ${r.mode.toUpperCase()}` : ""}
        </p>
        <h1 className="heading-display mt-2 text-4xl">
          {r.myName}
          <OwnerBadge name={r.myName} size="sm" />
          <span className="mx-3 text-white/30">vs</span>
          {r.oppName}
          <OwnerBadge name={r.oppName} size="sm" />
        </h1>
        <p className="mt-1 text-xs text-white/40">
          {new Date(r.playedAt).toLocaleString()}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <FacePanel
          name={r.myName}
          face={r.myFace}
          winner={r.won}
          finalScore={r.myScore}
          show={step === totalSteps - 1}
        />
        <FacePanel
          name={r.oppName}
          face={r.oppFace}
          winner={!r.won}
          finalScore={r.oppScore}
          show={step === totalSteps - 1}
        />
      </div>

      {/* Round-by-round timeline */}
      <div className="mt-6 space-y-3">
        {r.rounds.map((rd, i) => (
          <RoundBar key={i} round={rd} index={i} active={step > i} highlight={step === i + 1} />
        ))}
      </div>

      {/* Final reveal */}
      <AnimatePresence>
        {step === totalSteps - 1 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center"
          >
            <p
              className="text-3xl font-bold"
              style={{ color: r.eloDelta >= 0 ? "#22e9ff" : "#ff5d8f" }}
            >
              {r.eloDelta >= 0 ? "+" : ""}
              {r.eloDelta} ELO
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.32em] text-white/45">
              {r.won ? "Mogged" : "Mogged on"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playback controls */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/65 transition hover:border-edge-cyan/40 hover:text-edge-cyan"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={restart}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/65 transition hover:border-white/20 hover:text-white"
        >
          Restart
        </button>
        <span className="stat-mono text-[10px] uppercase tracking-[0.32em] text-white/35">
          {Math.min(step, r.rounds.length)} / {r.rounds.length}
        </span>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/arena"
          className="rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-cyan/25"
        >
          Play Edgify →
        </Link>
      </div>
    </div>
  );
}

function FacePanel({
  name,
  face,
  winner,
  finalScore,
  show
}: {
  name: string;
  face: string | null;
  winner: boolean;
  finalScore: number;
  show: boolean;
}) {
  return (
    <div
      className={
        "glass overflow-hidden rounded-2xl border-2 transition-all duration-700 " +
        (winner ? "border-emerald-400/50" : "border-rose-400/30") +
        (show ? " scale-100 opacity-100" : " scale-95 opacity-80")
      }
    >
      <div className="aspect-[4/3] bg-black/40">
        {face ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={face}
            alt=""
            className="h-full w-full -scale-x-100 object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl opacity-40">
            ?
          </div>
        )}
      </div>
      <div className="border-t border-white/[0.04] bg-black/50 px-3 py-2 text-center">
        <p className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-white">
          {name}
          <OwnerBadge name={name} size="xs" />
        </p>
        <p
          className="mt-1 text-2xl font-bold"
          style={{ color: winner ? "#34d399" : "#f43f5e" }}
        >
          {finalScore}
        </p>
      </div>
    </div>
  );
}

function RoundBar({
  round,
  index,
  active,
  highlight
}: {
  round: Round;
  index: number;
  active: boolean;
  highlight: boolean;
}) {
  const won = round.me > round.opp;
  const tied = round.me === round.opp;
  const total = round.me + round.opp || 1;
  const myPct = (round.me / total) * 100;

  return (
    <motion.div
      animate={{
        scale: highlight ? 1.02 : 1,
        opacity: active ? 1 : 0.35
      }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/60">
        <span>
          R{index + 1} · {round.criterion}
        </span>
        <span style={{ color: tied ? "#fff" : won ? "#34d399" : "#f43f5e" }}>
          {tied ? "TIED" : won ? "WIN" : "LOSS"}
        </span>
      </div>
      <div className="mt-1 flex h-7 overflow-hidden rounded-md">
        <motion.div
          className="flex items-center justify-end bg-emerald-500/30 pr-2 text-[10px] font-bold text-emerald-100"
          initial={{ width: 0 }}
          animate={{ width: active ? `${myPct}%` : "0%" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {active && round.me}
        </motion.div>
        <motion.div
          className="flex items-center justify-start bg-rose-500/30 pl-2 text-[10px] font-bold text-rose-100"
          initial={{ width: 0 }}
          animate={{ width: active ? `${100 - myPct}%` : "0%" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {active && round.opp}
        </motion.div>
      </div>
    </motion.div>
  );
}
