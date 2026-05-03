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
  | "matchmaking" // random matchmaking: in the queue
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

/**
 * AR overlay for the live match — bright green tracking dots with a
 * glow, plus a glowing cyan face frame. Drawn manually mirrored
 * (W - x) since the visible video is CSS-mirrored but the canvas isn't.
 */
function drawLiveOverlay(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  box: { x: number; y: number; width: number; height: number },
  W: number
) {
  // Face frame — thick cyan with glow
  ctx.save();
  ctx.strokeStyle = "rgba(34, 211, 238, 0.9)";
  ctx.shadowColor = "rgba(34, 211, 238, 0.8)";
  ctx.shadowBlur = 12;
  ctx.lineWidth = 3;
  const bx = W - box.x - box.width;
  ctx.strokeRect(bx, box.y, box.width, box.height);
  ctx.restore();

  // Tracking dots — bright green with glow, large enough to see
  // clearly after object-cover scaling on a phone screen.
  ctx.save();
  ctx.fillStyle = "#4ade80"; // green-400, full opacity
  ctx.shadowColor = "#4ade80";
  ctx.shadowBlur = 8;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(W - p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

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
  const localStreamRef = useRef<MediaStream | null>(null);

  // Opponent stream + video element are captured via callback refs because
  // the WebRTC stream often arrives BEFORE the visible <video> element is
  // mounted (we're still in "creating" / "joining" when the call connects).
  // Storing the stream lets the callback ref attach it later.
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoElRef = useRef<HTMLVideoElement | null>(null);

  const peerRef = useRef<InstanceType<PeerJSCtor> | null>(null);
  const dataConnRef = useRef<ReturnType<InstanceType<PeerJSCtor>["connect"]> | null>(null);
  const isHostRef = useRef(false);

  const faceApiRef = useRef<FaceApiNS | null>(null);
  const scanRafRef = useRef<number | null>(null);
  const sampleBufferRef = useRef<number[]>([]);

  // Canvas for the AR overlay on the local video tile during scanning.
  const localOverlayElRef = useRef<HTMLCanvasElement | null>(null);

  const remoteVideoCallback = (el: HTMLVideoElement | null) => {
    remoteVideoElRef.current = el;
    if (el && remoteStreamRef.current && el.srcObject !== remoteStreamRef.current) {
      el.srcObject = remoteStreamRef.current;
      el.play().catch(() => {});
    }
  };

  const localOverlayCallback = (el: HTMLCanvasElement | null) => {
    localOverlayElRef.current = el;
  };

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
        // Don't attach the stream to a video element here — there is no
        // hidden source video anymore. The visible PlayerTile mounts
        // during phase="vs" and grabs the stream via its callback ref.
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

  // ─── Random matchmaking ───────────────────────────────────────────
  // Open my own PeerJS instance, get a peer ID, post to /api/match/enqueue.
  // - If the server matches us immediately (someone was waiting), we're
  //   the GUEST — connect to them via PeerJS.
  // - If the server queues us, we POLL /api/match/poll until a `pair`
  //   notification arrives with the opponent's peer ID. Then we're the
  //   HOST — sit and wait for them to connect to us.
  const matchmakingPeerIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const matchedRef = useRef(false);
  const [searchSeconds, setSearchSeconds] = useState(0);

  async function startRandomMatch() {
    try {
      setPhase("matchmaking");
      setSearchSeconds(0);
      matchedRef.current = false;

      const PeerJS = (await import("peerjs")).default;
      const peer = new PeerJS({ debug: 0 });
      peerRef.current = peer;

      peer.on("error", (err) => {
        if (matchedRef.current) return;
        const t = err.type;
        if (t === "peer-unavailable") {
          setError("Couldn't reach matched opponent. Try again.");
        } else {
          setError(`Network error: ${t || "unknown"}`);
        }
        setPhase("error");
      });

      const myId: string = await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Couldn't connect to PeerJS broker.")), 8000);
        peer.on("open", (id) => {
          clearTimeout(t);
          resolve(id);
        });
      });
      matchmakingPeerIdRef.current = myId;

      // Incoming-side handlers fire ONLY for the host (waiting peer) —
      // the guest never receives an incoming call, they always dial out.
      // So if either fires we are definitively the host. Set the flag
      // here too so we don't race the polling response (which could
      // arrive AFTER the hello exchange completes).
      peer.on("call", (call) => {
        isHostRef.current = true;
        matchedRef.current = true;
        call.answer(localStreamRef.current!);
        call.on("stream", attachRemoteStream);
      });
      peer.on("connection", (conn) => {
        isHostRef.current = true;
        matchedRef.current = true;
        wireDataConnection(conn);
      });

      // Enqueue
      const enqRes = await fetch("/api/match/enqueue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          peerId: myId,
          elo: user.elo,
          placementsLeft: user.placementsLeft
        })
      });
      const enqJson = await enqRes.json();

      if (!enqRes.ok) {
        if (enqRes.status === 503) {
          setError(
            "Random matchmaking isn't enabled on this server.\n\nThe project owner needs to provision Vercel KV (Storage tab → Create Database → KV) — it's free and one click. Once that's done, this button will work for everyone.\n\nFor now, use the code-based pairing below."
          );
        } else {
          setError(enqJson?.message || "Couldn't join the queue.");
        }
        setPhase("error");
        return;
      }

      if (enqJson.matched) {
        // Got matched immediately — we're the GUEST, opponent is the host
        matchedRef.current = true;
        isHostRef.current = false;
        const opp = enqJson.opponentPeerId as string;

        const conn = peer.connect(opp, { reliable: true });
        wireDataConnection(conn);

        const call = peer.call(opp, localStreamRef.current!);
        call.on("stream", attachRemoteStream);
        return;
      }

      // No immediate match — start polling
      const startTs = Date.now();
      const tick = setInterval(async () => {
        setSearchSeconds(Math.floor((Date.now() - startTs) / 1000));

        if (matchedRef.current) {
          window.clearInterval(tick);
          pollTimerRef.current = null;
          return;
        }

        try {
          const pollRes = await fetch("/api/match/poll", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ peerId: myId })
          });
          const pollJson = await pollRes.json();
          if (pollJson?.matched) {
            // Server matched us with someone, opponent will dial us
            // (we already wired peer.on("call") and peer.on("connection")
            // above to accept the incoming connection).
            matchedRef.current = true;
            isHostRef.current = !!pollJson.iAmHost;
            window.clearInterval(tick);
            pollTimerRef.current = null;
            // Don't change phase here — we'll transition when the
            // data conn opens and `hello` is exchanged.
          }
        } catch {
          /* network blip — keep polling */
        }
      }, 1500);
      pollTimerRef.current = tick as unknown as number;
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message;
      setError(msg || "Couldn't start matchmaking.");
      setPhase("error");
    }
  }

  function cancelMatchmaking() {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    const myId = matchmakingPeerIdRef.current;
    if (myId) {
      fetch("/api/match/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ peerId: myId })
      }).catch(() => {});
    }
    onClose();
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
    remoteStreamRef.current = remoteStream;
    const el = remoteVideoElRef.current;
    if (el && el.srcObject !== remoteStream) {
      el.srcObject = remoteStream;
      el.play().catch(() => {});
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

  // When the very first round starts (idx 0), reset the resolved-round
  // tracker so a previous match's state can't block us.
  useEffect(() => {
    if (round === 0 && phase === "vs") {
      lastResolvedRoundRef.current = -1;
    }
  }, [round, phase]);

  function runScanLoop(idx: number) {
    sampleBufferRef.current = [];
    const start = performance.now();
    const criterion = ROUND_CRITERIA[idx].key;

    const finishRound = () => {
      const samples = sampleBufferRef.current;
      const finalVal =
        samples.length >= 5
          ? Math.round(trimmedMean(samples, 0.15))
          : samples.length > 0
            ? Math.round(samples.reduce((s, v) => s + v, 0) / samples.length)
            : 50; // pure fallback if no detection ever landed
      setLiveMine(finalVal);
      setMyScoreReady({ idx, value: finalVal });
      sendMsg({ type: "score", idx, value: finalVal });

      const overlay = localOverlayElRef.current;
      const ctx = overlay?.getContext("2d");
      if (overlay && ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
    };

    const tick = async () => {
      // Hard timeout BEFORE anything else — guarantees the round always
      // ends within SCAN_MS, even if the camera/face-api is unhappy.
      const elapsed = performance.now() - start;
      if (elapsed >= SCAN_MS) {
        finishRound();
        return;
      }

      const faceapi = faceApiRef.current;
      const video = localVideoRef.current;
      if (!faceapi || !video || video.readyState < 2) {
        // Video / models not ready — wait, but the timeout check above
        // ensures we won't wait past SCAN_MS.
        scanRafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Always clear the overlay canvas at the start of each frame; only
      // re-draw when we have a detection. Try/catch in case detection
      // throws during a disconnect/teardown race.
      const overlay = localOverlayElRef.current;
      const ctx = overlay?.getContext("2d") || null;
      if (overlay && ctx) {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
      }

      try {
        const det = await faceapi
          .detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
          )
          .withFaceLandmarks();

        if (det) {
          const points: Pt[] = det.landmarks.positions.map((p) => ({
            x: p.x,
            y: p.y
          }));
          const score = computeEdgeScore(points);
          const v = scoreFor(score, criterion);
          sampleBufferRef.current.push(v);
          if (sampleBufferRef.current.length >= 5) {
            setLiveMine(
              Math.round(trimmedMean(sampleBufferRef.current.slice(-15), 0.2))
            );
          }

          if (overlay && ctx) {
            drawLiveOverlay(ctx, points, det.detection.box, overlay.width);
          }
        }
      } catch {
        /* keep ticking — the timeout will eventually finish the round */
      }

      scanRafRef.current = requestAnimationFrame(tick);
    };

    tick();
  }

  // Once we have BOTH scores for the current round, transition to "between"
  // and queue the next round (or final result).
  //
  // We can't use a useEffect cleanup that clears the setTimeout — the
  // setPhase("between") inside the effect re-triggers the effect, the
  // cleanup fires, and the timeout dies before it can advance. Instead
  // we guard against duplicate processing with a ref keyed by round
  // number, and only clear the pending timeout on full unmount.
  const lastResolvedRoundRef = useRef(-1);
  const transitionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!myScoreReady || !oppScoreReceived) return;
    if (myScoreReady.idx !== round || oppScoreReceived.idx !== round) return;
    if (lastResolvedRoundRef.current >= round) return; // already handled this round
    lastResolvedRoundRef.current = round;

    const next = [
      ...scoreboard,
      { me: myScoreReady.value, opp: oppScoreReceived.value }
    ];
    setScoreboard(next);
    setPhase("between");

    const wins = next.reduce(
      (acc, r) => ({
        me: acc.me + (r.me > r.opp ? 1 : 0),
        opp: acc.opp + (r.opp > r.me ? 1 : 0)
      }),
      { me: 0, opp: 0 }
    );

    transitionTimeoutRef.current = window.setTimeout(() => {
      transitionTimeoutRef.current = null;
      if (wins.me >= 2 || wins.opp >= 2 || next.length === 3) {
        if (isHostRef.current) {
          const won = wins.me >= wins.opp;
          sendMsg({
            type: "result",
            winner: won ? "host" : "guest",
            myWins: wins.me,
            oppWins: wins.opp
          });
          finalizeMatch(won, wins.me, wins.opp);
        }
      } else {
        if (isHostRef.current) {
          beginRound(round + 1);
        }
      }
    }, ROUND_RESULT_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myScoreReady, oppScoreReceived, round]);

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
      {/* No hidden video — face-api reads frames directly from the
          visible local PlayerTile, which is mounted whenever a round
          is in progress. The mineRef callback below assigns localVideoRef
          so runScanLoop can read its frames. */}

      {phase === "lobby" && (
        <Lobby
          onRandom={startRandomMatch}
          onHost={startHosting}
          onJoin={(c) => startJoining(c)}
          value={enteredCode}
          setValue={setEnteredCode}
        />
      )}

      {phase === "matchmaking" && (
        <Matchmaking seconds={searchSeconds} onCancel={cancelMatchmaking} />
      )}

      {phase === "creating" && code && (
        <Hosting code={code} copied={copied} onCopy={copyCode} onCancel={onClose} />
      )}

      {phase === "joining" && (
        <Joining onCancel={onClose} />
      )}

      {(phase === "vs" || phase === "scanning" || phase === "between") && (
        <Arena
          mineRef={(el) => {
            // Point face-api's source at the visible video element
            // (it's actually mounted with live frames flowing). When
            // the element unmounts we get el=null and clear the ref.
            localVideoRef.current = el;
            if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
              el.srcObject = localStreamRef.current;
              el.play().catch(() => {});
            }
          }}
          oppRef={remoteVideoCallback}
          overlayRef={localOverlayCallback}
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
  onRandom,
  onHost,
  onJoin,
  value,
  setValue
}: {
  onRandom: () => void;
  onHost: () => void;
  onJoin: (code: string) => void;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Featured: Random Match — full-width hero card */}
      <button
        onClick={onRandom}
        className="glass glass-hover relative w-full overflow-hidden rounded-2xl p-8 text-left"
      >
        <div className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(60% 100% at 80% 50%, rgba(217, 70, 239, 0.18), transparent 70%), radial-gradient(40% 100% at 20% 50%, rgba(168, 85, 247, 0.18), transparent 70%)"
          }}
        />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 animate-pulse-dot rounded-full bg-emerald-400/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <p className="label-xs text-emerald-300">Random pairing · Live</p>
          </div>
          <h3 className="heading-card text-2xl">Random Match</h3>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Get instantly paired with another EdgeIfy player who&apos;s online
            right now. Real opponent. Real video. The AI scans both faces and
            declares the winner.
          </p>
          <p className="mt-4 text-[10px] uppercase tracking-[0.32em] text-mog-pink">
            Find a stranger →
          </p>
        </div>
      </button>

      {/* Code-based pairing — the existing two cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <button
          onClick={onHost}
          className="glass glass-hover rounded-2xl p-6 text-left"
        >
          <p className="label-xs">Play a friend</p>
          <h4 className="mt-1 text-base font-semibold uppercase tracking-[0.18em] text-white">
            Generate code
          </h4>
          <p className="mt-2 text-xs text-white/50">
            6-character invite code, share over text. Peer-to-peer.
          </p>
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.length === 6) onJoin(value);
          }}
          className="glass rounded-2xl p-6"
        >
          <p className="label-xs">Have a code?</p>
          <input
            value={value}
            onChange={(e) =>
              setValue(
                e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
              )
            }
            placeholder="ENTER CODE"
            maxLength={6}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-center font-mono text-lg tracking-[0.32em] text-white outline-none focus:border-mog-violet"
          />
          <button
            type="submit"
            disabled={value.length !== 6}
            className="mt-2 w-full rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-3 py-2.5 text-[11px] uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30 disabled:opacity-40"
          >
            Connect →
          </button>
        </form>
      </div>
    </div>
  );
}

function Matchmaking({
  seconds,
  onCancel
}: {
  seconds: number;
  onCancel: () => void;
}) {
  return (
    <div className="glass rounded-2xl px-8 py-14 text-center">
      <div className="mx-auto flex w-fit gap-1.5">
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-mog-violet" />
        <span
          className="h-2 w-2 animate-pulse-dot rounded-full bg-mog-violet"
          style={{ animationDelay: "0.15s" }}
        />
        <span
          className="h-2 w-2 animate-pulse-dot rounded-full bg-mog-violet"
          style={{ animationDelay: "0.3s" }}
        />
      </div>
      <p className="mt-5 text-sm uppercase tracking-[0.32em] text-white/60">
        Searching for opponent…
      </p>
      <p className="mt-2 font-mono text-2xl text-white/80">
        {Math.floor(seconds / 60).toString().padStart(2, "0")}:
        {(seconds % 60).toString().padStart(2, "0")}
      </p>
      <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/30">
        {seconds < 10
          ? "Looking for someone online…"
          : seconds < 30
            ? "Still searching — quiet right now."
            : "Hang tight — fewer players this hour."}
      </p>
      <button
        onClick={onCancel}
        className="mt-7 rounded-lg border border-white/10 bg-white/[0.02] px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
      >
        Cancel
      </button>
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
  overlayRef,
  phase,
  round,
  opponent,
  liveMine,
  liveOpp,
  scoreboard,
  criterionLabel
}: {
  mineRef: (el: HTMLVideoElement | null) => void;
  oppRef: (el: HTMLVideoElement | null) => void;
  overlayRef: (el: HTMLCanvasElement | null) => void;
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
          overlayRef={overlayRef}
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
  videoRef: (el: HTMLVideoElement | null) => void;
  overlayRef?: (el: HTMLCanvasElement | null) => void;
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
      <div className="relative aspect-[4/3] w-full bg-black">
        <video
          ref={props.videoRef}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-cover ${props.mirror ? "-scale-x-100" : ""}`}
        />
        {props.overlayRef && (
          <canvas
            ref={props.overlayRef}
            width={640}
            height={480}
            className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          />
        )}
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
