import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { addReading, getProfile, saveProfile, toMe } from "@/lib/server/profile";
import { rateLimit } from "@/lib/server/ratelimit";
import { parseFrames, scoreFramesOrExplain, UNUSABLE_MESSAGES } from "@/lib/server/scoring";
import { redis, K } from "@/lib/server/redis";
import { fileReport } from "@/lib/server/safety";
import { sanitizeRatios } from "@/lib/shared/ratios";
import { SCORE_SCALE_VERSION } from "@/lib/shared/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const MAX_THUMB = 120_000;

/**
 * POST /api/scan { frames: dataUrl[], thumb: dataUrl, ratios?: Ratios }
 * Scores up to 5 face crops with Claude (plus the facial ratios measured in
 * the browser) and folds the result into the user's rolling score. The thumb
 * becomes their public avatar.
 */
export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const body = await readJson<{ frames?: unknown; thumb?: unknown; ratios?: unknown }>(req);
  const frames = parseFrames(body.frames);
  const ratios = sanitizeRatios(body.ratios);

  // No daily cap — just a burst guard against scripts hammering the AI.
  await rateLimit("scan-burst", u, 30, 600, "Slow down a little — try again in a few minutes.");

  const result = await scoreFramesOrExplain(frames, ratios);
  if (!result.ok && result.reason === "explicit_content") {
    await fileReport({ target: u, by: "system", reason: "nudity", note: "AI flagged a solo scan", matchId: null, at: Date.now() });
  }
  if (!result.ok) {
    return json({ ok: false, reason: result.reason, message: UNUSABLE_MESSAGES[result.reason] }, 422);
  }

  const p = await getProfile(u);
  const { overall, traits, headline, strengths, improvements, confidence, sex } = result.score;
  addReading(
    p,
    { overall, traits, at: Date.now(), source: "scan", v: SCORE_SCALE_VERSION },
    { headline, strengths, improvements, confidence, sex }
  );
  if (p.score) {
    p.score.ratios = result.score.ratios;
    p.score.ratioScore = result.score.ratioScore;
  }

  if (typeof body.thumb === "string" && body.thumb.startsWith("data:image/jpeg;base64,")) {
    if (body.thumb.length > MAX_THUMB) throw new HttpError(413, "thumb_too_large");
    await redis().set(K.face(u), body.thumb);
    p.hasFace = true;
  }
  await saveProfile(p);

  return json({ ok: true, reading: result.score, me: toMe(p) });
});
