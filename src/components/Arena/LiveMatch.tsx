"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { computeEdgeScore, trimmedMean, type Pt } from "@/lib/edge-score";
import { eloDelta } from "@/lib/elo";
import { rankFromElo } from "@/lib/rank";
import type { EdgeScoreBreakdown, MatchRecord } from "@/lib/types";
import { useUser } from "@/lib/user-context";

type FaceApiNS = typeof import("face-api.js");
type PeerJSCtor = typeof import("peerjs").default;

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

// Namespace key so two simultaneous EdgeIfy users don't collide on the
// public PeerJS broker with anyone else using a 6-char code.
const PEER_PREFIX = "edgeify-arena-";

const ROUND_CRITERIA = [
  { key: "symmetry", label: "Symmetry" },
  { key: "jawlineDefinition", label: "Jawline" },
  { key: "composite", label: "Overall" }
] as const;
type CriterionKey = (typeof ROUND_CRITERIA)[number]["key"];

const SCAN_MS = 3500; // length of each scoring round
const ROUND_RESULT_MS = 2400; // pause between rounds to show winner

type LivePhase =
  | "init" // loading models / camera
  | "lobby" // pick host or guest
  | "creating" // host: waiting for opponent
  | "joining" // guest: connecting
  | "vs" // both connected, VS reveal
  | "scanning" // mid-round, sampling face
  | "between" // showing round result
  | "result" // match complete
  | "error";

type LiveMsg =
  | { type: "hello"; username: string; elo: number }
  | { type: "round"; idx: number }
  | { type: "score"; idx: number; value: number }
  | { type: "result"; winner: "host" | "guest"; myWins: number; oppWins: number }
  | { type: "leave" };

function generateCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function scoreFor(s: EdgeScoreBreakdown, k: CriterionKey): number {
  if (k === "composite") return s.composite;
  const raw = s[k as keyof EdgeScoreBreakdown];
  return (typeof raw === "number" ? raw : 0) * 100;
}

