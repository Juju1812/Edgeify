"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/lib/user-context";

export function SignInModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { signIn } = useUser();
  const [name, setName] = useState("");
  const [over18, setOver18] = useState(false);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setOver18(false);
      setConsent(false);
      setErr(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function submit() {
    setErr(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) return setErr("Username must be at least 2 characters.");
    if (trimmed.length > 16) return setErr("Username must be 16 characters or fewer.");
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed))
      return setErr("Letters, numbers, _ or - only.");
    if (!over18) return setErr("You must be 18 or older to play.");
    if (!consent) return setErr("Please acknowledge the EdgeScore disclaimer.");
    signIn(trimmed, true);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative w-full max-w-md p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="label-xs">Claim your rank</p>
            <h2 className="heading-card mt-2 text-2xl">Pick a callsign</h2>
            <p className="mt-2 text-xs text-white/50">
              Real Google sign-in is coming soon. For now, choose a username
              and we&apos;ll save your progress on this device.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="label-xs mb-2 block">Username</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="JRUB"
                  maxLength={16}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-base uppercase tracking-[0.18em] text-white outline-none transition focus:border-mog-violet focus:ring-2 focus:ring-mog-violet/30"
                />
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/5 bg-black/30 p-3 text-xs leading-relaxed text-white/70 transition hover:border-white/10">
                <input
                  type="checkbox"
                  checked={over18}
                  onChange={(e) => setOver18(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-mog-violet"
                />
                <span>
                  I am <span className="text-white">18 or older</span>. Required
                  to play — face capture is gated by this check.
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/5 bg-black/30 p-3 text-xs leading-relaxed text-white/70 transition hover:border-white/10">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-mog-violet"
                />
                <span>
                  I understand <span className="text-white">EdgeScore</span> is
                  an entertainment metric based on geometric facial measurements
                  — <span className="text-white">not</span> a beauty judgment.
                </span>
              </label>

              {err && (
                <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {err}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  className="flex-1 rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-4 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:border-mog-violet hover:bg-mog-violet/30"
                >
                  Claim Rank →
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
