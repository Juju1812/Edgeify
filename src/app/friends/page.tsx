"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/lib/toast-context";
import { rankFromElo } from "@/lib/rank";
import { flagFor } from "@/lib/flag";

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
                <div
                  key={f.username}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
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
                    onClick={() => mutate("remove", f.username)}
                    className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-rose-200 transition hover:border-rose-500/50"
                  >
                    Remove
                  </button>
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
