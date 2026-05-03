"use client";

import Link from "next/link";
import { useUser } from "@/lib/user-context";
import { GhostIcon } from "./icons";

const CURRENT_VER = "0.4.0";

export function GuestBanner({ onSignIn }: { onSignIn: () => void }) {
  const { user, status, ready, signOut } = useUser();

  return (
    <div className="relative w-full border-b border-white/[0.04] bg-black/30 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
        <GhostIcon className="h-5 w-5 text-white/60" />

        {!ready ? (
          <p className="flex-1 text-center text-sm text-white/50">Loading…</p>
        ) : status === "guest" ? (
          <>
            <p className="flex-1 text-center text-sm tracking-wide text-white/85">
              You&apos;re playing as a Guest.{" "}
              <button
                onClick={onSignIn}
                className="underline decoration-white/30 underline-offset-4 transition hover:text-white hover:decoration-white"
              >
                Click here to claim your rank.
              </button>
            </p>
            <button
              onClick={onSignIn}
              className="group relative inline-flex items-center gap-1 rounded-md border border-mog-violet/40 bg-mog-violet/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.24em] text-mog-violet transition hover:border-mog-violet hover:bg-mog-violet/20 hover:text-white"
            >
              Claim
            </button>
          </>
        ) : (
          <>
            <p className="flex-1 text-center text-sm tracking-wide text-white/70">
              Signed in as{" "}
              <span className="font-semibold uppercase tracking-[0.2em] text-white">
                {user.username}
              </span>
              {status === "auth-no-scan" && (
                <span className="ml-2 text-mog-violet">
                  · No face scan yet
                </span>
              )}
              {status === "calibrating" && (
                <span className="ml-2 text-cyan-300">
                  · Calibrating ({user.placementsLeft}/5 left)
                </span>
              )}
            </p>
            {user.changelogSeenVersion !== CURRENT_VER && (
              <Link
                href="/whats-new"
                className="rounded-md border border-mog-pink/40 bg-mog-pink/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.24em] text-mog-pink transition hover:bg-mog-pink/20"
                title="See what's new"
              >
                🔔 New
              </Link>
            )}
            <button
              onClick={signOut}
              className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.24em] text-white/60 transition hover:border-white/20 hover:text-white"
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}
