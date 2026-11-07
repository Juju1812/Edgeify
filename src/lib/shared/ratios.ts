/**
 * Classic facial ratios measured from MediaPipe's 478-point face mesh on a
 * FRONT-FACING frame. Shared by the browser (measurement) and the server
 * (validation + scoring). Profile-only measures (gonial / cervicomental
 * angle) and "forehead in fingers" can't be taken from a front webcam, so
 * they're omitted. The mesh can't see the hairline, so the facial-thirds
 * check compares the middle and lower thirds only.
 */

export type Pt3 = { x: number; y: number };

export const RATIO_KEYS = [
  "fwhr",
  "midface",
  "esr",
  "canthalTilt",
  "eme",
  "mouthNose",
  "lipRatio",
  "chinPhiltrum",
  "zygoGonial",
  "pfr",
  "thirds",
  "fifths",
  "symmetry"
] as const;
export type RatioKey = (typeof RATIO_KEYS)[number];
export type Ratios = Partial<Record<RatioKey, number>>;

type Spec = {
  label: string;
  /** Ideal range [lo, hi] for the value. */
  ideal: [number, number];
  /** Distance outside the range at which the metric scores 0. */
  falloff: number;
  /** Relative weight in the ratio score. */
  weight: number;
  unit?: "°" | "%";
  /** Sanity bounds — values outside are measurement errors and rejected. */
  bounds: [number, number];
  digits: number;
  help: string;
};

export const RATIO_SPECS: Record<RatioKey, Spec> = {
  fwhr: { label: "FWHR", ideal: [1.85, 2.2], falloff: 0.45, weight: 1.4, bounds: [1.2, 2.9], digits: 2, help: "Cheekbone width ÷ eyelid-to-upper-lip height" },
  midface: { label: "Midface ratio", ideal: [1.0, 1.1], falloff: 0.3, weight: 1.2, bounds: [0.6, 1.6], digits: 2, help: "Pupil distance ÷ nasion-to-upper-lip height" },
  esr: { label: "Eye separation (ESR)", ideal: [0.45, 0.47], falloff: 0.06, weight: 1.0, bounds: [0.3, 0.6], digits: 3, help: "Pupil distance ÷ cheekbone width" },
  canthalTilt: { label: "Canthal tilt", ideal: [4, 6], falloff: 8, weight: 1.0, unit: "°", bounds: [-15, 20], digits: 1, help: "Angle from inner to outer eye corner" },
  eme: { label: "EME angle", ideal: [47, 50], falloff: 8, weight: 0.8, unit: "°", bounds: [30, 70], digits: 1, help: "Pupil–mouth–pupil angle" },
  mouthNose: { label: "Mouth ÷ nose width", ideal: [1.5, 1.62], falloff: 0.35, weight: 0.8, bounds: [1.0, 2.4], digits: 2, help: "Mouth width ÷ nose width" },
  lipRatio: { label: "Lower ÷ upper lip", ideal: [1.5, 1.75], falloff: 0.8, weight: 0.5, bounds: [0.5, 4], digits: 2, help: "Lower lip height ÷ upper lip height" },
  chinPhiltrum: { label: "Chin ÷ philtrum", ideal: [2.0, 2.25], falloff: 0.7, weight: 1.0, bounds: [1.0, 3.6], digits: 2, help: "Lips-to-chin ÷ nose-to-lips height" },
  zygoGonial: { label: "Cheekbone ÷ jaw width", ideal: [1.3, 1.4], falloff: 0.2, weight: 1.2, bounds: [1.0, 1.8], digits: 2, help: "Bizygomatic ÷ bigonial width" },
  pfr: { label: "Eye shape (PFR)", ideal: [3.0, 3.5], falloff: 1.0, weight: 0.7, bounds: [1.8, 5.5], digits: 2, help: "Eye length ÷ eye height" },
  thirds: { label: "Lower ÷ middle third", ideal: [0.95, 1.1], falloff: 0.3, weight: 0.8, bounds: [0.6, 1.6], digits: 2, help: "Nose-to-chin ÷ brow-to-nose height — the thirds should be equal" },
  fifths: { label: "Facial fifths balance", ideal: [0, 8], falloff: 20, weight: 0.6, unit: "%", bounds: [0, 60], digits: 1, help: "Average deviation of the fifths from 20%" },
  symmetry: { label: "Measured symmetry", ideal: [0, 2], falloff: 8, weight: 1.0, unit: "%", bounds: [0, 30], digits: 1, help: "Average left/right mismatch, % of face width" }
};

