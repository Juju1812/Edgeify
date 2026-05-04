"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/user-context";
import {
  isClaimed,
  markClaimed,
  questsForDay,
  type Quest
} from "@/lib/daily-quests";
import { useToast } from "@/lib/toast-context";

/**
 * Daily quests row — 3 objectives that resets at UTC midnight. Players
 * claim rewards once per day per quest. Progress is computed live from
 * the user's current state, so completion is visible immediately.
 */
export function DailyQuests() {
  const { user, status, update } = useUser();
  const { toast } = useToast();
  const [quests, setQuests] = useState<Quest[]>([]);
  // Tick to re-evaluate "claimed" state after a claim.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setQuests(questsForDay());
  }, []);

  if (status === "guest") return null;

  function claim(q: Quest) {
    if (isClaimed(q.id)) return;
    if (q.progress(user) < 1) return;
    if (q.reward.kind === "xp") {
      update((p) => ({ seasonXp: p.seasonXp + q.reward.amount }));
      toast(`+${q.reward.amount} XP claimed`, { kind: "success", emoji: q.emoji });
    } else {
      update((p) => ({ edgeBoosts: p.edgeBoosts + q.reward.amount }));
      toast(`Edge Boost claimed`, { kind: "success", emoji: "⚡" });
    }
    markClaimed(q.id);
    setTick((t) => t + 1);
  }

  return (
    <div className="rounded-2xl border border-edge-cyan/25 bg-edge-cyan/[0.04] p-5">
      <div className="flex items-center justify-between">
        <p className="label-xs text-edge-cyan">Daily Quests</p>
        <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">
          Resets midnight UTC
        </p>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {quests.map((q) => {
          const p = q.progress(user);
          const done = p >= 1;
          const claimed = isClaimed(q.id);
          // Force re-evaluation after a claim
          void tick;
          return (
            <div
              key={q.id}
              className={
                "rounded-xl border p-3 transition " +
                (claimed
                  ? "border-white/[0.04] bg-white/[0.01] opacity-60"
                  : done
                    ? "border-edge-coral/40 bg-edge-coral/[0.06]"
                    : "border-white/[0.06] bg-white/[0.015]")
              }
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{q.emoji}</span>
                <p className="flex-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85">
                  {q.label}
                </p>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.round(p * 100)}%`,
                    background: done
                      ? "linear-gradient(90deg, #22e9ff 0%, #ff5d8f 100%)"
                      : "rgba(255,255,255,0.25)"
                  }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                  {q.reward.kind === "xp"
                    ? `+${q.reward.amount} XP`
                    : `+${q.reward.amount} ⚡`}
                </span>
                {claimed ? (
                  <span className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                    Claimed ✓
                  </span>
                ) : done ? (
                  <button
                    onClick={() => claim(q)}
                    className="rounded-md border border-edge-cyan/50 bg-edge-cyan/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:bg-edge-cyan/25"
                  >
                    Claim
                  </button>
                ) : (
                  <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                    {Math.round(p * 100)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
