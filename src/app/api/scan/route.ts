import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { addReading, getProfile, saveProfile, toMe } from "@/lib/server/profile";
import { LIMITS, rateLimit } from "@/lib/server/ratelimit";
import { parseFrames, scoreFramesOrExplain, UNUSABLE_MESSAGES } from "@/lib/server/scoring";
import { redis, K } from "@/lib/server/redis";
import { fileReport } from "@/lib/server/safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_THUMB = 120_000;

/**
 * POST /api/scan { frames: dataUrl[], thumb: dataUrl }
 * Scores 1-3 webcam frames with Claude and folds the result into the
 * user's rolling score. The thumb becomes their public avatar.
 */
export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const body = await readJson<{ frames?: unknown; thumb?: unknown }>(req);
  const frames = parseFrames(body.frames);

  await rateLimit("scan", u, LIMITS.scansPerDay, 86400, `You've used today's ${LIMITS.scansPerDay} scans. Come back tomorrow.`);

  const result = await scoreFramesOrExplain(frames);
  if (!result.ok && result.reason === "explicit_content") {
    await fileReport({ target: u, by: "system", reason: "nudity", note: "AI flagged a solo scan", matchId: null, at: Date.now() });
  }
  if (!result.ok) {
    return json({ ok: false, reason: result.reason, message: UNUSABLE_MESSAGES[result.reason] }, 422);
  }

  const p = await getProfile(u);
  const { overall, traits, headline, strengths, improvements, confidence } = result.score;
  addReading(p, { overall, traits, at: Date.now(), source: "scan" }, { headline, strengths, improvements, confidence });

  if (typeof body.thumb === "string" && body.thumb.startsWith("data:image/jpeg;base64,")) {
    if (body.thumb.length > MAX_THUMB) throw new HttpError(413, "thumb_too_large");
    await redis().set(K.face(u), body.thumb);
    p.hasFace = true;
  }
  await saveProfile(p);

  return json({ ok: true, reading: result.score, me: toMe(p) });
});
