"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ROUTES: Record<string, { label: string; href: string }> = {
  h: { label: "Home / Lobby", href: "/" },
  a: { label: "Arena", href: "/arena" },
  l: { label: "Leaderboard", href: "/leaderboard" },
  c: { label: "Calibrate / Lab", href: "/lab" },
  p: { label: "Profile", href: "/profile" },
  s: { label: "Settings", href: "/settings" },
  f: { label: "Friends", href: "/friends" },
  u: { label: "Unlocks", href: "/achievements" },
  d: { label: "Daily Boss", href: "/daily" },
  t: { label: "Tournaments", href: "/private" }
};

/**
 * Vim-style "g + letter" navigation. Pressing `g` opens a hint
 * overlay, the next letter triggers a route change. ESC or any
 * non-listed key cancels. Disabled while focus is in an input.
 *
 * Press `?` anywhere to toggle the cheat-sheet.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [showCheat, setShowCheat] = useState(false);

  useEffect(() => {
    function isTyping(): boolean {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (el as HTMLElement).isContentEditable
      );
    }

    function onKey(e: KeyboardEvent) {
      if (isTyping()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setShowCheat((v) => !v);
        return;
      }

      if (armed) {
        const route = ROUTES[e.key.toLowerCase()];
        if (route) {
          e.preventDefault();
          router.push(route.href);
        }
        setArmed(false);
        return;
      }
      if (e.key === "g") {
        e.preventDefault();
        setArmed(true);
        // Auto-disarm after 1.5s if no follow-up.
        window.setTimeout(() => setArmed(false), 1500);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed, router]);

  return (
    <>
      <AnimatePresence>
        {armed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pointer-events-none fixed bottom-6 right-6 z-50 rounded-xl border border-edge-cyan/40 bg-black/85 px-4 py-3 backdrop-blur-md"
          >
            <p className="text-[10px] uppercase tracking-[0.32em] text-edge-cyan">
              Go to…
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-[0.18em] text-white/70">
              {Object.entries(ROUTES).map(([k, r]) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <kbd className="rounded bg-white/10 px-1 py-0.5 text-[9px] text-edge-cyan">
                    {k}
                  </kbd>
                  {r.label}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCheat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCheat(false)}
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="glass relative w-full max-w-md rounded-2xl p-6"
            >
              <p className="label-xs text-edge-cyan">Keyboard Shortcuts</p>
              <h2 className="heading-display mt-2 text-2xl">Quick nav</h2>
              <p className="mt-2 text-xs text-white/55">
                Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-edge-cyan">g</kbd>{" "}
                then a letter to jump.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {Object.entries(ROUTES).map(([k, r]) => (
                  <li
                    key={k}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-white/70 hover:bg-white/[0.04]"
                  >
                    <span>{r.label}</span>
                    <span className="flex gap-1">
                      <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/55">
                        g
                      </kbd>
                      <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-edge-cyan">
                        {k}
                      </kbd>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-white/40">
                Press ? to toggle this anytime.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
