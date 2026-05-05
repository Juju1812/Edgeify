"use client";

import { useUser } from "@/lib/user-context";

/**
 * Surfaces a celebratory chip on the home page exactly on the user's
 * 1-month and yearly anniversary of their `authedAt` timestamp.
 * Hidden every other day.
 */
export function AnniversaryCard() {
  const { user, ready } = useUser();
  if (!ready || !user.authedAt) return null;

  const start = new Date(user.authedAt);
  const today = new Date();
  const sameMonthDay =
    start.getUTCMonth() === today.getUTCMonth() &&
    start.getUTCDate() === today.getUTCDate();
  const ms = today.getTime() - start.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));

  let label: string | null = null;
  if (sameMonthDay && start.getUTCFullYear() < today.getUTCFullYear()) {
    const years = today.getUTCFullYear() - start.getUTCFullYear();
    label = `${years} year${years === 1 ? "" : "s"} on Edgify`;
  } else if (days === 30) {
    label = "1 month on Edgify";
  }
  if (!label) return null;

  return (
    <div className="rounded-2xl border border-edge-cyan/25 bg-gradient-to-r from-edge-cyan/[0.06] to-edge-coral/[0.05] px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎉</span>
        <div className="flex-1">
          <p className="label-xs text-edge-cyan">Anniversary</p>
          <p className="mt-1 text-sm text-white/85">
            <span className="font-semibold text-white">{label}.</span>{" "}
            <span className="text-white/55">
              {user.lifetime.matchesPlayed} matches · peak {user.lifetime.peakEloEver} ELO
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
