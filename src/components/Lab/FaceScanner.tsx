"use client";

import { useEffect, useRef, useState } from "react";
import {
  computeEdgeScore,
  estimatePose,
  eyeAspectRatio,
  getEyePoints,
  trimmedMean,
  type FacePose,
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

const TARGET_SAMPLES = 50;

// ─── AR overlay helpers ──────────────────────────────────────────────────

const COLOR = {
  trackedGood: "rgba(74, 222, 128, 0.9)",   // green-400
  trackedBad: "rgba(245, 158, 11, 0.7)",    // amber-500
  cyan: "#22d3ee",
  magenta: "#d946ef",
  amber: "#f59e0b"
};

function drawAROverlay(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  box: { x: number; y: number; width: number; height: number },
  avg: EdgeScoreBreakdown,
  W: number,
  H: number,
  pose: FacePose
) {
  // Mirror x so coords match the visible (CSS-mirrored) video.
  const mx = (p: Pt) => ({ x: W - p.x, y: p.y });
  const mb = {
    x: W - box.x - box.width,
    y: box.y,
    w: box.width,
    h: box.height
  };

  // Tracked landmarks: bright green dots on every point, with a glow so
  // they're clearly visible after object-cover scales the canvas to fit
  // the display container (especially on phone screens).
  ctx.save();
  ctx.fillStyle = pose.goodForScoring ? "#4ade80" : "#f59e0b";
  ctx.shadowColor = pose.goodForScoring ? "#4ade80" : "#f59e0b";
  ctx.shadowBlur = 6;
  for (const p of points) {
    const { x, y } = mx(p);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Anchor positions (face landmarks the labels point to).
  const aSymmetry = mx(points[27]);
  const aTilt = mx(points[45]);
  const aJawline = mx(points[8]);
  const aCheek = mx(points[2]);
  const aRatio = mx({
    x: (points[19].x + points[24].x) / 2,
    y: (points[19].y + points[24].y) / 2
  });

  // Label positions, clamped to canvas. Layout:
  //   top-center            → SYMMETRY
  //   right of face, upper  → TILT
  //   right of face, mid    → GOLDEN RATIO
  //   left of face, mid     → CHEEKBONES
  //   left of face, lower   → JAWLINE
  //   bottom-center, big    → EDGESCORE composite
  const padX = 70;
  const labels: Array<{
    anchor: Pt;
    pos: Pt;
    title: string;
    value: string;
    color: string;
    big?: boolean;
  }> = [
    {
      anchor: aSymmetry,
      pos: { x: mb.x + mb.w / 2, y: Math.max(28, mb.y - 28) },
      title: "SYMMETRY",
      value: pctStr(avg.symmetry),
      color: COLOR.cyan
    },
    {
      anchor: aTilt,
      pos: {
        x: Math.min(W - 50, mb.x + mb.w + padX),
        y: mb.y + mb.h * 0.22
      },
      title: "TILT",
      value: degStr(avg.canthalTilt),
      color: COLOR.cyan
    },
    {
      anchor: aRatio,
      pos: {
        x: Math.min(W - 50, mb.x + mb.w + padX),
        y: mb.y + mb.h * 0.55
      },
      title: "GOLDEN RATIO",
      value: pctStr(avg.goldenRatio),
      color: COLOR.cyan
    },
    {
      anchor: aCheek,
      pos: { x: Math.max(50, mb.x - padX), y: mb.y + mb.h * 0.45 },
      title: "CHEEKBONES",
      value: pctStr(avg.cheekboneProm),
      color: COLOR.cyan
    },
    {
      anchor: aJawline,
      pos: { x: Math.max(50, mb.x - padX), y: mb.y + mb.h * 0.85 },
      title: "JAWLINE",
      value: pctStr(avg.jawlineDefinition),
      color: COLOR.cyan
    },
    {
      anchor: { x: mb.x + mb.w / 2, y: mb.y + mb.h - 4 },
      pos: { x: mb.x + mb.w / 2, y: Math.min(H - 26, mb.y + mb.h + 38) },
      title: "EDGESCORE",
      value: Math.round(avg.composite).toString(),
      color: COLOR.magenta,
      big: true
    }
  ];

  for (const l of labels) {
    drawAnchorAndLabel(ctx, l.anchor, l.pos, l.title, l.value, l.color, !!l.big);
  }

  // Pose hint when frame is too off-axis to be sampled.
  if (!pose.goodForScoring) {
    ctx.font = "bold 12px ui-monospace, monospace";
    ctx.fillStyle = COLOR.amber;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("LOOK STRAIGHT AT THE CAMERA", W / 2, 12);
  }
}

function drawAnchorAndLabel(
  ctx: CanvasRenderingContext2D,
  anchor: Pt,
  labelPos: Pt,
  title: string,
  value: string,
  color: string,
  big: boolean
) {
  // Connector line (faint)
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.lineTo(labelPos.x, labelPos.y);
  ctx.stroke();
  ctx.restore();

  // Anchor dot with glow
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, big ? 4 : 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sizing
  const titleFont = big
    ? "bold 10px ui-monospace, monospace"
    : "bold 9px ui-monospace, monospace";
  const valueFont = big
    ? "bold 24px ui-monospace, monospace"
    : "bold 14px ui-monospace, monospace";
  ctx.font = titleFont;
  const tw = ctx.measureText(title).width;
  ctx.font = valueFont;
  const vw = ctx.measureText(value).width;
  const w = Math.max(tw, vw) + (big ? 22 : 16);
  const h = big ? 48 : 34;
  const x = labelPos.x - w / 2;
  const y = labelPos.y - h / 2;

  // Label background
  ctx.save();
  roundRect(ctx, x, y, w, h, big ? 8 : 6);
  ctx.fillStyle = "rgba(7, 5, 18, 0.85)";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Title text
  ctx.font = titleFont;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, labelPos.x, labelPos.y - (big ? 13 : 8));

  // Value text
  ctx.font = valueFont;
  ctx.fillStyle = color;
  ctx.fillText(value, labelPos.x, labelPos.y + (big ? 9 : 8));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function pctStr(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function degStr(canthalTiltNorm: number): string {
  const v = canthalTiltNorm * 12;
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}°`;
}

function trimmedAverage(samples: EdgeScoreBreakdown[]): EdgeScoreBreakdown {
  if (samples.length === 0)
    return {
      symmetry: 0,
      jawlineDefinition: 0,
      canthalTilt: 0,
      cheekboneProm: 0,
      goldenRatio: 0,
      composite: 0
    };
  const trim = (key: keyof EdgeScoreBreakdown) =>
    trimmedMean(
      samples.map((s) => s[key] as number),
      0.15
    );
  return {
    symmetry: trim("symmetry"),
    jawlineDefinition: trim("jawlineDefinition"),
    canthalTilt: trim("canthalTilt"),
    cheekboneProm: trim("cheekboneProm"),
    goldenRatio: trim("goldenRatio"),
    composite: trim("composite")
  };
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
  const samplesRef = useRef<EdgeScoreBreakdown[]>([]);
  const totalSamplesRef = useRef(0);
  const scanStartRef = useRef(0);

  // Liveness state: adaptive thresholds derived from a baseline observed
  // during the first ~0.5s of the scan. Different faces have different
  // resting-EAR — a fixed threshold misses blinks for many users.
  const earBaselineSamplesRef = useRef<number[]>([]);
  const earBaselineRef = useRef<number | null>(null);
  const earBelowFramesRef = useRef(0);
  const earWasLowRef = useRef(false);
  const lastEarRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0..1
  const [liveScore, setLiveScore] = useState<EdgeScoreBreakdown | null>(null);
  const [blinks, setBlinks] = useState(0);
  const [liveEar, setLiveEar] = useState(0);
  const [skippedLiveness, setSkippedLiveness] = useState(false);

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
    earBelowFramesRef.current = 0;
    earBaselineSamplesRef.current = [];
    earBaselineRef.current = null;
    samplesRef.current = [];
    totalSamplesRef.current = 0;
    scanStartRef.current = performance.now();
    setBlinks(0);
    setLiveEar(0);
    setSkippedLiveness(false);
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
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 })
      )
      .withFaceLandmarks();

    if (detection) {
      const box = detection.detection.box;
      const points: Pt[] = detection.landmarks.positions.map((p) => ({
        x: p.x,
        y: p.y
      }));
      const pose = estimatePose(points);

      // Only contribute samples when the pose is roughly frontal — a
      // tilted/turned head warps every metric. The AR overlay still
      // renders so the user sees the dots; we just don't trust those
      // frames for scoring.
      if (pose.goodForScoring) {
        const sample = computeEdgeScore(points);
        samplesRef.current.push(sample);
        totalSamplesRef.current += 1;
        if (samplesRef.current.length > TARGET_SAMPLES)
          samplesRef.current.shift();
      }

      // Rolling trimmed-mean for the live HUD. Falls back to the current
      // frame's score until we have any samples (fade-in).
      const avg =
        samplesRef.current.length > 0
          ? trimmedAverage(samplesRef.current)
          : computeEdgeScore(points);
      setLiveScore(avg);

      // AR overlay — green dots on every landmark, cyan anchor points,
      // floating labels with live values per metric.
      drawAROverlay(ctx, points, box, avg, W, H, pose);

      // ─── Liveness with adaptive thresholds ─────────────────────────
      const eyes = getEyePoints(points);
      const ear =
        (eyeAspectRatio(eyes.left) + eyeAspectRatio(eyes.right)) / 2;
      lastEarRef.current = ear;
      setLiveEar(ear);

      if (earBaselineRef.current === null) {
        earBaselineSamplesRef.current.push(ear);
        if (earBaselineSamplesRef.current.length >= 12) {
          const sorted = [...earBaselineSamplesRef.current].sort();
          earBaselineRef.current = sorted[Math.floor(sorted.length / 2)];
        }
      } else {
        const baseline = earBaselineRef.current;
        const closedThresh = baseline * 0.65;
        const openThresh = baseline * 0.85;
        if (ear < closedThresh) {
          earBelowFramesRef.current += 1;
          if (earBelowFramesRef.current >= 2 && !earWasLowRef.current) {
            earWasLowRef.current = true;
          }
        } else {
          earBelowFramesRef.current = 0;
          if (ear > openThresh && earWasLowRef.current) {
            earWasLowRef.current = false;
            blinksRef.current += 1;
            setBlinks(blinksRef.current);
          }
        }
      }

      // Progress + completion
      const elapsed = performance.now() - scanStartRef.current;
      const sampleProgress = Math.min(1, totalSamplesRef.current / TARGET_SAMPLES);
      const timeProgress = Math.min(1, elapsed / 5500);
      setProgress(Math.max(sampleProgress, timeProgress));

      const enoughSamples = totalSamplesRef.current >= TARGET_SAMPLES;
      const blinkOk = blinksRef.current >= 1;
      const livenessTimeout = elapsed > 8000;

      if (enoughSamples && blinkOk) {
        finalize(avg, false);
        return;
      }
      if (enoughSamples && livenessTimeout) {
        setSkippedLiveness(true);
        finalize(avg, true);
        return;
      }
    } else {
      ctx.font = "bold 14px ui-monospace, monospace";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("LOOKING FOR FACE…", W / 2, H / 2);
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  function finalize(avg: EdgeScoreBreakdown, _skippedLiveness: boolean) {
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
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
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
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/50">
            <span>Scanning</span>
            <span>
              {Math.round(progress * 100)}% · Blinks {blinks}/1 · EAR{" "}
              <span className="font-mono text-white/80">
                {liveEar.toFixed(2)}
              </span>
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-mog-violet transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          {progress >= 0.99 && blinks === 0 && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-white/60">
              <span>Trouble detecting blinks?</span>
              <button
                onClick={() => liveScore && finalize(liveScore, true)}
                className="rounded-md border border-mog-violet/40 bg-mog-violet/10 px-3 py-1.5 text-mog-violet transition hover:border-mog-violet hover:bg-mog-violet/20 hover:text-white"
              >
                Skip liveness →
              </button>
            </div>
          )}
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

