"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Footer } from "@/components/Footer";
import { LiveMatch, type LiveMatchAuto } from "@/components/Arena/LiveMatch";
import { useUser } from "@/lib/user-context";

type TourneyMatch = { a: number; b: number; winner: number | null };
type TourneyPlayer = { username: string; peerId: string };
type Tourney = {
  code: string;
  host: string;
  size: number;
  state: "lobby" | "running" | "done";
  players: TourneyPlayer[];
  matches: TourneyMatch[];
  currentMatch: number;
  champion: number | null;
};

export default function PrivateRoomPage() {
  return (
    <Suspense fallback={<div className="glass mx-auto mt-10 h-64 max-w-3xl animate-pulse rounded-2xl" />}>
      <PrivateRoomInner />
    </Suspense>
  );
}

function PrivateRoomInner() {
  const { user, status } = useUser();
  const params = useSearchParams();
  const initialCode = params.get("code")?.toUpperCase() || "";

  const [code, setCode] = useState<string | null>(initialCode || null);
  const [enteredCode, setEnteredCode] = useState("");
  const [tourney, setTourney] = useState<Tourney | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Each player has a deterministic peerId scheme: edgify-tourney-{code}-{username}.
  // (Username is enforced unique per tournament.)
  const myPeerId = code && user.username ? `edgify-tourney-${code}-${user.username.toLowerCase()}` : null;
  const myIdx = tourney?.players.findIndex((p) => p.username === user.username) ?? -1;

  // ─── Polling ──────────────────────────────────────────────────────
  const pollTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/tournament/state", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.tourney) setTourney(data.tourney);
        else setError("Room not found or expired.");
      } catch {
        /* */
      }
    };
    tick();
    pollTimerRef.current = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, [code]);

  async function createRoom() {
    if (!user.username || !myPeerId) return;
    setBusy(true);
    setError(null);
    try {
      const tmpCode = `pending-${Date.now()}`;
      const tmpPeer = `edgify-tourney-${tmpCode}-${user.username.toLowerCase()}`;
      const res = await fetch("/api/tournament/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: user.username, peerId: tmpPeer })
      });
      const data = await res.json();
      if (!res.ok || !data.tourney) {
        setError(data.message || data.error || "Couldn't create tournament.");
        return;
      }
      const realPeer = `edgify-tourney-${data.tourney.code}-${user.username.toLowerCase()}`;
      // Re-join with the real (code-derived) peer id so it's deterministic.
      await fetch("/api/tournament/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: data.tourney.code,
          username: user.username,
          peerId: realPeer
        })
      });
      setCode(data.tourney.code);
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom(joinCode: string) {
    if (!user.username) return;
    setBusy(true);
    setError(null);
    try {
      const peerId = `edgify-tourney-${joinCode}-${user.username.toLowerCase()}`;
      const res = await fetch("/api/tournament/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: joinCode, username: user.username, peerId })
      });
      const data = await res.json();
      if (!res.ok || !data.tourney) {
        setError(data.message || data.error || "Couldn't join.");
        return;
      }
      setCode(joinCode);
    } finally {
      setBusy(false);
    }
  }

  async function startTournament() {
    if (!code || !user.username) return;
    setBusy(true);
    try {
      const res = await fetch("/api/tournament/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, username: user.username })
      });
      const data = await res.json();
      if (!res.ok) setError(data.message || data.error || "Couldn't start.");
      else setTourney(data.tourney);
    } finally {
      setBusy(false);
    }
  }

  const reportResult = useCallback(
    async (won: boolean) => {
      if (!tourney || !code) return;
      const matchIdx = tourney.currentMatch;
      const match = tourney.matches[matchIdx];
      if (!match) return;
      const winnerIdx = won ? myIdx : match.a === myIdx ? match.b : match.a;
      try {
        const res = await fetch("/api/tournament/report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, matchIdx, winnerIdx })
        });
        const data = await res.json();
        if (data.tourney) setTourney(data.tourney);
      } catch {
        /* */
      }
    },
    [code, tourney, myIdx]
  );

  // ─── Gates ────────────────────────────────────────────────────────
  if (status === "guest") {
    return <Locked onCta={() => {}} />;
  }

  if (!code) {
    return (
      <Shell>
        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={createRoom}
            disabled={busy}
            className="glass glass-hover rounded-2xl p-8 text-left disabled:opacity-50"
          >
            <p className="label-xs">Host a tournament</p>
            <h3 className="heading-card mt-2 text-xl">Create Bracket</h3>
            <p className="mt-2 text-xs text-white/50">
              Generate a 6-character code. Up to 4 players join. Single-elim
              4-player bracket: two semifinals + a final.
            </p>
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (enteredCode.length === 6) joinRoom(enteredCode);
            }}
            className="glass rounded-2xl p-8"
          >
            <p className="label-xs">Have an invite</p>
            <h3 className="heading-card mt-2 text-xl">Join Bracket</h3>
            <input
              value={enteredCode}
              onChange={(e) =>
                setEnteredCode(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
                )
              }
              placeholder="6-CHAR CODE"
              maxLength={6}
              className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-center font-mono text-xl tracking-[0.32em] text-white outline-none focus:border-mog-violet"
            />
            <button
              type="submit"
              disabled={enteredCode.length !== 6 || busy}
              className="mt-3 w-full rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-4 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30 disabled:opacity-40"
            >
              Join →
            </button>
          </form>
        </div>
        {error && (
          <p className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}
      </Shell>
    );
  }

  if (!tourney) {
    return (
      <Shell>
        <div className="glass h-64 animate-pulse rounded-2xl" />
      </Shell>
    );
  }

  return (
    <Shell>
      <Bracket tourney={tourney} myIdx={myIdx} />

      {tourney.state === "lobby" && (
        <Lobby
          tourney={tourney}
          isHost={tourney.host === user.username}
          onStart={startTournament}
          busy={busy}
          copied={copied}
          onCopy={async () => {
            try {
              await navigator.clipboard.writeText(tourney.code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {
              /* */
            }
          }}
        />
      )}

      {tourney.state === "running" && (
        <ActiveMatch
          tourney={tourney}
          myIdx={myIdx}
          myUsername={user.username || ""}
          onMatchEnd={reportResult}
        />
      )}

      {tourney.state === "done" && tourney.champion !== null && (
        <Champion tourney={tourney} myIdx={myIdx} />
      )}
    </Shell>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 transition hover:text-white"
      >
        ← Back to Lobby
      </Link>
      <div className="mt-6">
        <p className="label-xs">Private Room</p>
        <h1 className="heading-card mt-2 text-3xl">4-Player Tournament</h1>
      </div>
      <div className="mt-8 space-y-6">{children}</div>
      <Footer />
    </main>
  );
}

function Locked({ onCta: _ }: { onCta: () => void }) {
  return (
    <Shell>
      <div className="glass rounded-2xl px-8 py-12 text-center">
        <p className="label-xs">Sign in required</p>
        <h2 className="heading-card mt-2 text-2xl">Sign in to host or join</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/50">
          Tournaments need a callsign so your bracket position is identifiable.
        </p>
      </div>
    </Shell>
  );
}

function Bracket({ tourney, myIdx }: { tourney: Tourney; myIdx: number }) {
  const slot = (i: number) => {
    const p = tourney.players[i];
    return p ? p.username : "—";
  };
  const matchBox = (m: TourneyMatch, label: string) => {
    const aName = m.a >= 0 ? slot(m.a) : "TBD";
    const bName = m.b >= 0 ? slot(m.b) : "TBD";
    const winner = m.winner;
    return (
      <div className="glass flex flex-col gap-1 rounded-xl px-3 py-2 text-[11px]">
        <span className="label-xs text-white/30">{label}</span>
        <span
          className={
            "truncate uppercase tracking-[0.2em] " +
            (winner === m.a
              ? "font-bold text-emerald-300"
              : winner !== null
                ? "text-white/30 line-through"
                : "text-white/80")
          }
        >
          {aName}
          {myIdx === m.a && " (you)"}
        </span>
        <span
          className={
            "truncate uppercase tracking-[0.2em] " +
            (winner === m.b
              ? "font-bold text-emerald-300"
              : winner !== null
                ? "text-white/30 line-through"
                : "text-white/80")
          }
        >
          {bName}
          {myIdx === m.b && " (you)"}
        </span>
      </div>
    );
  };

  return (
    <div className="glass rounded-2xl p-5">
      <p className="label-xs mb-3">Bracket</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-3">
          {matchBox(tourney.matches[0], "Semifinal 1")}
          {matchBox(tourney.matches[1], "Semifinal 2")}
        </div>
        <div className="flex items-center justify-center">
          <div className="h-px w-full bg-white/[0.06]" />
        </div>
        <div className="flex items-center">{matchBox(tourney.matches[2], "Final")}</div>
      </div>
    </div>
  );
}

function Lobby({
  tourney,
  isHost,
  onStart,
  busy,
  copied,
  onCopy
}: {
  tourney: Tourney;
  isHost: boolean;
  onStart: () => void;
  busy: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="glass rounded-2xl p-6 text-center">
      <p className="label-xs">Invite Code</p>
      <p className="mt-2 font-mono text-4xl font-bold tracking-[0.32em] text-white">
        {tourney.code}
      </p>
      <button
        onClick={onCopy}
        className="mt-2 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: tourney.size }).map((_, i) => (
          <div
            key={i}
            className="glass rounded-lg px-3 py-3 text-xs uppercase tracking-[0.18em]"
          >
            {tourney.players[i] ? (
              <span className="text-white">{tourney.players[i].username}</span>
            ) : (
              <span className="text-white/30">Waiting…</span>
            )}
          </div>
        ))}
      </div>

      {isHost ? (
        <button
          onClick={onStart}
          disabled={busy || tourney.players.length !== tourney.size}
          className="mt-6 rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30 disabled:opacity-40"
        >
          {tourney.players.length < tourney.size
            ? `Need ${tourney.size - tourney.players.length} more`
            : "Start Tournament →"}
        </button>
      ) : (
        <p className="mt-6 text-[11px] uppercase tracking-[0.22em] text-white/40">
          Waiting for host to start…
        </p>
      )}
    </div>
  );
}

