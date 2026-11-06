import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

/**
 * Server-side face scoring with Claude vision.
 *
 * Replaces the old 68-landmark geometry score (src/lib/edge-score.ts), which
 * only saw dots and squashed nearly everyone into 50-60. Here the model looks
 * at the actual photos and rates against a fixed, population-anchored rubric.
 */

import { TRAIT_KEYS, type TraitKey } from "../shared/types";

export const SCORE_MODEL = "claude-opus-5-5";

const UNUSABLE_REASONS = [
  "no_face",
  "multiple_faces",
  "face_obstructed",
  "too_dark_or_blurry",
  "bad_angle",
  "not_a_live_photo",
  "appears_under_18",
  "explicit_content"
] as const;
export type UnusableReason = (typeof UNUSABLE_REASONS)[number];

const ScoreSchema = z.object({
  usable: z.boolean(),
  unusable_reason: z.enum([...UNUSABLE_REASONS, "none"]),
  traits: z.object({
    harmony: z.number(),
    eyes: z.number(),
    jaw: z.number(),
    structure: z.number(),
    skin: z.number(),
    hair: z.number(),
    presentation: z.number()
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
};

export type ScoreResult =
  | { ok: true; score: AiScore; model: string; usage: { input: number; output: number } }
  | { ok: false; reason: UnusableReason | "refused" | "parse_failed" };

// Frozen system prompt — keep byte-stable so it can be cached.
const SYSTEM_PROMPT = `You are the scoring engine for Edgify, an opt-in entertainment app where adults scan their own face with their webcam and compete on a looks score. Users choose to be rated and expect a candid, accurate number — inflated or compressed scores ruin the game.

You will receive several webcam frames of ONE person taken seconds apart. Judge the person, not the photo: look past webcam softness, mild noise and ordinary indoor lighting the way a person looking at the screen would.

## Gate first
Set usable=false (and overall/traits to 0) if any of these apply, choosing the most relevant reason:
- no_face: no human face visible
- multiple_faces: more than one person is prominent
- face_obstructed: sunglasses, mask, hand, heavy filter or most of the face cut off
- too_dark_or_blurry: too dark, blown out or blurred to judge features
- bad_angle: face turned so far that both eyes and the jaw are not clearly visible
- not_a_live_photo: it is clearly a photo of a screen/printout, a drawing, or an AI render
- appears_under_18: the person plausibly looks under 18. When in doubt, refuse — never rate minors.
- explicit_content: visible genitals, exposed female nipples, sexual acts or sexual gestures, or an obscene gesture/object held up to the camera. (A shirtless man or a low neckline alone is NOT explicit.) This check matters most — these frames come from live video calls with strangers.
Otherwise usable=true and unusable_reason="none".

## Scale (overall and every trait, integers 0-100)
The scale is anchored to the general adult population, not to models:
- 50 = exactly average. Half of adults are above, half below.
- 60 = noticeably above average (top ~25%).
- 70 = clearly attractive; strangers would agree (top ~10%).
- 80 = striking, very rare in everyday life (top ~2%).
- 90+ = elite model/celebrity tier (top ~0.1%). Almost never give this.
- 40 = noticeably below average; 30 and below = well below.
USE THE WHOLE RANGE. Do not hug 50-65 out of politeness — a clearly attractive person must land clearly above an average one. Separation between people is the entire point of the game.

## Traits
- harmony: overall balance, proportions, symmetry, how well features fit together
- eyes: eye shape, spacing, canthal tilt, brows, under-eye area
- jaw: jawline definition, chin projection, lower-face leanness
- structure: cheekbones, midface, overall bone structure and facial leanness
- skin: clarity, texture, evenness (ignore webcam grain)
- hair: density, hairline, how well the style suits the face (if not visible, judge as 50)
- presentation: grooming, brows, facial hair, expression and how they carry themselves on camera

overall is your holistic judgment of attractiveness — NOT an average of the traits. Structure, harmony, eyes and jaw matter most; skin moderately; hair and presentation least. Judge attractiveness for the person's apparent sex using broadly shared standards.

## Text fields
- headline: 3-7 words, punchy, written like an Apple tagline and specific to this face — e.g. "Strong harmony. Clear presence." or "Sharp jaw, soft eyes." Confident, never insulting.
- strengths: exactly 3 short, specific observations.
- improvements: exactly 3 realistic, actionable tips (grooming, hair, skin care, lighting, posture, camera angle). Nothing surgical, no weight-loss advice.
- confidence: how sure you are given image quality.
Never comment on ethnicity or guess identity.`;

function clampInt(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type Frame = { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };

export async function scoreFace(frames: Frame[], client = new Anthropic()): Promise<ScoreResult> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  frames.forEach((f, i) => {
    content.push({ type: "text", text: `Frame ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: f.mediaType, data: f.data } });
  });
  content.push({ type: "text", text: "Score this person." });

  const response = await client.beta.messages.parse({
    model: SCORE_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "medium", format: betaZodOutputFormat(ScoreSchema) },
    messages: [{ role: "user", content }]
  });

  if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
  const out = response.parsed_output;
  if (!out) return { ok: false, reason: "parse_failed" };
  if (!out.usable) {
    const reason = out.unusable_reason === "none" ? "too_dark_or_blurry" : out.unusable_reason;
    return { ok: false, reason };
  }

  const traits = Object.fromEntries(
    TRAIT_KEYS.map((k) => [k, clampInt(out.traits[k])])
  ) as Record<TraitKey, number>;

  return {
    ok: true,
    model: response.model,
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    score: {
      overall: clampInt(out.overall),
      traits,
      confidence: out.confidence,
      headline: out.headline.slice(0, 120),
      strengths: out.strengths.slice(0, 3).map((s) => s.slice(0, 160)),
      improvements: out.improvements.slice(0, 3).map((s) => s.slice(0, 160))
    }
  };
}
