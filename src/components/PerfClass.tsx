"use client";

import { useEffect } from "react";
import { useLowPerf } from "@/lib/perf";

/**
 * Applies / removes the `low-perf` class on <html> so the global CSS
 * overrides (no backdrop-blur, no glow shadows, no enter animations)
 * take effect across the whole app.
 *
 * Lives in the root layout — single source of truth, never unmounts.
 */
export function PerfClass() {
  const lowPerf = useLowPerf();
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("low-perf", lowPerf);
  }, [lowPerf]);
  return null;
}
