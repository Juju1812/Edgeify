"use client";

import { useEffect, useState } from "react";

const ALLOWED = ["🔥", "💀", "👑", "😂", "🗿", "🤡", "💎", "💪"];

/**
 * Public-reaction strip for replay pages. Anyone watching can drop
 * reactions; no auth, no per-user-once limit (the count isn't load-
 * bearing on game logic, and a strict limit creates friction). Emojis
 * are server-whitelisted via /api/replay/[id]/reactions.
 */
export function ReplayReactions({ replayId }: { replayId: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/replay/${encodeURIComponent(replayId)}/reactions`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setCounts(d.counts || {});
      })
      .catch(() => {
        /* offline */
      });
    return () => {
      cancelled = true;
    };
  }, [replayId]);

  async function react(emoji: string) {
    if (busy) return;
    setBusy(emoji);
    try {
      const res = await fetch(
        `/api/replay/${encodeURIComponent(replayId)}/reactions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ emoji })
        }
      );
      const data = await res.json();
      if (res.ok && data.counts) setCounts(data.counts);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
      <p className="label-xs text-white/45">Reactions</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ALLOWED.map((e) => {
          const n = counts[e] || 0;
          return (
            <button
              key={e}
              onClick={() => react(e)}
              disabled={busy === e}
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 transition hover:border-edge-cyan/40 hover:bg-edge-cyan/[0.06] disabled:opacity-50"
            >
              <span className="text-lg">{e}</span>
              <span className="stat-mono text-xs text-white/60 group-hover:text-edge-cyan">
                {n}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
