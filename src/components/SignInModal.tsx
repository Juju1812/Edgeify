"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/lib/user-context";
import { suggestCallsigns } from "@/lib/callsign-gen";

type Mode = "signup" | "signin";

export function SignInModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { signUp, signInRemote, playAsGuest } = useUser();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [birthYear, setBirthYear] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const currentYear = new Date().getUTCFullYear();
  const yearNum = parseInt(birthYear, 10);
  const age = isNaN(yearNum) ? 0 : currentYear - yearNum;
  const validYear = !isNaN(yearNum) && yearNum >= 1900 && yearNum <= currentYear;
  const over18 = validYear && age >= 18;
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode("signup");
      setName("");
      setPassword("");
      setBirthYear("");
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
      if (!validYear) return setErr("Enter your year of birth (4 digits).");
      if (age < 18) return setErr("You must be 18 or older to play.");
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
                    ? "bg-edge-cyan/20 text-white"
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
                    ? "bg-edge-cyan/20 text-white"
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
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-base uppercase tracking-[0.18em] text-white outline-none transition focus:border-edge-cyan focus:ring-2 focus:ring-edge-cyan/30"
                />
                {mode === "signup" && <CallsignSuggester onPick={(s) => setName(s)} />}
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
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition focus:border-edge-cyan focus:ring-2 focus:ring-edge-cyan/30"
                />
                {mode === "signup" && (
                  <span className="mt-1 block text-[10px] uppercase tracking-[0.22em] text-white/30">
                    6+ characters
                  </span>
                )}
              </label>

              {mode === "signup" && (
                <>
                  <label className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/30 p-3 text-xs text-white/70">
                    <span className="shrink-0 uppercase tracking-[0.18em]">
                      Birth year
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="YYYY"
                      value={birthYear}
                      onChange={(e) =>
                        setBirthYear(
                          e.target.value.replace(/[^0-9]/g, "").slice(0, 4)
                        )
                      }
                      min={1900}
                      max={currentYear}
                      className="w-24 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-center stat-mono text-base text-white outline-none focus:border-edge-cyan"
                    />
                    {validYear && (
                      <span
                        className={
                          age >= 18
                            ? "text-emerald-300"
                            : "text-rose-300"
                        }
                      >
                        {age >= 18
                          ? `✓ ${age} yr`
                          : `${age} — must be 18+`}
                      </span>
                    )}
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/5 bg-black/30 p-3 text-xs leading-relaxed text-white/70 transition hover:border-white/10">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-edge-cyan"
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
                  className="flex-1 rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-cyan hover:bg-edge-cyan/25 disabled:opacity-40"
                >
                  {busy
                    ? "…"
                    : mode === "signup"
                      ? "Create Account →"
                      : "Sign In →"}
                </button>
              </div>

              {/* Guest fast-path — sets a random local callsign and
                  starts playing immediately. Progress lives in this
                  device's localStorage; can be claimed any time via
                  Sign Up later (all stats carry over). */}
              <div className="relative pt-2">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="text-[10px] uppercase tracking-[0.32em] text-white/30">
                    or
                  </span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <button
                  onClick={() => {
                    playAsGuest();
                    onClose();
                  }}
                  disabled={busy}
                  className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/75 transition hover:border-edge-coral/40 hover:bg-edge-coral/[0.06] hover:text-edge-coral disabled:opacity-40"
                >
                  Continue as Guest →
                </button>
                <p className="mt-2 text-center text-[10px] uppercase tracking-[0.22em] text-white/30">
                  Saved on this device · Claim anytime to keep across devices
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Quick-pick row of randomly generated callsigns. The shuffle button
 * regenerates fresh suggestions so users who don't love their first
 * batch can hit it for more.
 */
function CallsignSuggester({ onPick }: { onPick: (s: string) => void }) {
  const [seed, setSeed] = useState(0);
  const suggestions = useMemo(() => suggestCallsigns(5), [seed]);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[9px] uppercase tracking-[0.32em] text-white/35">
        Try
      </span>
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65 transition hover:border-edge-cyan/40 hover:bg-edge-cyan/[0.06] hover:text-edge-cyan"
        >
          {s}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setSeed((s) => s + 1)}
        className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/45 transition hover:border-white/20 hover:text-white/80"
        title="Shuffle"
      >
        ↻
      </button>
    </div>
  );
}
