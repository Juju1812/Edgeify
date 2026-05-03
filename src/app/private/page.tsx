"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Footer } from "@/components/Footer";
import { useUser } from "@/lib/user-context";

function generateCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function PrivateRoomPage() {
  return (
    <Suspense fallback={<div className="glass mx-auto mt-10 h-64 max-w-3xl animate-pulse rounded-2xl" />}>
      <PrivateRoomInner />
    </Suspense>
  );
}

function PrivateRoomInner() {
  const { user, status, ready } = useUser();
  const params = useSearchParams();
  const joinCodeFromUrl = params.get("code");

  const [code, setCode] = useState<string | null>(null);
  const [size, setSize] = useState<4 | 8 | 16>(8);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (joinCodeFromUrl && joinCodeFromUrl.length === 6) {
      setCode(joinCodeFromUrl);
    }
  }, [joinCodeFromUrl]);

  function generate() {
    setCode(generateCode());
    setCopied(false);
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  if (!ready)
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10">
        <div className="glass h-64 animate-pulse rounded-2xl" />
      </main>
    );

  if (status === "guest")
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
        <Link
          href="/"
          className="label-xs inline-flex items-center gap-2 text-white/40 transition hover:text-white"
        >
          ← Back to Lobby
        </Link>
        <div className="glass mt-8 rounded-2xl px-8 py-12 text-center">
          <p className="label-xs">Locked</p>
          <h2 className="heading-card mt-2 text-2xl">Sign in for private rooms</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/50">
            Generate or join an invite-only bracket once you have a callsign.
          </p>
        </div>
        <Footer />
      </main>
    );

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 transition hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6">
        <p className="label-xs">Private Room</p>
        <h1 className="heading-card mt-2 text-3xl">Invite-only bracket</h1>
      </div>

      <div className="glass mt-8 space-y-6 rounded-2xl p-8">
        {!code ? (
          <>
            <div>
              <p className="label-xs mb-3">Bracket size</p>
              <div className="flex gap-2">
                {[4, 8, 16].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSize(n as 4 | 8 | 16)}
                    className={
                      "flex-1 rounded-lg border px-4 py-3 text-xs uppercase tracking-[0.22em] transition " +
                      (size === n
                        ? "border-mog-violet bg-mog-violet/20 text-white"
                        : "border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white")
                    }
                  >
                    {n} players
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generate}
              className="w-full rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30"
            >
              Generate Code
            </button>
          </>
        ) : (
          <>
            <div className="text-center">
              <p className="label-xs">Share this code</p>
              <p className="mt-3 font-mono text-5xl font-bold tracking-[0.32em] text-white">
                {code}
              </p>
              <button
                onClick={copy}
                className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>

            <div className="border-t border-white/[0.04] pt-6 text-center">
              <p className="text-sm text-white/50">
                Waiting for {size - 1} more {size - 1 === 1 ? "player" : "players"}…
              </p>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {Array.from({ length: size }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-lg border border-white/[0.04] bg-black/30"
                  >
                    {i === 0 && (
                      <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.22em] text-mog-violet">
                        {user.username}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[10px] uppercase tracking-[0.32em] text-white/30">
                Live brackets coming with real-time backend
              </p>
            </div>

            <button
              onClick={() => setCode(null)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-6 py-3 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
            >
              Cancel & generate new
            </button>
          </>
        )}
      </div>

      <Footer />
    </main>
  );
}
