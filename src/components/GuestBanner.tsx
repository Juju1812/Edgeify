"use client";

import { GhostIcon } from "./icons";

export function GuestBanner() {
  return (
    <div className="relative w-full border-b border-white/[0.04] bg-black/30 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
        <GhostIcon className="h-5 w-5 text-white/60" />
        <p className="flex-1 text-center text-sm tracking-wide text-white/85">
          You&apos;re playing as a Guest.{" "}
          <button className="underline decoration-white/30 underline-offset-4 transition hover:text-white hover:decoration-white">
            Click here to claim your rank with Google.
          </button>
        </p>
        <button className="group relative inline-flex items-center gap-1 rounded-md border border-mog-violet/40 bg-mog-violet/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.24em] text-mog-violet transition hover:border-mog-violet hover:bg-mog-violet/20 hover:text-white">
          Claim
        </button>
      </div>
    </div>
  );
}
