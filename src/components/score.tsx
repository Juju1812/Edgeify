"use client";

import { clsx } from "clsx";
import { motion } from "framer-motion";
import { formatPsl, tierName, TRAIT_KEYS, TRAIT_LABELS, type Sex, type Traits } from "@/lib/shared/types";

/** The big score ring from the "Light" mockup. Shows the PSL under the number. */
export function ScoreRing({
  value,
  size = 260,
  stroke,
  label,
  animate = true,
  muted
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  label?: string;
  animate?: boolean;
  muted?: boolean;
}) {
  const sw = stroke ?? Math.max(8, Math.round(size * 0.07));
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ececf0" strokeWidth={sw} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={muted ? "#86868b" : "#0071e3"}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: animate ? c : c * (1 - pct) }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: animate ? 1.4 : 0, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold tracking-tightest text-ink" style={{ fontSize: size * 0.3, lineHeight: 1 }}>
          {value === null ? "–" : value}
        </span>
        {(label ?? (value !== null ? formatPsl(value) : "")) && (
          <span className="mt-1 font-medium text-ink-3" style={{ fontSize: Math.max(12, size * 0.068) }}>
            {label ?? (value !== null ? formatPsl(value) : "")}
          </span>
        )}
      </div>
    </div>
  );
}

export function TraitBars({
  traits,
  compare,
  compact
}: {
  traits: Traits;
  /** Optional second set (opponent) drawn as a thin bar underneath. */
  compare?: Traits;
  compact?: boolean;
}) {
  return (
    <ul className={clsx("flex flex-col", compact ? "gap-2.5" : "gap-3.5")}>
      {TRAIT_KEYS.map((k, i) => {
        const v = traits[k];
        const o = compare?.[k];
        const win = o !== undefined && v > o;
        return (
          <li key={k} className="grid grid-cols-[112px_1fr_36px] items-center gap-3 sm:grid-cols-[136px_1fr_40px]">
            <span className="truncate text-[15px] text-ink">{TRAIT_LABELS[k]}</span>
            <span className="flex flex-col gap-1">
              <span className="h-2 overflow-hidden rounded-full bg-fill">
                <motion.span
                  className={clsx("block h-full rounded-full", compare ? (win ? "bg-accent" : "bg-ink-3") : "bg-ink-2")}
                  initial={{ width: 0 }}
                  animate={{ width: `${v}%` }}
                  transition={{ duration: 0.9, delay: 0.05 * i, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </span>
              {o !== undefined && (
                <span className="h-1 overflow-hidden rounded-full bg-fill">
                  <motion.span
                    className="block h-full rounded-full bg-[#c7c7cc]"
                    initial={{ width: 0 }}
                    animate={{ width: `${o}%` }}
                    transition={{ duration: 0.9, delay: 0.05 * i + 0.1 }}
                  />
                </span>
              )}
            </span>
            <span className="text-right text-[15px] tabular-nums text-ink">{v}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Community tier for a score, e.g. "HTN" (the ring shows the PSL itself). */
export function tierLabel(overall: number, sex?: Sex | null) {
  return tierName(overall, sex);
}
