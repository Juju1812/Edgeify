"use client";

import Link from "next/link";

/**
 * Limited-time event banner. Surfaces a current themed mode/event with
 * a countdown so users feel urgency to play before it ends.
 *
 * The schedule is hardcoded for now — a future version could pull from
 * KV so the project owner can spin up events without a redeploy.
 */
const EVENTS: Array<{
  id: string;
  startsAt: number;
  endsAt: number;
  title: string;
  hint: string;
  mult: number;
  emoji: string;
}> = [
  // Saturday-Sunday weekend event each week (UTC). Recomputed below to
  // run for the closest upcoming weekend.
];

function thisWeekendUTC(): { start: number; end: number } {
  const now = new Date();
  // Find the Saturday of this week (UTC). Sunday=0, Saturday=6.
  const day = now.getUTCDay();
  // Days until Saturday (could be -1 if today is Sunday, etc).
  const daysToSat = (6 - day + 7) % 7;
  // If we're already in Saturday/Sunday, "this weekend" is today's weekend.
  const startDate = new Date(now);
  if (day === 0) {
    // Sunday — weekend started yesterday.
    startDate.setUTCDate(startDate.getUTCDate() - 1);
  } else if (day === 6) {
    // Saturday — weekend starts today.
  } else {
    startDate.setUTCDate(startDate.getUTCDate() + daysToSat);
  }
  startDate.setUTCHours(0, 0, 0, 0);
  const start = startDate.getTime();
  const end = start + 2 * 24 * 60 * 60 * 1000; // Sat 00:00 UTC + 48h
  return { start, end };
}

export function EventBanner() {
  // Current rotating event — symmetry weekend, 2x XP.
  const { start, end } = thisWeekendUTC();
  const now = Date.now();
  if (now < start || now > end) return null;

  const remaining = end - now;
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const mins = Math.floor((remaining / (60 * 1000)) % 60);
  const label = hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;

  return (
    <Link
      href="/arena"
      className="group relative block overflow-hidden rounded-2xl border border-edge-coral/40 bg-edge-coral/[0.06] p-5 transition hover:border-edge-coral/70"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(255,93,143,0.5) 0%, transparent 70%)"
        }}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-xs text-edge-coral">Limited event · this weekend</p>
          <h3 className="heading-display mt-1 text-2xl">
            ⚡ Symmetry Showdown · 2× XP
          </h3>
          <p className="mt-1 text-xs text-white/60">
            All matches award double XP through Sunday. Symmetry weighting
            bumped — stack wins now.
          </p>
        </div>
        <div className="text-right">
          <p className="stat-mono text-edge-coral">{label}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.32em] text-white/40">
            Tap to play
          </p>
        </div>
      </div>
    </Link>
  );
}

// Re-export so tooling that's looking for templates doesn't fail.
export const _EVENTS = EVENTS;
