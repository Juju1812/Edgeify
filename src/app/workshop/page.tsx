"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Footer } from "@/components/Footer";
import { useUser } from "@/lib/user-context";

/**
 * /workshop — community-style alt scoring formulas. Each preset is a
 * different weighting of the same six metrics; users can preview how
 * their own EdgeScore would change under each formula. Educational —
 * shows that "EdgeScore" is just a weighted sum, not a fixed number.
 */

const PRESETS: Array<{
  id: string;
  name: string;
  author: string;
  desc: string;
  weights: { sym: number; jaw: number; cheek: number; phi: number; tilt: number; lean: number };
}> = [
  {
    id: "default",
    name: "Edgify Default",
    author: "Edgify",
    desc: "The shipping formula. Symmetry- and jaw-weighted with smaller contributions from leanness and proportions.",
    weights: { sym: 0.28, jaw: 0.22, cheek: 0.14, phi: 0.10, tilt: 0.10, lean: 0.16 }
  },
  {
    id: "jawpilled",
    name: "Jaw-pilled",
    author: "MOGGER42",
    desc: "Heavily weighted on jawline and cheekbone definition. Penalizes facial fullness aggressively.",
    weights: { sym: 0.15, jaw: 0.35, cheek: 0.22, phi: 0.05, tilt: 0.03, lean: 0.20 }
  },
  {
    id: "classical",
    name: "Classical",
    author: "VITRUVIAN99",
    desc: "Strict golden-ratio + symmetry. Doesn't care about fullness or eye tilt — just proportions.",
    weights: { sym: 0.40, jaw: 0.10, cheek: 0.10, phi: 0.30, tilt: 0.05, lean: 0.05 }
  },
  {
    id: "anime",
    name: "Anime Eye",
    author: "EBOY77",
    desc: "Eye tilt + symmetry-heavy. Rewards a slight upward canthal tilt and de-emphasizes jaw.",
    weights: { sym: 0.30, jaw: 0.10, cheek: 0.15, phi: 0.10, tilt: 0.25, lean: 0.10 }
  },
  {
    id: "soft",
    name: "Soft Boy",
    author: "MOMMY_BIAS",
    desc: "Inverts the leanness signal — fuller faces score higher. Lower jaw weight.",
    weights: { sym: 0.30, jaw: 0.05, cheek: 0.15, phi: 0.20, tilt: 0.10, lean: -0.20 }
  },
  {
    id: "balanced",
    name: "Equally Yoked",
    author: "STATWANKER",
    desc: "Equal weight across all six. The 'no-opinion' formula — purely an arithmetic mean of normalized criteria.",
    weights: { sym: 0.166, jaw: 0.166, cheek: 0.166, phi: 0.166, tilt: 0.166, lean: 0.166 }
  }
];

export default function WorkshopPage() {
  const { user } = useUser();
  const [selected, setSelected] = useState<string>("default");

  const customScore = useMemo(() => {
    if (!user.edgeScore) return null;
    const preset = PRESETS.find((p) => p.id === selected);
    if (!preset) return null;
    const w = preset.weights;
    const tiltBonus = 1 - Math.abs(user.edgeScore.canthalTilt - 0.4);
    const score =
      w.sym * user.edgeScore.symmetry +
      w.jaw * user.edgeScore.jawlineDefinition +
      w.cheek * user.edgeScore.cheekboneProm +
      w.phi * user.edgeScore.goldenRatio +
      w.tilt * Math.max(0, tiltBonus) +
      w.lean * (1 - user.edgeScore.faceFat);
    return Math.max(0, Math.min(100, Math.round(score * 100)));
  }, [user.edgeScore, selected]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6">
        <p className="label-xs text-edge-cyan">Workshop</p>
        <h1 className="heading-display mt-2 text-4xl">
          Alt scoring <span className="brand-edge">formulas</span>
        </h1>
        <p className="mt-2 text-sm text-white/55">
          The same six metrics, weighted differently. EdgeScore is one of
          many possible scoring formulas — pick a preset to see how your
          number changes.
        </p>
      </div>

      {user.edgeScore && customScore !== null && (
        <div className="mt-6 rounded-2xl border border-edge-cyan/25 bg-edge-cyan/[0.04] p-5 text-center">
          <p className="label-xs">Your score under <span className="text-edge-cyan">{PRESETS.find((p) => p.id === selected)?.name}</span></p>
          <p className="stat-mono mt-2 text-6xl font-bold text-edge-cyan">
            {customScore}
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.32em] text-white/45">
            vs default {Math.round(user.edgeScore.composite)}
          </p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={
              "w-full rounded-2xl border p-5 text-left transition " +
              (selected === p.id
                ? "border-edge-cyan/60 bg-edge-cyan/[0.06]"
                : "border-white/[0.06] bg-white/[0.015] hover:border-white/20")
            }
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="heading-display text-xl">{p.name}</h3>
              <p className="text-[10px] uppercase tracking-[0.32em] text-white/40">
                by {p.author}
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-white/65">
              {p.desc}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(p.weights).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-white/55"
                >
                  {k} {v >= 0 ? "+" : ""}
                  {(v * 100).toFixed(0)}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 text-sm leading-relaxed text-white/65">
        <p>
          <span className="text-white">Why this matters:</span> aesthetic
          scoring is subjective by definition. The formulas above all use the
          same measurements — symmetry, jaw curvature, cheekbone ratio,
          golden-ratio fit, eye tilt, leanness — but weight them differently.
          A score under one formula is meaningless under another. Edgify uses
          the <span className="text-edge-cyan">Edgify Default</span> for ranked
          play; the rest are here to make the subjectivity visible.
        </p>
      </div>

      <Footer />
    </main>
  );
}
