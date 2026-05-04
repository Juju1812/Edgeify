"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Floating "Report" button bottom-left. Opens a small dialog where
 * users can describe a bug; submits via mailto: so we don't need
 * a backend. UA + URL are appended automatically for context.
 */
export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  function send() {
    if (!text.trim()) return;
    const body = `${text.trim()}

—
URL: ${typeof window !== "undefined" ? window.location.href : ""}
UA:  ${typeof navigator !== "undefined" ? navigator.userAgent : ""}
Date: ${new Date().toISOString()}`;
    const url = `mailto:bug@edgify.cc?subject=${encodeURIComponent(
      "Edgify bug report"
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    setText("");
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 left-4 z-40 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55 backdrop-blur transition hover:border-edge-coral/40 hover:text-edge-coral"
        aria-label="Report a bug"
        title="Report a bug"
      >
        🐞 Report
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="glass relative w-full max-w-md p-6"
            >
              <p className="label-xs text-edge-coral">Bug report</p>
              <h2 className="heading-display mt-2 text-2xl">What broke?</h2>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 800))}
                rows={5}
                placeholder="Describe what you tried and what happened…"
                className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white outline-none focus:border-edge-coral"
              />
              <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/35">
                Sends via your email client · {text.length}/800
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={send}
                  disabled={!text.trim()}
                  className="rounded-lg border border-edge-coral/50 bg-edge-coral/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-coral/25 disabled:opacity-40"
                >
                  Send →
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
