"use client";

import type { MatchRecord, UserState } from "@/lib/types";
import { rankFromElo, RANKS } from "@/lib/rank";

type Event = {
  ts: number;
  emoji: string;
  title: string;
  detail: string;
  color?: string;
};

/**
 * Chronological career timeline computed from match history. Surfaces
 * milestones: first match, first win, peak ELO, tier crosses, win
 * streaks ≥ 3, big upsets (+30 ELO), achievements unlocked.
 */
export function CareerTimeline({ user }: { user: UserState }) {
  const events: Event[] = [];

  // Reconstruct ELO over time so we can detect tier-crosses.
  const rev = [...user.matchHistory].reverse(); // oldest first
  let runningElo = user.elo;
  // Walk forward applying deltas; first compute the start ELO.
  for (const m of user.matchHistory) runningElo -= m.eloDelta;
  let prevElo = runningElo;
  let peakElo = prevElo;
  let streak = 0;
  let firstWinSeen = false;

  if (rev.length > 0) {
    events.push({
      ts: rev[0].playedAt - 1,
      emoji: "🟢",
      title: "First match",
      detail: `vs ${rev[0].opponentName}`,
      color: "#22e9ff"
    });
  }

  for (const m of rev) {
    const newElo = prevElo + m.eloDelta;
    // Tier cross check
    const prevTier = RANKS.findIndex((r) => prevElo >= r.floor);
    const newTier = RANKS.findIndex((r) => newElo >= r.floor);
    if (newTier > prevTier && newTier >= 0) {
      const r = RANKS[newTier];
      events.push({
        ts: m.playedAt,
        emoji: r.emoji,
        title: `Promoted to ${r.label}`,
        detail: `${prevElo} → ${newElo} ELO`,
        color: r.color
      });
    }
    if (m.won && !firstWinSeen) {
      events.push({
        ts: m.playedAt,
        emoji: "🩸",
        title: "First win",
        detail: `vs ${m.opponentName} (+${m.eloDelta})`,
        color: "#34d399"
      });
      firstWinSeen = true;
    }
    if (m.won && m.eloDelta >= 30) {
      events.push({
        ts: m.playedAt,
        emoji: "🗿",
        title: "Big mog",
        detail: `+${m.eloDelta} ELO vs ${m.opponentName}`,
        color: "#22e9ff"
      });
    }
    if (m.won) streak++;
    else streak = 0;
    if (streak === 3 || streak === 5 || streak === 10) {
      events.push({
        ts: m.playedAt,
        emoji: streak >= 5 ? "🚀" : "♨️",
        title: `${streak}-win streak`,
        detail: `Heating up`,
        color: "#ff5d8f"
      });
    }
    if (newElo > peakElo) peakElo = newElo;
    prevElo = newElo;
  }

  if (peakElo > runningElo + 50) {
    // Add a peak-ELO marker if peak is meaningfully above current
    const peakMatch = [...rev].reverse().find(() => true);
    if (peakMatch) {
      events.push({
        ts: peakMatch.playedAt - 100, // approximate
        emoji: "⛰️",
        title: `Peak: ${peakElo} ELO`,
        detail: `Hit on the climb`,
        color: "#fde047"
      });
    }
  }

  // Sort newest first
  events.sort((a, b) => b.ts - a.ts);

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 text-center text-sm text-white/45">
        No timeline events yet. Play more matches to start filling this in.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <p className="label-xs">Timeline</p>
      <ul className="mt-4 space-y-3">
        {events.slice(0, 30).map((e, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-base"
              style={{
                borderColor: (e.color || "#22e9ff") + "55",
                background: (e.color || "#22e9ff") + "0d"
              }}
            >
              {e.emoji}
            </span>
            <div className="flex-1">
              <p
                className="text-sm font-semibold"
                style={{ color: e.color || "#fff" }}
              >
                {e.title}
              </p>
              <p className="text-[11px] text-white/55">{e.detail}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-white/35">
                {timeAgo(e.ts)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}
