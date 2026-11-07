"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { averageRatios, measureFrame, type Ratios } from "@/lib/shared/ratios";

export type CameraState = "idle" | "starting" | "live" | "denied" | "unavailable";

/**
 * Webcam hook. Attach `videoRef` to a <video>. Audio is optional (matches
 * use it for voice; scans don't).
 */
export function useCamera(opts: { audio?: boolean } = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);

  const start = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return null;
    }
    setState("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: opts.audio ? { echoCancellation: true, noiseSuppression: true } : false
      });
      streamRef.current = s;
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
      setState("live");
      return s;
    } catch (e) {
      const name = (e as DOMException)?.name;
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      return null;
    }
  }, [opts.audio]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setState("idle");
  }, []);

  // Re-attach if the <video> remounts.
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  });

  useEffect(() => stop, [stop]);

  return { videoRef, state, stream, start, stop };
}

/** Grab the current video frame as a JPEG data URL, longest side `max` px. */
export function grabFrame(video: HTMLVideoElement, max = 768, quality = 0.85): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  // Un-mirror: the preview is mirrored for the user, the score sees the real image.
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}

/** Full frame, mirrored like the preview — the backdrop for the result overlay. */
export function grabMirroredFrame(video: HTMLVideoElement, max = 900): { url: string; width: number; height: number } | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return { url: c.toDataURL("image/jpeg", 0.88), width: c.width, height: c.height };
}

/** Square, centred thumbnail for the public avatar. */
export function grabThumb(video: HTMLVideoElement, size = 320): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const side = Math.min(w, h) * 0.8;
  const sx = (w - side) / 2;
  const sy = Math.max(0, (h - side) / 2 - side * 0.05);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  // Mirror so the avatar matches what people saw of themselves.
  ctx.translate(size, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.82);
}

/**
 * A square crop around the face at full camera resolution — the AI sees far
 * more detail than in a shrunken whole frame, where the face may only be a
 * couple of hundred pixels wide. `pts` are mirrored normalized landmarks
 * (as produced by useFaceTracker). Falls back to the whole frame.
 */
export function grabFaceCrop(video: HTMLVideoElement, pts: { x: number; y: number }[] | null, out = 768): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  if (!pts || pts.length < 100) return grabFrame(video, 1024, 0.9);

  // Landmarks are mirrored for the preview; flip back to raw camera coords.
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const p of pts) {
    const x = 1 - p.x;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const fw = (maxX - minX) * w;
  const fh = (maxY - minY) * h;
  // Generous margin so hair, ears and jaw/neck are in frame.
  const side = Math.min(Math.max(fw, fh) * 1.85, Math.min(w, h));
  const cx = ((minX + maxX) / 2) * w;
  const cy = ((minY + maxY) / 2) * h - fh * 0.08;
  const sx = Math.max(0, Math.min(w - side, cx - side / 2));
  const sy = Math.max(0, Math.min(h - side, cy - side / 2));

  const size = Math.min(out, Math.round(side)); // never upscale
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.9);
}

/**
 * Capture `n` face crops spaced `gapMs` apart, using the live landmarks, and
 * measure the facial ratios on each frame (median across near-frontal ones).
 */
export async function captureFaceBurst(
  video: HTMLVideoElement,
  getPoints: () => { x: number; y: number }[] | null,
  n = 5,
  gapMs = 280
): Promise<{ frames: string[]; ratios: Ratios | null }> {
  const frames: string[] = [];
  const measured: { ratios: Ratios; yaw: number }[] = [];
  for (let i = 0; i < n; i++) {
    const pts = getPoints();
    const f = grabFaceCrop(video, pts);
    if (f) frames.push(f);
    if (pts && video.videoWidth) {
      // Landmarks are normalized; measure in true pixel proportions.
      const m = measureFrame(pts.map((p) => ({ x: p.x * video.videoWidth, y: p.y * video.videoHeight })));
      if (m) measured.push(m);
    }
    if (i < n - 1) await new Promise((r) => setTimeout(r, gapMs));
  }
  return { frames, ratios: averageRatios(measured)?.ratios ?? null };
}

/** Capture `n` frames spaced `gapMs` apart. */
export async function captureBurst(video: HTMLVideoElement, n = 3, gapMs = 450): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const f = grabFrame(video);
    if (f) out.push(f);
    if (i < n - 1) await new Promise((r) => setTimeout(r, gapMs));
  }
  return out;
}