export function LiveMatch({ onClose }: { onClose: () => void }) {
  const { user, update } = useUser();

  // ─── State ────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<LivePhase>("init");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [opponent, setOpponent] = useState<{ username: string; elo: number } | null>(null);
  const [round, setRound] = useState(0);
  const [scoreboard, setScoreboard] = useState<{ me: number; opp: number }[]>([]);
  const [liveMine, setLiveMine] = useState(0);
  const [liveOpp, setLiveOpp] = useState(0);
  const [oppScoreReceived, setOppScoreReceived] = useState<{ idx: number; value: number } | null>(null);
  const [myScoreReady, setMyScoreReady] = useState<{ idx: number; value: number } | null>(null);
  const [matchResult, setMatchResult] = useState<{
    won: boolean;
    delta: number;
    rounds: { me: number; opp: number }[];
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // ─── Refs (don't re-render on change) ─────────────────────────────
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const peerRef = useRef<InstanceType<PeerJSCtor> | null>(null);
  const dataConnRef = useRef<ReturnType<InstanceType<PeerJSCtor>["connect"]> | null>(null);
  const isHostRef = useRef(false);

  const faceApiRef = useRef<FaceApiNS | null>(null);
  const scanRafRef = useRef<number | null>(null);
  const sampleBufferRef = useRef<number[]>([]);

  // ─── Initialize: load models, open camera ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("This browser doesn't support webcam access.");
        }

        const faceapi = (await import("face-api.js")) as FaceApiNS;
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        if (cancelled) return;
        faceApiRef.current = faceapi;

        const stream = await getCameraStream();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          await localVideoRef.current.play().catch(() => {});
        }
        setPhase("lobby");
      } catch (e: unknown) {
        if (cancelled) return;
        const err = e as { name?: string; message?: string };
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError("Camera permission denied. Allow access and reload.");
        } else if (err.name === "NotFoundError") {
          setError("No camera detected. Connect a webcam and reload.");
        } else if (err.name === "NotReadableError") {
          setError("Camera is in use by another app. Close it and reload.");
        } else {
          setError(err.message || "Couldn't access camera or load face models.");
        }
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function teardown() {
    if (scanRafRef.current) cancelAnimationFrame(scanRafRef.current);
    scanRafRef.current = null;
    try {
      dataConnRef.current?.send?.({ type: "leave" } satisfies LiveMsg);
    } catch {
      /* connection may already be closed */
    }
    try {
      peerRef.current?.destroy?.();
    } catch {
      /* */
    }
    peerRef.current = null;
    dataConnRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }

  // ─── Hosting ──────────────────────────────────────────────────────
  async function startHosting() {
    try {
      isHostRef.current = true;
      const newCode = generateCode();
      setCode(newCode);
      setPhase("creating");

      const PeerJS = (await import("peerjs")).default;
      const peer = new PeerJS(PEER_PREFIX + newCode, {
        debug: 0
      });
      peerRef.current = peer;

      peer.on("error", (err) => {
        setError(`Network error: ${err.type || "unknown"}`);
        setPhase("error");
      });

      peer.on("call", (call) => {
        call.answer(localStreamRef.current!);
        call.on("stream", attachRemoteStream);
      });

      peer.on("connection", (conn) => {
        wireDataConnection(conn);
      });
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message;
      setError(msg || "Couldn't start hosting.");
      setPhase("error");
    }
  }

  // ─── Joining ──────────────────────────────────────────────────────
  async function startJoining(joinCode: string) {
    try {
      isHostRef.current = false;
      setPhase("joining");

      const PeerJS = (await import("peerjs")).default;
      const peer = new PeerJS({ debug: 0 });
      peerRef.current = peer;

      peer.on("error", (err) => {
        const t = err.type;
        if (t === "peer-unavailable") {
          setError("That code isn't online. Double-check it or have your friend re-create the room.");
        } else {
          setError(`Network error: ${t || "unknown"}`);
        }
        setPhase("error");
      });

      peer.on("open", () => {
        const targetId = PEER_PREFIX + joinCode;

        // Open data channel
        const conn = peer.connect(targetId, { reliable: true });
        wireDataConnection(conn);

        // Make video call
        const call = peer.call(targetId, localStreamRef.current!);
        call.on("stream", attachRemoteStream);
      });
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message;
      setError(msg || "Couldn't join match.");
      setPhase("error");
    }
  }

  function wireDataConnection(conn: NonNullable<typeof dataConnRef.current>) {
    dataConnRef.current = conn;
    conn.on("open", () => {
      sendMsg({ type: "hello", username: user.username || "PLAYER", elo: user.elo });
    });
    conn.on("data", (data) => handleMsg(data as LiveMsg));
    conn.on("close", () => {
      if (phase !== "result") {
        setError("Opponent disconnected.");
        setPhase("error");
      }
    });
  }

  function attachRemoteStream(remoteStream: MediaStream) {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }

  function sendMsg(msg: LiveMsg) {
    try {
      dataConnRef.current?.send(msg);
    } catch {
      /* ignore — channel might be in transition */
    }
  }

  // ─── Game state machine ───────────────────────────────────────────
  function handleMsg(msg: LiveMsg) {
    switch (msg.type) {
      case "hello":
        setOpponent({ username: msg.username, elo: msg.elo });
        setPhase("vs");
        // Host kicks off round 0 after a brief VS reveal
        if (isHostRef.current) {
          setTimeout(() => beginRound(0), 2500);
        }
        break;
      case "round":
        setRound(msg.idx);
        setOppScoreReceived(null);
        setMyScoreReady(null);
        setLiveMine(0);
        setLiveOpp(0);
        setPhase("scanning");
        runScanLoop(msg.idx);
        break;
      case "score":
        setOppScoreReceived({ idx: msg.idx, value: msg.value });
        setLiveOpp(msg.value);
        break;
      case "result":
        // Guest receives host's verdict
        if (!isHostRef.current) {
          // For the guest, "winner: host" means the guest LOST
          const won = msg.winner === "guest";
          finalizeMatch(won, msg.oppWins, msg.myWins);
        }
        break;
      case "leave":
        if (phase !== "result") {
          setError("Opponent left the match.");
          setPhase("error");
        }
        break;
    }
  }

  function beginRound(idx: number) {
    if (!isHostRef.current) return; // only host can drive
    sendMsg({ type: "round", idx });
    setRound(idx);
    setOppScoreReceived(null);
    setMyScoreReady(null);
    setLiveMine(0);
    setLiveOpp(0);
    setPhase("scanning");
    runScanLoop(idx);
  }

  function runScanLoop(idx: number) {
    sampleBufferRef.current = [];
    const start = performance.now();
    const criterion = ROUND_CRITERIA[idx].key;

    const tick = async () => {
      const faceapi = faceApiRef.current;
      const video = localVideoRef.current;
      if (!faceapi || !video || video.readyState < 2) {
        scanRafRef.current = requestAnimationFrame(tick);
        return;
      }

      const det = await faceapi
        .detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
        )
        .withFaceLandmarks();

      if (det) {
        const points: Pt[] = det.landmarks.positions.map((p) => ({ x: p.x, y: p.y }));
        const score = computeEdgeScore(points);
        const v = scoreFor(score, criterion);
        sampleBufferRef.current.push(v);
        // Live indicator (running trimmed mean of recent samples)
        if (sampleBufferRef.current.length >= 5) {
          setLiveMine(
            Math.round(
              trimmedMean(sampleBufferRef.current.slice(-15), 0.2)
            )
          );
        }
      }

      const elapsed = performance.now() - start;
      if (elapsed < SCAN_MS) {
        scanRafRef.current = requestAnimationFrame(tick);
      } else {
        // Done sampling — compute final round score
        const samples = sampleBufferRef.current;
        const finalVal =
          samples.length >= 5 ? Math.round(trimmedMean(samples, 0.15)) : Math.round(samples[0] || 50);
        setLiveMine(finalVal);
        setMyScoreReady({ idx, value: finalVal });
        sendMsg({ type: "score", idx, value: finalVal });
      }
    };
    tick();
  }

  // Once we have BOTH scores for the current round, transition to "between"
  useEffect(() => {
    if (phase !== "scanning") return;
    if (!myScoreReady || !oppScoreReceived) return;
    if (myScoreReady.idx !== round || oppScoreReceived.idx !== round) return;

    const next = [...scoreboard, { me: myScoreReady.value, opp: oppScoreReceived.value }];
    setScoreboard(next);

    setPhase("between");

    const wins = next.reduce(
      (acc, r) => ({
        me: acc.me + (r.me > r.opp ? 1 : 0),
        opp: acc.opp + (r.opp > r.me ? 1 : 0)
      }),
      { me: 0, opp: 0 }
    );

    const t = window.setTimeout(() => {
      // End if Bo3 decided
      if (wins.me >= 2 || wins.opp >= 2 || next.length === 3) {
        if (isHostRef.current) {
          const won = wins.me >= wins.opp;
          // From host POV: hostWins = wins.me, guestWins = wins.opp.
          sendMsg({
            type: "result",
            winner: won ? "host" : "guest",
            myWins: wins.me,
            oppWins: wins.opp
          });
          finalizeMatch(won, wins.me, wins.opp);
        }
        // Guest waits for "result" message
      } else {
        // Next round
        if (isHostRef.current) {
          beginRound(round + 1);
        }
      }
    }, ROUND_RESULT_MS);

    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, myScoreReady, oppScoreReceived, round]);

  function finalizeMatch(won: boolean, myWins: number, oppWins: number) {
    if (!opponent) return;
    const isPlacement = user.placementsLeft > 0;
    const delta = eloDelta(user.elo, opponent.elo, won ? 1 : 0, isPlacement);
    const newElo = Math.max(0, user.elo + delta);

    const record: MatchRecord = {
      id: `live-${Date.now()}`,
      opponentName: opponent.username,
      opponentElo: opponent.elo,
      myScore: myWins,
      oppScore: oppWins,
      won,
      eloDelta: delta,
      playedAt: Date.now()
    };

    update((prev) => ({
      elo: newElo,
      peakElo: Math.max(prev.peakElo, newElo),
      wins: prev.wins + (won ? 1 : 0),
      losses: prev.losses + (won ? 0 : 1),
      streak: won ? prev.streak + 1 : 0,
      placementsLeft: Math.max(0, prev.placementsLeft - 1),
      matchHistory: [record, ...prev.matchHistory].slice(0, 50)
    }));

    setMatchResult({ won, delta, rounds: scoreboard });
    setPhase("result");
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  // ─── Render ───────────────────────────────────────────────────────
  if (phase === "init")
    return (
      <div className="glass rounded-2xl px-8 py-12 text-center">
        <div className="mx-auto flex w-fit gap-1.5">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-mog-violet" />
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-mog-violet" style={{ animationDelay: "0.15s" }} />
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-mog-violet" style={{ animationDelay: "0.3s" }} />
        </div>
        <p className="label-xs mt-5">Loading models & camera…</p>
      </div>
    );

  if (phase === "error")
    return (
      <div className="glass rounded-2xl px-8 py-12 text-center">
        <p className="label-xs text-rose-300">Error</p>
        <p className="mx-auto mt-3 max-w-md whitespace-pre-line text-sm text-white/80">{error}</p>
        <button
          onClick={onClose}
          className="mt-6 rounded-lg border border-white/10 bg-white/[0.02] px-5 py-2.5 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
        >
          Back to Arena
        </button>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Hidden local video — used only to feed face-api during scanning.
          Visible local preview is rendered separately below. */}
      <video ref={localVideoRef} playsInline muted className="hidden" />

      {phase === "lobby" && <Lobby onHost={startHosting} onJoin={(c) => startJoining(c)} value={enteredCode} setValue={setEnteredCode} />}

      {phase === "creating" && code && (
        <Hosting code={code} copied={copied} onCopy={copyCode} onCancel={onClose} />
      )}

      {phase === "joining" && (
        <Joining onCancel={onClose} />
      )}

      {(phase === "vs" || phase === "scanning" || phase === "between") && (
        <Arena
          mineRef={(el) => {
            if (el && localStreamRef.current) {
              el.srcObject = localStreamRef.current;
              el.play().catch(() => {});
            }
          }}
          oppRef={remoteVideoRef}
          phase={phase}
          round={round}
          opponent={opponent}
          liveMine={liveMine}
          liveOpp={liveOpp}
          scoreboard={scoreboard}
          criterionLabel={ROUND_CRITERIA[round]?.label || ""}
        />
      )}

      {phase === "result" && matchResult && opponent && (
        <Result result={matchResult} opponent={opponent} onClose={onClose} />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function Lobby({
  onHost,
  onJoin,
  value,
  setValue
}: {
  onHost: () => void;
  onJoin: (code: string) => void;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <button
        onClick={onHost}
        className="glass glass-hover rounded-2xl p-8 text-left"
      >
        <p className="label-xs">Host a match</p>
        <h3 className="heading-card mt-2 text-xl">Generate code</h3>
        <p className="mt-2 text-xs text-white/50">
          Get a 6-character invite code. Share it with the person you want to face off
          against. Connection is peer-to-peer, video stays between the two of you.
        </p>
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.length === 6) onJoin(value);
        }}
        className="glass rounded-2xl p-8"
      >
        <p className="label-xs">Join a match</p>
        <h3 className="heading-card mt-2 text-xl">Enter code</h3>
        <input
          value={value}
          onChange={(e) =>
            setValue(
              e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
            )
          }
          placeholder="6-CHAR CODE"
          maxLength={6}
          className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-center font-mono text-xl tracking-[0.32em] text-white outline-none focus:border-mog-violet"
        />
        <button
          type="submit"
          disabled={value.length !== 6}
          className="mt-3 w-full rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-4 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30 disabled:opacity-40"
        >
          Connect →
        </button>
      </form>
    </div>
  );
}

