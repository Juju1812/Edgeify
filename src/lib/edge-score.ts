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
 * Per-frame quality score in 0..1. Combines pose, detector confidence,
 * and face-size sanity. Used as the WEIGHT when building the consensus
 * face — frames with cleaner pose and higher detector confidence count
 * proportionally more.
 */
export function frameQuality(
  points: Pt[],
  detScore: number,
  frameW: number,
  frameH: number
): number {
  if (points.length !== 68) return 0;
  const pose = estimatePose(points);

  // Pose factor: 1.0 at perfect frontal, dropping to 0 at the gate edges.
  const rollOk = 1 - Math.min(1, Math.abs(pose.roll) / 0.32);
  const yawOk = 1 - Math.min(1, Math.abs(pose.yaw) / 0.32);
  const pitchOk = 1 - Math.min(1, Math.abs(pose.pitch) / 0.55);
  const poseFactor = rollOk * yawOk * pitchOk;

  // Detector confidence: sigmoid-ish around 0.7.
  const confFactor = clamp01((detScore - 0.55) / 0.3);

  // Face size: penalize very small (< 18% of frame width) or very large
  // (> 80% — likely too close, fish-eye distortion).
  const faceW = dist(points[0], points[16]);
  const faceFrac = faceW / Math.max(1, frameW || 640);
  let sizeFactor = 1;
  if (faceFrac < 0.18) sizeFactor = clamp01(faceFrac / 0.18);
  else if (faceFrac > 0.78) sizeFactor = clamp01((1 - faceFrac) / 0.22);

  // Center-of-frame factor: faces near the edge often have one side cut off.
  const fc = midpoint(points[36], points[45]);
  const cx = fc.x / Math.max(1, frameW || 640);
  const cy = fc.y / Math.max(1, frameH || 480);
  const offCenter = Math.max(Math.abs(cx - 0.5), Math.abs(cy - 0.5));
  const centerFactor = 1 - clamp01((offCenter - 0.25) / 0.25);

  return poseFactor * confFactor * sizeFactor * centerFactor;
}

/**
 * Rotate landmarks so the eye line is horizontal. Centers on the
 * midpoint between the outer eye corners. After this, "x reflection"
 * symmetry is meaningful even if the head was tilted in the original
 * frame.
 *
 * Also applies a light yaw-correction by stretching the closer-to-camera
 * hemisphere about the nose-bridge line. 2D landmarks can't fully de-yaw
 * a face, but for small yaws (< ~15°) this brings symmetry back into
 * range. Larger yaws should be rejected by the quality gate, not patched.
 */
