"use client";

import { useState } from "react";

type Q = {
  prompt: string;
  a: string;
  b: string;
  /** Which answer the EdgeScore algorithm tends to prefer. Used to
   *  build a personalized "your eye matches the algorithm 2/3 times"
   *  line at the end. */
  algoPicks: "a" | "b";
};

const QUESTIONS: Q[] = [
  {
    prompt: "Which jaw reads sharper to you in a face-off?",
    a: "Sharp angles, slim chin",
    b: "Wider mandible, blunt chin",
    algoPicks: "a"
  },
  {
    prompt: "Which under-eye area scans better in a clip?",
    a: "Hollow with sharp orbital bone",
    b: "Smooth and full",
    algoPicks: "a"
  },
  {
    prompt: "Which face proportion do you trust on camera?",
    a: "Tall + narrow",
    b: "Square + balanced",
    algoPicks: "b"
  }
];

/**
 * 3-question perception calibration — shown once on the SavedScan
 * view. Compares the user's gut picks against what the EdgeScore
 * algorithm tends to weight. Result is informational, not stored,
 * and not used to bias future scoring (we don't want a personal
 * preference loop).
 */
export function SkillCalibration() {
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<("a" | "b")[]>([]);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (typeof window !== "undefined" && localStorage.getItem("edgify:skillCal:v1")) {
    return null;
  }

  function pick(c: "a" | "b") {
    const next = [...picks, c];
    setPicks(next);
    if (step + 1 >= QUESTIONS.length) {
      setDone(true);
      try {
        localStorage.setItem("edgify:skillCal:v1", "1");
      } catch {
        /* ignore */
      }
    } else {
      setStep(step + 1);
    }
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem("edgify:skillCal:v1", "1");
    } catch {
      /* ignore */
    }
  }

  if (done) {
    const matches = QUESTIONS.reduce(
      (acc, q, i) => acc + (picks[i] === q.algoPicks ? 1 : 0),
      0
    );
    const summary =
      matches >= 3
        ? "Your eye matches the algorithm. Trust your reads."
        : matches === 2
          ? "Solid alignment — your gut picks track the metric."
          : matches === 1
            ? "Your taste leans contrarian. Watch your replays carefully."
            : "Big gap between your eye and the metric. Replays will help.";
    return (
      <div className="rounded-2xl border border-edge-cyan/25 bg-edge-cyan/[0.04] p-5">
        <div className="flex items-center justify-between">
          <p className="label-xs text-edge-cyan">Calibration</p>
          <button
            onClick={dismiss}
            className="text-[10px] uppercase tracking-[0.22em] text-white/35 hover:text-white"
          >
            Dismiss
          </button>
        </div>
        <p className="mt-2 stat-mono text-2xl font-bold text-white">
          {matches} / {QUESTIONS.length}{" "}
          <span className="text-sm font-normal text-white/55">match</span>
        </p>
        <p className="mt-2 text-sm text-white/65">{summary}</p>
      </div>
    );
  }

  const q = QUESTIONS[step];
  return (
    <div className="rounded-2xl border border-edge-cyan/25 bg-edge-cyan/[0.04] p-5">
      <div className="flex items-center justify-between">
        <p className="label-xs text-edge-cyan">
          Calibration · {step + 1} of {QUESTIONS.length}
        </p>
        <button
          onClick={dismiss}
          className="text-[10px] uppercase tracking-[0.22em] text-white/35 hover:text-white"
        >
          Skip
        </button>
      </div>
      <p className="mt-2 text-sm text-white/85">{q.prompt}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          onClick={() => pick("a")}
          className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left text-xs text-white/80 transition hover:border-edge-cyan/40 hover:bg-edge-cyan/[0.06] hover:text-white"
        >
          {q.a}
        </button>
        <button
          onClick={() => pick("b")}
          className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left text-xs text-white/80 transition hover:border-edge-cyan/40 hover:bg-edge-cyan/[0.06] hover:text-white"
        >
          {q.b}
        </button>
      </div>
    </div>
  );
}
