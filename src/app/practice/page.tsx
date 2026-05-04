"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Footer } from "@/components/Footer";
import { useUser } from "@/lib/user-context";
import type { EdgeScoreBreakdown } from "@/lib/types";

const CRITERIA: Array<{
  key: keyof EdgeScoreBreakdown;
  label: string;
  weight: number;
  desc: string;
  tip: string;
}> = [
  {
    key: "symmetry",
    label: "Symmetry",
    weight: 0.28,
    desc: "Distance between mirrored landmark pairs about the nose-ridge axis.",
    tip: "Centered head + neutral expression. Tilt or smile asymmetry hurts here."
  },
  {
    key: "jawlineDefinition",
    label: "Jawline",
    weight: 0.22,
    desc: "Curvature at the lower-jaw chain (points 5–11). Sharper turns score higher.",
    tip: "Slightly downward chin angle exposes more jaw definition."
  },
  {
    key: "cheekboneProm",
    label: "Cheekbones",
    weight: 0.14,
    desc: "Zygomatic width vs gonial width. Wider cheekbone-to-jaw ratio = higher.",
    tip: "Frontal lighting from above brings out cheekbone highlights."
  },
  {
    key: "goldenRatio",
    label: "Proportions",
    weight: 0.10,
    desc: "Three classical thirds + lower-third split + face-to-mouth phi check.",
    tip: "Camera at eye-level, not too high or low, keeps proportions natural."
  },
  {
    key: "canthalTilt",
    label: "Eye tilt",
    weight: 0.10,
    desc: "Inner-to-outer eye-corner angle. Slight positive tilt (~5°) is ideal.",
    tip: "Direct gaze into the lens, no squinting."
  },
  {
    key: "faceFat",
    label: "Leanness",
    weight: 0.16,
    desc: "Taper, aspect ratio, and chin sharpness. Inverted (lower = better here).",
    tip: "Hydration + good lighting reduces visible facial puffiness."
  }
];

/**
 * /practice — solo training mode. Shows your current EdgeScore broken
 * down by criterion with the formula behind each metric and tips for
 * how to improve at THAT specific signal. No ELO impact, no opponent.
 */
export default function PracticePage() {
  const { user, status } = useUser();

  const score = user.edgeScore;

  if (status === "guest" || status === "auth-no-scan") {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 pt-10 pb-16">
        <Link
          href="/"
          className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
        >
          ← Back to Lobby
        </Link>
        <div className="glass mt-8 rounded-2xl px-8 py-12 text-center">
          <p className="label-xs">Locked</p>
          <h2 className="heading-display mt-2 text-2xl">Calibrate first</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-white/50">
            Practice mode dissects your current EdgeScore. Run a scan in The
            Lab first.
          </p>
          <Link
            href="/lab"
            className="mt-5 inline-block rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-cyan/25"
          >
            Open Lab →
          </Link>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6">
        <p className="label-xs text-edge-cyan">Practice</p>
        <h1 className="heading-display mt-2 text-4xl">
          Train your <span className="brand-edge">edge</span>
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Per-criterion breakdown of your current EdgeScore with what each
          metric measures and how to score higher. No ELO impact.
        </p>
      </div>

      {score && (
        <div className="mt-6 rounded-2xl border border-edge-cyan/25 bg-edge-cyan/[0.04] p-5">
          <p className="label-xs">Current composite</p>
          <p className="mt-1 stat-mono text-5xl text-edge-cyan">
            {Math.round(score.composite)}
          </p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {CRITERIA.map((c) => {
          const raw = score?.[c.key] ?? 0;
          const norm =
            c.key === "canthalTilt"
              ? Math.max(0, 1 - Math.abs((raw as number) - 0.4))
              : c.key === "faceFat"
                ? Math.max(0, 1 - (raw as number))
                : Math.max(0, Math.min(1, raw as number));
          return <CriterionCard key={c.key} c={c} norm={norm} raw={raw as number} />;
        })}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/lab"
          className="rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-cyan/25"
        >
          Re-scan →
        </Link>
        <Link
          href="/arena"
          className="rounded-lg border border-white/10 bg-white/[0.02] px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/65 transition hover:border-white/25 hover:text-white"
        >
          Live match
        </Link>
      </div>

      <Footer />
    </main>
  );
}

function CriterionCard({
  c,
  norm,
  raw
}: {
  c: (typeof CRITERIA)[number];
  norm: number;
  raw: number;
}) {
  const pct = Math.round(norm * 100);
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="heading-display text-xl">{c.label}</h3>
        <p className="stat-mono text-2xl text-edge-cyan">{pct}</p>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-[0.32em] text-white/40">
        Weight {Math.round(c.weight * 100)}% ·{" "}
        {c.key === "canthalTilt" ? `${(raw * 12).toFixed(1)}°` : raw.toFixed(2)} raw
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #22e9ff 0%, #ff5d8f 100%)"
          }}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/65">{c.desc}</p>
      <div className="mt-3 rounded-lg border border-edge-coral/20 bg-edge-coral/[0.04] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-edge-coral">
          Coach tip
        </p>
        <p className="mt-1 text-xs leading-relaxed text-white/75">{c.tip}</p>
      </div>
    </div>
  );
}
