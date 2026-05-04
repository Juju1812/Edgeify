"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Confetti } from "./Confetti";
import { rankFromElo, RANKS } from "@/lib/rank";
import { playSfx } from "@/lib/audio";
import { useUser } from "@/lib/user-context";

const STORAGE_KEY = "edgify:lastSeenTier:v1";

/**
 * Watches the user's ELO across the tier table and fires a celebration
 * modal the first time they cross into a new tier. Stored locally so
 * we don't refire on reload.
 */
export function RankUpModal() {
  const { user, status } = useUser();
  const [showFor, setShowFor] = useState<{
    label: string;
    color: string;
    emoji: string;
  } | null>(null);
  const ignoreInitial = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status !== "ranked") return;
    const currentTierIdx = RANKS.findIndex((r, i) => {
      const next = RANKS[i + 1];
      return user.elo >= r.floor && (!next || user.elo < next.floor);
    });
    if (currentTierIdx === -1) return;

    const previouslySeen = parseInt(
      window.localStorage.getItem(STORAGE_KEY) || "-1",
      10
    );

    // First load — don't celebrate the user's existing tier; just record it.
    if (!ignoreInitial.current) {
      ignoreInitial.current = true;
      if (previouslySeen !== currentTierIdx) {
        window.localStorage.setItem(STORAGE_KEY, String(currentTierIdx));
      }
      return;
    }

    if (previouslySeen >= 0 && currentTierIdx > previouslySeen) {
      const r = RANKS[currentTierIdx];
      setShowFor({ label: r.label, color: r.color, emoji: r.emoji });
      playSfx("win");
      window.localStorage.setItem(STORAGE_KEY, String(currentTierIdx));
    } else if (currentTierIdx !== previouslySeen) {
      // Demoted or first record — silently update.
      window.localStorage.setItem(STORAGE_KEY, String(currentTierIdx));
    }
  }, [user.elo, status]);

  return (
    <AnimatePresence>
      {showFor && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-6"
        >
          <Confetti trigger={1} />
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowFor(null)}
          />
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="glass-featured relative w-full max-w-md rounded-3xl px-8 py-10 text-center"
          >
            <p
              className="label-xs"
              style={{ color: showFor.color }}
            >
              Promotion
            </p>
            <div className="mt-3 text-7xl">{showFor.emoji}</div>
            <h2
              className="heading-display mt-4 text-4xl"
              style={{ color: showFor.color }}
            >
              {showFor.label}
            </h2>
            <p className="mt-3 text-sm text-white/60">
              You crossed into a new tier. Stay on the climb.
            </p>
            <button
              onClick={() => setShowFor(null)}
              className="mt-6 rounded-xl border border-edge-cyan/50 bg-edge-cyan/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-cyan hover:bg-edge-cyan/25"
            >
              Continue →
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Inline widget that surfaces an active promotion series. Shows
 * wins/losses needed and the target tier. Renders nothing if no
 * series is active.
 */
export function PromoSeriesWidget() {
  const { user, status } = useUser();
  if (status !== "ranked" || !user.promo) return null;
  const tier = RANKS.find((r) => r.floor === user.promo!.toTier);
  if (!tier) return null;
  const winsLeft = Math.max(0, 3 - user.promo.wins);
  const lossesAllowed = Math.max(0, 3 - user.promo.losses);

  return (
    <div className="rounded-2xl border border-edge-coral/30 bg-edge-coral/[0.04] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-xs text-edge-coral">Promotion Series</p>
          <p className="mt-1 text-sm text-white/70">
            Win <span className="font-semibold text-white">{winsLeft}</span>{" "}
            more before <span className="font-semibold text-white">{lossesAllowed}</span>{" "}
            losses to enter{" "}
            <span style={{ color: tier.color }} className="font-semibold">
              {tier.emoji} {tier.label}
            </span>
            .
          </p>
        </div>
        <div className="stat-mono text-right">
          <p className="text-2xl text-emerald-300">{user.promo.wins}</p>
          <p className="text-[10px] uppercase tracking-[0.32em] text-white/40">
            W
          </p>
        </div>
        <div className="stat-mono text-right">
          <p className="text-2xl text-rose-300">{user.promo.losses}</p>
          <p className="text-[10px] uppercase tracking-[0.32em] text-white/40">
            L
          </p>
        </div>
      </div>
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="bg-emerald-400/70"
          style={{ width: `${(user.promo.wins / 3) * 100}%` }}
        />
        <div
          className="bg-rose-400/60"
          style={{ width: `${(user.promo.losses / 3) * 100}%` }}
        />
      </div>
    </div>
  );
}
