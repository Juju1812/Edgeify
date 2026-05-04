"use client";

import { useEffect, useState } from "react";

const REACTIONS: Array<{ key: string; emoji: string; label: string }> = [
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "crown", emoji: "👑", label: "Goated" },
  { key: "goat", emoji: "🐐", label: "GOAT" },
  { key: "skull", emoji: "💀", label: "Mogged" },
  { key: "clown", emoji: "🤡", label: "Clown" }
];

export function ProfileReactions({
  username,
  actor
}: {
  username: string;
  actor: string | null;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reactions/${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setCounts(d.counts || {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [username]);

  async function react(emoji: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/reactions/${encodeURIComponent(username)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ emoji, actor: actor || "anon" })
        }
      );
      if (res.ok) {
        const data = await res.json();
        setCounts(data.counts || {});
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <p className="label-xs text-edge-cyan">Reactions</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {REACTIONS.map((r) => (
          <button
            key={r.key}
            onClick={() => react(r.key)}
            disabled={busy}
            title={r.label}
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-sm transition hover:scale-105 hover:border-edge-cyan/40 hover:bg-edge-cyan/[0.06] active:scale-95 disabled:opacity-40"
          >
            <span className="text-xl">{r.emoji}</span>
            <span className="stat-mono text-[11px] font-semibold text-white/70 group-hover:text-white">
              {counts[r.key] || 0}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-white/30">
        One reaction per minute · counters are global
      </p>
    </div>
  );
}
