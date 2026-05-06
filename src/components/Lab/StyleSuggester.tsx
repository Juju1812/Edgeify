"use client";

import Link from "next/link";
import { useUser } from "@/lib/user-context";
import { isPro } from "@/lib/pro";

type Tip = { title: string; body: string };

/**
 * Pro: deterministic rule-based "style suggestions" derived from the
 * user's EdgeScore breakdown. Picks the 3 weakest dimensions and
 * surfaces a concrete, presentation-focused tip per dimension. No
 * Claude calls — predictable cost, fast load.
 *
 * Free: locked teaser pointing at /pricing.
 */
export function StyleSuggester() {
  const { user } = useUser();
  if (!user.edgeScore) return null;
  const pro = isPro(user);

  if (!pro) {
    return (
      <div className="rounded-2xl border border-edge-coral/25 bg-edge-coral/[0.04] p-4">
        <p className="label-xs text-edge-coral">Pro · style suggestions</p>
        <p className="mt-2 text-xs text-white/60">
          Get 3 personalized presentation tips based on your scan
          (lighting, posture, framing). Algorithm-only — no surprises.
        </p>
        <Link
          href="/pricing"
          className="mt-3 inline-block text-[10px] uppercase tracking-[0.32em] text-edge-coral hover:underline"
        >
          Unlock with Edgify Pro →
        </Link>
      </div>
    );
  }

  const tips = pickTips(user.edgeScore);
  if (tips.length === 0) return null;

  return (
    <div className="rounded-2xl border border-edge-cyan/25 bg-edge-cyan/[0.04] p-4">
      <p className="label-xs text-edge-cyan">Style suggestions</p>
      <p className="mt-1 text-[11px] text-white/45">
        Quick wins from your weakest 3 dimensions. Algorithm-derived,
        no AI calls.
      </p>
      <ul className="mt-3 space-y-3">
        {tips.map((t, i) => (
          <li
            key={i}
            className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-edge-cyan">
              {t.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/75">
              {t.body}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function pickTips(score: {
  symmetry: number;
  jawlineDefinition: number;
  canthalTilt: number;
  cheekboneProm: number;
  goldenRatio: number;
  faceFat: number;
}): Tip[] {
  const dims: { key: string; gap: number; tip: Tip }[] = [
    {
      key: "symmetry",
      gap: 1 - score.symmetry,
      tip: {
        title: "Symmetry",
        body: "Tilt and yaw inflate asymmetry hard. Park your nose dead-center on the camera and keep your shoulders square — even 5° of head turn measurably hits this score."
      }
    },
    {
      key: "jaw",
      gap: 1 - score.jawlineDefinition,
      tip: {
        title: "Jawline",
        body: "Press your tongue to the roof of your mouth and pull your chin slightly back (not down). Side lighting from above the camera defines the gonial angle better than flat front lighting."
      }
    },
    {
      key: "tilt",
      gap: Math.abs(score.canthalTilt - 0.4),
      tip: {
        title: "Canthal tilt",
        body: "Drop your chin a touch — not a full down-tilt — to add positive canthal lift. Keep the camera at or just above eye height; below-eye angles flatten the tilt."
      }
    },
    {
      key: "cheek",
      gap: 1 - score.cheekboneProm,
      tip: {
        title: "Cheekbones",
        body: "Slight smile-of-the-eyes engages the zygomatic. Side-key lighting (3⁄4 angle) carves cheek shadow harder than ring lights."
      }
    },
    {
      key: "ratio",
      gap: 1 - score.goldenRatio,
      tip: {
        title: "Proportions",
        body: "Camera distance matters: phone selfies at <50cm distort upper-third proportions. Step back ~80cm and use the back camera if you can."
      }
    },
    {
      key: "fat",
      gap: score.faceFat,
      tip: {
        title: "Face fullness",
        body: "Submental tissue is the biggest culprit. Slight chin-back, then jaw-forward; press tongue to palate. Front-flat lighting hides definition — angle the light source ~30° above and to the side."
      }
    }
  ];
  return dims.sort((a, b) => b.gap - a.gap).slice(0, 3).map((d) => d.tip);
}