const dist = (a: Pt3, b: Pt3) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pt3, b: Pt3): Pt3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Measure all ratios on one frame. `pts` are pixel-space landmarks (any
 * consistent scale). Returns null if the head is turned too far to trust.
 */
export function measureFrame(pts: Pt3[]): { ratios: Ratios; yaw: number } | null {
  if (!pts || pts.length < 478) return null;

  // Roll-correct around the pupil midpoint so horizontal/vertical mean what they should.
  const pr = pts[468];
  const pl = pts[473];
  // Measure roll from the left-most to the right-most pupil so a mirrored
  // (selfie) image isn't mistaken for an upside-down face.
  const [a, b] = pr.x <= pl.x ? [pr, pl] : [pl, pr];
  const roll = Math.atan2(b.y - a.y, b.x - a.x);
  const c = mid(pr, pl);
  const cos = Math.cos(-roll);
  const sin = Math.sin(-roll);
  const P = pts.map((p) => {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    return { x: cos * dx - sin * dy, y: sin * dx + cos * dy };
  });

  const zygR = P[234], zygL = P[454];
  const bizyg = Math.abs(zygL.x - zygR.x);
  if (bizyg < 1) return null;

  // Yaw: how far the nose tip sits from the face's midline.
  const yaw = (P[4].x - (zygR.x + zygL.x) / 2) / bizyg;

  const pupilR = P[468], pupilL = P[473];
  const ipd = dist(pupilR, pupilL);
  // Landmark choices calibrated against real faces (see git history):
  // upper eyelids for FWHR height (the standard definition), lower jaw points
  // (136/365) for gonion, nostril edges (98/327) for nose width.
  const browMid = mid(P[9], mid(P[105], P[334])); // between the brows
  const eyelidTop = mid(P[159], P[386]);
  const upperLip = P[0];
  const nasion = P[168];
  const chin = P[152];
  const subnasale = P[2];
  const stomion = mid(P[13], P[14]);
  const gonR = P[136], gonL = P[365];
  const bigonial = Math.abs(gonL.x - gonR.x);

  const r: Ratios = {};
  r.fwhr = bizyg / Math.max(1e-6, upperLip.y - eyelidTop.y);
  r.midface = ipd / Math.max(1e-6, upperLip.y - nasion.y);
  r.esr = ipd / bizyg;

  // Canthal tilt: positive when the outer corner sits higher than the inner.
  const tilt = (lat: Pt3, med: Pt3) => (Math.atan2(med.y - lat.y, Math.abs(lat.x - med.x)) * 180) / Math.PI;
  r.canthalTilt = (tilt(P[33], P[133]) + tilt(P[263], P[362])) / 2;

  // EME: angle at the centre of the lips between the two pupils.
  const v1 = { x: pupilR.x - stomion.x, y: pupilR.y - stomion.y };
  const v2 = { x: pupilL.x - stomion.x, y: pupilL.y - stomion.y };
  r.eme = (Math.acos((v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y))) * 180) / Math.PI;

  r.mouthNose = dist(P[61], P[291]) / Math.max(1e-6, dist(P[98], P[327]));
  r.lipRatio = (P[17].y - P[14].y) / Math.max(1e-6, P[13].y - P[0].y);
  r.chinPhiltrum = (chin.y - stomion.y) / Math.max(1e-6, stomion.y - subnasale.y);
  r.zygoGonial = bizyg / Math.max(1e-6, bigonial);

  const pfrEye = (lat: number, med: number, up: number, lo: number) =>
    dist(P[lat], P[med]) / Math.max(1e-6, Math.abs(P[lo].y - P[up].y));
  r.pfr = (pfrEye(33, 133, 159, 145) + pfrEye(263, 362, 386, 374)) / 2;

  // The mesh can't see the hairline, so compare the two thirds it can measure.
  r.thirds = (chin.y - subnasale.y) / Math.max(1e-6, subnasale.y - browMid.y);

  // Fifths across the face at eye level: outer face → outer corner, eye, gap, eye, outer corner → outer face.
  const xs = [zygR.x, P[33].x, P[133].x, P[362].x, P[263].x, zygL.x].sort((a, b) => a - b);
  const W = xs[5] - xs[0];
  const fifths = [1, 2, 3, 4, 5].map((i) => (xs[i] - xs[i - 1]) / Math.max(1e-6, W));
  r.fifths = (fifths.reduce((s, f) => s + Math.abs(f - 0.2), 0) / 5) * 100;

  // Symmetry: mirror paired points across the midline (nose bridge → chin).
  const midX = (P[168].x + P[1].x + P[152].x) / 3;
  const pairs: [number, number][] = [
    [33, 263], [133, 362], [468, 473], [105, 334], [234, 454], [136, 365], [61, 291], [98, 327], [172, 397], [159, 386]
  ];
  let err = 0;
  for (const [a, b] of pairs) {
    const ra = { x: 2 * midX - P[a].x, y: P[a].y };
    err += dist(ra, P[b]);
  }
  r.symmetry = (err / pairs.length / bizyg) * 100;

  return { ratios: r, yaw };
}

