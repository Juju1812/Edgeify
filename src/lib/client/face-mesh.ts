"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * In-browser face landmarks (MediaPipe Face Landmarker, 478 points). Used
 * only for the visual dot overlay and a "face in frame" check — scoring is
 * still done server-side by the AI. Assets load lazily from CDNs.
 */
const VERSION = "0.10.35";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export type Pt = { x: number; y: number };

let loading: Promise<FaceLandmarker | null> | null = null;

export function loadFaceLandmarker(): Promise<FaceLandmarker | null> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      const make = (delegate: "GPU" | "CPU") =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL, delegate },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
      try {
        return await make("GPU");
      } catch {
        return await make("CPU");
      }
    } catch (e) {
      console.warn("Face tracker unavailable", e);
      return null;
    }
  })();
  return loading;
}

/**
 * Track the face in a <video>. `landmarks.current` holds the latest points
 * in normalized coords, already mirrored to match a mirrored preview.
 */
export function useFaceTracker(videoRef: React.RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const landmarks = useRef<Pt[] | null>(null);
  const [faceFound, setFaceFound] = useState(false);
  const [ready, setReady] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let stopped = false;
    let lastTs = -1;
    let lastFound = false;

    loadFaceLandmarker().then((lm) => {
      if (stopped) return;
      if (!lm) {
        setReady("unavailable");
        return;
      }
      setReady("ready");
      const tick = () => {
        if (stopped) return;
        const v = videoRef.current;
        if (v && v.readyState >= 2 && v.videoWidth) {
          const ts = performance.now();
          if (ts > lastTs) {
            lastTs = ts;
            try {
              const res = lm.detectForVideo(v, ts);
              const face: NormalizedLandmark[] | undefined = res.faceLandmarks[0];
              landmarks.current = face ? face.map((p) => ({ x: 1 - p.x, y: p.y })) : null;
              const found = !!face;
              if (found !== lastFound) {
                lastFound = found;
                setFaceFound(found);
              }
            } catch {
              /* transient GPU hiccup — try next frame */
            }
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [enabled, videoRef]);

  return { landmarks, faceFound, ready };
}

// ─── Which mesh points to draw ───────────────────────────────────────────
// A curated ~70-point subset of the 478-point mesh: face outline, brows,
// eyes, nose and lips. Dense enough to read as a scan, sparse enough to
// stay elegant.
export const DOT_INDICES = [
  // face oval (every other point)
  10, 297, 284, 389, 454, 361, 397, 379, 400, 152, 176, 150, 172, 132, 234, 162, 54, 67,
  // brows
  70, 105, 107, 66, 300, 334, 336, 296,
  // right eye (image left)
  33, 160, 158, 133, 153, 144,
  // left eye
  263, 387, 385, 362, 380, 373,
  // nose
  168, 6, 197, 4, 98, 327, 2,
  // lips
  61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91,
  // cheekbones / cheeks
  116, 345, 205, 425, 50, 280
];

/**
 * Anchor point and label side for each trait's callout, in the MIRRORED
 * (selfie) view: the subject's left side appears on the image's left.
 */
export const TRAIT_ANCHORS = {
  hair: { i: 109, side: "left" }, // upper forehead / hairline
  eyes: { i: 263, side: "left" }, // left eye outer corner
  structure: { i: 345, side: "left" }, // left cheekbone
  jaw: { i: 397, side: "left" }, // left jaw angle
  harmony: { i: 168, side: "right" }, // bridge of the nose
  skin: { i: 205, side: "right" }, // right cheek
  presentation: { i: 61, side: "right" } // mouth corner (grooming)
} as const;
