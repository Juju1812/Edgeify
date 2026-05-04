"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/user-context";
import { EdgeMark } from "./icons";
import { OwnerBadge } from "./OwnerBadge";
import { ProBadge } from "./ProBadge";
import { unreadCount } from "@/lib/inbox";
import { isPro } from "@/lib/pro";

const CURRENT_VER = "0.4.0";

export function GuestBanner({ onSignIn }: { onSignIn: () => void }) {
  const { user, status, ready, authedRemote, signOut } = useUser();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const refresh = () => setUnread(unreadCount());
    refresh();
    window.addEventListener("edgify:inbox-update", refresh);
    return () => window.removeEventListener("edgify:inbox-update", refresh);
  }, []);

  // Three distinct states:
  //   - "guest" (no username yet): "Continue as guest" CTA
  //   - "named local guest" (username set, not authedRemote): "Save your
  //     progress" CTA so they can convert their local stats to an account
  //   - "authedRemote": full identity row + sign-out
  const isNamedGuest = ready && !!user.username && !authedRemote;

  return (
    <div className="relative w-full border-b border-white/[0.05] bg-black/40 backdrop-blur">
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
              No account needed — start playing instantly,
              <button
                onClick={onSignIn}
                className="ml-1 text-edge-cyan underline decoration-edge-cyan/30 underline-offset-4 transition hover:decoration-edge-cyan"
              >
                or claim a rank
              </button>
              .
            </p>
            <button
              onClick={onSignIn}
              className="ml-auto rounded-md border border-edge-cyan/40 bg-edge-cyan/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-edge-cyan transition hover:border-edge-cyan hover:bg-edge-cyan/20 hover:text-white sm:ml-0"
            >
              Sign in / Sign up
            </button>
          </>
        ) : isNamedGuest ? (
          <>
            <p className="ml-2 hidden flex-1 text-sm tracking-wide text-white/65 sm:block">
              <span className="font-semibold uppercase tracking-[0.18em] text-edge-coral">
                Guest
              </span>
              <span className="mx-2 text-white/20">·</span>
              <span className="font-semibold uppercase tracking-[0.18em] text-white">
                {user.username}
              </span>
              <span className="ml-2 text-white/45">
                — saved on this device only.
              </span>
            </p>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={onSignIn}
                className="rounded-md border border-edge-coral/40 bg-edge-coral/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-edge-coral transition hover:border-edge-coral hover:bg-edge-coral/20 hover:text-white"
                title="Convert your guest progress into a real account"
              >
                Save progress →
              </button>
              <button
                onClick={signOut}
                className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60 transition hover:border-white/20 hover:text-white"
                title="Reset guest data"
              >
                Reset
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="ml-2 hidden flex-1 text-sm tracking-wide text-white/65 sm:block">
              Signed in as{" "}
              <span className="font-semibold uppercase tracking-[0.18em] text-white">
                {user.username}
                <OwnerBadge name={user.username} size="xs" />
                <ProBadge active={isPro(user)} size="xs" />
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
              <Link
                href="/inbox"
                className="relative rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60 transition hover:border-edge-cyan/40 hover:text-edge-cyan"
                title="Inbox"
              >
                Inbox
                {unread > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-edge-coral px-1 text-[9px] font-bold text-black">
                    {Math.min(99, unread)}
                  </span>
                )}
              </Link>
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
