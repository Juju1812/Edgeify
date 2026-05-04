"use client";

import Link from "next/link";
import { useUser } from "@/lib/user-context";
import { EdgeMark } from "./icons";

const CURRENT_VER = "0.4.0";

export function GuestBanner({ onSignIn }: { onSignIn: () => void }) {
  const { user, status, ready, signOut } = useUser();

  return (
    <div className="relative w-full border-b border-white/[0.05] bg-black/40 backdrop-blur">
      {/* Edge accent strip — thin gradient at the very top of the page,
          a small piece of brand identity that's instantly different from
          the symmetric center-banner pattern. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(34,233,255,0.6) 35%, rgba(255,93,143,0.5) 65%, transparent 100%)"
        }}
      />
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <EdgeMark className="h-6 w-6" />
          <span className="brand-edge text-sm font-extrabold uppercase tracking-[0.20em]">
            Edgify
          </span>
        </Link>

        {!ready ? (
          <p className="ml-auto text-sm text-white/40">Loading…</p>
        ) : status === "guest" ? (
          <>
            <p className="ml-2 hidden flex-1 text-sm tracking-wide text-white/70 sm:block">
              Playing as guest —{" "}
              <button
                onClick={onSignIn}
                className="text-edge-cyan underline decoration-edge-cyan/30 underline-offset-4 transition hover:decoration-edge-cyan"
              >
                claim your rank
              </button>{" "}
              to save progress.
            </p>
            <button
              onClick={onSignIn}
              className="ml-auto rounded-md border border-edge-cyan/40 bg-edge-cyan/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-edge-cyan transition hover:border-edge-cyan hover:bg-edge-cyan/20 hover:text-white sm:ml-0"
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            <p className="ml-2 hidden flex-1 text-sm tracking-wide text-white/65 sm:block">
              Signed in as{" "}
              <span className="font-semibold uppercase tracking-[0.18em] text-white">
                {user.username}
              </span>
              {status === "auth-no-scan" && (
                <span className="ml-2 text-edge-cyan">· No scan yet</span>
              )}
              {status === "calibrating" && (
                <span className="ml-2 text-edge-cyan">
                  · Placement {5 - user.placementsLeft}/5
                </span>
              )}
            </p>
            <div className="ml-auto flex items-center gap-2">
              {user.changelogSeenVersion !== CURRENT_VER && (
                <Link
                  href="/whats-new"
                  className="rounded-md border border-edge-coral/40 bg-edge-coral/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-edge-coral transition hover:bg-edge-coral/20"
                  title="See what's new"
                >
                  New
                </Link>
              )}
              <button
                onClick={signOut}
                className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60 transition hover:border-white/20 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
