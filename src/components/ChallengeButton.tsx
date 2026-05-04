"use client";

import { useState } from "react";

/**
 * "Challenge" CTA on a public profile. Sends a challenge entry to the
 * target's /api/challenges queue. They see it on their /challenges
 * page next time they load.
 */
export function ChallengeButton({ target }: { target: string }) {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function send() {
    if (sending || done) return;
    setSending(true);
    setErr(null);
    try {
      const token = localStorage.getItem("edgify:auth:token:v1");
      if (!token) {
        setErr("Sign in to send challenges.");
        return;
      }
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ target, message: message.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.message || data.error || "Failed.");
      } else {
        setDone(true);
      }
    } catch (e) {
      setErr((e as Error).message || "Network error.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <p className="label-xs text-edge-coral">Send challenge</p>
      <p className="mt-1 text-sm text-white/55">
        They&apos;ll see it on their /challenges page next time they load
        Edgify.
      </p>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 140))}
        placeholder="Optional taunt (140 chars)"
        className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-edge-coral"
      />
      <button
        onClick={send}
        disabled={sending || done}
        className="mt-3 w-full rounded-lg border border-edge-coral/50 bg-edge-coral/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-coral/25 disabled:opacity-40"
      >
        {done ? "Sent ✓" : sending ? "Sending…" : "⚔️ Challenge"}
      </button>
      {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
    </div>
  );
}
