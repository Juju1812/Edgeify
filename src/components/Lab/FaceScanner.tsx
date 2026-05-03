"use client";

import { useEffect, useRef, useState } from "react";
import {
  computeEdgeScore,
  eyeAspectRatio,
  getEyePoints,
  type Pt
} from "@/lib/edge-score";
import type { EdgeScoreBreakdown } from "@/lib/types";

type FaceApiNS = typeof import("face-api.js");

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

type Phase =
  | "idle"
  | "loading-models"
  | "ready"
  | "scanning"
  | "liveness"
  | "computing"
  | "done"
  | "error";

export type ScanResult = {
  score: EdgeScoreBreakdown;
  faceDataUrl: string;
};

/**
 * Generate a plausible-looking EdgeScore for the demo path (no working
 * webcam available). Bell-ish distribution centered around 60. Composite
 * is the weighted sum so it stays consistent with the real scoring.
 */
function syntheticScore(): EdgeScoreBreakdown {
  const rand = () => (Math.random() + Math.random()) / 2;
  const symmetry = 0.4 + rand() * 0.5;
  const jawlineDefinition = 0.35 + rand() * 0.5;
  const canthalTilt = (Math.random() - 0.4) * 0.8;
  const cheekboneProm = 0.3 + rand() * 0.55;
  const goldenRatio = 0.4 + rand() * 0.5;
  const composite =
    100 *
    (0.30 * symmetry +
      0.25 * jawlineDefinition +
      0.15 * (1 - Math.abs(canthalTilt - 0.4)) +
      0.15 * cheekboneProm +
      0.15 * goldenRatio);
  return {
    symmetry,
    jawlineDefinition,
    canthalTilt,
    cheekboneProm,
    goldenRatio,
    composite: Math.round(Math.max(0, Math.min(100, composite)))
  };
}

/**
 * 320x240 inline SVG silhouette as a data URL. Used as the "photo" when
 * the user takes the demo path with no real camera capture.
 */
function silhouetteDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" width="320" height="240"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#15113d"/><stop offset="100%" stop-color="#070512"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/><circle cx="160" cy="92" r="40" fill="#7c3aed" opacity="0.55"/><path d="M82 240 C82 174 116 142 160 142 C204 142 238 174 238 240 Z" fill="#7c3aed" opacity="0.55"/><text x="160" y="222" text-anchor="middle" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.4)" letter-spacing="3">DEMO MODE</text></svg>`;
  return `data:image/svg+xml;base64,${typeof window === "undefined" ? "" : btoa(svg)}`;
}

/**
 * Try a chain of progressively-loosened constraints. Many desktops have
 * webcams that don't expose `facingMode`, so a strict {facingMode:"user"}
 * fails with NotFoundError on hardware that's perfectly capable of front-
 * facing capture. Walk down the list until one works.
 */
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
      // Permission denied / in-use are not "try a looser constraint"
      // problems — bail immediately so the user sees the right message.
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

function humanizeCameraError(e: unknown): string {
  const err = e as { name?: string; message?: string } | undefined;
  switch (err?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera permission was denied. Click the camera icon in your browser's address bar, set it to Allow, then retry.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera detected. Connect a webcam (or close any app that might be holding it — Zoom, Teams, OBS) and retry.";
    case "NotReadableError":
    case "TrackStartError":
      return "Camera is in use by another app. Close Zoom, Teams, OBS, or any browser tab using the camera and retry.";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "This camera doesn't support the requested resolution. Try a different webcam.";
    case "SecurityError":
      return "Camera access is blocked by browser security. Make sure you loaded the site over HTTPS.";
    default:
      return err?.message || "Could not start the camera. Check that one is connected and try again.";
  }
}

