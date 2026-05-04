"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  computeEdgeScore,
  consensusLandmarksWeighted,
  frameQuality,
  meanLumaAt,
  sharpnessAt,
  trimmedMean,
  type Pt
} from "@/lib/edge-score";
import { eloDelta } from "@/lib/elo";
import { rankFromElo } from "@/lib/rank";
import { playSfx, vibrate } from "@/lib/audio";
import { applyMatchResult } from "@/lib/season";
import { coachingTip } from "@/lib/coaching";
import { Confetti } from "@/components/Confetti";
import { DeepAnalysis } from "@/components/Arena/DeepAnalysis";
import { OwnerBadge } from "@/components/OwnerBadge";
import { drawArFilter } from "@/lib/ar-filters";
import type { EdgeScoreBreakdown, MatchRecord } from "@/lib/types";
import { useUser } from "@/lib/user-context";

type FaceApiNS = typeof import("face-api.js");
type PeerJSCtor = typeof import("peerjs").default;

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

// Namespace key so two simultaneous Edgify users don't collide on the
// public PeerJS broker with anyone else using a 6-char code.
const PEER_PREFIX = "edgify-arena-";

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
  | { type: "score-tick"; idx: number; value: number } // running score during scan
  | { type: "score"; idx: number; value: number }      // final score for the round
  | { type: "result"; winner: "host" | "guest"; myWins: number; oppWins: number }
  | { type: "reaction"; emoji: string }                // emoji burst from sender
  | { type: "chat"; text: string }                     // in-match text chat
  | { type: "leave" };

const DEFAULT_REACTIONS = ["🔥", "💀", "👑", "😂", "🗿", "🤡"];
type ReactionPing = { id: number; emoji: string; from: "me" | "opp" };

const AR_COLOR_HEX: Record<string, string> = {
  green: "#4ade80",
  cyan: "#22d3ee",
  pink: "#d946ef",
  gold: "#fde047",
  violet: "#a855f7"
};

/**
 * Standard 68-point face contour groupings (jaw, brows, eyes, nose,
 * mouth). [startIdx, endIdx, isClosedLoop].
 */
const FACE_CONTOURS_LIVE: [number, number, boolean][] = [
  [0, 16, false],
  [17, 21, false],
  [22, 26, false],
  [27, 30, false],
  [31, 35, false],
  [36, 41, true],
  [42, 47, true],
  [48, 59, true],
  [60, 67, true]
];

