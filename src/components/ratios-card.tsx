"use client";

import { clsx } from "clsx";
import { motion } from "framer-motion";
import { formatIdeal, formatRatio, ratioReport, RATIO_SPECS, type Ratios } from "@/lib/shared/ratios";
import { Card } from "./ui";

/** Each measured facial ratio against its ideal range. */
export function RatiosCard({ ratios }: { ratios: Ratios }) {
  const report = ratioReport(ratios);
  const hits = report.items.filter((i) => i.inRange).length;
  return (
    <Card className="animate-fade-up p-7 [animation-delay:340ms]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">Your ratios</h2>
          <p className="mt-1 text-[14px] text-ink-3">
            Measured from 478 points on your face. {hits} of {report.items.length} in the ideal range.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[34px] font-bold leading-none tracking-tighter text-ink">{report.score}</p>
          <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-4">Ratio score</p>
        </div>
      </div>
      <ul className="mt-5 grid gap-x-8 sm:grid-cols-2">
        {report.items.map((it, n) => {
          const spec = RATIO_SPECS[it.key];
          return (
            <motion.li
              key={it.key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + n * 0.03 }}
              className="flex items-center gap-3 border-b border-line py-3"
              title={spec.help}
            >
              <span
                className={clsx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                  it.inRange ? "bg-[#e9f7ee] text-good" : it.score >= 60 ? "bg-[#fff4e5] text-warn" : "bg-fill text-ink-3"
                )}
                aria-label={it.inRange ? "In ideal range" : "Outside ideal range"}
              >
                {it.inRange ? "✓" : "–"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-ink">{spec.label}</span>
                <span className="block text-[12px] text-ink-4">Ideal {formatIdeal(it.key)}</span>
              </span>
              <span className="text-[16px] font-semibold tabular-nums text-ink">{formatRatio(it.key, it.value)}</span>
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-4 text-[12px] text-ink-4">
        Webcam measurements are approximate — face the camera straight on, at eye level, for the truest read. Side-profile
        measures (gonial and cervicomental angle) can&apos;t be taken from a front camera.
      </p>
    </Card>
  );
}
