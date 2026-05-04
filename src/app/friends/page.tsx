"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Footer } from "@/components/Footer";
import { OwnerBadge } from "@/components/OwnerBadge";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/lib/toast-context";
import { rankFromElo } from "@/lib/rank";
import { flagFor } from "@/lib/flag";
import { appendDm, getThread, type DmMessage } from "@/lib/dms";

type Friend = {
  username: string;
  online: boolean;
  elo: number;
  faceDataUrl: string | null;
  countryCode: string | null;
};

export default function FriendsPage() {
  const { authedRemote, status } = useUser();
  const { toast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [add, setAdd] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const token = localStorage.getItem("edgify:auth:token:v1");
      if (!token) {
        setFriends([]);
        return;
      }
      const res = await fetch("/api/friends", {
        headers: { authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        setFriends([]);
        return;
      }
      const data = await res.json();
      setFriends(data.friends || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authedRemote) refresh();
    else setLoading(false);
  }, [authedRemote]);

  async function mutate(action: "add" | "remove", target: string) {
    setBusy(true);
    try {
      const token = localStorage.getItem("edgify:auth:token:v1");
      if (!token) return;
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, target })
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error === "no_such_user" ? "No such user." : "Couldn't update friends.", { kind: "error" });
        return;
      }
      if (action === "add") toast(`Added ${target}`, { kind: "success", emoji: "🤝" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (status === "guest") {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 pt-10">
        <p className="text-sm text-white/40">Sign in to manage friends.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link href="/" className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white">
        ← Back to Lobby
      </Link>
      <div className="mt-6">
        <p className="label-xs">Friends</p>
        <h1 className="heading-card mt-2 text-3xl">Your Crew</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (add.trim().length >= 2) mutate("add", add.trim());
          setAdd("");
        }}
        className="glass mt-6 flex gap-2 rounded-xl p-3"
      >
        <input
          value={add}
          onChange={(e) => setAdd(e.target.value.slice(0, 16).replace(/[^A-Za-z0-9_-]/g, ""))}
          placeholder="Add by callsign…"
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm uppercase tracking-[0.18em] text-white outline-none focus:border-mog-violet"
        />
        <button
          type="submit"
          disabled={busy || add.trim().length < 2}
          className="rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30 disabled:opacity-40"
        >
          Add
        </button>
      </form>

      <div className="mt-6">
        {loading ? (
          <div className="glass h-32 animate-pulse rounded-2xl" />
        ) : friends.length === 0 ? (
          <div className="glass rounded-2xl px-6 py-12 text-center">
            <p className="text-sm text-white/50">No friends yet.</p>
            <p className="mt-1 text-xs text-white/30">
              Add by callsign above. They&apos;ll appear here with online status.
            </p>
          </div>
        ) : (
          <div className="glass divide-y divide-white/[0.04] overflow-hidden rounded-2xl">
            {friends.map((f) => {
              const rank = rankFromElo(f.elo);
              return (
                <div key={f.username}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <Link
                      href={`/u/${encodeURIComponent(f.username)}`}
                      className="flex flex-1 items-center gap-3 truncate"
                    >
                      {f.faceDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.faceDataUrl}
                          alt=""
                          className="h-10 w-10 rounded-lg border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-base">
                          {rank.emoji}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold uppercase tracking-[0.16em] text-white">
                          {f.countryCode && (
                            <span className="mr-2">{flagFor(f.countryCode)}</span>
                          )}
                          {f.username}
                          <OwnerBadge name={f.username} size="xs" />
                          <span
                            className={
                              "ml-2 inline-block h-2 w-2 rounded-full " +
                              (f.online ? "bg-emerald-400" : "bg-white/20")
                            }
                          />
                        </p>
                        <p
                          className="text-[10px] uppercase tracking-[0.22em]"
                          style={{ color: rank.color }}
                        >
                          {rank.label} · {f.elo}
                        </p>
                      </div>
                    </Link>
                    <button
                      onClick={() =>
                        setChatOpen(chatOpen === f.username ? null : f.username)
                      }
                      className="rounded-md border border-edge-cyan/30 bg-edge-cyan/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:border-edge-cyan/60"
                    >
                      {chatOpen === f.username ? "Close" : "DM"}
                    </button>
                    <button
                      onClick={() => mutate("remove", f.username)}
                      className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-rose-200 transition hover:border-rose-500/50"
                    >
                      Remove
                    </button>
                  </div>
                  <AnimatePresence>
                    {chatOpen === f.username && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-white/[0.04] bg-black/30"
                      >
                        <DmThread friend={f.username} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}

/**
 * Inline DM thread that lives inside an expanded friend row. Messages
 * are local-only (no server delivery yet) but persist across reloads
 * via localStorage. Designed as the scaffolding for a future real-time
 * DM system.
 */
function DmThread({ friend }: { friend: string }) {
  const [msgs, setMsgs] = useState<DmMessage[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const refresh = () => setMsgs(getThread(friend));
    refresh();
    window.addEventListener("edgify:dm-update", refresh);
    return () => window.removeEventListener("edgify:dm-update", refresh);
  }, [friend]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim().slice(0, 280);
    if (!t) return;
    appendDm(friend, { from: "me", text: t });
    setText("");
  }

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/[0.05] bg-black/40 p-3 text-xs">
        {msgs.length === 0 ? (
          <p className="text-center text-[10px] uppercase tracking-[0.22em] text-white/30">
            No messages yet · device-local
          </p>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className={m.from === "me" ? "text-right" : "text-left"}>
              <span
                className={
                  "inline-block max-w-[80%] rounded-lg px-3 py-1.5 " +
                  (m.from === "me"
                    ? "bg-edge-cyan/15 text-edge-cyan"
                    : "bg-white/[0.04] text-white/80")
                }
              >
                {m.text}
              </span>
            </div>
          ))
        )}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
          placeholder={`Message ${friend}…`}
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-edge-cyan"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-lg border border-edge-cyan/40 bg-edge-cyan/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:border-edge-cyan disabled:opacity-40"
        >
          Send
        </button>
      </form>
      <p className="text-[9px] uppercase tracking-[0.22em] text-white/30">
        DMs are stored on this device only.
      </p>
    </div>
  );
}