/** Convert a #rrggbb hex to an rgba(r,g,b,a) string. */
function hexToRgba(hex: string, alpha: number): string {
  const m = hex.match(/^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
  if (!m) return `rgba(74, 222, 128, ${alpha})`;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Cross-connections for wireframe mesh feel. */
const FACE_MESH_LINKS_LIVE: [number, number][] = [
  [0, 17], [16, 26],
  [17, 36], [21, 39], [22, 42], [26, 45],
  [21, 22],
  [39, 27], [42, 27],
  [33, 48], [33, 54], [33, 51],
  [57, 8],
  [48, 4], [54, 12],
  [40, 1], [47, 15]
];

/**
 * AR overlay for the live match — green wireframe mesh, bright green
 * tracking dots with glow. Coords are mirrored manually (W - x) since
 * the visible video is CSS-mirrored but the canvas isn't.
 */
function drawLiveOverlay(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  _box: { x: number; y: number; width: number; height: number },
  W: number,
  color: string = "#4ade80"
) {
  const mx = (p: Pt) => ({ x: W - p.x, y: p.y });
  // Build rgba forms from the supplied hex
  const rgba = (a: number) => hexToRgba(color, a);

  // Mesh contours
  ctx.save();
  ctx.strokeStyle = rgba(0.55);
  ctx.shadowColor = rgba(0.55);
  ctx.shadowBlur = 4;
  ctx.lineWidth = 1.1;
  for (const [start, end, closed] of FACE_CONTOURS_LIVE) {
    ctx.beginPath();
    const first = mx(points[start]);
    ctx.moveTo(first.x, first.y);
    for (let i = start + 1; i <= end; i++) {
      const p = mx(points[i]);
      ctx.lineTo(p.x, p.y);
    }
    if (closed) ctx.closePath();
    ctx.stroke();
  }
  // Cross links — fainter
  ctx.strokeStyle = rgba(0.28);
  ctx.lineWidth = 0.9;
  for (const [a, b] of FACE_MESH_LINKS_LIVE) {
    const pa = mx(points[a]);
    const pb = mx(points[b]);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.restore();

  // Tracked landmarks: chosen color with glow.
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  for (const p of points) {
    const { x, y } = mx(p);
    ctx.beginPath();
    ctx.arc(x, y, 2.8, 0, Math.PI * 2);
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

export type LiveMatchAuto = {
  /** "host" registers the given peerId and waits for `opponentPeerId`
   *  to dial; "guest" creates a random peer and dials `opponentPeerId`. */
  role: "host" | "guest";
  myPeerId: string;
  opponentPeerId: string;
};

export function LiveMatch({
  onClose,
  auto,
  onMatchEnd,
  autoJoinCode
}: {
  onClose: () => void;
  /** When provided, skip the lobby and auto-pair. Used by the
   *  tournament flow which derives peer IDs from the bracket. */
  auto?: LiveMatchAuto;
  /** Fired after the match concludes (after Result screen renders).
   *  Tournament uses this to advance the bracket. */
  onMatchEnd?: (result: { won: boolean }) => void;
  /** When provided, skip the lobby and auto-join the given private
   *  room code. Used by the /invite/[code] deep-link flow. */
  autoJoinCode?: string;
}) {
  const { user, update } = useUser();

  // ─── State ────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<LivePhase>("init");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [opponent, setOpponent] = useState<{ username: string; elo: number } | null>(null);
  const [round, setRound] = useState(0);
  // Mirror of `round` available to event handlers wired up before later
  // re-renders (handleMsg captured `round` in its closure on the first
  // render, so msg.idx === round was comparing against stale 0 for life).
  const roundRef = useRef(0);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);
  const [scoreboard, setScoreboard] = useState<{ me: number; opp: number }[]>([]);
  const [liveMine, setLiveMine] = useState(0);
  const [liveOpp, setLiveOpp] = useState(0);
  const [oppScoreReceived, setOppScoreReceived] = useState<{ idx: number; value: number } | null>(null);
  const [myScoreReady, setMyScoreReady] = useState<{ idx: number; value: number } | null>(null);
  const [matchResult, setMatchResult] = useState<{
    won: boolean;
    delta: number;
    rounds: { me: number; opp: number }[];
    oppFaceDataUrl: string | null;
    myFaceDataUrl: string | null;
    myWins: number;
    oppWins: number;
  } | null>(null);
  // Hidden canvas used to grab a snapshot of the opponent's video stream
  // at match-end so the deep-analysis flow has both faces.
  const oppCaptureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [reactions, setReactions] = useState<ReactionPing[]>([]);
  const reactionIdRef = useRef(0);

  // In-match text chat (small, ephemeral; not persisted).
  const [chatLog, setChatLog] = useState<{ id: number; from: "me" | "opp"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatIdRef = useRef(0);
  function pushChat(from: "me" | "opp", text: string) {
    const id = ++chatIdRef.current;
    setChatLog((prev) => [...prev.slice(-9), { id, from, text }]);
  }
  function sendChat() {
    const t = chatInput.trim().slice(0, 140);
    if (!t) return;
    pushChat("me", t);
    sendMsg({ type: "chat", text: t });
    setChatInput("");
  }

  // Mic toggle — enables/disables our audio track. Opponent's stream
  // already includes audio if their mic is on (handled by their video el).
  // Initial value follows the user's preferred default in /settings.
  const [micOn, setMicOn] = useState(user.micDefault);
  // Re-sync the audio track whenever micOn flips OR after the local
  // stream first attaches (since on mount the stream isn't ready yet).
  useEffect(() => {
    const stream = localStreamRef.current;
    stream?.getAudioTracks().forEach((t) => (t.enabled = micOn));
  });
  function toggleMic() {
    setMicOn(!micOn);
  }

  // Local video's natural aspect ratio (e.g. "1280 / 720" or "480 / 640").
  // Used by the local PlayerTile to size its container so AR overlay
  // and visible video stay aligned across desktop and mobile cameras.
  const [localVideoAspect, setLocalVideoAspect] = useState<string>("4 / 3");
  const [remoteVideoAspect, setRemoteVideoAspect] = useState<string>("4 / 3");

  // Edge Boost — armed before queuing, applies +10% to my round scores.
  const [boostArmed, setBoostArmed] = useState(false);
  const boostArmedRef = useRef(false);
  // Auto-rematch — if true, after a match ends we automatically queue
  // for another random opponent rather than returning to the lobby.
  const [autoRematch, setAutoRematch] = useState(false);
  useEffect(() => {
    boostArmedRef.current = boostArmed;
  }, [boostArmed]);

  function spawnReaction(from: "me" | "opp", emoji: string) {
    const id = ++reactionIdRef.current;
    setReactions((prev) => [...prev, { id, emoji, from }]);
    playSfx("reaction");
    window.setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2200);
  }

  function sendReaction(emoji: string) {
    spawnReaction("me", emoji);
    sendMsg({ type: "reaction", emoji });
  }

  // ─── Refs (don't re-render on change) ─────────────────────────────
  // localVideoRef is mutable (assigned from a callback ref), so the type
  // explicitly includes null for MutableRefObject semantics.
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
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
  // Tracks which detector loaded successfully — SSD-Mobilenet gives
  // significantly more accurate landmark localization but its weights
  // are ~10MB so we fall back to TinyFaceDetector if it fails to load.
  const detectorRef = useRef<"ssd" | "tiny">("tiny");
  const scanRafRef = useRef<number | null>(null);
  const sampleBufferRef = useRef<number[]>([]);
  // Per-frame quality weights aligned with landmarkAccumRef.
  const weightAccumRef = useRef<number[]>([]);
  // Reusable small offscreen canvas for sharpness/brightness sampling.
  const qualityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Last good landmarks + bbox so we can redraw the AR overlay across
  // single-frame detector misses (prevents the mesh from flickering
  // off whenever the user blinks or the detector drops a frame).
  const lastDrawnLandmarksRef = useRef<Pt[] | null>(null);
  const lastDrawnBoxRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const lastDrawnAtRef = useRef(0);
  // Guard so finalizeMatch only commits once per match (the timeout
  // and the inbound "result" message can both fire it).
  const matchFinalizedRef = useRef(false);

  // Canvas for the AR overlay on the local video tile during scanning.
  const localOverlayElRef = useRef<HTMLCanvasElement | null>(null);

  const remoteVideoCallback = (el: HTMLVideoElement | null) => {
    remoteVideoElRef.current = el;
    if (el && remoteStreamRef.current && el.srcObject !== remoteStreamRef.current) {
      el.srcObject = remoteStreamRef.current;
      el.play().catch(() => {});
    }
    if (el) {
      const sync = () => {
        if (el.videoWidth > 0 && el.videoHeight > 0) {
          setRemoteVideoAspect(`${el.videoWidth} / ${el.videoHeight}`);
        }
      };
      sync();
      el.addEventListener("loadedmetadata", sync);
      el.addEventListener("resize", sync);
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
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ]);
        if (cancelled) return;
        // Try to upgrade to SSD-Mobilenet for more accurate landmark
        // localization. Time-boxed so a slow connection doesn't stall the
        // whole match — if SSD doesn't arrive in 8s we proceed with Tiny.
        try {
          const ssdLoad = faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
          await Promise.race([
            ssdLoad,
            new Promise((_r, rej) => setTimeout(() => rej(new Error("ssd-timeout")), 8000))
          ]);
          if (!cancelled) detectorRef.current = "ssd";
        } catch {
          /* SSD failed or timed out — Tiny is fine. */
        }
        if (cancelled) return;
        faceApiRef.current = faceapi;

        const stream = await getCameraStream();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        // Mute mic by default — user toggles it on in the live match.
        stream.getAudioTracks().forEach((t) => (t.enabled = false));
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

  // Auto-pair flow used by tournament brackets — once camera + models
  // are ready we skip the lobby entirely.
  useEffect(() => {
    if (!auto) return;
    if (phase !== "lobby") return;
    if (auto.role === "host") {
      void startAutoHost(auto.myPeerId);
    } else {
      void startAutoGuest(auto.myPeerId, auto.opponentPeerId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, phase]);

  // Auto-join a private room from the /invite/[code] deep link.
  // Triggers once camera + models are loaded (phase === "lobby").
  useEffect(() => {
    if (!autoJoinCode || autoJoinCode.length !== 6) return;
    if (phase !== "lobby") return;
    void startJoining(autoJoinCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoinCode, phase]);

  // Auto-rematch — when a match ends and the toggle is on, queue
  // another random match after a brief pause so the user can see
  // their result first.
  useEffect(() => {
    if (!autoRematch) return;
    if (phase !== "result") return;
    const t = window.setTimeout(() => {
      playAgain();
      window.setTimeout(() => void startRandomMatch(), 800);
    }, 3500);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRematch, phase]);

  // Bubble match outcomes to the tournament orchestrator.
  useEffect(() => {
    if (!onMatchEnd || !matchResult) return;
    onMatchEnd({ won: matchResult.won });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchResult]);

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

  // Tears down the peer connection but KEEPS the camera + face-api models
  // alive so we can drop straight back into the lobby for another match.
  function teardownConnectionOnly() {
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
    remoteStreamRef.current = null;
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    matchedRef.current = false;
    matchmakingPeerIdRef.current = null;
  }

  // "Play Again" from the result screen — wipes match state, recycles
  // peer (so we get a fresh ID), and returns to lobby with the camera
  // still warm. This skips the long "loading models & camera…" splash.
  function playAgain() {
    teardownConnectionOnly();
    setOpponent(null);
    setRound(0);
    roundRef.current = 0;
    setScoreboard([]);
    setLiveMine(0);
    setLiveOpp(0);
    setOppScoreReceived(null);
    setMyScoreReady(null);
    setMatchResult(null);
    setReactions([]);
    landmarkAccumRef.current = [];
    weightAccumRef.current = [];
    sampleBufferRef.current = [];
    setChatLog([]);
    setChatInput("");
    setCode(null);
    setEnteredCode("");
    setCopied(false);
    setError(null);
    lastResolvedRoundRef.current = -1;
    matchFinalizedRef.current = false;
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    setPhase("lobby");
  }

  // ─── Tournament auto-pair (bypasses code entry) ───────────────────
  async function startAutoHost(myId: string) {
    try {
      isHostRef.current = true;
      setPhase("creating");
      const PeerJS = (await import("peerjs")).default;
      const peer = new PeerJS(myId, { debug: 0 });
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
      setError((e as { message?: string }).message || "Couldn't host match.");
      setPhase("error");
    }
  }

  async function startAutoGuest(myId: string, oppId: string) {
    try {
      isHostRef.current = false;
      setPhase("joining");
      const PeerJS = (await import("peerjs")).default;
      const peer = new PeerJS(myId, { debug: 0 });
      peerRef.current = peer;

      peer.on("error", (err) => {
        setError(
          err.type === "peer-unavailable"
            ? "Opponent isn't online yet — wait for them to load."
            : `Network error: ${err.type || "unknown"}`
        );
        setPhase("error");
      });

      peer.on("open", () => {
        const conn = peer.connect(oppId, { reliable: true });
        wireDataConnection(conn);
        const call = peer.call(oppId, localStreamRef.current!);
        call.on("stream", attachRemoteStream);
      });
    } catch (e: unknown) {
      setError((e as { message?: string }).message || "Couldn't join match.");
      setPhase("error");
    }
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
  // Wall-clock start of the current matchmaking session — used by the
  // UI clock effect below. Kept in a ref so it's set synchronously when
  // we enter the phase, not later when the async setup finishes.
  const matchmakingStartTsRef = useRef<number | null>(null);

  // UI clock for the matchmaking screen. Runs as soon as `phase` flips
  // to "matchmaking" — independently of the peer/broker setup, which can
  // take 1-2s on first click while peerjs is being downloaded. Ticks at
  // 250ms so seconds advance smoothly (was previously inside the 1500ms
  // server-poll, which made the clock skip every other second).
  useEffect(() => {
    if (phase !== "matchmaking") {
      matchmakingStartTsRef.current = null;
      return;
    }
    if (!matchmakingStartTsRef.current) {
      matchmakingStartTsRef.current = Date.now();
      setSearchSeconds(0);
    }
    const t = window.setInterval(() => {
      const start = matchmakingStartTsRef.current;
      if (!start) return;
      setSearchSeconds(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => window.clearInterval(t);
  }, [phase]);

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
          placementsLeft: user.placementsLeft,
          username: user.username || "",
          blocklist: user.blockedUsers
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

      // No immediate match — start polling. The UI clock is driven
      // independently by an effect on `phase`; this interval only
      // hits the server every 1500ms.
      const tick = setInterval(async () => {
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
      if (phase === "result") return;
      // If the opponent rage-quits mid-match, award the user the win
      // (counted as a clean 2-0 sweep) and apply normal ELO. The other
      // side will flag this as their loss when they next come online —
      // for now we just protect the still-connected player from getting
      // a "match cancelled" with no progress.
      if (opponent && (phase === "scanning" || phase === "between" || phase === "vs")) {
        const placeholder: { me: number; opp: number }[] =
          scoreboard.length > 0 ? [...scoreboard] : [];
        // Pad with auto-wins so myWins>=2.
        while (placeholder.reduce((s, r) => s + (r.me > r.opp ? 1 : 0), 0) < 2) {
          placeholder.push({ me: 100, opp: 0 });
        }
        finalizeMatch(true, 2, 0);
        return;
      }
      setError("Opponent disconnected.");
      setPhase("error");
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

  /**
   * Snapshot the opponent's video into a small jpeg data URL. Used at
   * match-end to feed the deep-analysis flow. Returns null if the
   * remote element isn't ready (e.g. opponent disconnected before the
   * round resolved).
   */
  function captureRemoteSnapshot(): string | null {
    const video = remoteVideoElRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
    try {
      let cap = oppCaptureCanvasRef.current;
      if (!cap) {
        cap = document.createElement("canvas");
        oppCaptureCanvasRef.current = cap;
      }
      cap.width = 320;
      cap.height = 240;
      const ctx = cap.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, cap.width, cap.height);
      return cap.toDataURL("image/jpeg", 0.82);
    } catch {
      return null;
    }
  }

  /**
   * Snapshot the local user's video at match-end. Used as a fallback
   * if user.faceDataUrl wasn't set (e.g. they came straight to live
   * match without going through the lab first).
   */
  function captureLocalSnapshot(): string | null {
    const video = localVideoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
    try {
      let cap = oppCaptureCanvasRef.current;
      if (!cap) {
        cap = document.createElement("canvas");
        oppCaptureCanvasRef.current = cap;
      }
      cap.width = 320;
      cap.height = 240;
      const ctx = cap.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, cap.width, cap.height);
      return cap.toDataURL("image/jpeg", 0.82);
    } catch {
      return null;
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
      case "score-tick":
        // Opponent broadcasting their running score — only update the
        // live indicator if it's for the current round (read via ref
        // since this handler closed over the first render's `round=0`).
        if (msg.idx === roundRef.current) {
          setLiveOpp(msg.value);
        }
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
      case "reaction":
        spawnReaction("opp", msg.emoji);
        break;
      case "chat":
        pushChat("opp", String(msg.text || "").slice(0, 140));
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
    playSfx("matchStart");
    runScanLoop(idx);
  }

  // When the very first round starts (idx 0), reset the resolved-round
  // tracker so a previous match's state can't block us.
  useEffect(() => {
    if (round === 0 && phase === "vs") {
      lastResolvedRoundRef.current = -1;
    }
  }, [round, phase]);

  const landmarkAccumRef = useRef<Pt[][]>([]);

  function runScanLoop(idx: number) {
    sampleBufferRef.current = [];
    landmarkAccumRef.current = [];
    weightAccumRef.current = [];
    const start = performance.now();
    const criterion = ROUND_CRITERIA[idx].key;
    let lastTickSent = 0;

    const finishRound = () => {
      // Score the quality-weighted consensus face built from all good
      // frames during this round — much more stable than averaging
      // per-frame scores.
      const accum = landmarkAccumRef.current;
      const weights = weightAccumRef.current;
      let finalVal = 50;
      if (accum.length >= 5) {
        const cons = consensusLandmarksWeighted(accum, weights);
        const score = computeEdgeScore(cons);
        finalVal = Math.round(scoreFor(score, criterion));
      } else if (sampleBufferRef.current.length > 0) {
        finalVal = Math.round(trimmedMean(sampleBufferRef.current, 0.15));
      }
      // Edge Boost: +10% applied at round-end (so score-tick previews
      // already reflect the boost).
      if (boostArmedRef.current) {
        finalVal = Math.min(100, Math.round(finalVal * 1.1));
      }
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
        scanRafRef.current = requestAnimationFrame(tick);
        return;
      }

      try {
        // Use SSD-Mobilenet when available for noticeably more accurate
        // landmark localization; fall back to TinyFaceDetector at 416
        // (vs the old 320) when SSD didn't load. scoreThreshold/min-
        // confidence kept at 0.55 so low-confidence misdetects are
        // dropped before they can poison the consensus.
        const detectorOpts =
          detectorRef.current === "ssd"
            ? new faceapi.SsdMobilenetv1Options({ minConfidence: 0.55 })
            : new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.55 });
        const det = await faceapi
          .detectSingleFace(video, detectorOpts)
          .withFaceLandmarks();

        // Clear + draw AFTER await so React reconciliation triggered by
        // state updates during the await can't wipe the buffer mid-frame.
        const overlay = localOverlayElRef.current;
        const ctx = overlay?.getContext("2d") || null;
        if (overlay && ctx) {
          ctx.clearRect(0, 0, overlay.width, overlay.height);
        }

        // If detection missed but we have a recently-cached landmark
        // set (≤ 250ms old), redraw the cache to keep the overlay
        // stable across single-frame misses. Without this the AR
        // mesh strobes off whenever the user blinks or the detector
        // skips a frame on a slower phone.
        const STALE_MS = 250;
        const now = performance.now();
        if (
          (!det || det.detection.score < 0.55) &&
          overlay &&
          ctx &&
          lastDrawnLandmarksRef.current &&
          now - lastDrawnAtRef.current < STALE_MS
        ) {
          const arHex = AR_COLOR_HEX[user.arColor] || "#4ade80";
          drawLiveOverlay(
            ctx,
            lastDrawnLandmarksRef.current,
            lastDrawnBoxRef.current!,
            overlay.width,
            arHex
          );
          drawArFilter(
            ctx,
            user.arFilter || "none",
            lastDrawnLandmarksRef.current,
            overlay.width,
            true
          );
        }

        if (det && det.detection.score >= 0.55) {
          const points: Pt[] = det.landmarks.positions.map((p) => ({
            x: p.x,
            y: p.y
          }));
          const box = det.detection.box;

          // Sample image quality (sharpness + brightness) for THIS frame's
          // bbox via a small offscreen canvas. Frames that are dark or
          // motion-blurred get down-weighted in the consensus, instead of
          // contaminating the score.
          let sharp = 0.5;
          let luma = 128;
          try {
            let qc = qualityCanvasRef.current;
            if (!qc) {
              qc = document.createElement("canvas");
              qualityCanvasRef.current = qc;
            }
            const targetW = 256;
            const targetH = Math.round(
              (video.videoHeight || 480) * (targetW / (video.videoWidth || 640))
            );
            if (qc.width !== targetW) qc.width = targetW;
            if (qc.height !== targetH) qc.height = targetH;
            const qctx = qc.getContext("2d");
            if (qctx) {
              qctx.drawImage(video, 0, 0, qc.width, qc.height);
              const sx = qc.width / Math.max(1, video.videoWidth || 640);
              const sy = qc.height / Math.max(1, video.videoHeight || 480);
              const scaledBox = {
                x: box.x * sx,
                y: box.y * sy,
                width: box.width * sx,
                height: box.height * sy
              };
              const id = qctx.getImageData(0, 0, qc.width, qc.height);
              sharp = sharpnessAt(id, scaledBox);
              luma = meanLumaAt(id, scaledBox);
            }
          } catch {
            /* image quality is best-effort */
          }

          let brightFactor = 1;
          if (luma < 40) brightFactor = Math.max(0, luma / 40);
          else if (luma > 215) brightFactor = Math.max(0, (255 - luma) / 40);
          const sharpFactor = Math.max(0, Math.min(1, (sharp - 0.10) / 0.30));

          const baseQ = frameQuality(
            points,
            det.detection.score,
            video.videoWidth || 640,
            video.videoHeight || 480
          );
          const weight = baseQ * brightFactor * sharpFactor;

          // Accumulate raw landmarks + weights for the end-of-round
          // weighted consensus score. Frames below a quality floor are
          // still used for the live HUD but skipped for scoring.
          if (weight > 0.15) {
            landmarkAccumRef.current.push(points);
            weightAccumRef.current.push(weight);
          }

          // Live score: build a running weighted consensus from
          // accumulated landmarks once we have enough; before that, use
          // the latest frame's score as a fade-in.
          const accum = landmarkAccumRef.current;
          const ws = weightAccumRef.current;
          const liveScoreObj =
            accum.length >= 5
              ? computeEdgeScore(consensusLandmarksWeighted(accum, ws))
              : computeEdgeScore(points);
          const v = scoreFor(liveScoreObj, criterion);
          sampleBufferRef.current.push(v);

          if (sampleBufferRef.current.length >= 5) {
            const liveVal = Math.round(v);
            setLiveMine(liveVal);

            // Broadcast our running score to the opponent ~5x per second
            // so they see our number tick up live, not just at round end.
            const now = performance.now();
            if (now - lastTickSent > 200) {
              lastTickSent = now;
              sendMsg({ type: "score-tick", idx, value: liveVal });
            }
          }

          if (overlay && ctx) {
            const arHex = AR_COLOR_HEX[user.arColor] || "#4ade80";
            drawLiveOverlay(ctx, points, det.detection.box, overlay.width, arHex);
            // Cosmetic AR filter on top (crown / mustache / shades / etc).
            drawArFilter(ctx, user.arFilter || "none", points, overlay.width, true);
            // Cache for the gap-filling redraw on the next missed frame.
            lastDrawnLandmarksRef.current = points;
            lastDrawnBoxRef.current = {
              x: det.detection.box.x,
              y: det.detection.box.y,
              width: det.detection.box.width,
              height: det.detection.box.height
            };
            lastDrawnAtRef.current = performance.now();
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
      const matchOver = wins.me >= 2 || wins.opp >= 2 || next.length === 3;
      if (matchOver) {
        const won = wins.me >= wins.opp;
        // BOTH sides finalize locally from the visible scoreboard. Host
        // also broadcasts the verdict so older clients stay in sync,
        // but neither side waits on the message — which prevents the
        // guest from getting stuck on "between" if the result message
        // is dropped or delayed by the data channel.
        if (isHostRef.current) {
          sendMsg({
            type: "result",
            winner: won ? "host" : "guest",
            myWins: wins.me,
            oppWins: wins.opp
          });
        }
        finalizeMatch(won, wins.me, wins.opp);
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
    // Idempotent guard — both the local round-end timeout and the
    // inbound "result" message can race here. We only want to commit
    // the match record + ELO delta once.
    if (matchFinalizedRef.current) return;
    matchFinalizedRef.current = true;
    const isPlacement = user.placementsLeft > 0;
    const delta = eloDelta(user.elo, opponent.elo, won ? 1 : 0, isPlacement);

    const record: MatchRecord = {
      id: `live-${Date.now()}`,
      opponentName: opponent.username,
      opponentElo: opponent.elo,
      myScore: myWins,
      oppScore: oppWins,
      won,
      eloDelta: delta,
      playedAt: Date.now(),
      rounds: scoreboard.map((r, i) => ({
        criterion: ROUND_CRITERIA[i]?.label || "?",
        me: r.me,
        opp: r.opp
      })),
      mode: "bo3"
    };

    update((prev) =>
      applyMatchResult(prev, {
        won,
        rawEloDelta: delta,
        record,
        mode: "bo3"
      })
    );

    // Consume Edge Boost (one-shot).
    if (boostArmedRef.current) {
      update((prev) => ({ edgeBoosts: Math.max(0, prev.edgeBoosts - 1) }));
      setBoostArmed(false);
    }

    // Capture both faces RIGHT NOW while the WebRTC stream is still
    // alive — the deep-analysis flow on the result screen needs them.
    // We capture into a hidden 320x240 jpeg (small enough to send over
    // the wire without bloat).
    const oppFaceDataUrl = captureRemoteSnapshot();
    const myFaceDataUrl = captureLocalSnapshot() || user.faceDataUrl;

    setMatchResult({
      won,
      delta,
      rounds: scoreboard,
      oppFaceDataUrl,
      myFaceDataUrl,
      myWins,
      oppWins
    });
    setPhase("result");
    playSfx(won ? "win" : "lose");
    vibrate(won ? [50, 80, 50, 80, 200] : [400]);

    // Persist a shareable replay (best-effort, fire-and-forget).
    try {
      fetch(`/api/replay/${encodeURIComponent(record.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: record.id,
          myName: user.username || "PLAYER",
          oppName: opponent.username,
          myScore: myWins,
          oppScore: oppWins,
          won,
          eloDelta: delta,
          rounds: record.rounds || [],
          myFace: user.faceDataUrl,
          oppFace: null,
          mode: record.mode,
          playedAt: record.playedAt
        })
      }).catch(() => {});
    } catch {
      /* */
    }
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
          boostArmed={boostArmed}
          setBoostArmed={setBoostArmed}
          ownedBoosts={user.edgeBoosts}
          autoRematch={autoRematch}
          setAutoRematch={setAutoRematch}
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
            // Sync the overlay canvas dimensions to the actual video
            // resolution once metadata is known. Phones often produce
            // 480x640 portrait or 720x1280 streams — without this the
            // landmarks land in a tiny corner of the overlay because
            // the canvas internal pixel space is hardcoded to 640x480.
            if (el) {
              const sync = () => {
                const overlay = localOverlayElRef.current;
                if (overlay && el.videoWidth > 0 && el.videoHeight > 0) {
                  overlay.width = el.videoWidth;
                  overlay.height = el.videoHeight;
                  setLocalVideoAspect(`${el.videoWidth} / ${el.videoHeight}`);
                }
              };
              sync();
              el.addEventListener("loadedmetadata", sync);
              el.addEventListener("resize", sync);
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
          reactions={reactions}
          onReact={sendReaction}
          micOn={micOn}
          onMicToggle={toggleMic}
          reactionEmojis={user.customEmojis}
          privacyBlur={user.privacyBlur}
          chatLog={chatLog}
          chatInput={chatInput}
          setChatInput={setChatInput}
          onSendChat={sendChat}
          localVideoAspect={localVideoAspect}
          remoteVideoAspect={remoteVideoAspect}
          onForfeit={() => {
            // Treat as immediate 0-2 loss to the opponent.
            if (opponent) finalizeMatch(false, 0, 2);
          }}
        />
      )}

      {phase === "result" && matchResult && opponent && (
        <Result
          result={matchResult}
          opponent={opponent}
          onClose={onClose}
          onAgain={playAgain}
        />
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
  setValue,
  boostArmed,
  setBoostArmed,
  ownedBoosts,
  autoRematch,
  setAutoRematch
}: {
  onRandom: () => void;
  onHost: () => void;
  onJoin: (code: string) => void;
  value: string;
  setValue: (v: string) => void;
  boostArmed: boolean;
  setBoostArmed: (b: boolean) => void;
  ownedBoosts: number;
  autoRematch: boolean;
  setAutoRematch: (v: boolean) => void;
}) {
  const { user } = useUser();
  // Recent opponents from match history — top 3 most-recent ranked.
  const recent = user.matchHistory
    .filter((m) => !m.practice)
    .slice(0, 3);
  return (
    <div className="space-y-4">
      {/* Auto-rematch toggle — sticky between matches */}
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-white/65 transition hover:border-edge-cyan/30">
        <input
          type="checkbox"
          checked={autoRematch}
          onChange={(e) => setAutoRematch(e.target.checked)}
          className="h-4 w-4 accent-edge-cyan"
        />
        Auto-rematch after each match
      </label>

      {/* Recent opponents — quick rematch row */}
      {recent.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
          <p className="label-xs mb-2">Recent opponents</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/65"
              >
                <span style={{ color: m.won ? "#34d399" : "#f87171" }}>
                  {m.won ? "W" : "L"}
                </span>
                <span className="text-white/85">{m.opponentName}</span>
                <span className="stat-mono text-white/35">
                  {m.eloDelta >= 0 ? "+" : ""}
                  {m.eloDelta}
                </span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/30">
            Re-match: queue Random — same ELO band tends to repeat.
          </p>
        </div>
      )}
      {/* Edge Boost arming */}
      <div className="glass flex items-center justify-between rounded-xl p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <p className="label-xs text-mog-pink">Edge Boost</p>
            <p className="text-xs text-white/60">
              {ownedBoosts > 0
                ? `+10% to your scores this match. ${ownedBoosts} owned.`
                : "Earn boosts on the Season Pass."}
            </p>
          </div>
        </div>
        <button
          onClick={() => ownedBoosts > 0 && setBoostArmed(!boostArmed)}
          disabled={ownedBoosts === 0}
          className={
            "rounded-lg border px-4 py-2 text-[11px] uppercase tracking-[0.22em] transition " +
            (boostArmed
              ? "border-mog-pink bg-mog-pink/20 text-white"
              : ownedBoosts > 0
                ? "border-mog-pink/30 bg-mog-pink/5 text-mog-pink hover:border-mog-pink/60"
                : "border-white/10 bg-white/[0.02] text-white/30")
          }
        >
          {boostArmed ? "Armed ✓" : ownedBoosts > 0 ? "Arm Boost" : "Locked"}
        </button>
      </div>
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
            Get instantly paired with another Edgify player who&apos;s online
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
      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          onClick={onCopy}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
        >
          {copied ? "Copied ✓" : "Copy code"}
        </button>
        <CopyInviteLinkButton code={code} />
      </div>

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

/**
 * Copy a deep-link invite to the clipboard so the host can paste it
 * straight into iMessage / WhatsApp / Discord. Recipient lands on
 * /invite/[code] which redirects them into the arena auto-joining
 * the private room.
 */
function CopyInviteLinkButton({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  function copy() {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url).then(
      () => {
        setDone(true);
        window.setTimeout(() => setDone(false), 1500);
      },
      () => {
        /* clipboard blocked */
      }
    );
  }
  return (
    <button
      onClick={copy}
      className="rounded-lg border border-edge-cyan/40 bg-edge-cyan/[0.06] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:border-edge-cyan hover:bg-edge-cyan/15"
    >
      {done ? "Link copied ✓" : "Copy invite link"}
    </button>
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
  criterionLabel,
  reactions,
  onReact,
  micOn,
  onMicToggle,
  reactionEmojis,
  privacyBlur,
  chatLog,
  chatInput,
  setChatInput,
  onSendChat,
  localVideoAspect,
  remoteVideoAspect,
  onForfeit
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
  reactions: ReactionPing[];
  onReact: (emoji: string) => void;
  micOn: boolean;
  onMicToggle: () => void;
  reactionEmojis?: string[];
  privacyBlur?: boolean;
  chatLog: { id: number; from: "me" | "opp"; text: string }[];
  chatInput: string;
  setChatInput: (v: string) => void;
  onSendChat: () => void;
  localVideoAspect?: string;
  remoteVideoAspect?: string;
  onForfeit?: () => void;
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
        {phase === "vs" && <p className="label-xs text-edge-cyan">FACE OFF</p>}
        {phase === "scanning" && (
          <>
            <p className="label-xs">Round {round + 1} of 3</p>
            <h2 className="heading-card text-xl">{criterionLabel}</h2>
          </>
        )}
        {phase === "between" && lastRound && (() => {
          // Clutch: winning a round when down 0-1 in a Bo3, or 1-2 in
          // Bo5. Detected by checking the prior round's wins state.
          const prior = scoreboard.slice(0, -1);
          const priorWins = prior.reduce(
            (acc, r) => ({
              me: acc.me + (r.me > r.opp ? 1 : 0),
              opp: acc.opp + (r.opp > r.me ? 1 : 0)
            }),
            { me: 0, opp: 0 }
          );
          const wonThisRound = lastRound.me > lastRound.opp;
          const lostThisRound = lastRound.me < lastRound.opp;
          const myClutch = wonThisRound && priorWins.opp > priorWins.me;
          const oppClutch = lostThisRound && priorWins.me > priorWins.opp;
          return (
          <>
            <p className="label-xs">Round {round + 1} result</p>
            {(myClutch || oppClutch) && (
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{
                  borderColor: myClutch ? "#22e9ff" : "#ff5d8f",
                  background: myClutch
                    ? "rgba(34, 233, 255, 0.12)"
                    : "rgba(255, 93, 143, 0.10)",
                  color: myClutch ? "#22e9ff" : "#ff5d8f"
                }}
              >
                ⚡ Clutch
              </span>
            )}
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
          );
        })()}
      </div>

      {/* Mobile: stack vertically (each tile full-width landscape).
           Desktop: side-by-side with score badge between. */}
      <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_auto_1fr] md:gap-4">
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
          reactions={reactions.filter((r) => r.from === "me")}
          blur={privacyBlur}
          videoAspect={localVideoAspect}
        />

        <div className="flex items-center justify-center gap-2 md:flex-col">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black text-[10px] font-semibold tracking-[0.16em] text-white/70 md:h-16 md:w-16">
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
          reactions={reactions.filter((r) => r.from === "opp")}
          videoAspect={remoteVideoAspect}
        />
      </div>

      {/* Winner bar — tug-of-war between current scores */}
      {(phase === "scanning" || phase === "between") && (
        <WinnerBar
          myName={user.username || "YOU"}
          oppName={opponent?.username || "?"}
          myScore={liveMine}
          oppScore={liveOpp}
        />
      )}

      {/* Reaction + mic + chat — mobile-first toolbar.
          Uses 44px touch targets (Apple HIG / Material guideline).
          Chat collapses behind a toggle on small screens to save vertical
          space; expands inline on desktop. */}
      <MobileToolbar
        micOn={micOn}
        onMicToggle={onMicToggle}
        onReact={onReact}
        reactionEmojis={reactionEmojis}
        chatLog={chatLog}
        chatInput={chatInput}
        setChatInput={setChatInput}
        onSendChat={onSendChat}
        onForfeit={onForfeit}
      />

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

function WinnerBar({
  myName,
  oppName,
  myScore,
  oppScore
}: {
  myName: string;
  oppName: string;
  myScore: number;
  oppScore: number;
}) {
  const total = myScore + oppScore;
  // Default split is 50/50 until either side has actual numbers.
  const myPct = total > 0 ? (myScore / total) * 100 : 50;
  const leading: "me" | "opp" | "tie" =
    myScore > oppScore ? "me" : oppScore > myScore ? "opp" : "tie";
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-white/50">
        <span>{myName}</span>
        <span
          className="font-mono"
          style={{
            color:
              leading === "me"
                ? "#34d399"
                : leading === "opp"
                  ? "#f43f5e"
                  : "#fff"
          }}
        >
          {leading === "me"
            ? "← LEADING"
            : leading === "opp"
              ? "TRAILING →"
              : "TIED"}
        </span>
        <span className="text-right">{oppName}</span>
      </div>
      <div className="glass relative flex h-8 overflow-hidden rounded-full">
        <motion.div
          animate={{ width: `${myPct}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-start bg-emerald-500/35 pl-3 text-xs font-bold text-emerald-100"
        >
          {myScore > 0 ? myScore : ""}
        </motion.div>
        <motion.div
          animate={{ width: `${100 - myPct}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-end bg-rose-500/35 pr-3 text-xs font-bold text-rose-100"
        >
          {oppScore > 0 ? oppScore : ""}
        </motion.div>
      </div>
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
  reactions?: ReactionPing[];
  blur?: boolean;
  /** Source video's natural aspect ratio (e.g. "16 / 9") so the
   *  visible tile and AR overlay stay aligned across cameras. */
  videoAspect?: string;
  /** Whether to mute this tile's audio. The local tile MUST be muted
   *  (otherwise we hear our own echo); the remote tile MUST NOT be
   *  muted (otherwise the opponent's mic plays into a muted element
   *  and we never hear them). Defaults to `mirror` so the current
   *  call-sites — local=mirror+muted, remote=neither — work without
   *  explicit prop. */
  mutedAudio?: boolean;
}) {
  const muted = props.mutedAudio ?? !!props.mirror;
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
      <div
        className="relative w-full bg-black"
        style={{ aspectRatio: props.videoAspect || "4 / 3" }}
      >
        <video
          ref={props.videoRef}
          playsInline
          muted={muted}
          autoPlay
          style={
            props.blur
              ? { filter: "blur(12px) brightness(0.85) saturate(1.1)" }
              : undefined
          }
          className={`h-full w-full object-cover ${props.mirror ? "-scale-x-100" : ""}`}
        />
        {props.overlayRef && (
          <canvas
            ref={props.overlayRef}
            width={640}
            height={480}
            style={{ zIndex: 50 }}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        )}
        {/* Floating emoji reactions — burst up from the bottom of the tile */}
        <AnimatePresence>
          {(props.reactions || []).map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: 1, y: -120, scale: 1.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-5xl"
              style={{ zIndex: 60 }}
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="border-t border-white/[0.04] bg-black/50 px-2 py-2 text-center">
        <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-white">
          {props.name}
          <OwnerBadge name={props.name} size="xs" />
        </p>
        <p className="text-[9px] uppercase tracking-[0.32em]" style={{ color: props.rankColor }}>
          {props.rankEmoji} {props.rankLabel}
        </p>
      </div>
      {props.showScore && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="absolute right-3 top-3"
        >
          <ScoreGauge value={props.score} accent={props.rankColor} />
        </motion.div>
      )}
    </div>
  );
}

function Result({
  result,
  opponent,
  onClose,
  onAgain
}: {
  result: {
    won: boolean;
    delta: number;
    rounds: { me: number; opp: number }[];
    oppFaceDataUrl: string | null;
    myFaceDataUrl: string | null;
    myWins: number;
    oppWins: number;
  };
  opponent: { username: string; elo: number };
  onClose: () => void;
  onAgain?: () => void;
}) {
  const { user, update } = useUser();
  const [blocked, setBlocked] = useState(false);
  const [replayCopied, setReplayCopied] = useState(false);
  const lastMatchId = user.matchHistory[0]?.id;
  async function copyReplayLink() {
    if (!lastMatchId) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/replay/${encodeURIComponent(lastMatchId)}`
      );
      setReplayCopied(true);
      window.setTimeout(() => setReplayCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }
  const isBlocked = blocked || user.blockedUsers.includes(opponent.username);
  const blockOpponent = () => {
    if (isBlocked) return;
    update((prev) => ({
      blockedUsers: prev.blockedUsers.includes(opponent.username)
        ? prev.blockedUsers
        : [...prev.blockedUsers, opponent.username]
    }));
    setBlocked(true);
  };
  // Confetti only on big wins (>=20 ELO gained or 2-0 sweep)
  const myWins = result.rounds.reduce((s, r) => s + (r.me > r.opp ? 1 : 0), 0);
  const oppWins = result.rounds.reduce((s, r) => s + (r.opp > r.me ? 1 : 0), 0);
  const fireConfetti =
    result.won && (result.delta >= 20 || (myWins >= 2 && oppWins === 0));
  const [sharing, setSharing] = useState(false);
  const [shareDone, setShareDone] = useState<"shared" | "downloaded" | null>(null);
  const [clipping, setClipping] = useState(false);
  const [clipDone, setClipDone] = useState<"shared" | "downloaded" | null>(null);

  /**
   * Render the 6.5s vertical highlight clip and either share via the
   * native share sheet (TikTok/Insta accept webm) or fall back to a
   * direct download.
   */
  async function makeHighlight() {
    if (clipping) return;
    setClipping(true);
    setClipDone(null);
    try {
      const { renderHighlightClip } = await import("@/lib/highlight-clip");
      const myWinsLocal = result.rounds.reduce(
        (s, r) => s + (r.me > r.opp ? 1 : 0),
        0
      );
      const oppWinsLocal = result.rounds.reduce(
        (s, r) => s + (r.opp > r.me ? 1 : 0),
        0
      );
      const rank = rankFromElo(user.elo);
      const blob = await renderHighlightClip({
        myName: user.username || "PLAYER",
        oppName: opponent.username,
        myFace: result.myFaceDataUrl || user.faceDataUrl,
        oppFace: result.oppFaceDataUrl,
        rounds: result.rounds.map((r, i) => ({
          criterion: ROUND_CRITERIA[i]?.label || "?",
          me: r.me,
          opp: r.opp
        })),
        won: result.won,
        eloDelta: result.delta,
        rankLabel: rank.label,
        rankColor: rank.color,
        rankEmoji: rank.emoji
      });
      // Mark unused variables (keep for future telemetry).
      void myWinsLocal;
      void oppWinsLocal;
      if (!blob) return;
      const file = new File([blob], `edgify-clip-${Date.now()}.webm`, {
        type: blob.type
      });
      const navAny = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Edgify Highlight",
          text: "Just had a 1v1 face-off on Edgify."
        });
        setClipDone("shared");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        setClipDone("downloaded");
      }
    } catch {
      /* cancelled / unsupported */
    } finally {
      setClipping(false);
    }
  }

  async function share() {
    if (sharing) return;
    setSharing(true);
    try {
      const { renderShareCard } = await import("@/lib/share-card");
      const myWins = result.rounds.reduce((s, r) => s + (r.me > r.opp ? 1 : 0), 0);
      const oppWins = result.rounds.reduce((s, r) => s + (r.opp > r.me ? 1 : 0), 0);
      const rank = rankFromElo(user.elo);
      const blob = await renderShareCard({
        myName: user.username || "PLAYER",
        oppName: opponent.username,
        myScore: myWins,
        oppScore: oppWins,
        myFace: user.faceDataUrl,
        oppFace: null,
        won: result.won,
        eloDelta: result.delta,
        rankLabel: rank.label,
        rankColor: rank.color,
        rankEmoji: rank.emoji
      });
      if (!blob) return;

      const file = new File([blob], `edgify-match-${Date.now()}.png`, {
        type: "image/png"
      });

      const navAny = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "I just played Edgify",
          text: `Edgify match: ${myWins}–${oppWins} vs ${opponent.username}. ${
            result.delta >= 0 ? "+" : ""
          }${result.delta} ELO.`
        });
        setShareDone("shared");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        setShareDone("downloaded");
      }
    } catch {
      /* user cancelled or share unsupported */
    } finally {
      setSharing(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-2xl px-8 py-12 text-center"
    >
      {fireConfetti && <Confetti trigger={1} />}
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
      {/* Coaching tip — only shown after a loss when there's a clear pattern */}
      {!result.won && (() => {
        const tip = coachingTip(user);
        if (!tip) return null;
        return (
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-mog-violet/30 bg-mog-violet/5 p-4 text-left">
            <p className="label-xs text-mog-violet">Coach · {tip.criterion}</p>
            <p className="mt-2 text-xs leading-relaxed text-white/70">{tip.tip}</p>
          </div>
        );
      })()}

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {onAgain && (
          <button
            onClick={onAgain}
            className="rounded-lg border border-emerald-400/60 bg-emerald-500/15 px-6 py-3 text-xs uppercase tracking-[0.22em] text-emerald-100 transition hover:border-emerald-400 hover:bg-emerald-500/25"
          >
            Play Again →
          </button>
        )}
        <button
          onClick={makeHighlight}
          disabled={clipping}
          className="rounded-lg border border-edge-coral/50 bg-edge-coral/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-coral hover:bg-edge-coral/25 disabled:opacity-50"
          title="Render a vertical clip ready for TikTok/Insta"
        >
          {clipping
            ? "Recording…"
            : clipDone === "shared"
              ? "Shared ✓"
              : clipDone === "downloaded"
                ? "Saved ✓"
                : "Save Clip 🎥"}
        </button>
        <button
          onClick={share}
          disabled={sharing}
          className="rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30 disabled:opacity-50"
        >
          {sharing
            ? "Rendering…"
            : shareDone === "shared"
              ? "Shared ✓"
              : shareDone === "downloaded"
                ? "Saved ✓"
                : "Share Card"}
        </button>
        <button
          onClick={copyReplayLink}
          disabled={!lastMatchId}
          className="rounded-lg border border-cyan-400/30 bg-cyan-500/5 px-6 py-3 text-xs uppercase tracking-[0.22em] text-cyan-200 transition hover:border-cyan-400/60 disabled:opacity-40"
        >
          {replayCopied ? "Copied ✓" : "Copy Replay Link"}
        </button>
        <button
          onClick={blockOpponent}
          disabled={isBlocked}
          className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-6 py-3 text-xs uppercase tracking-[0.22em] text-rose-200 transition hover:border-rose-500/60 hover:bg-rose-500/10 disabled:opacity-40"
        >
          {isBlocked ? "Blocked ✓" : "Block"}
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-6 py-3 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
        >
          Back to Arena
        </button>
      </div>

      {/* AI deep-analysis surface — only renders when both face snapshots
          were captured at match end. SVG silhouettes (demo mode) get
          filtered out so we don't ship a non-photo to the analyzer. */}
      <DeepAnalysis
        myFace={photoOnly(result.myFaceDataUrl) || photoOnly(user.faceDataUrl)}
        oppFace={photoOnly(result.oppFaceDataUrl)}
        myName={user.username || "Player A"}
        oppName={opponent.username}
        myScore={result.myWins}
        oppScore={result.oppWins}
      />
    </motion.div>
  );
}

// Returns the data URL only if it's a photo (jpeg/png/webp). The demo
// path produces an SVG silhouette which the analysis API can't accept,
// so we filter it out at the call site.
function photoOnly(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^data:image\/(jpeg|png|webp)/.test(url) ? url : null;
}

/**
 * In-round score readout. Circular SVG progress ring with the value
 * tweened smoothly via local state. Replaces the old plain "SCORE 69"
 * label with something that reads as a HUD instrument.
 */
function ScoreGauge({
  value,
  accent
}: {
  value: number | null;
  accent: string;
}) {
  const target = Math.max(0, Math.min(100, value ?? 0));
  const [display, setDisplay] = useState(target);
  // Smoothly tween towards the target value when it changes.
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = display;
    const to = target;
    const dur = 400;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(from + (to - from) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const r = 30;
  const c = 2 * Math.PI * r;
  const dash = c * (display / 100);

  return (
    <div className="relative h-[78px] w-[78px]">
      <svg
        viewBox="0 0 80 80"
        className="absolute inset-0 -rotate-90"
        style={{ filter: "drop-shadow(0 0 8px rgba(34,233,255,0.35))" }}
      >
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22e9ff" />
            <stop offset="100%" stopColor="#ff5d8f" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx="40"
          cy="40"
          r={r}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="5"
          fill="rgba(0,0,0,0.55)"
        />
        {/* Progress arc */}
        <circle
          cx="40"
          cy="40"
          r={r}
          stroke="url(#scoreGrad)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
        />
        {/* Tier-color tick at 12 o'clock */}
        <circle cx="40" cy="10" r="2" fill={accent} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="stat-mono text-[8px] uppercase tracking-[0.22em] text-white/45">
          SCORE
        </span>
        <span className="stat-mono text-xl font-bold leading-none text-white">
          {value === null ? "—" : Math.round(display)}
        </span>
      </div>
    </div>
  );
}

/**
 * Mobile-first toolbar containing the mic toggle, emoji reactions, and
 * collapsible chat. On phones it sticks visually compact; on desktop
 * the chat expands inline. The reactions and mic use 44px+ tap targets
 * (Apple HIG) so they're comfortable to hit on phones.
 */
function MobileToolbar({
  micOn,
  onMicToggle,
  onReact,
  reactionEmojis,
  chatLog,
  chatInput,
  setChatInput,
  onSendChat,
  onForfeit
}: {
  micOn: boolean;
  onMicToggle: () => void;
  onReact: (emoji: string) => void;
  reactionEmojis?: string[];
  chatLog: { id: number; from: "me" | "opp"; text: string }[];
  chatInput: string;
  setChatInput: (v: string) => void;
  onSendChat: () => void;
  onForfeit?: () => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const unread = chatLog.filter((m) => m.from === "opp").length;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={onMicToggle}
          className={
            "h-11 w-11 rounded-full border text-xl transition active:scale-95 " +
            (micOn
              ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
              : "border-white/10 bg-white/[0.03] text-white/50")
          }
          aria-label={micOn ? "Mic on" : "Mic off"}
          title={micOn ? "Mic on — opponent hears you" : "Mic off — tap to talk"}
        >
          {micOn ? "🎙️" : "🔇"}
        </button>
        {(reactionEmojis || DEFAULT_REACTIONS).map((e) => (
          <button
            key={e}
            onClick={() => onReact(e)}
            className="h-11 w-11 rounded-full border border-white/10 bg-white/[0.03] text-xl transition hover:border-edge-cyan/50 hover:bg-edge-cyan/10 active:scale-95 sm:h-10 sm:w-10"
            aria-label={`React with ${e}`}
          >
            {e}
          </button>
        ))}
        <button
          onClick={() => setChatOpen((v) => !v)}
          className={
            "relative h-11 rounded-full border px-4 text-[11px] font-semibold uppercase tracking-[0.22em] transition sm:h-10 " +
            (chatOpen
              ? "border-edge-cyan/60 bg-edge-cyan/15 text-edge-cyan"
              : "border-white/10 bg-white/[0.03] text-white/65 hover:border-edge-cyan/30")
          }
          aria-expanded={chatOpen}
        >
          Chat
          {!chatOpen && unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-edge-coral text-[9px] font-bold text-black">
              {Math.min(9, unread)}
            </span>
          )}
        </button>
        {onForfeit && (
          <button
            onClick={() => {
              if (confirm("Forfeit this match? Counts as a loss.")) onForfeit();
            }}
            className="h-11 rounded-full border border-rose-500/40 bg-rose-500/[0.06] px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200 transition hover:border-rose-500/70 hover:bg-rose-500/15 sm:h-10"
            title="Forfeit the match — counts as a loss"
          >
            Forfeit
          </button>
        )}
      </div>

      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mx-auto mt-3 w-full max-w-md">
              <div className="glass max-h-40 overflow-y-auto rounded-lg p-2 text-xs">
                {chatLog.length === 0 ? (
                  <p className="text-center text-[10px] uppercase tracking-[0.22em] text-white/30">
                    Match chat — say hi
                  </p>
                ) : (
                  chatLog.map((m) => (
                    <div
                      key={m.id}
                      className={
                        "px-2 py-1 " +
                        (m.from === "me" ? "text-emerald-200" : "text-white/80")
                      }
                    >
                      <span className="mr-2 text-[9px] uppercase tracking-[0.22em] text-white/40">
                        {m.from === "me" ? "you" : "opp"}
                      </span>
                      {m.text}
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSendChat();
                }}
                className="mt-2 flex gap-2"
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value.slice(0, 140))}
                  placeholder="Send a message…"
                  maxLength={140}
                  className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-edge-cyan"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="rounded-lg border border-edge-cyan/40 bg-edge-cyan/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:border-edge-cyan hover:bg-edge-cyan/20 disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Camera helper (mirror of FaceScanner's chain) ────────────────────
async function getCameraStream(): Promise<MediaStream> {
  // Live match requests audio too, but we MUTE the local track by
  // default and let the user toggle their mic on. The remote video
  // element renders the audio so opponents come through automatically.
  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: { ideal: "user" }
      },
      audio: { echoCancellation: true, noiseSuppression: true }
    },
    {
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: { echoCancellation: true, noiseSuppression: true }
    },
    { video: true, audio: true },
    // Last resort if the user denies mic but allows camera.
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
