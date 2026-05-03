"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { EdgeScoreBreakdown } from "@/lib/types";

export function ScoreReveal({
  score,
  faceDataUrl,
  onContinue
}: {
  score: EdgeScoreBreakdown;
  faceDataUrl: string;
  onContinue: () => void;
}) {
  const composite = Math.round(score.composite);

  const rows: { label: string; value: number; suffix?: string; min?: number; max?: number }[] = [
    { label: "Symmetry", value: score.symmetry * 100, suffix: "%" },
    { label: "Jawline", value: score.jawlineDefinition * 100, suffix: "%" },
    {
      label: "Canthal tilt",
      value: score.canthalTilt * 12,
      suffix: "°",
      min: -12,
      max: 12
    },
    { label: "Cheekbones", value: score.cheekboneProm * 100, suffix: "%" },
    { label: "Golden ratio", value: score.goldenRatio * 100, suffix: "%" }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="grid gap-6 md:grid-cols-[260px_1fr]"
    >
      <div className="glass overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={faceDataUrl}
          alt="Your scan"
          className="aspect-[4/3] w-full -scale-x-100 object-cover"
        />
        <div className="border-t border-white/[0.04] bg-black/40 px-4 py-3 text-center">
          <p className="label-xs text-white/40">EdgeScore</p>
          <CountUp to={composite} className="text-4xl font-bold tracking-wider text-white" />
          <p className="text-[10px] uppercase tracking-[0.32em] text-white/30">
            / 100
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="label-xs">Breakdown</p>
          <h2 className="heading-card mt-1 text-2xl">Geometric profile</h2>
        </div>

        <div className="space-y-3">
          {rows.map((r, i) => (
            <Bar key={r.label} {...r} delay={0.1 + i * 0.08} />
          ))}
        </div>

        <p className="pt-2 text-[10px] leading-relaxed text-white/40">
          Reminder: this is an entertainment metric. It measures landmark
          geometry — symmetry, ratios, angles — not attractiveness.
        </p>

        <button
          onClick={onContinue}
          className="mt-4 w-full rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30"
        >
          Save scan & continue →
        </button>
      </div>
    </motion.div>
  );
}

function Bar({
  label,
  value,
  suffix = "",
  min = 0,
  max = 100,
  delay = 0
}: {
  label: string;
  value: number;
  suffix?: string;
  min?: number;
  max?: number;
  delay?: number;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const display =
    suffix === "°" ? `${value > 0 ? "+" : ""}${value.toFixed(1)}${suffix}` : `${Math.round(value)}${suffix}`;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/60">
        <span>{label}</span>
        <span className="font-mono text-white/90">{display}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
          className="h-full bg-gradient-to-r from-mog-violet to-mog-pink"
        />
      </div>
    </div>
  );
}

function CountUp({
  to,
  className,
  duration = 1200
}: {
  to: number;
  className?: string;
  duration?: number;
}) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <NumberTween to={to} duration={duration} />
    </motion.span>
  );
}

function NumberTween({ to, duration }: { to: number; duration: number }) {
  return <CountInner to={to} duration={duration} />;
}

function CountInner({ to, duration }: { to: number; duration: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - k, 3);
      setN(Math.round(eased * to));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{n}</>;
}