function ActiveMatch({
  tourney,
  myIdx,
  myUsername,
  onMatchEnd
}: {
  tourney: Tourney;
  myIdx: number;
  myUsername: string;
  onMatchEnd: (won: boolean) => void;
}) {
  const match = tourney.matches[tourney.currentMatch];
  if (!match) return null;

  const isMyMatch = myIdx === match.a || myIdx === match.b;

  if (!isMyMatch) {
    const aName = tourney.players[match.a]?.username ?? "TBD";
    const bName = tourney.players[match.b]?.username ?? "TBD";
    const labels = ["Semifinal 1", "Semifinal 2", "Final"];
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="label-xs">{labels[tourney.currentMatch]} in progress</p>
        <h2 className="heading-card mt-3 text-2xl">
          {aName} <span className="text-white/30">vs</span> {bName}
        </h2>
        <p className="mt-3 text-xs text-white/50">
          You&apos;re up next. Bracket will refresh when this match ends.
        </p>
      </div>
    );
  }

  // I'm in this match — derive my role + opponent peer ID.
  const opponentIdx = match.a === myIdx ? match.b : match.a;
  const opponent = tourney.players[opponentIdx];
  if (!opponent) return null;

  // Deterministic role: lower player index hosts (so both sides agree).
  const role: "host" | "guest" = myIdx < opponentIdx ? "host" : "guest";
  const myPeerId = `edgify-tourney-${tourney.code}-${myUsername.toLowerCase()}-m${tourney.currentMatch}`;
  const oppPeerId = `edgify-tourney-${tourney.code}-${opponent.username.toLowerCase()}-m${tourney.currentMatch}`;

  const auto: LiveMatchAuto = {
    role,
    myPeerId,
    opponentPeerId: oppPeerId
  };

  return (
    <div>
      <p className="label-xs mb-3 text-center">
        Your match — {role === "host" ? "waiting for opponent" : "connecting…"}
      </p>
      <LiveMatch
        key={`m-${tourney.currentMatch}`}
        auto={auto}
        onClose={() => {}}
        onMatchEnd={(r) => onMatchEnd(r.won)}
      />
    </div>
  );
}

function Champion({ tourney, myIdx }: { tourney: Tourney; myIdx: number }) {
  const champ = tourney.champion !== null ? tourney.players[tourney.champion] : null;
  if (!champ) return null;
  const isMe = tourney.champion === myIdx;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-2xl px-8 py-12 text-center"
    >
      <p className="label-xs text-amber-300">Champion</p>
      <div className="mt-3 text-6xl">👑</div>
      <h2 className="heading-card mt-3 text-4xl">{champ.username}</h2>
      <p className="mt-3 text-sm text-white/60">
        {isMe ? "You won the bracket. Mogger." : "Tournament complete."}
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg border border-white/10 bg-white/[0.02] px-6 py-3 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
      >
        Back to Lobby
      </Link>
    </motion.div>
  );
}
