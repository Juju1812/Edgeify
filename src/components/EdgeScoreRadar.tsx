"use client";

import type { EdgeScoreBreakdown } from "@/lib/types";

const AXES: { key: keyof EdgeScoreBreakdown; label: string }[] = [
  { key: "symmetry", label: "Symmetry" },
  { key: "jawlineDefinition", label: "Jawline" },
  { key: "cheekboneProm", label: "Cheekbones" },
  { key: "goldenRatio", label: "Proportions" },
  { key: "canthalTilt", label: "Eye Tilt" },
  { key: "faceFat", label: "Leanness" }
];

const SIZE = 280;
const CENTER = SIZE / 2;
const MAX_R = SIZE / 2 - 30;

/**
 * 6-axis radar chart of the user's EdgeScore breakdown. Pure SVG —
 * no charting dep. Each axis is normalized to 0..1; canthalTilt and
 * faceFat are inverted so "higher is better" applies uniformly.
 */
export function EdgeScoreRadar({ score }: { score: EdgeScoreBreakdown }) {
  const values = AXES.map((a) => normalize(a.key, score[a.key]));

  // Compute polygon points
  const polyPoints = values.map((v, i) => pointAt(i, v)).join(" ");

  // Background rings at 0.25, 0.5, 0.75, 1.0
  const rings = [0.25, 0.5, 0.75, 1.0].map((frac) => {
    const pts = values.map((_, i) => pointAt(i, frac)).join(" ");
    return <polygon key={frac} points={pts} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
  });

  return (
    <div className="rounded-2xl border border-edge-cyan/25 bg-edge-cyan/[0.04] p-5">
      <p className="label-xs text-edge-cyan">EdgeScore breakdown</p>
      <div className="mt-3 flex items-center justify-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-auto w-full max-w-[280px]">
          <defs>
            <linearGradient id="radar-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22e9ff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ff5d8f" stopOpacity="0.30" />
            </linearGradient>
          </defs>
          {/* Rings */}
          {rings}
          {/* Axis lines */}
          {AXES.map((_, i) => {
            const p = pointAt(i, 1);
            return (
              <line
                key={i}
                x1={CENTER}
                y1={CENTER}
                x2={p.split(",")[0]}
                y2={p.split(",")[1]}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
            );
          })}
          {/* Data polygon */}
          <polygon
            points={polyPoints}
            fill="url(#radar-fill)"
            stroke="#22e9ff"
            strokeWidth="2"
          />
          {/* Data dots */}
          {values.map((v, i) => {
            const [x, y] = pointAt(i, v).split(",").map(Number);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="4"
                fill="#ff5d8f"
                stroke="#04060c"
                strokeWidth="2"
              />
            );
          })}
          {/* Labels */}
          {AXES.map((a, i) => {
            const [lx, ly] = pointAt(i, 1.18).split(",").map(Number);
            return (
              <text
                key={a.key}
                x={lx}
                y={ly}
                fill="rgba(255,255,255,0.6)"
                fontSize="11"
                fontFamily="ui-monospace, monospace"
                fontWeight="600"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {a.label.toUpperCase()}
              </text>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.22em]">
        {AXES.map((a, i) => (
          <div
            key={a.key}
            className="flex items-center justify-between rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1.5 text-white/55"
          >
            <span>{a.label}</span>
            <span className="stat-mono text-edge-cyan">
              {Math.round(values[i] * 100)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function pointAt(i: number, frac: number): string {
  const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
  const x = CENTER + Math.cos(angle) * MAX_R * frac;
  const y = CENTER + Math.sin(angle) * MAX_R * frac;
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

function normalize(key: keyof EdgeScoreBreakdown, value: number): number {
  if (key === "canthalTilt") {
    // Tilt is signed -1..1; convert to "how close to ideal +0.4" → 0..1.
    return Math.max(0, 1 - Math.abs(value - 0.4));
  }
  if (key === "faceFat") {
    // Higher faceFat is "less lean". Invert so leaner = higher chart value.
    return Math.max(0, 1 - value);
  }
  // symmetry / jawline / cheekbones / goldenRatio are already 0..1.
  return Math.max(0, Math.min(1, value));
}
