"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { api, ApiError } from "@/lib/client/api";
import { captureBurst, useCamera } from "@/lib/client/camera";
import { connectMatch, type RtcHandle, type RtcState } from "@/lib/client/rtc";
import type { MatchView } from "@/lib/shared/match-types";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { CenteredSpinner, ErrorCard, useRequireSignIn } from "@/components/play/common";
import { VideoTile } from "@/components/play/video-tile";
import { MatchResult } from "@/components/play/match-result";

type Phase = "idle" | "capturing" | "scoring" | "retry" | "scored" | "out";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const KIND_LABEL = { ranked: "Ranked 1v1", room: "Private room", tourney: "Tournament" } as const;

export default function MatchPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const router = useRouter();
  const { me, refresh } = useRequireSignIn();
  const cam = useCamera({ audio: true });

  const [match, setMatch] = useState<MatchView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const skew = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [rtcState, setRtcState] = useState<RtcState>("connecting");
  const rtcRef = useRef<RtcHandle | null>(null);
  const [micOn, setMicOn] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [captureMsg, setCaptureMsg] = useState<string | null>(null);
  const readySent = useRef(false);
  const [leaving, setLeaving] = useState(false);

  const signedIn = !!me;
  const finished = match?.state === "done" || match?.state === "cancelled";

  const apply = useCallback((m: MatchView) => {
    skew.current = m.serverNow - Date.now();
    setMatch(m);
  }, []);

  // ── Poll match state ─────────────────────────────────────────────
  useEffect(() => {
    if (!signedIn) return;
    let stop = false;
    (async () => {
      while (!stop) {
        try {
          const r = await api<{ match: MatchView }>(`/api/match/${id}`);
          if (stop) return;
          apply(r.match);
          if (r.match.state === "done" || r.match.state === "cancelled") return;
        } catch (e) {
          if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
            if (!stop) setLoadError(e.message);
            return;
          }
        }
        await sleep(1000);
      }
    })();
    return () => {
      stop = true;
    };
  }, [id, signedIn, apply]);

  // ── Camera (mic starts muted) ────────────────────────────────────
  const { start: startCam, stop: stopCam } = cam;
  useEffect(() => {
    if (signedIn && !finished) startCam();
  }, [signedIn, finished, startCam]);

  useEffect(() => {
    cam.stream?.getAudioTracks().forEach((t) => (t.enabled = micOn));
  }, [cam.stream, micOn]);

  // ── Peer video link ──────────────────────────────────────────────
  const matchId = match?.id;
  const iAmHost = match?.iAmHost;
  useEffect(() => {
    if (!cam.stream || !matchId || iAmHost === undefined || finished) return;
    const h = connectMatch({
      matchId,
      iAmHost,
      localStream: cam.stream,
      onRemoteStream: setRemote,
      onState: setRtcState
    });
    rtcRef.current = h;
    return () => {
      h.close();
      rtcRef.current = null;
      setRemote(null);
    };
  }, [cam.stream, matchId, iAmHost, finished]);

  // When the match ends, free the camera.
  useEffect(() => {
    if (!finished) return;
    stopCam();
    refresh();
  }, [finished, stopCam, refresh]);

  // ── Ready up once the camera is live ─────────────────────────────
  const meLower = me?.username.toLowerCase();
  useEffect(() => {
    if (!match || match.state !== "connecting" || cam.state !== "live" || !meLower) return;
    if (match.ready.includes(meLower) || readySent.current) return;
    readySent.current = true;
    api<{ match: MatchView }>(`/api/match/${id}/action`, { body: { action: "ready" } })
      .then((r) => apply(r.match))
      .catch(() => {
        readySent.current = false;
      });
  }, [match, cam.state, meLower, id, apply]);

  // ── Clock for countdown ──────────────────────────────────────────
  const live = match?.state === "live";
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [live]);

  const serverNow = now + skew.current;
  const startAt = match?.startAt ?? null;
  const remaining = startAt ? startAt - serverNow : null;

  // Already scored (e.g. after a reload)?
  const myScore = match ? match.scores[match.me] : undefined;
  useEffect(() => {
    if (myScore?.ok && phase !== "scored") setPhase("scored");
  }, [myScore, phase]);

  // ── Capture + score at startAt ───────────────────────────────────
  const capture = useCallback(async () => {
    const v = cam.videoRef.current;
    setPhase("capturing");
    setCaptureMsg(null);
    const frames = v ? await captureBurst(v, 3, 400) : [];
    if (!frames.length) {
      setCaptureMsg("Waiting for your camera…");
      setPhase("retry");
      setTimeout(() => setPhase("idle"), 1500);
      return;
    }
    setPhase("scoring");
    try {
      const r = await api<{ ok: boolean; match: MatchView }>(`/api/match/${id}/frames`, { body: { frames } });
      apply(r.match);
      setPhase("scored");
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.body?.match) apply(err.body.match as MatchView);
      if (err?.status === 422) {
        setCaptureMsg(err.message);
        setPhase("retry");
        setTimeout(() => setPhase("idle"), 2500);
      } else if (err?.code === "already_scored") {
        setPhase("scored");
      } else if (err?.code === "no_attempts" || err?.code === "rate_limited") {
        setCaptureMsg(err.message);
        setPhase("out");
      } else if (err?.code === "too_early" || err?.code === "not_live") {
        setPhase("retry");
        setTimeout(() => setPhase("idle"), 1000);
      } else {
        setCaptureMsg(err?.message || "Connection hiccup — retrying…");
        setPhase("retry");
        setTimeout(() => setPhase("idle"), 2500);
      }
    }
  }, [cam.videoRef, id, apply]);

  useEffect(() => {
    if (!live || remaining === null || remaining > 0 || phase !== "idle" || myScore?.ok) return;
    capture();
  }, [live, remaining, phase, myScore, capture]);

  // ── Leaving forfeits (ranked) or cancels (before start) ──────────
  const stateRef = useRef(match?.state);
  stateRef.current = match?.state;
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const sendLeave = () => {
      if (stateRef.current === "connecting" || stateRef.current === "live") {
        api(`/api/match/${id}/action`, { body: { action: "leave" }, keepalive: true }).catch(() => {});
      }
    };
    window.addEventListener("pagehide", sendLeave);
    return () => {
      mounted.current = false;
      window.removeEventListener("pagehide", sendLeave);
      // Deferred so React strict-mode's simulated unmount doesn't forfeit.
      setTimeout(() => {
        if (!mounted.current) sendLeave();
      }, 0);
    };
  }, [id]);

  async function leave() {
    const started = match?.state === "live";
    const msg =
      started && match?.kind === "ranked"
        ? "Leave the match? It counts as a loss."
        : started
          ? "Leave the match? Your opponent wins."
          : "Leave this match?";
    if (!window.confirm(msg)) return;
    setLeaving(true);
    try {
      await api(`/api/match/${id}/action`, { body: { action: "leave" } });
    } catch {
      /* go anyway */
    }
    router.push(match?.tourney ? `/play/tourney/${match.tourney}` : "/play");
  }

  // ── Render ───────────────────────────────────────────────────────
  if (loadError) {
    return (
      <main className="page">
        <ErrorCard title="Match unavailable" body={loadError} action={<ButtonLink href="/play">Back to Play</ButtonLink>} />
      </main>
    );
  }
  if (!me || !match) {
    return (
      <main className="page">
        <CenteredSpinner label="Joining match…" />
      </main>
    );
  }

  if (match.state === "done") {
    return (
      <main className="page max-w-[860px]">
        <MatchResult match={match} />
      </main>
    );
  }

  if (match.state === "cancelled") {
    return (
      <main className="page">
        <ErrorCard
          title="Match called off"
          body={
            match.ready.length < 2
              ? `${match.opponent} didn't connect in time. No ELO changed.`
              : "Neither face could be scored in time. No ELO changed."
          }
          action={
            <>
              <ButtonLink href={match.kind === "ranked" ? "/play?search=1" : "/play"}>
                {match.kind === "ranked" ? "Find another" : "Back to Play"}
              </ButtonLink>
              <ButtonLink href="/" variant="plain">
                Home
              </ButtonLink>
            </>
          }
        />
      </main>
    );
  }

  const meInfo = match.players.find((p) => p.username === match.me);
  const oppInfo = match.players.find((p) => p.username === match.opponent);
  const oppReady = match.ready.includes(match.opponent.toLowerCase());
  const oppScored = !!match.scores[match.opponent];
  const remoteLive = rtcState === "connected" && !!remote;

  const cameraProblem = cam.state === "denied" || cam.state === "unavailable";

  return (
    <main className="page max-w-[1080px]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{KIND_LABEL[match.kind]}</p>
          <h1 className="mt-1 text-[24px] font-bold tracking-tighter md:text-[30px]">
            You vs {match.opponent}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={micOn ? "secondary" : "plain"}
            size="sm"
            onClick={() => setMicOn((v) => !v)}
            aria-pressed={micOn}
            disabled={!cam.stream?.getAudioTracks().length}
          >
            <MicIcon off={!micOn} />
            <span className="hidden sm:inline">{micOn ? "Mic on" : "Mic off"}</span>
          </Button>
          <Button variant="danger" size="sm" onClick={leave} loading={leaving}>
            Leave
          </Button>
        </div>
      </div>

      <StatusBar
        state={match.state}
        remaining={remaining}
        phase={phase}
        message={captureMsg}
        opponent={match.opponent}
        oppReady={oppReady}
        oppScored={oppScored}
        cameraProblem={cameraProblem}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <VideoTile
          name={match.me}
          elo={meInfo?.elo}
          hasFace={meInfo?.hasFace}
          videoRef={cam.videoRef}
          mirrored
          muted
          you
          showVideo={cam.state === "live"}
          fallback={
            <p className="text-[14px] text-ink-3">
              {cam.state === "denied"
                ? "Camera blocked — allow it in your browser's address bar."
                : cam.state === "unavailable"
                  ? "No camera found."
                  : "Starting camera…"}
            </p>
          }
          overlay={<CaptureOverlay live={live} remaining={remaining} phase={phase} />}
        />
        <VideoTile
          name={match.opponent}
          elo={oppInfo?.elo}
          hasFace={oppInfo?.hasFace}
          stream={remote}
          showVideo={remoteLive}
          fallback={
            <p className="max-w-[240px] text-[14px] text-ink-3">
              {rtcState === "failed"
                ? "Video unavailable — the face-off still counts."
                : oppReady
                  ? "Connecting video…"
                  : `Waiting for ${match.opponent}…`}
            </p>
          }
        />
      </div>

      <p className="mt-5 text-center text-[13px] text-ink-4">
        Face the camera in good light. Both faces are scored by the same AI at the same moment.
      </p>
    </main>
  );
}

