"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { api, ApiError } from "@/lib/client/api";
import { Avatar, Button, ButtonLink, Card, Notice, PageTitle } from "@/components/ui";
import { CenteredSpinner, ErrorCard, copyText, useRequireSignIn } from "@/components/play/common";

type Bracket = { id: string | null; a: string | null; b: string | null; winner: string | null };
type Tourney = {
  code: string;
  host: string;
  createdAt: number;
  state: "lobby" | "running" | "done";
  players: string[];
  bracket: Bracket[];
  champion: string | null;
};
type Resp = { tourney: Tourney; myMatch: string | null };

const SIZE = 4;
const navKey = (id: string) => `edgify:tourney-nav:${id}`;

export default function TourneyPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { me } = useRequireSignIn();
  const router = useRouter();
  const [data, setData] = useState<Resp | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const triedJoin = useRef(false);

  const myName = me?.username.toLowerCase();

  // Poll the tournament; auto-join an open lobby.
  useEffect(() => {
    if (!myName) return;
    let stop = false;
    const load = async () => {
      try {
        let r = await api<Resp>(`/api/tourney/${code}`);
        const inIt = r.tourney.players.some((p) => p.toLowerCase() === myName);
        if (!inIt && r.tourney.state === "lobby" && !triedJoin.current) {
          triedJoin.current = true;
          try {
            r = await api<Resp>(`/api/tourney/${code}`, { body: { action: "join" } });
          } catch (e) {
            setError(e instanceof ApiError ? e.message : "Couldn't join.");
          }
        }
        if (!stop) setData(r);
      } catch (e) {
        if (stop) return;
        if (e instanceof ApiError && e.code === "no_tourney") setFatal("That tournament doesn't exist or has expired.");
      }
    };
    (async () => {
      while (!stop) {
        await load();
        await new Promise((r) => setTimeout(r, 2000));
      }
    })();
    return () => {
      stop = true;
    };
  }, [code, myName]);

  // Take the player to each new match exactly once.
  const myMatch = data?.myMatch ?? null;
  useEffect(() => {
    if (!myMatch) return;
    try {
      if (sessionStorage.getItem(navKey(myMatch))) return;
      sessionStorage.setItem(navKey(myMatch), "1");
    } catch {
      /* storage blocked — still navigate */
    }
    router.push(`/play/match/${myMatch}`);
  }, [myMatch, router]);

  async function act(action: "start" | "leave") {
    setBusy(action);
    setError(null);
    try {
      const r = await api<Resp>(`/api/tourney/${code}`, { body: { action } });
      if (action === "leave") {
        router.push("/play");
        return;
      }
      setData(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  if (fatal) {
    return (
      <main className="page">
        <ErrorCard title="Tournament not found" body={fatal} action={<ButtonLink href="/play">Back to Play</ButtonLink>} />
      </main>
    );
  }
  if (!me || !data) {
    return (
      <main className="page">
        <CenteredSpinner label="Loading tournament…" />
      </main>
    );
  }

  const t = data.tourney;
  const isHost = t.host.toLowerCase() === myName;
  const inIt = t.players.some((p) => p.toLowerCase() === myName);
  const link = typeof window !== "undefined" ? `${window.location.origin}/play/tourney/${code}` : "";

  return (
    <main className="page">
      <PageTitle
        title="Tournament"
        subtitle={
          t.state === "lobby"
            ? `${t.players.length} of ${SIZE} players · code ${code}`
            : t.state === "running"
              ? "Bracket in progress"
              : "Tournament complete"
        }
      />

      {error && (
        <div className="mb-5">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {t.state === "lobby" && (
        <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
          <Card className="p-7">
            <h2 className="text-[20px] font-semibold tracking-tight">Players</h2>
            <ul className="mt-4 flex flex-col divide-y divide-line">
              {Array.from({ length: SIZE }).map((_, i) => {
                const p = t.players[i];
                return (
                  <li key={i} className="flex items-center gap-3 py-3">
                    {p ? (
                      <>
                        <Avatar username={p} hasFace size={40} />
                        <span className="text-[16px] font-medium">{p}</span>
                        {p.toLowerCase() === t.host.toLowerCase() && (
                          <span className="ml-auto rounded-full bg-fill px-2.5 py-0.5 text-[12px] text-ink-3">Host</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="h-10 w-10 rounded-full border-2 border-dashed border-line" />
                        <span className="text-[15px] text-ink-4">Waiting for player…</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="flex flex-col p-7">
            <h2 className="text-[20px] font-semibold tracking-tight">Invite</h2>
            <p className="mt-1 text-[15px] text-ink-3">Share the code or link with three friends.</p>
            <div className="mt-5 w-fit rounded-3xl bg-fill px-6 py-4">
              <span className="font-mono text-[32px] font-semibold tracking-[0.2em]">{code}</span>
            </div>
            <Button
              variant="secondary"
              className="mt-4 w-fit"
              onClick={async () => {
                if (await copyText(link)) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }
              }}
            >
              {copied ? "Link copied" : "Copy invite link"}
            </Button>

            <div className="mt-auto flex flex-wrap gap-3 pt-8">
              {isHost ? (
                <Button onClick={() => act("start")} loading={busy === "start"} disabled={t.players.length !== SIZE}>
                  {t.players.length === SIZE ? "Start tournament" : `Need ${SIZE - t.players.length} more`}
                </Button>
              ) : inIt ? (
                <p className="self-center text-[14px] text-ink-3">Waiting for {t.host} to start…</p>
              ) : null}
              {inIt && (
                <Button variant="plain" onClick={() => act("leave")} loading={busy === "leave"}>
                  Leave
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {t.state !== "lobby" && (
        <>
          {t.state === "done" && t.champion && (
            <Card className="mb-5 flex flex-col items-center p-8 text-center md:p-10">
              <p className="eyebrow">Champion</p>
              <Avatar username={t.champion} hasFace size={88} className="mt-4" />
              <p className="display mt-3 text-[32px]">{t.champion}</p>
              {t.champion.toLowerCase() === myName && <p className="mt-1 text-[16px] text-accent-ink">That's you. Well played.</p>}
            </Card>
          )}

          {myMatch && (
            <Card className="mb-5 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
              <div>
                <p className="text-[17px] font-semibold">Your match is ready</p>
                <p className="text-[14px] text-ink-3">Your opponent is waiting.</p>
              </div>
              <ButtonLink href={`/play/match/${myMatch}`} size="lg">
                Go to your match
              </ButtonLink>
            </Card>
          )}

          <div className="grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
            <div className="flex flex-col gap-5">
              <BracketCard label="Semifinal 1" b={t.bracket[0]} me={myName} />
              <BracketCard label="Semifinal 2" b={t.bracket[1]} me={myName} />
            </div>
            <div className="hidden h-px w-10 bg-line md:block" />
            <BracketCard label="Final" b={t.bracket[2]} me={myName} />
          </div>

          <div className="mt-8 flex justify-center">
            <ButtonLink href="/play" variant="plain">
              Back to Play
            </ButtonLink>
          </div>
        </>
      )}
    </main>
  );
}

function BracketCard({ label, b, me }: { label: string; b: Bracket | undefined; me?: string }) {
  const rows = [b?.a ?? null, b?.b ?? null];
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        {b?.id && !b.winner && <span className="text-[12px] font-medium text-accent-ink">Live</span>}
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((p, i) => {
          const won = !!p && !!b?.winner && b.winner.toLowerCase() === p.toLowerCase();
          const lost = !!p && !!b?.winner && !won;
          return (
            <li
              key={i}
              className={clsx(
                "flex items-center gap-3 rounded-2xl px-3 py-2",
                won ? "bg-accent-soft" : "bg-fill",
                lost && "opacity-50"
              )}
            >
              {p ? (
                <>
                  <Avatar username={p} hasFace size={32} />
                  <span className={clsx("text-[15px]", won ? "font-semibold text-accent-ink" : "text-ink")}>
                    {p}
                    {p.toLowerCase() === me && <span className="text-ink-3"> (you)</span>}
                  </span>
                  {won && <span className="ml-auto text-[13px] font-semibold text-accent-ink">Won</span>}
                </>
              ) : (
                <span className="py-1.5 text-[14px] text-ink-4">To be decided</span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
