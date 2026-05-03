"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUser } from "@/lib/user-context";

const STEPS = [
  {
    emoji: "🧪",
    title: "Calibrate your face",
    body: "Head to The Lab and complete one face scan. Your EdgeScore + face data become your default for matchmaking.",
    cta: "Open The Lab",
    href: "/lab"
  },
  {
    emoji: "⚔️",
    title: "Play your first match",
    body: "Quick Match (vs AI) is a no-pressure way to start. Live Match (real opponent) is where the ranked play happens.",
    cta: "Open Arena",
    href: "/arena"
  },
  {
    emoji: "✨",
    title: "Earn XP, level up",
    body: "Every match earns Season XP. Level up to claim Edge Boosts, Shields, and other power-ups.",
    cta: "View Season Pass",
    href: "/season"
  },
  {
    emoji: "🎨",
    title: "Make it yours",
    body: "Tweak your AR mesh color, custom reaction emojis, and country flag in Settings.",
    cta: "Open Settings",
    href: "/settings"
  }
];

export function Tutorial() {
  const { user, status, update } = useUser();
  const [step, setStep] = useState(0);
  if (status === "guest" || user.tutorialCompleted) return null;

  const cur = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[55] flex items-center justify-center px-6"
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <motion.div
          key={step}
          initial={{ y: 20, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="glass relative w-full max-w-md p-7 text-center"
        >
          <p className="label-xs">
            Step {step + 1} of {STEPS.length}
          </p>
          <div className="mt-3 text-6xl">{cur.emoji}</div>
          <h2 className="heading-card mt-3 text-2xl">{cur.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">{cur.body}</p>

          <div className="mt-3 flex justify-center gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={
                  "h-1.5 w-6 rounded-full " +
                  (i <= step ? "bg-mog-violet" : "bg-white/10")
                }
              />
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Link
              href={cur.href}
              onClick={() => update({ tutorialCompleted: true })}
              className="rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30"
            >
              {cur.cta} →
            </Link>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/60 hover:border-white/20 hover:text-white"
                >
                  Back
                </button>
              )}
              {!last && (
                <button
                  onClick={() => setStep(step + 1)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/60 hover:border-white/20 hover:text-white"
                >
                  Next
                </button>
              )}
              <button
                onClick={() => update({ tutorialCompleted: true })}
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/40 hover:text-white/60"
              >
                Skip
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
