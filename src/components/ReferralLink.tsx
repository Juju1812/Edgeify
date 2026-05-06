"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/lib/toast-context";

const REF_KEY = "edgify:ref:pending:v1";

/**
 * Settings card that surfaces the current user's invite URL with a
 * one-tap copy. Inviting works in two halves:
 *   1. The recipient lands on https://edgify.cc?ref=USERNAME — the
 *      <RefCapture> component (mounted in root layout) parses the
 *      param and stashes the inviter in sessionStorage.
 *   2. Whoever they invited will eventually sign up; aggregation is
 *      intentionally deferred to a future server endpoint, but the
 *      capture is in place so the data is collectable.
 */
export function ReferralLink() {
  const { user } = useUser();
  const { toast } = useToast();
  const [origin, setOrigin] = useState("https://edgify.cc");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  if (!user.username) {
    return (
      <p className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3 text-xs text-white/55">
        Sign in to get your personal invite link.
      </p>
    );
  }

  const url = `${origin}/?ref=${encodeURIComponent(user.username)}`;
  function copy() {
    navigator.clipboard
      .writeText(url)
      .then(() => toast("Link copied — share it anywhere", { kind: "success" }))
      .catch(() =>
        toast("Couldn't copy. Long-press the link instead.", { kind: "warn" })
      );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-white/55">
        Share this link to invite friends. Anyone who clicks gets you
        credited as their inviter when they sign up.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/85">
          {url}
        </code>
        <button
          onClick={copy}
          className="rounded-lg border border-edge-cyan/40 bg-edge-cyan/[0.08] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:border-edge-cyan/70 hover:bg-edge-cyan/[0.16]"
        >
          Copy
        </button>
      </div>
    </div>
  );
}

/**
 * Captures `?ref=USERNAME` on any page and stores it for later use.
 * Mount once in the root layout. Doesn't render anything.
 */
export function RefCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get("ref");
      if (ref) {
        const clean = ref.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
        if (clean) sessionStorage.setItem(REF_KEY, clean);
      }
    } catch {
      /* malformed URL — ignore */
    }
  }, []);
  return null;
}
