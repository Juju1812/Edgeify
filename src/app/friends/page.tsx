"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { api, ApiError } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import { Avatar, Button, Card, Empty, Input, Notice, PageTitle } from "@/components/ui";
import {
  challengeFriend,
  relativeTime,
  Segmented,
  SkeletonRow,
  useVisiblePoll
} from "@/components/social/helpers";

type FriendRow = { username: string; online: boolean; elo: number; overall: number | null; hasFace: boolean };
type Conversation = {
  with: string;
  lastAt: number;
  last: { from: string; text: string; at: number } | null;
  unread: boolean;
};
type Tab = "friends" | "messages";

export default function FriendsPage() {
  return (
    <Suspense fallback={<main className="page" />}>
      <FriendsInner />
    </Suspense>
  );
}

function FriendsInner() {
  const { me, loading } = useSession();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "messages" ? "messages" : "friends";

  useEffect(() => {
    if (!loading && !me) router.replace(`/login?next=${encodeURIComponent(path + (tab === "messages" ? "?tab=messages" : ""))}`);
  }, [loading, me, router, path, tab]);

  const [unread, setUnread] = useState(0);

  const setTab = (t: Tab) => router.replace(t === "messages" ? "/friends?tab=messages" : "/friends", { scroll: false });

  if (!me) return <main className="page" />;

  return (
    <main className="page">
      <PageTitle title="Friends" subtitle="Your people, your messages, your face-offs." />
      <Segmented
        className="mb-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: "friends", label: "Friends" },
          {
            value: "messages",
            label: (
              <>
                Messages
                {unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">
                    {unread}
                  </span>
                )}
              </>
            )
          }
        ]}
      />
      {/* Both tabs stay mounted so the unread badge keeps updating. */}
      <div hidden={tab !== "friends"}>
        <FriendsTab />
      </div>
      <div hidden={tab !== "messages"}>
        <MessagesTab active={tab === "messages"} onUnread={setUnread} />
      </div>
    </main>
  );
}

/* ───────────────────────────── Friends tab ───────────────────────────── */

