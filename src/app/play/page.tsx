"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/client/session";
import { api, ApiError } from "@/lib/client/api";
import { Button, ButtonLink, Card, Input, Notice, PageTitle, Spinner } from "@/components/ui";
import { CenteredSpinner, cleanCode } from "@/components/play/common";

export default function PlayPage() {
  return (
    <Suspense fallback={<main className="page"><CenteredSpinner /></main>}>
      <PlayHub />
    </Suspense>
  );
}

function PlayHub() {
  const { me, loading } = useSession();
  const router = useRouter();
  const params = useSearchParams();

  if (loading) {
    return (
      <main className="page">
        <CenteredSpinner />
      </main>
    );
  }

  if (!me) {
    return (
      <main className="page">
        <PageTitle title="Play" subtitle="Live 1v1 face-offs, judged by AI." />
        <Card className="p-8 text-center md:p-12">
          <p className="text-[22px] font-semibold tracking-tight">Sign in to play</p>
          <p className="mx-auto mt-2 max-w-sm text-[15px] text-ink-3">
            Create a free account to face off against real people and climb the leaderboard.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <ButtonLink href="/login?next=/play" variant="plain">
              Sign in
            </ButtonLink>
            <ButtonLink href="/signup?next=/play">Get started</ButtonLink>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="page">
      <PageTitle title="Play" subtitle="Live 1v1 face-offs, judged by AI." />
      <div className="grid gap-5 md:grid-cols-2">
        <RankedCard
          hasScore={!!me.score}
          autoStart={params.get("search") === "1"}
          onAutoStarted={() => router.replace("/play")}
          placementsLeft={me.placementsLeft}
          elo={me.elo}
        />
        <div className="flex flex-col gap-5">
          <CodeCard
            kind="room"
            title="Private room"
            body="Play a friend 1v1. Unranked — no ELO on the line."
          />
          <CodeCard
            kind="tourney"
            title="Tournament"
            body="Four players, one bracket, one champion. Unranked."
          />
        </div>
      </div>
    </main>
  );
}

function formatElapsed(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function RankedCard({
  hasScore,
  autoStart,
  onAutoStarted,
  placementsLeft,
  elo
}: {
  hasScore: boolean;
  autoStart: boolean;
  onAutoStarted: () => void;
  placementsLeft: number;
  elo: number;
}) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [inQueue, setInQueue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchingRef = useRef(false);
  const startedAt = useRef(0);

  const stop = useCallback((keepalive = false) => {
    if (!searchingRef.current) return;
    searchingRef.current = false;
    setSearching(false);
    api("/api/match/queue", { method: "DELETE", keepalive }).catch(() => {});
  }, []);

  const start = useCallback(async () => {
    if (searchingRef.current) return;
    setError(null);
    searchingRef.current = true;
    setSearching(true);
    setElapsed(0);
    startedAt.current = Date.now();

    while (searchingRef.current) {
      try {
        const r = await api<{ matchId: string | null; inQueue: number }>("/api/match/queue", { method: "POST" });
        if (!searchingRef.current) break;
        setInQueue(r.inQueue);
        if (r.matchId) {
          searchingRef.current = false;
          router.push(`/play/match/${r.matchId}`);
          return;
        }
      } catch (e) {
        if (e instanceof ApiError && e.status !== 503) {
          searchingRef.current = false;
          setSearching(false);
          setError(e.message);
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }, [router]);

  // Elapsed clock
  useEffect(() => {
    if (!searching) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [searching]);

  // ?search=1 (from "Play again")
  const autoDone = useRef(false);
  useEffect(() => {
    if (autoStart && hasScore && !autoDone.current) {
      autoDone.current = true;
      onAutoStarted();
      start();
    }
  }, [autoStart, hasScore, onAutoStarted, start]);

  // Leave the queue if the user navigates away or closes the tab. The
  // deferred check skips React strict-mode's simulated unmount in dev.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const onHide = () => stop(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      mounted.current = false;
      window.removeEventListener("pagehide", onHide);
      setTimeout(() => {
        if (!mounted.current) stop(true);
      }, 0);
    };
  }, [stop]);

  return (
    <Card className="flex flex-col p-7 md:p-9">
      <p className="eyebrow">Ranked</p>
      <h2 className="mt-2 text-[30px] font-bold leading-tight tracking-tighter md:text-[36px]">1v1 face-off</h2>
      <p className="mt-2 max-w-md text-[16px] text-ink-3">
        Get matched with someone near your rating. You both scan live on camera — the AI scores
        both faces and the higher score takes the ELO.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-[14px]">
        <span className="rounded-full bg-fill px-3 py-1 text-ink-2">
          ELO <span className="font-semibold tabular-nums text-ink">{elo}</span>
        </span>
        {placementsLeft > 0 && (
          <span className="rounded-full bg-accent-soft px-3 py-1 text-accent-ink">
            {placementsLeft} placement {placementsLeft === 1 ? "match" : "matches"} left
          </span>
        )}
      </div>

      <div className="mt-auto pt-8">
        {!hasScore ? (
          <div className="rounded-2xl bg-fill p-5">
            <p className="text-[15px] font-semibold">Get your score first</p>
            <p className="mt-1 text-[14px] text-ink-3">Ranked play needs a face scan so we can match you fairly.</p>
            <ButtonLink href="/scan" className="mt-4">
              Scan your face
            </ButtonLink>
          </div>
        ) : searching ? (
          <div className="flex flex-col items-start gap-4 rounded-2xl bg-fill p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Spinner className="h-6 w-6" />
              <div>
                <p className="text-[16px] font-semibold">Finding an opponent…</p>
                <p className="text-[14px] tabular-nums text-ink-3">
                  {formatElapsed(elapsed)}
                  {inQueue !== null && inQueue > 1 && ` · ${inQueue - 1} other${inQueue - 1 === 1 ? "" : "s"} searching`}
                </p>
              </div>
            </div>
            <Button variant="plain" onClick={() => stop()}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="lg" onClick={start} className="w-full sm:w-auto">
            Find a match
          </Button>
        )}
        {error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
      </div>
    </Card>
  );
}

function CodeCard({ kind, title, body }: { kind: "room" | "tourney"; title: string; body: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = kind === "room" ? "/play/room" : "/play/tourney";

  async function create() {
    setCreating(true);
    setError(null);
    try {
      if (kind === "room") {
        const r = await api<{ room: { code: string } }>("/api/rooms", { method: "POST" });
        router.push(`${base}/${r.room.code}`);
      } else {
        const r = await api<{ tourney: { code: string } }>("/api/tourney", { method: "POST" });
        router.push(`${base}/${r.tourney.code}`);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create it. Try again.");
      setCreating(false);
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    if (code.length === 6) router.push(`${base}/${code}`);
  }

  return (
    <Card className="p-7">
      <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-[15px] text-ink-3">{body}</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button variant="secondary" onClick={create} loading={creating} className="sm:shrink-0">
          Create
        </Button>
        <form onSubmit={join} className="flex flex-1 gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            placeholder="Enter code"
            aria-label={`${title} code`}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="h-11 font-mono tracking-[0.2em] placeholder:font-sans placeholder:tracking-normal"
          />
          <Button type="submit" variant="plain" disabled={code.length !== 6}>
            Join
          </Button>
        </form>
      </div>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>
  );
}
