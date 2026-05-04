"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the browser console so the user can paste it in a bug report.
    // eslint-disable-next-line no-console
    console.error("[edgify] page error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="label-xs text-edge-coral">Error</p>
      <h1 className="heading-display mt-3 text-5xl">Something cracked.</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55">
        Don&apos;t worry — your account, ELO, and matches are safe. This is
        just a render hiccup. Reload, or head back to the lobby.
      </p>
      {error.digest && (
        <p className="mt-3 stat-mono text-[10px] uppercase tracking-[0.32em] text-white/30">
          Digest · {error.digest}
        </p>
      )}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-xl border border-edge-cyan/50 bg-edge-cyan/15 px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-cyan hover:bg-edge-cyan/25"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-white/10 bg-white/[0.02] px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
        >
          Back to lobby
        </Link>
      </div>
    </main>
  );
}