/** Average several frames' measurements, keeping only near-frontal ones. */
export function averageRatios(frames: { ratios: Ratios; yaw: number }[]): { ratios: Ratios; frontal: boolean } | null {
  if (!frames.length) return null;
  const frontal = frames.filter((f) => Math.abs(f.yaw) < 0.06);
  const use = frontal.length ? frontal : frames;
  const out: Ratios = {};
  for (const k of RATIO_KEYS) {
    const vals = use.map((f) => f.ratios[k]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!vals.length) continue;
    vals.sort((a, b) => a - b);
    out[k] = vals[Math.floor(vals.length / 2)]; // median — robust to a bad frame
  }
  return { ratios: out, frontal: frontal.length > 0 };
}

/** Keep only finite values inside sane bounds (anything else is a mismeasurement). */
export function sanitizeRatios(input: unknown): Ratios | null {
  if (!input || typeof input !== "object") return null;
  const src = input as Record<string, unknown>;
  const out: Ratios = {};
  for (const k of RATIO_KEYS) {
    const v = src[k];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const [lo, hi] = RATIO_SPECS[k].bounds;
    if (v >= lo && v <= hi) out[k] = v;
  }
  return Object.keys(out).length >= 6 ? out : null;
}

/** 0-100 closeness of one value to its ideal range. */
export function metricScore(k: RatioKey, v: number) {
  const s = RATIO_SPECS[k];
  const [lo, hi] = s.ideal;
  const off = v < lo ? lo - v : v > hi ? v - hi : 0;
  return Math.max(0, Math.round(100 * (1 - off / s.falloff)));
}

export type RatioReport = {
  score: number; // weighted 0-100 closeness to the ideals
  items: { key: RatioKey; value: number; score: number; inRange: boolean }[];
};

export function ratioReport(r: Ratios): RatioReport {
  let num = 0;
  let den = 0;
  const items: RatioReport["items"] = [];
  for (const k of RATIO_KEYS) {
    const v = r[k];
    if (typeof v !== "number") continue;
    const sc = metricScore(k, v);
    items.push({ key: k, value: v, score: sc, inRange: sc === 100 });
    num += sc * RATIO_SPECS[k].weight;
    den += RATIO_SPECS[k].weight;
  }
  return { score: den ? Math.round(num / den) : 0, items };
}

export function formatRatio(k: RatioKey, v: number) {
  const s = RATIO_SPECS[k];
  return `${v.toFixed(s.digits)}${s.unit ?? ""}`;
}

export function formatIdeal(k: RatioKey) {
  const s = RATIO_SPECS[k];
  const [lo, hi] = s.ideal;
  if (s.unit === "%") return `≤ ${hi}${s.unit}`;
  if (k === "fwhr") return `${lo}+`;
  return lo === hi ? `${lo}${s.unit ?? ""}` : `${lo}–${hi}${s.unit ?? ""}`;
}
