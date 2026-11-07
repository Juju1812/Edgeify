"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import { Avatar, Button, ButtonLink, Card, Empty, Flag, Notice } from "@/components/ui";
import { ScoreRing, TraitBars, tierLabel } from "@/components/score";
import { challengeFriend } from "@/components/social/helpers";
import { ReportSheet } from "@/components/report-sheet";
import type { PublicProfile } from "@/lib/shared/types";

type Relation = "self" | "friends" | "outgoing" | "incoming" | "none" | "blocked";

export default function ProfilePage({ params }: { params: { username: string } }) {
  const target = decodeURIComponent(params.username);
  const { me, loading: sessionLoading, faceVersion } = useSession();
  const router = useRouter();

  const [user, setUser] = useState<PublicProfile | null>(null);
  const [relation, setRelation] = useState<Relation>("none");
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  async function setBlocked(blocked: boolean) {
    if (requireSignIn() || !user) return;
    if (blocked && !window.confirm(`Block ${user.username}? You won't be matched or able to message each other.`)) return;
    setBusy(blocked ? "block" : "unblock");
    setError(null);
    try {
      await api("/api/blocks", { body: { action: blocked ? "block" : "unblock", username: user.username } });
      setRelation(blocked ? "blocked" : "none");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const load = useCallback(async () => {
    try {
      const r = await api<{ user: PublicProfile; relation: Relation }>(`/api/users/${encodeURIComponent(target)}`);
      setUser(r.user);
      setRelation(r.relation);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError(e instanceof ApiError ? e.message : "Couldn't load this profile.");
    }
  }, [target]);

  // Reload once the session resolves so `relation` reflects who's looking.
  useEffect(() => {
    if (!sessionLoading) load();
  }, [load, sessionLoading, me?.username]);

  function requireSignIn() {
    if (me) return false;
    router.push(`/login?next=${encodeURIComponent(`/u/${target}`)}`);
    return true;
  }

  async function friend(action: "add" | "accept" | "remove") {
    if (requireSignIn() || !user) return;
    setBusy(action);
    setError(null);
    try {
      const r = await api<{ relation: Relation }>("/api/friends", { body: { action, username: user.username } });
      setRelation(r.relation);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function challenge() {
    if (requireSignIn() || !user) return;
    setBusy("challenge");
    setError(null);
    try {
      const code = await challengeFriend(user.username);
      router.push(`/play/room/${code}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create a room.");
      setBusy(null);
    }
  }

  if (notFound) {
    return (
      <main className="page">
        <Card className="mx-auto max-w-lg">
          <Empty
            title="No one by that name"
            body={`We couldn't find a player called “${target}”. Check the spelling and try again.`}
            action={<ButtonLink href="/leaderboard" variant="secondary">Browse the leaderboard</ButtonLink>}
          />
        </Card>
      </main>
    );
  }

  if (!user) return <ProfileSkeleton error={error} />;

  const games = user.wins + user.losses + user.draws;
  const winRate = games ? Math.round((user.wins / games) * 100) : null;

  return (
    <main className="page">
      <div className="grid gap-5 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)] md:gap-6">
        {/* Identity */}
        <Card className="flex flex-col items-center px-6 pb-7 pt-9 text-center">
          <Avatar
            username={user.username}
            hasFace={user.hasFace}
            size={120}
            version={relation === "self" ? faceVersion : undefined}
            online={user.online}
          />
          <h1 className="display mt-5 flex items-center gap-2 text-[30px] leading-tight">
            {user.username}
            <span className="text-[24px]">
              <Flag code={user.country} />
            </span>
          </h1>
          <p className="mt-1 text-[14px] text-ink-3">{user.online ? <span className="text-good">Online now</span> : "Offline"}</p>
          {user.bio && <p className="mt-4 max-w-xs text-[16px] leading-relaxed text-ink-2">{user.bio}</p>}

          <dl className="mt-6 grid w-full grid-cols-3 divide-x divide-line rounded-2xl bg-fill py-3.5">
            <Stat label="Rank" value={user.rank ? `#${user.rank}` : "—"} />
            <Stat label="ELO" value={String(user.elo)} />
            <Stat label="Record" value={`${user.wins}–${user.losses}`} />
          </dl>
          {winRate !== null && (
            <p className="mt-3 text-[13px] text-ink-3">
              {winRate}% win rate over {games} ranked {games === 1 ? "match" : "matches"} · peak {user.peakElo}
            </p>
          )}

          <div className="mt-6 w-full">
            {relation === "blocked" ? (
              <Button variant="plain" className="w-full" loading={busy === "unblock"} onClick={() => setBlocked(false)}>
                Blocked · Unblock
              </Button>
            ) : (
              <Actions relation={relation} busy={busy} username={user.username} onFriend={friend} onChallenge={challenge} />
            )}
          </div>
          {me && relation !== "self" && (
            <div className="mt-4 flex gap-5 text-[13px] text-ink-4">
              {relation !== "blocked" && (
                <button className="hover:text-bad" onClick={() => setBlocked(true)} disabled={busy === "block"}>
                  Block
                </button>
              )}
              <button className="hover:text-bad" onClick={() => setReportOpen(true)}>
                Report
              </button>
            </div>
          )}
          <ReportSheet
            open={reportOpen}
            username={user.username}
            onClose={() => setReportOpen(false)}
            onDone={({ blocked }) => blocked && setRelation("blocked")}
          />
          {error && (
            <div className="mt-4 w-full">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
        </Card>

        {/* Score */}
        <Card className="p-6 sm:p-8">
          {user.overall === null || !user.traits ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <ScoreRing value={null} size={180} label="no score" animate={false} muted />
              <p className="mt-6 text-[19px] font-semibold text-ink">Not scanned yet</p>
              <p className="mt-1 max-w-xs text-[15px] text-ink-3">
                {relation === "self"
                  ? "Scan your face to get your score and trait breakdown."
                  : `${user.username} hasn't scanned their face yet.`}
              </p>
              {relation === "self" && (
                <ButtonLink href="/scan" className="mt-5">
                  Scan now
                </ButtonLink>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
                <ScoreRing value={user.overall} size={200} />
                <div className="text-center sm:text-left">
                  <p className="eyebrow">{tierLabel(user.overall, user.sex)}</p>
                  {user.headline && (
                    <p className="display mt-2 text-[24px] leading-[1.15] sm:text-[28px]">{user.headline}</p>
                  )}
                </div>
              </div>
              <div className="mt-8 border-t border-line pt-6">
                <h2 className="mb-4 text-[19px] font-semibold tracking-tight text-ink">Trait breakdown</h2>
                <TraitBars traits={user.traits} />
              </div>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2">
      <dt className="text-[12px] font-medium text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-[19px] font-semibold tabular-nums tracking-tight text-ink">{value}</dd>
    </div>
  );
}

function Actions({
  relation,
  busy,
  username,
  onFriend,
  onChallenge
}: {
  relation: Relation;
  busy: string | null;
  username: string;
  onFriend: (a: "add" | "accept" | "remove") => void;
  onChallenge: () => void;
}) {
  if (relation === "self") {
    return (
      <ButtonLink href="/settings" variant="plain" className="w-full">
        Edit profile
      </ButtonLink>
    );
  }
  if (relation === "incoming") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[14px] text-ink-3">{username} sent you a friend request.</p>
        <div className="flex gap-2">
          <Button className="flex-1" loading={busy === "accept"} onClick={() => onFriend("accept")}>
            Accept
          </Button>
          <Button variant="plain" className="flex-1" loading={busy === "remove"} onClick={() => onFriend("remove")}>
            Decline
          </Button>
        </div>
      </div>
    );
  }
  if (relation === "outgoing") {
    return (
      <Button variant="plain" className="w-full" loading={busy === "remove"} onClick={() => onFriend("remove")}>
        Requested · Cancel
      </Button>
    );
  }
  if (relation === "friends") {
    return (
      <div className="flex gap-2">
        <ButtonLink href={`/friends/${username}`} variant="plain" className="flex-1">
          Message
        </ButtonLink>
        <Button className="flex-1" loading={busy === "challenge"} onClick={onChallenge}>
          Challenge
        </Button>
        <MoreMenu onRemove={() => onFriend("remove")} removing={busy === "remove"} username={username} />
      </div>
    );
  }
  return (
    <Button className="w-full" loading={busy === "add"} onClick={() => onFriend("add")}>
      Add friend
    </Button>
  );
}

function MoreMenu({ onRemove, removing, username }: { onRemove: () => void; removing: boolean; username: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirm(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="plain"
        aria-label="More options"
        aria-expanded={open}
        className="w-11 !px-0"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5.5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="18.5" cy="12" r="1.8" />
        </svg>
      </Button>
      {open && (
        <div className="absolute bottom-full right-0 z-20 mb-2 w-60 animate-fade-up rounded-2xl bg-white p-1.5 text-left shadow-lift">
          {confirm ? (
            <div className="p-2.5">
              <p className="text-[14px] text-ink-2">Remove {username} from your friends?</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="danger" className="flex-1" loading={removing} onClick={onRemove}>
                  Remove
                </Button>
                <Button size="sm" variant="plain" className="flex-1" onClick={() => setConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirm(true)}
              className="w-full rounded-xl px-3 py-2.5 text-left text-[15px] text-bad transition-colors hover:bg-fill"
            >
              Remove friend
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileSkeleton({ error }: { error: string | null }) {
  return (
    <main className="page">
      {error && (
        <div className="mb-5">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)] md:gap-6">
        <Card className="flex flex-col items-center px-6 pb-7 pt-9">
          <span className="h-[120px] w-[120px] animate-pulse rounded-full bg-fill-2" />
          <span className="mt-5 h-7 w-40 animate-pulse rounded-full bg-fill-2" />
          <span className="mt-2 h-4 w-20 animate-pulse rounded-full bg-fill" />
          <span className="mt-6 h-[70px] w-full animate-pulse rounded-2xl bg-fill" />
          <span className="mt-6 h-11 w-full animate-pulse rounded-full bg-fill" />
        </Card>
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <span className="h-[200px] w-[200px] animate-pulse rounded-full bg-fill" />
            <span className="flex flex-col gap-3">
              <span className="h-3 w-24 animate-pulse rounded-full bg-fill" />
              <span className="h-7 w-64 animate-pulse rounded-full bg-fill-2" />
            </span>
          </div>
          <div className="mt-8 flex flex-col gap-4 border-t border-line pt-6">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className="h-3 w-full animate-pulse rounded-full bg-fill" />
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
