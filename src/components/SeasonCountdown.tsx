"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { currentSeason } from "@/lib/season";

/**
 * Pinned banner that appears once the active season has <= 7 days
 * remaining. Hidden the rest of the time. Drives a final-week push
 * to the season pass and reminds players the soft ELO reset is
 * coming.
 */
export function SeasonCountdown() {
  const [now, setNow] = useState<number>(0);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  if (!now) return null;
  const season = currentSeason();
  const msLeft = season.endsAt - now;
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  if (daysLeft > 7 || daysLeft < 0) return null;

  const hoursLeft = Math.floor((msLeft / (60 * 60 * 1000)) % 24);

  return (
    <Link
      href="/season"
      className="block rounded-2xl border border-edge-coral/30 bg-edge-coral/[0.04] px-5 py-4 transition hover:border-edge-coral/60 hover:bg-edge-coral/[0.08]"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">⏳</span>
        <div className="flex-1">
          <p className="label-xs text-edge-coral">Season {season.number} ends soon</p>
          <p className="mt-1 text-sm text-white/85">
            <span className="stat-mono font-bold text-white">
              {daysLeft}d {hoursLeft}h
            </span>{" "}
            left to claim level rewards. ELO soft-resets at rollover.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.32em] text-white/45">
          View →
        </span>
      </div>
    </Link>
  );
}
