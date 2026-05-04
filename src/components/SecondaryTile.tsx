"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRightIcon } from "./icons";

/**
 * Compact 3-up secondary tile — used for Calibrate / Leaderboard /
 * Tournaments below the featured arena hero. Smaller than the legacy
 * ModeCard, with the icon + title on one row instead of stacked, so
 * the layout reads as a deliberate hierarchy with the hero rather
 * than as a 4-card peer grid.
 */
export function SecondaryTile({
  href,
  icon,
  title,
  subtitle,
  accent = "cyan",
  status,
  index = 0
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  accent?: "cyan" | "coral" | "amber";
  status?: ReactNode;
  index?: number;
}) {
  const accentClass =
    accent === "coral"
      ? "text-edge-coral"
      : accent === "amber"
        ? "text-edge-amber"
        : "text-edge-cyan";
  const accentBorder =
    accent === "coral"
      ? "group-hover:border-edge-coral/40"
      : accent === "amber"
        ? "group-hover:border-edge-amber/40"
        : "group-hover:border-edge-cyan/40";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.06 * index, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Link
        href={href}
        className={`glass glass-hover group relative flex h-full flex-col gap-5 overflow-hidden rounded-2xl p-6 ${accentBorder}`}
      >
        {/* Soft corner accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-50"
          style={{
            background:
              accent === "coral"
                ? "radial-gradient(circle, rgba(255,93,143,0.4) 0%, transparent 70%)"
                : accent === "amber"
                  ? "radial-gradient(circle, rgba(255,181,71,0.4) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(34,233,255,0.4) 0%, transparent 70%)"
          }}
        />

        <div className="flex items-start justify-between">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-black/30 ${accentClass} transition-transform duration-300 group-hover:scale-110`}>
            {icon}
          </span>
          <ArrowRightIcon className="h-4 w-4 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
        </div>

        <div className="flex-1 space-y-1.5">
          <h3 className="heading-display text-2xl">{title}</h3>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
            {subtitle}
          </p>
        </div>

        {status ? <div className="pt-1">{status}</div> : null}
      </Link>
    </motion.div>
  );
}
