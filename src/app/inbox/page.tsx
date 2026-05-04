"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { EmptyState } from "@/components/Skeleton";
import {
  type InboxItem,
  clearInbox,
  loadInbox,
  markAllRead
} from "@/lib/inbox";

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);

  useEffect(() => {
    const refresh = () => setItems(loadInbox());
    refresh();
    window.addEventListener("edgify:inbox-update", refresh);
    return () => window.removeEventListener("edgify:inbox-update", refresh);
  }, []);

  // Mark all read when the page mounts (after initial render so badge
  // counts in the rest of the UI clear naturally).
  useEffect(() => {
    const t = window.setTimeout(() => markAllRead(), 200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <p className="label-xs text-edge-cyan">Inbox</p>
          <h1 className="heading-display mt-2 text-4xl">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {items.length} item{items.length === 1 ? "" : "s"}
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => clearInbox()}
            className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55 transition hover:border-edge-coral/40 hover:text-edge-coral"
          >
            Clear all
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="📭"
            title="Inbox empty"
            hint="You'll see match results, level-ups, achievement unlocks, and friend events here as they happen."
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className={
                "rounded-2xl border p-4 transition " +
                (it.read
                  ? "border-white/[0.06] bg-white/[0.015]"
                  : "border-edge-cyan/30 bg-edge-cyan/[0.04]")
              }
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none">
                  {it.emoji || pickKindEmoji(it.kind)}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    {it.title}
                  </p>
                  {it.body && (
                    <p className="mt-1 text-xs leading-relaxed text-white/60">
                      {it.body}
                    </p>
                  )}
                  <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/30">
                    {timeAgo(it.createdAt)}
                  </p>
                </div>
                {it.href && (
                  <Link
                    href={it.href}
                    className="self-center rounded-md border border-white/10 bg-white/[0.02] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65 transition hover:border-edge-cyan/40 hover:text-edge-cyan"
                  >
                    Open →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Footer />
    </main>
  );
}

function pickKindEmoji(k: InboxItem["kind"]): string {
  switch (k) {
    case "match":
      return "⚔️";
    case "levelup":
      return "✨";
    case "achievement":
      return "🏆";
    case "friend":
      return "👥";
    default:
      return "📬";
  }
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}
