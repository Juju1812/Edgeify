"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/lib/user-context";

/**
 * On-demand AI coach. Posts the user's recent match history to
 * /api/coach and renders a one-paragraph improvement tip from Claude.
 *
 * Cheap-by-design: uses haiku-4-5, max 400 tokens out, ~1¢ per call.
 */
export function AskCoachButton() {
  const { user } = useUser();
  const [tip, setTip] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function ask() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setTip(null);
    try {
      const summary = {
        elo: user.elo,
        wins: user.wins,
        losses: user.losses,
        edgeScore: user.edgeScore
          ? {
              symmetry: Math.round(user.edgeScore.symmetry * 100),
              jawline: Math.round(user.edgeScore.jawlineDefinition * 100),
              cheekbones: Math.round(user.edgeScore.cheekboneProm * 100),
              proportions: Math.round(user.edgeScore.goldenRatio * 100),
              composite: Math.round(user.edgeScore.composite)
            }
          : undefined,
        matches: user.matchHistory.slice(0, 15).map((m) => ({
          won: m.won,
          myScore: m.myScore,
          oppScore: m.oppScore,
          eloDelta: m.eloDelta,
          rounds: m.rounds
        }))
      };
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summary })
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.message || data.error || "Coach unavailable.");
      } else {
        setTip(data.tip);
      }
    } catch (e) {
      setErr((e as Error).message || "Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-edge-cyan/25 bg-edge-cyan/[0.04] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label-xs text-edge-cyan">Coach AI</p>
          <p className="mt-1 text-sm text-white/55">
            One paragraph of feedback based on your recent matches.
          </p>
        </div>
        <button
          onClick={ask}
          disabled={busy || user.matchHistory.length < 3}
          className="shrink-0 rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-cyan hover:bg-edge-cyan/25 disabled:opacity-40"
        >
          {busy ? "Thinking…" : tip ? "Ask again" : "Ask coach"}
        </button>
      </div>
      <AnimatePresence>
        {(tip || err) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-edge-cyan/15 pt-4">
              {err ? (
                <p className="text-sm text-rose-300">{err}</p>
              ) : (
                <p className="text-sm leading-relaxed text-white/80">{tip}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {user.matchHistory.length < 3 && (
        <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/30">
          Need at least 3 matches before the coach has data
        </p>
      )}
    </div>
  );
}
