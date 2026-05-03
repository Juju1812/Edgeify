"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/lib/user-context";

type Mode = "signup" | "signin";

export function SignInModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { signUp, signInRemote } = useUser();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [over18, setOver18] = useState(false);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode("signup");
      setName("");
      setPassword("");
      setOver18(false);
      setConsent(false);
      setErr(null);
      setBusy(false);
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

  async function submit() {
    setErr(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) return setErr("Callsign must be at least 2 characters.");
    if (trimmed.length > 16) return setErr("Callsign must be 16 characters or fewer.");
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed))
      return setErr("Letters, numbers, _ or - only.");
    if (password.length < 6) return setErr("Password must be at least 6 characters.");

    if (mode === "signup") {
      if (!over18) return setErr("You must be 18 or older to play.");
      if (!consent) return setErr("Please acknowledge the EdgeScore disclaimer.");
    }

    setBusy(true);
    const result =
      mode === "signup"
        ? await signUp(trimmed, password, true)
        : await signInRemote(trimmed, password);

    setBusy(false);
    if (result) {
      setErr(result.message || result.error);
      return;
    }
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
            <div className="mb-5 flex rounded-xl border border-white/10 bg-black/30 p-1 text-[11px] uppercase tracking-[0.22em]">
              <button
                onClick={() => {
                  setMode("signup");
                  setErr(null);
                }}
                className={
                  "flex-1 rounded-lg px-3 py-2 transition " +
                  (mode === "signup"
                    ? "bg-mog-violet/20 text-white"
                    : "text-white/40 hover:text-white/70")
                }
              >
                Sign Up
              </button>
              <button
                onClick={() => {
                  setMode("signin");
                  setErr(null);
                }}
                className={
                  "flex-1 rounded-lg px-3 py-2 transition " +
                  (mode === "signin"
                    ? "bg-mog-violet/20 text-white"
                    : "text-white/40 hover:text-white/70")
                }
              >
                Sign In
              </button>
            </div>

            <p className="label-xs">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </p>
            <h2 className="heading-card mt-2 text-2xl">
              {mode === "signup" ? "Pick a callsign" : "Sign in"}
            </h2>
            <p className="mt-2 text-xs text-white/50">
              {mode === "signup"
                ? "Saves your rank, scan, and match history across devices."
                : "Welcome back — enter your callsign and password to continue."}
            </p>

            <div className="mt-6 space-y-3">
              <label className="block">
                <span className="label-xs mb-2 block">Callsign</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="JRUB"
                  maxLength={16}
                  autoComplete="username"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-base uppercase tracking-[0.18em] text-white outline-none transition focus:border-mog-violet focus:ring-2 focus:ring-mog-violet/30"
                />
              </label>

              <label className="block">
                <span className="label-xs mb-2 block">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="••••••••"
                  maxLength={200}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition focus:border-mog-violet focus:ring-2 focus:ring-mog-violet/30"
                />
                {mode === "signup" && (
                  <span className="mt-1 block text-[10px] uppercase tracking-[0.22em] text-white/30">
                    6+ characters
                  </span>
                )}
              </label>

              {mode === "signup" && (
                <>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/5 bg-black/30 p-3 text-xs leading-relaxed text-white/70 transition hover:border-white/10">
                    <input
                      type="checkbox"
                      checked={over18}
                      onChange={(e) => setOver18(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-mog-violet"
                    />
                    <span>
                      I am <span className="text-white">18 or older</span>.
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
                      an entertainment metric — not a beauty judgment.
                    </span>
                  </label>
                </>
              )}

              {err && (
                <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {err}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-4 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:border-mog-violet hover:bg-mog-violet/30 disabled:opacity-40"
                >
                  {busy
                    ? "…"
                    : mode === "signup"
                      ? "Create Account →"
                      : "Sign In →"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