export function FaceScanner({
  onComplete
}: {
  onComplete: (result: ScanResult) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const captureRef = useRef<HTMLCanvasElement>(null);
  const faceApiRef = useRef<FaceApiNS | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const blinksRef = useRef(0);
  const earWasLowRef = useRef(false);
  const samplesRef = useRef<EdgeScoreBreakdown[]>([]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0..1
  const [liveScore, setLiveScore] = useState<EdgeScoreBreakdown | null>(null);
  const [blinks, setBlinks] = useState(0);

  // ─── Model + camera bootstrap ───────────────────────────────────────
  async function start() {
    setError(null);
    setPhase("loading-models");
    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "This browser doesn't expose a camera API. Try Chrome, Edge, Firefox, or Safari over HTTPS."
        );
      }

      const faceapi = (await import("face-api.js")) as FaceApiNS;
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      faceApiRef.current = faceapi;

      const stream = await getCameraStream();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("ready");
    } catch (e: unknown) {
      // For "no camera" errors, also probe the device list so we can tell
      // the user whether the browser sees any video inputs at all.
      const baseMsg = humanizeCameraError(e);
      const name = (e as DOMException)?.name;
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        try {
          const devs = await navigator.mediaDevices.enumerateDevices();
          const cams = devs.filter((d) => d.kind === "videoinput");
          const diag =
            cams.length === 0
              ? "Browser sees 0 video inputs — your computer has no working camera the browser can access. Likely causes: (1) no webcam attached, (2) camera disabled in Device Manager, or (3) Windows Privacy → Camera → Camera access is OFF for this device."
              : `Browser sees ${cams.length} video input${cams.length === 1 ? "" : "s"} but couldn't open ${cams.length === 1 ? "it" : "any of them"} — the camera is probably blocked at the OS or browser permission level, or another app is holding it.`;
          setError(`${baseMsg}\n\n${diag}`);
        } catch {
          setError(baseMsg);
        }
      } else {
        setError(baseMsg);
      }
      setPhase("error");
    }
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  /**
   * Skip the camera entirely and synthesize a plausible score. Lets users
   * without a working webcam (or who just want a quick look) try out the
   * rest of the game loop. The reveal screen surfaces this clearly so
   * nobody mistakes a demo score for a real one.
   */
  function takeDemoPath() {
    stopCamera();
    setPhase("computing");
    setTimeout(() => {
      setPhase("done");
      onComplete({ score: syntheticScore(), faceDataUrl: silhouetteDataUrl() });
    }, 700);
  }

  useEffect(() => stopCamera, []);

  // ─── Scan loop ───────────────────────────────────────────────────────
  async function beginScan() {
    setPhase("scanning");
    setProgress(0);
    blinksRef.current = 0;
    earWasLowRef.current = false;
    samplesRef.current = [];
    setBlinks(0);
    loop();
  }

  async function loop() {
    const faceapi = faceApiRef.current;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!faceapi || !video || !overlay || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const W = overlay.width;
    const H = overlay.height;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
      .withFaceLandmarks();

    if (detection) {
      const box = detection.detection.box;
      const points: Pt[] = detection.landmarks.positions.map((p) => ({
        x: p.x,
        y: p.y
      }));

      // Bounding box
      ctx.strokeStyle = "rgba(168, 85, 247, 0.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      // Landmark dots
      ctx.fillStyle = "rgba(168, 85, 247, 0.9)";
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sampling
      const sample = computeEdgeScore(points);
      samplesRef.current.push(sample);
      // Keep last 30 samples for stability
      if (samplesRef.current.length > 30) samplesRef.current.shift();

      // Smooth display by averaging recent samples
      const avg = averageSamples(samplesRef.current);
      setLiveScore(avg);

      // Liveness — count blinks
      const eyes = getEyePoints(points);
      const ear =
        (eyeAspectRatio(eyes.left) + eyeAspectRatio(eyes.right)) / 2;
      if (ear < 0.21 && !earWasLowRef.current) {
        earWasLowRef.current = true;
      } else if (ear > 0.27 && earWasLowRef.current) {
        earWasLowRef.current = false;
        blinksRef.current += 1;
        setBlinks(blinksRef.current);
      }

      // Progress is samples collected up to 30 (about 1.5 sec at 20fps)
      setProgress(Math.min(1, samplesRef.current.length / 30));

      // Once we have a stable read AND at least 1 blink → complete
      if (samplesRef.current.length >= 30 && blinksRef.current >= 1) {
        finalize(avg);
        return;
      }
    } else {
      ctx.font = "12px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillText("LOOKING FOR FACE…", 12, 20);
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  function finalize(avg: EdgeScoreBreakdown) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPhase("computing");

    // Capture the current frame to a JPEG data URL.
    const video = videoRef.current!;
    const cap = captureRef.current!;
    cap.width = 320;
    cap.height = 240;
    const cctx = cap.getContext("2d")!;
    cctx.drawImage(video, 0, 0, cap.width, cap.height);
    const faceDataUrl = cap.toDataURL("image/jpeg", 0.85);

    // Brief dramatic pause so the "computing" UI registers.
    setTimeout(() => {
      stopCamera();
      setPhase("done");
      onComplete({ score: avg, faceDataUrl });
    }, 900);
  }

  // ─── UI ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="glass relative aspect-video w-full overflow-hidden rounded-2xl">
        <video
          ref={videoRef}
          width={640}
          height={480}
          playsInline
          muted
          className="h-full w-full -scale-x-100 object-cover"
        />
        <canvas
          ref={overlayRef}
          width={640}
          height={480}
          className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />
        <canvas ref={captureRef} className="hidden" />

        {phase === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 text-center">
            <p className="label-xs text-white/60">Webcam-only · Local capture</p>
            <h3 className="heading-card text-2xl">Calibrate your EdgeScore</h3>
            <p className="max-w-sm px-6 text-xs leading-relaxed text-white/50">
              We&apos;ll use your camera to capture a few frames, detect facial
              landmarks, and compute a geometric score. Nothing leaves your
              device unless you save the result.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={start}
                className="rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30"
              >
                Allow Camera →
              </button>
              <button
                onClick={takeDemoPath}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-5 py-3 text-[11px] uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
                title="Skip camera and generate a plausible score"
              >
                No camera? Demo mode
              </button>
            </div>
          </div>
        )}

        {phase === "loading-models" && (
          <Overlay label="Loading neural-net models…" />
        )}

        {phase === "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 text-center">
            <p className="label-xs text-white/70">Ready to scan</p>
            <p className="max-w-sm px-6 text-sm text-white/80">
              Look straight at the camera. Blink once to confirm liveness.
            </p>
            <button
              onClick={beginScan}
              className="rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30"
            >
              Begin Scan
            </button>
          </div>
        )}

        {phase === "computing" && (
          <Overlay label="Computing EdgeScore…" />
        )}

        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-black/80 px-6 py-8 text-center">
            <p className="label-xs text-rose-300">Error</p>
            <p className="max-w-lg whitespace-pre-line text-sm leading-relaxed text-white/80">
              {error}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={start}
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-white/10"
              >
                Retry
              </button>
              <button
                onClick={takeDemoPath}
                className="rounded-lg border border-mog-violet/40 bg-mog-violet/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-mog-violet transition hover:border-mog-violet hover:bg-mog-violet/20 hover:text-white"
              >
                Skip & use Demo mode →
              </button>
            </div>
          </div>
        )}
      </div>

      {(phase === "scanning" || phase === "liveness") && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/50">
            <span>Scanning</span>
            <span>
              {Math.round(progress * 100)}% · Blinks {blinks}/1
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-mog-violet transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          {liveScore && <LiveMetrics s={liveScore} />}
        </div>
      )}
    </div>
  );
}

function Overlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
      <div className="flex gap-1.5">
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
      <p className="label-xs">{label}</p>
    </div>
  );
}

function LiveMetrics({ s }: { s: EdgeScoreBreakdown }) {
  const rows: [string, string][] = [
    ["Symmetry", pct(s.symmetry)],
    ["Jawline definition", pct(s.jawlineDefinition)],
    ["Canthal tilt", `${(s.canthalTilt * 12).toFixed(1)}°`],
    ["Cheekbone prom.", pct(s.cheekboneProm)],
    ["Golden ratio", pct(s.goldenRatio)]
  ];
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 pt-3 text-[11px] uppercase tracking-[0.18em] text-white/60 sm:grid-cols-3">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-2">
          <span>{k}</span>
          <span className="font-mono text-white/90">{v}</span>
        </div>
      ))}
    </div>
  );
}

function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}

function averageSamples(samples: EdgeScoreBreakdown[]): EdgeScoreBreakdown {
  const n = samples.length || 1;
  const sum = samples.reduce(
    (acc, s) => ({
      symmetry: acc.symmetry + s.symmetry,
      jawlineDefinition: acc.jawlineDefinition + s.jawlineDefinition,
      canthalTilt: acc.canthalTilt + s.canthalTilt,
      cheekboneProm: acc.cheekboneProm + s.cheekboneProm,
      goldenRatio: acc.goldenRatio + s.goldenRatio,
      composite: acc.composite + s.composite
    }),
    {
      symmetry: 0,
      jawlineDefinition: 0,
      canthalTilt: 0,
      cheekboneProm: 0,
      goldenRatio: 0,
      composite: 0
    }
  );
  return {
    symmetry: sum.symmetry / n,
    jawlineDefinition: sum.jawlineDefinition / n,
    canthalTilt: sum.canthalTilt / n,
    cheekboneProm: sum.cheekboneProm / n,
    goldenRatio: sum.goldenRatio / n,
    composite: sum.composite / n
  };
}