export function frontalize(points: Pt[]): Pt[] {
  if (points.length !== 68) return points;
  const pose = estimatePose(points);

  // Step 1: roll-correct around the inter-ocular center.
  const center = midpoint(points[36], points[45]);
  const cos = Math.cos(-pose.roll);
  const sin = Math.sin(-pose.roll);
  const rolled = points.map((p) => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return {
      x: cos * dx - sin * dy + center.x,
      y: sin * dx + cos * dy + center.y
    };
  });

  // Step 2: light yaw compensation. After roll, the nose-bridge line
  // (27→33) gives us the visual symmetry axis. We then stretch the
  // narrower hemisphere by a factor that grows with |yaw|.
  const noseTop = rolled[27];
  const noseBot = rolled[33];
  const axisX = (noseTop.x + noseBot.x) / 2;
  // Stretch factor: at yaw=0 → 1; at yaw=0.30 → ~1.18 expansion of the
  // narrower side. Bounded so we never run away.
  const stretch = 1 + Math.min(0.20, Math.abs(pose.yaw) * 0.6);
  // The hemisphere with smaller average |x - axisX| is the "narrow" side
  // (further from camera). Stretch it; leave the other alone.
  let leftWidth = 0;
  let rightWidth = 0;
  let leftN = 0;
  let rightN = 0;
  for (const p of rolled) {
    if (p.x < axisX) {
      leftWidth += axisX - p.x;
      leftN++;
    } else if (p.x > axisX) {
      rightWidth += p.x - axisX;
      rightN++;
    }
  }
  const leftAvg = leftN ? leftWidth / leftN : 0;
  const rightAvg = rightN ? rightWidth / rightN : 0;
  const stretchLeft = leftAvg < rightAvg;

  return rolled.map((p) => {
    if (p.x < axisX && stretchLeft) {
      return { x: axisX - (axisX - p.x) * stretch, y: p.y };
    }
    if (p.x > axisX && !stretchLeft) {
      return { x: axisX + (p.x - axisX) * stretch, y: p.y };
    }
    return p;
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
 * Weighted trimmed mean. Drops top/bottom `frac` then averages the rest
 * with the given weights aligned to the sorted order.
 */
function weightedTrimmedMean(values: number[], weights: number[], frac = 0.15): number {
  if (values.length === 0) return 0;
  const idx = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const drop = Math.floor(idx.length * frac);
  const keep = idx.slice(drop, idx.length - drop);
  let num = 0;
  let den = 0;
  for (const i of keep) {
    const w = Math.max(0, weights[i] || 0);
    num += values[i] * w;
    den += w;
  }
  if (den === 0) {
    // Fallback to plain trimmed mean if all weights collapsed to 0.
    return trimmedMean(values, frac);
  }
  return num / den;
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
 * Weighted consensus — like consensusLandmarks but each frame contributes
 * proportionally to its `weights[i]` (typically detector confidence ×
 * pose quality × sharpness). Frames with weight ≤ 0 are silently dropped.
 */
export function consensusLandmarksWeighted(
  frames: Pt[][],
  weights: number[],
  frac = 0.15
): Pt[] {
  if (frames.length === 0) return [];
  const N = 68;
  const out: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const xs: number[] = [];
    const ys: number[] = [];
    const ws: number[] = [];
    for (let f = 0; f < frames.length; f++) {
      const fr = frames[f];
      const w = weights[f];
      if (fr && fr.length === N && w > 0) {
        xs.push(fr[i].x);
        ys.push(fr[i].y);
        ws.push(w);
      }
    }
    if (xs.length === 0) {
      out.push({ x: 0, y: 0 });
      continue;
    }
    out.push({
      x: weightedTrimmedMean(xs, ws, frac),
      y: weightedTrimmedMean(ys, ws, frac)
    });
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
 * Best-fit vertical line through a set of points (least-squares regression
 * with x as the dependent variable, since we expect the line to be near-
 * vertical: x = m*y + c).
 *
 * Returns the function xOfY(y) so callers can evaluate the axis at any y.
 */
function fitNearVerticalLine(pts: Pt[]): (y: number) => number {
  if (pts.length < 2) {
    const xs = pts.map((p) => p.x);
    const mean = xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length);
    return () => mean;
  }
  const n = pts.length;
  let sx = 0, sy = 0, sxy = 0, syy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
    sxy += p.x * p.y;
    syy += p.y * p.y;
  }
  const meanY = sy / n;
  const meanX = sx / n;
  const denom = syy - n * meanY * meanY;
  if (Math.abs(denom) < 1e-6) return () => meanX;
  const m = (sxy - n * meanX * meanY) / denom;
  const c = meanX - m * meanY;
  return (y: number) => m * y + c;
}

/**
 * Compute the EdgeScore breakdown from 68-point landmarks.
 *
 * IMPORTANT: this is an entertainment metric. It measures a handful of
 * geometric properties — symmetry, jawline angularity, canthal tilt, etc.
 * It does not — and cannot — measure attractiveness.
 *
 * Computation runs on FRONTALIZED points (rotated so the eye line is
 * horizontal, with light yaw compensation) so symmetry/cheekbone metrics
 * aren't ruined by an in-plane head tilt. Canthal tilt is the exception
 * — it's the actual tilt and therefore measured on the raw, un-rotated
 * points.
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

  // Reference axis for symmetry: best-fit line through the nose ridge
  // (points 27-30) plus the philtrum point (33). This is far more stable
  // than the simple midpoint of 27 & 33, especially for noses that don't
  // sit dead-center under the brow midpoint.
  const ridgePts = [points[27], points[28], points[29], points[30], points[33]];
  const xOfY = fitNearVerticalLine(ridgePts);

  // Reference scale: inter-ocular distance (eye corner to eye corner).
  // Used to normalize symmetry error so the metric is scale-invariant.
  const interOcular = dist(points[36], points[45]) || 1;

  // ─── Symmetry ──────────────────────────────────────────────────────────
  // Reflect right-side landmarks across the per-y axis line and compare
  // against the matching left-side landmarks. Lower mean error → higher
  // symmetry. Pairs are weighted: features near the centerline (nose,
  // inner lips) need to match precisely; outer features (jaw extremes)
  // get less weight since they're more affected by face shape.
  const symPairs: [number, number, number][] = [
    // [right idx, left idx, weight]
    [0, 16, 0.5], [1, 15, 0.6], [2, 14, 0.7], [3, 13, 0.8],
    [4, 12, 0.9], [5, 11, 0.9], [6, 10, 1.0], [7, 9, 1.0],
    [17, 26, 0.8], [18, 25, 0.9], [19, 24, 1.0], [20, 23, 1.0], [21, 22, 1.0],
    [31, 35, 1.0], [32, 34, 1.0],
    [36, 45, 1.0], [39, 42, 1.0], [37, 44, 1.0], [38, 43, 1.0],
    [40, 47, 1.0], [41, 46, 1.0],
    [48, 54, 1.0], [49, 53, 1.0], [50, 52, 1.0],
    [60, 64, 1.0], [61, 63, 1.0], [67, 65, 1.0]
  ];
  let symErrSum = 0;
  let symWSum = 0;
  for (const [r, l, w] of symPairs) {
    const axisAtR = xOfY(points[r].y);
    const axisAtL = xOfY(points[l].y);
    const axisX = (axisAtR + axisAtL) / 2;
    const reflected = reflectX(points[r], axisX);
    symErrSum += dist(reflected, points[l]) * w;
    symWSum += w;
  }
  const symMeanRaw = symErrSum / Math.max(1, symWSum) / interOcular;
  // Map error 0..0.55 → 1..0. Slightly tighter than before because the
  // weighted axis fit gives smaller residuals on truly symmetric faces.
  const symmetry = clamp01(1 - symMeanRaw / 0.55);

  // ─── Jawline definition ───────────────────────────────────────────────
  // Sharper jaw = sharper angles at the lower jaw. Restrict the curvature
  // sum to points 4-12 (the part of the jaw chain that's actually below
  // the gonial angle); points 0-3 and 13-16 sit above the cheekbone and
  // confound the metric with cheek shape.
  let jawCurvature = 0;
  for (let i = 5; i < 12; i++) {
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
  // Lower jaw curvature 7-segment range: ~0.5 (very soft) to 2.4 (sharp).
  const jawlineDefinition = clamp01((jawCurvature - 0.5) / 1.9);

  // ─── Canthal tilt ─────────────────────────────────────────────────────
  // Use the RAW (un-frontalized) points to measure canthal tilt — but
  // subtract head-roll so we measure the eye-internal tilt only, not the
  // global head tilt. Average left and right eyes for stability.
  const rawPose = estimatePose(rawPoints);
  function eyeTiltDegRaw(outer: Pt, inner: Pt): number {
    const dx = inner.x - outer.x;
    const dy = inner.y - outer.y;
    // Subtract roll
    const rolled = {
      x: dx * Math.cos(-rawPose.roll) - dy * Math.sin(-rawPose.roll),
      y: dx * Math.sin(-rawPose.roll) + dy * Math.cos(-rawPose.roll)
    };
    const eyeWidth = Math.abs(rolled.x) || 1;
    return Math.atan2(rolled.y, eyeWidth) * (180 / Math.PI);
  }
  const tiltR = eyeTiltDegRaw(rawPoints[36], rawPoints[39]);
  const tiltL = eyeTiltDegRaw(rawPoints[45], rawPoints[42]);
  const angleDeg = (tiltR + tiltL) / 2;
  // Typical observed range -10..+15 deg. Normalize to -1..1.
  const canthalTilt = clampSigned(angleDeg / 12);

  // ─── Cheekbone prominence ─────────────────────────────────────────────
  // Zygomatic (cheekbone) width vs gonial (lower-jaw) width. A face with
  // dramatic cheekbone protrusion has cheek width noticeably greater than
  // gonial width. We use points 1/15 (just under the temples) for cheek
  // width and points 4/12 (mid-jaw) for the gonial reference. Normalized
  // by interOcular for cross-frame comparability.
  const cheekW = dist(points[1], points[15]);
  const gonialW = dist(points[4], points[12]);
  const cheekRatio = cheekW / (gonialW || 1); // ~1.05 (soft) .. 1.40 (sharp)
  const cheekboneProm = clamp01((cheekRatio - 1.05) / 0.35);

  // ─── Face fat (facial fullness) ───────────────────────────────────────
  // Three-signal blend so no single noisy measurement dominates:
  //   1. Taper: 1 - (gonial_w / cheek_w). Lean faces taper hard.
  //   2. Aspect: face_height / cheek_w. Lean faces are elongated.
  //   3. Chin sharpness: angle at the chin point 8 between segments 6→8
  //      and 8→10. Lean faces have a pointier chin.
  const taper = 1 - gonialW / (cheekW || 1);
  const taperLeanness = clamp01((taper - 0.05) / 0.30);
  const browMid = midpoint(points[19], points[24]);
  const faceHeight = dist(browMid, points[8]);
  const aspect = faceHeight / (cheekW || 1);
  const aspectLeanness = clamp01((aspect - 1.20) / 0.45);

  const v1 = { x: points[8].x - points[6].x, y: points[8].y - points[6].y };
  const v2 = { x: points[10].x - points[8].x, y: points[10].y - points[8].y };
  const a1 = Math.atan2(v1.y, v1.x);
  const a2 = Math.atan2(v2.y, v2.x);
  let chinAngle = Math.abs(a1 - a2);
  if (chinAngle > Math.PI) chinAngle = 2 * Math.PI - chinAngle;
  // Sharper chin → larger turning angle. ~0.3 (round) .. 1.2 (pointed).
  const chinLeanness = clamp01((chinAngle - 0.3) / 0.9);

  const leanness = 0.45 * taperLeanness + 0.30 * aspectLeanness + 0.25 * chinLeanness;
  const faceFat = clamp01(1 - leanness);

  // ─── Golden-ratio fit ─────────────────────────────────────────────────
  // Multi-ratio comparison so a single mismeasured landmark doesn't
  // tank the metric. We score three classical proportions and average:
  //   (a) Three vertical thirds, brow→nose : nose→chin should be ~1:1.
  //   (b) Lower-third split: nose→lipline : lipline→chin should be ~1:2.
  //   (c) Eye-to-mouth golden: faceWidth / mouthWidth should be ~phi.
  const browTop = midpoint(points[19], points[24]);
  const noseBase = points[33];
  const chin = points[8];
  const lipLine = midpoint(points[51], points[57]);
  const mouthW = dist(points[48], points[54]);
  const faceW2 = dist(points[0], points[16]);

  // Ratio (a): brow→nose vs nose→chin. Ideal ~1.0.
  const a = dist(browTop, noseBase);
  const b = dist(noseBase, chin);
  const thirdsRatio = a / (b || 1);
  const thirdsErr = Math.abs(thirdsRatio - 1.0);
  const thirdsScore = clamp01(1 - thirdsErr / 0.35);

  // Ratio (b): nose→lipline vs lipline→chin. Ideal ~0.5 (i.e. lipline-
  // to-chin is roughly twice nose-to-lipline).
  const c = dist(noseBase, lipLine);
  const d2 = dist(lipLine, chin);
  const lowerThirdRatio = c / (d2 || 1);
  const lowerThirdErr = Math.abs(lowerThirdRatio - 0.5);
  const lowerThirdScore = clamp01(1 - lowerThirdErr / 0.30);

  // Ratio (c): faceWidth / mouthWidth ≈ phi (1.618).
  const fwmw = faceW2 / (mouthW || 1);
  const phiErr = Math.abs(fwmw - 1.618);
  const phiScore = clamp01(1 - phiErr / 0.60);

  const goldenRatio = clamp01(0.4 * thirdsScore + 0.3 * lowerThirdScore + 0.3 * phiScore);

  // ─── Composite ────────────────────────────────────────────────────────
  // Weighted sum, then scale to 0..100. Tilt contributes by absolute value
  // (deviation from neutral is interesting either direction). Face fat
  // contributes negatively (leaner faces score higher in this game).
  // Weights re-tuned: symmetry and jawline are the most reliable signals
  // at 2D, so they get the most weight; goldenRatio is the noisiest.
  const composite =
    100 *
    (0.28 * symmetry +
      0.22 * jawlineDefinition +
      0.10 * (1 - Math.abs(canthalTilt - 0.4)) + // ~5° positive tilt is "ideal"
      0.14 * cheekboneProm +
      0.10 * goldenRatio +
      0.16 * (1 - faceFat));

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

/**
 * Sharpness estimate via per-pixel grayscale gradient magnitude over a
 * bounding box. Higher = crisper face. We sample sparsely (every 4 px)
 * so this stays cheap to call per frame.
 *
 * Returns a number 0..1 where 0 is "blurry" and 1 is "sharp". Calibrated
 * empirically against a typical 640x480 webcam at well-lit indoor scenes.
 */
export function sharpnessAt(
  imageData: ImageData,
  bbox: { x: number; y: number; width: number; height: number }
): number {
  const { data, width } = imageData;
  const x0 = Math.max(1, Math.floor(bbox.x));
  const y0 = Math.max(1, Math.floor(bbox.y));
  const x1 = Math.min(imageData.width - 2, Math.floor(bbox.x + bbox.width));
  const y1 = Math.min(imageData.height - 2, Math.floor(bbox.y + bbox.height));
  if (x1 - x0 < 8 || y1 - y0 < 8) return 0;

  let sum = 0;
  let sum2 = 0;
  let count = 0;
  // 4-px stride for cost reduction
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) {
      const i = (y * width + x) * 4;
      // Luma approximation (Rec. 601)
      const lc = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const ir = ((y) * width + (x + 1)) * 4;
      const id = ((y + 1) * width + x) * 4;
      const lr = data[ir] * 0.299 + data[ir + 1] * 0.587 + data[ir + 2] * 0.114;
      const ld = data[id] * 0.299 + data[id + 1] * 0.587 + data[id + 2] * 0.114;
      const gx = lr - lc;
      const gy = ld - lc;
      const g = gx * gx + gy * gy;
      sum += g;
      sum2 += g * g;
      count++;
    }
  }
  if (count === 0) return 0;
  // Use sqrt of mean squared gradient as crispness signal.
  const mean = sum / count;
  // Empirically: sharp webcam frames have mean ~120-300; blurry ~5-30.
  return clamp01((Math.sqrt(mean) - 4) / 16);
}

/**
 * Brightness estimate (mean luma) of the bounded region. Returned in
 * 0..255. Used to reject near-black or blown-out frames.
 */
export function meanLumaAt(
  imageData: ImageData,
  bbox: { x: number; y: number; width: number; height: number }
): number {
  const { data, width } = imageData;
  const x0 = Math.max(0, Math.floor(bbox.x));
  const y0 = Math.max(0, Math.floor(bbox.y));
  const x1 = Math.min(imageData.width - 1, Math.floor(bbox.x + bbox.width));
  const y1 = Math.min(imageData.height - 1, Math.floor(bbox.y + bbox.height));
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) {
      const i = (y * width + x) * 4;
      sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      count++;
    }
  }
  return count === 0 ? 0 : sum / count;
}
