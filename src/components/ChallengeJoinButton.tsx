"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/user-context";

/**
 * Accept-challenge CTA on /challenge/[user]. Just routes the receiver
 * through to /play/[username], which derives the deterministic
 * pair-code and drops both sides into the same private room.
 *
 * If the receiver is a guest (no username), we bounce them to the
 * home page with a flag so the sign-in modal opens first.
 */
export function ChallengeJoinButton({
  challengerUsername
}: {
  challengerUsername: string;
}) {
  const { user, ready } = useUser();
  const router = useRouter();

  function accept() {
    if (!user.username) {
      router.push(
        `/?openSignIn=1&next=${encodeURIComponent(
          `/play/${challengerUsername}`
        )}`
      );
      return;
    }
    if (user.username.toLowerCase() === challengerUsername.toLowerCase()) {
      // Self-link — just send them home.
      router.push("/");
      return;
    }
    router.push(`/play/${encodeURIComponent(challengerUsername)}`);
  }

  if (!ready) {
    return (
      <div className="mx-auto h-14 w-56 animate-pulse rounded-2xl bg-white/[0.04]" />
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={accept}
        className="rounded-2xl border border-edge-coral/50 bg-edge-coral/15 px-8 py-4 text-sm font-bold uppercase tracking-[0.22em] text-white shadow-glow transition hover:border-edge-coral hover:bg-edge-coral/25"
      >
        Accept Challenge →
      </button>
      {!user.username && (
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
          Sign-in required · 30 sec setup
        </p>
      )}
      <Link
        href={`/u/${encodeURIComponent(challengerUsername)}`}
        className="block text-[11px] uppercase tracking-[0.22em] text-white/40 hover:text-white"
      >
        View their profile →
      </Link>
    </div>
  );
}
