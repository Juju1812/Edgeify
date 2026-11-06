"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import { api } from "@/lib/client/api";

/** "now", "5m", "3h", "Yesterday", "Mon", "12 Mar" — iMessage-style. */
export function relativeTime(at: number, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 45) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = new Date(at);
  const today = new Date(now);
  const yesterday = new Date(now - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  if (today.getTime() - d.getTime() < 6 * 86400000) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Run `fn` now and every `ms` while the tab is visible. Re-runs
 * immediately when the tab becomes visible again.
 */
export function useVisiblePoll(fn: () => void | Promise<void>, ms: number, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const run = () => {
      if (alive && document.visibilityState === "visible") void ref.current();
    };
    run();
    const t = setInterval(run, ms);
    const onVis = () => run();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, enabled]);
}

/** Create a private room, DM the invite to `friend`, return the code. */
export async function challengeFriend(friend: string): Promise<string> {
  const { room } = await api<{ room: { code: string } }>("/api/rooms", { method: "POST" });
  const origin = typeof window !== "undefined" ? window.location.origin : "https://edgify.cc";
  await api(`/api/messages/${encodeURIComponent(friend)}`, {
    body: { text: `Face-off? Join my room: ${origin}/play/room/${room.code}` }
  }).catch(() => {
    /* Room still works even if the DM fails (e.g. no longer friends). */
  });
  return room.code;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={clsx("inline-flex rounded-full bg-fill-2 p-1", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={clsx(
              "relative flex h-9 min-w-[112px] items-center justify-center gap-1.5 rounded-full px-5 text-[14px] font-medium transition-all duration-200",
              on ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.1)]" : "text-ink-3 hover:text-ink"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-fill-2" />
      <span className="flex flex-1 flex-col gap-2">
        <span className="h-3.5 w-32 animate-pulse rounded-full bg-fill-2" />
        <span className="h-3 w-20 animate-pulse rounded-full bg-fill" />
      </span>
    </div>
  );
}

const ROOM_RE = /\/play\/room\/([A-HJ-NP-Z2-9]{6})\b/i;
const URL_RE = /(https?:\/\/[^\s]+)/g;

/** Render message text with links; room invites become a "Join face-off" pill. */
export function Linkified({ text, mine }: { text: string; mine: boolean }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (!/^https?:\/\//.test(part)) return <span key={i}>{part}</span>;
        const room = part.match(ROOM_RE);
        if (room) {
          return (
            <Link
              key={i}
              href={`/play/room/${room[1].toUpperCase()}`}
              className={clsx(
                "my-1 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] font-semibold no-underline",
                mine ? "bg-white text-accent" : "bg-accent text-white"
              )}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />
              </svg>
              Join face-off · {room[1].toUpperCase()}
            </Link>
          );
        }
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={clsx("break-all underline underline-offset-2", mine ? "text-white" : "text-accent-ink")}
          >
            {part}
          </a>
        );
      })}
    </>
  );
}
