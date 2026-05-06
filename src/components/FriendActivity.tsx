"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/user-context";

type LiveEntry = {
  username: string;
  elo: number;
  edgeScore: number;
  faceDataUrl: string | null;
  updatedAt: number;
};

/**
 * Lite version of "Defend the family" — surfaces a banner on the home
 * page when a friend has activity in the last 30 minutes. We don't
 * have a true loss-event push yet (would need server fan-out), but
 * "your friend X is here right now" still drives social play.
 */
export function FriendActivity() {
  const { user, status } = useUser();
  const [hot, setHot] = useState<LiveEntry[]>([]);

  useEffect(() => {
    if (status !== "ranked" || user.friends.length === 0) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch("/api/live");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const friendsLower = new Set(user.friends.map((f) => f.toLowerCase()));
        const cutoff = Date.now() - 30 * 60 * 1000;
        const recent: LiveEntry[] = (data.entries || []).filter(
          (e: LiveEntry) =>
            friendsLower.has(e.username.toLowerCase()) &&
            (e.updatedAt || 0) > cutoff
        );
        setHot(recent.slice(0, 3));
      } catch {
        /* network blip */
      }
    };
    refresh();
    const t = window.setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [status, user.friends]);

  if (hot.length === 0) return null;

  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label-xs text-emerald-300">
          {hot.length === 1 ? "A friend is online" : `${hot.length} friends are online`}
        </p>
        <Link
          href="/friends"
          className="text-[10px] uppercase tracking-[0.22em] text-white/45 hover:text-white"
        >
          See all →
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {hot.map((f) => (
          <Link
            key={f.username}
            href={`/play/${encodeURIComponent(f.username)}`}
            title={`Play ${f.username} — direct match`}
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 transition hover:border-emerald-400/60 hover:bg-emerald-500/[0.08] hover:text-emerald-200"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {f.username}
            <span className="text-white/35 group-hover:text-emerald-300">
              {f.elo}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
