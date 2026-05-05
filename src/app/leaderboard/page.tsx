"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Footer } from "@/components/Footer";
import { OwnerBadge } from "@/components/OwnerBadge";
import { rankFromElo } from "@/lib/rank";
import { flagFor } from "@/lib/flag";
import { useUser } from "@/lib/user-context";

type Entry = {
  username: string;
  elo: number;
  wins: number;
  losses: number;
  edgeScore: number;
  faceDataUrl: string | null;
  countryCode?: string | null;
  updatedAt?: number;
};

export default function LeaderboardPage() {
  const { user, status } = useUser();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"global" | "friends" | "daily" | "weekly">("global");
  const [region, setRegion] = useState<"world" | "country">("world");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setEntries(data.entries || []);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If our local profile is fresher than what the server has, our entry
  // might be slightly stale. Patch the local entry in-memory so the
  // user always sees their own latest stats at the right rank.
  const all = useMemo<Entry[]>(() => {
    if (
      status !== "ranked" ||
      !user.username ||
      user.hideFromBoard ||
      !user.hasScanned
    ) {
      return entries;
    }
    const rest = entries.filter(
      (e) => e.username.toLowerCase() !== user.username!.toLowerCase()
    );
    rest.push({
      username: user.username,
      elo: user.elo,
      wins: user.wins,
      losses: user.losses,
      edgeScore: Math.round(user.edgeScore?.composite ?? 50),
      faceDataUrl: user.faceDataUrl,
      countryCode: user.countryCode
    });
    return rest.sort((a, b) => b.elo - a.elo);
  }, [entries, user, status]);

  const friendsSet = useMemo(() => {
    const s = new Set<string>();
    for (const f of user.friends) s.add(f.toLowerCase());
    if (user.username) s.add(user.username.toLowerCase());
    return s;
  }, [user.friends, user.username]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const myCountry = (user.countryCode || "").toUpperCase();
    return all
      .filter((u) => {
        if (tab === "friends") return friendsSet.has(u.username.toLowerCase());
        if (tab === "daily") {
          // Active within the last 24h. If updatedAt is missing (older
          // entries), include them so the board isn't empty for new users.
          return !u.updatedAt || now - u.updatedAt < dayMs;
        }
        if (tab === "weekly") {
          return !u.updatedAt || now - u.updatedAt < 7 * dayMs;
        }
        return true;
      })
      .filter((u) => {
        if (region === "world") return true;
        if (!myCountry) return true; // no country set -> no-op filter
        return (u.countryCode || "").toUpperCase() === myCountry;
      })
      .filter(
        (u) => !query || u.username.toLowerCase().includes(query.toLowerCase())
      );
  }, [all, query, tab, region, friendsSet, user.countryCode]);

  const myIndex = all.findIndex(
    (u) => u.username.toLowerCase() === user.username?.toLowerCase()
  );
  const myRank = myIndex >= 0 ? myIndex + 1 : null;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 transition hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-xs text-edge-cyan">Season 1</p>
          <h1 className="heading-display mt-2 text-4xl">Leaderboard</h1>
          <p className="mt-1 text-sm text-white/50">
            {loading
              ? "Loading…"
              : tab === "friends"
                ? `${filtered.length} friend${filtered.length === 1 ? "" : "s"} on the board`
                : `Top ${all.length} ranked players`}
          </p>
        </div>
        {myRank !== null && (
          <div className="glass rounded-xl px-4 py-3 text-right">
            <p className="label-xs text-white/40">Your position</p>
            <p className="stat-mono text-xl text-edge-cyan">#{myRank}</p>
          </div>
        )}
      </div>

      {all.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="inline-flex flex-wrap rounded-lg border border-white/10 bg-black/30 p-1">
            <TabButton active={tab === "global"} onClick={() => setTab("global")}>
              Global
            </TabButton>
            <TabButton active={tab === "weekly"} onClick={() => setTab("weekly")}>
              Weekly
            </TabButton>
            <TabButton active={tab === "daily"} onClick={() => setTab("daily")}>
              Daily
            </TabButton>
            <TabButton active={tab === "friends"} onClick={() => setTab("friends")}>
              Friends ({user.friends.length})
            </TabButton>
          </div>
          {user.countryCode && (
            <div className="inline-flex flex-wrap rounded-lg border border-white/10 bg-black/30 p-1">
              <TabButton active={region === "world"} onClick={() => setRegion("world")}>
                🌎 World
              </TabButton>
              <TabButton
                active={region === "country"}
                onClick={() => setRegion("country")}
                title={`Players in ${user.countryCode.toUpperCase()}`}
              >
                {flagFor(user.countryCode) || "🌐"} My country
              </TabButton>
            </div>
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search username…"
            className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm uppercase tracking-[0.18em] text-white placeholder:text-white/30 outline-none focus:border-edge-cyan"
          />
        </div>
      )}

      {!loading && all.length === 0 ? (
        <div className="glass mt-6 rounded-2xl px-6 py-16 text-center">
          <div className="text-5xl">👑</div>
          <h2 className="heading-card mt-4 text-2xl">No ranked players yet</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/50">
            Be the first to climb the Edgify leaderboard. Calibrate in The Lab,
            finish your 5 placement matches, and you&apos;ll appear here.
          </p>
          <Link
            href="/lab"
            className="mt-6 inline-block rounded-lg border border-edge-cyan/50 bg-edge-cyan/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-edge-cyan/30"
          >
            Open The Lab →
          </Link>
        </div>
      ) : (
        <div className="glass mt-6 overflow-hidden rounded-2xl">
          <div className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-4 border-b border-white/[0.04] px-5 py-3 text-[10px] uppercase tracking-[0.32em] text-white/40">
            <span>#</span>
            <span>User</span>
            <span className="text-right">W/L</span>
            <span className="text-right">Score</span>
            <span className="text-right">ELO</span>
          </div>
          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-white/40">
              Loading global rankings…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-white/40">
              No matches.
            </div>
          ) : (
            filtered.map((u, i) => {
              const rank = rankFromElo(u.elo);
              const isMe =
                user.username?.toLowerCase() === u.username.toLowerCase();
              return (
                <div
                  key={u.username}
                  className={
                    "grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-4 border-b border-white/[0.02] px-5 py-3 text-sm transition " +
                    (isMe ? "bg-edge-cyan/10" : "hover:bg-white/[0.02]")
                  }
                >
                  <span className="font-mono text-white/40">#{i + 1}</span>
                  <div className="flex items-center gap-3 truncate">
                    <Avatar name={u.username} faceDataUrl={u.faceDataUrl} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold uppercase tracking-[0.16em] text-white">
                        {u.countryCode && (
                          <span className="mr-2" title={u.countryCode}>
                            {flagFor(u.countryCode)}
                          </span>
                        )}
                        {u.username}
                        <OwnerBadge name={u.username} size="sm" />
                        {isMe && (
                          <span className="ml-2 rounded-full bg-edge-cyan/20 px-2 py-0.5 text-[9px] tracking-[0.22em] text-edge-cyan">
                            YOU
                          </span>
                        )}
                      </p>
                      <p
                        className="text-[10px] uppercase tracking-[0.22em]"
                        style={{ color: rank.color }}
                      >
                        <span aria-hidden>{rank.emoji}</span> {rank.label}
                      </p>
                    </div>
                  </div>
                  <span className="text-right text-xs text-white/60">
                    {u.wins}/{u.losses}
                  </span>
                  <span className="text-right font-mono text-xs text-white/80">
                    {Math.round(u.edgeScore)}
                  </span>
                  <span className="text-right font-semibold text-cyan-300">
                    {u.elo}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      <Footer />
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
  title
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        "rounded-md px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] transition " +
        (active
          ? "bg-edge-cyan/20 text-edge-cyan"
          : "text-white/45 hover:text-white/80")
      }
    >
      {children}
    </button>
  );
}

function Avatar({
  name,
  faceDataUrl
}: {
  name: string;
  faceDataUrl: string | null;
}) {
  if (faceDataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={faceDataUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-lg border border-white/10 object-cover"
      />
    );
  }
  const initials = name.replace(/[0-9]+$/g, "").slice(0, 2).toUpperCase();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[11px] font-semibold uppercase tracking-wider"
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 22%), hsl(${(hue + 40) % 360}, 60%, 12%))`,
        color: `hsl(${hue}, 70%, 80%)`
      }}
    >
      {initials}
    </div>
  );
}
