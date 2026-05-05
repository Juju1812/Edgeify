"use client";

import { useEffect, useState } from "react";
import { useUser } from "./user-context";

export type LowPerfPref = "auto" | "on" | "off";

type NavigatorWithExt = Navigator & {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
};

/**
 * Auto-detection: a device is "low-perf" if any of the following hold.
 *   - deviceMemory ≤ 4 GB (most cheap phones, older Chromebooks)
 *   - hardwareConcurrency ≤ 4 cores
 *   - Data Saver is on, OR the connection is 2g/slow-2g/3g
 *   - User asked for prefers-reduced-motion
 *
 * Conservative — we only flip on when the signal is strong, since the
 * "amazing-looking" effects are intentional and shouldn't be sacrificed
 * on capable hardware that just happens to lack one signal.
 */
function detectLowPerf(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as NavigatorWithExt;

  let signals = 0;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) signals++;
  if (
    typeof nav.hardwareConcurrency === "number" &&
    nav.hardwareConcurrency <= 4
  ) {
    signals++;
  }
  const conn = nav.connection;
  if (conn?.saveData) signals += 2;
  if (conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") {
    signals += 2;
  }
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    signals++;
  }

  return signals >= 2;
}

/**
 * Returns true when the UI should run in its lighter, no-blur,
 * fewer-animations mode. Resolves the user preference (`auto` / `on` /
 * `off`) against the auto-detection result.
 */
export function useLowPerf(): boolean {
  const { user } = useUser();
  const pref = (user.lowPerfPref || "auto") as LowPerfPref;
  const [autoFlag, setAutoFlag] = useState(false);

  useEffect(() => {
    setAutoFlag(detectLowPerf());
    if (typeof window !== "undefined" && window.matchMedia) {
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onChange = () => setAutoFlag(detectLowPerf());
      mql.addEventListener?.("change", onChange);
      return () => mql.removeEventListener?.("change", onChange);
    }
  }, []);

  if (pref === "on") return true;
  if (pref === "off") return false;
  return autoFlag;
}
