import type { EdgeScoreBreakdown } from "./types";

// face-api.js 68-point landmark indices (iBUG 300-W convention).
const IDX = {
  jawline: [...range(0, 17)],            // 0-16 along the jaw
  rightBrow: [...range(17, 22)],
  leftBrow: [...range(22, 27)],
  noseBridge: [...range(27, 31)],
  noseBottom: [...range(31, 36)],
  rightEye: [...range(36, 42)],          // 36-41
  leftEye: [...range(42, 48)],           // 42-47
  outerLips: [...range(48, 60)],
  innerLips: [...range(60, 68)]
};

function range(a: number, b: number) {
  return Array.from({ length: b - a }, (_, i) => a + i);
}

export type Pt = { x: number; y: number };

function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function clampSigned(x: number) {
  return Math.max(-1, Math.min(1, x));
}

export type FacePose = {
  roll: number;            // radians, in-plane tilt (head tilted shoulder-to-shoulder)
  yaw: number;             // approx radians, head turned left/right
  pitch: number;           // approx radians, head tilted up/down
  goodForScoring: boolean; // pose is close enough to frontal to trust scoring
};

/**
 * Estimate head pose from 68 landmarks. Roll is exact (line through the
 * outer eye corners). Yaw and pitch are approximated from 2D ratios —
 * good enough to reject obviously off-axis frames; not metric-grade.
 */
export function estimatePose(points: Pt[]): FacePose {
  if (points.length !== 68) {
    return { roll: 0, yaw: 0, pitch: 0, goodForScoring: false };
  }

  // Roll: angle of the line from the right outer eye corner to the left
  // outer eye corner. (Y grows downward in image coordinates, hence atan2
  // returns a positive value when the user tilts to their left.)
  const rEye = points[36];
  const lEye = points[45];
  const roll = Math.atan2(lEye.y - rEye.y, lEye.x - rEye.x);

  // Yaw proxy: horizontal offset of the nose midline relative to the
  // midpoint between the outer face contour points (0 and 16). When the
  // head turns, the nose drifts toward whichever ear is rotating away.
  const faceMidX = (points[0].x + points[16].x) / 2;
  const noseMidX = (points[27].x + points[33].x) / 2;
  const faceWidth = dist(points[0], points[16]) || 1;
  const yawRatio = (noseMidX - faceMidX) / faceWidth;
  const yaw = yawRatio * (Math.PI / 3); // empirical scale

  // Pitch proxy: ratio of nose-base-to-chin vs nose-top-to-brow. When the
  // user looks down, the lower portion shortens; when they look up, the
  // upper portion shortens. Neutral ~ 1.0 for most adults.
  const browMid = midpoint(points[19], points[24]);
  const noseToChin = dist(points[33], points[8]);
  const noseToBrow = dist(points[27], browMid) || 1;
  const pitchRatio = noseToChin / noseToBrow;
  const pitch = (pitchRatio - 1.0) * 0.6;

  // Be permissive: a reasonably centered face should count as scoreable.
  // Symmetry/cheekbone metrics still benefit from frontalize() rotation
  // even when pose is mildly off, so we don't need a strict gate.
  const goodForScoring =
    Math.abs(roll) < 0.32 && // ~18°
    Math.abs(yaw) < 0.32 && // ~18°
    Math.abs(pitch) < 0.55;

  return { roll, yaw, pitch, goodForScoring };
}

/**
 * Rotate landmarks so the eye line is horizontal. Centers on the
 * midpoint between the outer eye corners. After this, "x reflection"
 * symmetry is meaningful even if the head was tilted in the original
 * frame.
 */
export function frontalize(points: Pt[]): Pt[] {
  if (points.length !== 68) return points;
  const pose = estimatePose(points);
  const center = midpoint(points[36], points[45]);
  const cos = Math.cos(-pose.roll);
  const sin = Math.sin(-pose.roll);
  return points.map((p) => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return {
      x: cos * dx - sin * dy + center.x,
      y: sin * dx + cos * dy + center.y
    };
  });
}

/**
 * Trimmed mean — discard the top and bottom `frac` of values and average
 * the rest. More robust than plain mean against face-detection outliers.
 */
export function trimmedMean(values: number[], frac = 0.15): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const drop = Math.floor(sorted.length * frac);
  const slice = sorted.slice(drop, sorted.length - drop);
  return slice.reduce((s, v) => s + v, 0) / Math.max(1, slice.length);
}

