"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/user-context";
import { Footer } from "@/components/Footer";

/**
 * /play/[user] — direct-friend match link.
 *
 * Generates a deterministic 6-char private-room code from the sorted
 * pair of (current username, target username) and redirects both
 * sides to /private?code=XXXXXX. As long as both players hit /play
 * with the same friend, they land in the same room without exchanging
 * a code manually.
 *
 * Guests are bounced to /private with the resolved code printed so
 * they can sign in then re-enter the link.
 */
export default function PlayWithFriendPage({
  params
}: {
  params: { user: string };
}) {
  const { user, ready } = useUser();
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);

  const target = (params.user || "").toLowerCase();

  useEffect(() => {
    if (!ready) return;
    if (!user.username) return;
    const a = user.username.toLowerCase();
    const b = target;
    if (a === b) return;
    const c = pairCode(a, b);
    setCode(c);
    // Tiny delay so the page has a chance to render the code (in case
    // we want to show a "joining…" state before redirect).
    const t = window.setTimeout(() => {
      router.replace(`/private?code=${c}`);
    }, 600);
    return () => window.clearTimeout(t);
  }, [ready, user.username, target, router]);

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 pt-16 pb-16 text-center">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Cancel
      </Link>

      <div className="mt-10">
        <p className="label-xs text-edge-cyan">Direct match</p>
        <h1 className="heading-display mt-3 text-3xl">
          Playing <span className="brand-edge">{params.user}</span>
        </h1>
        <p className="mt-3 text-sm text-white/55">
          Both you and your friend will land in the same private room
          when you tap this link. No code to share.
        </p>
      </div>

      {!ready ? (
        <div className="glass mt-10 h-32 animate-pulse rounded-2xl" />
      ) : !user.username ? (
        <div className="glass mt-10 rounded-2xl px-6 py-8">
          <p className="text-sm text-white/65">
            You need a username to start a direct match.
          </p>
          <Link
            href="/?openSignIn=1"
            className="mt-4 inline-block rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-cyan/25"
          >
            Sign in →
          </Link>
        </div>
      ) : (
        <div className="glass mt-10 rounded-2xl px-6 py-8">
          {code ? (
            <>
              <p className="label-xs text-white/45">Joining room</p>
              <p className="stat-mono mt-2 text-3xl font-bold tracking-[0.32em] text-edge-cyan">
                {code}
              </p>
              <p className="mt-3 text-xs text-white/45">Redirecting…</p>
            </>
          ) : (
            <p className="text-sm text-white/55">Calculating room…</p>
          )}
        </div>
      )}

      <Footer />
    </main>
  );
}

/**
 * 6-char [A-Z0-9] code derived from the alphabetically-sorted pair so
 * both sides resolve to the same room. Stable across reloads,
 * collision risk is acceptable at our scale (1 in 36^6 ≈ 1 in 2.2B).
 */
function pairCode(a: string, b: string): string {
  const [first, second] = a < b ? [a, b] : [b, a];
  const seed = `edgify:pair:${first}:${second}`;
  let h1 = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h1 ^= seed.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  // Second hash for more entropy
  let h2 = 0xdeadbeef;
  for (let i = 0; i < seed.length; i++) {
    h2 ^= seed.charCodeAt(i);
    h2 = Math.imul(h2, 0x9e3779b1) >>> 0;
  }
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    const mix = (h1 ^ (h2 >>> (i * 4))) >>> 0;
    out += ALPHA[mix % ALPHA.length];
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return out;
}
