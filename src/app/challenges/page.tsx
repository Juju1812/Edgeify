"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { OwnerBadge } from "@/components/OwnerBadge";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/lib/toast-context";

type Challenge = {
  from: string;
  message: string;
  createdAt: number;
};

export default function ChallengesPage() {
  const { authedRemote } = useUser();
  const { toast } = useToast();
  const [list, setList] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("edgify:auth:token:v1");
      if (!token) return;
      const res = await fetch("/api/challenges", {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setList(data.challenges || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authedRemote) load();
    else setLoading(false);
  }, [authedRemote]);

  async function dismiss(from: string) {
    const token = localStorage.getItem("edgify:auth:token:v1");
    if (!token) return;
    await fetch(`/api/challenges?from=${encodeURIComponent(from)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` }
    });
    setList((l) => l.filter((c) => c.from !== from));
    toast("Dismissed", { kind: "info" });
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6">
        <p className="label-xs text-edge-coral">Challenges</p>
        <h1 className="heading-display mt-2 text-4xl">Incoming</h1>
        <p className="mt-2 text-sm text-white/55">
          Players who want to face you. Tap to head into the arena.
        </p>
      </div>

      {!authedRemote ? (
        <div className="glass mt-8 rounded-2xl px-6 py-12 text-center">
          <p className="text-sm text-white/55">
            Sign in to receive challenges.
          </p>
        </div>
      ) : loading ? (
        <div className="glass mt-8 h-32 animate-pulse rounded-2xl" />
      ) : list.length === 0 ? (
        <div className="glass mt-8 rounded-2xl px-6 py-12 text-center">
          <div className="text-5xl">🎯</div>
          <h2 className="heading-display mt-3 text-2xl">No challenges yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">
            When someone challenges you, you&apos;ll see it here. Visit anyone&apos;s
            public profile to send a challenge.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {list.map((c) => (
            <li
              key={c.from + c.createdAt}
              className="glass flex items-start gap-3 rounded-2xl p-5"
            >
              <span className="text-3xl">⚔️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                  <Link
                    href={`/u/${encodeURIComponent(c.from)}`}
                    className="hover:text-edge-cyan"
                  >
                    {c.from}
                  </Link>
                  <OwnerBadge name={c.from} size="xs" />
                  <span className="ml-2 text-[10px] uppercase tracking-[0.32em] text-white/35">
                    challenges you
                  </span>
                </p>
                {c.message && (
                  <p className="mt-1 text-sm italic text-white/65">&ldquo;{c.message}&rdquo;</p>
                )}
                <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/30">
                  {timeAgo(c.createdAt)}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  href="/arena"
                  className="rounded-md border border-edge-cyan/50 bg-edge-cyan/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-cyan/25"
                >
                  Accept
                </Link>
                <button
                  onClick={() => dismiss(c.from)}
                  className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Footer />
    </main>
  );
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}