/**
 * Build a "consensus" 68-landmark face by trimmed-mean-averaging each
 * landmark coordinate across many observed frames. Vastly more stable
 * than per-frame metric computation: face-detector landmarks jitter
 * 1-2 px frame to frame, and metric formulas are nonlinear, so per-frame
 * scores have a lot of noise. Averaging landmarks first then scoring
 * the consensus removes that noise almost entirely.
 *
 * Frames must all be 68-point arrays. Drops top/bottom `frac` per axis.
 */
export function consensusLandmarks(frames: Pt[][], frac = 0.15): Pt[] {
  if (frames.length === 0) return [];
  const N = 68;
  const out: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const f of frames) {
      if (f && f.length === N) {
        xs.push(f[i].x);
        ys.push(f[i].y);
      }
    }
    out.push({ x: trimmedMean(xs, frac), y: trimmedMean(ys, frac) });
  }
  return out;
}

/**
 * Reflect a point across a vertical axis at xAxis.
 */
function reflectX(p: Pt, xAxis: number): Pt {
  return { x: 2 * xAxis - p.x, y: p.y };
}

/**
 * Compute the EdgeScore breakdown from 68-point landmarks.
 *
 * IMPORTANT: this is an entertainment metric. It measures a handful of
 * geometric properties — symmetry, jawline angularity, canthal tilt, etc.
 * It does not — and cannot — measure attractiveness.
 *
 * Computation runs on FRONTALIZED points (rotated so the eye line is
 * horizontal) so symmetry/cheekbone metrics aren't ruined by an in-plane
 * head tilt. Canthal tilt is the exception — it's the actual tilt and
 * therefore measured on the raw, un-rotated points.
 */
