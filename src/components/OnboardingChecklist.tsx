"use client";

import Link from "next/link";
import { useUser } from "@/lib/user-context";

const STEPS = [
  {
    id: "scan",
    label: "Calibrate your face",
    href: "/lab",
    check: (u: { hasScanned: boolean }) => u.hasScanned
  },
  {
    id: "match",
    label: "Play your first match",
    href: "/arena",
    check: (u: { matchHistory: unknown[] }) => u.matchHistory.length >= 1
  },
  {
    id: "friend",
    label: "Add a friend",
    href: "/friends",
    check: (u: { friends: string[] }) => u.friends.length >= 1
  },
  {
    id: "rank",
    label: "Reach MTN (1000 ELO)",
    href: "/arena",
    check: (u: { elo: number }) => u.elo >= 1000
  }
];

/**
 * Visible only until all 4 steps are done. Helps brand-new players
 * see a clear path forward instead of staring at the home page.
 */
export function OnboardingChecklist() {
  const { user, status } = useUser();
  if (status === "guest") return null;
  const done = STEPS.filter((s) => s.check(user as never)).length;
  if (done === STEPS.length) return null;

  return (
    <div className="rounded-2xl border border-edge-coral/25 bg-edge-coral/[0.04] p-5">
      <div className="flex items-center justify-between">
        <p className="label-xs text-edge-coral">Get started</p>
        <p className="text-[10px] uppercase tracking-[0.32em] text-white/40">
          {done}/{STEPS.length}
        </p>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {STEPS.map((s) => {
          const ok = s.check(user as never);
          return (
            <Link
              key={s.id}
              href={s.href}
              className={
                "group flex items-center gap-2 rounded-xl border p-3 transition " +
                (ok
                  ? "border-emerald-400/30 bg-emerald-500/[0.06]"
                  : "border-white/[0.06] bg-white/[0.015] hover:border-edge-coral/40")
              }
            >
              <span
                className={
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold " +
                  (ok
                    ? "bg-emerald-500/30 text-emerald-200"
                    : "border border-white/15 text-white/40")
                }
              >
                {ok ? "✓" : ""}
              </span>
              <span
                className={
                  "text-[11px] font-semibold uppercase tracking-[0.16em] " +
                  (ok ? "text-white/55 line-through" : "text-white/85")
                }
              >
                {s.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
