"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function ModeCard({
  href,
  icon,
  title,
  subtitle,
  footer,
  index = 0
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  footer?: ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.08 * index, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <div className="glass glass-hover group relative flex h-full flex-col items-center justify-between gap-6 rounded-3xl p-8 text-center">
        {/* Click target covers the upper area only — leaves the footer slot
            free for inputs / buttons that shouldn't navigate. */}
        <Link
          href={href}
          aria-label={title}
          className="absolute inset-x-0 top-0 z-10 h-[calc(100%-4rem)] rounded-t-3xl"
        />

        <div className="pointer-events-none flex w-full flex-1 flex-col items-center justify-center gap-6">
          <div
            className="text-white/80 transition-transform duration-500 group-hover:scale-110 group-hover:text-white"
            style={{ filter: "drop-shadow(0 0 24px rgba(168, 85, 247, 0.45))" }}
          >
            {icon}
          </div>
          <div className="space-y-2">
            <h3 className="heading-card">{title}</h3>
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/40">
              {subtitle}
            </p>
          </div>
        </div>

        {footer ? (
          <div className="relative z-20 w-full">{footer}</div>
        ) : null}
      </div>
    </motion.div>
  );
}
