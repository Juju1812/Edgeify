import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { TRAIT_KEYS, type TraitKey } from "../shared/types";
import { formatIdeal, formatRatio, RATIO_SPECS, ratioReport, type RatioReport, type Ratios } from "../shared/ratios";

/**
 * Server-side face scoring with Claude vision.
 *
 * Replaces the old 68-landmark geometry score, which only saw dots and
 * squashed nearly everyone into 50-60. The model looks at the actual frames
 * (tight crops around the face) and rates against a fixed, population-
 * anchored rubric.
 */

export const SCORE_MODEL = "claude-opus-5-5";

const UNUSABLE_REASONS = [
  "no_face",
  "multiple_faces",
  "face_obstructed",
  "too_dark_or_blurry",
  "bad_angle",
  "not_a_live_photo",
  "explicit_content"
] as const;
export type UnusableReason = (typeof UNUSABLE_REASONS)[number];

const ScoreSchema = z.object({
  usable: z.boolean(),
  unusable_reason: z.enum([...UNUSABLE_REASONS, "none"]),
  /** One sentence on why, when unusable — logged for debugging false rejects. */
  gate_note: z.string(),
  traits: z.object({
    symmetry: z.number(),
    proportions: z.number(),
    jaw: z.number(),
    cheekbones: z.number(),
    eyes: z.number(),
    leanness: z.number(),
    skin: z.number(),
    hair: z.number()
  }),
  overall: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  headline: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string())
});

export type AiScore = {
  overall: number; // 0-100, population-anchored (50 = average adult)
  traits: Record<TraitKey, number>;
  confidence: "low" | "medium" | "high";
  headline: string;
  strengths: string[];
  improvements: string[];
  /** Measured ratios and how close they are to the ideals, when available. */
  ratios: Ratios | null;
  ratioScore: number | null;
};

/**
 * How much measured ratios move the final overall directly (on top of the AI
 * weighing them). A face that hits the ideals gains up to +RATIO_NUDGE_MAX,
 * one far off them loses up to that much. Capped so a mismeasurement can't
 * swing a score wildly.
 */
// Calibrated on real mesh measurements: typical faces land ~85-95 closeness,
// and closeness alone doesn't separate attractive from plain faces well
// (a fuller face can hit the bone ratios too), so the direct nudge is small.
const RATIO_BASELINE = 88;
const RATIO_NUDGE_PER_POINT = 0.3;
const RATIO_NUDGE_MAX = 4;

function ratioBlock(r: Ratios, report: RatioReport) {
  const lines = report.items.map((it) => {
    const spec = RATIO_SPECS[it.key];
    const verdict = it.inRange ? "IN ideal range" : `outside ideal (closeness ${it.score}/100)`;
    return `- ${spec.label}: ${formatRatio(it.key, it.value)} — ideal ${formatIdeal(it.key)} — ${verdict}. (${spec.help})`;
  });
  return `Measured facial ratios for this person (from a 478-point face mesh on the near-frontal frames — objective geometry, though small webcam/pose errors are possible):
${lines.join("\n")}
Overall closeness to the ideal ratios: ${report.score}/100.

Use these as STRONG evidence. They are the established ideal proportions for a highly attractive face. Map them to the traits: proportions ← midface ratio, facial thirds/fifths, chin÷philtrum, mouth÷nose, lower÷full face; cheekbones ← FWHR, cheekbone÷jaw width; jaw ← cheekbone÷jaw width, chin÷philtrum; eyes ← ESR, canthal tilt, eye shape (PFR), EME angle; symmetry ← measured symmetry. A face that hits most ideals should score clearly high on those traits; a face far from them should not be scored high on proportions or structure just because it is groomed or well lit.
Caveats: these ratios describe bone proportions only — they say nothing about skin, hair, facial fat or overall appeal, so don't let them override what you see for leanness, skin, hair or the overall impression. FWHR also rises with facial fat (a wide, full face can hit it), so only credit a high FWHR as structure when the face is lean. The ideals are largely male-derived: on female faces a higher canthal tilt and a slightly shorter lower third are normal and attractive. If one value obviously contradicts what you can see (a likely mismeasurement), trust your eyes for that one value only.`;
}

export type ScoreResult =
  | { ok: true; score: AiScore; model: string; usage: { input: number; output: number } }
  | { ok: false; reason: UnusableReason | "refused" | "parse_failed"; note?: string };

