import { handle, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { claimAttempt, leaveMatch, recordScore, viewMatch } from "@/lib/server/matches";
import { fileReport, suspend } from "@/lib/server/safety";
import { rateLimit } from "@/lib/server/ratelimit";
import { sanitizeRatios } from "@/lib/shared/ratios";
import { parseFrames, scoreFramesOrExplain, UNUSABLE_MESSAGES } from "@/lib/server/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * POST /api/match/:id/frames { frames, ratios? } — the server scores MY
 * camera frames. Scores are never accepted from clients; measured ratios are
 * sanity-checked and only inform the AI (with a capped nudge).
 */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const me = await requireUser();
  const body = await readJson<{ frames?: unknown; ratios?: unknown }>(req);
  const frames = parseFrames(body.frames);
  const ratios = sanitizeRatios(body.ratios);
  await claimAttempt(params.id, me);
  await rateLimit("match-burst", me, 40, 600, "Slow down a little — try again in a few minutes.");

  const r = await scoreFramesOrExplain(frames, ratios);
  if (!r.ok && r.reason === "explicit_content") {
    // Live video with a stranger: forfeit the match and pull them from matchmaking for a day.
    await fileReport({ target: me, by: "system", reason: "nudity", note: "AI flagged match frames", matchId: params.id, at: Date.now() });
    await suspend(me, 60 * 60 * 24, "Our AI flagged explicit content in a match.");
    await leaveMatch(params.id, me);
    return json({ ok: false, reason: r.reason, message: UNUSABLE_MESSAGES[r.reason], match: await viewMatch(params.id, me) }, 403);
  }
  if (!r.ok) {
    const message = UNUSABLE_MESSAGES[r.reason];
    return json({ ok: false, reason: r.reason, message, match: await viewMatch(params.id, me) }, 422);
  }
  await recordScore(params.id, me, {
    ok: true,
    overall: r.score.overall,
    traits: r.score.traits,
    headline: r.score.headline
  });
  return json({ ok: true, match: await viewMatch(params.id, me) });
});
