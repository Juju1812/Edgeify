"use client";

import { useEffect, useState } from "react";

type Poll = {
  id: string;
  question: string;
  yesLabel: string;
  noLabel: string;
};

/**
 * Rotating one-tap polls — one per day, picked by date. We don't run
 * a real server-side tally yet (TODO: KV-backed counter); for now we
 * synthesize a plausible "% of players agree" so the result reveal
 * feels alive. Once daily traffic warrants it we'll back this with
 * real counts.
 */
const POLLS: Poll[] = [
  {
    id: "jaw-vs-eyes",
    question: "Jawline or eye area — which matters more in a face-off?",
    yesLabel: "Jawline",
    noLabel: "Eye area"
  },
  {
    id: "lighting",
    question: "Should ranked matches require studio-lit conditions?",
    yesLabel: "Yes, level the field",
    noLabel: "No, real lighting only"
  },
  {
    id: "facegym",
    question: "Does mewing actually move your jaw line?",
    yesLabel: "Believer",
    noLabel: "Cope"
  },
  {
    id: "facial-hair",
    question: "Stubble: defines the jaw, or covers it up?",
    yesLabel: "Defines",
    noLabel: "Covers"
  },
  {
    id: "score-honesty",
    question: "Trust the EdgeScore over what your friends tell you?",
    yesLabel: "Trust the score",
    noLabel: "Friends know best"
  },
  {
    id: "filters",
    question: "Beauty filters in ranked: ban or allow?",
    yesLabel: "Ban them",
    noLabel: "Allow them"
  },
  {
    id: "bo3-vs-bo5",
    question: "Best-of-3 or best-of-5 for ranked play?",
    yesLabel: "Bo3 — quick",
    noLabel: "Bo5 — fair"
  }
];

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function pollForToday(): Poll {
  const day = new Date();
  const dayNum = Math.floor(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) /
      86400000
  );
  return POLLS[dayNum % POLLS.length];
}

const STORAGE_KEY = "edgify:poll:v1";

export function DailyPoll() {
  const poll = pollForToday();
  const key = todayKey();
  const [vote, setVote] = useState<"yes" | "no" | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { key: string; vote: "yes" | "no" };
        if (parsed.key === key) setVote(parsed.vote);
      }
    } catch {
      /* ignore */
    }
  }, [key]);

  function cast(v: "yes" | "no") {
    setVote(v);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, vote: v }));
    } catch {
      /* ignore */
    }
  }

  // Synthesized but stable percentage seeded by poll.id so it doesn't
  // jitter on re-render. 52..68% range — keeps it interesting either way.
  const yesPct = (() => {
    let h = 0;
    for (let i = 0; i < poll.id.length; i++) h = (h * 31 + poll.id.charCodeAt(i)) | 0;
    return 52 + (Math.abs(h) % 17);
  })();
  const noPct = 100 - yesPct;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
      <p className="label-xs text-white/45">Daily poll</p>
      <p className="mt-2 text-sm font-medium text-white/85">{poll.question}</p>
      {vote === null ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => cast("yes")}
            className="rounded-lg border border-edge-cyan/40 bg-edge-cyan/[0.08] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:border-edge-cyan/70 hover:bg-edge-cyan/[0.16]"
          >
            {poll.yesLabel}
          </button>
          <button
            onClick={() => cast("no")}
            className="rounded-lg border border-edge-coral/40 bg-edge-coral/[0.08] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-edge-coral transition hover:border-edge-coral/70 hover:bg-edge-coral/[0.16]"
          >
            {poll.noLabel}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <PollRow
            label={poll.yesLabel}
            pct={yesPct}
            mine={vote === "yes"}
            color="cyan"
          />
          <PollRow
            label={poll.noLabel}
            pct={noPct}
            mine={vote === "no"}
            color="coral"
          />
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/30">
            Your vote · new poll daily
          </p>
        </div>
      )}
    </div>
  );
}

function PollRow({
  label,
  pct,
  mine,
  color
}: {
  label: string;
  pct: number;
  mine: boolean;
  color: "cyan" | "coral";
}) {
  const fill =
    color === "cyan"
      ? "bg-edge-cyan/30"
      : "bg-edge-coral/30";
  const text =
    color === "cyan"
      ? "text-edge-cyan"
      : "text-edge-coral";
  return (
    <div
      className={
        "relative overflow-hidden rounded-lg border px-3 py-2 " +
        (mine
          ? color === "cyan"
            ? "border-edge-cyan/60"
            : "border-edge-coral/60"
          : "border-white/10")
      }
    >
      <div
        className={`absolute inset-y-0 left-0 ${fill}`}
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex items-center justify-between">
        <span className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${mine ? text : "text-white/75"}`}>
          {label} {mine && "✓"}
        </span>
        <span className="stat-mono text-[12px] font-bold text-white">
          {pct}%
        </span>
      </div>
    </div>
  );
}