function FriendsTab() {
  const router = useRouter();
  const { me } = useSession();
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [incoming, setIncoming] = useState<FriendRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ friends: FriendRow[]; incoming: FriendRow[] }>("/api/friends");
      setFriends(r.friends);
      setIncoming(r.incoming);
      setLoadError(null);
    } catch (e) {
      if (e instanceof ApiError) setLoadError(e.message);
    }
  }, []);
  const shownError = error ?? loadError;

  useVisiblePoll(load, 20_000);

  async function act(action: "add" | "accept" | "remove", username: string) {
    setBusy(`${action}:${username}`);
    setError(null);
    try {
      await api("/api/friends", { body: { action, username } });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function challenge(username: string) {
    setBusy(`challenge:${username}`);
    setError(null);
    try {
      const code = await challengeFriend(username);
      router.push(`/play/room/${code}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create a room.");
      setBusy(null);
    }
  }

  const friendNames = new Set((friends || []).map((f) => f.username.toLowerCase()));

  return (
    <div className="flex flex-col gap-6">
      <SearchCard
        myName={me?.username || ""}
        friendNames={friendNames}
        onAdded={load}
        onError={setError}
      />

      {shownError && <Notice tone="error">{shownError}</Notice>}

      {incoming.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3 px-1">Requests · {incoming.length}</h2>
          <Card className="divide-y divide-line overflow-hidden">
            {incoming.map((f) => (
              <div key={f.username} className="flex items-center gap-3 px-4 py-3.5">
                <Link href={`/u/${f.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar username={f.username} hasFace={f.hasFace} size={44} />
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-semibold text-ink">{f.username}</span>
                    <span className="block text-[13px] text-ink-3">Wants to be friends</span>
                  </span>
                </Link>
                <Button size="sm" loading={busy === `accept:${f.username}`} onClick={() => act("accept", f.username)}>
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="plain"
                  loading={busy === `remove:${f.username}`}
                  onClick={() => act("remove", f.username)}
                >
                  Decline
                </Button>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section>
        <h2 className="eyebrow mb-3 px-1">
          {friends ? `Friends · ${friends.length}` : "Friends"}
        </h2>
        <Card className="overflow-hidden">
          {friends === null ? (
            <div className="divide-y divide-line">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : friends.length === 0 ? (
            <Empty
              title="No friends yet"
              body="Search for a username above to send a request. Friends can message you and challenge you to private face-offs."
            />
          ) : (
            <ul className="divide-y divide-line">
              {friends.map((f) => (
                <li key={f.username} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:flex-nowrap">
                  <Link href={`/u/${f.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar username={f.username} hasFace={f.hasFace} size={44} online={f.online} />
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-semibold text-ink">{f.username}</span>
                      <span className="block text-[13px] text-ink-3">
                        {f.online ? <span className="text-good">Online</span> : "Offline"}
                        <span className="mx-1.5 text-ink-4">·</span>
                        {f.overall !== null ? `Score ${f.overall}` : "No score yet"}
                        <span className="mx-1.5 text-ink-4">·</span>
                        <span className="tabular-nums">{f.elo} ELO</span>
                      </span>
                    </span>
                  </Link>
                  <div className="flex w-full gap-2 pl-14 sm:w-auto sm:pl-0">
                    <Link
                      href={`/friends/${f.username}`}
                      className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-fill px-4 text-[14px] font-medium text-ink transition-colors hover:bg-fill-2 sm:flex-none"
                    >
                      Message
                    </Link>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 sm:flex-none"
                      loading={busy === `challenge:${f.username}`}
                      onClick={() => challenge(f.username)}
                    >
                      Challenge
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function SearchCard({
  myName,
  friendNames,
  onAdded,
  onError
}: {
  myName: string;
  friendNames: Set<string>;
  onAdded: () => void;
  onError: (m: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [sent, setSent] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      setSearching(false);
      return;
    }
    if (!/^[A-Za-z0-9_-]{1,16}$/.test(term)) {
      setResults([]);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await api<{ results: string[] }>(`/api/users/search?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal
        });
        setResults(r.results.filter((n) => n.toLowerCase() !== myName.toLowerCase()));
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, myName]);

  async function add(username: string) {
    setAdding(username);
    onError(null);
    try {
      const r = await api<{ relation: string }>("/api/friends", { body: { action: "add", username } });
      setSent((s) => ({ ...s, [username.toLowerCase()]: r.relation }));
      onAdded();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Couldn't send that request.");
    } finally {
      setAdding(null);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <label className="relative block">
        <span className="sr-only">Find players by username</span>
        <svg
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-4"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
          <path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find players by username"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="bg-fill pl-11 focus:bg-white"
          maxLength={16}
        />
      </label>

      {q.trim() && (
        <div className="mt-2">
          {searching && results === null ? (
            <SkeletonRow />
          ) : results && results.length === 0 ? (
            <p className="px-2 py-4 text-center text-[14px] text-ink-3">
              {searching ? "Searching…" : `No players found for “${q.trim()}”.`}
            </p>
          ) : (
            <ul className={clsx("divide-y divide-line", searching && "opacity-60")}>
              {(results || []).map((name) => {
                const lc = name.toLowerCase();
                const state = friendNames.has(lc) ? "friends" : sent[lc];
                return (
                  <li key={name} className="flex items-center gap-3 px-1 py-2.5">
                    <Link href={`/u/${name}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar username={name} hasFace size={40} />
                      <span className="truncate text-[16px] font-medium text-ink">{name}</span>
                    </Link>
                    {state === "friends" ? (
                      <span className="px-3 text-[14px] text-ink-3">Friends</span>
                    ) : state === "outgoing" ? (
                      <span className="px-3 text-[14px] text-ink-3">Requested</span>
                    ) : (
                      <Button size="sm" variant="secondary" loading={adding === name} onClick={() => add(name)}>
                        Add
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────────── Messages tab ──────────────────────────── */

function MessagesTab({ active, onUnread }: { active: boolean; onUnread: (n: number) => void }) {
  const { me } = useSession();
  const [convos, setConvos] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ conversations: Conversation[]; unread: number }>("/api/messages");
      setConvos(r.conversations);
      onUnread(r.unread);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }, [onUnread]);

  // Poll faster while the tab is in view; slowly otherwise for the badge.
  useVisiblePoll(load, active ? 8_000 : 30_000);

  if (error && !convos) return <Notice tone="error">{error}</Notice>;

  return (
    <Card className="overflow-hidden">
      {convos === null ? (
        <div className="divide-y divide-line">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : convos.length === 0 ? (
        <Empty
          title="No messages yet"
          body="Open a friend and say hi — or challenge them to a private face-off."
        />
      ) : (
        <ul className="divide-y divide-line">
          {convos.map((c) => {
            const mine = c.last && me && c.last.from.toLowerCase() === me.username.toLowerCase();
            return (
              <li key={c.with}>
                <Link
                  href={`/friends/${c.with}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-fill/60"
                >
                  <Avatar username={c.with} hasFace size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={clsx("truncate text-[16px] text-ink", c.unread ? "font-bold" : "font-semibold")}>
                        {c.with}
                      </span>
                      <span className="shrink-0 text-[13px] text-ink-3">{relativeTime(c.lastAt)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className={clsx("truncate text-[14px]", c.unread ? "text-ink" : "text-ink-3")}>
                        {c.last ? `${mine ? "You: " : ""}${c.last.text}` : "No messages"}
                      </span>
                      {c.unread && <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