// Frozen system prompt — keep byte-stable so it can be cached.
const SYSTEM_PROMPT = `You are the scoring engine for Edgify, an opt-in entertainment app where adults scan their own face with their webcam and compete on a looks score. Users choose to be rated and expect a candid, accurate number — inflated or compressed scores ruin the game.

Every user has confirmed at signup that they are 18 or older. Do not try to estimate age or refuse anyone for looking young — many adults have youthful faces, and judging age from a webcam frame is unreliable.

You will receive several webcam frames of ONE person taken a fraction of a second apart, cropped around the face. Judge the person, not the photo quality.

## Gate first — be lenient
Refusing a scan is a bad experience, so only set usable=false when a reason CLEARLY applies. Webcam frames are naturally soft, a little noisy, compressed and lit by ordinary room light — that is normal and NEVER a reason to refuse. If you can make out the eyes, nose, mouth and jawline in at least one frame, the scan is usable: score it and use confidence="low" if quality is poor.
Reasons (choose the single most relevant, and explain in gate_note):
- no_face: no human face visible in any frame
- multiple_faces: more than one person is prominent
- face_obstructed: sunglasses, a mask or a hand covers the eyes or most of the face
- too_dark_or_blurry: so dark, blown out or smeared that the facial features genuinely cannot be made out in ANY frame
- bad_angle: turned so far away that both eyes are not visible
- not_a_live_photo: obviously a photo of a phone/monitor screen or a printout held up to the camera
- explicit_content: visible genitals, exposed female nipples, sexual acts or sexual gestures, or an obscene gesture/object held up to the camera. (A shirtless man or a low neckline alone is NOT explicit.)
When usable=true: unusable_reason="none" and gate_note="".
When usable=false: set overall and all traits to 0.

## Scale (overall and every trait, integers 0-100, higher is always better)
Anchored to the general adult population, not to models:
- 50 = exactly average. Half of adults are above, half below.
- 60 = noticeably above average (top ~25%).
- 70 = clearly attractive; strangers would agree (top ~10%).
- 80 = striking, very rare in everyday life (top ~2%).
- 90+ = elite model/celebrity tier (top ~0.1%). Almost never give this.
- 40 = noticeably below average; 30 and below = well below.
USE THE WHOLE RANGE. Do not hug 50-65 out of politeness — a clearly attractive person must land clearly above an average one. Separation between people is the entire point of the game. Score each trait on its own merits; they should not all be the same number.

## Traits
- symmetry: how closely the left and right halves mirror each other — eyes, brows, cheeks, jaw, mouth. Discount small differences caused by a slight head turn or uneven lighting.
- proportions: facial thirds, eye spacing, nose and mouth size relative to the face — how well the features fit together.
- jaw: jawline definition and angularity, chin projection and shape.
- cheekbones: cheekbone height and prominence, midface structure.
- eyes: eye shape, spacing, canthal tilt, brows, under-eye area.
- leanness: facial leanness — how little soft tissue / facial fat there is. 100 = very lean, sculpted face; 50 = average; low = full, round or puffy face, soft or double chin.
- skin: clarity, texture, evenness (ignore webcam grain and compression).
- hair: density, hairline, how well the style suits the face (judge 50 if not visible).

overall is your holistic judgment of attractiveness — NOT an average of the traits. Bone structure (jaw, cheekbones), proportions, symmetry, eyes and leanness matter most; skin moderately; hair least. Judge attractiveness for the person's apparent sex using broadly shared standards.

## Text fields
- headline: 3-7 words, punchy, written like an Apple tagline and specific to this face — e.g. "Sharp jaw. Clear presence." Confident, never insulting.
- strengths: exactly 3 short, specific observations.
- improvements: exactly 3 realistic, actionable tips (grooming, hair, skin care, lighting, posture, camera angle). Nothing surgical, no weight-loss advice.
- confidence: how sure you are given image quality.
Never comment on ethnicity or guess identity.`;

function clampInt(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type Frame = { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };

export async function scoreFace(frames: Frame[], ratios: Ratios | null = null, client = new Anthropic()): Promise<ScoreResult> {
  const report = ratios ? ratioReport(ratios) : null;
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  frames.forEach((f, i) => {
    content.push({ type: "text", text: `Frame ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: f.mediaType, data: f.data } });
  });
  if (ratios && report) content.push({ type: "text", text: ratioBlock(ratios, report) });
  content.push({ type: "text", text: "Score this person." });

  const response = await client.beta.messages.parse({
    model: SCORE_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    // High effort: more careful looking before committing to numbers.
    output_config: { effort: "high", format: betaZodOutputFormat(ScoreSchema) },
    messages: [{ role: "user", content }]
  });

  if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
  const out = response.parsed_output;
  if (!out) return { ok: false, reason: "parse_failed" };
  if (!out.usable) {
    // usable=false without a reason is contradictory — treat as a hiccup, not "too dark".
    if (out.unusable_reason === "none") return { ok: false, reason: "parse_failed", note: out.gate_note };
    return { ok: false, reason: out.unusable_reason, note: out.gate_note.slice(0, 300) };
  }

  const traits = Object.fromEntries(TRAIT_KEYS.map((k) => [k, clampInt(out.traits[k])])) as Record<TraitKey, number>;

  let overall = clampInt(out.overall);
  if (report) {
    const nudge = Math.round((report.score - RATIO_BASELINE) * RATIO_NUDGE_PER_POINT);
    overall = clampInt(overall + Math.max(-RATIO_NUDGE_MAX, Math.min(RATIO_NUDGE_MAX, nudge)));
  }

  return {
    ok: true,
    model: response.model,
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    score: {
      ratios: ratios ?? null,
      ratioScore: report?.score ?? null,
      overall,
      traits,
      confidence: out.confidence,
      headline: out.headline.slice(0, 120),
      strengths: out.strengths.slice(0, 3).map((s) => s.slice(0, 160)),
      improvements: out.improvements.slice(0, 3).map((s) => s.slice(0, 160))
    }
  };
}
