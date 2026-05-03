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
 */
export function computeEdgeScore(points: Pt[]): EdgeScoreBreakdown {
  if (points.length !== 68) {
    return {
      symmetry: 0.5,
      jawlineDefinition: 0.5,
      canthalTilt: 0,
      cheekboneProm: 0.5,
      goldenRatio: 0.5,
      composite: 50
    };
  }

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
  // Angle of the line from inner-eye-corner to outer-eye-corner, signed
  // so positive = "positive" (outer-up) tilt. We'll use the right eye
  // (points 36 outer, 39 inner). Y axis grows downward in image coords.
  const rOuter = points[36];
  const rInner = points[39];
  const dx = rInner.x - rOuter.x;
  const dy = rInner.y - rOuter.y;
  const angleRad = Math.atan2(-dy, dx); // negate dy so up is positive
  const angleDeg = angleRad * (180 / Math.PI);
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
  // (deviation from neutral is interesting either direction).
  const composite =
    100 *
    (0.30 * symmetry +
      0.25 * jawlineDefinition +
      0.15 * (1 - Math.abs(canthalTilt - 0.4)) + // ~5° positive tilt is "ideal"
      0.15 * cheekboneProm +
      0.15 * goldenRatio);

  return {
    symmetry,
    jawlineDefinition,
    canthalTilt,
    cheekboneProm,
    goldenRatio,
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
