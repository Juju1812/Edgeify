"use client";

import { useEffect, useRef, useState } from "react";
import {
  computeEdgeScore,
  consensusLandmarks,
  estimatePose,
  eyeAspectRatio,
  getEyePoints,
  trimmedMean,
  type FacePose,
  type Pt
} from "@/lib/edge-score";
import { playSfx } from "@/lib/audio";
import { useUser } from "@/lib/user-context";
import type { ArColorId, EdgeScoreBreakdown } from "@/lib/types";

const AR_COLOR_HEX_LAB: Record<ArColorId, string> = {
  green: "#4ade80",
  cyan: "#22d3ee",
  pink: "#d946ef",
  gold: "#fde047",
  violet: "#a855f7"
};

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
  const faceFat = 0.2 + rand() * 0.5;
  const composite =
    100 *
    (0.26 * symmetry +
      0.22 * jawlineDefinition +
      0.12 * (1 - Math.abs(canthalTilt - 0.4)) +
      0.13 * cheekboneProm +
      0.12 * goldenRatio +
      0.15 * (1 - faceFat));
  return {
    symmetry,
    jawlineDefinition,
    canthalTilt,
    cheekboneProm,
    goldenRatio,
    faceFat,
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

/**
 * Standard 68-point face contour groupings — each tuple is
 * [startIdx, endIdx, isClosedLoop]. Drawing these as polylines gives
 * the silhouette of the jaw, brows, eyes, nose, and mouth.
 */
const FACE_CONTOURS: [number, number, boolean][] = [
  [0, 16, false],   // jawline
  [17, 21, false],  // right eyebrow
  [22, 26, false],  // left eyebrow
  [27, 30, false],  // nose bridge
  [31, 35, false],  // nose bottom
  [36, 41, true],   // right eye
  [42, 47, true],   // left eye
  [48, 59, true],   // outer lips
  [60, 67, true]    // inner lips
];

/**
 * Cross-connections that turn the contour outline into a more
 * wireframe-mesh look. Each pair of point indices gets connected by a
 * thin faint line.
 */
const FACE_MESH_LINKS: [number, number][] = [
  // Frame the face: jaw to brows
  [0, 17], [16, 26],
  // Brows to eye corners
  [17, 36], [21, 39], [22, 42], [26, 45],
  // Bridge across the brows
  [21, 22],
  // Eye corners to nose bridge
  [39, 27], [42, 27],
  // Nose tip to mouth
  [33, 48], [33, 54], [33, 51],
  // Lower lip to chin
  [57, 8],
  // Mouth corners to jawline
  [48, 4], [54, 12],
  // Eyes to cheekbones
  [40, 1], [47, 15]
];

function drawAROverlay(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  box: { x: number; y: number; width: number; height: number },
  avg: EdgeScoreBreakdown,
  W: number,
  H: number,
  pose: FacePose,
  arColorHex: string = "#4ade80"
) {
  // Mirror x so coords match the visible (CSS-mirrored) video.
  const mx = (p: Pt) => ({ x: W - p.x, y: p.y });
  const mb = {
    x: W - box.x - box.width,
    y: box.y,
    w: box.width,
    h: box.height
  };

  // ── Face mesh: contour outlines + cross-connections ──────────────
  // Drawn first so the dots paint on top.
  const m = arColorHex.match(/^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
  const rgbStr = m
    ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`
    : "74, 222, 128";

  ctx.save();
  ctx.strokeStyle = `rgba(${rgbStr}, 0.55)`;
  ctx.shadowColor = `rgba(${rgbStr}, 0.55)`;
  ctx.shadowBlur = 4;
  ctx.lineWidth = 1.1;

  for (const [start, end, closed] of FACE_CONTOURS) {
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

  // Cross-links — fainter, give it the wireframe-mesh feel.
  ctx.strokeStyle = `rgba(${rgbStr}, 0.28)`;
  ctx.lineWidth = 0.9;
  for (const [a, b] of FACE_MESH_LINKS) {
    const pa = mx(points[a]);
    const pb = mx(points[b]);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.restore();

  // ── Tracked landmarks: chosen color dots with glow on every point. ──
  ctx.save();
  ctx.fillStyle = arColorHex;
  ctx.shadowColor = arColorHex;
  ctx.shadowBlur = 8;
  for (const p of points) {
    const { x, y } = mx(p);
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
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
      // Anchor on lower cheek (point 5 — between gonial and chin)
      anchor: mx(points[5]),
      pos: {
        x: Math.min(W - 50, mb.x + mb.w + padX),
        y: mb.y + mb.h * 0.88
      },
      title: "FACE FAT",
      value: pctStr(avg.faceFat),
      color: avg.faceFat > 0.5 ? "#f59e0b" : COLOR.cyan
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
      faceFat: 0,
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
    faceFat: trim("faceFat"),
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
  const { user } = useUser();
  const arColorHex = AR_COLOR_HEX_LAB[user.arColor] || "#4ade80";
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const captureRef = useRef<HTMLCanvasElement>(null);
  const faceApiRef = useRef<FaceApiNS | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const blinksRef = useRef(0);
  const samplesRef = useRef<EdgeScoreBreakdown[]>([]);
  // Accumulated raw landmarks from every good-pose frame. The final
  // saved score is computed from a trimmed-mean consensus of these
  // — much more stable than averaging per-frame metric values.
  const landmarkAccumRef = useRef<Pt[][]>([]);
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

  // Best-take pfp — capture the frame with the highest detector confidence
  // among good-pose frames. Replaces the previous "last frame" approach.
  const bestTakeUrlRef = useRef<string | null>(null);
  const bestTakeScoreRef = useRef<number>(0);

  // Head-turn liveness — track observed yaw + pitch range during the scan.
  // We pick a random "challenge direction" (left/right/up/down) at the
  // start of each scan and require the user to actually rotate their
  // head in that axis. Photos and looped videos can't fake this.
  const yawMinRef = useRef(Number.POSITIVE_INFINITY);
  const yawMaxRef = useRef(Number.NEGATIVE_INFINITY);
  const pitchMinRef = useRef(Number.POSITIVE_INFINITY);
  const pitchMaxRef = useRef(Number.NEGATIVE_INFINITY);
  const challengeRef = useRef<"horizontal" | "vertical">("horizontal");
  const [challengePrompt, setChallengePrompt] = useState<string>("Turn your head left & right");

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
    playSfx("scanStart");
    setPhase("scanning");
    setProgress(0);
    blinksRef.current = 0;
    earWasLowRef.current = false;
    earBelowFramesRef.current = 0;
    earBaselineSamplesRef.current = [];
    earBaselineRef.current = null;
    yawMinRef.current = Number.POSITIVE_INFINITY;
    yawMaxRef.current = Number.NEGATIVE_INFINITY;
    pitchMinRef.current = Number.POSITIVE_INFINITY;
    pitchMaxRef.current = Number.NEGATIVE_INFINITY;
    // Pick a random challenge axis for this scan
    const axis: "horizontal" | "vertical" =
      Math.random() < 0.5 ? "horizontal" : "vertical";
    challengeRef.current = axis;
    setChallengePrompt(
      axis === "horizontal"
        ? "Turn your head left & right ↔"
        : "Look up & down ↕"
    );
    samplesRef.current = [];
    landmarkAccumRef.current = [];
    bestTakeUrlRef.current = null;
    bestTakeScoreRef.current = 0;
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

    // Higher inputSize gives noticeably more precise landmarks, at
    // ~2x the per-frame cost. 416 is a good sweet spot for accuracy
    // without dropping below ~15 fps on most laptops/phones.
    // Use detectAllFaces so we can REJECT frames with more than one face
    // visible (anti-cheat / confusion). Then proceed with the highest-
    // confidence detection's landmarks.
    const allFaces = await faceapi
      .detectAllFaces(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.55 })
      )
      .withFaceLandmarks();
    const detection =
      allFaces.length === 1
        ? allFaces[0]
        : null; // multi-face → treat as no face, surface a hint below

    // ALL canvas drawing happens AFTER the await in a single synchronous
    // burst. Doing drawing before the await caused React's reconciliation
    // (triggered by state updates from this frame) to wipe the buffer
    // mid-frame, which is why earlier debug rectangles drawn before the
    // await persisted but anything drawn after did not.
    ctx.clearRect(0, 0, W, H);

    if (detection) {
      const box = detection.detection.box;
      const points: Pt[] = detection.landmarks.positions.map((p) => ({
        x: p.x,
        y: p.y
      }));
      const pose = estimatePose(points);

      // Only contribute frames where (a) the pose is roughly frontal
      // and (b) the detector is confident enough. Tilted/turned heads
      // warp every metric, and low-confidence detections often have
      // wildly off-by-30px landmarks. The AR overlay still renders so
      // the user sees the dots; we just don't trust those frames for
      // the saved score.
      const detScore = detection.detection.score;
      if (pose.goodForScoring && detScore >= 0.6) {
        landmarkAccumRef.current.push(points);
        totalSamplesRef.current += 1;
        // Best-take pfp: keep the frame with the highest confidence among
        // good-pose frames. We snapshot the video into a 200x150 jpeg
        // immediately rather than referencing the live video element.
        if (detScore > bestTakeScoreRef.current) {
          try {
            const cap = captureRef.current;
            const vid = videoRef.current;
            if (cap && vid) {
              cap.width = 200;
              cap.height = 150;
              const cctx = cap.getContext("2d");
              if (cctx) {
                cctx.drawImage(vid, 0, 0, cap.width, cap.height);
                bestTakeUrlRef.current = cap.toDataURL("image/jpeg", 0.7);
                bestTakeScoreRef.current = detScore;
              }
            }
          } catch {
            /* */
          }
        }
      }

      // Live HUD score: compute on a running consensus of accumulated
      // landmarks (much more stable than per-frame raw scores), or fall
      // back to the current-frame score until we have any consensus
      // data. This is what the AR labels animate against during scan.
      const accum = landmarkAccumRef.current;
      const avg =
        accum.length >= 5
          ? computeEdgeScore(consensusLandmarks(accum))
          : computeEdgeScore(points);
      setLiveScore(avg);

      // AR overlay — green dots on every landmark, cyan anchor points,
      // floating labels with live values per metric.
      drawAROverlay(ctx, points, box, avg, W, H, pose, arColorHex);

      // ─── Liveness via random-axis head movement ────────────────────
      // We picked a random challenge axis at scan start; require the
      // user to actually demonstrate movement in THAT axis. Defeats
      // looped videos / photos / single-axis recordings.
      yawMinRef.current = Math.min(yawMinRef.current, pose.yaw);
      yawMaxRef.current = Math.max(yawMaxRef.current, pose.yaw);
      pitchMinRef.current = Math.min(pitchMinRef.current, pose.pitch);
      pitchMaxRef.current = Math.max(pitchMaxRef.current, pose.pitch);
      const yawRange = yawMaxRef.current - yawMinRef.current;
      const pitchRange = pitchMaxRef.current - pitchMinRef.current;
      const challengeMet =
        challengeRef.current === "horizontal"
          ? yawRange >= 0.30
          : pitchRange >= 0.25;
      if (challengeMet && !blinksRef.current) {
        blinksRef.current = 1;
        setBlinks(1);
      }
      // Still update EAR for HUD display, but don't gate on it.
      const eyes = getEyePoints(points);
      const ear =
        (eyeAspectRatio(eyes.left) + eyeAspectRatio(eyes.right)) / 2;
      lastEarRef.current = ear;
      setLiveEar(ear);

      // Progress + completion
      const elapsed = performance.now() - scanStartRef.current;
      const sampleProgress = Math.min(1, totalSamplesRef.current / TARGET_SAMPLES);
      const timeProgress = Math.min(1, elapsed / 5500);
      setProgress(Math.max(sampleProgress, timeProgress));

      const enoughSamples = totalSamplesRef.current >= TARGET_SAMPLES;
      const someSamples = totalSamplesRef.current >= 10;
      const blinkOk = blinksRef.current >= 1;

      // Layered completion gates so the scan always finalizes:
      //   1. Ideal: 50+ samples AND a registered blink → top quality.
      //   2. After 6s with 50+ samples → skip liveness, accept.
      //   3. After 10s with 10+ samples → accept partial scan.
      //   4. After 13s regardless → emergency exit; uses whatever
      //      score the loop has converged on (or current-frame score).
      if (enoughSamples && blinkOk) {
        finalize(avg, false);
        return;
      }
      if (enoughSamples && elapsed > 6000) {
        setSkippedLiveness(true);
        finalize(avg, true);
        return;
      }
      if (someSamples && elapsed > 10000) {
        setSkippedLiveness(true);
        finalize(avg, true);
        return;
      }
      if (elapsed > 13000) {
        setSkippedLiveness(true);
        finalize(avg, true);
        return;
      }
    } else {
      ctx.font = "bold 14px ui-monospace, monospace";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const msg =
        allFaces.length > 1
          ? `${allFaces.length} FACES — ONLY ONE PLAYER ALLOWED`
          : "LOOKING FOR FACE…";
      ctx.fillStyle =
        allFaces.length > 1 ? "rgba(245, 158, 11, 0.9)" : "rgba(255,255,255,0.55)";
      ctx.fillText(msg, W / 2, H / 2);
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  function finalize(avg: EdgeScoreBreakdown, _skippedLiveness: boolean) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    playSfx("matchStart");
    setPhase("computing");

    // The saved score uses the FULL accumulated landmark set, scored
    // once on its trimmed-mean consensus. This is much more stable
    // than the running display score (which only uses the most recent
    // frames). If we somehow have no accumulated frames, fall back to
    // whatever the live HUD converged on.
    const accum = landmarkAccumRef.current;
    const finalScore =
      accum.length >= 5 ? computeEdgeScore(consensusLandmarks(accum)) : avg;

    // Use the BEST-TAKE captured during the scan if we have one (the
    // frame with the highest detector confidence among good-pose
    // frames). Falls back to a fresh snapshot of the current frame.
    let faceDataUrl: string;
    if (bestTakeUrlRef.current) {
      faceDataUrl = bestTakeUrlRef.current;
    } else {
      const video = videoRef.current!;
      const cap = captureRef.current!;
      cap.width = 200;
      cap.height = 150;
      const cctx = cap.getContext("2d")!;
      cctx.drawImage(video, 0, 0, cap.width, cap.height);
      faceDataUrl = cap.toDataURL("image/jpeg", 0.7);
    }

    // Brief dramatic pause so the "computing" UI registers.
    setTimeout(() => {
      stopCamera();
      setPhase("done");
      onComplete({ score: finalScore, faceDataUrl });
    }, 900);
  }

  // ─── UI ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="glass relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
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
          style={{ zIndex: 50 }}
          className="pointer-events-none absolute inset-0 h-full w-full"
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
              {Math.round(progress * 100)}% · Liveness {blinks ? "✓" : "—"}
              <span className="ml-2 font-mono text-white/40">EAR {liveEar.toFixed(2)}</span>
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-mog-violet transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          {progress >= 0.4 && blinks === 0 && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-white/60">
              <span>{challengePrompt}</span>
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

