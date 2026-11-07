import "server-only";
import { scoreFace, type Frame, type ScoreResult, type UnusableReason } from "@/lib/scoring/ai-score";
import { HttpError } from "./http";
import { reserveAiCall } from "./ratelimit";

const MAX_FRAMES = 5;
const MAX_FRAME_BASE64 = 600_000; // ~450KB jpeg; client sends ~640px frames ≈ 60KB

export function parseFrames(input: unknown): Frame[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new HttpError(400, "no_frames", "No camera frames were sent.");
  }
  return input.slice(0, MAX_FRAMES).map((u) => {
    const m = typeof u === "string" ? u.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
    if (!m) throw new HttpError(400, "bad_frame", "Camera frames must be JPEG data URLs.");
    if (m[2].length > MAX_FRAME_BASE64) throw new HttpError(413, "frame_too_large", "Camera frame too large.");
    return { mediaType: m[1] as Frame["mediaType"], data: m[2] };
  });
}

export const UNUSABLE_MESSAGES: Record<UnusableReason | "refused" | "parse_failed", string> = {
  no_face: "We couldn't see a face. Center yourself in the frame.",
  multiple_faces: "Only one person in frame, please.",
  face_obstructed: "Something's covering your face — remove glasses, masks or hands.",
  too_dark_or_blurry: "We couldn't make out your features. Hold still, face a light, and try again.",
  bad_angle: "Look straight at the camera.",
  not_a_live_photo: "That doesn't look like a live camera feed.",
  explicit_content: "That frame broke our content rules. Keep it clean — repeat violations get you suspended.",
  refused: "We couldn't score that. Try again with a clear, front-facing shot.",
  parse_failed: "Scoring hiccup — please try again. This one didn't count."
};

/** Score frames with the global AI budget enforced. */
export async function scoreFramesOrExplain(frames: Frame[]): Promise<ScoreResult> {
  await reserveAiCall();
  try {
    const r = await scoreFace(frames);
    // Log rejections with the model's own explanation (visible in Vercel logs).
    if (!r.ok) console.warn(`[scan rejected] reason=${r.reason} frames=${frames.length} note=${r.note ?? ""}`);
    return r;
  } catch (e) {
    console.error("scoreFace failed", e);
    throw new HttpError(502, "ai_error", "Scoring is temporarily unavailable. Try again in a moment.");
  }
}
