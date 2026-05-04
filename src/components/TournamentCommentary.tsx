"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/user-context";

type Comment = {
  id: number;
  user: string;
  text: string;
  ts: number;
};

const LIMIT = 100;
const TIPS = [
  "Big match incoming",
  "GG to both",
  "Sweep alert",
  "Nailed the symmetry",
  "Mogged on ESPN",
  "Coming back from 0-1",
  "Final round nerves",
  "What a clutch"
];

/**
 * Per-tournament commentary feed. Backed by localStorage keyed by the
 * tournament code, so it persists across reloads and survives between
 * matches. Pseudo-real-time within a single device — a future server
 * version would make it cross-user.
 */
export function TournamentCommentary({ code }: { code: string }) {
  const { user } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const idRef = useRef(0);
  const storageKey = `edgify:tourney-comments:${code}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Comment[];
        setComments(parsed);
        idRef.current = parsed.reduce((m, c) => Math.max(m, c.id), 0);
      }
    } catch {
      /* */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          setComments(JSON.parse(e.newValue));
        } catch {
          /* */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  function persist(next: Comment[]) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* */
    }
  }

  function add(t: string) {
    const cleaned = t.trim().slice(0, 140);
    if (!cleaned) return;
    const c: Comment = {
      id: ++idRef.current,
      user: user.username || "ANON",
      text: cleaned,
      ts: Date.now()
    };
    const next = [...comments, c].slice(-LIMIT);
    setComments(next);
    persist(next);
  }

  function quickTip() {
    add(TIPS[Math.floor(Math.random() * TIPS.length)]);
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
      <div className="flex items-center justify-between">
        <p className="label-xs text-edge-cyan">Commentary</p>
        <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">
          {comments.length} note{comments.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-white/[0.04] bg-black/30 p-3 text-xs">
        {comments.length === 0 ? (
          <p className="text-center text-[10px] uppercase tracking-[0.22em] text-white/30">
            No commentary yet — say something
          </p>
        ) : (
          <ul className="space-y-1.5">
            {comments.slice().reverse().map((c) => (
              <li key={c.id}>
                <span className="text-[10px] uppercase tracking-[0.18em] text-edge-cyan">
                  {c.user}
                </span>
                <span className="ml-2 text-white/80">{c.text}</span>
                <span className="ml-2 text-[10px] uppercase tracking-[0.22em] text-white/30">
                  {new Date(c.ts).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(text);
          setText("");
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 140))}
          placeholder="Drop a take…"
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-edge-cyan"
        />
        <button
          type="button"
          onClick={quickTip}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55 transition hover:border-edge-cyan/40 hover:text-edge-cyan"
          title="Insert a quick remark"
        >
          🎤
        </button>
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-lg border border-edge-cyan/40 bg-edge-cyan/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:border-edge-cyan/60 disabled:opacity-40"
        >
          Post
        </button>
      </form>
    </div>
  );
}
