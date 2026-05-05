"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const STORAGE_KEY = "edgify:pwa:install:v1";
const VISIT_THRESHOLD = 3;
const DISMISS_TTL_DAYS = 7;

/**
 * Browser-native PWA install banner. We catch the browser's
 * `beforeinstallprompt` event, suppress its default UI, and surface
 * our own banner once the user has visited 3+ times. Dismissals are
 * remembered for 7 days. Already-installed standalone sessions never
 * show the banner.
 */
export function PWAInstallPrompt() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Already installed (PWA standalone)? Bail.
    if (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari standalone
      (navigator as Navigator & { standalone?: boolean }).standalone
    ) {
      return;
    }

    // Bump visit counter.
    let visits = 0;
    let dismissedAt = 0;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          visits?: number;
          dismissedAt?: number;
        };
        visits = parsed.visits || 0;
        dismissedAt = parsed.dismissedAt || 0;
      }
    } catch {
      /* ignore */
    }
    visits += 1;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ visits, dismissedAt })
      );
    } catch {
      /* ignore */
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
      // Only surface if user has visited enough AND last dismissal is
      // older than the cooldown window.
      const cooldownMs = DISMISS_TTL_DAYS * 24 * 60 * 60 * 1000;
      const cooledDown =
        !dismissedAt || Date.now() - dismissedAt > cooldownMs;
      if (visits >= VISIT_THRESHOLD && cooledDown) {
        // Slight delay so it doesn't fight first-paint.
        window.setTimeout(() => setOpen(true), 1500);
      }
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...parsed, dismissedAt: Date.now() })
      );
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!evt) return;
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "accepted") {
        setOpen(false);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    }
  }

  if (!open || !evt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-edge-cyan/30 bg-black/90 p-4 shadow-glow backdrop-blur sm:bottom-6">
      <div className="flex items-start gap-3">
        <span className="text-2xl">📲</span>
        <div className="flex-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
            Install Edgify
          </p>
          <p className="mt-1 text-xs text-white/55">
            Faster launch, full-screen matches, push-ready for friend
            challenges later.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={install}
              className="rounded-lg border border-edge-cyan/60 bg-edge-cyan/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-cyan/25"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55 transition hover:border-white/20 hover:text-white"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