function Hosting({
  code,
  copied,
  onCopy,
  onCancel
}: {
  code: string;
  copied: boolean;
  onCopy: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="glass rounded-2xl px-8 py-12 text-center">
      <p className="label-xs">Share this code</p>
      <p className="mt-4 font-mono text-5xl font-bold tracking-[0.32em] text-white">
        {code}
      </p>
      <button
        onClick={onCopy}
        className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>

      <div className="mt-8 flex items-center justify-center gap-2">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inset-0 animate-pulse-dot rounded-full bg-emerald-400/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="label-xs text-emerald-300">Waiting for opponent…</span>
      </div>

      <button
        onClick={onCancel}
        className="mt-8 rounded-lg border border-white/10 bg-white/[0.02] px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}

function Joining({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="glass rounded-2xl px-8 py-12 text-center">
      <div className="mx-auto flex w-fit gap-1.5">
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-mog-violet" />
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-mog-violet" style={{ animationDelay: "0.15s" }} />
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-mog-violet" style={{ animationDelay: "0.3s" }} />
      </div>
      <p className="label-xs mt-5">Connecting…</p>
      <button
        onClick={onCancel}
        className="mt-8 rounded-lg border border-white/10 bg-white/[0.02] px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}

function Arena({
  mineRef,
  oppRef,
  phase,
  round,
  opponent,
  liveMine,
  liveOpp,
  scoreboard,
  criterionLabel
}: {
  mineRef: (el: HTMLVideoElement | null) => void;
  oppRef: React.RefObject<HTMLVideoElement>;
  phase: LivePhase;
  round: number;
  opponent: { username: string; elo: number } | null;
  liveMine: number;
  liveOpp: number;
  scoreboard: { me: number; opp: number }[];
  criterionLabel: string;
}) {
  const { user } = useUser();
  const myRank = rankFromElo(user.elo);
  const oppRank = opponent ? rankFromElo(opponent.elo) : null;
  const wins = scoreboard.reduce(
    (acc, r) => ({
      me: acc.me + (r.me > r.opp ? 1 : 0),
      opp: acc.opp + (r.opp > r.me ? 1 : 0)
    }),
    { me: 0, opp: 0 }
  );
  const lastRound = scoreboard[scoreboard.length - 1];

  return (
    <div>
      <div className="mb-3 flex flex-col items-center gap-1 text-center">
        {phase === "vs" && <p className="label-xs text-mog-violet">FACE OFF</p>}
        {phase === "scanning" && (
          <>
            <p className="label-xs">Round {round + 1} of 3</p>
            <h2 className="heading-card text-xl">{criterionLabel}</h2>
          </>
        )}
        {phase === "between" && lastRound && (
          <>
            <p className="label-xs">Round {round + 1} result</p>
            <h2
              className="heading-card text-xl"
              style={{
                color:
                  lastRound.me > lastRound.opp
                    ? "#34d399"
                    : lastRound.me < lastRound.opp
                      ? "#f43f5e"
                      : "#fff"
              }}
            >
              {lastRound.me > lastRound.opp
                ? "Round to you"
                : lastRound.me < lastRound.opp
                  ? "Round to opponent"
                  : "Tied round"}
            </h2>
          </>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <PlayerTile
          videoRef={mineRef}
          mirror
          name={user.username || "YOU"}
          rankColor={myRank.color}
          rankLabel={myRank.label}
          rankEmoji={myRank.emoji}
          score={phase === "scanning" || phase === "between" ? liveMine : null}
          showScore={phase === "scanning" || phase === "between"}
          isWinner={phase === "between" && lastRound ? lastRound.me > lastRound.opp : null}
        />

        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black text-[10px] font-semibold tracking-[0.16em] text-white/70 sm:h-16 sm:w-16">
            {wins.me}–{wins.opp}
          </div>
          <span className="text-[9px] uppercase tracking-[0.22em] text-white/40">
            BO3
          </span>
        </div>

        <PlayerTile
          videoRef={oppRef}
          name={opponent?.username || "?"}
          rankColor={oppRank?.color || "#9ca3af"}
          rankLabel={oppRank?.label || ""}
          rankEmoji={oppRank?.emoji || ""}
          score={phase === "scanning" || phase === "between" ? liveOpp : null}
          showScore={phase === "scanning" || phase === "between"}
          isWinner={phase === "between" && lastRound ? lastRound.opp > lastRound.me : null}
        />
      </div>

      {phase === "scanning" && (
        <div className="mt-4">
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <motion.div
              key={round}
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: SCAN_MS / 1000, ease: "linear" }}
              className="h-full bg-mog-violet"
            />
          </div>
          <p className="mt-2 text-center text-[10px] uppercase tracking-[0.32em] text-white/40">
            Scanning both faces…
          </p>
        </div>
      )}
    </div>
  );
}

function PlayerTile(props: {
  videoRef: React.RefObject<HTMLVideoElement> | ((el: HTMLVideoElement | null) => void);
  mirror?: boolean;
  name: string;
  rankColor: string;
  rankLabel: string;
  rankEmoji: string;
  score: number | null;
  showScore: boolean;
  isWinner: boolean | null;
}) {
  const ringColor =
    props.isWinner === true
      ? "border-emerald-400/70"
      : props.isWinner === false
        ? "border-rose-400/50"
        : "border-white/10";
  return (
    <div
      className={`glass relative overflow-hidden rounded-2xl border-2 transition ${ringColor}`}
    >
      <div className="aspect-[3/4] w-full bg-black">
        <video
          ref={props.videoRef as React.RefObject<HTMLVideoElement>}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-cover ${props.mirror ? "-scale-x-100" : ""}`}
        />
      </div>
      <div className="border-t border-white/[0.04] bg-black/50 px-2 py-2 text-center">
        <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-white">
          {props.name}
        </p>
        <p className="text-[9px] uppercase tracking-[0.32em]" style={{ color: props.rankColor }}>
          {props.rankEmoji} {props.rankLabel}
        </p>
      </div>
      {props.showScore && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-2 top-2 rounded-md border border-white/10 bg-black/80 px-2 py-1 text-right"
        >
          <p className="text-[8px] uppercase tracking-[0.22em] text-white/50">Score</p>
          <p className="font-mono text-base font-bold text-white">{props.score ?? "—"}</p>
        </motion.div>
      )}
    </div>
  );
}

function Result({
  result,
  opponent,
  onClose
}: {
  result: { won: boolean; delta: number; rounds: { me: number; opp: number }[] };
  opponent: { username: string; elo: number };
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-2xl px-8 py-12 text-center"
    >
      <p
        className="label-xs"
        style={{ color: result.won ? "#34d399" : "#f43f5e" }}
      >
        {result.won ? "Victory" : "Defeat"}
      </p>
      <h2 className="heading-card mt-2 text-5xl">
        {result.won ? "MOGGED" : "MOGGED ON"}
      </h2>
      <p className="mt-3 text-xs uppercase tracking-[0.32em] text-white/50">
        vs {opponent.username}
      </p>
      <p
        className="mt-5 text-3xl font-bold"
        style={{ color: result.delta >= 0 ? "#22d3ee" : "#f43f5e" }}
      >
        {result.delta >= 0 ? "+" : ""}
        {result.delta} ELO
      </p>
      <button
        onClick={onClose}
        className="mt-7 rounded-lg border border-white/10 bg-white/[0.02] px-6 py-3 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
      >
        Back to Arena
      </button>
    </motion.div>
  );
}

// ─── Camera helper (mirror of FaceScanner's chain) ────────────────────
async function getCameraStream(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: { ideal: "user" }
      },
      audio: false
    },
    { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
    { video: true, audio: false }
  ];
  let lastErr: unknown = new Error("No camera available.");
  for (const c of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch (e) {
      lastErr = e;
      const name = (e as DOMException)?.name;
      if (
        name === "NotAllowedError" ||
        name === "PermissionDeniedError" ||
        name === "NotReadableError" ||
        name === "TrackStartError" ||
        name === "SecurityError"
      ) {
        throw e;
      }
    }
  }
  throw lastErr;
}
