"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/lib/toast-context";
import { dayOfYearUtc } from "@/lib/season";

const STORAGE_KEY = "edgify:spin:lastClaim:v1";
type SpinReward = {
  label: string;
  weight: number;
  kind: "xp" | "boost";
  amount: number;
};
const REWARDS: SpinReward[] = [
  { label: "+15 XP", weight: 30, kind: "xp", amount: 15 },
  { label: "+25 XP", weight: 25, kind: "xp", amount: 25 },
  { label: "+50 XP", weight: 18, kind: "xp", amount: 50 },
  { label: "+100 XP", weight: 10, kind: "xp", amount: 100 },
  { label: "Edge Boost ⚡", weight: 8, kind: "boost", amount: 1 },
  { label: "+200 XP", weight: 5, kind: "xp", amount: 200 },
  { label: "JACKPOT 500 XP", weight: 4, kind: "xp", amount: 500 }
];

/**
 * Daily login bonus mini-spinner. Available once per UTC day. The
 * weighted random reward keeps low-value outcomes common but offers
 * a ~5% jackpot to keep returning players engaged.
 */
export function DailyLoginSpinner() {
  const { update, status } = useUser();
  const { toast } = useToast();
  const [available, setAvailable] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const last = window.localStorage.getItem(STORAGE_KEY);
    const today = String(dayOfYearUtc());
    setAvailable(last !== today);
  }, []);

  if (status === "guest") return null;
  if (!available) return null;

  function spin() {
    if (spinning) return;
    setSpinning(true);
    const total = REWARDS.reduce((s, r) => s + r.weight, 0);
    const roll = Math.random() * total;
    let acc = 0;
    let pick = REWARDS[0];
    for (const r of REWARDS) {
      acc += r.weight;
      if (roll < acc) {
        pick = r;
        break;
      }
    }
    // Fake spin animation duration
    window.setTimeout(() => {
      if (pick.kind === "xp") {
        update((p) => ({ seasonXp: p.seasonXp + pick.amount }));
      } else {
        update((p) => ({ edgeBoosts: p.edgeBoosts + pick.amount }));
      }
      window.localStorage.setItem(STORAGE_KEY, String(dayOfYearUtc()));
      setResult(pick.label);
      setAvailable(false);
      setSpinning(false);
      toast(`Daily spin: ${pick.label}`, {
        kind: "success",
        emoji: "🎰",
        ttl: 4000
      });
    }, 1200);
  }

  return (
    <div className="rounded-2xl border border-edge-coral/30 bg-edge-coral/[0.06] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <motion.span
            animate={spinning ? { rotate: 360 * 6 } : { rotate: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-3xl"
          >
            🎰
          </motion.span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-edge-coral">
              Daily Spin
            </p>
            <p className="mt-0.5 text-xs text-white/55">
              {result
                ? `Today: ${result}. See you tomorrow.`
                : "One free spin — XP, boosts, or jackpot."}
            </p>
          </div>
        </div>
        {!result && (
          <button
            onClick={spin}
            disabled={spinning}
            className="shrink-0 rounded-lg border border-edge-coral/50 bg-edge-coral/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-coral hover:bg-edge-coral/25 disabled:opacity-50"
          >
            {spinning ? "Spinning…" : "Spin →"}
          </button>
        )}
      </div>
    </div>
  );
}