function StatusBar({
  state,
  remaining,
  phase,
  message,
  opponent,
  oppReady,
  oppScored,
  cameraProblem
}: {
  state: MatchView["state"];
  remaining: number | null;
  phase: Phase;
  message: string | null;
  opponent: string;
  oppReady: boolean;
  oppScored: boolean;
  cameraProblem: boolean;
}) {
  let tone: "info" | "accent" | "error" = "info";
  let text: React.ReactNode;
  let spin = false;

  if (cameraProblem) {
    tone = "error";
    text = "Edgify needs your camera to score you. Allow camera access and reload.";
  } else if (state === "connecting") {
    spin = true;
    text = oppReady ? "Starting…" : `Waiting for ${opponent} to join…`;
  } else if (remaining !== null && remaining > 0) {
    tone = "accent";
    text = remaining > 3000 ? "Get ready — look straight at the camera" : "Hold still…";
  } else if (phase === "capturing") {
    tone = "accent";
    text = "Hold still…";
  } else if (phase === "scoring") {
    spin = true;
    text = "Analyzing your face…";
  } else if (phase === "retry") {
    tone = "error";
    text = message || "Retrying…";
  } else if (phase === "out") {
    tone = "error";
    text = message || "Out of attempts for this match.";
  } else if (phase === "scored") {
    spin = true;
    text = oppScored ? "Revealing results…" : `You're scored. Waiting for ${opponent}…`;
  } else {
    spin = true;
    text = "Starting…";
  }

  return (
    <div
      className={clsx(
        "flex min-h-[52px] items-center justify-center gap-3 rounded-2xl px-5 py-3 text-center text-[15px] font-medium",
        tone === "info" && "bg-white text-ink-2 shadow-card",
        tone === "accent" && "bg-accent text-white",
        tone === "error" && "bg-[#fdeceb] text-bad"
      )}
      role="status"
      aria-live="polite"
    >
      {spin && <Spinner className="h-4 w-4" />}
      {text}
    </div>
  );
}

function CaptureOverlay({ live, remaining, phase }: { live: boolean; remaining: number | null; phase: Phase }) {
  if (!live) return null;
  const counting = remaining !== null && remaining > 0;
  const n = counting ? Math.min(3, Math.ceil(remaining / 1000)) : null;
  return (
    <div className="pointer-events-none flex h-full w-full items-center justify-center">
      {/* face guide */}
      <div
        className={clsx(
          "absolute left-1/2 top-1/2 h-[72%] w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 transition-colors",
          counting || phase === "capturing" ? "border-white/90" : "border-white/0"
        )}
      />
      {counting && n !== null && (
        <span key={n} className="animate-fade-up text-[88px] font-bold leading-none text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
          {n}
        </span>
      )}
      {phase === "capturing" && <span className="absolute inset-0 animate-pulse rounded-3xl bg-white/15" />}
    </div>
  );
}

function MicIcon({ off }: { off: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3.5" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {off && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}