export function computeEdgeScore(rawPoints: Pt[]): EdgeScoreBreakdown {
  if (rawPoints.length !== 68) {
    return {
      symmetry: 0.5,
      jawlineDefinition: 0.5,
      canthalTilt: 0,
      cheekboneProm: 0.5,
      goldenRatio: 0.5,
      faceFat: 0.5,
      composite: 50
    };
  }

  const points = frontalize(rawPoints);

  // Reference axis for symmetry: mid of nose bridge.
  const noseTop = points[27];
  const noseBottom = points[33];
  const axisX = (noseTop.x + noseBottom.x) / 2;

  // Reference scale: inter-ocular distance (eye corner to eye corner).
  const rightEyeOuter = points[36];
  const leftEyeOuter = points[45];
  const interOcular = dist(rightEyeOuter, leftEyeOuter) || 1;

  // ─── Symmetry ──────────────────────────────────────────────────────────
  // Reflect right-side landmarks across the axis and compare against
  // the matching left-side landmarks. Lower mean error → higher symmetry.
  const symPairs: [number, number][] = [
    [0, 16], [1, 15], [2, 14], [3, 13], [4, 12], [5, 11], [6, 10], [7, 9],
    [17, 26], [18, 25], [19, 24], [20, 23], [21, 22],
    [31, 35], [32, 34],
    [36, 45], [39, 42], [37, 44], [38, 43], [40, 47], [41, 46],
    [48, 54], [49, 53], [50, 52], [60, 64], [61, 63], [67, 65]
  ];
  let symErrSum = 0;
  for (const [r, l] of symPairs) {
    const reflected = reflectX(points[r], axisX);
    symErrSum += dist(reflected, points[l]);
  }
  const symMean = symErrSum / symPairs.length / interOcular;
  // Map error 0..0.6 → 1..0
  const symmetry = clamp01(1 - symMean / 0.6);

  // ─── Jawline definition ───────────────────────────────────────────────
  // Sharper jaw = sharper angles at the jaw chain. Sum the curvature at
  // each interior jaw point.
  let jawCurvature = 0;
  for (let i = 1; i < 16; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const v1 = { x: cur.x - prev.x, y: cur.y - prev.y };
    const v2 = { x: next.x - cur.x, y: next.y - cur.y };
    const a1 = Math.atan2(v1.y, v1.x);
    const a2 = Math.atan2(v2.y, v2.x);
    let d = Math.abs(a1 - a2);
    if (d > Math.PI) d = 2 * Math.PI - d;
    jawCurvature += d;
  }
  // Typical empirical range ~1.2 (soft) .. 3.5 (sharp). Map 1.0..3.6 → 0..1.
  const jawlineDefinition = clamp01((jawCurvature - 1.0) / 2.6);

  // ─── Canthal tilt ─────────────────────────────────────────────────────
  // After frontalization the line through the outer eye corners is
  // perfectly horizontal, so any remaining vertical offset between the
  // outer and inner corners of one eye is pure canthal tilt — no head-
  // roll contamination. Average left and right eyes for stability.
  function eyeTiltDeg(outer: Pt, inner: Pt): number {
    const eyeWidth = Math.abs(inner.x - outer.x) || 1;
    const verticalOffset = inner.y - outer.y; // positive = outer above inner
    return Math.atan2(verticalOffset, eyeWidth) * (180 / Math.PI);
  }
  const tiltR = eyeTiltDeg(points[36], points[39]);
  const tiltL = eyeTiltDeg(points[45], points[42]);
  const angleDeg = (tiltR + tiltL) / 2;
  // Typical observed range -10..+15 deg. Normalize to -1..1.
  const canthalTilt = clampSigned(angleDeg / 12);

  // ─── Cheekbone prominence ─────────────────────────────────────────────
  // Width at cheekbone height (jaw points 1 and 15, the two below temples)
  // relative to width at jawline height (2 and 14). When cheekbones are
  // wider than mid-jaw, prominence is higher.
  const cheekW = dist(points[1], points[15]);
  const midJawW = dist(points[2], points[14]);
  const cheekRatio = cheekW / (midJawW || 1); // typically 1.0..1.15
  const cheekboneProm = clamp01((cheekRatio - 1.0) / 0.18);

  // ─── Face fat (facial fullness) ───────────────────────────────────────
  // Compares the three jaw widths (cheekbone, gonial angle, lower jaw)
  // along with the face height. A lean face has heavy taper — cheekbones
  // wide, gonial much narrower, lower jaw narrowest, face elongated.
  // A fuller face has nearly parallel sides and a shorter height.
  //
  // Two signals combined:
  //   1. Taper: 1 - (gonial_w / cheek_w). Higher taper → leaner.
  //      Empirical typical range: lean 0.30, fat 0.05.
  //   2. Aspect: face_height / cheek_w. Higher = more elongated → leaner.
  //      Empirical: lean 1.6, fat 1.2.
  //
  // We blend them into a single fullness score where 1.0 = full face and
  // 0.0 = lean face. Inter-ocular normalization is implicit since both
  // numerator and denominator are face-internal distances.
  const gonialW = dist(points[4], points[12]);
  const taper = 1 - gonialW / (cheekW || 1);
  const taperLeanness = clamp01((taper - 0.05) / 0.30);
  // Face height = brow midpoint to chin
  const browMid = midpoint(points[19], points[24]);
  const faceHeight = dist(browMid, points[8]);
  const aspect = faceHeight / (cheekW || 1);
  const aspectLeanness = clamp01((aspect - 1.20) / 0.45);
  const leanness = 0.6 * taperLeanness + 0.4 * aspectLeanness;
  const faceFat = clamp01(1 - leanness);

  // ─── Golden-ratio fit ─────────────────────────────────────────────────
  // Three classical thirds: hairline→brow, brow→nose-base, nose-base→chin.
  // Approximate hairline by extending up from brow-top to chin distance.
  const browTop = midpoint(points[19], points[24]);
  const noseBase = points[33];
  const chin = points[8];
  const browToNose = dist(browTop, noseBase);
  const noseToChin = dist(noseBase, chin);
  // Phi = 1.618. Compare sum-vs-larger ratio to phi.
  const a = browToNose;
  const b = noseToChin;
  const longer = Math.max(a, b);
  const ratio = (a + b) / (longer || 1); // ideally 1.618
  const phiErr = Math.abs(ratio - 1.618);
  const goldenRatio = clamp01(1 - phiErr / 0.5);

  // ─── Composite ────────────────────────────────────────────────────────
  // Weighted sum, then scale to 0..100. Tilt contributes by absolute value
  // (deviation from neutral is interesting either direction). Face fat
  // contributes negatively (leaner faces score higher in this game).
  const composite =
    100 *
    (0.26 * symmetry +
      0.22 * jawlineDefinition +
      0.12 * (1 - Math.abs(canthalTilt - 0.4)) + // ~5° positive tilt is "ideal"
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
    composite: Math.round(clamp01(composite / 100) * 100)
  };
}

/**
 * Eye Aspect Ratio for liveness (blink) detection.
 * Standard formula: (||p1-p5|| + ||p2-p4||) / (2 * ||p0-p3||)
 * Returns ~0.3 with eye open, drops below 0.2 during a blink.
 */
export function eyeAspectRatio(eye: Pt[]) {
  if (eye.length !== 6) return 0.3;
  const v1 = dist(eye[1], eye[5]);
  const v2 = dist(eye[2], eye[4]);
  const h = dist(eye[0], eye[3]) || 1;
  return (v1 + v2) / (2 * h);
}

export function getEyePoints(points: Pt[]) {
  return {
    right: IDX.rightEye.map((i) => points[i]),
    left: IDX.leftEye.map((i) => points[i])
  };
}
